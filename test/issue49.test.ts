// Issue #49: wilcoxTest (two samples, normal approximation) with all values tied has p = 1 (review_fix_log_issue49.md).
import { describe, expect, it } from "vitest";
import { wilcoxTest } from "../src/index.js";

describe("issue #49", () => {
  it("is 1 when every value is the same (R 4.5.2: NaN)", () => {
    // 0 / 0 gave NaN two-sided
    const a = wilcoxTest([1], [1]);
    expect([a.statistic, a.pValue]).toEqual([0.5, 1]);
    const b = wilcoxTest([1, 1], [1, 1], { exact: false });
    expect([b.statistic, b.pValue]).toEqual([2, 1]);
    expect(wilcoxTest([1, 1], [1, 1], { exact: false, correct: false }).pValue).toBe(1);
    expect(wilcoxTest([1, 1], [1, 1, 1], { exact: false, alternative: "less" }).pValue).toBe(1);
    expect(wilcoxTest([1, 1], [1, 1, 1], { exact: false, alternative: "greater", correct: false }).pValue).toBe(1);
    // the same after subtracting mu
    const c = wilcoxTest([3, 3], [1, 1], { mu: 2, exact: false });
    expect([c.statistic, c.pValue]).toEqual([2, 1]);
  });

  it("leaves ties that are not all equal as R (R 4.6.2)", () => {
    expect(wilcoxTest([1, 1, 2], [1, 1, 1], { exact: false }).pValue).toBeCloseTo(0.50498507509384583, 15);
    // R 4.6's exact conditional test (R 4.5.2: the normal approximation, 0.28171791582572991)
    const r = wilcoxTest([1, 2, 2, 3], [2, 2, 4, 5]);
    expect(r.statistic).toBe(4);
    expect(r.pValue).toBeCloseTo(0.31428571428571428, 15);
  });
});
