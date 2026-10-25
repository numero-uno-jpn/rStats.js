// Arguments of the glm fixtures (oracle/_glm.R) as glm's arguments
import type { GlmFamilyName, GlmOptions, GlmResult, QuasiVariance } from "../../src/index.js";
import { makeFamily } from "../../src/models/glmFamily.js";
import { arg, defined, type HTestCase } from "./htest.js";

/** The glm options of a fixture case (oracle/_glm.R) */
export function glmArgs(a: HTestCase["args"]): { x: number[][]; y: number[] | number[][]; options: GlmOptions } {
  const family = arg.str(a.family) as GlmFamilyName;
  const lp = arg.num(a.linkPower);
  const link = lp !== undefined ? { power: lp } : (arg.str(a.link) as GlmOptions["link"]);
  const variance = arg.str(a.variance) as QuasiVariance | undefined;
  const y = Array.isArray(a.y) && Array.isArray(a.y[0]) ? arg.mat(a.y)! : arg.vec(a.y)!;
  return {
    x: arg.mat(a.x)!,
    y,
    options: defined({
      family: variance === undefined ? family : { family, variance },
      link,
      weights: arg.vec(a.weights),
      offset: arg.vec(a.offset),
      start: arg.vec(a.start),
      epsilon: arg.num(a.epsilon),
      maxit: arg.num(a.maxit),
      intercept: arg.bool(a.intercept),
    }),
  };
}

/**
 * Rounding scale of each deviance contribution d_i, so that d_i is known to about eps times it: the logarithms of
 * ratios y / mu near 1 are known to an absolute eps, which gives 2 w |y| (Poisson families and quasi "mu") or 2 w
 * (binomial, Gamma and their quasi variances); without logarithms (gaussian, inverse.gaussian, quasi "constant" and
 * "mu^3") d_i is w (y - mu)^2 / V-like and y - mu is known to eps max(|y|, |mu|), which gives 2 |d_i / (y - mu)|
 * max(|y|, |mu|).
 */
export function devianceScales(fit: GlmResult): number[] {
  const fam = makeFamily(fit.model.familySpec);
  const { y, fittedValues: mu, priorWeights: w } = fit;
  const noLog = ["gaussian", "inverse.gaussian"].includes(fam.family) || ["constant", "mu^3"].includes(fam.varianceName ?? "");
  const poissonLike = ["poisson", "quasipoisson"].includes(fam.family) || fam.varianceName === "mu";
  return y.map((v, i) => {
    const m = mu[i]!;
    if (noLog) {
      const perDiff = fam.family === "gaussian" || fam.varianceName === "constant" ? w[i]! : w[i]! / (v * m * m);
      return 2 * perDiff * Math.abs(v - m) * Math.max(Math.abs(v), Math.abs(m));
    }
    return 2 * w[i]! * (poissonLike ? Math.abs(v) : 1);
  });
}

/** Rounding scale of the deviance of a fit (the sum of {@link devianceScales}) */
export const devianceScale = (fit: GlmResult) => devianceScales(fit).reduce((a, b) => a + b, 0);
