// Fixes of the 35th review round (review_fix_log_20261031_35.md): aov with Error() and a covariate of a large scale;
// the fit's warnings carried to aovSummary and the effect sizes.
import { describe, expect, it } from "vitest";
import { aov, aovSummary, etaSquared, omegaSquared } from "../src/index.js";

const y = [5.1, 6.3, 5.8, 7.2, 6.9, 8.1, 7.4, 8.8, 6.0, 7.7, 6.5, 9.0, 5.5, 7.0, 6.2, 8.4, 7.9, 9.3];
const id = Array.from({ length: 18 }, (_, i) => String(Math.floor(i / 3) + 1));
const W = Array.from({ length: 18 }, (_, i) => ["a", "b", "c"][i % 3]!);
const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3];
type Summary = { strata: { stratum: string; rowNames: string[]; table: number[][] }[]; warnings: string[] };

describe("review 35", () => {
  it("a covariate around 1e200 stays in its strata (it was dropped from every one)", () => {
    const s1 = aovSummary(aov("y ~ x + W + Error(id)", { y, id, W, x }) as never) as unknown as Summary;
    const s2 = aovSummary(aov("y ~ x + W + Error(id)", { y, id, W, x: x.map((v) => v * 1e200) }) as never) as unknown as Summary;
    expect(s2.strata.map((s) => s.rowNames)).toEqual([["x", "Residuals"], ["x", "W", "Residuals"]]);
    s2.strata.forEach((st, i) =>
      st.table.flat().forEach((v, j) => {
        const e = s1.strata[i]!.table.flat()[j]!;
        if (Number.isNaN(e)) expect(v).toBeNaN();
        else expect(Math.abs(v - e)).toBeLessThanOrEqual(1e-13 * Math.max(1, Math.abs(e)));
      }),
    );
    // R 4.5.2: x's F 0.317 in the id stratum and 0.724 within
    expect(s2.strata[0]!.table[0]![3]).toBeCloseTo(0.31748383504891664, 12);
    expect(s2.strata[1]!.table[0]![3]).toBeCloseTo(0.7242836256997102, 12);
  });
  it("the fit's warnings are carried to aovSummary and the effect sizes", () => {
    // id nested in g: the columns of g lie in the span of those of id, so the Error() model is singular
    const g = id.map((v) => (Number(v) <= 3 ? "x" : "y"));
    const fit = aov("y ~ W + Error(id + g)", { y, id, W, g }) as unknown as { warnings: string[] };
    expect(fit.warnings).toContain("Error() model is singular");
    expect((aovSummary(fit as never) as unknown as Summary).warnings).toContain("Error() model is singular"); // was []
    expect(etaSquared(fit as never).warnings).toContain("Error() model is singular");
    expect(omegaSquared(aovSummary(fit as never) as never).warnings).toContain("Error() model is singular");
  });
});
