// Fixes of the 23rd review round (review_fix_log_20261031_23.md): dmultinom with finite weights whose sum overflows.
import { describe, expect, it } from "vitest";
import { dmultinom } from "../src/index.js";

describe("review 23", () => {
  it("dmultinom with weights whose sum overflows", () => {
    expect(dmultinom([1, 1], [1e308, 1e308])).toBe(0.5); // R 4.5.2: 0
    expect(dmultinom([1, 1], [1e308, 1e308], { log: true })).toBeCloseTo(-Math.LN2, 15); // R 4.5.2: -Inf
    // weights 2^1022 (2, 1, 3): the same value as for (2, 1, 3), 60 / 432
    const big = [2, 1, 3].map((v) => v * 2 ** 1022);
    expect(dmultinom([2, 1, 3], big)).toBe(dmultinom([2, 1, 3], [2, 1, 3])); // R 4.5.2: 0
    expect(dmultinom([2, 1, 3], big, { log: true })).toBe(dmultinom([2, 1, 3], [2, 1, 3], { log: true }));
    expect(dmultinom([2, 1, 3], [2, 1, 3])).toBeCloseTo(0.13888888888888893, 16); // R 4.5.2
  });
  it("a weight that the rescaling takes to 0", () => {
    expect(dmultinom([1, 1, 0], [1e308, 1e308, 5e-324])).toBe(0.5); // R 4.5.2: 0
    expect(dmultinom([1, 1, 1], [1e308, 1e308, 5e-324])).toBe(0);
    // log 3! (1/2)(1/2) p_3, p_3 = 5e-324 / 2e308 (the log was -Infinity until issue #68)
    const lp = Math.log(1.5) + Math.log(5e-324) - Math.LN2 - Math.log(1e308);
    expect(Math.abs(dmultinom([1, 1, 1], [1e308, 1e308, 5e-324], { log: true }) / lp - 1)).toBeLessThanOrEqual(1e-15);
  });
  it("weights with a sum in range are used as given", () => {
    expect(dmultinom([1, 1], [1e308, 1e307])).toBe(0.1652892561983471); // R 4.5.2: 0.16528925619834709
  });
});
