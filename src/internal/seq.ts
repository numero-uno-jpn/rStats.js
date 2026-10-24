/** n equally spaced values from `from` to `to`, both ends exact (R's seq(from, to, length.out = n)) */
export function seqLength(from: number, to: number, n: number): number[] {
  if (n === 1) return [from];
  const by = (to - from) / (n - 1);
  const out = Array.from({ length: n }, (_, i) => from + i * by);
  if (n > 0) out[n - 1] = to;
  return out;
}
