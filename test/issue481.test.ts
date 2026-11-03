// Issue #481: poissonTest with two samples, the expected count n r T1 / (T1 + r T2) underflowed to 0 in the direct
// expression and the 0 was returned instead of going to the scaled fallback (review_fix_log_issue481.md).
import { describe, expect, it } from "vitest";
import { poissonTest } from "../src/index.js";

const M = Number.MAX_VALUE;
const m = Number.MIN_VALUE;

describe("issue #481", () => {
  it("gives the subnormal expected count, not 0", () => {
    // n = T2 = MAX_VALUE, r = T1: the value is T1 (r T2 / (T1 + r T2) is 1 - 2^-1074 / 2^-50 or so); R 4.5.2 gives 0
    expect(poissonTest([0, M], { T: [m, M], r: m }).parameter).toBe(m);
    expect(poissonTest([0, M], { T: [3 * m, M], r: m }).parameter).toBe(3 * m);
  });

  it("keeps an exact 0 for r = 0 and ordinary input", () => {
    expect(poissonTest([0, 5], { T: [1, 1], r: 0 }).parameter).toBe(0);
    expect(poissonTest([11, 23], { T: [800, 3011] }).parameter).toBe(7.137234321700341);
  });
});
