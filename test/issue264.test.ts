// Issue #264: esW1 where the squared difference of the probabilities underflows (review_fix_log_issue264.md).
import { describe, expect, it } from "vitest";
import { esW1 } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #264", () => {
  it("forms (d / sqrt(p0))^2 where d^2 underflows", () => {
    // Rmpfr from the double inputs: 1.0000055664551362686e-40 (p0 = 1e-320 is the subnormal 253 2^-1071); R: 0
    expect(rel(esW1([1e-320, 1], [1e-200, 1]), 1.0000055664551362686e-40)).toBeLessThan(1e-15);
    // p0 = 0 < p1 gives Inf, as pwr, also where d^2 underflows (was 0 / 0 = NaN)
    expect(esW1([0, 1], [1e-300, 1])).toBe(Infinity);
  });

  it("leaves the other cases as before", () => {
    expect(esW1([0.25, 0.25, 0.25, 0.25], [0.4, 0.2, 0.2, 0.2])).toBe(0.34641016151377546);
    expect(esW1([0.1, 0.2, 0.7], [0.3, 0.3, 0.4])).toBe(0.7606388292556648);
    expect(esW1([1e-300, 1], [1e-150, 1])).toBe(1);
    expect(esW1([0.5, 0.5, 0], [0.5, 0.5, 0])).toBe(0);
  });
});
