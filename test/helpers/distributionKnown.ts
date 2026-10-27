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
    property: ["range", "throws"],
    match: on(/geom$/, (_pr, x) => x > 1e200),
    reason:
      "dgeom and pgeom are NaN (or throw TypeError) for x around 1e300: pgeom(8.663961183897879e+299, " +
      "1.1060325197469172e-300) is NaN, 1 - exp(x log1p(-prob)) = 0.616 expected",
    examples: [{ params: { prob: 1.1060325197469172e-300 }, x: [8.663961183897879e299] }],
  },
  {
    family: "geom",
    property: "roundtrip",
    match: on(/^qgeom$/),
    reason:
      "qgeom's closed form log(1 - p) / log1p(-prob) - 1 with a fixed slack of 1e-12 is off by one where its rounding error " +
      "exceeds the slack: qgeom(0.8757104766401955, 0.0000011843097327690854, { lowerTail: false }) is 112065, 112064 " +
      "expected (pgeom(112064, ...) is that p); also near p = 1 and for x around 1e9",
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
    family: "beta",
    property: ALL,
    match: on(/beta$/, (pr) => pr.shape1! < 1e-10 || pr.shape2! < 1e-10),
    reason:
      "tiny shapes: pbeta(1.078577302826644e-285, 1.5597941463167979e-130, 2) is 1.0000000000000195 (above 1); the larger " +
      "tail is off by 1e-14",
    examples: [{ params: { shape1: 1.5597941463167979e-130, shape2: 2 }, x: [1.078577302826644e-285] }],
  },
  {
    family: "f",
    property: ALL,
    match: on(/^[dpq]f$/, (pr) => extreme(pr, ["df1", "df2"], 1e-10, 1e15)),
    reason:
      "extreme df: pf(6.616261056709485e-112, 3.193376520741174e-173, 1867.9657047120206) is 1.0000000000000124 (above 1); " +
      "pf(1e300, 0.169, 1.18e-86, { lowerTail: false }) is 0, about 1 expected; qf for tiny df2 is Infinity or 1 where " +
      "the quantile is finite (qf(2.0956937315626893e-87, 534379.3621049117, 4.0035115818718566e-131, { lowerTail: false })); " +
      "df is NaN for tiny df1 (df(4.633805988965048e-157, 3.193376520741174e-173, 1867.9657047120206))",
    examples: [{ params: { df1: 3.193376520741174e-173, df2: 1867.9657047120206 }, x: [6.616261056709485e-112] }],
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
        "extreme parameters or x: pnbinom(2.6329019116607608e+200, 3.102992688838784e+287, { mu: 195.56831659259922 }) is " +
        "NaN, 1 expected (the continued fraction of the incomplete beta function at both parameters huge); qnbinom is then " +
        "NaN (qnbinom(1.2418608579304552e-133, 1.2440368303321599e+39, { prob: 3.411918904687509e-265 })); for tiny prob " +
        "the tails do not add up to 1 within 1e-14 (pnbinom(6.549300334796171e+214, 0.72772746911027, { prob: " +
        "4.524121951236202e-216 }): 0.3999596206918988 and 0.6000403793081133)",
      examples: [
        family === "nbinom(mu)"
          ? { params: { size: 3.102992688838784e287, mu: 195.56831659259922 }, x: [2.6329019116607608e200] }
          : { params: { size: 0.72772746911027, prob: 4.524121951236202e-216 }, x: [6.549300334796171e214] },
      ],
    },
    {
      family,
      property: ["complement", "monotone", "range"],
      match: on(/nbinom$/, (pr) => pr.size! > 0 && pr.size! < 1e-15),
      reason:
        "tiny size: pnbinom(0, 3.67089151234586e-241, { prob: 0.6815368835814297 }) is 0.9999999999999597, 1 - 1.4e-241 " +
        "expected, and decreases further out (0.9999999999999799 at 1.7e60)",
      examples: [
        { params: family === "nbinom(mu)" ? { size: 1.710538355542234e-94, mu: 0.25618896943625025 } : { size: 3.67089151234586e-241, prob: 0.6815368835814297 }, x: [0] },
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
  {
    family: "f",
    property: "roundtrip",
    match: on(/^qf$/, (_pr, _x, v) => valueOf(v) < 2 ** -1022),
    reason:
      "pf at subnormal x is 0 or loses digits, so subnormal quantiles are wrong or cannot be confirmed: qf(9.593069285029728e-169, " +
      "1.0433869454565992, 206159.4104536305) is 5.43e-319 where pf is already 1.0e-166",
    examples: [{ params: { df1: 1.0433869454565992, df2: 206159.4104536305 }, x: [5.43275e-319] }],
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
      "shapes beyond [1e-10, 1e10] (ncp > 0): for tiny shapes the mixture's central incomplete beta function is off " +
      "(pbeta(0.0694, 7.39e-69, 8.94, { ncp: 105.43, lowerTail: false }) is 1.0000000000000002; the two tails of " +
      "pbeta(6.3e-135, 3.8e-291, 3.92e-190, { ncp: 0.0121 }) add up to 0.503; pbeta(1.83e-241, 1.59e-262, 3.96e-163, " +
      "{ ncp: 2800.9 }) is NaN) or throws TypeError in ddLog; where both shapes are huge, the integral over Y does not " +
      "resolve their relative spreads of 1e-92: both tails of pbeta(8.46e-245, 1.77e183, 4.15e186, { ncp: 1 }) are 0",
    examples: [{ params: { shape1: 7.394731865684941e-69, shape2: 8.939495036867422, ncp: 105.42996507071281 }, x: [0.06935494532808661] }],
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

  // ---- found with the fuzz script at moderate parameters ----
  ...(
    [
      ["binom", "qbinom(0.7985148925910792, 21, 0.9265496833249927) is 21 where pbinom(20, ...) is exactly that p", { size: 21, prob: 0.9265496833249927 }, 20],
      ["nbinom(prob)", "qnbinom(0.7919311160429315, 16.7480243029891, { prob: 0.9105234742164612, lowerTail: false }) is 1 where pnbinom(0, ..., { lowerTail: false }) is exactly that p", { size: 16.7480243029891, prob: 0.9105234742164612 }, 0],
    ] as const
  ).map(
    ([family, example, params, x]): KnownViolation => ({
      family,
      property: "roundtrip",
      match: on(/^q/),
      reason: `the quantile is one too large at a p that the distribution function gives exactly at x: ${example}, x expected`,
      examples: [{ params, x: [x] }],
    }),
  ),
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
