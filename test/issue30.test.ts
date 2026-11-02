// Issue #30: rbeta with only one huge shape (review_fix_log_issue30.md).
import { describe, expect, it } from "vitest";
import { rbeta, runif, setSeed } from "../src/index.js";

const meanVar = (v: number[]): [number, number] => {
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return [m, v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)];
};

describe("issue #30", () => {
  it("draws from the limit G_m / B, not the mean", () => {
    // 2ab overflowed and the mean was returned: rbeta(5, 1.1, 1e308) gave 1.1e-308 five times (R too)
    setSeed(12);
    const small = rbeta(5, 1.1, 1e308);
    expect(new Set(small).size).toBe(5);
    // B X is Gamma(10): mean 10 and variance 10 (5 standard errors of 4000 draws)
    setSeed(30);
    const [m, v] = meanVar(rbeta(4000, 10, 1e308).map((x) => x * 1e308));
    expect(Math.abs(m - 10)).toBeLessThan(5 * Math.sqrt(10 / 4000));
    expect(Math.abs(v - 10)).toBeLessThan(1.5);
    // the shapes swapped: 1 - G / B, which rounds to 1
    expect(rbeta(3, 1e308, 10)).toEqual([1, 1, 1]);
  });

  it("keeps both shapes huge at the mean, with R's stream", () => {
    setSeed(12);
    expect(rbeta(5, 1e200, 1e200)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(runif(1)[0]).toBeCloseTo(0.3926972, 7); // R 4.5.2: set.seed(12); rbeta(5, 1e200, 1e200); runif(1)
  });
});
