// Issue #36: cov and cor reject a matrix whose rows differ in length (review_fix_log_issue36.md).
import { describe, expect, it } from "vitest";
import { cor, cov } from "../src/index.js";

const ragged = "all rows of the matrix must have the same length";

describe("issue #36", () => {
  it("throws for ragged rows in x or y", () => {
    // the extra 5 was dropped; a short row gave undefined, which came out as NaN
    expect(() => cov([[1, 2], [3, 4, 5]])).toThrow(ragged);
    expect(() => cov([[1, 2], [3]])).toThrow(ragged);
    expect(() => cor([[1, 2], [3, 4, 5]])).toThrow(ragged);
    expect(() => cov([[1, 2], [3, 4]], [[1], [2, 3]])).toThrow(ragged);
    expect(() => cor([1, 2], [[1], [2, 3]])).toThrow(ragged);
  });

  it("leaves rectangular matrices as before", () => {
    expect(cov([[1, 2], [3, 5]])).toEqual([[2, 3], [3, 4.5]]);
    expect(cor([[1, 2], [2, 4], [3, 6]])).toEqual([[1, 1], [1, 1]]);
    expect(cov([1, 2, 4], [2, 4, 8])).toBeCloseTo(14 / 3, 14);
  });
});
