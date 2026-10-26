// glm with summary, residuals, influence measures and predict against R (oracle/glm.R)
import {
  glm,
  glmAnova,
  glmCooksDistance,
  glmHatvalues,
  glmPredict,
  glmResiduals,
  glmRstandard,
  glmSummary,
  type GlmResult,
} from "../src/index.js";
import { makeFamily } from "../src/models/glmFamily.js";
import { describe, expect, it } from "vitest";
import { devianceScale, devianceScales, glmArgs } from "./helpers/glm.js";
import { num } from "./helpers/fixture.js";
import { arg, defined, htestSuite, loadHTestFixture, type HTestCase } from "./helpers/htest.js";

function run(a: HTestCase["args"]): Record<string, unknown> {
  const { x, y, options } = glmArgs(a);
  const fit = glm(x, y, options);
  const s = glmSummary(fit);
  const warnings = [...fit.warnings];
  for (const m of s.warnings) if (!warnings.includes(m)) warnings.push(m);
  const out: Record<string, unknown> = {
    coefficients: fit.coefficients,
    fittedValues: fit.fittedValues,
    linearPredictors: fit.linearPredictors,
    deviance: fit.deviance,
    nullDeviance: fit.nullDeviance,
    aic: fit.aic,
    rank: fit.rank,
    dfResidual: fit.dfResidual,
    dfNull: fit.dfNull,
    iter: fit.iter,
    converged: fit.converged,
    boundary: fit.boundary,
    devianceResiduals: glmResiduals(fit, "deviance"),
    pearsonResiduals: glmResiduals(fit, "pearson"),
    workingResiduals: glmResiduals(fit, "working"),
    responseResiduals: glmResiduals(fit, "response"),
    dispersion: s.dispersion,
    estimate: s.estimate,
    stdError: s.stdError,
    statistic: s.statistic,
    pValue: s.pValue,
    statisticName: s.statisticName,
    covUnscaled: s.covUnscaled,
    hatvalues: glmHatvalues(fit),
    rstandard: glmRstandard(fit),
    cooksDistance: glmCooksDistance(fit),
    seLink: glmPredict(fit, { type: "link" }).seFit,
    seResponse: glmPredict(fit, { type: "response" }).seFit,
    warnings,
  };
  const nd = arg.mat(a.newdata);
  if (nd !== undefined) {
    const no = arg.vec(a.newoffset);
    const pl = glmPredict(fit, defined({ newdata: nd, newoffset: no, type: "link" as const }));
    const pr = glmPredict(fit, defined({ newdata: nd, newoffset: no, type: "response" as const }));
    Object.assign(out, { predictLink: pl.fit, newSeLink: pl.seFit, predictResponse: pr.fit, newSeResponse: pr.seFit });
  }
  return out;
}

const EPS = 2 ** -52;
const fixture = loadHTestFixture("glm");

/** The fixture case of the arguments the suite passes (its own copy of the fixture) */
const byArgs = new Map(fixture.cases.map((c) => [JSON.stringify(c.args), c]));
const cases = new WeakMap<HTestCase["args"], HTestCase>();
function caseOf(a: HTestCase["args"]): HTestCase {
  let c = cases.get(a);
  if (c === undefined) {
    c = byArgs.get(JSON.stringify(a))!;
    cases.set(a, c);
  }
  return c;
}

/** The fit of a case (cached) */
const fits = new WeakMap<HTestCase["args"], GlmResult>();
function fitOf(a: HTestCase["args"]): GlmResult {
  let f = fits.get(a);
  if (f === undefined) {
    const { x, y, options } = glmArgs(a);
    f = glm(x, y, options);
    fits.set(a, f);
  }
  return f;
}

/**
 * Per-value floors for the comparison (|difference| / max(|R's value|, floor)):
 * - The residuals cancel in y - mu when the model fits well (glm-behaviour.md, "Measurements"): y - mu is known to about
 *   eps max(|y|, |mu|), so the response residuals are compared relative to max(|y|, |mu|), and the working, Pearson
 *   and standardized residuals relative to the same scaled as they are (1 / |d mu/d eta|, sqrt(w / V(mu)),
 *   1 / sqrt(dispersion (1 - h))).
 * - Deviance residuals are sign(y - mu) sqrt(d) with d known to eps times its rounding scale (devianceScales in
 *   test/helpers/glm.ts: the logarithms of y / mu near 1 are known to an absolute eps), so r = sqrt(d) is known to
 *   eps times that scale divided by 2 |r|; the deviance to eps times the sum of the scales. Cook's distances, squares
 *   of Pearson residuals, have twice their relative error.
 * - The linear predictor is a sum x'b + offset that cancels when it is near 0: it is compared relative to
 *   sum |x_j b_j| + |offset|.
 */
