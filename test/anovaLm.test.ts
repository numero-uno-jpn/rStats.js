// lm and aov from a formula, anova(fit), summary(aov(...)) and anova(fit1, fit2, ...) against R (oracle/anovalm.R)
import { describe, expect, it } from "vitest";
import { anova, aov, aovSummary, lm, type ContrastName, type LmFormulaOptions, type LmFormulaResult } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { collectWarnings, Comparison, dataFrameOf, loadAnovaFixture, type FixtureTable, type KnownDifference } from "./helpers/anova.js";

const PERFECT = "ANOVA F-tests on an essentially perfect fit are unreliable";

/** Cells that differ from R by more than 1e-12 but are within 1e-12 of the exact reference */
const BIG_MEAN = "y has a mean of 1e6: R's QR loses digits to the intercept; rStats.js computes in double-double";
const KNOWN: KnownDifference[] = [
  // a small coefficient (-0.0058, the others up to 9.6) of R's double-precision QR: R 4.6.2 1.02e-12 from the exact
  // reference (R 4.5.2: 9.0e-13), rStats.js at the reference
  { case: 30, table: "coefficients", row: "Ac:Bq", col: "", reason: "a small coefficient: R's QR 1.0e-12 from the reference" },
  { case: 50, table: "coefficients", row: "Ab:Bq", col: "", reason: `${BIG_MEAN} (R 3.3e-12 from the reference)` },
  { case: 50, table: "coefficients", row: "Ac:Bq", col: "", reason: `${BIG_MEAN} (R 1.5e-11 from the reference)` },
  { case: 50, table: "rSquared", row: "rSquared", col: "", reason: `${BIG_MEAN} (R 2.8e-12 from the reference)` },
  { case: 50, table: "adjRSquared", row: "adjRSquared", col: "", reason: `${BIG_MEAN} (R 4.0e-12 from the reference)` },
  // y ~ A against y ~ B (two different factors): neither model is a special case of the other, so no F test (R gives
  // F 11.10, p 0.0033)
  { case: 61, table: "compare", row: "2", col: "F", reason: "models not nested: no F test (R tests any pair)", value: NaN },
  { case: 61, table: "compare", row: "2", col: "Pr(>F)", reason: "models not nested: no F test (R tests any pair)", value: NaN },
];

const fixture = loadAnovaFixture("anovaLm");

describe("anovaLm", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const data = dataFrameOf(a.data, a.dataTypes);
      const options: LmFormulaOptions = {
        ...(a.contrasts === undefined ? {} : { contrasts: a.contrasts as Record<string, ContrastName> }),
        ...(a.weights === undefined ? {} : { weights: a.weights as string }),
      };
      const e = c.expected;
      let out;
      try {
        const fit = lm(a.formula as string, data, options);
        const tab = anova(fit);
        const av = aov(a.formula as string, data, options) as LmFormulaResult;
        const avs = aovSummary(av);
        const compare = a.compare === undefined ? undefined : ([] as string[]).concat(a.compare as string | string[]);
        const others = compare?.map((f) => lm(f, data, options));
        const cmpTab = others === undefined ? undefined : anova(fit, ...others);
        out = { fit, tab, av, avs, others, cmpTab };
      } catch (err) {
        const msg = (err as Error).message;
        if (e.error === undefined) return cmp.fail(index, "(exception)", "result", msg);
        errors++;
        if (msg !== e.error) cmp.fail(index, "error", e.error, msg);
        return;
      }
      if (e.error !== undefined) return cmp.fail(index, "(exception)", e.error, "no exception thrown");
      const { fit, tab, av, avs, others, cmpTab } = out;
      const perfect = (e.warnings as string[]).includes(PERFECT);
      cmp.strings(index, "coefNames", e.coefNames, fit.coefNames);
      const ref = c.reference as (Record<string, FixtureTable> & Record<string, unknown>) | undefined;
      const refCoef = ref?.coefficients === undefined ? undefined : ([] as string[]).concat(ref.coefficients as unknown as string[]).map(num);
      const maxCoef = refCoef?.reduce((m, v) => (Number.isFinite(v) ? Math.max(m, Math.abs(v)) : m), 0);
      const rmsY = Math.sqrt(fit.y.reduce((s, v) => s + v * v, 0) / fit.y.length);
      cmp.numbers(index, "coefficients", e.coefficients, fit.coefficients, ref?.coefficients, fit.coefNames, maxCoef);
      cmp.numbers(index, "dfResidual", e.dfResidual, fit.dfResidual);
      cmp.numbers(index, "sigma", e.sigma, fit.sigma, ref?.sigma, ["sigma"], rmsY);
      cmp.numbers(index, "rSquared", e.rSquared, fit.rSquared, ref?.rSquared, ["rSquared"]);
      cmp.numbers(index, "adjRSquared", e.adjRSquared, fit.adjRSquared, ref?.adjRSquared, ["adjRSquared"]);
      cmp.table(index, "anova", e.anova as FixtureTable, tab, ref?.anova, perfect);
      // summary(aov) has the cells of the anova table (without the Residuals row and the tests when its df is 0), so it
      // is checked against the anova reference, and the perfect-fit exception of the anova table applies to it too
      const refAov =
        ref?.anova === undefined || fit.dfResidual > 0 ? ref?.anova : { table: ref.anova.table.slice(0, -1).map((r) => r.slice(0, 3)) };
      cmp.table(index, "aov", e.aov as FixtureTable, avs, refAov, perfect);
      if (cmpTab !== undefined) cmp.table(index, "compare", e.compare as FixtureTable, cmpTab, ref?.compare, false);
      const warnings = collectWarnings(fit.warnings, tab.warnings, av.warnings, avs.warnings, ...(others ?? []).map((f) => f.warnings), cmpTab?.warnings);
      cmp.strings(index, "warnings", e.warnings, warnings);
    });
    console.log(cmp.summary("anovaLm", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
});

