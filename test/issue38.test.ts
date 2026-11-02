// Issue #38: scale rejects a matrix whose rows differ in length (review_fix_log_issue38.md).
import { describe, expect, it } from "vitest";
import { scale } from "../src/index.js";

const ragged = "all rows of the matrix must have the same length";

describe("issue #38", () => {
  it("throws for ragged rows", () => {
    // the extra 5 was passed through unscaled; a short row gave a NaN centre and a scale of 0
    expect(() => scale([[1, 2], [3, 4, 5]], { center: false, scale: false })).toThrow(ragged);
    expect(() => scale([[1, 2], [3, 4, 5]])).toThrow(ragged);
    expect(() => scale([[1, 2], [3]])).toThrow(ragged);
    expect(() => scale([[1, 2], [3]], { center: [0, 0], scale: [1, 1] })).toThrow(ragged);
  });

  it("leaves rectangular matrices and vectors as before", () => {
    const h = 1 / Math.SQRT2;
    expect(scale([[1, 2], [3, 6]])).toEqual({
      scaled: [[-h, -h], [h, h]],
      center: [2, 4],
      scale: [Math.SQRT2, 2 * Math.SQRT2],
    });
    expect(scale([1, 3], { scale: false })).toEqual({ scaled: [[-1], [1]], center: [2] });
    expect(scale([])).toEqual({ scaled: [], center: [], scale: [] });
  });
});
