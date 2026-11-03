import { describe, expect, it } from "vitest";
import { onewayTest, tTest } from "../src/index.js";

// #313: Welch's onewayTest with a group of variance 0 was NaN throughout (R's oneway.test too). With exactly one
// constant group it is now the limit as that variance tends to 0; with two or more it is an error
// (review_fix_log_issue313.md).
describe("onewayTest (Welch) with a constant group (#313)", () => {
  it("two groups: the square of Welch's t (R's t.test: t^2 12.000000000000002, df 2, p 0.074179900227448528)", () => {
    const r = onewayTest([[1, 1, 1], [2, 3, 4]]);
    expect(r.statistic).toBe(12);
    expect(r.parameter).toEqual([1, 2]);
    expect(r.pValue).toBe(tTest([1, 1, 1], [2, 3, 4]).pValue);
    expect(onewayTest([[1e200, 1e200, 1e200], [2e200, 3e200, 4e200]]).statistic).toBe(12);
  });

  it("three groups: the limit of R's values as the spread of the first group tends to 0", () => {
    // R, first group [1 - e, 1, 1 + e] with e = 1e-6: 23.728078817713804, 3.2000000000050104, 0.0120455982379801
    const r = onewayTest([[1, 1, 1], [2, 3, 4], [5, 7, 6, 9]]);
    expect(Math.abs(r.statistic / 23.728078817713804 - 1)).toBeLessThan(1e-11);
    expect(Math.abs(r.parameter[1] / 3.2 - 1)).toBeLessThan(1e-15);
    expect(Math.abs(r.pValue / 0.0120455982379801 - 1)).toBeLessThan(1e-11);
  });

  it("is an error with two or more constant groups", () => {
    const message = "Welch's test is not defined with two or more constant groups";
    expect(() => onewayTest([[1, 1, 1], [2, 2], [2, 3, 4]])).toThrow(message);
    expect(() => onewayTest([[1, 1, 1], [1, 1], [2, 3, 4]])).toThrow(message);
    expect(() => onewayTest([[1, 1, 1], [2, 2, 2]])).toThrow(message);
  });

  it("is unchanged with equal variances", () => {
    const r = onewayTest([[1, 1, 1], [2, 3, 4]], { varEqual: true });
    expect(r.statistic).toBe(12); // between 6 / 1, within 2 / 4 (R the same)
  });
});
