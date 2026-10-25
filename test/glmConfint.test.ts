// Profile likelihood confidence intervals of glm (oracle/glmconfint.R). rStats.js computes the exact limits; R
// interpolates a spline through the profile, so the limits are compared with the exact references of the fixture
// (computed in R with fits converged to rounding), relative to the standard error of the coefficient.
import { glm, glmConfint, glmSummary, type GlmResult } from "../src/index.js";
import { glmArgs } from "./helpers/glm.js";
import { arg, defined, htestSuite, type HTestCase } from "./helpers/htest.js";

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

htestSuite({
  name: "glmConfint",
  call: (a) => {
    const ci = glmConfint(fitOf(a), defined({ parm: parmOf(a), level: arg.num(a.level), test: arg.str<"LRT" | "Rao">(a.test) }));
    return { confLower: ci.lower, confUpper: ci.upper };
  },
  tolerance: 1e-10,
  scale: { confLower: seOf, confUpper: seOf },
});
