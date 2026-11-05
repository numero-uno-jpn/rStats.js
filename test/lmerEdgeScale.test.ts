// Regression tests of lmer with predictors of extreme scale (the glmer audit of 2026-11-05, F2, and the lmer bugs found
// in its second fix): columns of X times 1e±160 or 1e±300 made X'X overflow (a TypeError in the minimiser at 1e160) or
// subnormal (a fit accurate to about 1e-6 at 1e-160, standard errors Infinity, lmerSummary's NaN). The fit must be
// that of the unscaled predictors transformed back (precedents #9, #11): θ and σ unchanged, the slopes and their
// standard errors divided by the scale, the ML log-likelihood unchanged and the REML one shifted by −log k per column
// (log det R_X'R_X / 2), the Satterthwaite df and p-values unchanged.
import { describe, expect, it } from "vitest";
import { lmer } from "../src/models/lmer.js";
import { lmerSummary } from "../src/models/lmerTest.js";

const data = {
  y: [2, 3, 6, 7, 8, 1, 0, 3, 2, 5, 4, 6, 9, 8, 13, 0, 2, 1, 4, 3],
  x: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
  z: [0.3, 1.2, -0.5, 0.8, 2.1, -1.1, 0.4, 0.9, -0.2, 1.5, 0.7, -0.8, 1.1, 0.2, -0.4, 1.9, 0.1, -0.6, 0.5, 1.3],
  g: ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "c", "c", "c", "c", "c", "d", "d", "d", "d", "d"],
};
const relative = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));
function expectClose(actual: readonly number[], expected: readonly number[], tol: number, what: string): void {
  expect(actual.length, what).toBe(expected.length);
  actual.forEach((v, i) => expect(relative(v, expected[i]!), `${what}[${i}]: ${v} vs ${expected[i]}`).toBeLessThanOrEqual(tol));
}

describe("lmer with predictors of extreme scale", () => {
  for (const REML of [false, true]) {
    const plain = lmer("y ~ x + z + (1 | g)", data, { REML });
    const ps = lmerSummary(plain);
    for (const k of [1e160, 1e-160, 1e300, 1e-300]) {
      it(`x, z × ${k}, REML ${REML}: the unscaled fit transformed back`, () => {
        const r = lmer("y ~ x + z + (1 | g)", { ...data, x: data.x.map((v) => v * k), z: data.z.map((v) => v * k) }, { REML });
        expectClose(r.theta, plain.theta, 1e-9, "theta");
        expect(relative(r.sigma, plain.sigma)).toBeLessThanOrEqual(1e-9);
        expect(relative(r.logLik, plain.logLik - (REML ? 2 * Math.log(k) : 0))).toBeLessThanOrEqual(1e-11);
        expectClose(r.fixef, plain.fixef.map((b, i) => (i === 0 ? b : b / k)), 1e-9, "fixef");
        expectClose(r.coefTable.stdError, plain.coefTable.stdError.map((s, i) => (i === 0 ? s : s / k)), 1e-9, "stdError");
        expectClose(r.fitted, plain.fitted, 1e-9, "fitted");
        const s = lmerSummary(r);
        expectClose(s.stdError, ps.stdError.map((v, i) => (i === 0 ? v : v / k)), 1e-9, "summary stdError");
        expectClose(s.df!, ps.df!, 1e-8, "df");
        expectClose(s.pValue!, ps.pValue!, 1e-8, "pValue");
      });
    }
  }
});
