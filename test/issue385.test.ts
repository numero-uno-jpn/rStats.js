// Issue #385: distSummary("beta") used the closed skewness and kurtosis wherever a b was in range, but their
// numerators and denominators can still overflow: beta(1e-3, 1e155) had kurtosis NaN for 6000, beta(1e-3, 1e250)
// skewness and kurtosis NaN, beta(1e100, 1e100) kurtosis 0 for -3e-100. There the ratio forms in a / s and b / s are
// now used (review_fix_log_issue385.md). References: Rmpfr (2000 bits) on the exact doubles.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const rel = (x: number, ref: number): number => Math.abs(x / ref - 1);

describe("issue #385", () => {
  it("gives the skewness and kurtosis where the closed forms overflow", () => {
    const s1 = distSummary("beta", { shape1: 1e-3, shape2: 1e155 });
    expect(s1.kurtosis).toBe(6000);
    // Rmpfr 0x1.f9f6e4990f227p+5 for both
    const sk = 0x1f9f6e4990f227 * 2 ** (5 - 52);
    expect(rel(s1.skewness, sk)).toBeLessThan(3e-16);
    const s2 = distSummary("beta", { shape1: 1e-3, shape2: 1e250 });
    expect(s2.kurtosis).toBe(6000);
    expect(rel(s2.skewness, sk)).toBeLessThan(3e-16);
    // -6 / (s + 3), Rmpfr -0x1.4ff632b6a83e4p-331
    expect(distSummary("beta", { shape1: 1e100, shape2: 1e100 }).kurtosis).toBe(-0x14ff632b6a83e4 * 2 ** (-331 - 52));
    // Rmpfr 0x1.bff2ee48e052cp-334
    expect(rel(distSummary("beta", { shape1: 1e100, shape2: 3e100 }).kurtosis, 0x1bff2ee48e052c * 2 ** (-334 - 52))).toBeLessThan(1e-15);
  });

  it("keeps the values where the closed forms are in range", () => {
    const s = distSummary("beta", { shape1: 2, shape2: 3 });
    expect(s.skewness).toBe(0.28571428571428575);
    expect(s.kurtosis).toBe(-0.6428571428571429);
    expect(distSummary("beta", { shape1: 1e-3, shape2: 1e100 }).kurtosis).toBe(
      (6 * ((1e-3 - 1e100) ** 2 * (1e100 + 1) - 1e97 * (1e100 + 2))) / (1e97 * (1e100 + 2) * (1e100 + 3)),
    );
  });
});
