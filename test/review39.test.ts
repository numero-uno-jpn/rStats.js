// Fixes of the 39th review round (review_fix_log_20261031_39.md): the warnings of an lm fit are carried to anova,
// Anova, aovSummary and the effect sizes, as for aov with Error() (R gives them when fitting only).
import { describe, expect, it } from "vitest";
import { anova, Anova, aov, aovSummary, etaSquared, lm } from "../src/index.js";

const d = { y: [1.2, 2.3, 2.9, 4.1, 5.2, 5.8, 7.1, 8.3], x: [1, 2, 3, 4, 5, 6, 7, 8], z: [3, 1, 4, 1, 5, 9, 2, 6] };
const ABSENT = "variable 'B' is absent, its contrast will be ignored";

describe("review 39", () => {
  it("the fit's warnings appear in anova, Anova, aovSummary and the effect sizes, once each", () => {
    const fit = lm("y ~ x + z", d, { contrasts: { B: "contr.sum" } });
    expect(fit.warnings).toContain(ABSENT);
    expect(anova(fit).warnings).toEqual([ABSENT]); // was []
    expect(Anova(fit).warnings).toEqual([ABSENT]); // was []
    expect(etaSquared(fit).warnings).toEqual([ABSENT]); // was []
    const av = aov("y ~ x + z", d, { contrasts: { B: "contr.sum" } });
    expect(aovSummary(av as never).warnings).toEqual([ABSENT]); // was []
    // a comparison: the warnings of all fits, once
    const other = lm("y ~ x", d, { contrasts: { B: "contr.sum" } });
    expect(anova(other, fit).warnings).toEqual([ABSENT]);
    // without warnings: unchanged
    expect(anova(lm("y ~ x", d)).warnings).toEqual([]);
  });
});
