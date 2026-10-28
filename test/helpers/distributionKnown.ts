// Violations of the distribution properties (properties.ts) known today, with their reasons: the allow-list of
// test/distributionProperties.test.ts, also applied by scripts/fuzz-distributions.mjs with --known. Each entry names a
// family, the properties it covers and a predicate on the violation (the function called, its parameters and x; for a
// quantile x is p). `examples` are parameter sets (with points) the test runs besides the random ones, so that the entry
// is exercised on every run. `exclude` marks calls that are not made at all because they do not return in reasonable
// time (or take long enough to pass 1 s on a slower machine); the fuzz script runs them with a timeout.
//
// Expected values in the reasons come from closed forms or from other functions of the library; none from R.
// Type-only imports: this file must stay loadable by Node's type stripping (no relative runtime imports).

import type { Flags, Kind, Params, Violation } from "./properties.js";

export interface KnownViolation {
  family: string;
  /** Property or properties covered */
  property: string | readonly string[];
  /** The call text, or a predicate on the violation */
  match: string | ((v: Violation) => boolean);
  reason: string;
  /** Parameter sets (and points x) run in addition to the random ones */
  examples?: { params: Params; x?: number[] }[];
  /** Calls not made at all */
  exclude?: (kind: Kind, x: number, pr: Params, flags: Flags) => boolean;
}

const fnOf = (v: Violation): string => v.call.slice(0, v.call.indexOf("("));

/** A predicate on the function called (its full name) and on the parameters and x */
const on =
  (fns: RegExp, cond: (pr: Params, x: number, v: Violation) => boolean = () => true) =>
  (v: Violation): boolean =>
    fns.test(fnOf(v)) && cond(v.params, v.x, v);

/** Whether any of the parameters is above hi or below lo (0 and Inf are boundary values, not extremes) */
const extreme = (pr: Params, keys: readonly string[], lo: number, hi: number): boolean =>
  keys.some((k) => {
    const v = pr[k]!;
    return Number.isFinite(v) && v !== 0 && (Math.abs(v) > hi || Math.abs(v) < lo);
  });

/** The value reported in a violation's detail ("= v; ..." or "= v") */
const valueOf = (v: Violation): number => Number(/^= (\S+?)[;,]?(\s|$)/.exec(v.detail)?.[1]);

const ALL = ["range", "complement", "log", "monotone", "roundtrip", "density", "throws", "time", "order"] as const;

export function matchesKnown(k: KnownViolation, v: Violation): boolean {
  const props = typeof k.property === "string" ? [k.property] : k.property;
  return k.family === v.family && props.includes(v.property) && (typeof k.match === "string" ? k.match === v.call : k.match(v));
}

