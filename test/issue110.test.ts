// Issue #110: dlaplace where 2 sigma overflows rounds e^-|z| / (2 sigma) once (review_fix_log_issue110.md). The
// reference is that quotient of the doubles e (as the density forms it) and sigma, exact in BigInt, rounded once to the
// nearest double (ties to even) on the subnormal grid.
import { describe, expect, it } from "vitest";
import { dlaplace } from "../src/index.js";
import { expNeg, standardizeDD } from "../src/internal/ddexp.js";

/** [mantissa, exponent] of a positive finite double */
function parts(x: number): [bigint, number] {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  const b = v.getBigUint64(0);
  const e = Number((b >> 52n) & 0x7ffn);
  const f = b & 0xfffffffffffffn;
  return e === 0 ? [f, -1074] : [f | (1n << 52n), e - 1075];
}

/** e / (2 s) rounded once to a multiple of 2^-1074 (the result is subnormal here) */
function roundedQuotient(e: number, s: number): number {
  const [me, ee] = parts(e);
  const [ms, es] = parts(s);
  // q 2^1074 = me / (2 ms) 2^(ee - es + 1074)
  const shift = ee - es + 1074;
  let num = me;
  let den = 2n * ms;
  if (shift >= 0) num <<= BigInt(shift);
  else den <<= BigInt(-shift);
  let m = num / den;
  const r2 = 2n * (num - m * den);
  if (r2 > den || (r2 === den && m % 2n === 1n)) m += 1n;
  return Number(m) * 2 ** -1074;
}

describe("issue #110", () => {
  it("rounds the issue's density once", () => {
    expect(dlaplace(7.2357573010898871e307, { sigma: 1.4471514602179774e308 })).toBe(2.09560186471869e-309);
  });

  it("rounds once where 2 sigma overflows", () => {
    let seed = 110;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 2000; i++) {
      const sigma = Number.MAX_VALUE * (0.5 + 0.5 * rnd());
      const x = (rnd() < 0.5 ? -1 : 1) * sigma * rnd() * 0.9;
      const z = standardizeDD(x, 0, sigma);
      const e = expNeg(z[0] < 0 ? [-z[0], -z[1]] : [z[0], z[1]]);
      expect(dlaplace(x, { sigma }), `${x}, ${sigma}`).toBe(roundedQuotient(e, sigma));
    }
  });

  it("keeps finite 2 sigma as before", () => {
    expect(dlaplace(0.5)).toBe(Math.exp(-0.5) / 2);
    expect(dlaplace(0, { sigma: 1e300 })).toBe(1 / 2e300);
  });
});
