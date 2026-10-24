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
import { ksTest, setSeed } from "../src/index.js";
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
