// Fixes of the 18th review round (review_fix_log_20261031_18.md): populations and means near the largest double.
import { describe, expect, it } from "vitest";
import { dbinom, dhyper, dnbinom, phyper, qhyper, rhyper, setSeed } from "../src/index.js";

describe("review 18", () => {
  it("dnbinom with size + mu beyond the largest double", () => {
    // p = q = 0.5 (both were 0): P[X = 0] = 0.5^1e308 = 0 (R 4.5.2 gives 1)
    expect(dnbinom(0, 1e308, { mu: 1e308 })).toBe(0);
    expect(dnbinom(0, 1e308, { mu: 1e308, log: true })).toBeCloseTo(-1e308 * Math.LN2, -300);
  });
  it("the hypergeometric of a population far larger than the draws is the binomial", () => {
    // R 4.5.2 gives NaN (m + n overflows)
    expect(dhyper(1, 1e308, 1e308, 1)).toBe(0.5);
    expect(phyper(0, 1e308, 1e308, 1)).toBe(0.5);
    expect(dhyper(2, 1e308, 3e307, 3)).toBeCloseTo(dbinom(2, 3, 1 / 1.3) as number, 14);
    expect(qhyper(0.3, 1e308, 1e308, 10)).toBe(4);
    setSeed(1);
    const r = rhyper(200, 1e308, 1e308, 1);
    expect(r.some((v) => v === 1) && r.some((v) => v === 0)).toBe(true); // R 4.5.2 gives 0 throughout
    // an ordinary population is unchanged
    expect(dhyper(2, 10, 7, 8)).toBeCloseTo(0.012957630604689432, 15);
  });
});
