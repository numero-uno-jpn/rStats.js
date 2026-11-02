// Issue #78: cor's diagonal where the correlation of a column with itself is undefined (review_fix_log_issue78.md).
import { describe, expect, it } from "vitest";
import { cor } from "../src/index.js";

describe("issue #78", () => {
  it("leaves NaN on the diagonal of a constant column (R 4.5.2: 1)", () => {
    for (const method of ["pearson", "spearman", "kendall"] as const) {
      expect(cor([[1, 2], [1, 3], [1, 4]], undefined, { method }), method).toEqual([
        [NaN, NaN],
        [NaN, 1],
      ]);
    }
  });

  it("leaves NaN on the diagonal of a column with a NaN under everything, and 1 where the rows are dropped", () => {
    expect(cor([[1, 2], [NaN, 3], [4, 4]])).toEqual([
      [NaN, NaN],
      [NaN, 1],
    ]);
    expect((cor([[1, 2], [NaN, 3], [4, 4], [2, 7]], undefined, { use: "complete.obs" }) as number[][])[0]![0]).toBe(1);
    // a column constant once the incomplete rows are dropped
    expect((cor([[1, 2], [NaN, 3], [1, 4]], undefined, { use: "complete.obs" }) as number[][])[0]![0]).toBeNaN();
  });

  it("keeps 1 on the ordinary diagonal", () => {
    const m = cor([[1, 2, 0.3], [2, 1, 0.7], [4, 5, 0.1], [3, 3, 0.9]]) as number[][];
    expect(m.map((r, i) => r[i])).toEqual([1, 1, 1]);
  });
});
