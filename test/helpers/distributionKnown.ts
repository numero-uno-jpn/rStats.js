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
    family: "lnorm",
    property: "log",
    match: on(/^dlnorm$/, (_pr, x) => x < 1e-10),
    reason:
      "dlnorm loses digits far in the left tail: dlnorm(1.994886988462406e-105, { meanlog: 1.5255962912530279, sdlog: " +
      "6.3597796759296115 }) is exp(-489.2844599522524), the log density -489.2844596759455 is right (relative error 2.8e-7)",
    examples: [{ params: { meanlog: 1.5255962912530279, sdlog: 6.3597796759296115 }, x: [1.994886988462406e-105] }],
  },
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
      "pexp's log for subnormal rate x loses digits (log(-expm1(-rate x)), not log(rate) + log(x)): " +
      "pexp(9.530984706928441e-97, { rate: 4.936871737348155e-227, logP: true })",
    examples: [{ params: { rate: 4.936871737348155e-227 }, x: [9.530984706928441e-97] }],
  },
  // ---- Weibull, arcsine, triangular, Pareto, Kumaraswamy, inverse gamma ----
  {
    family: "arcsine",
    property: ["roundtrip", "density"],
    match: on(/arcsine$/, (pr, x, v) => (v.property === "roundtrip" ? x < 1e-100 : (x - pr.a!) / (pr.b! - pr.a!) < 1e-290)),
    reason:
      "(x - a) / (b - a) and sin^2 underflow: qarcsine(1.7053740454118274e-208, { a: 0, b: 2.6427604573393012e+187 }) " +
      "is 0, b (π p / 2)^2 = 1.9e-228 expected; parcsine loses digits when the ratio is subnormal",
    examples: [{ params: { a: 0, b: 2.6427604573393012e187 } }],
  },
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
  {
    family: "invgamma",
    property: ALL,
    match: on(/invgamma$/, (pr) => pr.alpha! > 1e15),
    reason:
      "large alpha: pinvgamma(2.403439191651939e-65, 1.527471870384886e+67, { beta: 367.1185757428926 }) is 8.09e16, " +
      "pgamma(beta / x, alpha, { lowerTail: false }) = 0.5 expected, so qinvgamma's quantiles (beta / qgamma) cannot be " +
      "confirmed; dinvgamma is NaN for x around 1e136 with alpha 1.4e202",
    examples: [{ params: { alpha: 1.527471870384886e67, beta: 367.1185757428926 } }],
  },
  {
    family: "invgamma",
    property: "roundtrip",
    match: on(/^qinvgamma$/, (pr, _x, v) => v.detail.startsWith("= Infinity") || pr.beta! / valueOf(v) < 2 ** -1022),
    reason:
      "qinvgamma's upper tail where the gamma quantile beta / x is subnormal or underflows: qinvgamma(2.431739343042036e-199, " +
      "0.5, { beta: 3.325020537939267e-102, lowerTail: false }) is Infinity, beta / (p Γ(1.5))^2 = 7.2e295 expected " +
      "(qgamma(p, 0.5) is 0 there); qinvgamma(5.017353909284426e-160, 0.5, { beta: 4.3249964967109584e-165, lowerTail: false }) " +
      "is off by 8e-7 relative (qgamma(p, 0.5) = 1.98e-319 is subnormal)",
    examples: [{ params: { alpha: 0.20663543805092938, beta: 5.045560860879713e-226 } }, { params: { alpha: 0.5, beta: 1e-300 } }],
  },
  // ---- χ², gamma, t, beta, F (central) ----
  ...["gamma(rate)", "gamma(scale)"].flatMap((family): KnownViolation[] => [
    {
      family,
      property: ["roundtrip", "density", "log"],
      match: on(/gamma$/, (pr, x, v) =>
        v.property === "roundtrip" ? v.detail.startsWith("= 0;") : x / (pr.scale ?? 1 / pr.rate!) < 2 ** -1022,
      ),
      reason:
        "x / scale underflows to a subnormal or 0: pgamma(2e-323, 0.0548, { rate: 0.045 }) is 0, (rate x)^shape / " +
        "Γ(shape + 1) = 1.6e-18 expected (so a quantile that rounds to 0 cannot be confirmed); the log loses digits",
      examples: [{ params: { shape: 0.054834562146833105, rate: 0.04511610840333119 }, x: [2e-323] }],
    },
  ]),
  ...["t"].flatMap((family): KnownViolation[] => [
    {
      family,
      property: ALL,
      match: on(/^[dpq]t$/, (pr) => pr.df! > 1e30 && Number.isFinite(pr.df!)),
      reason:
        "huge df (from about 1e30): pt(-3.5346299778784046e+115, 1.8931460816013525e+290) is NaN (0 expected) or throws " +
        "TypeError; with ncp pt(-1.0255872288729821e+294, 5.791529101318887e+33, { ncp: 1e-84 }) is Infinity; " +
        "qt(9.216872914669392e-16, 8.973812795594767e+243) is 0, qnorm(p) = -7.95 expected; qt(1.6e-243, 1e120) is -1.13 " +
        "(pt there 0.129)",
      examples: [{ params: { df: 1e120, ...(family === "nt" ? { ncp: 1 } : {}) }, x: [-3.5346299778784046e115] }],
    },
    {
      family,
      property: ALL,
      match: on(/^[dpq]t$/, (pr) => pr.df! < 1e-15),
      reason:
        "tiny df: pt(-5.047172795936206, 2.4305283208746584e-242) is 0.49999999999998995 but 0.5 further out (not monotone; " +
        "0.5 to double precision expected); with ncp the tails do not add up: pt(-59193519471.86663, 1.9146506048870366e-245, " +
        "{ ncp: -1.8387038943733192 }) is 1.2e-227 and its upper tail 0.033",
      examples: [
        family === "nt"
          ? { params: { df: 1.9146506048870366e-245, ncp: -1.8387038943733192 }, x: [-59193519471.86663] }
          : { params: { df: 2.4305283208746584e-242 }, x: [-5.047172795936206, -2.061482495385393e107] },
      ],
    },
  ]),
  // ncp = 0 is the central distribution (computed by the central functions in src/distributions/t.ts): the t entries
  // above apply
  {
    family: "nt",
    property: ALL,
    match: on(/^[dpq]t$/, (pr) => pr.ncp === 0 && ((pr.df! > 1e30 && Number.isFinite(pr.df!)) || pr.df! < 1e-15)),
    reason: "ncp = 0 with huge or tiny df: the central t (see the t entries above)",
    examples: [{ params: { df: 7.653487633524523e-162, ncp: 0 }, x: [-1.1511455640671718e-50, -1.2128120784753087e-125] }],
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
      "is huge, both tails of pf(1, 6.39e153, 6.32e180, { ncp: 81.8 }) are 0 and df there is NaN",
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
