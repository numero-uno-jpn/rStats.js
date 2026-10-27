// Distributions outside base R against extraDistr (oracle/extradist.R): invgamma, kumar, pareto, triang, laplace;
// arcsine against R's beta(1/2, 1/2) moved to (a, b)
import { dinvgamma, pinvgamma, qinvgamma } from "../src/distributions/invgamma.js";
import { dkumar, pkumar, qkumar } from "../src/distributions/kumaraswamy.js";
import { dpareto, ppareto, qpareto } from "../src/distributions/pareto.js";
import { dtriang, ptriang, qtriang } from "../src/distributions/triangular.js";
import { dlaplace, plaplace, qlaplace } from "../src/distributions/laplace.js";
import { darcsine, parcsine, qarcsine } from "../src/distributions/arcsine.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gamma, ksTest, pgamma, setSeed } from "../src/index.js";
import { rarcsine } from "../src/random/extra.js";
import { distSummary, type DistName } from "../src/distributions/summary.js";
import { htestSuite } from "./helpers/htest.js";
import { bool, num, relativeError } from "./helpers/fixture.js";
import { loadReference, referenceSuite } from "./helpers/mpmath.js";
import { fixtureSuite } from "./helpers/suite.js";

type Args = Record<string, string | boolean>;
const tail = (a: Args) => ({ lowerTail: bool(a.lowerTail), logP: bool(a.logP) });
const ab = (a: Args) => ({ a: num(a.a), b: num(a.b) });

const suites: [string, (a: Args) => number, (a: Args) => number, (a: Args, x: number) => number][] = [
  [
    "invgamma",
    (a) => dinvgamma(num(a.x), num(a.alpha), { beta: num(a.beta), log: bool(a.log) }),
    (a) => pinvgamma(num(a.q), num(a.alpha), { beta: num(a.beta), ...tail(a) }),
    (a, x) => pinvgamma(x, num(a.alpha), { beta: num(a.beta), ...tail(a) }),
  ],
  [
    "kumar",
    (a) => dkumar(num(a.x), num(a.a), num(a.b), { log: bool(a.log) }),
    (a) => pkumar(num(a.q), num(a.a), num(a.b), tail(a)),
    (a, x) => pkumar(x, num(a.a), num(a.b), tail(a)),
  ],
  [
    "pareto",
    (a) => dpareto(num(a.x), { ...ab(a), log: bool(a.log) }),
    (a) => ppareto(num(a.q), { ...ab(a), ...tail(a) }),
    (a, x) => ppareto(x, { ...ab(a), ...tail(a) }),
  ],
  [
    "triang",
    (a) => dtriang(num(a.x), { ...ab(a), c: num(a.c), log: bool(a.log) }),
    (a) => ptriang(num(a.q), { ...ab(a), c: num(a.c), ...tail(a) }),
    (a, x) => ptriang(x, { ...ab(a), c: num(a.c), ...tail(a) }),
  ],
  [
    "laplace",
    (a) => dlaplace(num(a.x), { mu: num(a.mu), sigma: num(a.sigma), log: bool(a.log) }),
    (a) => plaplace(num(a.q), { mu: num(a.mu), sigma: num(a.sigma), ...tail(a) }),
    (a, x) => plaplace(x, { mu: num(a.mu), sigma: num(a.sigma), ...tail(a) }),
  ],
  [
    "arcsine",
    (a) => darcsine(num(a.x), { ...ab(a), log: bool(a.log) }),
    (a) => parcsine(num(a.q), { ...ab(a), ...tail(a) }),
    (a, x) => parcsine(x, { ...ab(a), ...tail(a) }),
  ],
];

