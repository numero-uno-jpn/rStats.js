import { describe, expect, it } from "vitest";
import { powerPropTest } from "../src/index.js";

// #312: solving for p1 with p2 = 0 (or p2 with p1 = 1) passed a single-point interval to uniroot (R the same)
describe("powerPropTest solving for a probability at an endpoint (#312)", () => {
  it("p2 = 0 and p1 = 1: a RangeError that says why", () => {
    expect(() => powerPropTest({ n: 50, p2: 0, power: 0.8 })).toThrow("'p1' cannot be determined when 'p2' is 0");
    expect(() => powerPropTest({ n: 50, p1: 1, power: 0.8 })).toThrow("'p2' cannot be determined when 'p1' is 1");
  });

  it("interior probabilities are unchanged (R 0.23316995582343609 and 0.76683004417656395)", () => {
    expect(powerPropTest({ n: 50, p2: 0.5, power: 0.8 }).p1).toBeCloseTo(0.23316995582343609, 6);
    expect(powerPropTest({ n: 50, p1: 0.5, power: 0.8 }).p2).toBeCloseTo(0.76683004417656395, 6);
  });
});