export const knownViolations: KnownViolation[] = [
  // ---- normal, lognormal, uniform, exponential ----
  {
    family: "unif",
    property: ["log", "density"],
    match: (v) =>
      fnOf(v) === "punif" || (fnOf(v) === "dunif" && (v.x - v.params.min!) / (v.params.max! - v.params.min!) < 2 ** -1022),
    reason:
      "punif's log near probability 1 is log(p), not log1p(-other tail): punif(2.1e-275, { lowerTail: false, logP: true }) " +
      "is 0, -2.1e-275 expected; relative errors up to 1e-4 within 1e-12 of 1. Likewise the log of a subnormal p is that " +
      "of p rounded to the subnormal grid, so that its differences do not match dunif: punif(1.0768051632645422e-159, " +
      "{ min: 0, max: 6.99009352385927e156, logP: true }) is -727.1847997661001, -727.18479975404097 expected " +
      "(log x - log max). Kept to match R, which computes log(p) too (fixtures: punif(1e-300, lower.tail = FALSE, " +
      "log.p = TRUE) is 0, punif(0.999, -1, 1, log.p = TRUE) is log(0.9995) rounded, not log1p(-0.0005); R 4.5.2 gives " +
      "-727.18479976610013 for the subnormal case)",
    examples: [
      { params: { min: 0, max: 1 }, x: [2.1074708991110435e-275] },
      { params: { min: 0, max: 6.99009352385927e156 }, x: [1.0757294338307116e-159] },
    ],
  },
  {
    family: "exp",
    property: ["density", "roundtrip"],
    match: (v) =>
      (fnOf(v) === "dexp" && v.params.rate! * v.x < 2 ** -1022) || (fnOf(v) === "qexp" && v.params.rate! * valueOf(v) < 2 ** -1022),
    reason:
      "pexp's log for subnormal rate x loses digits (log(-expm1(-rate x)) of the rounded product, not log(rate) + " +
      "log(x)): pexp(9.530984706928441e-97, { rate: 4.936871737348155e-227, logP: true }); so the round trip of a qexp " +
      "whose answer has a subnormal rate x cannot be confirmed (qexp(7.747165377e-315, { rate: 1.1939971855464353e-219 }) " +
      "is 6.4884285076530645e-96, -log1p(-p) / rate = 6.4884285076530641e-96 to mpmath, where pexp is the same at " +
      "x (1 ∓ 1e-14)). Kept to match R, which computes it so (fixtures: pexp(1e-20, 1e-300, log.p = TRUE) is " +
      "-736.8272408909739, -736.8272297580946 exactly; pexp(1e-300, 1e-300, log.p = TRUE) is -Inf)",
    examples: [{ params: { rate: 4.936871737348155e-227 }, x: [9.530984706928441e-97] }],
  },
  // ---- Weibull, arcsine, triangular, Pareto, Kumaraswamy, inverse gamma ----
  {
    family: "geom",
    property: "roundtrip",
    match: on(/^qgeom$/),
    reason:
      "qgeom's closed form log(1 - p) / log1p(-prob) - 1 with a fixed slack of 1e-12 is one above the test's answer where " +
      "p is the distribution function at x rounded within an ulp or two: qgeom(0.8757104766401955, " +
      "0.0000011843097327690854, { lowerTail: false }) is 112065 where pgeom(112064, ...) gives that p (but (1 - prob)^112065 " +
      "is 0.87571047664019558, above p, so 112065 is the answer for p as given); near p = 1 (qgeom(0.9999999998246265, " +
      "0.14171325019560754) is 147 where pgeom(146, ...) gives p) and for x around 1e9. Kept to match R, which computes " +
      "the same closed form (R 4.5.2 gives 112065, 147, 49 for qgeom(0.9999129723837309, 0.17370360321365297) and 2 for " +
      "qgeom(0.9999999999999999, 0.9999999886719217))",
    examples: [{ params: { prob: 0.0000011843097327690854 }, x: [112064] }],
  },
  // ---- χ², gamma, t, beta, F (central) ----
  {
    family: "f",
    property: ALL,
    match: on(/^[dpq]f$/, (pr) => extreme(pr, ["df1", "df2"], 1e-10, 1e15)),
    reason:
      "extreme df: for huge df (from about 1e15) the incomplete beta function does not resolve the approach to the χ² " +
      "limits: pf(1, 4.97780454911219e+82, 5.169046454871392e+97) is NaN; qf(1.188618725766894e-46, 3.681988559312397e+236, " +
      "2139.330681815907) is 1 (pf(1, ...) is 0.496); df(1, 3.681988559312397e+236, 2139.330681815907) is not the slope " +
      "of pf. For tiny df, quantiles that underflow cannot be confirmed by the round trip: qf(5.530393157225372e-86, " +
      "1.1930862602789481e-234, 7.287200568987145e-276) is 0 (pf(5e-324, ...) is already about df2/(df1 + df2) = 6e-42)",
    examples: [{ params: { df1: 4.97780454911219e82, df2: 5.169046454871392e97 }, x: [1] }],
  },
  ...["f", "nf"].map(
    (family): KnownViolation => ({
      family,
      property: "range",
      match: on(/^df$/, (_pr, x) => x === Infinity),
      reason:
        "df(Infinity, ...) is NaN, 0 expected: df(Infinity, 0.2569224787760626, 18695.725602202554) (for df1 < 2; with ncp " +
        "for any df1). Kept to match R, which gives NaN there too (fixtures: df(Inf, 1.5, 1) and df(Inf, 3, 5, ncp = 0) are NaN)",
      examples: [{ params: { df1: family === "nf" ? 3 : 0.2569224787760626, df2: 412.3959198056142, ...(family === "nf" ? { ncp: 0.32 } : {}) }, x: [Infinity] }],
    }),
  ),
  // ---- discrete ----
  {
    family: "nbinom(mu)",
    property: ALL,
    match: on(/nbinom$/, (pr, x) => extreme(pr, ["size", "mu"], 1e-300, 1e15) || x > 1e100),
    reason:
      "extreme parameters or x: where size and mu are both huge, the relative spread of the distribution (1e-49 for size " +
      "7.9e96, mu 2e132) is below what the double-double arguments of the incomplete beta function resolve: " +
      "pnbinom(2.0074063923101808e+132, 7.935540851960292e+96, { mu: 2.0074063923101808e+132 }) is NaN (about 1/2 " +
      "expected), and qnbinom NaN (qnbinom(1.329008389153242e-57, 3.576114202522741e+144, { mu: 8.763634708385052e+74 }))",
    examples: [{ params: { size: 7.935540851960292e96, mu: 2.0074063923101808e132 }, x: [2.0074063923101808e132] }],
  },
  {
    family: "nbinom(mu)",
    property: "range",
    match: on(/^dnbinom$/, (pr, x) => pr.size === 0 && pr.mu === 0 && x > 0),
    reason:
      "dnbinom(1, 0, { mu: 0 }) is NaN; size = 0 and mu = 0 is the point mass at 0, so 0 expected (-Infinity with log). " +
      "Kept to match R, which gives NaN there too (fixtures: dnbinom(1:4, 0, mu = 0) are NaN)",
    examples: [{ params: { size: 0, mu: 0 }, x: [1] }],
  },
  // ---- noncentral χ², F, beta; Tukey ----
  {
    family: "nbeta",
    property: ALL,
    match: on(/beta$/, (pr) => pr.ncp! > 0 && extreme(pr, ["shape1", "shape2"], 1e-10, 1e10)),
    reason:
      "shapes beyond [1e-10, 1e10] (ncp > 0): for tiny shapes the central incomplete beta function of the mixture's " +
      "components is off (src/special/incbet.ts: I_x(5.89e-241, 3.73e-57) at x = 0.0096 is 0.99999999999996 with its " +
      "complement 1.6e-184), so pbeta(x, 5.89e-241, 3.73e-57, { ncp: 7.96 }) falls from 0.018695982755622172 at " +
      "x = 1.2e-145 to 0.018695982755621832 at x = 0.0096; for a tiny shape with λ/2 above 1e6 the integral over Y does " +
      "not find its mode, flat to the double towards y = 0 (log pbeta(0.5, 8.2e-68, 0.0177, { ncp: 1.3e8 }) is -Infinity, " +
      "about -(λ/2)(1 - x) = -3.2e7 expected); where a shape is huge, the integral over Y does not resolve " +
      "the relative spreads of Y and W (1e-65 and less): both tails of pbeta(5.31e-154, 3.11e130, 6.99e120, { ncp: 0.381 }) " +
      "and of pbeta(8.94e-43, 996.6, 1.0e174, { ncp: 1.79e132 }) are 0",
    examples: [
      { params: { shape1: 5.894864017885108e-241, shape2: 3.732011312647187e-57, ncp: 7.958893208205063 }, x: [1.2374249540046398e-145, 0.009604043327271938] },
      { params: { shape1: 3.105105241289273e130, shape2: 6.991712888026983e120, ncp: 0.3808404615338111 }, x: [5.3056139055482243e-154] },
    ],
  },
  {
    family: "nf",
    property: ALL,
    match: on(/^[dpq]f$/, (pr) => pr.ncp! > 0 && extreme(pr, ["df1", "df2"], 1e-10, 1e10)),
    reason:
      "df beyond [1e-10, 1e10] (ncp > 0), through the noncentral beta (as for nbeta): for a tiny df the central " +
      "incomplete beta function of the components is off (pf(q, 6.63e-202, 2, { ncp: 1 }) falls from 0.6065306597126334 " +
      "at q = 2.1e-130 to 0.6065306597126264 at q = 1.35e-103, where I_x(3.3e-202, 1) is 1.0000000000000158); where a df " +
      "is huge, both tails of pf(1, 6.39e153, 6.32e180, { ncp: 81.8 }) are 0 and df there is NaN; from df2 = 1e15 pf takes " +
      "0.2 s per call there, and qf seconds (qf(exp(-3.79), 314.2, 5.2e16, { ncp: 2393 }), 2 s)",
    examples: [
      { params: { df1: 6.6323017271354765e-202, df2: 2, ncp: 1 }, x: [2.1284149466105694e-130, 1.3499976946715385e-103] },
      { params: { df1: 6.3877677183519304e153, df2: 6.3206222974994505e180, ncp: 81.76981163437114 }, x: [1] },
    ],
  },

  // ncp = 0 is the central distribution (computed by the central functions in src/distributions/f.ts): the central
  // entry above applies
  {
    family: "nf",
    property: ALL,
    match: on(/^[dpq]f$/, (pr) => pr.ncp === 0 && extreme(pr, ["df1", "df2"], 1e-10, 1e15)),
    reason: "ncp = 0 with extreme df: the central F (see the f entry above)",
    examples: [{ params: { df1: 1.5352254500141903e186, df2: 99.33785701936728, ncp: 0 }, x: [5.925999535882428e-161] }],
  },


  {
    family: "f",
    property: "range",
    match: on(/^df$/, (pr) => pr.df1 === Infinity),
    reason:
      "df(4.42353856391398e-263, Infinity, 14.333573434318904) is NaN (df1 = Infinity at tiny x: 0 / 0 once x^2 " +
      "underflows), 0 expected; df(1, Infinity, 14.33) is finite. Kept to match R, which gives NaN there too (fixtures: " +
      "df(1e-300, Inf, 5) is NaN); the log density is finite",
    examples: [{ params: { df1: Infinity, df2: 14.333573434318904 }, x: [4.42353856391398e-263] }],
  },
];
