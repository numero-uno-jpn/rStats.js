// Issue #271: propTrendTest where the pooled totals or the weights overflow for finite counts
// (review_fix_log_issue271.md).
import { describe, expect, it } from "vitest";
import { propTrendTest } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #271", () => {
  it("pools the counts scaled by a power of 2 where the totals overflow", () => {
    // both proportions 0.5: no trend; was NaN (Inf / Inf), R stops in lm.wfit
    const r = propTrendTest([5e307, 5e307], [1e308, 1e308]);
    expect(r.statistic).toBe(0);
    expect(r.pValue).toBe(1);
  });

  it("keeps the weights finite where n / (p (1 - p)) overflows", () => {
    // Rmpfr from the double counts: 1.0000000000000000000; was NaN
    const r = propTrendTest([1, 0], [1e300, 1e300]);
    expect(rel(r.statistic, 1)).toBeLessThan(1e-15);
    expect(rel(r.pValue, 0.31731050786291404)).toBeLessThan(1e-14);
  });

  it("forms sxy^2 / sxx without overflowing sxy^2", () => {
    // the counts of the example times 2^1000: Rmpfr 1.0258011413636033616e+302; was Infinity
    const x = [15, 10, 8, 4].map((v) => v * 2 ** 1000);
    const n = [30, 30, 30, 30].map((v) => v * 2 ** 1000);
    expect(rel(propTrendTest(x, n).statistic, 1.0258011413636033616e302)).toBeLessThan(1e-15);
  });

  it("leaves the other cases as before", () => {
    const r = propTrendTest([15, 10, 8, 4], [30, 30, 30, 30]);
    expect(r.statistic).toBe(9.573428850537288);
    // 0.00197413726357475226 (mpmath): 0.001974137263574751 before pgamma's double-double continued fraction (1.2.0)
    expect(r.pValue).toBe(0.001974137263574752);
    expect(propTrendTest([15, 10, 8, 4], [30, 30, 30, 30], [1, NaN, 3, 4]).statistic).toBe(9.679490161417874);
    // p = 0 or 1: the weights are infinite as in R; an error since #319 (NaN before)
    expect(() => propTrendTest([0, 0, 0], [3, 4, 5])).toThrow("all proportions are 0 or all are 1");
    expect(() => propTrendTest([3, 4, 5], [3, 4, 5])).toThrow("all proportions are 0 or all are 1");
  });
});
