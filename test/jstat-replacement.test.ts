// The replacements in the jStat migration guide (docs/migrating-from-jstat.md) give jStat's values: each example
// calls jStat (a devDependency used only here) and its rStats.js replacement on the same input. jStat's known bugs
// (the guide's "Bugs in jStat" section) are skipped, and jStat functions built on its betacf (accurate to about 7
// digits: ibeta and the beta, t and F distributions) are compared to 1e-6.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import * as R from "../src/index.js";

const { jStat } = createRequire(import.meta.url)("jstat") as { jStat: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

type Value = number | number[] | number[][];
/** [jStat name, jStat value, rStats.js value, relative tolerance] */
type Example = [string, () => Value, () => Value, (number | undefined)?];

const TOL = 1e-12;
const BETACF = 1e-6; // jStat's betacf
const JGAMMA = 1e-8; // jStat's gammafn at non-integers (about 8 digits; its gammaln is accurate)

function close(a: Value, b: Value, tol: number): boolean {
  const fa = [a].flat(2) as number[];
  const fb = [b].flat(2) as number[];
  return (
    fa.length === fb.length &&
    fa.every((v, i) => Object.is(v, fb[i]) || (Number.isNaN(v) && Number.isNaN(fb[i]!)) || Math.abs(v - fb[i]!) <= tol * Math.max(Math.abs(v), 1e-300) || Math.abs(v - fb[i]!) <= tol * 1e-3)
  );
}

function suite(name: string, examples: Example[]): void {
  describe(name, () => {
    for (const [label, j, r, tol] of examples) {
      it(label, () => {
        const jv = j();
        const rv = r();
        expect(close(jv, rv, tol ?? TOL), `jStat ${JSON.stringify(jv)} / rStats.js ${JSON.stringify(rv)}`).toBe(true);
      });
    }
  });
}

const x = [2.5, 3.1, 4.7, 1.8, 5.2, 3.3, 2.9, 4.1];
const y = [1.2, 2.8, 4.1, 1.1, 4.9, 2.7, 3.3, 3.6];
const groups = [[2.9, 3.0, 2.5, 2.6, 3.2], [3.8, 2.7, 4.0, 2.4], [2.8, 3.4, 3.7, 2.2, 2.0]];
const A = [[4, 3, 2], [6, 3, 1], [1, 5, 7]];
const B = [[1, 2, 0], [0, 1, 3], [2, 1, 1]];
const S = [[4, 2, 0.4], [2, 3, 0.5], [0.4, 0.5, 2]];

suite("descriptive statistics", [
  ["jStat.sum", () => jStat.sum(x), () => R.sum(x)],
  ["jStat.sumsqrd", () => jStat.sumsqrd(x), () => R.sum(x.map((v) => v * v))],
  ["jStat.sumsqerr", () => jStat.sumsqerr(x), () => R.variance(x) * (x.length - 1)],
  ["jStat.product", () => jStat.product(x), () => R.prod(x)],
  ["jStat.min / max", () => [jStat.min(x), jStat.max(x)], () => R.range(x)],
  ["jStat.unique", () => jStat.unique([3, 1, 3, 2]), () => R.unique([3, 1, 3, 2])],
  ["jStat.mean", () => jStat.mean(x), () => R.mean(x)],
  ["jStat.meansqerr", () => jStat.meansqerr(x), () => (R.variance(x) * (x.length - 1)) / x.length],
  ["jStat.geomean", () => jStat.geomean(x), () => R.geometricMean(x)],
  ["jStat.median", () => jStat.median(x), () => R.median(x)],
  ["jStat.cumsum", () => jStat.cumsum(x), () => R.cumsum(x)],
  ["jStat.cumprod", () => jStat.cumprod(x), () => R.cumprod(x)],
  ["jStat.diff", () => jStat.diff(x), () => R.diff(x)],
  ["jStat.rank", () => jStat.rank([3, 1, 2, 2]), () => R.rank([3, 1, 2, 2])],
  ["jStat.mode", () => jStat.mode([1, 2, 2, 3]), () => R.modes([1, 2, 2, 3]).value],
  ["jStat.range", () => jStat.range(x), () => R.range(x)[1] - R.range(x)[0]],
  ["jStat.variance", () => jStat.variance(x, true), () => R.variance(x)],
  ["jStat.stdev", () => jStat.stdev(x, true), () => R.sd(x)],
  ["jStat.pooledvariance", () => jStat.pooledvariance(groups), () => R.aov(groups).meanSq[1]],
  ["jStat.meandev", () => jStat.meandev(x), () => R.meanAD(x)],
  ["jStat.meddev", () => jStat.meddev(x), () => R.mad(x, { constant: 1 })],
  ["jStat.coeffvar", () => jStat.coeffvar(x), () => R.sd(x) / R.mean(x) * Math.sqrt((x.length - 1) / x.length)],
  ["jStat.quantiles", () => jStat.quantiles(x, [0.1, 0.5, 0.9]), () => R.quantile(x, [0.1, 0.5, 0.9], { type: 9 })],
  ["jStat.percentile", () => jStat.percentile(x, 0.3), () => R.quantile(x, 0.3)],
  ["jStat.percentile (exclusive)", () => jStat.percentile(x, 0.3, true), () => R.quantile(x, 0.3, { type: 6 })],
  ["jStat.percentileOfScore", () => jStat.percentileOfScore(x, 3.1), () => R.ecdf(x)(3.1)],
  ["jStat.covariance", () => jStat.covariance(x, y), () => R.cov(x, y)],
  ["jStat.corrcoeff", () => jStat.corrcoeff(x, y), () => R.cor(x, y)],
  ["jStat.spearmancoeff", () => jStat.spearmancoeff(x, y), () => R.cor(x, y, { method: "spearman" })],
  ["jStat.skewness", () => jStat.skewness(x), () => R.skewness(x, { type: 1 })],
  ["jStat.kurtosis", () => jStat.kurtosis(x), () => R.kurtosis(x, { type: 1 })],
]);

suite("special functions", [
  ["jStat.gammaln", () => jStat.gammaln(7.3), () => R.lgamma(7.3), 1e-10],
  ["jStat.gammafn", () => jStat.gammafn(7.3), () => R.gamma(7.3), 1e-10],
  ["jStat.gammap", () => jStat.gammap(2.5, 3), () => R.gammainc(3, 2.5).lower, JGAMMA],
  ["jStat.lowRegGamma", () => jStat.lowRegGamma(2.5, 3), () => R.pgamma(3, 2.5), 1e-10],
  ["jStat.gammapinv", () => jStat.gammapinv(0.3, 2.5), () => R.qgamma(0.3, 2.5), 1e-8],
  ["jStat.factorialln", () => jStat.factorialln(20), () => R.lfactorial(20), 1e-10],
  ["jStat.factorial", () => jStat.factorial(12), () => R.factorial(12), 1e-10],
  ["jStat.combination", () => jStat.combination(20, 6), () => R.choose(20, 6), 1e-10],
  ["jStat.combinationln", () => jStat.combinationln(20, 6), () => R.lchoose(20, 6), 1e-10],
  ["jStat.permutation", () => jStat.permutation(10, 3), () => R.perm(10, 3)],
  ["jStat.betafn", () => jStat.betafn(2.5, 3.5), () => R.beta(2.5, 3.5), JGAMMA],
  ["jStat.betaln", () => jStat.betaln(2.5, 3.5), () => R.lbeta(2.5, 3.5), 1e-10],
  ["jStat.ibeta", () => jStat.ibeta(0.3, 2.5, 3.5), () => R.pbeta(0.3, 2.5, 3.5), BETACF],
  ["jStat.ibetainv", () => jStat.ibetainv(0.3, 2.5, 3.5), () => R.qbeta(0.3, 2.5, 3.5), BETACF],
  ["jStat.erf", () => jStat.erf(0.7), () => R.erf(0.7), 1e-12],
  ["jStat.erfc", () => jStat.erfc(0.7), () => R.erfc(0.7), 1e-12],
  ["jStat.erfcinv", () => jStat.erfcinv(0.3), () => R.erfcinv(0.3), 1e-10],
]);

// Distributions: jStat object, its parameters, rStats.js d/p/q with the guide's arguments, points, distSummary
type Dist = [string, number[], (v: number) => number, (v: number) => number, ((p: number) => number) | undefined, number[], R.DistName, Record<string, number>, string[], number?];
const dists: Dist[] = [
  ["normal", [1, 2], (v) => R.dnorm(v, { mean: 1, sd: 2 }), (v) => R.pnorm(v, { mean: 1, sd: 2 }), (p) => R.qnorm(p, { mean: 1, sd: 2 }), [-1, 0.5, 3], "norm", { mean: 1, sd: 2 }, ["mean", "median", "mode", "variance"], 1e-9],
  ["studentt", [5], (v) => R.dt(v, 5), (v) => R.pt(v, 5), (p) => R.qt(p, 5), [-1, 0.5, 3], "t", { df: 5 }, ["mean", "median", "mode", "variance"], BETACF],
  ["centralF", [5, 10], (v) => R.df(v, 5, 10), (v) => R.pf(v, 5, 10), (p) => R.qf(p, 5, 10), [0.5, 1, 3], "f", { df1: 5, df2: 10 }, ["mean", "mode", "variance"], BETACF],
  ["chisquare", [4], (v) => R.dchisq(v, 4), (v) => R.pchisq(v, 4), (p) => R.qchisq(p, 4), [0.5, 3, 9], "chisq", { df: 4 }, ["mean", "mode", "variance"], 1e-8],
  ["beta", [2, 3], (v) => R.dbeta(v, 2, 3), (v) => R.pbeta(v, 2, 3), (p) => R.qbeta(p, 2, 3), [0.1, 0.4, 0.8], "beta", { shape1: 2, shape2: 3 }, ["mean", "median", "mode", "variance"], BETACF],
  ["gamma", [2.5, 2], (v) => R.dgamma(v, 2.5, { scale: 2 }), (v) => R.pgamma(v, 2.5, { scale: 2 }), (p) => R.qgamma(p, 2.5, { scale: 2 }), [0.5, 3, 9], "gamma", { shape: 2.5, scale: 2 }, ["mean", "mode", "variance"], 1e-8],
  ["invgamma", [3, 2], (v) => R.dinvgamma(v, 3, { beta: 2 }), (v) => R.pinvgamma(v, 3, { beta: 2 }), (p) => R.qinvgamma(p, 3, { beta: 2 }), [0.3, 1, 2], "invgamma", { alpha: 3, beta: 2 }, ["mean", "mode", "variance"], 1e-8],
  ["lognormal", [0.5, 0.8], (v) => R.dlnorm(v, { meanlog: 0.5, sdlog: 0.8 }), (v) => R.plnorm(v, { meanlog: 0.5, sdlog: 0.8 }), (p) => R.qlnorm(p, { meanlog: 0.5, sdlog: 0.8 }), [0.5, 1.5, 4], "lnorm", { meanlog: 0.5, sdlog: 0.8 }, ["mean", "median", "mode", "variance"], 1e-9],
  ["exponential", [2], (v) => R.dexp(v, { rate: 2 }), (v) => R.pexp(v, { rate: 2 }), (p) => R.qexp(p, { rate: 2 }), [0.1, 0.5, 2], "exp", { rate: 2 }, ["mean", "median", "mode", "variance"]],
  ["uniform", [-1, 3], (v) => R.dunif(v, { min: -1, max: 3 }), (v) => R.punif(v, { min: -1, max: 3 }), (p) => R.qunif(p, { min: -1, max: 3 }), [-0.5, 1, 2.5], "unif", { min: -1, max: 3 }, ["mean", "variance"]],
  ["cauchy", [1, 2], (v) => R.dcauchy(v, { location: 1, scale: 2 }), (v) => R.pcauchy(v, { location: 1, scale: 2 }), (p) => R.qcauchy(p, { location: 1, scale: 2 }), [-3, 1.5, 6], "cauchy", { location: 1, scale: 2 }, ["median", "mode"]],
  ["weibull", [2, 1.5], (v) => R.dweibull(v, 1.5, { scale: 2 }), (v) => R.pweibull(v, 1.5, { scale: 2 }), (p) => R.qweibull(p, 1.5, { scale: 2 }), [0.5, 2, 4], "weibull", { shape: 1.5, scale: 2 }, ["mean", "median", "mode", "variance"], 1e-7], // mean, variance through jStat's gammafn
  ["kumaraswamy", [2, 3], (v) => R.dkumar(v, 2, 3), (v) => R.pkumar(v, 2, 3), (p) => R.qkumar(p, 2, 3), [0.1, 0.4, 0.8], "kumar", { a: 2, b: 3 }, ["mean", "median", "mode"], 1e-9],
  ["laplace", [1, 2], (v) => R.dlaplace(v, { mu: 1, sigma: 2 }), (v) => R.plaplace(v, { mu: 1, sigma: 2 }), undefined, [-2, 0.5, 4], "laplace", { mu: 1, sigma: 2 }, ["mean", "median", "mode", "variance"]],
  ["pareto", [1, 3], (v) => R.dpareto(v, { a: 3, b: 1 }), (v) => R.ppareto(v, { a: 3, b: 1 }), (p) => R.qpareto(p, { a: 3, b: 1 }), [1.2, 2, 5], "pareto", { a: 3, b: 1 }, ["mean", "mode", "variance"]],
  ["triangular", [0, 4, 1], (v) => R.dtriang(v, { a: 0, b: 4, c: 1 }), (v) => R.ptriang(v, { a: 0, b: 4, c: 1 }), (p) => R.qtriang(p, { a: 0, b: 4, c: 1 }), [0.5, 1, 3], "triang", { a: 0, b: 4, c: 1 }, ["mean", "median", "mode", "variance"]],
  ["arcsine", [-1, 3], (v) => R.darcsine(v, { a: -1, b: 3 }), (v) => R.parcsine(v, { a: -1, b: 3 }), (p) => R.qarcsine(p, { a: -1, b: 3 }), [-0.5, 1, 2.5], "arcsine", { a: -1, b: 3 }, ["mean", "median", "variance"], 1e-9],
];

for (const [js, params, d, p, q, points, name, sp, fields, tol] of dists) {
  const J = jStat[js];
  suite(`jStat.${js}`, [
    ...points.map((v): Example => [`pdf(${v})`, () => J.pdf(v, ...params), () => d(v), tol]),
    ...points.map((v): Example => [`cdf(${v})`, () => J.cdf(v, ...params), () => p(v), tol]),
    ...(q === undefined ? [] : [0.1, 0.5, 0.9].map((pr): Example => [`inv(${pr})`, () => J.inv(pr, ...params), () => q(pr), tol])),
    ...fields.map((f): Example => [f, () => J[f](...params), () => R.distSummary(name, sp)[f as keyof R.DistSummary], tol]),
  ]);
}

suite("discrete distributions", [
  ["jStat.binomial.pdf", () => jStat.binomial.pdf(3, 10, 0.3), () => R.dbinom(3, 10, 0.3), 1e-10],
  ["jStat.binomial.cdf", () => jStat.binomial.cdf(3, 10, 0.3), () => R.pbinom(3, 10, 0.3), 1e-9],
  ["jStat.negbin.pdf", () => jStat.negbin.pdf(4, 3, 0.4), () => R.dnbinom(4, 3, { prob: 0.4 }), 1e-10],
  ["jStat.negbin.cdf", () => jStat.negbin.cdf(4, 3, 0.4), () => R.pnbinom(4, 3, { prob: 0.4 }), 1e-10],
  // jStat's (N, m, n): population, successes, draws
  ["jStat.hypgeom.pdf", () => jStat.hypgeom.pdf(2, 20, 7, 5), () => R.dhyper(2, 7, 13, 5), 1e-10],
  ["jStat.hypgeom.cdf", () => jStat.hypgeom.cdf(2, 20, 7, 5), () => R.phyper(2, 7, 13, 5), 1e-10],
  ["jStat.poisson.pdf", () => jStat.poisson.pdf(3, 2.5), () => R.dpois(3, 2.5), 1e-10],
  ["jStat.poisson.cdf", () => jStat.poisson.cdf(3, 2.5), () => R.ppois(3, 2.5), 1e-10],
  ["jStat.poisson.mean", () => jStat.poisson.mean(2.5), () => R.distSummary("pois", { lambda: 2.5 }).mean],
  ["jStat.poisson.variance", () => jStat.poisson.variance(2.5), () => R.distSummary("pois", { lambda: 2.5 }).variance],
  ["jStat.tukey.cdf", () => jStat.tukey.cdf(3.5, 3, 12), () => R.ptukey(3.5, 3, 12), 1e-6],
  ["jStat.tukey.inv", () => jStat.tukey.inv(0.95, 3, 12), () => R.qtukey(0.95, 3, 12), 1e-4],
  ["jStat.noncentralt.pdf", () => jStat.noncentralt.pdf(1.5, 8, 1), () => R.dt(1.5, 8, { ncp: 1 }), 1e-6],
  ["jStat.noncentralt.cdf", () => jStat.noncentralt.cdf(1.5, 8, 1), () => R.pt(1.5, 8, { ncp: 1 }), 1e-6],
]);

suite("matrices and linear algebra", [
  ["jStat.diag", () => jStat.diag(A).flat(), () => R.diag(A) as number[]],
  ["jStat.transpose", () => jStat.transpose(A), () => R.t(A)],
  ["jStat.identity", () => jStat.identity(3), () => R.diag(3) as number[][]],
  ["jStat.create", () => jStat.create(2, 3, (i: number, j: number) => i * 3 + j + 1), () => R.matrix([1, 2, 3, 4, 5, 6], { nrow: 2, ncol: 3, byrow: true })],
  ["jStat.zeros", () => jStat.zeros(2, 3), () => R.matrix(0, { nrow: 2, ncol: 3 })],
  ["jStat.ones", () => jStat.ones(2, 3), () => R.matrix(1, { nrow: 2, ncol: 3 })],
  ["jStat.seq", () => jStat.seq(0, 1, 5), () => R.seq(0, 1, { lengthOut: 5 })],
  ["jStat.add", () => jStat.add(A, B), () => R.add(A, B)],
  ["jStat.subtract", () => jStat.subtract(A, B), () => R.subtract(A, B)],
  ["jStat.multiply", () => jStat.multiply(A, B), () => R.matMul(A, B)],
  ["jStat.outer", () => jStat.outer([1, 2, 3], [4, 5]), () => R.outer([1, 2, 3], [4, 5])],
  ["jStat.norm", () => jStat.norm(x), () => R.norm([x], { type: "F" })],
  ["jStat.aug", () => jStat.aug(A, B), () => R.cbind(A, B)],
  ["jStat.inv", () => jStat.inv(A), () => R.solve(A), 1e-10],
  ["jStat.det", () => jStat.det(A), () => R.det(A), 1e-10],
  ["jStat.gauss_jordan", () => jStat.gauss_jordan(A, [[1], [2], [3]]).map((r: number[]) => r[3]), () => R.solve(A, [1, 2, 3]) as number[], 1e-10],
  ["jStat.triaUpSolve", () => jStat.triaUpSolve([[2, 1, 1], [0, 3, 2], [0, 0, 4]], [1, 2, 3]), () => R.backsolve([[2, 1, 1], [0, 3, 2], [0, 0, 4]], [1, 2, 3]) as number[], 1e-12],
  ["jStat.triaLowSolve", () => jStat.triaLowSolve([[2, 0, 0], [1, 3, 0], [1, 2, 4]], [1, 2, 3]), () => R.forwardsolve([[2, 0, 0], [1, 3, 0], [1, 2, 4]], [1, 2, 3]) as number[], 1e-12],
  ["jStat.cholesky", () => jStat.cholesky(S), () => R.t(R.chol(S)), 1e-12],
  // jStat has no pivoting (A = L U); both factorizations give back A
  ["jStat.lu", () => { const [L, U] = jStat.lu([[4, 3], [6, 3]]); return jStat.multiply(L, U); }, () => { const r = R.lu([[4, 3], [6, 3]]); return R.matMul(r.P, R.matMul(r.L, r.U)); }, 1e-12],
  ["jStat.lstsq", () => jStat.lstsq([[1, 1], [1, 2], [1, 3], [1, 4]], [[1], [2.1], [2.9], [4.2]]).flat(), () => R.qrSolve([[1, 1], [1, 2], [1, 3], [1, 4]], [1, 2.1, 2.9, 4.2]) as number[], 1e-10],
  ["jStat.jacobi", () => jStat.jacobi(S)[1].slice().sort((a: number, b: number) => b - a), () => R.eigen(S, { symmetric: true }).values as number[], 1e-3],
]);

suite("numerical methods", [
  ["jStat.romberg", () => jStat.romberg(Math.exp, 0, 1, 8), () => R.integrate(Math.exp, 0, 1).value, 1e-10],
  ["jStat.simpson", () => jStat.simpson(Math.exp, 0, 1, 64), () => R.integrate(Math.exp, 0, 1).value, 1e-9],
  ["jStat.lagrange", () => jStat.lagrange([0, 1, 2, 4], [1, 3, 2, 5], 3), () => R.barylag([0, 1, 2, 4], [1, 3, 2, 5], [3]), 1e-12],
  ["jStat.hermite", () => jStat.hermite([0, 1, 2], [1, 2, 0], [0, 1, -1], 1.5), () => R.hermiteInterp([0, 1, 2], [1, 2, 0], [0, 1, -1], [1.5]), 1e-12],
  ["jStat.rungekutta", () => jStat.rungekutta((t: number, y: number) => -0.7 * y, 0.1, 0.95, 0, 1, 4), () => R.ode([1], R.seq(0, 1, { by: 0.1 }), (t, s) => [-0.7 * s[0]!], [], { method: "rk4" })[10]![1]!, 1e-10],
]);

suite("hypothesis tests", [
  ["jStat.ttest", () => jStat.ttest(3, x, 2), () => R.tTest(x, { mu: 3 }).pValue, BETACF],
  ["jStat.tscore", () => jStat.tscore(3, x), () => -R.tTest(x, { mu: 3 }).statistic],
  ["jStat.anovafscore", () => jStat.anovafscore(...groups), () => R.aov(groups).fValue],
  ["jStat.anovaftest", () => jStat.anovaftest(...groups), () => R.aov(groups).pValue, BETACF],
  ["jStat.ftest", () => jStat.ftest(3.2, 2, 11), () => R.pf(3.2, 2, 11, { lowerTail: false }), BETACF],
  ["jStat.tukeyhsd", () => jStat.tukeyhsd(groups).map((r: [number[], number]) => r[1]), () => R.TukeyHSD(groups).pAdj, 1e-4],
  ["jStat.normalci", () => jStat.normalci(R.mean(x), 0.05, 1.2, x.length), () => R.zTest(x, { sigmaX: 1.2 }).confInt!, 1e-9],
  ["jStat.tci", () => jStat.tci(R.mean(x), 0.05, x), () => R.tTest(x).confInt!, BETACF],
  ["jStat.oneSidedDifferenceOfProportions", () => jStat.fn.oneSidedDifferenceOfProportions(0.45, 60, 0.3, 50), () => R.propTest([27, 15], [60, 50], { alternative: "greater", correct: false }).pValue, 1e-9],
  ["jStat.twoSidedDifferenceOfProportions", () => jStat.fn.twoSidedDifferenceOfProportions(0.45, 60, 0.3, 50), () => R.propTest([27, 15], [60, 50], { correct: false }).pValue, 1e-9],
]);

suite("regression", [
  ["jStat.models.ols coefficients", () => jStat.models.ols(y, x.map((v) => [1, v])).coef, () => R.lm(x, y).coefficients, 1e-10],
  ["jStat.models.ols R^2", () => jStat.models.ols(y, x.map((v) => [1, v])).R2, () => R.lm(x, y).rSquared, 1e-10],
  ["jStat.models.ols t", () => jStat.models.ols(y, x.map((v) => [1, v])).t.t, () => R.lm(x, y).coefTable.tValue, 1e-10],
]);
