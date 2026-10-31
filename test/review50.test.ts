// External review of interpolation, special functions and random numbers (review_fix_log_20261031_50.md).
import { describe, expect, it } from "vitest";
import { approx, gammainc, qgamma, rbeta, rexp, rgamma, rgeom, rmultinom, rnbinom, runif, setSeed, spline } from "../src/index.js";

describe("review 50", () => {
  it("NUM-003, NUM-004: approx and spline where differences of finite values overflow", () => {
    // x was NaN, Infinity, 1e308 (R's seq handles it); y 0 at the middle (R too)
    expect(approx([-1e308, 1e308], [0, 1], { n: 3 })).toEqual({ x: [-1e308, 0, 1e308], y: [0, 0.5, 1] });
    expect(spline([-1e308, 1e308], [0, 1], { n: 3 })).toEqual({ x: [-1e308, 0, 1e308], y: [0, 0.5, 1] }); // R: NaN
    expect(approx([-1e308, 1e308], [0, 1], { xout: [0] }).y).toEqual([0.5]); // 0 before (R too)
    expect(approx([0, 1], [-1e308, 1e308], { xout: [0.5] }).y).toEqual([0]); // Infinity before (R too)
    // the ordinary range as before
    expect(approx([1, 2, 4], [1, 3, 2], { xout: [1.5, 3] }).y).toEqual([2, 2.5]);
    expect(spline([1, 2, 3, 4], [1, 4, 9, 16], { xout: [2.5] }).y).toEqual([6.25]);
  });

  it("SPEC-002: gammainc's exactly zero tails where Gamma(a) overflows", () => {
    // Infinity * 0 gave NaN
    expect(gammainc(Infinity, 1e308)).toEqual({ lower: Infinity, upper: 0, logLower: Infinity, logUpper: -Infinity });
    expect(gammainc(0, 1e308)).toEqual({ lower: 0, upper: Infinity, logLower: -Infinity, logUpper: Infinity });
    expect(gammainc(Infinity, 2)).toEqual({ lower: 1, upper: 0, logLower: 0, logUpper: -Infinity });
  });

  it("SPEC-005: qgamma where the distribution function rises across one ulp", () => {
    // the true quantiles 1e145 + z 3.2e72 all round to 1e145; p > 0.5 gave 151 ulps below (pgamma 0 there). R: 1e145
    for (const p of [0.01, 0.25, 0.5, 0.75, 0.9, 0.99]) expect(qgamma(p, 1e145)).toBe(1e145);
  });

  it("RNG-003: rbeta with ncp where 2 shape overflows", () => {
    setSeed(1);
    expect(rbeta(3, 1e308, 1e308, { ncp: 0 })).toEqual([0.5, 0.5, 0.5]); // NaN before (R too)
    setSeed(1);
    expect(rbeta(3, 1e308, 2, { ncp: 0 })).toEqual([1, 1, 1]);
    // the ordinary noncentral draws are R's
    setSeed(1);
    expect(rbeta(3, 2, 3, { ncp: 0 })).toEqual([0.2061979862248013, 0.346560765512536, 0.47657137870654204]);
  });

  it("RNG-003', RNG-004: rgeom and rnbinom where (1 - p) / p overflows", () => {
    setSeed(4);
    const e = rexp(1)[0]!;
    setSeed(4);
    expect(rgeom(1, 1e-309)).toEqual([e / 1e-309]); // Infinity before (R: NA)
    setSeed(1);
    const g = rgamma(1, 1)[0]!;
    setSeed(1);
    expect(rnbinom(1, 1, { prob: 1e-309 })).toEqual([g / 1e-309]); // NaN before (R: NA)
    setSeed(1);
    const gh = rgamma(1, 0.5)[0]!;
    setSeed(1);
    expect(rnbinom(1, 0.5, { mu: 1e308 })).toEqual([(gh * 1e308) / 0.5]); // mu / size overflows; NaN before
  });

  it("RNG-005: rmultinom keeps the probability of the last categories", () => {
    // 0.5 + 0.5 + 1e-16 is 1 in doubles: the second category took all that was left (pk = 1), so the third was never
    // drawn. Now the second is a binomial draw with 0.5 / (0.5 + 1e-16), which changes the stream from there (R as before)
    setSeed(42);
    const r = rmultinom(3, 2147483647, [0.5, 0.5, 1e-16]);
    expect(r.map((row) => row[0]! + row[1]! + row[2]!)).toEqual([2147483647, 2147483647, 2147483647]);
    expect(r[1]).toEqual([1073754908, 1073728739, 0]); // before (R): 1073706357, 1073777290, 0
    expect(runif(1)[0]).toBeGreaterThan(0);
  });
});
