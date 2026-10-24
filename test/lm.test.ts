// lm with summary, confint and predict against R (oracle/lm.R)
import { confint, lm, predict, svd } from "../src/index.js";
import { arg, defined, htestSuite } from "./helpers/htest.js";

htestSuite({
  name: "lm",
  call: (a) => {
    const fit = lm(arg.mat(a.x)!, arg.vec(a.y)!, defined({ intercept: arg.bool(a.intercept), weights: arg.vec(a.weights) }));
    const level = arg.num(a.level) ?? 0.95;
    const ci = confint(fit, { level });
    const out: Record<string, unknown> = {
      coefficients: fit.coefficients,
      residuals: fit.residuals,
      fittedValues: fit.fittedValues,
      rank: fit.rank,
      dfResidual: fit.dfResidual,
      ...fit.coefTable,
      sigma: fit.sigma,
      rSquared: fit.rSquared,
      adjRSquared: fit.adjRSquared,
      fStatistic: [fit.fStatistic.value, fit.fStatistic.numdf, fit.fStatistic.dendf],
      fPValue: fit.fPValue,
      confLower: ci.lower,
      confUpper: ci.upper,
    };
    const nd = arg.mat(a.newdata);
    if (nd !== undefined) {
      const c = predict(fit, nd, { interval: "confidence", level });
      const p = predict(fit, nd, { interval: "prediction", level });
      Object.assign(out, { predict: c.fit, confidenceLower: c.lwr, confidenceUpper: c.upr, predictionLower: p.lwr, predictionUpper: p.upr });
    }
    return out;
  },
  tolerance: 1e-12,
  // interval ends near 0 come from cancellation (estimate - t se)
  floor: { residuals: 1, coefficients: 1, confLower: 1e-3, confUpper: 1e-3 },
  // nearly collinear columns (1e6 + noise with an intercept): the fit is determined to eps times the condition number
  // of R (case 8: R is 1.7e-9 from 60-digit values, rStats.js 3.6e-11)
  knownDifference: (a, _field, expected, actual) => {
    const fit = lm(arg.mat(a.x)!, arg.vec(a.y)!, defined({ intercept: arg.bool(a.intercept), weights: arg.vec(a.weights) }));
    // a perfect fit: residuals, sigma and what follows from them are rounding residue, in R as here (R: F = 7.5e31)
    const ymax = Math.max(...arg.vec(a.y)!.map(Math.abs));
    if (fit.sigma <= 1e-12 * ymax) return "perfect fit: the residuals are rounding residue";
    const x = arg.mat(a.x)!.map((r) => (fit.intercept ? [1, ...r] : r));
    const d = svd(x, { nu: 0, nv: 0 }).d.slice(0, fit.rank);
    const kappa = d[0]! / d[d.length - 1]!;
    return kappa > 1e6 && Math.abs(actual - expected) <= 1e-15 * kappa * Math.max(1, Math.abs(expected))
      ? "ill-conditioned model matrix: agreement to eps times its condition number"
      : undefined;
  },
});