const quantile: Record<string, (a: Args) => number> = {
  invgamma: (a) => qinvgamma(num(a.p), num(a.alpha), { beta: num(a.beta), ...tail(a) }),
  kumar: (a) => qkumar(num(a.p), num(a.a), num(a.b), tail(a)),
  pareto: (a) => qpareto(num(a.p), { ...ab(a), ...tail(a) }),
  triang: (a) => qtriang(num(a.p), { ...ab(a), c: num(a.c), ...tail(a) }),
  laplace: (a) => qlaplace(num(a.p), { mu: num(a.mu), sigma: num(a.sigma), ...tail(a) }),
  arcsine: (a) => qarcsine(num(a.p), { ...ab(a), ...tail(a) }),
};

/** The neighbouring double of x towards +Infinity (dir 1) or -Infinity (dir -1) */
function nextDouble(x: number, dir: 1 | -1): number {
  if (x === 0) return dir * Number.MIN_VALUE;
  const b = new Float64Array([x]);
  const i = new BigInt64Array(b.buffer);
  i[0] = i[0]! + BigInt((x > 0 ? 1 : -1) * dir);
  return b[0]!;
}

const PARAMS = ["alpha", "beta", "a", "b", "c", "mu", "sigma"];

/**
 * Why a value may differ from extraDistr's. extraDistr evaluates the textbook formulas directly, which loses
 * accuracy in the tails (1 - x^a and 1 - p cancel, a log probability is taken after the probability underflowed);
 * the values here agree with mpmath (scripts/mpmath/extradist.py). With an infinite parameter both give the limit
 * where it is plain, but extraDistr's formulas give NaN or a stray value at the edges (Inf - Inf, 0^0).
 */
function differenceFrom(name: string, back?: (a: Args, x: number) => number) {
  const ref = new Map<string, number>();
  if (!name.startsWith("q")) for (const c of loadReference(name).cases) ref.set(JSON.stringify(c.args), num(c.expected));
  return (a: Args, _expected: number, actual: number): string | undefined => {
    const src = name.endsWith("arcsine") ? "R's beta functions" : "extraDistr";
    if (PARAMS.some((k) => a[k] === "Inf" || a[k] === "-Inf")) return "infinite parameter: the limit (extraDistr: NaN or a stray value at the edges)";
    if (name === "qinvgamma" && num(a.alpha) <= 0) return "alpha <= 0: NaN (extraDistr's qinvgamma does not check alpha)";
    if (back !== undefined) {
      // a quantile in a tail where extraDistr's 1 - p rounds: ours maps back to p
      // (p lies between the probabilities at the neighbouring doubles: the quantile is correctly rounded)
      const p = num(a.p);
      const bp = back(a, actual);
      const lo = back(a, nextDouble(actual, -1));
      const hi = back(a, nextDouble(actual, 1));
      const between = (Math.min(lo, hi) <= p && p <= Math.max(lo, hi)) || Math.abs(bp - p) <= 1e-13 * Math.abs(p);
      if (Number.isFinite(actual) && between) return `${src}: quantile inaccurate in the tails (ours maps back to p)`;
    }
    const r = ref.get(JSON.stringify(a));
    if (r !== undefined && (Object.is(r, actual) || relativeError(actual, r) <= 1e-14 || (a.log === true && Math.abs(actual - r) <= 1e-14 * Math.max(1, Math.abs(r)))))
      return `${src} lose(s) accuracy in the tails (agrees with mpmath)`;
    return undefined;
  };
}

for (const [name, d, p, back] of suites) {
  fixtureSuite({ name: `d${name}`, tolerance: 1e-14, density: true, call: d, knownDifference: differenceFrom(`d${name}`) });
  fixtureSuite({ name: `p${name}`, tolerance: 1e-14, call: p, knownDifference: differenceFrom(`p${name}`) });
  fixtureSuite({ name: `q${name}`, tolerance: 1e-14, call: quantile[name]!, backward: back, knownDifference: differenceFrom(`q${name}`, back) });
  referenceSuite({ name: `d${name}`, tolerance: 1e-14, call: d });
  referenceSuite({ name: `p${name}`, tolerance: 1e-14, call: p });
}

