// Issue #50: propTrendTest leaves groups with a NaN score out of the regression, as R's lm (review_fix_log_issue50.md).
import { describe, expect, it } from "vitest";
import { propTrendTest } from "../src/index.js";

describe("issue #50", () => {
  it("omits a NaN score from the regression but keeps its counts in the pooled proportion", () => {
    // NaN before. Exact values (rational statistic, p from Rmpfr / erfc); R 4.5.2 gives 2.48888888888888937,
    // p 0.11465264168449634 and 2.42266972099309763, p 0.11959096225283008 (within 1.3e-14 relative)
    const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);
    const a = propTrendTest([1, 2, 3, 4], [10, 10, 10, 10], [1, NaN, 3, 4]);
    expect(rel(a.statistic, 112 / 45)).toBeLessThan(1e-13);
    expect(rel(a.pValue, 0.11465264168449485)).toBeLessThan(1e-13);
    const b = propTrendTest([1, 5, 3, 4], [10, 12, 10, 9], [1, NaN, 3, 7]);
    expect(rel(b.statistic, 2.4226697209930985)).toBeLessThan(1e-13);
    expect(rel(b.pValue, 0.11959096225282952)).toBeLessThan(1e-13);
  });

  // one score left: NaN here before #318 (R: NA), now an error
  it("is an error with one score left (R: NA) and with none (R: 0 (non-NA) cases)", () => {
    expect(() => propTrendTest([1, 2, 3, 4], [10, 10, 10, 10], [NaN, NaN, NaN, 4])).toThrow("at least 2 distinct non-missing scores are needed");
    expect(() => propTrendTest([1, 2, 3, 4], [10, 10, 10, 10], [NaN, NaN, NaN, NaN])).toThrow("no non-missing scores");
  });

  it("leaves complete scores as before", () => {
    expect(propTrendTest([15, 10, 8, 4], [30, 30, 30, 30]).statistic).toBe(9.573428850537288);
    expect(propTrendTest([15, 10, 8, 4], [30, 30, 30, 30], [1, 2, 3, 4]).statistic).toBe(9.573428850537288);
  });
});
