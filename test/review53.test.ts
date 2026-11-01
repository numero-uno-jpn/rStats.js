// External review of choose, bd0dd, besselY and dinvgamma (review_fix_log_20261031_53.md).
import { describe, expect, it } from "vitest";
import { besselY, choose, dinvgamma, lchoose, pinvgamma } from "../src/index.js";
import { bd0dd } from "../src/special/loader.js";

describe("review 53", () => {
  it("SPEC-009: choose where the falling product overflows on the way", () => {
    // n (n - 1) overflowed at n = 1.5e154: Infinity before. MPFR with the exact double: 1.12500000000000019477e308,
    // 0.09 ulp from 1.1250000000000002e308 (R gives 1.125e308, 0.91 ulp away, from two roundings)
    expect(choose(1.5e154, 2)).toBe(1.1250000000000002e308);
    expect(choose(1.5e154, 2, { rCompatible: false })).toBe(1.1250000000000002e308);
    expect(choose(1e103, 3)).toBe(1.6666666666666668e308); // R too; MPFR 1.66666666666666667625e308
    expect(choose(-1e103, 3)).toBe(-1.6666666666666668e308);
    expect(choose(1e200, 2)).toBe(Infinity); // the value itself overflows
    expect(lchoose(1.5e154, 2)).toBe(709.3139916778225);
    // the ordinary range as before
    expect(choose(50, 3)).toBe(19600);
    expect(choose(7.5, 3)).toBe(44.6875);
  });

  it("SPEC-010: bd0dd at x = 0 is its limit M, as bd0", () => {
    expect(bd0dd(0, [1, 0])).toEqual([1, 0]); // NaN before
  });

  it("SPEC-011 (fixed in round 47): besselY at the smallest doubles", () => {
    // 1e-323 is the double 2^-1073; Y0 = (2/pi)(log(2^-1074) + gamma) to rounding (the reviewer's -473.5502 is for the
    // decimal 1e-323)
    const y0 = (2 / Math.PI) * (-1074 * Math.LN2 + 0.5772156649015329);
    expect(Math.abs(besselY(1e-323, 0) / y0 - 1)).toBeLessThan(1e-15);
    expect(besselY(Number.MIN_VALUE, 0)).toBe(-473.99907342300423);
  });

  it("DIST-003: dinvgamma with alpha = Infinity is the limit, as pinvgamma and qinvgamma", () => {
    // all the mass at 0: NaN before
    expect(dinvgamma(1, Infinity)).toBe(0);
    expect(dinvgamma(1, Infinity, { log: true })).toBe(-Infinity);
    expect(pinvgamma(1, Infinity)).toBe(1);
  });
});