// x near the ends of (a, b) with a != 0, where (x - a) / (b - a) used to be rounded before 1 minus it was taken
// (scripts/mpmath/regions.py)
referenceSuite({ name: "darcsine_regions", tolerance: 1e-14, call: (a) => darcsine(num(a.x), { ...ab(a), log: bool(a.log) }) });
referenceSuite({ name: "parcsine_regions", tolerance: 1e-14, call: (a) => parcsine(num(a.q), { ...ab(a), ...tail(a) }) });
referenceSuite({ name: "qarcsine_regions", tolerance: 1e-14, call: (a) => qarcsine(num(a.p), { ...ab(a), ...tail(a) }) });

// rarcsine has no R reference (extraDistr has no arcsine): check the draws against the distribution function
describe("rarcsine", () => {
  it("follows the arcsine distribution (Kolmogorov-Smirnov)", () => {
    setSeed(20261024);
    const x = rarcsine(5000, { a: 2, b: 5 });
    expect(Math.min(...x)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...x)).toBeLessThanOrEqual(5);
    expect(ksTest(x, (q) => parcsine(q, { a: 2, b: 5 })).pValue).toBeGreaterThan(0.01);
    expect(rarcsine(2, { a: 1, b: 1 })).toEqual([NaN, NaN]);
  });
});

const summaryRef = new Map(
  (JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/distSummary.mpmath.json", import.meta.url)), "utf8")) as {
    cases: { args: Args; expected: Record<string, string> }[];
  }).cases.map((c) => [JSON.stringify(c.args), c.expected]),
);

// distSummary against the closed forms written in R (oracle/distsummary.R; checked there against numerical moments)
htestSuite({
  name: "distSummary",
  call: (a) => {
    const params = Object.fromEntries(Object.entries(a).filter(([k]) => k !== "distribution").map(([k, v]) => [k, num(v as string)]));
    return distSummary(a.distribution as DistName, params);
  },
  tolerance: 1e-14,
  // medians R finds by inversion short of the exact value (qbeta(0.5, 0.5, 0.5) = 0.49999999999999989)
  floor: { median: 1, skewness: 1e-2 },
  // R computes the Weibull and Kumaraswamy moments from the raw moments, which cancel (9 digits of the kurtosis of
  // a Weibull with shape 20); the central moments here are integrated directly and agree with 50-digit values
  knownDifference: (a, field, _expected, actual) => {
    const r = summaryRef.get(JSON.stringify(a))?.[field];
    return r !== undefined && Math.abs(actual - num(r)) <= 3e-14 * Math.abs(num(r)) ? "R's raw-moment formulas cancel (agrees with mpmath)" : undefined;
  },
});

// Variance, skewness and kurtosis of the log-normal distribution down to small sdlog, where w^4 + 2 w^3 + 3 w^2 - 6
// (w = exp(sdlog^2)) cancels (scripts/mpmath/regions.py)
referenceSuite({
  name: "distSummary_lnorm",
  tolerance: 1e-14,
  call: (a) => distSummary("lnorm", { meanlog: num(a.meanlog), sdlog: num(a.sdlog) })[a.field as "variance" | "skewness" | "kurtosis"],
});

