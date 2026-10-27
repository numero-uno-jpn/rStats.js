// Adjacent doubles and the point where a condition on a double flips (for the threshold tests).
//
// Doubles are mapped to integers in their order (the bit pattern for x >= 0, its negation for x < 0, with -0 and +0
// both at 0), so that neighbours differ by 1 and a bisection over the integers visits every double between two ends.

const buf = new DataView(new ArrayBuffer(8));

/** Position of x among the doubles (monotone in x; -0 and +0 both map to 0) */
export function ordinal(x: number): bigint {
  if (Number.isNaN(x)) throw new RangeError("ordinal of NaN");
  buf.setFloat64(0, Math.abs(x));
  const bits = buf.getBigUint64(0);
  return x < 0 ? -bits : bits;
}

/** The double at position n (inverse of ordinal) */
export function fromOrdinal(n: bigint): number {
  buf.setBigUint64(0, n < 0n ? -n : n);
  const v = buf.getFloat64(0);
  return n < 0n ? -v : v;
}

/** The smallest double above x (Infinity stays Infinity) */
export function nextUp(x: number): number {
  if (Number.isNaN(x) || x === Infinity) return x;
  return fromOrdinal(ordinal(x) + 1n);
}

/** The largest double below x (-Infinity stays -Infinity) */
export function nextDown(x: number): number {
  if (Number.isNaN(x) || x === -Infinity) return x;
  return fromOrdinal(ordinal(x) - 1n);
}

/** The double k steps above x (below for negative k) */
export function ulpsFrom(x: number, k: number): number {
  return fromOrdinal(ordinal(x) + BigInt(k));
}

/**
 * Adjacent doubles [a, b] (a < b) between lo and hi at which pred changes value, by bisection over the doubles.
 * pred(lo) and pred(hi) must differ; for a predicate that flips once in [lo, hi] this is the flip point
 */
export function flipPoint(pred: (x: number) => boolean, lo: number, hi: number): [number, number] {
  let a = ordinal(lo);
  let b = ordinal(hi);
  if (a > b) [a, b] = [b, a];
  const pa = pred(fromOrdinal(a));
  if (pa === pred(fromOrdinal(b))) throw new RangeError(`no flip of the condition between ${lo} and ${hi}`);
  while (b - a > 1n) {
    const m = a + (b - a) / 2n;
    if (pred(fromOrdinal(m)) === pa) a = m;
    else b = m;
  }
  return [fromOrdinal(a), fromOrdinal(b)];
}
