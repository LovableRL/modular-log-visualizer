/** Token-string heuristics shared across viz modules. */

const SPECIAL_TOKEN_RE = /^(<\|?(?:pad|endoftext|bos|eos|unk|s|\/s|sep|cls|mask|im_start|im_end|system|user|assistant)\|?>|<pad>|\[PAD\]|\[CLS\]|\[SEP\]|\[MASK\]|\[BOS\]|\[EOS\]|<\|.+?\|>)$/i;

/**
 * Decode a raw tokenizer piece into something readable.
 *
 *  - BPE: leading `Ġ` (GPT-2/Qwen) or `▁` (SentencePiece) means "space + word".
 *  - WordPiece: leading `##` means "glue to previous token, no prefix".
 *  - ChatML / think / tool markers are kept as-is so structure stays visible.
 *
 * Returns `{ text, glue }` — when `glue` is true, the renderer should drop the
 * gap between this token and the previous one (WordPiece continuation).
 */
export function decodeTokenForDisplay(tok: string): { text: string; glue: boolean } {
  if (!tok) return { text: "", glue: false };
  // Keep structural markers literal
  if (/^<\|.+?\|>$/.test(tok) || /^<\/?(?:think|tool_call|tool_response)>$/.test(tok)) {
    return { text: tok, glue: false };
  }
  if (tok.startsWith("##") && tok.length > 2) {
    return { text: tok.slice(2), glue: true };
  }
  if (tok.startsWith("Ġ")) {
    return { text: " " + tok.slice(1), glue: false };
  }
  if (tok.startsWith("▁")) {
    return { text: " " + tok.slice(1), glue: false };
  }
  return { text: tok, glue: false };
}

export function isSpecialToken(tok: string | undefined): boolean {
  if (!tok) return false;
  if (SPECIAL_TOKEN_RE.test(tok.trim())) return true;
  return false;
}

/** Return indices of non-special tokens in a token list. */
export function nonSpecialIndices(tokens: string[] | undefined): number[] | null {
  if (!tokens) return null;
  const out: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!isSpecialToken(tokens[i])) out.push(i);
  }
  return out;
}