// Extreme arguments that used to give NaN, values out of range or lose most digits (found by
// distributionProperties.test.ts). Expected values from closed forms or from other functions of the library
describe("extreme arguments", () => {
  const rel = relativeError;

  it("triangular: wide and narrow intervals, near a", () => {
    // P is scale invariant: the same at ordinary magnitudes
    const [x, a, b, c] = [2.4424154074773638e184, -22.463868531113192, 2.0965034859876516e185, 7.278558690233114e184];
    const s = 1e-184;
    expect(rel(ptriang(x, { a, b, c }), ptriang(x * s, { a: a * s, b: b * s, c: c * s }))).toBeLessThan(1e-14);
    // b - a overflows
    const wide = { a: -1e308, b: 1e308, c: 0 };
    expect(ptriang(0, wide)).toBe(0.5);
    expect(qtriang(0.5, wide)).toBe(0);
    expect(rel(dtriang(0, wide), 1e-308)).toBeLessThan(1e-14);
    // w = b - a = 2.4e-229, c = b: f(x) = 2 x / w^2
    const w = 2.362486118430361e-229;
    const narrow = { a: 0, b: w, c: w };
    expect(dtriang(0, narrow)).toBe(0);
    expect(rel(dtriang(1e-229, narrow), (2e-229 / w) / w)).toBeLessThan(1e-14);
    expect(ptriang(w * 0.9999, narrow)).toBeLessThanOrEqual(1);
    // c = a: x - a = w p / (1 + sqrt(1 - p))
    expect(rel(qtriang(2.5e-182, { a: 0, b: 141, c: 0 }), (141 * 2.5e-182) / 2)).toBeLessThan(1e-14);
    const [a2, b2, p] = [0.026014183705880798, 48.595997168949395, 2.4861429152022987e-10];
    const q = qtriang(p, { a: a2, b: b2, c: a2 });
    // q - a2 = 6e-9 is resolved only to the spacing of doubles near a2 (3.5e-18, 5.8e-10 of it); P is linear in it there
    expect(rel(q - a2, ((b2 - a2) * p) / (1 + Math.sqrt(1 - p)))).toBeLessThan(1e-9);
    expect(rel(ptriang(q, { a: a2, b: b2, c: a2 }), p)).toBeLessThan(1e-9);
    const near1 = { a: 51.80896011403241, b: 54.36503630721428, c: 52.30157068741966 };
    expect(ptriang(54.365036307212875, near1)).toBeLessThanOrEqual(1);
  });

  it("pareto: b / x subnormal, huge a, tiny b", () => {
    expect(rel(ppareto(1.7e308, { a: 0.5, b: 0.147, lowerTail: false }), Math.sqrt(0.147) / Math.sqrt(1.7e308))).toBeLessThan(1e-14);
    // x / b = 1 + 3.8e-15: P[X > x] = exp(-a log1p((x - b) / b)), x - b exact
    const [x, a, b] = [6918267127725.448, 2925352522038695, 6918267127725.422];
    const upper = Math.exp(-a * Math.log1p((x - b) / b));
    expect(rel(ppareto(x, { a, b, lowerTail: false }), upper)).toBeLessThan(1e-14);
    expect(rel(ppareto(x, { a, b }), 1 - upper)).toBeLessThan(1e-14);
    // (a / x) (b / x)^a, with (b / x)^a = y^2 kept in the normal range
    const [x2, a2, b2] = [7.381852998173452e-208, 3.8584050302230875, 5.8963229972762575e-291];
    const y = Math.pow(b2 / x2, a2 / 2);
    expect(rel(dpareto(x2, { a: a2, b: b2 }), ((a2 / x2) * y) * y)).toBeLessThan(1e-14);
    // b exp(-log p / a) with exp(-log p / a) overflowing, the quantile itself 1e135
    const o = { a: 0.8500544517864618, b: 3.604151887655809e-215, lowerTail: false, logP: true };
    const qp = qpareto(-683.2098293111569, o);
    expect(Number.isFinite(qp)).toBe(true);
    expect(Math.abs(ppareto(qp, o) + 683.2098293111569)).toBeLessThan(1e-12);
  });

  it("kumaraswamy: large b, tiny b, subnormal x^a", () => {
    // P[X > x] = exp(b log1p(-x^a)); the exponent is -59, so exp adds 59 eps of rounding
    const [x, a, b] = [0.37133675925961757, 53.00336661461517, 3.74883649682607e24];
    expect(rel(pkumar(x, a, b, { lowerTail: false }), Math.exp(b * Math.log1p(-Math.pow(x, a))))).toBeLessThan(1e-13);
    // log P = log(-expm1(b log1p(-x^a))): log(1 - e^-1) and log(1 - e^-10000)
    expect(rel(pkumar(1e-21, 1, 1e21, { logP: true }), Math.log(-Math.expm1(-1)))).toBeLessThan(1e-14);
    const lp = pkumar(1e-21, 1, 1e25, { logP: true });
    expect(lp <= 0 && lp > -1e-300).toBe(true);
    expect(pkumar(0.15545063884928823, 12.000130017189537, 9.801808002425054e168, { lowerTail: false })).toBe(0);
    // tiny b: log P = log(-expm1(b log1p(-x))) = log b + log(-log1p(-x)) to double precision
    const [x2, b2] = [0.9153352803550661, 8.538775877654007e-49];
    expect(rel(pkumar(x2, 1, b2, { logP: true }), Math.log(b2) + Math.log(-Math.log1p(-x2)))).toBeLessThan(1e-14);
    // x^a = 1e-321 (subnormal), b x^a = 2.5e-132: log P = log b + a log x, log f = log a + log b + (a - 1) log x
    const [x3, a3, b3] = [0.0002944254596426041, 90.9161390640655, 2.5075296665044286e189];
    const lp3 = Math.log(b3) + a3 * Math.log(x3);
    expect(rel(pkumar(x3, a3, b3, { logP: true }), lp3)).toBeLessThan(1e-14);
    expect(rel(pkumar(x3, a3, b3), Math.exp(lp3))).toBeLessThan(1e-13); // exp of -303: 303 eps
    expect(rel(dkumar(x3, a3, b3, { log: true }), Math.log(a3) + Math.log(b3) + (a3 - 1) * Math.log(x3))).toBeLessThan(1e-14);
    // 1 - (1 - p)^(1 / b) = p / b to double precision: x = exp((log p - log b) / a)
    const [p4, a4, b4] = [3.167816805805275e-260, 4193.829732917642, 1.031067914309409e75];
    expect(rel(qkumar(p4, a4, b4), Math.exp((Math.log(p4) - Math.log(b4)) / a4))).toBeLessThan(1e-14);
  });

  it("inverse gamma: beta / x huge or underflowing", () => {
    const [x, alpha, beta] = [3.6506154146302763e-16, 35.87186122146188, 269.8924867108752];
    const lp = pinvgamma(x, alpha, { beta, logP: true });
    expect(rel(lp, pgamma(beta / x, alpha, { lowerTail: false, logP: true }))).toBeLessThan(1e-14);
    // alpha = 1: f(x) = beta / x^2 exp(-beta / x), beta / x = 5e-345
    const [x2, beta2] = [5.20010667081513e152, 2.795663805653832e-192];
    expect(rel(dinvgamma(x2, 1, { beta: beta2, log: true }), Math.log(beta2) - 2 * Math.log(x2))).toBeLessThan(1e-14);
    // P[X > x] = P[Z < beta / x] = (beta / x)^alpha / Γ(alpha + 1); exp of -115 adds 115 eps
    const [x3, alpha3, beta3] = [1.7e308, 0.15027305543499947, 8.75984919070316e-25];
    const upper = Math.exp(alpha3 * (Math.log(beta3) - Math.log(x3))) / gamma(alpha3 + 1);
    expect(rel(pinvgamma(x3, alpha3, { beta: beta3, lowerTail: false }), upper)).toBeLessThan(1e-13);
    // alpha = beta = 1e200: 1 / X is near its mean 1, where f ≈ 1 / sqrt(2π alpha) per unit of z, times z / x = 1e200
    expect(rel(dinvgamma(1, 1e200, { beta: 1e200 }), 1e100 / Math.sqrt(2 * Math.PI))).toBeLessThan(1e-14);
  });
});
