// lm and aov from a formula, anova(fit), summary(aov(...)) and anova(fit1, fit2, ...) against R (oracle/anovalm.R)
import { describe, expect, it } from "vitest";
import { anova, aov, aovSummary, lm, type ContrastName, type LmFormulaOptions } from "../src/index.js";
import { collectWarnings, Comparison, dataFrameOf, loadAnovaFixture, type FixtureTable, type KnownDifference, type Unresolved } from "./helpers/anova.js";

// character columns whose values look like numbers (tg$dose in oracle/anovalm.R)
const CHARACTER = ["dose"];

const PERFECT = "ANOVA F-tests on an essentially perfect fit are unreliable";

/** Cells that differ from R by more than 1e-12 but are within 1e-12 of the exact reference */
const KNOWN: KnownDifference[] = [];

/**
 * Values outside the tables that differ from R by more than 1e-12 and have no reference in the fixture (see
 * Unresolved in test/helpers/anova.ts). In each, R's value carries R's rounding error and rStats.js's is the exact
 * least squares value (checked by hand with exact rational arithmetic on the fixture's data, outside this test).
 */
const PERFECT_FIT = "perfect fit (y exactly additive): the exact value is 0, R's is rounding residue (about 1e-15)";
const BIG_MEAN = (r: string) => `y has a mean of 1e6: R's value has a relative error of ${r}, rStats.js's is exact to 1e-15`;
const UNRESOLVED: Unresolved[] = [
  { case: 38, value: "coefficients[4]", reason: PERFECT_FIT },
  { case: 38, value: "coefficients[5]", reason: PERFECT_FIT },
  { case: 38, value: "sigma[0]", reason: PERFECT_FIT },
  { case: 39, value: "coefficients[4]", reason: PERFECT_FIT },
  { case: 39, value: "coefficients[5]", reason: PERFECT_FIT },
  { case: 39, value: "sigma[0]", reason: PERFECT_FIT },
  { case: 40, value: "sigma[0]", reason: PERFECT_FIT },
  { case: 45, value: "coefficients[4]", reason: BIG_MEAN("3.3e-12") },
  { case: 45, value: "coefficients[5]", reason: BIG_MEAN("1.5e-11") },
  { case: 45, value: "rSquared[0]", reason: BIG_MEAN("2.8e-12") },
  { case: 45, value: "adjRSquared[0]", reason: BIG_MEAN("4.0e-12") },
];

const fixture = loadAnovaFixture("anovaLm");

describe("anovaLm", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN, UNRESOLVED);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const data = dataFrameOf(a.data, CHARACTER);
      const options: LmFormulaOptions = {
        ...(a.contrasts === undefined ? {} : { contrasts: a.contrasts as Record<string, ContrastName> }),
        ...(a.weights === undefined ? {} : { weights: a.weights as string }),
      };
      const e = c.expected;
      let out;
      try {
        const fit = lm(a.formula as string, data, options);
        const tab = anova(fit);
        const av = aov(a.formula as string, data, options);
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
      cmp.numbers(index, "coefficients", e.coefficients, fit.coefficients);
      cmp.numbers(index, "dfResidual", e.dfResidual, fit.dfResidual);
      cmp.numbers(index, "sigma", e.sigma, fit.sigma);
      cmp.numbers(index, "rSquared", e.rSquared, fit.rSquared);
      cmp.numbers(index, "adjRSquared", e.adjRSquared, fit.adjRSquared);
      const ref = c.reference as Record<string, FixtureTable> | undefined;
      cmp.table(index, "anova", e.anova as FixtureTable, tab, ref?.anova, perfect);
      // summary(aov) has the cells of the anova table (without the Residuals row and the tests when its df is 0)
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
  it("keeps the one-way aov(x, g) and the matrix lm(x, y)", () => {
    const r = aov([4.2, 5.1, 6.3, 5.8, 7.9, 8.4], ["a", "a", "b", "b", "c", "c"]);
    expect(r.df).toEqual([2, 3]);
    const f = lm([1, 2, 3, 4], [2.1, 3.9, 6.2, 7.8]);
    expect(f.coefficients.length).toBe(2);
  });
  it("gives the same table for aov(formula) as the one-way aov", () => {
    const one = aov(data.y, data.g);
    const t = aovSummary(aov("y ~ g", data));
    expect(t.rowNames).toEqual(["g", "Residuals"]);
    expect(t.table[0]![3]).toBeCloseTo(one.fValue, 12);
  });
  it("rejects Error() terms for now, and more than one of them", () => {
    expect(() => aov("y ~ g + Error(id)", data)).toThrow("not implemented yet");
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