function residualFloors(c: HTestCase): Record<string, number[]> {
  const fit = fitOf(c.args);
  const fam = makeFamily(fit.model.familySpec);
  const { y, fittedValues: mu, priorWeights: w, linearPredictors: eta } = fit;
  const resp = y.map((v, i) => Math.max(Math.abs(v), Math.abs(mu[i]!)));
  const pearsonScale = mu.map((m, i) => Math.sqrt(w[i]! / fam.variance(m)));
  const pearson = resp.map((r, i) => r * pearsonScale[i]!);
  // r = sqrt(d) is known to eps scale / (2 |r|)
  const devR = (c.expected.devianceResiduals as string[]).map(num);
  const dScale = devianceScales(fit);
  const deviance = devR.map((r, i) => Math.max(pearson[i]!, dScale[i]! / (2 * Math.abs(r))));
  const keep = (v: number[]) => v.filter((_, i) => w[i]! > 0);
  const h = glmHatvalues(fit);
  const disp = glmSummary(fit).dispersion;
  const stdScale = h.map((hi) => 1 / Math.sqrt(disp * (1 - hi)));
  const pearsonR = keep((c.expected.pearsonResiduals as string[]).map(num));
  const cooksR = ((c.expected.cooksDistance ?? []) as string[]).map(num);
  const lp = (rows: number[][], off: number[]) =>
    rows.map((r, i) => r.reduce((s, v, j) => (Number.isNaN(fit.coefficients[j]!) ? s : s + Math.abs(v * fit.coefficients[j]!)), 0) + Math.abs(off[i]!));
  const floors: Record<string, number[]> = {
    responseResiduals: resp,
    workingResiduals: resp.map((r, i) => r / Math.abs(fam.muEta(eta[i]!))),
    pearsonResiduals: pearson,
    devianceResiduals: deviance,
    rstandard: keep(deviance).map((v, i) => v * stdScale[i]!),
    cooksDistance: keep(pearson).map((f, i) => 2 * Math.abs(cooksR[i]!) * Math.max(1, f / Math.abs(pearsonR[i]!))),
    linearPredictors: lp(fit.model.x, fit.model.offset),
    deviance: [devianceScale(fit)],
  };
  const nd = arg.mat(c.args.newdata);
  if (nd !== undefined) {
    const rows = nd.map((r) => (fit.model.intercept ? [1, ...r] : r));
    floors.predictLink = lp(rows, arg.vec(c.args.newoffset) ?? rows.map(() => 0));
  }
  return floors;
}

const floor = Object.fromEntries(
  ["responseResiduals", "workingResiduals", "pearsonResiduals", "devianceResiduals", "rstandard", "cooksDistance", "linearPredictors", "predictLink", "deviance"].map(
    (f) => [f, (c: HTestCase) => residualFloors(c)[f] ?? 0],
  ),
);

htestSuite({
  name: "glm",
  call: run,
  tolerance: 1e-12,
  floor,
  knownDifference: (a, field, expected, actual) => {
    const fit = fitOf(a);
    const c = caseOf(a);
    const err = Math.abs(actual - expected) / Math.abs(expected);
    const yv = fit.y;
    // a perfect fit: R's deviance is rounding residue (here |y - mu| <= 4 eps |y|), and so is the gaussian AIC, which
    // is n log of it
    if (fit.dfResidual === 0 && field === "aic") {
      const muR = (c.expected.fittedValues as string[]).map(num);
      if (muR.every((m, i) => Math.abs(yv[i]! - m) <= 4 * EPS * Math.abs(yv[i]!))) return "perfect fit: the AIC is n log of a deviance that is rounding residue";
    }
    // fitted means near the end of their range: mu (or 1 - mu for the binomial families) is the result of a
    // cancellation and known only to the relative condition number kappa = max (sum |x_j b_j| + |offset|)
    // |d mu/d eta| / distance of mu to the end of its range; agreement to 4 eps kappa
    const fam = makeFamily(fit.model.familySpec);
    const binomialLike = ["binomial", "quasibinomial"].includes(fam.family) || fam.varianceName === "mu(1-mu)";
    if (fam.family !== "gaussian" && fam.varianceName !== "constant" && !fit.warnings.includes("glm.fit: fitted probabilities numerically 0 or 1 occurred")) {
      let kappa = 0;
      fit.model.x.forEach((r, i) => {
        const s = r.reduce((t, v, j) => (Number.isNaN(fit.coefficients[j]!) ? t : t + Math.abs(v * fit.coefficients[j]!)), 0) + Math.abs(fit.model.offset[i]!);
        const m = fit.fittedValues[i]!;
        const dist = binomialLike ? Math.min(m, 1 - m) : Math.abs(m);
        kappa = Math.max(kappa, (s * Math.abs(fam.muEta(fit.linearPredictors[i]!))) / dist);
      });
      if (kappa > 1e6 && err <= 4 * EPS * kappa) return "fitted means near the end of their range: agreement to 4 eps times their condition number";
    }
    // separation: the estimate is at infinity and the coefficients are where the iterations stopped; their
    // differences from R (accumulated over the iterations) move the linear predictor by delta, and the weights
    // exp(-|eta|) and what follows from them by a relative 4 delta
    if (fit.warnings.includes("glm.fit: fitted probabilities numerically 0 or 1 occurred")) {
      const etaR = (c.expected.linearPredictors as string[]).map(num);
      const delta = Math.max(...etaR.map((e, i) => Math.abs(e - fit.linearPredictors[i]!)));
      if (err <= 4 * delta) return "separation: agreement to 4 times the difference of the linear predictors";
    }
    return undefined;
  },
});

