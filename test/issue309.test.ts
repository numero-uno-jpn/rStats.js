import { describe, expect, it } from "vitest";
import { kappa2 } from "../src/index.js";

// #309: with one complete rating pair the variance of kappa is 0, so z was 0 / 0 and the p-value NaN (irr's kappa2
// gives the same NaN). At least two complete pairs are now required, as kappamFleiss and icc require two subjects.
describe("kappa2 needs at least two complete rating pairs (#309)", () => {
  it("rejects a single complete pair", () => {
    for (const weight of ["unweighted", "equal", "squared"]) {
      expect(() => kappa2([[1, 2]], { weight })).toThrow("at least 2 complete rating pairs are needed");
      expect(() => kappa2([[1, 2], [NaN, 1]], { weight })).toThrow("at least 2 complete rating pairs are needed");
    }
  });

  it("keeps the values for two pairs (irr: kappa -1, z -1.41, p 0.157)", () => {
    expect(kappa2([[1, 2], [2, 1]])).toEqual({ value: -1, statistic: -1.414213562373095, pValue: 0.15729920705028522 });
  });
});
