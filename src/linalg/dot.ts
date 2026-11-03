// The fallback for an inner product whose plain sum is not finite, shared by matMul (ops.ts), crossprod and
// tcrossprod (basic.ts) and the matrix form of predict for lm (models/lm.ts).
//
// Written for rStats.js (no ported code).

/** A finite double as an integer mantissa m and an exponent e with v = m * 2^e (subnormals included) */
function splitDouble(v: number): [bigint, number] {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, v);
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const biased = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  if (biased !== 0) m |= 1n << 52n;
  if (hi >>> 31) m = -m;
  return [m, biased === 0 ? -1074 : biased - 1075];
}

/** m * 2^e as a double, with |m| < 2^54 so that Number(m) is exact; the scaling is split so that no step underflows */
function scaleExact(m: bigint, e: number): number {
  const a = Math.trunc(e / 2);
  return Number(m) * 2 ** a * 2 ** (e - a);
}

/**
 * The inner product of u and v when the plain sum s is not finite: with finite factors, the products may have
 * overflowed while the sum is in range (1e308 * 1e308 + 1e308 * -1e308 gave NaN, R too). Each product is formed
 * exactly as an integer times a power of 2, the products are summed exactly in BigInt, and the sum is rounded once
 * to the nearest double (ties to even, subnormals and overflow to Infinity included). Cancellation of the large
 * products therefore leaves the exact remainder (matMul([[1e308, 1e308, 1e-308]], [[1e308], [-1e308], [1e308]]) is
 * 0.9999999999999999, the double product 1e-308 * 1e308). With a factor that is not finite, s is returned as it is
 */
export function rescaledDot(u: readonly number[], v: readonly number[], s: number): number {
  if (!u.every(Number.isFinite) || !v.every(Number.isFinite)) return s;
  const mantissas: bigint[] = [];
  const exponents: number[] = [];
  let low = Infinity;
  for (let k = 0; k < u.length; k++) {
    if (u[k] === 0 || v[k] === 0) continue;
    const [ma, ea] = splitDouble(u[k]!);
    const [mb, eb] = splitDouble(v[k]!);
    mantissas.push(ma * mb);
    exponents.push(ea + eb);
    if (ea + eb < low) low = ea + eb;
  }
  let sum = 0n;
  for (let k = 0; k < mantissas.length; k++) sum += mantissas[k]! << BigInt(exponents[k]! - low);
  if (sum === 0n) return 0;
  const negative = sum < 0n;
  const a = negative ? -sum : sum;
  const bits = a.toString(2).length;
  // a = 2^(bits - 1) * (1 + ...), so the value is in [2^top, 2^(top + 1))
  const top = bits - 1 + low;
  if (top > 1023) return negative ? -Infinity : Infinity;
  // the last kept bit is at 2^(top - 52), or at 2^-1074 for a subnormal result
  const last = Math.max(top - 52, -1074);
  const shift = last - low;
  let q: bigint;
  if (shift <= 0) q = a;
  else {
    const sh = BigInt(shift);
    q = a >> sh;
    const rest = a - (q << sh);
    const half = 1n << (sh - 1n);
    if (rest > half || (rest === half && (q & 1n) === 1n)) q += 1n;
  }
  // rounding up to 2^53 (or past 2^1024) is exact here and overflows to Infinity in the scaling
  const out = scaleExact(q, shift <= 0 ? low : last);
  return negative ? -out : out;
}
