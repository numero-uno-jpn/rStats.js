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
    property: "log",
    match: on(/^punif$/),
    reason:
      "punif's log near probability 1 is log(p), not log1p(-other tail): punif(2.1e-275, { lowerTail: false, logP: true }) " +
      "is 0, -2.1e-275 expected; relative errors up to 1e-4 within 1e-12 of 1. Kept to match R, which computes log(p) " +
      "too (fixtures: punif(1e-300, lower.tail = FALSE, log.p = TRUE) is 0, punif(0.999, -1, 1, log.p = TRUE) is " +
      "log(0.9995) rounded, not log1p(-0.0005))",
    examples: [{ params: { min: 0, max: 1 }, x: [2.1074708991110435e-275] }],
  },
  {
    family: "exp",
    property: "density",
    match: on(/^dexp$/, (pr, x) => pr.rate! * x < 2 ** -1022),
    reason:
      "pexp's log for subnormal rate x loses digits (log(-expm1(-rate x)) of the rounded product, not log(rate) + " +
      "log(x)): pexp(9.530984706928441e-97, { rate: 4.936871737348155e-227, logP: true }). Kept to match R, which " +
      "computes it so (fixtures: pexp(1e-20, 1e-300, log.p = TRUE) is -736.8272408909739, -736.8272297580946 exactly; " +
      "pexp(1e-300, 1e-300, log.p = TRUE) is -Inf)",
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
    family: "nt",
    property: ALL,
    match: on(/^[dpq]t$/, (pr) => pr.df! > 1e30 && Number.isFinite(pr.df!)),
    reason:
      "huge df (from about 1e30) with ncp: pt(-1.0255872288729821e+294, 5.791529101318887e+33, { ncp: 1e-84 }) is Infinity",
    examples: [{ params: { df: 1e120, ncp: 1 }, x: [-3.5346299778784046e115] }],
  },
  {
    family: "nt",
    property: ALL,
    match: on(/^[dpq]t$/, (pr) => pr.df! < 1e-15),
    reason:
      "tiny df with ncp: the tails do not add up: pt(-59193519471.86663, 1.9146506048870366e-245, " +
      "{ ncp: -1.8387038943733192 }) is 1.2e-227 and its upper tail 0.033",
    examples: [{ params: { df: 1.9146506048870366e-245, ncp: -1.8387038943733192 }, x: [-59193519471.86663] }],
  },
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
  ...["nbinom(prob)", "nbinom(mu)"].flatMap((family): KnownViolation[] => [
    {
      family,
      property: ALL,
      match: on(/nbinom$/, (pr, x) =>
        extreme(pr, ["size", "mu"], 1e-300, 1e15) || (pr.prob ?? 1) < 1e-15 || x > 1e100,
      ),
      reason:
        "extreme parameters or x: where size and mu are both huge, the relative spread of the distribution (1e-49 for size " +
        "7.9e96, mu 2e132) is below what the double-double arguments of the incomplete beta function resolve: " +
        "pnbinom(2.0074063923101808e+132, 7.935540851960292e+96, { mu: 2.0074063923101808e+132 }) is NaN (about 1/2 " +
        "expected), and qnbinom NaN (qnbinom(1.329008389153242e-57, 3.576114202522741e+144, { mu: 8.763634708385052e+74 })); " +
        "for prob near 1e-300 the upper tail far out is NaN (pnbinom(1e303, 641.0457517358916, { prob: 8.999877024359508e-300, " +
        "lowerTail: false }), 0 expected), and so is qnbinom(4.073478073311389e-242, 641.0457517358916, { prob: " +
        "8.999877024359508e-300, lowerTail: false })",
      examples: [
        family === "nbinom(mu)"
          ? { params: { size: 7.935540851960292e96, mu: 2.0074063923101808e132 }, x: [2.0074063923101808e132] }
          : { params: { size: 641.0457517358916, prob: 8.999877024359508e-300 }, x: [1e303] },
      ],
    },
  ]),
  {
    family: "nbinom(mu)",
    property: "range",
    match: on(/^dnbinom$/, (pr, x) => pr.size === 0 && pr.mu === 0 && x > 0),
    reason:
      "dnbinom(1, 0, { mu: 0 }) is NaN; size = 0 and mu = 0 is the point mass at 0, so 0 expected (-Infinity with log). " +
      "Kept to match R, which gives NaN there too (fixtures: dnbinom(1:4, 0, mu = 0) are NaN)",
    examples: [{ params: { size: 0, mu: 0 }, x: [1] }],
  },
  ...["nt", "nchisq", "nf", "nbeta"].map(
    (family): KnownViolation => ({
      family,
      property: ["range", "monotone"],
      match: on(/^p/, (_pr, _x, v) => {
        const p = valueOf(v);
        return v.property === "monotone" || (p > 1 && p < 1 + 1e-13);
      }),
      reason:
        "a tail probability a few ulps above 1 (the larger tail is not 1 - (smaller)): pt(3428773.6947873095, 52.80813184100357, " +
        "{ ncp: 3.6452526524836575 }) is 1.0000000000000002; pchisq(763.6617468878705, 2, { ncp: 16.99599089257515 }) the same",
      examples: [
        {
          nt: { params: { df: 52.80813184100357, ncp: 3.6452526524836575 }, x: [3428773.6947873095] },
          nchisq: { params: { df: 2, ncp: 16.99599089257515 }, x: [763.6617468878705] },
          nf: { params: { df1: 456.14174201689434, df2: 771.5785513038477, ncp: 26.634566720706474 }, x: [2.473952189555483] },
          nbeta: { params: { shape1: 0.5, shape2: 0.4399301350869252, ncp: 287.25848611940876 }, x: [9.867288258188533e-299] },
        }[family]!,
      ],
    }),
  ),
  // ---- noncentral χ², F, beta; Tukey ----
  {
    family: "nbeta",
    property: ALL,
    match: on(/beta$/, (pr) => pr.ncp! > 0 && extreme(pr, ["shape1", "shape2"], 1e-10, 1e10)),
    reason:
      "shapes beyond [1e-10, 1e10] (ncp > 0): for tiny shapes the Poisson mixture is off (the two tails of " +
      "pbeta(1.1503720176314804e-213, 9.945391091428387e-228, 173.12594454685888, { ncp: 34.07827321668406 }) add up to " +
      "1 - 1.7e-14; pbeta(6.3e-135, 3.8e-291, 3.92e-190, { ncp: 0.0121 }) and pbeta(1.83e-241, 1.59e-262, 3.96e-163, " +
      "{ ncp: 2800.9 }) are NaN) or throws TypeError in ddLog; where both shapes are huge, the integral over Y does not " +
      "resolve their relative spreads of 1e-92: both tails of pbeta(8.46e-245, 1.77e183, 4.15e186, { ncp: 1 }) are 0",
    examples: [{ params: { shape1: 9.945391091428387e-228, shape2: 173.12594454685888, ncp: 34.07827321668406 }, x: [1.1503720176314804e-213] }],
  },
  {
    family: "nf",
    property: ALL,
    match: on(/^[dpq]f$/, (pr) => pr.ncp! > 0 && extreme(pr, ["df1", "df2"], 1e-10, 1e10)),
    reason:
      "df beyond [1e-10, 1e10] (ncp > 0), through the noncentral beta (as for nbeta): pf(7.33e-248, 1.14e-218, 1, " +
      "{ ncp: 12.34, lowerTail: false, logP: true }) is -0.0020873, log of the linear value -0.0020895; " +
      "pf(7.67e-114, 4.79e-248, 5.62e-71, { ncp: 1 }) is NaN; TypeError in ddLog for tiny df; df is NaN for a huge df1 " +
      "with a tiny df2 (df(8.5e147, 4.97e118, 1.04e-57, { ncp: 4.01e87 }))",
    examples: [{ params: { df1: 1.1415699806958447e-218, df2: 1, ncp: 12.343768528437282 }, x: [7.327311511990816e-248] }],
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
