// The aliases of the result fields named after R or a package (pvalue, p, P, Z, se, t, pAdj, stdErr, Fvalue): pValue,
// pAdjusted, zValue, tValue, stdError and fValue are ordinary enumerable fields with the same values.
import { describe, expect, it } from "vitest";
import { coxph, dunnTest, glhtDunnett, icc, survdiff, survfit, tTest, TukeyHSD } from "../src/index.js";

const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
const ratings = [[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]];

/** Each alias is an own enumerable field equal to the field it names */
function expectAliases(r: object, pairs: Record<string, string>): void {
  const o = r as Record<string, unknown>;
  for (const [alias, name] of Object.entries(pairs)) {
    expect(Object.keys(o), alias).toContain(alias);
    expect(o[name], name).toBeDefined();
    expect(o[alias], alias).toEqual(o[name]);
  }
}

describe("result aliases", () => {
  it("survdiff and survfit", () => {
    expectAliases(survdiff([1, 2, 3, 4, 5, 6], [1, 1, 0, 1, 1, 1], ["a", "b", "a", "b", "a", "b"]), { pValue: "pvalue" });
    expectAliases(survfit([1, 2, 2, 3, 4, 5], [1, 1, 0, 1, 0, 1], { group: ["a", "b", "a", "b", "a", "b"] }), { stdError: "stdErr" });
  });

  it("coxph, also without events", () => {
    const covariates = [[1.2], [0.3], [-0.5], [2], [0.7], [0.1]];
    const pairs = { stdError: "se", zValue: "z", pValue: "p" };
    expectAliases(coxph([5, 3, 8, 1, 9, 4], [1, 1, 0, 1, 0, 1], covariates), pairs);
    expectAliases(coxph([5, 3, 8, 1, 9, 4], [0, 0, 0, 0, 0, 0], covariates), pairs);
  });

  it("glhtDunnett, dunnTest and TukeyHSD", () => {
    expectAliases(glhtDunnett(x, g), { stdError: "se", tValue: "t", pValue: "p" });
    expectAliases(dunnTest(x, g, { method: "bonferroni" }), { zValue: "Z", pValue: "P", pAdjusted: "PAdjusted" });
    expectAliases(TukeyHSD(x, g), { pAdjusted: "pAdj" });
  });

  it("tTest and icc", () => {
    expectAliases(tTest(x), { stdError: "stdErr" });
    expectAliases(tTest(x.slice(0, 4), x.slice(4)), { stdError: "stdErr" });
    expectAliases(icc(ratings), { fValue: "Fvalue" });
    expectAliases(icc(ratings, { model: "twoway", type: "agreement" }), { fValue: "Fvalue" });
  });
});
