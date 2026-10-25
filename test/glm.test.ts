// glm with summary, residuals, influence measures and predict against R (oracle/glm.R)
import { glm, glmAnova, glmConfint, glmInfluence, glmPredict, glmResiduals, glmSummary } from "../src/index.js";
import { describe, expect, it } from "vitest";
import { fitCase } from "./helpers/glm.js";
import { arg, defined, htestSuite, loadHTestFixture, type HTestArg } from "./helpers/htest.js";

const PERFECT_FIT_FIELDS = new Set([
  "deviance", "aic", "dispersion", "devianceResiduals", "pearsonResiduals", "workingResiduals", "responseResiduals", "rstandard", "cooksDistance",
]);
const SQUARE_ROOT_FIELDS = new Set(["devianceResiduals", "rstandard", "seLink", "seResponse", "newSeLink", "newSeResponse"]);

interface CaseInfo {
  fit: ReturnType<typeof glm>;
  /** sum_j |x_ij b_j| + |offset_i| for each row */
  etaScale: number[];
  /** distance of the fitted means from the end of their range */
  boundaryDistance: number;
  /** largest square of R's values of a field */
  maxSquare: (field: string) => number;
}
const infos = new WeakMap<object, CaseInfo>();
let expectedOf: (a: object) => Record<string, unknown> = () => ({});

function caseInfo(a: Record<string, HTestArg>): CaseInfo {
  let info = infos.get(a);
  if (info !== undefined) return info;
  const fit = fitCase(a);
  const b = fit.coefficients.map((v) => (Number.isNaN(v) ? 0 : v));
  const etaScale = fit.modelMatrix.map((r, i) => r.reduce((s, v, j) => s + Math.abs(v * b[j]!), 0) + Math.abs(fit.offset?.[i] ?? 0));
  const binomial = fit.family.family === "binomial" || fit.family.family === "quasibinomial";
  const boundaryDistance = Math.min(...fit.fittedValues.map((m) => (binomial ? Math.min(m, 1 - m) : Math.abs(m))));
  const expected = expectedOf(a);
  const maxSquare = (field: string): number => {
    const v = expected[field];
    const vals = (Array.isArray(v) ? v : [v]).map((s) => Number(s)).filter(Number.isFinite);
    return Math.max(...vals.map((x) => x * x));
  };
  info = { fit, etaScale, boundaryDistance, maxSquare };
  infos.set(a, info);
  return info;
}
{
  const cases = loadHTestFixture("glm").cases;
  const byArgs = new Map(cases.map((c) => [JSON.stringify(c.args), c.expected]));
  expectedOf = (a) => byArgs.get(JSON.stringify(a)) ?? {};
}

