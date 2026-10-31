// Fixes of the 30th review round (review_fix_log_20261031_30.md): expm's order checked only for the methods that use
// it; non-finite entries an error for every method.
import { describe, expect, it } from "vitest";
import { expm } from "../src/index.js";

describe("review 30", () => {
  it("order is checked only by the Padé and Taylor methods", () => {
    // R 4.5.2 (expm): [[1, 1], [0, 1]]; it was an error
    expect(expm([[0, 1], [0, 0]], { method: "Higham08", order: 0 })).toEqual([[1, 1], [0, 1]]);
    expect(expm([[0, 1], [0, 0]], { method: "Higham08.b", order: 1.5 })).toEqual([[1, 1], [0, 1]]);
    // R gives the identity for Pade with order 0 (wrong); an error here
    for (const method of ["Pade", "PadeO", "Taylor", "TaylorO"] as const) {
      expect(() => expm([[0, 1], [0, 0]], { method, order: 0 })).toThrow("order must be a positive integer");
    }
  });
  it("non-finite entries of a matrix of 2 x 2 or larger are an error for every method", () => {
    for (const method of ["Higham08.b", "Higham08", "Pade", "PadeO", "Taylor", "TaylorO"] as const) {
      // Pade and Taylor returned a matrix of NaN
      expect(() => expm([[Infinity, 0], [0, 1]], { method })).toThrow("the matrix contains NaN or infinite values");
      expect(() => expm([[NaN, 0], [0, 1]], { method })).toThrow("the matrix contains NaN or infinite values");
    }
    // a 1 x 1 matrix: exp of its entry, as R
    expect(expm([[NaN]])[0]![0]).toBeNaN();
    expect(expm([[Infinity]])).toEqual([[Infinity]]);
    expect(expm([[-Infinity]])).toEqual([[0]]);
  });
});
