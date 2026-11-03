import { describe, expect, it } from "vitest";
import { leveneTest, onewayTest, varTest } from "../src/index.js";

// #393: one power of 2 for all groups made a small group's variation underflow (as #270 for bartlettTest)
describe("group variation below the normal range on the common scale (#393)", () => {
  it("onewayTest (Welch) [0, 1e-100] and [0, 1e100]: F 1, df (1, 1), p 0.5 (R the same; since #313 the limit gave it)", () => {
    const r = onewayTest([[0, 1e-100], [0, 1e100]]);
    expect(r.statistic).toBe(1);
    expect(r.parameter).toEqual([1, 1]);
    expect(r.pValue).toBe(0.5);
  });

  it("onewayTest (Welch) with three groups: F 15, df2 4/3 (was 'two or more constant groups'; R NaN)", () => {
    const r = onewayTest([[1e200, 2e200], [0, 1e-100], [5, 7]]);
    expect(Math.abs(r.statistic / 15 - 1)).toBeLessThan(1e-14);
    expect(Math.abs(r.parameter[1] / (4 / 3) - 1)).toBeLessThan(1e-14);
  });

  it("onewayTest (Welch) with a variance below 2^-1022 times the largest: the exact values to 1e-14", () => {
    // Python Fraction on the doubles: 17.107692307692307, 2.6666666666666665 and 3.818027210884354, 3.3333333333333335
    const a = onewayTest([[1, 3, 2], [5, 9, 6], [0, 1e-160, 3e-160]]);
    expect(Math.abs(a.statistic / 17.107692307692307 - 1)).toBeLessThan(1e-14);
    expect(Math.abs(a.parameter[1] / 2.6666666666666665 - 1)).toBeLessThan(1e-14);
    const b = onewayTest([[1e300, 2e300, 4e300], [0, 1e-100, 5e-101], [5, 7, 1], [2e-200, 3e-200, 1e-200]]);
    expect(Math.abs(b.statistic / 3.818027210884354 - 1)).toBeLessThan(1e-14);
    expect(Math.abs(b.parameter[1] / 3.3333333333333335 - 1)).toBeLessThan(1e-14);
  });

  it("varTest([1e308, 1e308], [0, 1e-100]): ratio 0 (was 'both samples have zero variance'; R Inf)", () => {
    const r = varTest([1e308, 1e308], [0, 1e-100]);
    expect(r.estimate).toBe(0);
    expect(r.statistic).toBe(0);
    expect(r.pValue).toBe(0);
  });

  it("varTest in range unchanged: [1, 2] and [0, 1e-100] give 1e200", () => {
    expect(varTest([1, 2], [0, 1e-100]).statistic).toBe(1e200);
  });

  it("leveneTest([1e308, 1e308, 0, 1e-100], two groups): F Infinity, p 0 (was NaN; R 6.2e31)", () => {
    const row = leveneTest([1e308, 1e308, 0, 1e-100], ["A", "A", "B", "B"]).table[0]!;
    expect(row[1]).toBe(Infinity);
    expect(row[2]).toBe(0);
  });
});