describe("formula interface", () => {
  const data = {
    y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4, 6.6, 7.0],
    z: [1, 3, 2, 5, 4, 6, 8, 7],
    g: ["a", "a", "b", "b", "c", "c", "a", "b"],
    id: ["s1", "s1", "s2", "s2", "s3", "s3", "s4", "s4"],
  };
  it("aov(x, g) is the fit of y ~ g, and the matrix lm(x, y) stays", () => {
    const r = aov([4.2, 5.1, 6.3, 5.8, 7.9, 8.4], ["a", "a", "b", "b", "c", "c"]);
    expect(r.formula).toBe("y ~ g");
    expect(r.coefNames).toEqual(["(Intercept)", "gb", "gc"]);
    expect(aovSummary(r).table.map((row) => row[0])).toEqual([2, 3]);
    const f = lm([1, 2, 3, 4], [2.1, 3.9, 6.2, 7.8]);
    expect(f.coefficients.length).toBe(2);
  });
  it("gives the same fit for aov(x, g) as aov(formula)", () => {
    const one = aov(data.y, data.g);
    const t = aovSummary(aov("y ~ g", data) as LmFormulaResult);
    expect(t.rowNames).toEqual(["g", "Residuals"]);
    expect(aovSummary(one)).toEqual(t);
    expect(one.coefficients).toEqual((aov("y ~ g", data) as LmFormulaResult).coefficients);
  });
  it("names the levels of aov(x, g) by the labels in R's order, or by the positions of the samples", () => {
    expect(aov([5, 4, 6, 7, 8, 9], [10, 10, 2, 2, 1, 1]).coefNames).toEqual(["(Intercept)", "g2", "g10"]);
    // an empty sample has no level, as in TukeyHSD
    expect(aov([[], [1, 2], [3, 5], [NaN, 4, 6]]).coefNames).toEqual(["(Intercept)", "g3", "g4"]);
    expect(() => aov([[1, 2, 3]])).toThrow(RangeError);
  });
  it("accepts one Error() term in aov only", () => {
    expect((aov("y ~ g + Error(id)", data) as { multistratum?: boolean }).multistratum).toBe(true);
    expect(() => aov("y ~ g + Error(id) + Error(g)", data)).toThrow("there are 2 Error terms: only 1 is allowed");
    expect(() => lm("y ~ g + Error(id)", data)).toThrow(/^invalid formula/);
  });
  it("leaves out models with another response, with R's warning", () => {
    const t = anova(lm("y ~ g", data), lm("z ~ g", data));
    expect(t.warnings).toEqual(["models with response \u2018z\u2019 removed because response differs from model 1"]);
    expect(t.rowNames).toEqual(["g", "Residuals"]);
  });
  it("rejects unsupported formulas", () => {
    for (const f of ["y ~ log(z)", "y ~ `g`", "y ~ g +", "y ~ 2"]) expect(() => lm(f, data)).toThrow(/^invalid formula/);
  });
  it("gives plain results", () => {
    const fit = lm("y ~ g * z", data, { weights: "z" });
    expect(JSON.parse(JSON.stringify(fit)).coefNames).toEqual(fit.coefNames);
  });
});
