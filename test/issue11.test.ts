// Issue #11: random slopes and the units of x (review_fix_log_issue11.md).
import { describe, expect, it } from "vitest";
import { lmer } from "../src/models/lmer.js";
import { g69 as g, x69 as x, y69 as y } from "./helpers/issue69Data.js";

const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a / b - 1));

describe("issue #11", () => {
  it("fits random slopes at any units of x (REML and ML; correlated, uncorrelated, two terms)", () => {
    // x times 1e6 or 1e-5 failed ("the minimisation of the criterion over theta did not converge"); lme4 stops at
    // another point (criterion 101 for 65.9) from x times 3e5 on
    const h = g.map((_, i) => (i % 2 === 0 ? "p" : "q"));
    for (const formula of ["y ~ x + (x | g)", "y ~ x + (x || g)", "y ~ x + (x | g) + (1 | h)"]) {
      for (const REML of [true, false]) {
        const a = lmer(formula, { y, x, g, h }, { REML });
        for (const c of [1e-5, 1e-3, 1e4, 3e5, 1e6, -3e5]) {
          const b = lmer(formula, { y, x: x.map((v) => v * c), g, h }, { REML });
          expect(rel(b.fixef[0]!, a.fixef[0]!)).toBeLessThan(1e-6);
          expect(rel(b.fixef[1]!, a.fixef[1]! / c)).toBeLessThan(1e-6);
          expect(rel(b.sigma, a.sigma)).toBeLessThan(1e-6);
          b.fitted.forEach((f, i) => expect(Math.abs(f - a.fitted[i]!)).toBeLessThan(1e-6));
          // the criterion differs by the log of the scale of the slope's covariance (2 log |c| per group for a slope
          // variance; compared through the fitted values and sigma above), and the slope's sd scales with 1/|c|
          const slope = (r: typeof a) => { const v = r.varCorr.find((t) => t.columns.includes("x"))!; return v.sd[v.columns.indexOf("x")]!; };
          expect(rel(slope(b), slope(a) / Math.abs(c))).toBeLessThan(1e-5);
        }
      }
    }
  });

  it("leaves a random slope with x of ordinary units as before", () => {
    const a = lmer("y ~ x + (x | g)", { y, x, g });
    expect(a.fixef).toEqual([2.3870443267511297, 1.4879893969421896]);
    expect(a.sigma).toBe(0.33787764194621983);
  });
});