describe("glm errors", () => {
  it("throws R's error messages", () => {
    const errors = fixture.cases.filter((c) => c.expected.error !== undefined);
    expect(errors.length).toBeGreaterThan(0);
    for (const c of errors) expect(() => run(c.args)).toThrow(c.expected.error as string);
  });
});

describe("glm behaviour not covered by the fixtures", () => {
  const x = [[1], [2], [3], [4], [5], [6]];
  const y = [1.2, 2.3, 2.9, 4.1, 5.2, 5.8];

  it("names power links as R does (lambda <= 0 is the log link, 1 the identity)", () => {
    expect(glm(x, y, { family: "quasi", link: { power: 1 / 3 } }).link).toBe("mu^0.333");
    expect(glm(x, y, { family: "quasi", link: { power: -0.5 } }).link).toBe("log");
    expect(glm(x, y, { family: "quasi", link: { power: 1 } }).link).toBe("identity");
    expect(() => glm(x, y, { family: "quasi", link: "cauchit" })).toThrow(/not available for quasi family/);
  });

  it("takes every named link in every family; the logit link rejects a mean outside [0, 1] as R's does", () => {
    expect(() => glm(x, y, { family: "poisson", link: "logit" })).toThrow("Value 1.3 out of range (0, 1)");
    expect(() => glm(x, [0.5, -0.25, 0.3, 0.2, 0.1, 0.4], { link: "logit" })).toThrow("Value -0.25 out of range (0, 1)");
    expect(() => glm(x, [0.5, 1234567, 0.3, 0.2, 0.1, 0.4], { link: "logit" })).toThrow("Value 1.23457e+06 out of range (0, 1)");
    expect(() => glm(x, [0.5, 1.0000001, 0.3, 0.2, 0.1, 0.4], { link: "logit" })).toThrow("Value 1 out of range (0, 1)");
    expect(() => glm(x, y, { family: "Gamma", link: "foo" as "log" })).toThrow("\u2018foo\u2019 link not recognised");
    expect(glm(x, y, { family: "Gamma", link: "sqrt" }).link).toBe("sqrt");
  });

  it("fits a model without columns from the offset", () => {
    const offset = y.map(() => Math.log(3));
    const fit = glm(x.map(() => []), [2, 3, 4, 1, 3, 5], { family: "poisson", intercept: false, offset });
    expect([fit.rank, fit.iter, fit.converged, fit.boundary, fit.coefficients.length]).toEqual([0, 0, true, true, 0]);
    expect(fit.warnings).toEqual([]);
    expect(fit.fittedValues.every((m) => Math.abs(m - 3) < 1e-15)).toBe(true);
    expect(fit.dfResidual).toBe(6);
  });

  it("reads a one-column matrix as a vector and rejects other shapes of a binomial response", () => {
    const yb = [0, 0, 1, 0, 1, 1];
    expect(glm(x, yb.map((v) => [v]), { family: "binomial" }).coefficients).toEqual(glm(x, yb, { family: "binomial" }).coefficients);
    expect(() => glm(x, yb.map((v) => [v, 1, 1]), { family: "binomial" })).toThrow(
      "for the 'binomial' family, y must be a vector of 0 and 1's\nor a 2 column matrix where col 1 is no. successes and col 2 is no. failures",
    );
  });

  it("anova refuses fits of different sizes", () => {
    const a = glm(x, y);
    const b = glm(x.slice(1), y.slice(1));
    expect(() => glmAnova([a, b])).toThrow("models were not all fitted to the same size of dataset");
  });
});
