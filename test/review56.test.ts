// External review of the discrete quantile search (review_fix_log_20261031_56.md).
import { describe, expect, it } from "vitest";
import { qgeom, qnbinom, qpois } from "../src/index.js";
import { discreteQuantile } from "../src/internal/discrete.js";

/** The quantile search on a distribution function that jumps from 0 to 1 at the threshold */
function jump(threshold: number, y0: number): number {
  return discreteQuantile({ p: 0.5, lowerTail: true, logP: false, cdf: (y) => (y >= threshold ? 1 : 0), y0, lo: 0, hi: Infinity });
}

describe("review 56", () => {
  it("DIST-009: the upward search finds a quantile below the largest double after its step overflows", () => {
    // y + step overflowed and the search returned Infinity
    expect(jump(1.7e308, 1e308)).toBe(1.7e308);
    expect(jump(1.7e308, 1)).toBe(1.7e308);
    expect(jump(9e307, 1)).toBe(9e307);
    expect(jump(Number.MAX_VALUE, 1)).toBe(Number.MAX_VALUE);
    // a distribution function that reaches 1/2 only beyond the doubles
    expect(jump(Infinity, 1)).toBe(Infinity);
    // below the overflow as before
    expect(jump(1e300, 1)).toBe(1e300);
  });

  it("the public quantile functions near the top of the doubles as before", () => {
    expect(qpois(0.5, 1.5e308)).toBe(1.5e308);
    expect(qnbinom(0.5, 1, { mu: 1.5e308 })).toBe(1.039720770839915e308);
    expect(qgeom(0.5, 5e-309)).toBe(1.3862943611198907e308);
    expect(qnbinom(0.9, 1, { prob: 1e-308 })).toBe(Infinity); // the quantile is about 2.3e308
  });
});
