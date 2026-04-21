import type { RLBoardRecord } from "./schema";

/** Generate a deterministic synthetic dataset suitable for showcasing all modules. */
export function makeSampleRecords(): RLBoardRecord[] {
  const records: RLBoardRecord[] = [];
  const seedRng = (seed: number) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  };
  const lipsum = [
    "The", "rain", "in", "Spain", "stays", "mainly", "on", "the", "plain",
    ".", "Roses", "are", "red", ",", "violets", "are", "blue", ",", "sugar",
    "is", "sweet", ",", "and", "so", "are", "you", ".",
  ];
  for (let step = 0; step < 24; step++) {
    for (let r = 0; r < 4; r++) {
      const rng = seedRng(step * 100 + r * 7);
      const len = 48 + Math.floor(rng() * 80);
      const tokens: string[] = [];
      const logp: number[] = [];
      const reflogp: number[] = [];
      const values: number[] = [];
      const tokRew: number[] = [];
      const adv: number[] = [];
      const ent: number[] = [];
      let cumulative = 0;
      for (let i = 0; i < len; i++) {
        tokens.push(lipsum[Math.floor(rng() * lipsum.length)]);
        const lp = -Math.abs(rng() * 3 + 0.2) - (i / len) * 0.5;
        const rlp = lp - (rng() - 0.5) * 0.6 - (step / 24) * 0.4;
        const v = 0.4 + Math.sin(i / 6 + step) * 0.3 + (rng() - 0.5) * 0.2;
        const tr = (i === len - 1 ? (step / 24 - 0.3) * 2 : 0) + (rng() - 0.5) * 0.05;
        cumulative += tr;
        const a = tr + (rng() - 0.5) * 0.3;
        const e = 0.5 + Math.cos(i / 9) * 0.3 + rng() * 0.2;
        logp.push(lp);
        reflogp.push(rlp);
        values.push(v);
        tokRew.push(tr);
        adv.push(a);
        ent.push(e);
      }
      records.push({
        step,
        rollout_id: `s${step}-r${r}`,
        group_id: `s${step}-grp`,
        prompt: "Compose a short rhyming verse about spring rain.",
        response: tokens.join(" "),
        ref_response: tokens.slice(0, Math.floor(len * 0.8)).join(" "),
        response_tokens: tokens,
        logprobs: logp,
        ref_logprobs: reflogp,
        values,
        token_rewards: tokRew,
        advantages: adv,
        entropy: ent,
        reward: cumulative + (step / 24 - 0.2) * 1.5 + (rng() - 0.5) * 0.4,
        ref_reward: (step / 24 - 0.4) * 1.0 + (rng() - 0.5) * 0.4,
        kl: (rng() * 0.15 + 0.02) * (1 + step / 30),
        metadata: { task: "rhyme", model: "demo-7b" },
      });
    }
  }
  return records;
}

/** Build a single, very long synthetic record (~256k tokens) to demo long-context. */
export function makeLongContextRecord(targetTokens = 262144): RLBoardRecord {
  const n = targetTokens;
  const logp = new Array<number>(n);
  const reflogp = new Array<number>(n);
  const values = new Array<number>(n);
  const tokRew = new Array<number>(n);
  const adv = new Array<number>(n);
  const ent = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const wave = Math.sin(i / 800) * Math.cos(i / 137);
    logp[i] = -1.5 + wave * 0.8 - t * 0.5;
    reflogp[i] = logp[i] - 0.2 - Math.sin(i / 1500) * 0.4;
    values[i] = 0.5 + Math.sin(i / 600) * 0.4;
    tokRew[i] = (i % 4096 === 0 ? 1 : 0) * (0.5 + Math.cos(i / 9000));
    adv[i] = wave * 0.6 + (Math.random() - 0.5) * 0.05;
    ent[i] = 0.5 + Math.cos(i / 1100) * 0.3;
  }
  return {
    step: 0,
    rollout_id: "long-context-demo",
    prompt: "Long context demo (synthetic).",
    response: "(synthetic — token strings omitted to keep payload small)",
    logprobs: logp,
    ref_logprobs: reflogp,
    values,
    token_rewards: tokRew,
    advantages: adv,
    entropy: ent,
    reward: 4.2,
    ref_reward: 2.1,
    metadata: { task: "long-context-demo", tokens: n },
  };
}
