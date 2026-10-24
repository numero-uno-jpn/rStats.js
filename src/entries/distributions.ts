// Probability distributions and random numbers (rStats.js/distributions): d/p/q/r functions with R's names

export { dnorm, pnorm, qnorm, type NormalOptions } from "../distributions/normal.js";
export { dgamma, pgamma, qgamma, type GammaParams } from "../distributions/gamma.js";
export { dchisq, pchisq, qchisq } from "../distributions/chisq.js";
export { dpois, ppois, qpois } from "../distributions/poisson.js";
export { dbeta, pbeta, qbeta } from "../distributions/beta.js";
export { dbinom, pbinom, qbinom } from "../distributions/binomial.js";
export { dmultinom, type MultinomialOptions } from "../distributions/multinomial.js";
export { dt, pt, qt } from "../distributions/t.js";
export { df, pf, qf } from "../distributions/f.js";
export { dunif, punif, qunif, type UniformParams } from "../distributions/uniform.js";
export { dexp, pexp, qexp, type ExponentialParams } from "../distributions/exponential.js";
export { dlnorm, plnorm, qlnorm, type LognormalParams } from "../distributions/lognormal.js";
export { dlogis, plogis, qlogis, type LocationScaleParams } from "../distributions/logistic.js";
export { dcauchy, pcauchy, qcauchy } from "../distributions/cauchy.js";
export { dweibull, pweibull, qweibull, type WeibullParams } from "../distributions/weibull.js";
export { dgeom, pgeom, qgeom } from "../distributions/geometric.js";
export { dnbinom, pnbinom, qnbinom, type NegBinomialParams } from "../distributions/negbinomial.js";
export { dhyper, phyper, qhyper } from "../distributions/hypergeometric.js";
export { dsignrank, psignrank, qsignrank } from "../distributions/signrank.js";
export { dwilcox, pwilcox, qwilcox } from "../distributions/wilcox.js";
export { ptukey, qtukey, type TukeyOptions } from "../distributions/tukey.js";
export type { DensityOptions, TailOptions } from "../internal/dpq.js";
export type { NoncentralOption } from "../internal/noncentral.js";
export type { Vectorizable, VectorResult } from "../internal/vectorize.js";

// Random numbers (same streams as R's set.seed)
export { setSeed, getRandomSeed, setRandomSeed } from "../random/rng.js";
export { runif, rnorm, rexp, rlnorm, rlogis, rcauchy, rweibull } from "../random/continuous.js";
export { rgamma, rchisq, rt, rf } from "../random/gamma.js";
export { rbeta } from "../random/beta.js";
export { rpois, rgeom, rnbinom } from "../random/poisson.js";
export { rbinom, rmultinom } from "../random/binomial.js";
export { rsignrank, rwilcox } from "../random/rank.js";
export { sample, sampleInt, type SampleOptions } from "../random/sample.js";
export { rhyper } from "../random/hyper.js";
