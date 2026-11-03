// Issue #349: a dispersion given by the user was converted to the units of the scaled gaussian fit (d 2^-2k) in one
// step, which underflowed or overflowed for a response far from 1: with y = 1e308 (k = 1023) even dispersion 1 gave
// dispersion 0 and standard errors 0 (glmSummary, glmPredict), NaN standardized residuals and Cook's distances, and Cp
// 0 (glmAnova); y of 1e-300 gave Infinity. Where d 2^-2k is out of range it is now held as m 4^s and the powers of 2
// applied where the result is in range (review_fix_log_issue349.md). References: R 4.5.2 on the same X (the standard
// errors with a given dispersion depend only on X; R cannot fit y = 1e308, so its values are from y = 2^996).
import { describe, expect, it } from "vitest";
import { glm, glmAnova, glmCooksDistance, glmPredict, glmRstandard, glmSummary } from "../src/index.js";

const x = [0, 1, 2, 3];
const SE = [0.8366600265340756, 0.4472135954999579]; // R: 0x1.ac5eb3f7ab2f8p-1 0x1.c9f25c5bfedd9p-2
const SE_FIT = [0.8366600265340756, 0.5477225575051661, 0.5477225575051661, 0.8366600265340756];

describe("issue #349", () => {
  it("dispersion 1 with a response of 1e308 and of 1e-300", () => {
    for (const y of [[1e308, 1e308, 1e308, 1e308], [1, 2, 1.5, 3].map((v) => v * 1e-300)]) {
      const fit = glm(x, y, { family: "gaussian" });
      const s = glmSummary(fit, { dispersion: 1 });
      // before: 0 and [0, 0] (1e308); Infinity (1e-300)
      expect(s.dispersion).toBe(1);
      expect(s.stdError).toEqual(SE);
      expect(s.covScaled).toEqual([[0.7, -0.3], [-0.3, 0.19999999999999998]]);
      expect(s.statistic[0]).toBe(s.estimate[0]! / SE[0]!);
      expect(glmPredict(fit, { dispersion: 1 }).seFit).toEqual(SE_FIT);
      // R's Cp: residual deviance + 2 (n - residual df) dispersion (before: 0, Infinity)
      const cp = glmAnova(fit, { dispersion: 1, test: "Cp" }).table.map((r) => r[r.length - 1]!);
      expect(cp[0]).toBeCloseTo(2 + fit.nullDeviance, 12);
      expect(cp[1]).toBeCloseTo(4 + fit.deviance, 12);
    }
    const c = glm(x, [1e308, 1e308, 1e308, 1e308], { family: "gaussian" });
    // before: NaN
    expect(glmRstandard(c, { dispersion: 1 })).toEqual([0, 0, 0, 0]);
    expect(glmCooksDistance(c, { dispersion: 1 })).toEqual([0, 0, 0, 0]);
    expect(glmAnova(c, { dispersion: 1, test: "Cp" }).table.map((r) => r[r.length - 1])).toEqual([2, 4]);
  });

  it("the issue's dispersion Number.MIN_VALUE", () => {
    for (const y of [[1e308, 1e308, 1e308, 1e308], [1, 3, 2, 5]]) {
      const fit = glm(x, y, { family: "gaussian" });
      const s = glmSummary(fit, { dispersion: Number.MIN_VALUE });
      // sqrt(diag(X'X)^-1 2^-1074) = SE 2^-537 (before: 0 and [0, 0]; R 2^-537 and 0, from sqrt(0.7 * 2^-1074) rounded)
      expect(s.dispersion).toBe(Number.MIN_VALUE);
      expect(s.stdError).toEqual(SE.map((v) => v * 2 ** -537));
      expect(glmPredict(fit, { dispersion: Number.MIN_VALUE }).seFit).toEqual(SE_FIT.map((v) => v * 2 ** -537));
    }
  });

  it("keeps the bits where the scaled dispersion is in range", () => {
    // values of the implementation before the fix
    const fit = glm(x, [1, 3, 2, 5], { family: "gaussian" });
    const s = glmSummary(fit, { dispersion: 1e-300 });
    expect(s.stdError).toEqual([8.366600265340756e-151, 4.472135954999579e-151]);
    expect(s.statistic).toEqual([1.3147514702678331e150, 2.4596747752497686e150]);
    expect(glmCooksDistance(fit, { dispersion: 1e-300 })).toEqual([3.888888888888894e298, 1.959183673469387e299, 5.173469387755101e299, 1.3999999999999977e300]);
    expect(glmRstandard(fit, { dispersion: 1 })).toEqual([-0.1825741858350555, 0.9561828874675147, -1.5537971921347116, 1.0954451150103315]);
    expect(glmAnova(fit, { dispersion: 1, test: "Cp" }).table.map((r) => r[r.length - 1])).toEqual([10.75, 6.699999999999998]);
  });
});
