// Issue #440: pivotWider rejects an empty namesFrom or valuesFrom, as tidyr (review_fix_log_issue440.md).
import { describe, expect, it } from "vitest";
import { pivotWider } from "../src/index.js";

const d = { id: ["a", "b"], name: ["x", "y"], value: [1, 2] };

describe("issue #440", () => {
  it("rejects an empty selection", () => {
    // tidyr 1.3.2: "Must select at least one item." (names_from first, then values_from)
    expect(() => pivotWider(d, { namesFrom: [] })).toThrow("`names_from` must select at least one column.");
    expect(() => pivotWider(d, { valuesFrom: [] })).toThrow("`values_from` must select at least one column.");
    expect(() => pivotWider(d, { namesFrom: [], valuesFrom: "zz" })).toThrow("`names_from` must select");
    expect(() => pivotWider(d, { namesFrom: "zz", valuesFrom: [] })).toThrow("Column `zz` doesn't exist.");
  });

  it("keeps an empty idCols (one row), as tidyr", () => {
    expect(pivotWider(d, { idCols: [] })).toEqual({ x: [1], y: [2] });
  });
});