htestSuite({
  name: "glm",
  call: (a) => {
    const fit = fitCase(a);
    const s = glmSummary(fit);
    const infl = glmInfluence(fit);
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
      ...s.coefTable,
      statisticName: s.statisticName,
      covUnscaled: s.covUnscaled,
      hatvalues: infl.hatvalues,
      rstandard: infl.rstandard,
      cooksDistance: infl.cooksDistance,
      seLink: glmPredict(fit).seFit,
      seResponse: glmPredict(fit, undefined, { type: "response" }).seFit,
      warnings: [...new Set([...fit.warnings, ...s.warnings])],
    };
    const nd = arg.mat(a.newdata);
    if (nd !== undefined) {
      const offset = fit.offset !== undefined ? (arg.vec(a.newoffset) ?? nd.map(() => 0)) : undefined;
      const pl = glmPredict(fit, nd, defined({ type: "link" as const, offset }));
      const pr = glmPredict(fit, nd, defined({ type: "response" as const, offset }));
      Object.assign(out, { predictLink: pl.fit, newSeLink: pl.seFit, predictResponse: pr.fit, newSeResponse: pr.seFit });
    }
    return out;
  },
  tolerance: 1e-12,
  knownDifference: (a, field, expected, actual, k) => {
    const info = caseInfo(a);
    const fit = info.fit;
    // a perfect fit (zero residual degrees of freedom): the residuals and the deviance are rounding residue, in R as here
    if (fit.deviance <= 1e-20 * Math.max(1, fit.nullDeviance) && PERFECT_FIT_FIELDS.has(field)) {
      return "perfect fit: the residuals and the deviance are rounding residue";
    }
    // square roots of sums that cancel (deviance contributions near 0, variances of predictions near 0): the rounding
    // error of the sum is divided by the square root, so they are compared as squares, normwise over the field
    if (SQUARE_ROOT_FIELDS.has(field)) {
      const scale = info.maxSquare(field);
      if (Math.abs(actual * Math.abs(actual) - expected * Math.abs(expected)) <= 1e-12 * scale) {
        return "square root of a cancelling sum near 0: agrees as a square (relative to the largest in the field)";
      }
    }
    // Cook's distance is proportional to a squared residual (y - mu)^2, which cancels: compared as its square root
    if (field === "cooksDistance" && Math.abs(Math.sqrt(actual) - Math.sqrt(expected)) <= 1e-12 * Math.sqrt(info.maxSquare(field)) ** 0.5) {
      return "Cook's distance near 0 (a squared residual that cancels): agrees as a square root (relative to the largest in the field)";
    }
    // eta = x'b near 0 cancels: compared relative to the size of its terms
    if (field === "linearPredictors" && Math.abs(actual - expected) <= 1e-12 * info.etaScale[k]!) {
      return "linear predictor near 0: agrees relative to its terms |x_ij b_j|";
    }
    // R stops at the boundary of the valid range: a fitted mean within d of the end of its range is determined only to
    // eps / d relative, and so is everything that depends on that distance
    if (fit.boundary && Math.abs(actual - expected) <= (1e-14 / info.boundaryDistance) * Math.abs(expected)) {
      return "stopped at the boundary: quantities depending on a mean close to the end of its range (eps / distance)";
    }
    // separation: the estimates go to infinity and R's are where its iterations stop; the coefficients agree to 1e-10
    // and the weights, which depend on exp(-|eta|), to |eta| times that
    if (fit.warnings.includes("glm.fit: fitted probabilities numerically 0 or 1 occurred") && Math.abs(actual - expected) <= 1e-8 * Math.abs(expected)) {
      return "separation (fitted probabilities 0 or 1): estimates at infinity, agreement to 1e-8";
    }
    return undefined;
  },
  // the oracle put y into a data frame of 40 rows, which recycled a response of length 10; glm(y ~ x) with vectors of
  // different lengths fails in R ("variable lengths differ"), as it does here
  substitute: (c) =>
    Array.isArray(c.args.y) && Array.isArray(c.args.x) && c.args.y.length !== c.args.x.length
      ? { expected: { error: "variable lengths differ" }, reason: "the oracle's data frame recycled y; glm with vectors of different lengths fails in R" }
      : undefined,
});

