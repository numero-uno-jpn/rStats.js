import { describe, expect, it } from "vitest";
import { jonckheereTest } from "../src/index.js";

// #322: with one nonempty group there is no pair of groups, JT is 0 and the exact distribution was the point mass at 0,
// so the p-value was 1. DescTools and clinfun stop with an error; so does jonckheereTest now, with their messages.
describe("jonckheereTest needs at least two nonempty groups (#322)", () => {
  it("rejects a single group (DescTools' message)", () => {
    const message = "all observations are in the same group";
    expect(() => jonckheereTest([1, 2, 3], ["a", "a", "a"])).toThrow(message);
    expect(() => jonckheereTest([1, 2, 3], ["a", "a", "a"], { levels: ["a", "b"] })).toThrow(message);
    expect(() => jonckheereTest([1, 2, 3, NaN], ["a", "a", "a", "b"])).toThrow(message);
    expect(() => jonckheereTest([1, 2, 3], ["a", "a", "a"], { exact: false })).toThrow(message);
  });

  it("rejects a single group (clinfun's message)", () => {
    const message = "only one group has non-missing data";
    expect(() => jonckheereTest([1, 2, 3], [1, 1, 1], { variant: "clinfun" })).toThrow(message);
    expect(() => jonckheereTest([1, 2, 3, Infinity], [1, 1, 1, 2], { variant: "clinfun" })).toThrow(message);
  });

  // DescTools: 4 and 0x1.5555555555558p-3 (1/6 + 3 ulps); 1/6 exactly here, before the fix too
  it("keeps the values for two groups", () => {
    const r = jonckheereTest([1.1, 2.0, 2.4, 3.5], [1, 1, 2, 2], { alternative: "increasing" });
    expect([r.statistic, r.pValue]).toEqual([4, 1 / 6]);
  });
});
