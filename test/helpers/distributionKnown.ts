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
    family: "norm",
    property: "range",
    match: on(/^[dp]norm$/, (pr, x) => Math.abs(x - pr.mean!) / pr.sd! > 1e300),
    reason:
      "NaN when (x - mean) / sd is near the overflow threshold: pnorm(1.68e291, { mean: -304.67, sd: 1.12e-17 }) " +
      "is NaN (1 expected), dnorm the same (0 expected)",
    examples: [{ params: { mean: -304.67, sd: 1.12e-17 }, x: [1.68e291] }],
  },
  {
    family: "lnorm",
    property: "range",
    match: on(/^qlnorm$/, (pr) => pr.sdlog! > 1e15),
    reason:
      "qlnorm's upper tail is -Infinity when meanlog + sdlog z overflows: qlnorm(1e-7, { sdlog: 1e100, lowerTail: false }) " +
      "is -Infinity, Infinity expected",
    examples: [{ params: { meanlog: 0, sdlog: 1e100 } }],
  },
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
      "is 0, -2.1e-275 expected; relative errors up to 1e-4 within 1e-12 of 1",
    examples: [{ params: { min: 0, max: 1 }, x: [2.1074708991110435e-275] }],
  },
  {
    family: "unif",
    property: "roundtrip",
    match: on(/^qunif$/, (_pr, _x, v) => v.call.includes("lowerTail: false")),
    reason: "qunif's upper tail is min + (1 - p)(max - min): qunif(3.7e-216, { min: -1, max: 0, lowerTail: false }) is 0, -3.7e-216 expected",
    examples: [{ params: { min: -1, max: 0 } }],
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
    family: "weibull",
    property: "throws",
    match: on(/^[dp]weibull$/),
    reason:
      "TypeError from ddLog when x / scale underflows to 0 or overflows: dweibull(1e-300, 2, { scale: 1e100 }), " +
      "pweibull(2e-323, 0.5, { scale: 10 }), pweibull(1.7e308, 1e-20, { scale: 0.1, lowerTail: false }) throw",
    examples: [{ params: { shape: 2, scale: 1e100 }, x: [1e-300] }],
  },
  {
    family: "weibull",
    property: "range",
    match: on(/^dweibull$/, (pr) => pr.shape! > 1e50),
    reason: "dweibull is NaN for a huge shape: dweibull(1.2e-293, 6.8e254, { scale: 2.6e-293 }) is NaN, 0 expected",
    examples: [{ params: { shape: 6.8e254, scale: 2.6e-293 }, x: [1.2e-293] }],
  },
  {
    family: "weibull",
    property: ["density", "log", "roundtrip"],
    match: on(/weibull$/),
    reason:
      "subnormal intermediates lose digits: (x / scale)^shape below 2^-1022 in pweibull's log, p^(1 / shape) in qweibull: " +
      "qweibull(2.0873605415528046e-162, 0.5, { scale: 379.78228278051154 }) is 1.877e-321, 1.66e-321 expected",
    examples: [{ params: { shape: 2, scale: 639.1605591752661 }, x: [1.0806026394113126e-157] }],
  },
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
    family: "triang",
    property: ALL,
    match: on(/triang$/, (pr) => pr.b! - pr.a! > 1e150),
    reason:
      "(b - a)(c - a) overflows for wide intervals: ptriang(2.4424154074773638e+184, { a: -22.463868531113192, " +
      "b: 2.0965034859876516e+185, c: 7.278558690233114e+184 }) is NaN, 0.0390 expected; qtriang returns ±Infinity",
    examples: [{ params: { a: -22.463868531113192, b: 2.0965034859876516e185, c: 7.278558690233114e184 } }],
  },
  {
    family: "triang",
    property: ALL,
    match: on(/triang$/, (pr) => pr.b! - pr.a! < 1e-140),
    reason:
      "products underflow for narrow intervals: dtriang(0, { a: 0, b: 2.362486118430361e-229, c: 2.362486118430361e-229 }) " +
      "is NaN, 0 expected; ptriang is above 1 near b",
    examples: [{ params: { a: 0, b: 2.362486118430361e-229, c: 2.362486118430361e-229 }, x: [0] }],
  },
  {
    family: "triang",
    property: ["range", "roundtrip", "density", "log"],
    match: on(/triang$/, (pr, x, v) =>
      fnOf(v) === "qtriang"
        ? pr.c === pr.a || pr.c === pr.b || x < 1e-30 || v.call.includes("logP: true")
        : (x - pr.a!) / (pr.b! - pr.a!) < 1e-150 || x - pr.a! < 1.5e-154,
    ),
    reason:
      "cancellation and underflow near a: qtriang(2.5e-182, { a: 0, b: 141, c: 0 }) is 0, 141 p / 2 = 1.76e-180 expected " +
      "(b - (b - a) sqrt(1 - p)); with a > 0 the result can fall below a, and for c = a it loses digits (relative 1e-7 at " +
      "qtriang(2.4861429152022987e-10, { a: 0.026014183705880798, b: 48.595997168949395, c: 0.026014183705880798 })); " +
      "ptriang's (x - a)^2 underflows",
    examples: [{ params: { a: 0, b: 141, c: 0 } }],
  },
  {
    family: "pareto",
    property: ["roundtrip", "complement", "log", "density", "monotone", "range"],
    match: on(/pareto$/, (pr, x, v) =>
      fnOf(v) === "qpareto" ? true : pr.b! / x < 2 ** -1022 || pr.a! < 1e-30 || pr.a! > 1e12 || pr.b! < 1e-200,
    ),
    reason:
      "ppareto's upper tail is 0 when b / x is subnormal (ppareto(1.7e308, { a: 0.5, b: 0.147, lowerTail: false }) is 0, " +
      "2.94e-155 expected) and its lower tail is 1 for tiny a; for a > 1e12 log(x / b) is not log1p((x - b) / b) " +
      "(ppareto(6918267127725.448, { a: 2925352522038695, b: 6918267127725.422 }): lower + upper - 1 = -8.8e-8); for " +
      "b below 1e-200 b^a underflows (dpareto(7.381852998173452e-208, { a: 3.8584050302230875, b: 5.8963229972762575e-291 }) " +
      "is off by 1.5e-5 relative)",
    examples: [{ params: { a: 0.5, b: 0.147 }, x: [1.7e308] }, { params: { a: 2925352522038695, b: 6918267127725.422 }, x: [6918267127725.448] }],
  },
  {
    family: "kumar",
    property: ALL,
    match: on(/kumar$/, (pr) => pr.b! > 1e9),
    reason:
      "pkumar's upper tail and log for large b (above 1e9 relative errors 1e-12 to 1e-3; above 1e15 out of range): pkumar(0.37133675925961757, 53.00336661461517, 3.74883649682607e+24, " +
      "{ lowerTail: false }) is -57.9, exp(b log1p(-x^a)) = 2.62e-26 expected; pkumar(1e-21, 1, 1e25, { logP: true }) is " +
      "NaN (-e^-10000 expected); pkumar(1e-21, 1, 1e21, { logP: true }) is -0.693, log(0.632) = -0.459 expected; " +
      "qkumar(3.167816805805275e-260, 4193.829732917642, 1.031067914309409e+75) is 0, exp((log p - log b) / a) = 0.8325 expected",
    examples: [{ params: { a: 53.00336661461517, b: 3.74883649682607e24 } }, { params: { a: 1, b: 1e25 }, x: [1e-21] }, { params: { a: 1, b: 1e21 }, x: [1e-21] }],
  },
  {
    family: "kumar",
    property: ["roundtrip", "log", "density", "complement", "monotone", "range"],
    match: on(/kumar$/, (pr) => pr.a! < 1e-10 || pr.a! > 1e15),
    reason:
      "extreme a: x^a rounds to 1 or underflows; qkumar(1.2e-11, 4.8e-12, 0.5, { lowerTail: false }) is 1, " +
      "exp(-p^(1 / b) / a) = 1 - 3e-11 expected",
    examples: [{ params: { a: 4.8e-12, b: 0.5 } }],
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
    property: ["range", "throws", "roundtrip"],
    match: on(/invgamma$/, (pr, x, v) =>
      fnOf(v) === "qinvgamma" ? v.detail.startsWith("= Infinity") : pr.beta! / x < 1e-200 || pr.beta! > 1e100 || pr.beta! < 1e-200,
    ),
    reason:
      "beta / x underflows: dinvgamma(5.20010667081513e+152, 1, { beta: 2.795663805653832e-192, log: true }) is NaN, " +
      "log(beta) - 2 log(x) = -1143.7 expected; pinvgamma(1.7e308, 0.15027305543499947, { beta: 8.75984919070316e-25, " +
      "lowerTail: false }) is 0, (beta / x)^alpha / Γ(alpha + 1) = 1.6e-50 expected (so a quantile beyond the largest " +
      "double cannot be confirmed); TypeError for alpha and beta around 1e200",
    examples: [{ params: { alpha: 1, beta: 2.795663805653832e-192 }, x: [5.20010667081513e152] }],
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
  ...["t", "nt"].flatMap((family): KnownViolation[] => [
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
      reason: "df(Infinity, ...) is NaN, 0 expected: df(Infinity, 0.2569224787760626, 18695.725602202554)",
      examples: [{ params: { df1: 3, df2: 412.3959198056142, ...(family === "nf" ? { ncp: 0.32 } : {}) }, x: [Infinity] }],
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
    reason: "dnbinom(1, 0, { mu: 0 }) is NaN; size = 0 and mu = 0 is the point mass at 0, so 0 expected (-Infinity with log)",
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
  ...(
    [
      ["nchisq", ["df", "ncp"], "qchisq(-540.03, 12.208291652901835, { ncp: 3.6217639322648935e+30, logP: true }), dchisq(2.74411393140549e+62, 249793.9932751507, { ncp: 5.444811654742161e-245 })"],
      ["nf", ["df1", "df2", "ncp"], "qf(9.423429403249297e-250, 1.8411616538629063, 3.908407098865747e+188, { ncp: 198.72404032716406, lowerTail: false }), qf(0.07404623872624663, 2, 0.38811687804355227, { ncp: 6.39113448329404e+269, lowerTail: false })"],
      ["nbeta", ["shape1", "shape2", "ncp"], "qbeta(4.8413814407701786e-293, 3.977300675482711e+243, 2, { ncp: 0 }), qbeta(5.3577955561017315e-43, 79.32204890240992, 0.09403994879604119, { ncp: 1.245630132105305e+22 })"],
    ] as const
  ).map(
    ([family, keys, examples]): KnownViolation => ({
      family,
      property: ALL,
      match: on(/./, (pr) => extreme(pr, keys, 1e-10, 1e10)),
      reason:
        `parameters beyond [1e-10, 1e10]: calls not made in the test, since many do not return (${examples}); the fuzz ` +
        "script finds NaN, values outside [0, 1] and TypeErrors there too",
      exclude: (_kind, _x, pr) => extreme(pr, keys, 1e-10, 1e10),
    }),
  ),
  {
    family: "nchisq",
    property: "time",
    match: on(/chisq$/, (pr, x) => x * pr.ncp! > 4e18),
    reason:
      "pchisq with ncp does not return in the Bessel branch (x ncp > 4e18) for large df: pchisq(1.1e10, 1e10, { ncp: 1e9 }) " +
      "and pchisq(2.0003e9, 3e5, { ncp: 2e9 }) (over 15 s; 40 ms for df up to 1e5); qchisq takes 1-2 s for ncp around " +
      "2e9 (qchisq(1e-100, 1e4, { ncp: 2e9 })); not made in the test",
    exclude: (kind, x, pr) => (kind === "q" ? pr.ncp! > 1e8 : kind === "p" && x * pr.ncp! > 4e18 && pr.df! > 5e4),
  },
  {
    family: "nchisq",
    property: "range",
    match: on(/^dchisq$/, (pr, x) => x * pr.ncp! > 4e18),
    reason:
      "dchisq with ncp is NaN in the Bessel branch for large df: dchisq(1.1e10, 1e10, { ncp: 1e9, log: true }) and " +
      "dchisq(2.0001e9, 1e6, { ncp: 2e9, log: true }) are NaN",
    examples: [
      { params: { df: 1e10, ncp: 1e9 }, x: [1.1e10] },
      { params: { df: 1e6, ncp: 2e9 }, x: [2.0001e9] },
    ],
  },

  // ---- found with the fuzz script at moderate parameters ----
  {
    family: "invgamma",
    property: ["range", "monotone"],
    match: on(/^pinvgamma$/, (pr, x, v) => v.property === "monotone" || pr.beta! / x > 1e12),
    reason:
      "pinvgamma's log is positive when beta / x is huge: pinvgamma(3.6506154146302763e-16, 35.87186122146188, " +
      "{ beta: 269.8924867108752, logP: true }) is 2.8e56, pgamma(beta / x, alpha, { lowerTail: false, logP: true }) = " +
      "-7.4e17 expected",
    examples: [{ params: { alpha: 35.87186122146188, beta: 269.8924867108752 }, x: [3.6506154146302763e-16] }],
  },
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
    family: "triang",
    property: ["range", "monotone"],
    match: on(/^ptriang$/, (_pr, _x, v) => v.property === "monotone" || (valueOf(v) > 1 && valueOf(v) < 1 + 1e-13)),
    reason:
      "a tail an ulp above 1: ptriang(54.365036307212875, { a: 51.80896011403241, b: 54.36503630721428, c: 52.30157068741966 }) " +
      "is 1.0000000000000002",
    examples: [{ params: { a: 51.80896011403241, b: 54.36503630721428, c: 52.30157068741966 }, x: [54.365036307212875] }],
  },
  {
    family: "f",
    property: "range",
    match: on(/^df$/, (pr) => pr.df1 === Infinity),
    reason: "df(4.42353856391398e-263, Infinity, 14.333573434318904) is NaN (df1 = Infinity at tiny x); df(1, Infinity, 14.33) is finite",
    examples: [{ params: { df1: Infinity, df2: 14.333573434318904 }, x: [4.42353856391398e-263] }],
  },
];
