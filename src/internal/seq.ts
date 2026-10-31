/**
 * Equally spaced values from `from` to `to`, both ends exact (R's seq(from, to, length.out = n)). A fractional `n` is
 * rounded up, as R's seq does.
 */
export function seqLength(from: number, to: number, n: number): number[] {
  const len = Math.ceil(n);
  if (len === 1) return [from];
  let out: number[];
  if (Number.isFinite(to - from) || !Number.isFinite(from) || !Number.isFinite(to)) {
    const by = (to - from) / (len - 1);
    out = Array.from({ length: len }, (_, i) => from + i * by);
  } else {
    // finite ends whose difference overflows: in half coordinates, doubled (seqLength(-1e308, 1e308, 3) was NaN,
    // Infinity, 1e308; R's seq gives -1e308, 0, 1e308)
    const h = from / 2;
    const by = (to / 2 - h) / (len - 1);
    out = Array.from({ length: len }, (_, i) => 2 * (h + i * by));
  }
  if (len > 0) out[len - 1] = to;
  return out;
}
