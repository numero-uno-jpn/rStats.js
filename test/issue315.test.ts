import { describe, expect, it } from "vitest";
import { TukeyHSD } from "../src/index.js";

// #315: with one value per group the residual degrees of freedom are 0, the MSE is 0 / 0 and the limits and p-values
// were NaN (R's TukeyHSD too, with "NaNs produced"). That is now an error, as in tukeyTest.
describe("TukeyHSD needs residual degrees of freedom (#315)", () => {
  it("rejects one value per group", () => {
    expect(() => TukeyHSD([[1], [2]])).toThrow("no residual degrees of freedom");
    expect(() => TukeyHSD([1, 2, 3], ["a", "b", "c"])).toThrow("no residual degrees of freedom");
  });

  it("keeps the values with 2 residual degrees of freedom", () => {
    const r = TukeyHSD([[1, 2], [3, 5]]);
    expect(r.diff).toEqual([2.5]);
    // values before the fix (R's qtukey is less accurate: lwr -2.306375, p 0.1548045)
    expect(r.lwr).toEqual([-2.310511993647415]);
    expect(r.pAdj).toEqual([0.15484574527148343]);
  });
});
