// Special functions
export { gamma, lgamma } from "./special/gamma.js";
export { beta, lbeta } from "./special/beta.js";
export { choose, lchoose, factorial, lfactorial } from "./special/choose.js";
export { digamma, trigamma, psigamma } from "./special/psigamma.js";

// Distributions
export { dnorm, pnorm, qnorm, type NormalOptions } from "./distributions/normal.js";
export { dgamma, pgamma, qgamma, type GammaParams } from "./distributions/gamma.js";
export { dchisq, pchisq, qchisq } from "./distributions/chisq.js";
export { dpois, ppois, qpois } from "./distributions/poisson.js";
export { dbeta, pbeta, qbeta } from "./distributions/beta.js";
export { dbinom, pbinom, qbinom } from "./distributions/binomial.js";
export { dt, pt, qt } from "./distributions/t.js";
export { df, pf, qf } from "./distributions/f.js";
export { dunif, punif, qunif, type UniformParams } from "./distributions/uniform.js";
export { dexp, pexp, qexp, type ExponentialParams } from "./distributions/exponential.js";
export { dlnorm, plnorm, qlnorm, type LognormalParams } from "./distributions/lognormal.js";
export { dlogis, plogis, qlogis, type LocationScaleParams } from "./distributions/logistic.js";
export { dcauchy, pcauchy, qcauchy } from "./distributions/cauchy.js";
export { dweibull, pweibull, qweibull, type WeibullParams } from "./distributions/weibull.js";
export { dgeom, pgeom, qgeom } from "./distributions/geometric.js";
export { dnbinom, pnbinom, qnbinom, type NegBinomialParams } from "./distributions/negbinomial.js";
export { dhyper, phyper, qhyper } from "./distributions/hypergeometric.js";
export { dsignrank, psignrank, qsignrank } from "./distributions/signrank.js";
export { dwilcox, pwilcox, qwilcox } from "./distributions/wilcox.js";
export { ptukey, qtukey, type TukeyOptions } from "./distributions/tukey.js";

export type { DensityOptions, TailOptions } from "./internal/dpq.js";
export type { NoncentralOption } from "./internal/noncentral.js";
export type { Vectorizable, VectorResult } from "./internal/vectorize.js";

// Random numbers (same streams as R's set.seed)
export { setSeed, getRandomSeed, setRandomSeed } from "./random/rng.js";
export { runif, rnorm, rexp, rlnorm, rlogis, rcauchy, rweibull } from "./random/continuous.js";
export { rgamma, rchisq, rt, rf } from "./random/gamma.js";
export { rbeta } from "./random/beta.js";
export { rpois, rgeom, rnbinom } from "./random/poisson.js";
export { rbinom, rmultinom } from "./random/binomial.js";
export { rsignrank, rwilcox } from "./random/rank.js";
export { sample, sampleInt, type SampleOptions } from "./random/sample.js";
export { rhyper } from "./random/hyper.js";

// Hypothesis tests (same content as R's htest, returned as plain objects)
export { tTest, type TTestOptions, type TTestResult } from "./htest/tTest.js";
export { chisqTest, type ChisqTestOptions, type ChisqTestResult } from "./htest/chisqTest.js";
export { fisherTest, type FisherTestOptions, type FisherTestResult } from "./htest/fisherTest.js";
export { wilcoxTest, type WilcoxTestOptions, type WilcoxTestResult } from "./htest/wilcoxTest.js";
export { cor, corTest, type CorMethod, type CorOptions, type CorTestOptions, type CorTestResult } from "./htest/cor.js";
export { pAdjust, type PAdjustMethod, type PAdjustOptions } from "./htest/pAdjust.js";
export type { Alternative, Counts, HTest, Sample } from "./htest/types.js";

// Linear algebra (the core of scipy.linalg; names and results follow R; matrices are arrays of rows)
export { crossprod, tcrossprod, backsolve, forwardsolve, type BacksolveOptions } from "./linalg/basic.js";
export { norm, type NormOptions, type NormType } from "./linalg/norm.js";
export { chol, chol2inv, type CholOptions, type CholPivotResult, type Chol2InvOptions } from "./linalg/chol.js";
export { qr, qrQ, qrR, qrX, qrCoef, qrQy, qrQty, qrResid, qrFitted, qrSolve, type QR, type QROptions, type QRQOptions } from "./linalg/qr.js";
export { solve, det, determinant, rcond, type SolveOptions, type Determinant, type RcondOptions } from "./linalg/solve.js";
export { svd, type SvdOptions, type SvdResult } from "./linalg/svd.js";
export { kappa, ginv, type KappaOptions } from "./linalg/kappa.js";
export { eigen, type EigenOptions, type EigenResult } from "./linalg/eigen.js";
export type { MatrixInput, VectorOrMatrix } from "./linalg/matrix.js";
