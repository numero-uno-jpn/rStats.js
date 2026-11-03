// Issue #449: merge keeps a Float64Array key column when its values come from Float64Arrays only
// (review_fix_log_issue449.md).
import { describe, expect, it } from "vitest";
import { merge } from "../src/index.js";

describe("issue #449", () => {
  const x = { id: new Float64Array([1, 2]), x: ["a", "b"] };

  it("keeps x's Float64Array key when no row is only in y", () => {
    // R: merge(data.frame(id = c(1, 2), x = c("a", "b")), data.frame(id = c(2, 1), y = c(20, 10))): id 1 2
    for (const allY of [false, true]) {
      const out = merge(x, { id: [2, 1], y: [20, 10] }, { allY });
      expect(out.id).toBeInstanceOf(Float64Array);
      expect(Array.from(out.id!)).toEqual([1, 2]);
      expect(Array.from(out.y!)).toEqual([10, 20]);
    }
  });

  it("gives an array when rows only in y take values from an array", () => {
    // R with all.y = TRUE and a row only in y: id 1 2 3
    const out = merge(x, { id: [2, 1, 3], y: [20, 10, 30] }, { allY: true });
    expect(out.id).not.toBeInstanceOf(Float64Array);
    expect(Array.from(out.id!)).toEqual([1, 2, 3]);
  });
});
