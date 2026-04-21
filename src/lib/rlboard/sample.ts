import type { RLBoardRecord } from "./schema";

/**
 * All sample records use Qwen3-style chat template:
 *
 *   <|im_start|>system\n…<|im_end|>\n
 *   <|im_start|>user\n…<|im_end|>\n
 *   <|im_start|>assistant\n[<think>…</think>][<tool_call>…</tool_call>]…<|im_end|>\n
 *   <|im_start|>tool\n<tool_response>…</tool_response><|im_end|>\n
 *
 * The token list is the canonical source — every per-token metric stays
 * length-aligned with `response_tokens`, so deriveSegments() always finds
 * structure (user / assistant / think / tool_call / tool_result …).
 */

interface RolloutBuilder {
  tokens: string[];
  hints: { kind: "think" | "tool_call" | "tool_result"; from: number; to: number }[];
}

function newBuilder(): RolloutBuilder {
  return { tokens: [], hints: [] };
}

function pushText(b: RolloutBuilder, text: string) {
  // Coarse word/punct tokenization, but ChatML / think / tool markers are kept whole.
  const re =
    /(<\|im_start\|>|<\|im_end\|>|<\/?think>|<\/?tool_call>|<\/?tool_response>|\s+|[^\s\w]|\w+)/g;
  const parts = text.match(re);
  if (!parts) return;
  for (const p of parts) b.tokens.push(p);
}

function block(b: RolloutBuilder, role: "system" | "user" | "assistant" | "tool", body: () => void) {
  pushText(b, `<|im_start|>${role}\n`);
  body();
  pushText(b, `<|im_end|>\n`);
}

function thinkBlock(b: RolloutBuilder, body: () => void) {
  const t0 = b.tokens.length;
  pushText(b, "<think>\n");
  body();
  pushText(b, "\n</think>\n");
  b.hints.push({ kind: "think", from: t0, to: b.tokens.length });
}

function toolCall(b: RolloutBuilder, name: string, args: Record<string, unknown>) {
  const t0 = b.tokens.length;
  pushText(b, "<tool_call>\n");
  pushText(b, JSON.stringify({ name, arguments: args }));
  pushText(b, "\n</tool_call>\n");
  b.hints.push({ kind: "tool_call", from: t0, to: b.tokens.length });
}

function toolResponse(b: RolloutBuilder, payload: unknown) {
  block(b, "tool", () => {
    const t0 = b.tokens.length;
    pushText(b, "<tool_response>\n");
    pushText(b, JSON.stringify(payload));
    pushText(b, "\n</tool_response>\n");
    b.hints.push({ kind: "tool_result", from: t0, to: b.tokens.length });
  });
}

// ---------- per-token metric synthesis ----------

function synthMetrics(
  b: RolloutBuilder,
  step: number,
  finalReward: number,
): Pick<
  RLBoardRecord,
  "logprobs" | "ref_logprobs" | "values" | "token_rewards" | "advantages" | "entropy"
> {
  const n = b.tokens.length;
  const logp = new Array<number>(n);
  const reflp = new Array<number>(n);
  const values = new Array<number>(n);
  const tokRew = new Array<number>(n);
  const adv = new Array<number>(n);
  const ent = new Array<number>(n);
  let s = (step * 9301 + 49297) >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const inHint = (i: number, k: string) =>
    b.hints.some((h) => h.kind === k && i >= h.from && i < h.to);

  for (let i = 0; i < n; i++) {
    const tok = b.tokens[i];
    const isMarker =
      /^<\|/.test(tok) || /^<\/?(think|tool_call|tool_response)>$/.test(tok);
    const inThink = inHint(i, "think");
    const inTool = inHint(i, "tool_call") || inHint(i, "tool_result");
    const base = isMarker ? -0.05 : inThink ? -2.0 : inTool ? -0.6 : -1.0;
    const lp = base + (rand() - 0.5) * 0.4;
    logp[i] = lp;
    reflp[i] = lp - (inThink ? 0.5 : inTool ? 0.15 : 0.05) - (rand() - 0.5) * 0.2;
    values[i] = 0.4 + Math.sin(i / 6 + step) * 0.25 + (rand() - 0.5) * 0.1;
    const isTail = i >= n - 8;
    tokRew[i] = isTail ? finalReward / 8 : (rand() - 0.5) * 0.01;
    adv[i] = (isTail ? 0.4 : 0) + (rand() - 0.5) * 0.1;
    ent[i] = inThink ? 1.4 + rand() * 0.3 : isMarker ? 0.1 : 0.5 + rand() * 0.2;
  }
  return {
    logprobs: logp,
    ref_logprobs: reflp,
    values,
    token_rewards: tokRew,
    advantages: adv,
    entropy: ent,
  };
}

