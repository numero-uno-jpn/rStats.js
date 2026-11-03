// Issue #241: distSummary("beta") formed the direct sd (used where the variance is outside the normal range) as
// sqrt(a / s) sqrt(b / s) / sqrt(s + 1), and a / s underflows for beta(1e-308, 1e154): sd 0 for 1e-308. Where a / s or
// b / s is below the normal range, the square roots are now taken before the ratios (review_fix_log_issue241.md).
// References: Rmpfr (400 bits) on the exact doubles.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const sd = (a: number, b: number): number => distSummary("beta", { shape1: a, shape2: b }).sd;

describe("issue #241", () => {
  it("gives the sd of beta(1e-308, 1e154) and its mirror", () => {
    expect(sd(1e-308, 1e154)).toBe(1e-308);
    expect(sd(1e154, 1e-308)).toBe(1e-308);
    expect(distSummary("beta", { shape1: 1e-308, shape2: 1e154 }).variance).toBe(0);
  });

  it("agrees with Rmpfr where a shape ratio is below the normal range", () => {
    const cases: [number, number, number][] = [
      [3e-300, 2e100, 8.660254037844387e-251],
      [1e-310, 1e10, 9.999999999499985e-166],
    ];
    for (const [a, b, ref] of cases) expect(Math.abs(sd(a, b) / ref - 1), `${a} ${b}`).toBeLessThan(3e-16);
  });

  it("keeps the values where both ratios are normal", () => {
    expect(sd(1e-320, 1e-300)).toBe(9.999944335758489e-11);
    expect(sd(5e-324, 1)).toBe(1.5717277847026285e-162);
    expect(sd(2, 3)).toBe(0.2);
  });
});
