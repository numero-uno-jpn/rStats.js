// Issue #227: cut with fewer than 2 break points (after dropping NaN) is an error (review_fix_log_issue227.md)
import { describe, expect, it } from "vitest";
import { cut } from "../src/index.js";

describe("issue #227", () => {
  it("rejects fewer than 2 break points, as one break", () => {
    // R 4.5.2: cut(c(0, 1), numeric(0)) and cut(c(0, 1), c(0, NaN)) give NA codes (not an error); here the error of
    // one break, R's "invalid number of intervals" for cut(c(0, 1), 0.5)
    expect(() => cut([0, 1], [])).toThrow("invalid number of intervals");
    expect(() => cut([0, 1], [0, NaN])).toThrow("invalid number of intervals");
    expect(() => cut([0, 1], [NaN, NaN, 1])).toThrow("invalid number of intervals");
    expect(() => cut([0, 1], [0.5])).toThrow("invalid number of intervals");
  });

  it("keeps two or more break points, infinite ones too, as R", () => {
    // R 4.5.2: cut(c(0, 1), c(-Inf, 0.5, Inf)) is 1:2, c(-Inf, Inf) gives 1 1, c(0, NaN, 1) gives NA 1
    expect(cut([0, 1], [-Infinity, 0.5, Infinity])).toEqual([1, 2]);
    expect(cut([0, 1], [-Infinity, Infinity])).toEqual([1, 1]);
    expect(cut([0, 1], [0, NaN, 1])).toEqual([NaN, 1]);
    expect(cut([1, 2.5, 4, 6], [0, 2, 4, 6])).toEqual([1, 2, 2, 3]);
  });
});
