import { describe, expect, it } from "vitest";
import { icc } from "../src/index.js";

// #392: the two-way MSE by subtraction of sums of squares cancelled to 0 (ICC 1, F Infinity; irr the same)
describe("icc two-way MSE where the subtraction cancels (#392)", () => {
  const x = [
    [1, 199_999_999, 400_000_000],
    [99_999_999, 300_000_000, 500_000_001],
    [200_000_000, 400_000_001, 599_999_999],
  ];

  it("consistency: MSE 3/2 (exact), F 2e16, ICC 0.9999999999999999", () => {
    const r = icc(x, { model: "twoway", type: "consistency" });
    expect(r.Fvalue).toBe(2e16);
    expect(r.value).toBe(0.9999999999999999);
    expect(Number.isFinite(r.lbound)).toBe(true);
    expect(r.pValue).toBeGreaterThan(0);
  });

  it("agreement: the degrees of freedom and F are finite", () => {
    const r = icc(x, { model: "twoway", type: "agreement" });
    expect(r.Fvalue).toBe(2e16);
    expect(Number.isFinite(r.df2)).toBe(true);
  });
});
