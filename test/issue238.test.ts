// Issue #238: distSummary("invgamma") formed the variance b^2 / ((a - 1)^2 (a - 2)), the sd b / ((a - 1) sqrt(a - 2))
// and the kurtosis (30 a - 66) / ((a - 3)(a - 4)) from products that overflow for large parameters (alpha = beta =
// 1e308: variance NaN, sd 0, kurtosis NaN; alpha = 1e200: kurtosis 0). Where they leave the range, these are now
// formed from r = b / (a - 1) and ratios of a (review_fix_log_issue238.md). References: Rmpfr (400 bits) on the exact
// doubles, rounded once.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const rel = (x: number, y: number): number => (x === y ? 0 : Math.abs(x / y - 1));

describe("issue #238", () => {
  it("gives the moments of alpha = beta = 1e308", () => {
    const s = distSummary("invgamma", { alpha: 1e308, beta: 1e308 });
    expect(s.mean).toBe(1);
    expect(s.variance).toBe(1e-308);
    expect(s.sd).toBe(1e-154);
    expect(s.skewness).toBe(4e-154);
    expect(s.kurtosis).toBe(3e-307);
  });

  it("agrees with Rmpfr where the products overflow", () => {
    // [alpha, beta, variance, sd, skewness, kurtosis]
    const cases: [number, number, number, number, number, number][] = [
      [1e200, 1e200, 1e-200, 1e-100, 4e-100, 3.0000000000000003e-199],
      [1e110, 1e150, 9.999999999999999e-31, 9.999999999999999e-16, 4e-55, 2.9999999999999997e-109],
      [1e200, 1, 0, 1e-300, 4e-100, 3.0000000000000003e-199],
      [1.7e308, 1.7e308, 5.88235294117647e-309, 7.669649888473705e-155, 3.067859955389482e-154, 1.7647058823529413e-307],
    ];
    for (const [a, b, v, sd, sk, ku] of cases) {
      const s = distSummary("invgamma", { alpha: a, beta: b });
      expect(rel(s.variance, v), `variance ${a} ${b}`).toBeLessThan(3e-16);
      expect(rel(s.sd, sd), `sd ${a} ${b}`).toBeLessThan(3e-16);
      expect(rel(s.skewness, sk), `skewness ${a} ${b}`).toBeLessThan(3e-16);
      expect(rel(s.kurtosis, ku), `kurtosis ${a} ${b}`).toBeLessThan(3e-16);
    }
  });

  it("keeps the values where the products are in range", () => {
    expect(distSummary("invgamma", { alpha: 10, beta: 1e300 })).toEqual({
      mean: 1.1111111111111112e299,
      variance: Infinity,
      sd: 3.9283710065919305e298,
      median: 1.0342636429439868e299,
      mode: 9.090909090909092e298,
      skewness: 1.6162440712835373,
      kurtosis: 5.571428571428571,
    });
    const s = distSummary("invgamma", { alpha: 3, beta: 1e-160 });
    expect(s.variance).toBe(2.5e-321);
    expect(s.sd).toBe(5e-161);
  });
});
