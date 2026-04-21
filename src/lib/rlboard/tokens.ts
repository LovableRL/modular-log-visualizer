/** Token-string heuristics shared across viz modules. */

const SPECIAL_TOKEN_RE = /^(<\|?(?:pad|endoftext|bos|eos|unk|s|\/s|sep|cls|mask|im_start|im_end|system|user|assistant)\|?>|<pad>|\[PAD\]|\[CLS\]|\[SEP\]|\[MASK\]|\[BOS\]|\[EOS\]|<\|.+?\|>)$/i;

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
