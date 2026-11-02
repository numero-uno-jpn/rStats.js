// Issue #82: merge compares key columns of different types in their common type, as R's match
// (review_fix_log_issue82.md). The expected values are R 4.5.2's.
import { describe, expect, it } from "vitest";
import { merge } from "../src/index.js";

describe("issue #82", () => {
  it("matches a single key across types", () => {
    expect(merge({ id: [1], x: [10] }, { id: ["1"], y: [20] })).toEqual({ id: [1], x: [10], y: [20] });
    expect(merge({ id: [1, 0] }, { id: [true, false], y: [1, 2] })).toEqual({ id: [0, 1], y: [2, 1] });
    expect(merge({ id: [true, false], x: [1, 2] }, { id: ["TRUE", "FALSE"], y: [1, 2] })).toEqual({
      id: [false, true],
      x: [2, 1],
      y: [2, 1],
    });
    // numbers as text with 15 significant digits, as as.character
    expect(merge({ id: [0.1 + 0.2], x: [1] }, { id: ["0.3"], y: [2] })).toEqual({ id: [0.1 + 0.2], x: [1], y: [2] });
    expect(merge({ id: [0.1 + 0.2], x: [1] }, { id: [0.3], y: [2] })).toEqual({ id: [], x: [], y: [] });
    expect(merge({ id: [1e5], x: [1] }, { id: ["1e+05", "100000"], y: [1, 2] })).toEqual({ id: [1e5], x: [1], y: [1] });
  });

  it("matches missing keys with each other and not with the text NA", () => {
    expect(merge({ id: [1, null], x: [1, 2] }, { id: ["1", null], y: [1, 2] })).toEqual({
      id: [1, null],
      x: [1, 2],
      y: [1, 2],
    });
    expect(merge({ id: [1, null], x: [1, 2] }, { id: ["1", "NA"], y: [1, 2] })).toEqual({ id: [1], x: [1], y: [1] });
  });

  it("matches several keys column by column in their common type", () => {
    expect(merge({ a: [true, false], b: ["x", "x"], x: [1, 2] }, { a: [1, 0], b: ["x", "x"], y: [1, 2] })).toEqual({
      a: [false, true],
      b: ["x", "x"],
      x: [2, 1],
      y: [2, 1],
    });
    expect(merge({ a: [10, 2, 1], b: ["x", "x", "x"], x: [1, 2, 3] }, { a: ["10", "1", "9"], b: ["x", "x", "x"], y: [1, 2, 3] }, { all: true })).toEqual({
      a: ["1", "10", "2", "9"],
      b: ["x", "x", "x", "x"],
      x: [3, 1, 2, null],
      y: [2, 1, null, 3],
    });
  });

  it("gives the key column the common type only with rows only in y", () => {
    const x = { id: [10, 2, 1], x: [1, 2, 3] };
    const y = { id: ["10", "1", "9"], y: [1, 2, 3] };
    expect(merge(x, y)).toEqual({ id: [1, 10], x: [3, 1], y: [2, 1] });
    expect(merge(y, x)).toEqual({ id: ["1", "10"], y: [2, 1], x: [3, 1] });
    expect(merge(x, y, { all: true })).toEqual({ id: ["1", "10", "2", "9"], x: [3, 1, 2, null], y: [2, 1, null, 3] });
    expect(merge(x, y, { allX: true })).toEqual({ id: [1, 2, 10], x: [3, 2, 1], y: [2, null, 1] });
    expect(merge(x, y, { allY: true })).toEqual({ id: ["1", "10", "9"], x: [3, 1, null], y: [2, 1, 3] });
    expect(merge(x, { id: ["10", "1"], y: [1, 2] }, { all: true })).toEqual({ id: [1, 2, 10], x: [3, 2, 1], y: [2, null, 1] });
    expect(merge({ id: [true, false], x: [1, 2] }, { id: [1, 5], y: [1, 2] }, { all: true })).toEqual({
      id: [0, 1, 5],
      x: [2, 1, null],
      y: [null, 1, 2],
    });
    expect(merge({ id: [1, null], x: [1, 2] }, { id: ["a", null], y: [1, 2] }, { all: true })).toEqual({
      id: ["1", "a", null],
      x: [1, null, 2],
      y: [null, 1, 2],
    });
  });

  it("keeps R's order without sort", () => {
    expect(merge({ id: [1, 1, 2], x: [1, 2, 3] }, { id: ["1", "2", "1"], y: [1, 2, 3] }, { sort: false })).toEqual({
      id: [1, 1, 1, 1, 2],
      x: [1, 1, 2, 2, 3],
      y: [1, 3, 1, 3, 2],
    });
  });

  it("keeps a numeric (Float64Array) key column when the types agree", () => {
    const out = merge({ id: Float64Array.of(2, 1), x: [1, 2] }, { id: Float64Array.of(1, 3), y: [5, 6] }, { all: true });
    expect(out.id).toEqual(Float64Array.of(1, 2, 3));
  });
});
