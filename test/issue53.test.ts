// Issue #53: firstTrue where lo + step overflows with hi = Infinity (review_fix_log_issue53.md).
import { describe, expect, it } from "vitest";
import { firstTrue } from "../src/internal/discrete.js";

describe("issue #53", () => {
  it("finds a finite threshold near the largest double", () => {
    // Infinity was taken as the bound: the result was Infinity
    expect(firstTrue((x) => x >= 1.6e308, 1e308, Infinity)).toBe(1.6e308);
    expect(firstTrue((x) => x >= 1.6e308, 0, Infinity)).toBe(1.6e308);
    expect(firstTrue((x) => x >= Number.MAX_VALUE, 0, Infinity)).toBe(Number.MAX_VALUE);
  });

  it("returns hi + 1 when the predicate never holds", () => {
    // did not return before (run with -t excluding this test when checking the old code)
    expect(firstTrue(() => false, 1e308, Infinity)).toBe(Infinity);
    expect(firstTrue(() => false, 0, Infinity)).toBe(Infinity);
  });

  it("leaves ordinary ranges as before", () => {
    expect(firstTrue((x) => x >= 5, 0, Infinity)).toBe(5);
    expect(firstTrue((x) => x >= 2 ** 60, 3, Infinity)).toBe(2 ** 60);
    expect(firstTrue((x) => x >= 7, 0, 5)).toBe(6);
    expect(firstTrue((x) => x >= 1e300, 0, 1e200)).toBe(1e200 + 1);
  });
});
