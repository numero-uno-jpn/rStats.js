// Issue #509: anova(fit1, fit2) of lm fits judges nesting on the rows of positive weight only, as glmAnova
// (review_fix_log_issue509.md).
import { describe, expect, it } from "vitest";
import { anova, lm } from "../src/index.js";

describe("issue #509", () => {
  it("a row of weight 0 does not make nested models look otherwise", () => {
    const data = { y: [0, 1, 1, 4, 999], x: [0, 1, 2, 3, 4], z: [0, 1, 2, 3, 100], w: [0, 0, 1, 1, 0] };
    const weights = [1, 1, 1, 1, 0];
    const t = anova(lm("y ~ x", data, { weights }), lm("y ~ z + w", data, { weights }));
    // the same table as the fits without the row of weight 0
    const d4 = { y: [0, 1, 1, 4], x: [0, 1, 2, 3], z: [0, 1, 2, 3], w: [0, 0, 1, 1] };
    expect(t.table).toEqual(anova(lm("y ~ x", d4), lm("y ~ z + w", d4)).table);
    // R 4.5.2 anova (with the weights, and without the row): F 0x1.9999999999991p-1 (0.7999999999999990),
    // p 0x1.122550cc9a906p-1 (0.5354409456024605)
    expect(t.table[1]![4]).toBeCloseTo(0.8, 12);
    expect(t.table[1]![5]).toBeCloseTo(0.5354409456024605, 12);
  });
});
