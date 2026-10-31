// Fixes of the 32nd review round (review_fix_log_20261031_32.md): mauchlyTest with nothing to test; a given glm
// dispersion that is negative or not finite; anova of lm and glm fits that are not nested.
import { describe, expect, it } from "vitest";
import { anova, glm, glmAnova, glmSummary, lm, mauchlyTest } from "../src/index.js";

const y3 = [[1, 2, 3], [3, 1, 3], [2, 4, 1], [5, 3, 2], [4, 6, 6], [6, 5, 4]];
const d = { y: [1.2, 2.3, 2.9, 4.1, 5.2, 5.8, 7.1, 8.3], x1: [1, 2, 3, 4, 5, 6, 7, 8], x2: [3, 1, 4, 1, 5, 9, 2, 6], x3: [9, 1, 16, 1, 25, 81, 4, 36] };

describe("review 32", () => {
  it("mauchlyTest with X spanning M is an error (R: \"'a' is 0-diml\")", () => {
    // W was 1 and the p-value NaN
    expect(() => mauchlyTest(y3, { X: "~1", M: "~1" })).toThrow("X spans M: the test has no dimensions");
    expect(mauchlyTest(y3).statistic).toBeGreaterThan(0);
  });
  it("a given dispersion must be non-negative and finite", () => {
    const fit = glm(d.x1, d.y);
    // R 4.5.2: NaN standard errors with a warning
    expect(() => glmSummary(fit, { dispersion: -1 })).toThrow("'dispersion' must be a non-negative finite number");
    expect(() => glmSummary(fit, { dispersion: NaN })).toThrow("'dispersion' must be a non-negative finite number");
    expect(() => glmAnova(fit, { dispersion: Infinity })).toThrow("'dispersion' must be a non-negative finite number");
    // 0 as R: standard errors 0
    expect(glmSummary(fit, { dispersion: 0 }).stdError).toEqual([0, 0]);
  });
  it("anova of lm fits that are not nested has no F test", () => {
    // R 4.5.2: F 1110, p 4.6e-7 for y ~ x2 against y ~ x1 + x3
    const t = anova(lm("y ~ x2", d), lm("y ~ x1 + x3", d));
    expect(t.table[1]!.slice(0, 4)).toEqual([5, expect.closeTo(0.1503828535481075, 12), 1, expect.closeTo(33.38621289113274, 12)]);
    expect(t.table[1]![4]).toBeNaN();
    expect(t.table[1]![5]).toBeNaN();
    // nested: as before (R 4.5.2)
    const n = anova(lm("y ~ x1", d), lm("y ~ x1 + x2", d));
    expect(n.table[1]![4]).toBeCloseTo(1.7582567682083667, 10);
    // the same model in other units is nested in both directions
    expect(anova(lm("y ~ x1", d), lm("y ~ x1 + x2", { ...d, x1: d.x1.map((v) => v * 1e-9) })).table[1]![4]).toBeCloseTo(1.7582567682083667, 8);
  });
  it("glmAnova of fits that are not nested has no test", () => {
    const X1 = d.x1.map((v) => [v]);
    const X23 = d.x2.map((v, i) => [v, d.x3[i]!]);
    for (const test of ["LRT", "F", "Rao"] as const) {
      const t = glmAnova([glm(X23, d.y), glm(X1.map((r, i) => [r[0]!, d.x3[i]!, d.x2[i]! * 2 + 1]), d.y)], { test });
      expect(t.table[1]!.every((v, j) => j < 4 || !Number.isNaN(v))).toBe(true); // nested (x2, x3 within x1, x3, 2 x2 + 1)
      const u = glmAnova([glm(X1, d.y), glm(X23, d.y)], { test });
      expect(u.table[1]!.slice(4).every(Number.isNaN)).toBe(true);
    }
  });
});
