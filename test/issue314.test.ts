import { describe, expect, it } from "vitest";
import { tTest } from "../src/index.js";

// #314: the constant-data guard stdErr < 10 eps abs(mean) is 0 < 0 when the data (or differences) are all 0, so the
// test went on to t = 0 / 0 and a NaN p-value and interval (R's t.test does the same). A standard error of 0 is now
// "data are essentially constant" whatever the mean.
describe("tTest treats a standard error of 0 as constant data (#314)", () => {
  it("rejects samples of zeros and zero differences", () => {
    const msg = "data are essentially constant";
    expect(() => tTest([0, 0])).toThrow(msg);
    expect(() => tTest([0, 0], { mu: 1 })).toThrow(msg);
    expect(() => tTest([0, 0], [0, 0])).toThrow(msg);
    expect(() => tTest([0, 0], [0, 0, 0], { varEqual: true })).toThrow(msg);
    expect(() => tTest([0], [0, 0], { varEqual: true })).toThrow(msg);
    expect(() => tTest([1, 1], [1, 1], { paired: true })).toThrow(msg);
  });

  it("keeps R's value for data with a positive standard error and mean 0", () => {
    // R: t.test(c(-1, 1)): t 0, df 1, p 1
    const r = tTest([-1, 1]);
    expect([r.statistic, r.parameter, r.pValue]).toEqual([0, 1, 1]);
  });
});