function finalize(
  b: RolloutBuilder,
  opts: {
    step: number;
    rolloutId: string;
    prompt: string;
    refResponse?: string;
    finalReward: number;
    metadata?: Record<string, unknown>;
  },
): RLBoardRecord {
  const m = synthMetrics(b, opts.step, opts.finalReward);
  return {
    step: opts.step,
    rollout_id: opts.rolloutId,
    prompt: opts.prompt,
    response: b.tokens.join(""),
    ref_response: opts.refResponse,
    response_tokens: b.tokens,
    ...m,
    reward: opts.finalReward,
    ref_reward: opts.finalReward - 0.25,
    kl: 0.05 + Math.random() * 0.05,
    metadata: { model: "Qwen3-demo", chat_template: "qwen3", ...(opts.metadata ?? {}) },
  };
}

// ---------- scenario factories ----------

const RHYME_PROMPTS = [
  "Compose a short rhyming verse about spring rain.",
  "Write four lines about a cat watching the moon.",
  "Make a couplet about morning coffee.",
  "Write a tiny poem about a paper boat.",
];

const RHYME_BODIES = [
  "Soft rain taps on the windowpane,\nA whispered hush, a quiet refrain.\nThe garden drinks the silver thread,\nWhile sleeping flowers raise their head.",
  "The cat upon the sill at night,\nWatches the moon, silver-white.\nHer eyes reflect the cosmic glow,\nAs clouds drift slowly, soft and slow.",
  "Steam curls up from the morning brew,\nA quiet start, a day made new.",
  "A paper boat upon a stream,\nSails away inside a dream.",
];

/** Plain rhyming task with assistant + (sometimes) <think>. */
function makeRhymeRecord(step: number, variant: number): RLBoardRecord {
  const b = newBuilder();
  const prompt = RHYME_PROMPTS[variant % RHYME_PROMPTS.length];
  const body = RHYME_BODIES[variant % RHYME_BODIES.length];
  const useThink = (step + variant) % 3 !== 0;

  block(b, "system", () => pushText(b, "You are a helpful poet."));
  block(b, "user", () => pushText(b, prompt));
  block(b, "assistant", () => {
    if (useThink) {
      thinkBlock(b, () => {
        pushText(b, "Pick a calm tone, choose ABAB rhyme, keep it concise.");
      });
    }
    pushText(b, body);
  });

  return finalize(b, {
    step,
    rolloutId: `rhyme-s${step}-v${variant}`,
    prompt,
    refResponse: body.split("\n").slice(0, 2).join("\n"),
    finalReward: (step / 24 - 0.2) * 1.5 + (variant - 2) * 0.1,
    metadata: { task: "rhyme", reasoning: useThink ? "think" : "direct" },
  });
}

/** Math word problem — long <think> reasoning, short final answer. */
function makeMathRecord(step: number, variant: number): RLBoardRecord {
  const b = newBuilder();
  const prompt =
    variant % 2 === 0
      ? "If a train leaves at 9:15 and travels 312 km at 78 km/h, what time does it arrive?"
      : "A rectangle has perimeter 46 cm and area 120 cm². What are its sides?";
  block(b, "system", () => pushText(b, "You are a careful math tutor. Show reasoning before the answer."));
  block(b, "user", () => pushText(b, prompt));
  block(b, "assistant", () => {
    thinkBlock(b, () => {
      if (variant % 2 === 0) {
        pushText(
          b,
          "Travel time = 312 / 78 = 4 hours.\nDeparture 9:15 + 4:00 = 13:15.\nDouble-check: 78 × 4 = 312 ✓.",
        );
      } else {
        pushText(
          b,
          "Let sides be a and b.\n2(a+b)=46 ⇒ a+b=23.\na·b=120.\nQuadratic: x²-23x+120=0 ⇒ x=(23±√(529-480))/2=(23±7)/2.\nSo sides are 15 and 8.",
        );
      }
    });
    pushText(
      b,
      variant % 2 === 0 ? "The train arrives at 13:15." : "The sides are 15 cm and 8 cm.",
    );
  });
  return finalize(b, {
    step,
    rolloutId: `math-s${step}-v${variant}`,
    prompt,
    refResponse: variant % 2 === 0 ? "13:15" : "15 cm and 8 cm",
    finalReward: 0.2 + (step / 24) * 0.6 + (variant % 2) * 0.1,
    metadata: { task: "math", reasoning: "think" },
  });
}

