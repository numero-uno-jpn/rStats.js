// Issue #235: distSummary("f") formed the variance, the direct sd, the skewness and the kurtosis from products of the
// degrees of freedom that overflow (df1 = df2 = 1e308: NaN throughout; 1e200: variance NaN, sd 0, skewness 0;
// df1 = 10, df2 = 1e200: variance and kurtosis NaN). Where a closed form's numerator or denominator is not a normal
// number, it is now formed from ratios that stay in range (review_fix_log_issue235.md). References: Rmpfr (400 bits)
// on the exact doubles, rounded once.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const rel = (x: number, y: number): number => (x === y ? 0 : Math.abs(x / y - 1));

describe("issue #235", () => {
  it("agrees with Rmpfr where the products overflow or underflow", () => {
    // [df1, df2, variance, sd, skewness, kurtosis]
    const cases: [number, number, number, number, number, number][] = [
      [1e308, 1e308, 4e-308, 2e-154, 6e-154, 6.6e-307],
      [1e200, 1e200, 4e-200, 2e-100, 6e-100, 6.6e-199],
      [10, 1e200, 0.2, 0.4472135954999579, 0.8944271909999159, 1.2],
      [1e200, 10, 0.5208333333333334, 0.7216878364870322, 3.4641016151377544, 42],
      [1e150, 1e60, 2.0000000000000002e-60, 1.414213562373095e-30, 5.65685424949238e-30, 6e-59],
      [1.7e308, 1.7e308, 2.3529411764705885e-308, 1.533929977694741e-154, 4.601789933084223e-154, 3.8823529411764706e-307],
      [1e308, 1.7e308, 3.1764705882352943e-308, 1.7822655773580137e-154, 4.884727878684927e-154, 4.284967320261438e-307],
      [1e100, 1e100, 4e-100, 2e-50, 6e-50, 6.6e-99],
      [5, 1e308, 0.4, 0.6324555320336759, 1.2649110640673518, 2.4],
      [1e308, 9, 0.6612244897959184, 0.8131571126147261, 4.216370213557839, 92],
    ];
    for (const [d1, d2, v, sd, sk, ku] of cases) {
      const s = distSummary("f", { df1: d1, df2: d2 });
      expect(rel(s.variance, v), `variance ${d1} ${d2}`).toBeLessThan(3e-16);
      expect(rel(s.sd, sd), `sd ${d1} ${d2}`).toBeLessThan(3e-16);
      expect(rel(s.skewness, sk), `skewness ${d1} ${d2}`).toBeLessThan(3e-16);
      expect(rel(s.kurtosis, ku), `kurtosis ${d1} ${d2}`).toBeLessThan(3e-16);
    }
  });

  it("gives the skewness of a subnormal df1", () => {
    const s = distSummary("f", { df1: 1e-320, df2: 1e308 });
    expect(rel(s.skewness, 2.828442869058886e160)).toBeLessThan(3e-16);
    expect(s.variance).toBe(Infinity);
    expect(s.kurtosis).toBe(Infinity);
  });

  it("keeps the values where the closed forms are in range", () => {
    expect(distSummary("f", { df1: 3, df2: 9 })).toMatchObject({
      variance: 2.204081632653061,
      sd: 1.4846149779161804,
      skewness: 5.003702332976757,
      kurtosis: 124.66666666666667,
    });
    expect(distSummary("f", { df1: 1e-300, df2: 1e10 })).toMatchObject({
      variance: 2.0000000011999996e300,
      sd: 1.4142135627973589e150,
      skewness: 2.8284271255947178e150,
      kurtosis: 1.20000000096e301,
    });
    expect(distSummary("f", { df1: 1e-310, df2: 10 }).sd).toBe(2.0412414523193185e155);
  });
});
