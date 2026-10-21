// Special functions
export { gamma, lgamma } from "./special/gamma.js";
export { beta, lbeta } from "./special/beta.js";
// Distributions
export { dnorm, pnorm, qnorm } from "./distributions/normal.js";
export { dgamma, pgamma, qgamma } from "./distributions/gamma.js";
export { dchisq, pchisq, qchisq } from "./distributions/chisq.js";
export { dpois, ppois, qpois } from "./distributions/poisson.js";
export { dbeta, pbeta, qbeta } from "./distributions/beta.js";
export { dbinom, pbinom, qbinom } from "./distributions/binomial.js";
export { dt, pt, qt } from "./distributions/t.js";
export { df, pf, qf } from "./distributions/f.js";
export { dunif, punif, qunif } from "./distributions/uniform.js";
export { dexp, pexp, qexp } from "./distributions/exponential.js";
export { dlnorm, plnorm, qlnorm } from "./distributions/lognormal.js";
export { dlogis, plogis, qlogis } from "./distributions/logistic.js";
export { dcauchy, pcauchy, qcauchy } from "./distributions/cauchy.js";
export { dweibull, pweibull, qweibull } from "./distributions/weibull.js";
export { dgeom, pgeom, qgeom } from "./distributions/geometric.js";
export { dnbinom, pnbinom, qnbinom } from "./distributions/negbinomial.js";
export { dhyper, phyper, qhyper } from "./distributions/hypergeometric.js";
export { dsignrank, psignrank, qsignrank } from "./distributions/signrank.js";
export { dwilcox, pwilcox, qwilcox } from "./distributions/wilcox.js";
export { ptukey, qtukey } from "./distributions/tukey.js";
// Random numbers (same streams as R's set.seed)
export { setSeed, getRandomSeed, setRandomSeed } from "./random/rng.js";
export { runif, rnorm, rexp, rlnorm, rlogis, rcauchy, rweibull } from "./random/continuous.js";
export { rgamma, rchisq, rt, rf } from "./random/gamma.js";
export { rbeta } from "./random/beta.js";
export { rpois, rgeom, rnbinom } from "./random/poisson.js";
export { rbinom, rmultinom } from "./random/binomial.js";
export { rsignrank, rwilcox } from "./random/rank.js";
export { sample, sampleInt } from "./random/sample.js";
export { rhyper } from "./random/hyper.js";
// Hypothesis tests (same content as R's htest, returned as plain objects)
export { tTest } from "./htest/tTest.js";
export { chisqTest } from "./htest/chisqTest.js";
export { fisherTest } from "./htest/fisherTest.js";
export { wilcoxTest } from "./htest/wilcoxTest.js";
export { cor, corTest } from "./htest/cor.js";
export { pAdjust } from "./htest/pAdjust.js";
// Linear algebra (the core of scipy.linalg; names and results follow R; matrices are arrays of rows)
export { crossprod, tcrossprod, backsolve, forwardsolve } from "./linalg/basic.js";
export { norm } from "./linalg/norm.js";
export { chol, chol2inv } from "./linalg/chol.js";
export { qr, qrQ, qrR, qrX, qrCoef, qrQy, qrQty, qrResid, qrFitted, qrSolve } from "./linalg/qr.js";
export { solve, det, determinant, rcond } from "./linalg/solve.js";
export { svd } from "./linalg/svd.js";
export { kappa, ginv } from "./linalg/kappa.js";
export { eigen } from "./linalg/eigen.js";
