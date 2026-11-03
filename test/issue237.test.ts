// Issue #237: distSummary("hyper") formed the mean k m / N, the variance and the mode floor((k + 1)(m + 1) / (N + 2))
// from products that overflow (m = n = k = 1e200: mean, variance and mode Infinity). Where they overflow, the mean and
// variance are now formed from the ratio m / N and the mode as the floor of the exact quotient in integers (BigInt),
// rounded to a double (review_fix_log_issue237.md). References: exact rationals (Python fractions) on the exact
// integers, rounded once.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const rel = (x: number, y: number): number => (x === y ? 0 : Math.abs(x / y - 1));

describe("issue #237", () => {
  it("gives the mean, variance and mode of m = n = k = 1e200", () => {
    const s = distSummary("hyper", { m: 1e200, n: 1e200, k: 1e200 });
    expect(s.mean).toBe(5e199);
    expect(s.variance).toBe(1.25e199);
    expect(s.mode).toBe(5e199);
    expect(s.skewness).toBe(0);
    // the median is beyond 2^53: NaN, as qhyper
    expect(s.median).toBeNaN();
  });

  it("agrees with exact rationals where the products overflow", () => {
    // [m, n, k, mean, variance, mode]
    const cases: [number, number, number, number, number, number][] = [
      [1e200, 3e200, 1e200, 2.5e199, 1.40625e199, 2.5e199],
      [3e200, 1e200, 2e199, 1.5e199, 3.5625e198, 1.5e199],
      [1e200, 1e100, 1e150, 1e150, 1e50, 1e150],
    ];
    for (const [m, n, k, mean, v, mode] of cases) {
      const s = distSummary("hyper", { m, n, k });
      expect(rel(s.mean, mean), `mean ${m} ${n} ${k}`).toBeLessThan(3e-16);
      expect(rel(s.variance, v), `variance ${m} ${n} ${k}`).toBeLessThan(3e-16);
      expect(s.mode, `mode ${m} ${n} ${k}`).toBe(mode);
    }
  });

  it("gives the exact mode of a point mass whose product overflows", () => {
    // n = 0: all draws are of the first kind; (k + 1)(m + 1) / (m + 2) is just below k + 1
    expect(distSummary("hyper", { m: 1e308, n: 0, k: 10 }).mode).toBe(10);
  });

  it("keeps the values where the products are finite", () => {
    expect(distSummary("hyper", { m: 1e150, n: 1e150, k: 1e150 })).toMatchObject({
      mean: 5e149,
      variance: 1.25e149,
      sd: 3.5355339059327377e74,
      mode: 5e149,
    });
    expect(distSummary("hyper", { m: 1e300, n: 1e300, k: 7 })).toMatchObject({ mean: 3.4999999999999996, variance: 1.7499999999999998, mode: 4 });
    expect(distSummary("hyper", { m: 10, n: 7, k: 8 })).toMatchObject({ mode: 5 });
  });
});