describe("glm interface", () => {
  const x = [[1, 0.2], [2, -0.4], [3, 1.1], [4, 0.3], [5, -1.2], [6, 0.8], [7, 0.1], [8, -0.6]];
  const counts = [1, 0, 3, 2, 4, 7, 6, 11];

  it("accepts the family as a name or an object, and a separate link", () => {
    const a = glm(x, counts, { family: "poisson", link: "sqrt" });
    const b = glm(x, counts, { family: { family: "poisson", link: "sqrt" } });
    expect(b.coefficients).toEqual(a.coefficients);
    expect(a.family).toEqual({ family: "poisson", link: "sqrt", variance: "mu" });
    // quasi with a power link: mu^lambda; lambda <= 0 is the log link, as R's power()
    const q = glm(x, counts.map((v) => v + 0.5), { family: { family: "quasi", variance: "mu", link: { power: 1 / 3 } } });
    expect(q.family.link).toBe("mu^0.333");
    const l0 = glm(x, counts, { family: { family: "quasi", variance: "mu", link: { power: -0.5 } } });
    const l1 = glm(x, counts, { family: { family: "quasi", variance: "mu", link: "log" } });
    expect(l0.coefficients).toEqual(l1.coefficients);
  });

  it("takes a vector as one predictor", () => {
    const v = glm(x.map((r) => r[0]!), counts, { family: "poisson" });
    const m = glm(x.map((r) => [r[0]!]), counts, { family: "poisson" });
    expect(v.coefficients).toEqual(m.coefficients);
  });

  it("throws for inputs R rejects", () => {
    expect(() => glm(x, counts, { family: "poisson", link: "logit" })).toThrow(
      'link "logit" not available for poisson family; available links are ‘log’, ‘identity’, ‘sqrt’',
    );
    expect(() => glm(x, counts, { family: "poisson", epsilon: 0 })).toThrow("value of 'epsilon' must be > 0");
    expect(() => glm(x, counts, { family: "poisson", maxit: 0 })).toThrow("maximum number of iterations must be > 0");
    expect(() => glm(x, counts, { family: "poisson", weights: counts.map((_, i) => (i === 2 ? -1 : 1)) })).toThrow("negative weights not allowed");
    expect(() => glm(x, counts, { family: "poisson", start: [0, 0] })).toThrow(
      `length of 'start' should equal 3 and correspond to initial coefs for c("(Intercept)", "x1", "x2")`,
    );
    expect(() => glm(x, counts, { family: "poisson", offset: [0, 1] })).toThrow("variable lengths differ");
    expect(() => glm(x, counts.map((v) => v / 11), { family: "binomial", weights: counts.map(() => 11) })).not.toThrow();
    expect(() => glm(x, counts, { family: "binomial" })).toThrow("y values must be 0 <= y <= 1");
  });

  it("needs the offset of new data for a model with an offset", () => {
    const fit = glm(x, counts, { family: "poisson", offset: x.map(() => Math.log(2)) });
    expect(() => glmPredict(fit, [[1, 0]])).toThrow("supply 'offset'");
    const p = glmPredict(fit, [[1, 0]], { offset: [Math.log(2)] });
    expect(p.fit[0]).toBeCloseTo(fit.coefficients[0]! + fit.coefficients[1]! + Math.log(2), 12);
  });

  it("anova with terms of several columns matches the comparison of the nested fits", () => {
    const x3 = x.map((r, i) => [...r, (i % 3) - 1]);
    const full = glm(x3, counts, { family: "poisson" });
    const seq = glmAnova(full, { terms: [1, 1, 2], termNames: ["a", "b"] });
    expect(seq.rowNames).toEqual(["NULL", "a", "b"]);
    const nested = glmAnova([
      glm(x3.map(() => []), counts, { family: "poisson" }),
      glm(x3.map((r) => r.slice(0, 2)), counts, { family: "poisson" }),
      full,
    ]);
    const dev = seq.table.map((r) => r[3]!);
    nested.table.forEach((r, i) => expect(Math.abs(r[1]! - dev[i]!)).toBeLessThan(1e-12 * dev[0]!));
    expect(seq.table[1]![0]).toBe(2);
  });

  it("confint gives NaN for aliased columns and accepts parm (0-based)", () => {
    const xa = x.map((r) => [...r, r[0]! - 2 * r[1]!]);
    const fit = glm(xa, counts, { family: "poisson" });
    const ci = glmConfint(fit, { parm: [1, 3] });
    expect(ci.lower[1]).toBeNaN();
    expect(ci.upper[1]).toBeNaN();
    expect(ci.lower[0]).toBeLessThan(fit.coefficients[1]!);
    expect(ci.upper[0]).toBeGreaterThan(fit.coefficients[1]!);
  });
});
