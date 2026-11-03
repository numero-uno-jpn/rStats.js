// Issue #468: cronbachAlpha with a singular correlation matrix (review_fix_log_issue468.md).
import { describe, expect, it } from "vitest";
import { cronbachAlpha } from "../src/index.js";

const cols = (...c: number[][]) => c[0]!.map((_, i) => c.map((v) => v[i]!));
const a = [1, 2, 3, 4, 5, 6];
const c3 = [2, 1, 4, 3, 6, 5];

describe("issue #468", () => {
  it("a repeated item gives all values; G6 from the R^2 of lm", () => {
    // R 4.5.2 / psych 2.6.9: raw, std alpha and average_r 1; the SMC as summary(lm(x[, i] ~ x[, -i]))$r.squared is
    // 1 for both items, G6 1 (psych's pseudo-inverse gives 0.5)
    const r = cronbachAlpha([[1, 1], [2, 2], [3, 3]]);
    expect([r.rawAlpha, r.stdAlpha, r.G6, r.averageR]).toEqual([1, 1, 1, 1]);
  });

  it("a repeated item next to another one", () => {
    // R: SMC 1, 1, 0x1.47ae147ae1478p-1 from lm; G6 0x1.e9859e9859e98p-1 (psych 0.71219512195121935)
    const r = cronbachAlpha(cols([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [2, 1, 4, 3, 5]));
    expect(r.G6).toBe(0.9560975609756097);
    expect(r.rawAlpha).toBeCloseTo(0.9512195121951219, 14);
    expect(r.stdAlpha).toBeCloseTo(0.9512195121951218, 14);
  });

  it("an item that is the sum of two others, and more items than subjects: G6 1", () => {
    // R: every SMC from lm is 1 (psych 0.80430491414020135 and -5.7123395970359869)
    const s = cronbachAlpha(cols(a, c3, a.map((v, i) => v + c3[i]!)));
    expect(s.G6).toBe(1);
    expect(s.stdAlpha).toBeCloseTo(0.9694568931273794, 14);
    const w = cronbachAlpha([[-6, 2, 3, -8, 15, 4], [2, -8, 5, 6, 4, 4], [-8, 5, -6, 11, 9, 4], [16, 7, -22, 4, 8, 3]]);
    expect(w.G6).toBe(1);
    expect(w.rawAlpha).toBeCloseTo(-67.39999999999952, 11);
  });

  it("a nonsingular matrix is unchanged", () => {
    expect(cronbachAlpha([[1, 2, 2], [2, 3, 3], [3, 3, 4], [4, 5, 4], [2, 2, 3]]).G6).toBe(0.981680477517221);
  });
});
