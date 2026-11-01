// Issue #9: lmer with a response whose squares overflow or underflow (review_fix_log_issue09.md).
import { describe, expect, it } from "vitest";
import { lmer } from "../src/models/lmer.js";

const y = [9.8, 10.4, 10.1, 12.3, 12.9, 12.0, 8.1, 7.6, 8.4];
const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #9", () => {
  it("fits the response at any scale, the results scaling with it (REML and ML)", () => {
    // 1e200 failed ("the minimisation of the criterion over theta did not converge"); R: sigma Inf
    for (const REML of [true, false]) {
      const a = lmer("y ~ 1 + (1 | g)", { y, g }, { REML });
      const df = REML ? y.length - 1 : y.length;
      for (const c of [1e-200, 1e200, 1e300]) {
        const b = lmer("y ~ 1 + (1 | g)", { y: y.map((v) => v * c), g }, { REML });
        expect(rel(b.theta[0]!, a.theta[0]!)).toBeLessThan(1e-9);
        expect(rel(b.fixef[0]!, a.fixef[0]! * c)).toBeLessThan(1e-12);
        expect(rel(b.sigma, a.sigma * c)).toBeLessThan(1e-9);
        expect(rel(b.varCorr[0]!.sd[0]!, a.varCorr[0]!.sd[0]! * c)).toBeLessThan(1e-9);
        expect(rel(b.coefTable.stdError[0]!, a.coefTable.stdError[0]! * c)).toBeLessThan(1e-9);
        expect(rel(b.coefTable.tValue[0]!, a.coefTable.tValue[0]!)).toBeLessThan(1e-9);
        b.residuals.forEach((r, i) => expect(Math.abs(r / c - a.residuals[i]!)).toBeLessThan(1e-9));
        b.fitted.forEach((f, i) => expect(rel(f, a.fitted[i]! * c)).toBeLessThan(1e-12));
        expect(rel(b.ranef[0]!.values[1]![0]!, a.ranef[0]!.values[1]![0]! * c)).toBeLessThan(1e-9);
        // the log-likelihood shifts by -(n or n - p) log c
        expect(Math.abs(b.logLik - (a.logLik - df * Math.log(c)))).toBeLessThan(1e-8 * Math.abs(df * Math.log(c)));
      }
    }
  });

  it("leaves an ordinary response as before", () => {
    const a = lmer("y ~ 1 + (1 | g)", { y, g });
    expect(a.sigma).toBe(0.39299420408505537);
    expect(a.fixef[0]).toBe(10.177777777777777);
  });
});