/** Agentic search — think → tool_call → tool_response → think → answer. */
function makeAgenticRecord(step: number, variant: number): RLBoardRecord {
  const b = newBuilder();
  const prompt =
    variant % 2 === 0
      ? "What is the capital of France and its 2023 population?"
      : "Get the current weather in Tokyo and recommend an outfit.";

  block(b, "system", () =>
    pushText(b, "You are an agent with access to tools: search, weather, calculator."),
  );
  block(b, "user", () => pushText(b, prompt));

  block(b, "assistant", () => {
    thinkBlock(b, () =>
      pushText(
        b,
        variant % 2 === 0
          ? "I need a recent figure. I'll search for Paris population in 2023."
          : "I need today's Tokyo weather, then map conditions to clothing.",
      ),
    );
    if (variant % 2 === 0) {
      toolCall(b, "search", { q: "Paris population 2023" });
    } else {
      toolCall(b, "weather", { city: "Tokyo", units: "metric" });
    }
  });

  if (variant % 2 === 0) {
    toolResponse(b, {
      results: [{ title: "Paris — 2 102 650 (2023 census)", url: "https://example.org" }],
    });
  } else {
    toolResponse(b, { city: "Tokyo", temp_c: 14, condition: "light rain", wind_kph: 12 });
  }

  block(b, "assistant", () => {
    thinkBlock(b, () =>
      pushText(
        b,
        variant % 2 === 0
          ? "Result is from a 2023 census — confident enough to answer directly."
          : "14°C with light rain → light jacket + umbrella; long pants; closed shoes.",
      ),
    );
    pushText(
      b,
      variant % 2 === 0
        ? "Paris is the capital of France; its 2023 population is approximately 2 102 650."
        : "Tokyo is 14°C with light rain. Wear a light jacket, long pants, closed shoes, and bring an umbrella.",
    );
  });

  return finalize(b, {
    step,
    rolloutId: `agentic-s${step}-v${variant}`,
    prompt,
    refResponse:
      variant % 2 === 0
        ? "Paris is the capital of France."
        : "Bring an umbrella; it's raining lightly in Tokyo.",
    finalReward: 0.5 + (variant % 2 === 0 ? 0.3 : 0.1) + (step / 24) * 0.2,
    metadata: { task: "agentic-tools", reasoning: "think" },
  });
}

/** Multi-tool agent — code interpreter then explanation. */
function makeCodeAgentRecord(step: number, variant: number): RLBoardRecord {
  const b = newBuilder();
  const prompt = "Compute the 20th Fibonacci number and explain the approach.";
  block(b, "system", () =>
    pushText(b, "You can call: python (code interpreter), search."),
  );
  block(b, "user", () => pushText(b, prompt));
  block(b, "assistant", () => {
    thinkBlock(b, () =>
      pushText(b, "I'll iterate F(n)=F(n-1)+F(n-2) up to n=20. Let me run it in python."),
    );
    toolCall(b, "python", {
      code: "a,b=0,1\nfor _ in range(20): a,b=b,a+b\nprint(a)",
    });
  });
  toolResponse(b, { stdout: "6765\n" });
  block(b, "assistant", () => {
    thinkBlock(b, () => pushText(b, "Confirmed: F(20)=6765. Now explain briefly."));
    pushText(
      b,
      "F(20) = 6765. The iterative approach keeps two rolling values, giving O(n) time and O(1) space.",
    );
  });
  return finalize(b, {
    step,
    rolloutId: `code-s${step}-v${variant}`,
    prompt,
    refResponse: "6765",
    finalReward: 0.6 + (step / 24) * 0.2,
    metadata: { task: "code-agent", reasoning: "think" },
  });
}

/** Generate a deterministic synthetic dataset — every record is Qwen3-templated. */
export function makeSampleRecords(): RLBoardRecord[] {
  const out: RLBoardRecord[] = [];
  for (let step = 0; step < 16; step++) {
    out.push(makeRhymeRecord(step, 0));
    out.push(makeRhymeRecord(step, 1));
    out.push(makeMathRecord(step, step % 2));
    if (step % 3 === 0) out.push(makeAgenticRecord(step, 0));
    if (step % 3 === 1) out.push(makeAgenticRecord(step, 1));
    if (step % 4 === 2) out.push(makeCodeAgentRecord(step, 0));
  }
  // a couple of extra agentic records at the tail so they're always near the top of "by step"
  out.push(makeAgenticRecord(16, 0));
  out.push(makeAgenticRecord(16, 1));
  out.push(makeCodeAgentRecord(16, 0));
  return out;
}

/**
 * Build a single very long Qwen3-templated record (~256k tokens). Structure:
 *   system → user → assistant(<think> long reasoning </think> long answer body)
 * Per-token metrics are length-aligned with the token stream.
 */
