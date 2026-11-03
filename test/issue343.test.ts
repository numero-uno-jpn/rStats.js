// Issue #343: lu of a matrix with NaN or an infinite value (review_fix_log_issue343.md).
import { describe, expect, it } from "vitest";
import { lu } from "../src/index.js";

const message = "the matrix contains NaN or infinite values";

describe("issue #343", () => {
  it("rejects NaN and infinite entries, as svd, qr and eigen", () => {
    expect(() => lu([[1, Infinity], [0, 1]])).toThrow(message);
    expect(() => lu([[Infinity, 2], [1, 3]])).toThrow(message);
    expect(() => lu([[1, 2], [NaN, 3]])).toThrow(message);
    expect(() => lu([[1, 3], [2, -Infinity]])).toThrow(message);
  });

  it("leaves finite matrices unchanged", () => {
    expect(lu([[1, 2], [3, 4]])).toEqual({
      P: [[0, 1], [1, 0]],
      L: [[1, 0], [0.3333333333333333, 1]],
      U: [[3, 4], [0, 0.6666666666666667]],
    });
  });
});
