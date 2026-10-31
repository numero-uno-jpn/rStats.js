// Fixes of the 20th review round (review_fix_log_20261031_20.md).
import { describe, expect, it } from "vitest";
import { getRandomSeed, nextRNGStream, rbeta, RNGkind, runif, setSeed } from "../src/index.js";

describe("review 20", () => {
  it("rbeta with shapes so large that 2ab overflows: the mean, with R's two uniforms per draw", () => {
    setSeed(1);
    expect(rbeta(3, 1e308, 1e308)).toEqual([0.5, 0.5, 0.5]); // R 4.5.2 gives 0 0 0
    expect(runif(1)[0]).toBeCloseTo(0.944675268605351, 15); // R 4.5.2 after set.seed(1); rbeta(3, 1e308, 1e308)
    setSeed(1);
    expect(rbeta(1, 3e307, 1e308)[0]).toBeCloseTo(3 / 13, 15);
  });
  it("noncentral rbeta with both shapes 0: 0 or 1, as the central one", () => {
    setSeed(1);
    const a = rbeta(20, 0, 0, { ncp: 0 });
    expect(a.every((v) => v === 0 || v === 1)).toBe(true); // R 4.5.2 gives NaN
    expect(a.includes(0) && a.includes(1)).toBe(true);
    expect(rbeta(20, 0, 0, { ncp: 2 }).every((v) => v === 0 || v === 1)).toBe(true);
  });
  it("nextRNGStream takes only the L'Ecuyer-CMRG kind codes setRandomSeed restores", () => {
    expect(() => nextRNGStream([7, 1, 2, 3, 4, 5, 6])).toThrow("10407 or 407");
    RNGkind({ kind: "L'Ecuyer-CMRG" });
    setSeed(1);
    expect(nextRNGStream(getRandomSeed())).toHaveLength(7);
    RNGkind({ kind: "Mersenne-Twister" });
  });
});