export function makeLongContextRecord(targetTokens = 262144): RLBoardRecord {
  // A small corpus of coherent sentences about RL — split into BPE-ish pieces
  // (Ġ = leading space, ## = WordPiece continuation) so the renderer's
  // BPE decoder produces readable English at scale.
  const SENTENCES: string[] = [
    "Policy gradient methods optimize the expected return by following the gradient of the log probability of actions weighted by the advantage.",
    "In GRPO we drop the value baseline and instead normalize rewards within a group of rollouts sampled from the same prompt.",
    "The KL term keeps the updated policy close to the reference model so that learned behaviour does not drift away from the supervised checkpoint.",
    "When the advantage is positive the loss pushes the log probability of the chosen token up, and when it is negative the loss pushes it down.",
    "Long context training stresses both memory and reward attribution because the credit signal must travel across tens of thousands of tokens.",
    "Token level entropy is a useful diagnostic, since collapsing entropy often predicts that the policy is about to overfit a single mode.",
    "The reward model assigns a scalar to the entire response, which we then broadcast or shape into per token rewards before computing advantages.",
    "A well calibrated critic predicts the expected return from each state, and a low critic loss is a prerequisite for stable PPO updates.",
    "Reasoning traces inside think blocks tend to have lower log probabilities because the model is exploring rather than committing to an answer.",
    "Tool calls produce structured outputs whose tokens are largely deterministic, so their entropy collapses to near zero on a well trained policy.",
  ];

  // Tokenize a sentence into BPE-ish pieces. First word in a sentence has no
  // leading space; every following word gets a Ġ prefix; ~25% of long words
  // are split into a head + ##tail to mimic WordPiece continuation.
  const pieceify = (sentence: string, seed: () => number): string[] => {
    const words = sentence.split(/\s+/);
    const out: string[] = [];
    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      const prefix = wi === 0 ? "" : "Ġ";
      const trailing = word.match(/[.,;:!?]+$/)?.[0] ?? "";
      const core = trailing ? word.slice(0, -trailing.length) : word;
      if (core.length >= 6 && seed() < 0.25) {
        const split = 2 + Math.floor(seed() * (core.length - 3));
        out.push(prefix + core.slice(0, split));
        out.push("##" + core.slice(split));
      } else if (core.length > 0) {
        out.push(prefix + core);
      }
      if (trailing) out.push(trailing);
    }
    return out;
  };

  let s = 0xc0ffee >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  const tokens: string[] = [];
  const b: RolloutBuilder = { tokens, hints: [] };

  // Header — system + user
  block(b, "system", () =>
    pushText(b, "You are a careful research assistant. Think step by step before answering."),
  );
  block(b, "user", () =>
    pushText(
      b,
      "Write a long, detailed analysis of policy gradient methods for very long contexts.",
    ),
  );

  // Open assistant turn
  pushText(b, "<|im_start|>assistant\n");

  // Open think — fill ~30 % of remaining budget with coherent sentences
  const remaining = () => Math.max(0, targetTokens - tokens.length - 32);
  const thinkBudget = Math.floor(remaining() * 0.3);
  pushText(b, "<think>\n");
  const thinkStart = tokens.length;

  while (tokens.length - thinkStart < thinkBudget) {
    const sent = SENTENCES[Math.floor(rand() * SENTENCES.length)];
    const pieces = pieceify(sent, rand);
    for (const p of pieces) {
      if (tokens.length - thinkStart >= thinkBudget) break;
      tokens.push(p);
    }
    if (rand() < 0.2 && tokens.length - thinkStart < thinkBudget) tokens.push("\n");
  }
  const thinkEnd = tokens.length;
  pushText(b, "\n</think>\n");
  b.hints.push({ kind: "think", from: thinkStart - 1, to: thinkEnd + 1 });

  // Body fills the rest, leaving room for closing markers
  const bodyBudget = Math.max(0, targetTokens - tokens.length - 8);
  const bodyStart = tokens.length;
  while (tokens.length - bodyStart < bodyBudget) {
    const sent = SENTENCES[Math.floor(rand() * SENTENCES.length)];
    const pieces = pieceify(sent, rand);
    for (const p of pieces) {
      if (tokens.length - bodyStart >= bodyBudget) break;
      tokens.push(p);
    }
    if (rand() < 0.15 && tokens.length - bodyStart < bodyBudget) tokens.push("\n");
  }

  pushText(b, "<|im_end|>\n");

  // Per-token metrics
  const m = synthMetrics(b, 0, 4.2);

  return {
    step: 0,
    rollout_id: "long-context-256k",
    prompt: "Synthetic 256k-token Qwen3-templated rollout (think + long answer).",
    response: `(${tokens.length.toLocaleString()} tokens — preview omitted; use the trajectory view below)`,
    response_tokens: tokens,
    ...m,
    reward: 4.2,
    ref_reward: 2.1,
    metadata: {
      task: "long-context-demo",
      tokens: tokens.length,
      tokenizer: "synthetic-bpe",
      chat_template: "qwen3",
    },
  };
}
