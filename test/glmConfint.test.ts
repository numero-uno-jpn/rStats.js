// Profile likelihood confidence intervals of glm (oracle/glmconfint.R). rStats.js computes the exact limits; R
// interpolates a spline through the profile, so the limits are compared with the exact references of the fixture
// (computed in R with fits converged to rounding), relative to the standard error of the coefficient.
import { glm, glmConfint, glmSummary, qnorm, type GlmResult } from "../src/index.js";
import { refit } from "../src/models/glm.js";
import { profileConfint } from "../src/models/glmConfint.js";
import { Warnings } from "../src/models/glmFamily.js";
import { num } from "./helpers/fixture.js";
import { glmArgs } from "./helpers/glm.js";
import { arg, defined, htestSuite, loadHTestFixture, type HTestCase } from "./helpers/htest.js";

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

/** 0-based indices of the coefficients of a case (the fixture's parm is 1-based) */
const parmOf = (a: HTestCase["args"]) => arg.vec(a.parm)?.map((j) => j - 1);

/** Standard errors of the coefficients of a case, in the order of its limits */
function seOf(c: HTestCase): number[] {
  const fit = fitOf(c.args);
  const s = glmSummary(fit);
  const se = fit.coefficients.map(() => NaN);
  const piv = fit.qr!.pivot.slice(0, fit.rank);
  piv.forEach((j, k) => (se[j] = s.stdError[k]!));
  return (parmOf(c.args) ?? se.map((_, j) => j)).map((j) => se[j]!);
}

/**
 * The references of the families with an estimated dispersion whose working weights depend on mu (gaussian with the
 * log link, Gamma with the inverse link, inverse.gaussian with the log link) were computed with a dispersion that is
 * not that of the converged fit: oracle/glmconfint.R stops its fits by R's rule with epsilon = 1e-300, which is met
 * when the deviance repeats exactly, before the coefficients (and so the working weights of the Pearson dispersion)
 * have converged. Every reference limit b of such a case implies the same dispersion, (D(b) - D) / qnorm^2, a factor
 * 1 + delta from the converged one. This returns the limits recomputed with that dispersion, when the implied factors
 * of all limits agree to 1e-12 (and delta is not negligible); undefined otherwise.
 */
const withReferenceDispersion = new WeakMap<HTestCase["args"], { lower: number[]; upper: number[]; delta: number } | null>();
function referenceDispersionLimits(c: HTestCase): { lower: number[]; upper: number[]; delta: number } | undefined {
  const cached = withReferenceDispersion.get(c.args);
  if (cached !== undefined) return cached ?? undefined;
  const fit = fitOf(c.args);
  const level = arg.num(c.args.level) ?? 0.95;
  const test = arg.str<"LRT" | "Rao">(c.args.test) ?? "LRT";
  let result: { lower: number[]; upper: number[]; delta: number } | null = null;
  if (test === "LRT" && fit.qr!.rank === fit.coefficients.length) {
    const cols = fit.coefficients.map((_, j) => j);
    const C = { epsilon: 1e-300, maxit: 100, untilCoefficients: true };
    const full = refit(fit.model, cols, new Warnings(), C);
    const phi = glmSummary({ ...fit, weights: full.fit.workingWeights, residuals: full.fit.workingResiduals, qr: full.fit.qr }).dispersion;
    const parm = parmOf(c.args) ?? cols;
    const factors: number[] = [];
    for (const [field, p] of [["confLower", (1 - level) / 2], ["confUpper", (1 + level) / 2]] as const) {
      (c.reference![field] as string[]).map(num).forEach((b, k) => {
        const j = parm[k]!;
        if (Number.isNaN(b)) return;
        const r = refit(fit.model, cols.filter((i) => i !== j), new Warnings(), {
          ...C,
          etastart: full.fit.eta,
          extraOffset: fit.model.x.map((row) => row[j]! * b),
        });
        factors.push((r.fit.deviance - full.fit.deviance) / qnorm(p) ** 2 / phi);
      });
    }
    const f = factors.reduce((a, b) => a + b, 0) / factors.length;
    if (Math.max(...factors) - Math.min(...factors) <= 1e-12 && Math.abs(f - 1) > 1e-11) {
      const ci = profileConfint(fit, defined({ parm: parmOf(c.args), level, test }), f);
      result = { ...ci, delta: f - 1 };
    }
  }
  withReferenceDispersion.set(c.args, result);
  return result ?? undefined;
}

const byArgs = new Map(loadHTestFixture("glmConfint").cases.map((c) => [JSON.stringify(c.args), c]));

htestSuite({
  name: "glmConfint",
  call: (a) => {
    const ci = glmConfint(fitOf(a), defined({ parm: parmOf(a), level: arg.num(a.level), test: arg.str<"LRT" | "Rao">(a.test) }));
    return { confLower: ci.lower, confUpper: ci.upper };
  },
  tolerance: 1e-10,
  scale: { confLower: seOf, confUpper: seOf },
  knownDifference: (a, field, expected) => {
    const c = byArgs.get(JSON.stringify(a))!;
    const r = referenceDispersionLimits(c);
    if (r === undefined) return undefined;
    const k = (c.expected[field] as string[]).map(num).indexOf(expected);
    const ref = num((c.reference![field] as string[])[k]!);
    const mine = (field === "confLower" ? r.lower : r.upper)[k]!;
    return Math.abs(mine - ref) <= 1e-10 * seOf(c)[k]!
      ? "the reference's dispersion is that of a fit stopped by the deviance rule: within 1e-10 se with the dispersion its limits imply"
      : undefined;
  },
});
