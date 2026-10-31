// Fixes of the 25th review round (review_fix_log_20261031_25.md): phyper and qhyper beyond 2^53, dbeta with shapes whose
// sum overflows, gammaScale with a NaN product, qgamma's parameter checks at the ends, qgeom's slack.
import { describe, expect, it } from "vitest";
import { dbeta, dgamma, pgeom, phyper, qchisq, qgamma, qgeom, qhyper, qnbinom } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

describe("review 25", () => {
  it("phyper and qhyper with a support beyond 2^53 are NaN (they did not return)", () => {
    expect(phyper(5e16, 1e17, 1e17, 1e17)).toBeNaN();
    expect(qhyper(0.3, 1e17, 1e17, 1e17)).toBeNaN();
    expect(phyper(5e307, 1e308, 1e308, 1e308)).toBeNaN();
    // the ends of the support as before
    expect(phyper(-1, 1e17, 1e17, 1e17)).toBe(0);
    expect(phyper(1e17, 1e17, 1e17, 1e17)).toBe(1);
    expect(qhyper(0, 1e17, 1e17, 1e17)).toBe(0);
    // below 2^53 unchanged
    expect(phyper(5, 10, 10, 10)).toBeCloseTo(0.67185910065167045, 15); // R 4.5.2
  });
  it("dbeta with shapes whose sum overflows", () => {
    const top = 2 / Math.sqrt(Math.PI);
    expect(rel(dbeta(0.5, 1e308, 1e308), top * 1e154)).toBeLessThan(1e-13); // R 4.5.2: NaN, was 0
    expect(rel(dbeta(0.5, 1e308, 1e308, { log: true }), Math.log(top) + 154 * Math.LN10)).toBeLessThan(1e-15); // was -Inf
    // at the mean 3/4 of shapes 1.5 2^1023 and 0.5 2^1023: log f = log(m / (2 pi)) / 2 - log(x (1 - x)), m = ab/(a+b)
    const [a, b] = [1.5 * 2 ** 1023, 0.5 * 2 ** 1023];
    const l = 0.5 * (Math.log(0.375 / (2 * Math.PI)) + 1023 * Math.LN2) - Math.log(0.1875);
    expect(rel(dbeta(0.75, a, b, { log: true }), l)).toBeLessThan(1e-15);
    // a sum in range is unchanged
    expect(dbeta(0.5, 1e300, 1e300)).toBe(1.1283791670954887e150);
  });
  it("rate and scale both given with a NaN product are an error, as in R", () => {
    expect(() => dgamma(1, 2, { rate: NaN, scale: 1 })).toThrow(RangeError); // was the scale
    expect(() => dgamma(1, 2, { rate: Infinity, scale: 0 })).toThrow(RangeError); // was NaN
    expect(() => dgamma(1, 2, { rate: 0, scale: Infinity })).toThrow(RangeError); // was 0
    expect(dgamma(1, 2, { rate: 2, scale: 0.5 })).toBe(dgamma(1, 2, { rate: 2 }));
  });
  it("qgamma checks the parameters before the ends", () => {
    expect(qgamma(0, -1)).toBeNaN(); // R 4.5.2: 0
    expect(qgamma(1, -1)).toBeNaN(); // R 4.5.2: Inf
    expect(qgamma(0, 2, { scale: 0 })).toBeNaN(); // R 4.5.2: 0
    expect(qgamma(-Infinity, 2, { scale: -1, logP: true })).toBeNaN();
    expect(qchisq(1, -1)).toBeNaN(); // R 4.5.2: Inf
    expect(qgamma(0, 2)).toBe(0);
    expect(qgamma(1, 0)).toBe(Infinity);
  });
  it("qgeom: the smallest y whose distribution function reaches p, with the slack of the other discrete quantiles", () => {
    expect(qgeom(0.7500000000000866, 0.5)).toBe(2); // R 4.5.2: 1, where P[X <= 1] = 0.75 < p
    expect(qgeom(0.75, 0.5)).toBe(1);
    expect(qgeom(0.25, 0.5, { lowerTail: false })).toBe(1);
    expect(qgeom(Math.log(0.75), 0.5, { logP: true })).toBe(1);
    expect(qgeom(pgeom(5, 0.3), 0.3)).toBe(5);
    expect(qgeom(1e-300, 1e-300)).toBe(0);
    // where the slack on p would span whole steps, the answer for p as given (as R)
    expect(qgeom(0.9999999999, 1e-10)).toBe(230258508460); // R 4.5.2: 230258508460
    expect(qgeom(0.5, 5e-324)).toBe(Infinity);
    // the same as qnbinom with size 1
    for (const [p, prob, lowerTail] of [
      [0.7500000000000866, 0.5, true],
      [0.3, 1e-5, false],
      [0.9999999, 0.2, true],
      [1e-10, 0.7, true],
    ] as const) {
      expect(qgeom(p, prob, { lowerTail })).toBe(qnbinom(p, 1, { prob, lowerTail }));
    }
  });
});
