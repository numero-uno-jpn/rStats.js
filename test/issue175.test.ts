// Issue #175: glmPredict's standard error where the norm of z overflows in the fallback for an out-of-range sum of
// squares and a small dispersion brings it back: sqrt(dispersion) is applied before the product overflows.
import { describe, expect, it } from "vitest";
import { glm, glmPredict } from "../src/index.js";

const fit = glm([[0, 0], [1, 0], [0, 1], [1, 1]], [0, 1, 1, 2], { family: "gaussian" });
const se = (nd: number[]) => glmPredict(fit, { newdata: [nd], dispersion: 1e-300 }).seFit![0]!;

describe("issue #175", () => {
  it("is the standard error of newdata divided by 2^100, times 2^100 (R 4.5.2: Inf)", () => {
    for (const nd of [[1.5e308, 1.5e308], [1.7e308, 1.7e308], [1.7e308, -1.7e308]]) {
      const ref = se(nd.map((v) => v / 2 ** 100)) * 2 ** 100;
      expect(Number.isFinite(ref)).toBe(true);
      expect(se(nd)).toBe(ref);
    }
    expect(se([1.5e308, 1.5e308])).toBe(2.1213203435596427e158);
  });

  it("keeps the values that were finite", () => {
    // the values before the change
    expect(se([1e308, 1e308])).toBe(1.4142135623730952e158);
    expect(se([1.7e308, 0])).toBe(1.7e158);
    expect(se([1e154, 1e154])).toBe(14142.135623730954);
  });
});
