import { describe, expect, it } from "vitest";
import { TukeyHSD, tukeyTest } from "../src/index.js";

// #315: with one value per group the residual degrees of freedom are 0, the MSE is 0 / 0 and the limits and p-values
// were NaN (R's TukeyHSD too, with "NaNs produced"). That is now an error, as in tukeyTest; so is 1 df.
describe("TukeyHSD needs residual degrees of freedom (#315)", () => {
  it("rejects one value per group", () => {
    expect(() => TukeyHSD([[1], [2]])).toThrow("no residual degrees of freedom");
    expect(() => TukeyHSD([1, 2, 3], ["a", "b", "c"])).toThrow("no residual degrees of freedom");
  });

  // with 1 residual degree of freedom ptukey and qtukey (R's too) are NaN: the limits and p-values were NaN (R's
  // TukeyHSD and PMCMRplus' tukeyTest NaN/NA too). An error now, in both (user decision)
  it("rejects 1 residual degree of freedom", () => {
    const message = "the studentized range needs at least 2 residual degrees of freedom";
    expect(() => TukeyHSD([[1, 2], [3]])).toThrow(message);
    expect(() => TukeyHSD([1, 2, 3, 4], ["a", "a", "b", "c"])).toThrow(message);
    expect(() => tukeyTest([1, 2, 3], ["a", "a", "b"])).toThrow(message);
    expect(() => tukeyTest([1, 2, 3, 4], ["a", "a", "b", "c"])).toThrow(message);
  });

  it("keeps the values with 2 residual degrees of freedom", () => {
    const r = TukeyHSD([[1, 2], [3, 5]]);
    expect(r.diff).toEqual([2.5]);
    // values before the fix (R's qtukey is less accurate: lwr -2.306375, p 0.1548045)
    expect(r.lwr).toEqual([-2.310511993647415]);
    expect(r.pAdj).toEqual([0.15484574527148343]);
    expect(tukeyTest([1, 2, 3, 5], ["a", "a", "b", "b"]).pValue[0]![0]).toBe(0.15484574527148343);
  });
});
