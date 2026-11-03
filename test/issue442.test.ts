// Issue #442: pivotLonger with an empty namesTo makes no name columns (review_fix_log_issue442.md).
import { describe, expect, it } from "vitest";
import { pivotLonger } from "../src/index.js";

const plain = (df: Record<string, ArrayLike<unknown>>) =>
  Object.fromEntries(Object.entries(df).map(([k, v]) => [k, Array.from(v)]));

describe("issue #442", () => {
  it("ignores namesPattern and namesSep", () => {
    // tidyr::pivot_longer(data.frame(a_b = 1), "a_b", names_to = character(0), names_pattern = "(a)_(b)") and
    // names_sep = "_": value 1
    const data = { a_b: [1] };
    expect(plain(pivotLonger(data, { cols: ["a_b"], namesTo: [], namesPattern: "(a)_(b)" }))).toEqual({ value: [1] });
    expect(plain(pivotLonger(data, { cols: ["a_b"], namesTo: [], namesSep: "_" }))).toEqual({ value: [1] });
  });

  it("needs no parsing option and keeps one row per column", () => {
    // tidyr, data.frame(id = 1:2, a_b = 1:2, c_d = 3:4), names_to = character(0): id 1 1 2 2, value 1 3 2 4;
    // values_to = "v", cols_vary = "slowest": id 1 2 1 2, v 1 2 3 4
    const data = { id: [1, 2], a_b: [1, 2], c_d: [3, 4] };
    expect(plain(pivotLonger(data, { cols: ["a_b", "c_d"], namesTo: [] }))).toEqual({
      id: [1, 1, 2, 2],
      value: [1, 3, 2, 4],
    });
    expect(
      plain(pivotLonger(data, { cols: ["a_b", "c_d"], namesTo: [], valuesTo: "v", colsVary: "slowest" })),
    ).toEqual({ id: [1, 2, 1, 2], v: [1, 2, 3, 4] });
  });
});
