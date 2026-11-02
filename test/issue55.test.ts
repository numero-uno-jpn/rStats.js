// Issue #55: diag, cbind and rbind with vectors of length 0 (review_fix_log_issue55.md).
import { describe, expect, it } from "vitest";
import { cbind, diag, rbind } from "../src/index.js";

describe("issue #55", () => {
  it("diag: no values for a diagonal of positive length is an error (R 4.5.2)", () => {
    // i % 0 put undefined on the diagonal
    expect(() => diag([], { nrow: 2, ncol: 2 })).toThrow("'x' must have positive length");
    expect(() => diag([], { nrow: 2 })).toThrow("'x' must have positive length");
    expect(diag([], { nrow: 0, ncol: 2 })).toEqual([]);
    expect(diag([])).toEqual([]);
  });

  it("cbind and rbind leave out vectors of length 0 (R 4.5.2)", () => {
    expect(cbind([], [1, 2])).toEqual([[1], [2]]);
    expect(rbind([], [1, 2])).toEqual([[1, 2]]);
    expect(cbind([[1, 3], [2, 4]], [])).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(cbind([], 5)).toEqual([[5]]);
    expect(rbind([], [[1, 3], [2, 4]])).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(cbind([], [1, 2], 3)).toEqual([
      [1, 3],
      [2, 3],
    ]);
    expect(cbind(new Float64Array(0), [1, 2])).toEqual([[1], [2]]);
  });

  it("leaves other inputs as before", () => {
    expect(cbind([])).toEqual([]);
    expect(rbind([], [])).toEqual([[], []]);
    expect(diag([1, 2], { nrow: 3 })).toEqual([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 1],
    ]);
    expect(cbind([1, 2], [3, 4, 5, 6])).toEqual([
      [1, 3],
      [2, 4],
      [1, 5],
      [2, 6],
    ]);
  });
});
