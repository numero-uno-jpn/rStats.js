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
      "pgamma(beta / x, alpha, { lowerTail: false }) = 0.5 expected; qinvgamma's upper tail does not return for alpha " +
      "around 1e17 (qinvgamma(8.561849062297012e-10, 68795589720441740000, { beta: 3.5954869304357335e-198, lowerTail: false }))",
    examples: [{ params: { alpha: 1.527471870384886e67, beta: 367.1185757428926 } }],
    exclude: (kind, _x, pr) => kind === "q" && pr.alpha! > 1e15,
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
  {
    family: "chisq",
    property: ALL,
    match: on(/chisq$/, (pr) => pr.df! > 1e15),
    reason:
      "huge df: pchisq(3.161055179390935e+256, 8.697626929131906e+252) is NaN, 1 expected; qchisq is off, throws TypeError " +
      "(df above 1e150) or takes 1-2 s (df above 1e70); qchisq(-52.93, 2428784754292026400, { logP: true }) does not return",
    examples: [{ params: { df: 8.697626929131906e252 }, x: [3.161055179390935e256] }],
    exclude: (kind, _x, pr) => kind === "q" && pr.df! > 1e15,
  },
  ...["gamma(rate)", "gamma(scale)"].flatMap((family): KnownViolation[] => [
    {
      family,
      property: ALL,
      match: on(/gamma$/, (pr) => pr.shape! > 1e15),
      reason:
        "huge shape: pgamma(4.083839400055824e+172, 5.309225446733691e+163, { rate: 0.0012716221973754155 }) is NaN, " +
        "1 expected; qgamma is off and slow, and qgamma(-52.45, 119226008529095940, { scale: 7.14, logP: true }) does " +
        "not return; dgamma throws TypeError for shape around 1e183",
      examples: [{ params: { shape: 5.309225446733691e163, rate: 0.0012716221973754155 }, x: [4.083839400055824e172] }],
      exclude: (kind, _x, pr) => kind === "q" && pr.shape! > 1e15,
    },
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
    match: on(/beta$/, (pr) => pr.shape1! > 1e15 || pr.shape2! > 1e15),
    reason:
      "huge shapes: pbeta(5.120716175636001e-280, 1.0352246639693515e+190, 6.2918828463792074e+193, { logP: true }) is NaN; " +
      "qbeta returns 0.75 there, throws TypeError (qbeta(9.334322569622605e-85, 3.999342658055056e+204, 1)) or does not " +
      "return (qbeta(8.778764095654974e-96, 5.376836280643888, 9.006258581539712e+283))",
    examples: [{ params: { shape1: 1.0352246639693515e190, shape2: 6.2918828463792074e193 }, x: [5.120716175636001e-280] }],
    exclude: (kind, _x, pr) => kind === "q" && (pr.shape1! > 1e15 || pr.shape2! > 1e15),
  },
  {
    family: "beta",
    property: ALL,
    match: on(/beta$/, (pr) => pr.shape1! < 1e-10 || pr.shape2! < 1e-10),
    reason:
      "tiny shapes: pbeta(1.078577302826644e-285, 1.5597941463167979e-130, 2) is 1.0000000000000195 (above 1); the larger " +
      "tail is off by 1e-14; dbeta and qbeta throw TypeError (dbeta(2.739884385782668e-289, 7.460679824918593e-126, " +
      "7.634632923335423e-180))",
    examples: [{ params: { shape1: 1.5597941463167979e-130, shape2: 2 }, x: [1.078577302826644e-285] }],
  },
  {
    family: "f",
    property: ALL,
    match: on(/^[dpq]f$/, (pr) => extreme(pr, ["df1", "df2"], 1e-10, 1e15)),
    reason:
      "extreme df: pf(5.925999535882428e-161, 1.5352254500141903e+186, 99.33785701936728) is NaN, 0 expected; " +
      "pf(1e300, 0.169, 1.18e-86, { lowerTail: false }) is 0, about 1 expected; pf is above 1; qf is off, throws TypeError " +
      "or does not return (qf(2.0518364426170894e-207, 6.591717355238955e+76, 3); pf(0.99999999999999, " +
      "1.9650315763119397e+288, 0.5370666120548222); pf(2.496810009129591e-97, 1.6914000120615383e+80, 2.67741530170955e-95))",
    examples: [{ params: { df1: 1.5352254500141903e186, df2: 99.33785701936728 }, x: [5.925999535882428e-161] }],
    exclude: (kind, _x, pr) =>
      (kind === "q" || pr.df1! > 1e100 || (pr.df1! > 1e15 && pr.df2! < 1e-10)) && extreme(pr, ["df1", "df2"], 1e-10, 1e15),
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
    family: "pois",
    property: ALL,
    match: on(/pois$/, (pr) => pr.lambda! > 1e15),
    reason:
      "huge lambda: ppois(3.400935567303781e+240, 5.54101330048476e+241) is NaN, 0 expected; qpois does not return for " +
      "lambda around 1e20 (qpois(5.678138243114416e-54, 32801123463837233000, { lowerTail: false }))",
    examples: [{ params: { lambda: 5.54101330048476e241 }, x: [3.400935567303781e240] }],
    exclude: (kind, _x, pr) => kind === "q" && pr.lambda! > 1e15,
  },
  ...["nbinom(prob)", "nbinom(mu)"].flatMap((family): KnownViolation[] => [
    {
      family,
      property: ALL,
      match: on(/nbinom$/, (pr, x) =>
        extreme(pr, ["size", "mu"], 1e-300, 1e15) || (pr.prob ?? 1) < 1e-15 || x > 1e100,
      ),
      reason:
        "extreme parameters or x: pnbinom(5.312647942870648e+171, 0.013666599619527478, { prob: 0.03615475841797888 }) is " +
        "NaN, 1 expected; pnbinom(660, 3.102992688838784e+287, { mu: 195.56831659259922 }) is NaN; qnbinom throws TypeError " +
        "for size above 1e150 and does not return for huge mu or size or tiny size (qnbinom(2.7310066097710254e-299, " +
        "6.0104102662856364e+178, { mu: 0.34891747044274307 }), qnbinom(1.5691356852884617e-293, 2.7623800274362807e-255, " +
        "{ mu: 53.58082374975206, lowerTail: false }))",
      examples: [
        family === "nbinom(mu)"
          ? { params: { size: 3.102992688838784e287, mu: 195.56831659259922 }, x: [660] }
          : { params: { size: 0.013666599619527478, prob: 0.03615475841797888 }, x: [5.312647942870648e171] },
      ],
      exclude: (kind, _x, pr) => kind === "q" && (extreme(pr, ["size", "mu"], 1e-15, 1e15) || (pr.prob ?? 1) < 1e-15),
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
  {
    family: "tukey",
    property: "time",
    match: on(/tukey$/, (_pr, x, v) => (fnOf(v) === "qtukey" ? (v.call.includes("logP: true") ? x < -230 : x < 1e-100) : x < 1e-3 || x > 1e30)),
    reason:
      "ptukey does not return (or takes seconds) for small or huge q: ptukey(1e-20, 200, 5), ptukey(1e-12, 200, 5, " +
      "{ nranges: 20 }), ptukey(1.0491344840524078e-85, 28, 146.82232749321562), ptukey(2.4654327013958976e+118, 4, 3, " +
      "{ nranges: 2 }); ptukey(1e-8, 200, 5) takes 1.2 s; qtukey for tiny p calls it there; not made in the test",
    exclude: (kind, x, _pr, flags) => (kind === "q" ? (flags.logP === true ? x < -230 : x < 1e-100) : x < 1e-3 || x > 1e30),
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
