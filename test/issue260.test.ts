// Issue #260: nonEstimableRows where the dot product and the norms overflow (review_fix_log_issue260.md).
import { describe, expect, it } from "vitest";
import { lm, predict, qr } from "../src/index.js";
import { NON_ESTIMABLE_WARNING, nonEstimableRows } from "../src/models/estimable.js";

// null space spanned by (1, 1, 1, 1)
const q = qr([[1, 0, 0, -1], [0, 1, 0, -1], [0, 0, 1, -1], [1, 1, 1, -3]]);

describe("issue #260: estimability of rows near 1e308", () => {
  it("flags a row whose dot product and norms overflow", () => {
    expect(q.rank).toBe(3);
    expect(nonEstimableRows(q, q.rank, [[1e308, 1e308, 1e308, 1e308]])).toEqual([0]);
  });

  it("keeps the other judgements", () => {
    expect(nonEstimableRows(q, q.rank, [[1e200, 1e200, 1e200, 1e200]])).toEqual([0]);
    expect(nonEstimableRows(q, q.rank, [[1, 1, 1, 1]])).toEqual([0]);
    expect(nonEstimableRows(q, q.rank, [[1, 1, 1, 1e-300]])).toEqual([0]);
    // orthogonal to (1, 1, 1, 1) although the norm overflows (R: estimable)
    expect(nonEstimableRows(q, q.rank, [[1e308, -1e308, 0, 0]])).toEqual([]);
    expect(nonEstimableRows(q, q.rank, [[1.5e308, -1.5e308, 0, 0]])).toEqual([]);
    expect(nonEstimableRows(q, q.rank, [[NaN, 1, 1, 1]])).toEqual([]);
    expect(nonEstimableRows(q, q.rank, [[Infinity, 1, 1, 1]])).toEqual([]);
  });

  it("gives predict (lm) its warning, as R", () => {
    const x = [[1, 2, 3], [2, 1, 5], [3, 3, 1], [4, 0, 2], [5, 2, 2], [6, 1, 4]].map((r) => [...r, -(r[0]! + r[1]! + r[2]!)]);
    const fit = lm(x, [1.2, 2.3, 2.9, 4.4, 5.1, 6.3], { intercept: false });
    const p = predict(fit, [[1e308, 1e308, 1e308, 1e308]]);
    // R: fit 0x1.232064ebc705dp+1023 with attr(, "non-estim") 1 and the warning
    expect(p.fit).toEqual([1.0221800433839477e308]);
    expect(p.nonEstimable).toEqual([0]);
    expect(p.warnings).toEqual([NON_ESTIMABLE_WARNING]);
  });
});
