// Issue #149: perm(Infinity, k) was NaN (lgamma(Infinity) - lgamma(Infinity)) (review_fix_log_issue149.md).
// For a fixed finite k the product ~ n^k: the limit is Infinity for k > 0 and 1 for k = 0.
import { describe, expect, it } from "vitest";
import { perm } from "../src/index.js";

describe("issue #149", () => {
  it("gives the limit for an infinite n and a finite k", () => {
    expect(perm(Infinity, 1001)).toBe(Infinity);
    expect(perm(Infinity, 1000.5)).toBe(Infinity);
    expect(perm(Infinity, 5)).toBe(Infinity);
    expect(perm(Infinity, 0.5)).toBe(Infinity);
    expect(perm(Infinity, 1e308)).toBe(Infinity);
    expect(perm(Infinity, 0)).toBe(1);
  });

  it("keeps the other cases as before", () => {
    expect(perm(Infinity, Infinity)).toBeNaN();
    expect(perm(5, Infinity)).toBe(0);
    expect(perm(5.5, Infinity)).toBe(0);
    expect(perm(5, 2)).toBe(20);
    expect(perm(-1, 2)).toBeNaN();
  });
});
