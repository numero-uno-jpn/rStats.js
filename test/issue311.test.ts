import { describe, expect, it } from "vitest";
import { powerAnovaTest, powerPropTest, powerTTest } from "../src/index.js";

// #311: with no effect the power does not depend on n; the search failed with a generic root-finding error (R too)
describe("solving for n with no effect (#311)", () => {
  it("powerTTest with delta 0", () => {
    expect(() => powerTTest({ delta: 0, sd: 1, power: 0.8 })).toThrow("'n' cannot be determined when 'delta' is 0");
    expect(() => powerTTest({ delta: 0, sd: 1, power: 0.8, alternative: "one.sided" })).toThrow("'n' cannot be determined");
  });

  it("powerPropTest with p1 = p2", () => {
    expect(() => powerPropTest({ p1: 0.5, p2: 0.5, power: 0.8 })).toThrow("'n' cannot be determined when 'p1' equals 'p2'");
  });

  it("powerAnovaTest with betweenVar 0", () => {
    expect(() => powerAnovaTest({ groups: 3, betweenVar: 0, withinVar: 1, power: 0.8 })).toThrow(
      "'n' cannot be determined when 'betweenVar' is 0",
    );
  });

  it("a nonzero effect is unchanged", () => {
    expect(powerTTest({ delta: 1, sd: 1, power: 0.8 }).n).toBeCloseTo(16.71477, 4);
  });
});
