// Fixes of the 28th review round (review_fix_log_20261031_28.md): lmerAnova after the data object changed; the joint
// denominator df with infinite df.
import { describe, expect, it } from "vitest";
import { lmer, lmerAnova } from "../src/entries/mixed.js";
import { jointDenDF } from "../src/models/lmerTest.js";

const data = () => ({
  y: [1.1, 2.3, 2.9, 4.2, 5.1, 5.8, 7.2, 8.1, 9.4, 9.8],
  x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  z: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3],
  g: ["a", "a", "b", "b", "c", "c", "d", "d", "e", "e"],
});

describe("review 28", () => {
  it("lmerAnova uses the data as it was at the fit", () => {
    for (const type of ["I", "II", "III"] as const) {
      const d = data();
      const fit = lmer("y ~ x + z + (1 | g)", d);
      const before = lmerAnova(fit, { type });
      d.z = [9, 2, 6, 5, 3, 3, 1, 4, 1, 5];
      d.y[0] = 100;
      // type I was 1156.14 instead of 1926.92 for x
      expect(lmerAnova(fit, { type })).toEqual(before);
    }
  });
  it("comparisons refit from the data of the fits; one data object changed between the fits is an error", () => {
    const d = data();
    const fit0 = lmer("y ~ x + (1 | g)", d);
    const fit1 = lmer("y ~ x + z + (1 | g)", d);
    const before = lmerAnova([fit0, fit1]);
    // the ML refits of the REML fits used the changed data
    d.y[0] = 100;
    expect(lmerAnova([fit0, fit1])).toEqual(before);
    // a fit of the changed object is not compared with one of the original data
    const fit2 = lmer("y ~ x + z + (1 | g)", d);
    expect(() => lmerAnova([fit0, fit2])).toThrow("all models must be fit to the same data object");
  });
  it("joint denominator df with infinite df: the term of Inf is its limit 1", () => {
    expect(jointDenDF([Infinity, Infinity])).toBe(Infinity); // was NaN
    expect(jointDenDF([Infinity, 5])).toBe((2 * (1 + 5 / 3)) / (1 + 5 / 3 - 2)); // was NaN
    expect(jointDenDF([4, 6])).toBe((2 * (2 + 1.5)) / (2 + 1.5 - 2)); // unchanged
    expect(jointDenDF([7, 7])).toBe(7);
  });
});
