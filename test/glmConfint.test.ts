// Profile likelihood confidence intervals of glm against the exact intervals computed with R (oracle/glmconfint.R),
// and against R's confint, which interpolates
import { glmConfint, glmSummary, type GlmConfintOptions } from "../src/index.js";
import { profileConfint } from "../src/models/glmConfint.js";
import { describe, expect, it } from "vitest";
import { num } from "./helpers/fixture.js";
import { arg, htestSuite, loadHTestFixture, type HTestArg, type HTestCase } from "./helpers/htest.js";
import { fitCase } from "./helpers/glm.js";

function options(a: Record<string, HTestArg>): GlmConfintOptions {
  const parm = arg.vec(a.parm)?.map((j) => j - 1);
  return { level: arg.num(a.level) ?? 0.95, test: (arg.str(a.test) ?? "LRT") as "LRT" | "Rao", ...(parm !== undefined ? { parm } : {}) };
}

function call(a: Record<string, HTestArg>): { confLower: number[]; confUpper: number[] } {
  const ci = glmConfint(fitCase(a), options(a));
  return { confLower: ci.lower, confUpper: ci.upper };
}

/** Standard errors of the profiled coefficients */
function stdErrors(a: Record<string, HTestArg>): number[] {
  const se = glmSummary(fitCase(a)).coefTable.stdError;
  return options(a).parm?.map((j) => se[j]!) ?? se;
}

const rRuleCache = new WeakMap<object, { lower: number[]; upper: number[] }>();
const references = new Map(loadHTestFixture("glmConfint").cases.map((c) => [JSON.stringify(c.args), c.reference!]));
function referenceOf(a: Record<string, HTestArg>, field: string, k: number): number {
  const r = references.get(JSON.stringify(a))![field] as string[] | string;
  return num((Array.isArray(r) ? r : [r])[k]);
}

// Every case is compared with the exact references to 1e-10, relative to the larger of the limit and the standard
// error of the coefficient (a limit near 0 is determined only relative to the standard error)
htestSuite({
  name: "glmConfint",
  call,
  tolerance: 1e-10,
  floor: { confLower: (c: HTestCase) => Math.min(...stdErrors(c.args)), confUpper: (c: HTestCase) => Math.min(...stdErrors(c.args)) },
  // The references come from refits stopped by R's rule with epsilon = 1e-14. Where the deviance is flat (it is
  // stationary at the estimate), that rule stops while the coefficients still move by about 1e-8; the deviance is not
  // affected, but the Pearson dispersion (non-canonical links with an estimated dispersion) and the score statistic
  // (test = "Rao") are. glmConfint iterates to rounding. Following R's rule instead reproduces the references.
  knownDifference: (a, field, _expected, actual, k) => {
    const ref = referenceOf(a, field, k);
    let r = rRuleCache.get(a);
    if (r === undefined) {
      r = profileConfint(fitCase(a), options(a), true);
      rRuleCache.set(a, r);
    }
    const se = stdErrors(a)[k]!;
    const rv = (field === "confLower" ? r.lower : r.upper)[k]!;
    return Math.abs(rv - ref) <= 1e-9 * Math.max(Math.abs(ref), se) && Math.abs(actual - rv) <= 1e-7 * se
      ? "references from refits stopped by R's rule (epsilon = 1e-14) before the dispersion or score converged; reproduced with that rule"
      : undefined;
  },
});

describe("glmConfint against R's interpolated confint", () => {
  it("differs from R by less than 5e-4 of the standard error", () => {
    let worst = 0;
    for (const c of loadHTestFixture("glmConfint").cases) {
      const out = call(c.args);
      const se = stdErrors(c.args);
      for (const field of ["confLower", "confUpper"] as const) {
        const r = c.expected[field] as string[] | string;
        (Array.isArray(r) ? r : [r]).forEach((s, k) => {
          const v = num(s);
          if (Number.isNaN(v)) expect(out[field][k]).toBeNaN();
          else worst = Math.max(worst, Math.abs(out[field][k]! - v) / se[k]!);
        });
      }
    }
    console.log(`glmConfint: largest difference from R's interpolated confint ${worst.toExponential(1)} standard errors`);
    expect(worst).toBeLessThan(5e-4);
  });
});
