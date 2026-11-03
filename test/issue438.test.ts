// Issue #438: pivotWider rejects idCols that overlap namesFrom or valuesFrom, as tidyr (review_fix_log_issue438.md).
import { describe, expect, it } from "vitest";
import { pivotWider } from "../src/index.js";

const d = { id: ["a", "b"], name: ["x", "y"], value: [1, 2] };

describe("issue #438", () => {
  it("rejects an id column that is pivoted", () => {
    // tidyr 1.3.2: "`id_cols` can't select a column already selected by `values_from`." (the first such id column)
    expect(() => pivotWider(d, { idCols: ["value"] })).toThrow(
      "`id_cols` can't select a column already selected by `values_from`. Column `value` has already been selected.",
    );
    expect(() => pivotWider(d, { idCols: ["id", "name"] })).toThrow(
      "`id_cols` can't select a column already selected by `names_from`. Column `name` has already been selected.",
    );
    expect(() => pivotWider(d, { idCols: ["value", "name"] })).toThrow("by `values_from`. Column `value`");
    expect(() => pivotWider(d, { idCols: ["name"], namesFrom: "name", valuesFrom: "name" })).toThrow("by `names_from`");
    // a missing column is reported first
    expect(() => pivotWider(d, { idCols: ["zz", "value"] })).toThrow("Column `zz` doesn't exist.");
  });

  it("keeps disjoint id columns", () => {
    expect(pivotWider(d, { idCols: "id" })).toEqual({ id: ["a", "b"], x: [1, null], y: [null, 2] });
  });
});
