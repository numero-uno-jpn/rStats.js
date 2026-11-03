import { describe, expect, it } from "vitest";
import { glm, lm } from "../src/index.js";

// #463: the matrix forms of lm and glm checked the lengths of the rows after dropping the rows with a missing value,
// so a ragged matrix whose odd row had a missing value was fitted as a one-predictor model.
describe("#463 lm and glm: ragged matrices with missing values", () => {
  it("rejects a ragged matrix whose odd row is dropped", () => {
    expect(() => lm([[1], [2, NaN], [3]], [1, NaN, 3])).toThrow("all rows of the matrix must have the same length");
    expect(() => glm([[1], [2, NaN], [3]], [1, NaN, 3])).toThrow("all rows of x must have the same length");
    expect(() => lm([[1, 1], [NaN], [3, 2], [4, 7]], [1, 2, 3, 4])).toThrow("all rows of the matrix must have the same length");
    expect(() => glm([[1, 1], [NaN], [3, 2], [4, 7]], [1, 2, 3, 4])).toThrow("all rows of x must have the same length");
  });

  it("rejects a complete ragged matrix as before", () => {
    expect(() => lm([[1], [2, 5], [3]], [1, 2, 3])).toThrow("all rows of the matrix must have the same length");
    expect(() => glm([[1], [2, 5], [3]], [1, 2, 3])).toThrow("all rows of x must have the same length");
  });

  it("still drops a rectangular row with a missing value", () => {
    expect(lm([[1], [NaN], [3]], [1, 2, 3]).coefficients).toEqual(lm([[1], [3]], [1, 3]).coefficients);
    expect(glm([[1], [NaN], [3]], [1, 2, 3]).coefficients).toEqual(glm([[1], [3]], [1, 3]).coefficients);
  });
});
