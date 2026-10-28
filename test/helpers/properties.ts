// Properties of the distribution functions that need no reference value (test/distributionProperties.test.ts and
// scripts/fuzz-distributions.mjs): range, complement, log consistency, monotonicity, quantile round trip, density
// against the CDF, time and independence of call order. Parameters come from seeded generators mixing log-uniform
// values over the valid range with boundary values; evaluation points are raw log-uniform values, points around the
// mean and quantiles q(p) for p from 1e-300 to 0.5 in both tails.
//
// The functions are passed in as a module (src/entries/distributions.ts in vitest, dist/ in the fuzz script), and this
// file has no relative imports and only erasable TypeScript, so that Node can load it with its type stripping.

/** A seeded generator of uniform and normal numbers (mulberry32 and Box-Muller) */
export function generator(seed: number): { unif: () => number; norm: () => number } {
  let a = seed >>> 0;
  const unif = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const norm = (): number => Math.sqrt(-2 * Math.log(1 - unif())) * Math.cos(2 * Math.PI * unif());
  return { unif, norm };
}

export type Rng = ReturnType<typeof generator>;

/** Seed of the parameter set `index` of a family (independent streams per family and index) */
export function familySeed(seed: number, family: string, index: number): number {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < family.length; i++) h = Math.imul(h ^ family.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * Whether the discrete quantile y satisfies the definition, with the same slack as src/internal/discrete.ts
 * (8 ε linear, 2 ε log): lower tail F(y) >= p and F(y-1) < p; upper tail P[X > y] <= p and P[X > y-1] > p.
 * `cdf(v)` is on the scale of p (same lowerTail and logP); `cdf(v, true)` on the log scale.
 */
export function satisfiesDefinition(
  p: number,
  lower: boolean,
  logP: boolean,
  y: number,
  cdf: (y: number, logScale?: boolean) => number,
): boolean {
  const E = Number.EPSILON;
  if (!logP && p < 1e-290) {
    // p near the subnormal range is compared on the log scale, as in the implementation (discrete.ts)
    const lt = Math.log(p) + Math.log1p(lower ? -8 * E : 8 * E);
    const lcdf = (v: number): number => cdf(v, true);
    const okl = (v: number): boolean => (lower ? lcdf(v) >= lt : lcdf(v) <= lt);
    return okl(y) && (y === 0 || !okl(y - 1));
  }
  let t: number;
  if (logP) t = lower ? p * (1 + 2 * E) : p * (1 - 2 * E);
  else t = lower ? p * (1 - 8 * E) : 1 - p > 32 * E ? p * (1 + 8 * E) : p;
  const ok = (v: number): boolean => (lower ? cdf(v) >= t : cdf(v) <= t);
  return ok(y) && (y === 0 || !ok(y - 1));
}

// ---- parameter generators ----

export type Params = Record<string, number>;

export function logUniform(r: Rng, lo: number, hi: number): number {
  return Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * r.unif());
}

function pick<T>(r: Rng, values: readonly T[]): T {
  return values[Math.floor(r.unif() * values.length)]!;
}

/**
 * A positive parameter: 15% a boundary value, 25% log-uniform over the whole range `full`, otherwise log-uniform over
 * the typical range (where most of the algorithms' branches are)
 */
function positive(r: Rng, typical: [number, number], full: [number, number] = [1e-300, 1e300], boundary: readonly number[] = [1]): number {
  const u = r.unif();
  if (u < 0.15 && boundary.length > 0) return pick(r, boundary);
  return u < 0.4 ? logUniform(r, ...full) : logUniform(r, ...typical);
}

/** A parameter of either sign (location): 0 sometimes, otherwise ± a positive value */
function signed(r: Rng, typical: [number, number], full: [number, number] = [1e-300, 1e300]): number {
  if (r.unif() < 0.1) return 0;
  return (r.unif() < 0.5 ? -1 : 1) * positive(r, typical, full, [1]);
}

/** A non-negative integer: a boundary value or log-uniform up to typicalHi (sometimes up to fullHi) */
function integer(r: Rng, typicalHi: number, fullHi: number, boundary: readonly number[] = [0, 1, 2, 3]): number {
  const u = r.unif();
  if (u < 0.2) return pick(r, boundary);
  return Math.round(logUniform(r, 1, u < 0.4 ? fullHi : typicalHi));
}

/** A probability in [0, 1]: boundaries, log-uniform near 0 or near 1, or uniform */
function probability(r: Rng, boundary: readonly number[] = [0, 0.5, 1]): number {
  const u = r.unif();
  if (u < 0.15) return pick(r, boundary);
  if (u < 0.4) return logUniform(r, 1e-300, 0.5);
  if (u < 0.6) return 1 - logUniform(r, 1e-17, 0.5);
  return r.unif();
}

/** A bounded interval [a, b] with a < b */
function interval(r: Rng): [number, number] {
  for (;;) {
    const a = signed(r, [1e-3, 1e3]);
    const b = a + positive(r, [1e-3, 1e3]);
    if (b > a && Number.isFinite(b)) return [a, b];
  }
}

// ---- families ----

export interface Family {
  /** Label in reports (unique) */
  name: string;
  /** Base name of the functions: d<fn>, p<fn>, q<fn> */
  fn: string;
  /** Parameters passed positionally after x, in order; the others go in the options object */
  positional: readonly string[];
  discrete?: boolean;
  /** No density function (ptukey / qtukey) */
  noDensity?: boolean;
  /** Relative accuracy promised for p (docs/accuracy.md); default 1e-14 */
  accuracy?: number;
  params(r: Rng): Params;
  /** Closure of the support */
  support(pr: Params): [number, number];
  /** Mean and standard deviation (or a centre and a scale), for points around the centre */
  moments?(pr: Params): [number, number];
  /** Points other than the support's ends where the density is not smooth (no central difference across them) */
  kinks?(pr: Params): number[];
}

const real: [number, number] = [-Infinity, Infinity];
const halfLine: [number, number] = [0, Infinity];
const unit: [number, number] = [0, 1];

const df = (r: Rng): number => positive(r, [1e-2, 1e6], [1e-300, 1e300], [0.5, 1, 2, 3]);
const ncp = (r: Rng): number => positive(r, [1e-2, 1e4], [1e-300, 1e300], [0, 1]);
const shape = (r: Rng): number => positive(r, [1e-2, 1e4], [1e-300, 1e300], [0.5, 1, 2]);
const scale = (r: Rng): number => positive(r, [1e-3, 1e3]);
/** The whole positive range of doubles, subnormals included (for the families checked out to their ends so far) */
const wide: [number, number] = [5e-324, 1e308];
const wideDf = (r: Rng): number => positive(r, [1e-2, 1e6], wide, [0.5, 1, 2, 3]);
const wideShape = (r: Rng): number => positive(r, [1e-2, 1e4], wide, [0.5, 1, 2]);
const wideScale = (r: Rng): number => positive(r, [1e-3, 1e3], wide);
const betaMoments = (a: number, b: number): [number, number] => [a / (a + b), Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)))];

export const distributionFamilies: Family[] = [
  {
    name: "norm",
    fn: "norm",
    positional: [],
    params: (r) => ({ mean: signed(r, [1e-3, 1e3]), sd: scale(r) }),
    support: () => real,
    moments: (pr) => [pr.mean!, pr.sd!],
  },
  {
    name: "lnorm",
    fn: "lnorm",
    positional: [],
    params: (r) => ({ meanlog: signed(r, [1e-3, 1e2], wide), sdlog: positive(r, [1e-3, 1e2], wide) }),
    support: () => halfLine,
  },
  {
    name: "unif",
    fn: "unif",
    positional: [],
    params: (r) => {
      const [min, max] = interval(r);
      return { min, max };
    },
    support: (pr) => [pr.min!, pr.max!],
  },
  {
    name: "exp",
    fn: "exp",
    positional: [],
    params: (r) => ({ rate: scale(r) }),
    support: () => halfLine,
    moments: (pr) => [1 / pr.rate!, 1 / pr.rate!],
  },
  {
    name: "logis",
    fn: "logis",
    positional: [],
    params: (r) => ({ location: signed(r, [1e-3, 1e3]), scale: scale(r) }),
    support: () => real,
    moments: (pr) => [pr.location!, 1.8 * pr.scale!],
  },
  {
    name: "cauchy",
    fn: "cauchy",
    positional: [],
    params: (r) => ({ location: signed(r, [1e-3, 1e3]), scale: scale(r) }),
    support: () => real,
    moments: (pr) => [pr.location!, pr.scale!],
  },
  {
    name: "weibull",
    fn: "weibull",
    positional: ["shape"],
    params: (r) => ({ shape: positive(r, [0.1, 50], wide, [0.5, 1, 2]), scale: wideScale(r) }),
    support: () => halfLine,
  },
  {
    name: "gamma(rate)",
    fn: "gamma",
    positional: ["shape"],
    params: (r) => ({ shape: wideShape(r), rate: wideScale(r) }),
    support: () => halfLine,
    moments: (pr) => [pr.shape! / pr.rate!, Math.sqrt(pr.shape!) / pr.rate!],
  },
  {
    name: "gamma(scale)",
    fn: "gamma",
    positional: ["shape"],
    params: (r) => ({ shape: wideShape(r), scale: wideScale(r) }),
    support: () => halfLine,
    moments: (pr) => [pr.shape! * pr.scale!, Math.sqrt(pr.shape!) * pr.scale!],
  },
  {
    name: "chisq",
    fn: "chisq",
    positional: ["df"],
    params: (r) => ({ df: wideDf(r) }),
    support: () => halfLine,
    moments: (pr) => [pr.df!, Math.sqrt(2 * pr.df!)],
  },
  {
    name: "nchisq",
    fn: "chisq",
    positional: ["df"],
    params: (r) => ({ df: df(r), ncp: ncp(r) }),
    support: () => halfLine,
    moments: (pr) => [pr.df! + pr.ncp!, Math.sqrt(2 * (pr.df! + 2 * pr.ncp!))],
  },
  {
    name: "t",
    fn: "t",
    positional: ["df"],
    params: (r) => ({ df: positive(r, [1e-2, 1e6], [5e-324, 1e308], [0.5, 1, 2, 3, Infinity]) }),
    support: () => real,
    moments: () => [0, 1],
  },
  {
    name: "nt",
    fn: "t",
    positional: ["df"],
    accuracy: 1e-13,
    params: (r) => ({
      df: positive(r, [1e-1, 1e4], [5e-324, 1e308], [1, 2, 3, Infinity]),
      ncp: signed(r, [1e-2, 50], [1e-300, 1e4]),
    }),
    support: () => real,
    moments: (pr) => [pr.ncp!, 1],
  },
  {
    name: "f",
    fn: "f",
    positional: ["df1", "df2"],
    params: (r) => ({
      df1: positive(r, [1e-2, 1e6], [1e-300, 1e300], [1, 2, 3, Infinity]),
      df2: positive(r, [1e-2, 1e6], [1e-300, 1e300], [1, 2, 3, Infinity]),
    }),
    support: () => halfLine,
  },
  {
    name: "nf",
    fn: "f",
    positional: ["df1", "df2"],
    params: (r) => ({
      df1: positive(r, [1e-2, 1e4], [1e-300, 1e300], [1, 2, 3]),
      df2: positive(r, [1e-2, 1e4], [1e-300, 1e300], [1, 2, 3]),
      ncp: ncp(r),
    }),
    support: () => halfLine,
  },
  {
    name: "beta",
    fn: "beta",
    positional: ["shape1", "shape2"],
    params: (r) => ({ shape1: shape(r), shape2: shape(r) }),
    support: () => unit,
    moments: (pr) => betaMoments(pr.shape1!, pr.shape2!),
  },
  {
    name: "nbeta",
    fn: "beta",
    positional: ["shape1", "shape2"],
    params: (r) => ({ shape1: shape(r), shape2: shape(r), ncp: ncp(r) }),
    support: () => unit,
  },
  {
    name: "binom",
    fn: "binom",
    positional: ["size", "prob"],
    discrete: true,
    params: (r) => ({ size: integer(r, 1e4, 1e15), prob: probability(r) }),
    support: (pr) => [0, pr.size!],
    moments: (pr) => [pr.size! * pr.prob!, Math.sqrt(pr.size! * pr.prob! * (1 - pr.prob!))],
  },
  {
    name: "pois",
    fn: "pois",
    positional: ["lambda"],
    discrete: true,
    params: (r) => ({ lambda: positive(r, [1e-3, 1e6], [1e-300, 1e300], [0, 1, 2]) }),
    support: () => halfLine,
    moments: (pr) => [pr.lambda!, Math.sqrt(pr.lambda!)],
  },
  {
    name: "geom",
    fn: "geom",
    positional: ["prob"],
    discrete: true,
    params: (r) => ({ prob: probability(r, [0.5, 1]) || 0.5 }),
    support: () => halfLine,
    moments: (pr) => [(1 - pr.prob!) / pr.prob!, Math.sqrt(1 - pr.prob!) / pr.prob!],
  },
  {
    name: "nbinom(prob)",
    fn: "nbinom",
    positional: ["size"],
    discrete: true,
    params: (r) => ({ size: positive(r, [1e-2, 1e4], [1e-300, 1e300], [0, 1, 2]), prob: probability(r, [0.5, 1]) || 0.5 }),
    support: () => halfLine,
    moments: (pr) => [(pr.size! * (1 - pr.prob!)) / pr.prob!, Math.sqrt(pr.size! * (1 - pr.prob!)) / pr.prob!],
  },
  {
    name: "nbinom(mu)",
    fn: "nbinom",
    positional: ["size"],
    discrete: true,
    params: (r) => ({
      size: positive(r, [1e-2, 1e4], [1e-300, 1e300], [0, 1, 2, Infinity]),
      mu: positive(r, [1e-3, 1e6], [1e-300, 1e300], [0, 1]),
    }),
    support: () => halfLine,
    moments: (pr) => [pr.mu!, Math.sqrt(pr.mu! + pr.mu! ** 2 / pr.size!)],
  },
  {
    name: "hyper",
    fn: "hyper",
    positional: ["m", "n", "k"],
    discrete: true,
    params: (r) => {
      const m = integer(r, 1e3, 1e6);
      const n = integer(r, 1e3, 1e6);
      const k = r.unif() < 0.2 ? pick(r, [0, 1, m + n]) : Math.round(r.unif() * (m + n));
      return { m, n, k };
    },
    support: (pr) => [Math.max(0, pr.k! - pr.n!), Math.min(pr.k!, pr.m!)],
    moments: (pr) => {
      const N = pr.m! + pr.n!;
      const v = (pr.k! * pr.m! * pr.n! * (N - pr.k!)) / (N * N * (N - 1));
      return [(pr.k! * pr.m!) / N, Math.sqrt(v)];
    },
  },
  {
    name: "signrank",
    fn: "signrank",
    positional: ["n"],
    discrete: true,
    // up to n = 1000: building the table for the centre takes 0.25 s there (about 2 s for n = 2000)
    params: (r) => ({ n: integer(r, 60, 1000, [1, 2, 3, 1000]) || 1 }),
    support: (pr) => [0, (pr.n! * (pr.n! + 1)) / 2],
    moments: (pr) => [(pr.n! * (pr.n! + 1)) / 4, Math.sqrt((pr.n! * (pr.n! + 1) * (2 * pr.n! + 1)) / 24)],
  },
  {
    name: "wilcox",
    fn: "wilcox",
    positional: ["m", "n"],
    discrete: true,
    params: (r) => ({ m: integer(r, 30, 300, [1, 2, 3]) || 1, n: integer(r, 30, 300, [1, 2, 3]) || 1 }),
    support: (pr) => [0, pr.m! * pr.n!],
    moments: (pr) => [(pr.m! * pr.n!) / 2, Math.sqrt((pr.m! * pr.n! * (pr.m! + pr.n! + 1)) / 12)],
  },
  {
    name: "tukey",
    fn: "tukey",
    positional: ["nmeans", "df"],
    noDensity: true,
    accuracy: 2e-14,
    params: (r) => ({
      nmeans: Math.max(2, integer(r, 20, 200, [2, 3])),
      df: positive(r, [2, 1e3], [2, 1e300], [2, 3, Infinity]),
      nranges: r.unif() < 0.7 ? 1 : integer(r, 5, 20, [1, 2]) || 1,
    }),
    support: () => halfLine,
  },
  {
    name: "invgamma",
    fn: "invgamma",
    positional: ["alpha"],
    params: (r) => ({ alpha: wideShape(r), beta: wideScale(r) }),
    support: () => halfLine,
  },
  {
    name: "kumar",
    fn: "kumar",
    positional: ["a", "b"],
    params: (r) => ({ a: shape(r), b: shape(r) }),
    support: () => unit,
  },
  {
    name: "pareto",
    fn: "pareto",
    positional: [],
    params: (r) => ({ a: shape(r), b: scale(r) }),
    support: (pr) => [pr.b!, Infinity],
  },
  {
    name: "triang",
    fn: "triang",
    positional: [],
    params: (r) => {
      const [a, b] = interval(r);
      const u = r.unif();
      return { a, b, c: u < 0.15 ? a : u < 0.3 ? b : a + (b - a) * r.unif() };
    },
    support: (pr) => [pr.a!, pr.b!],
    kinks: (pr) => [pr.c!],
  },
  {
    name: "laplace",
    fn: "laplace",
    positional: [],
    params: (r) => ({ mu: signed(r, [1e-3, 1e3]), sigma: scale(r) }),
    support: () => real,
    moments: (pr) => [pr.mu!, Math.SQRT2 * pr.sigma!],
    kinks: (pr) => [pr.mu!],
  },
  {
    name: "arcsine",
    fn: "arcsine",
    positional: [],
    params: (r) => {
      const [a, b] = interval(r);
      return { a, b };
    },
    support: (pr) => [pr.a!, pr.b!],
  },
];

// ---- calls ----

export type Kind = "d" | "p" | "q";

export interface Flags {
  lowerTail?: boolean;
  logP?: boolean;
  log?: boolean;
}

/** A number as JavaScript source (shortest round-trip form; -0 kept) */
export function fmt(v: number): string {
  return Object.is(v, -0) ? "-0" : String(v);
}

/** The call as copy-pasteable JavaScript, e.g. `pchisq(3, 1, { ncp: 2, lowerTail: false })` */
export function callText(family: Family, kind: Kind, x: number, pr: Params, flags: Flags = {}): string {
  const args = [fmt(x), ...family.positional.map((k) => fmt(pr[k]!))];
  const opts = Object.entries(pr)
    .filter(([k]) => !family.positional.includes(k))
    .map(([k, v]) => `${k}: ${fmt(v)}`);
  if (flags.lowerTail === false) opts.push("lowerTail: false");
  if (flags.logP === true) opts.push("logP: true");
  if (flags.log === true) opts.push("log: true");
  if (opts.length > 0) args.push(`{ ${opts.join(", ")} }`);
  return `${kind}${family.fn}(${args.join(", ")})`;
}

export interface Violation {
  family: string;
  property: string;
  /** The call, as copy-pasteable JavaScript */
  call: string;
  detail: string;
  params: Params;
  x: number;
}

export interface RunOptions {
  /** Called with the text of every call before it is made (the fuzz script's watchdog) */
  onCall?: (call: string) => void;
  /** A call taking longer is a violation (default 1000 ms) */
  timeLimitMs?: number;
  /** Calls not to make (known to hang); the point or quantile that needs one is skipped */
  exclude?: (kind: Kind, x: number, pr: Params, flags: Flags) => boolean;
}

export interface Sizes {
  /** Raw log-uniform points */
  raw: number;
  /** Points q(p) */
  quantile: number;
  /** Points around the mean */
  central: number;
  /** Given points (an example of a known violation) */
  extra?: readonly number[];
}

/** Thrown to abandon a parameter set (a table past its documented limit, or a call that threw) */
class Abort extends Error {}

/** Thrown to skip a point or quantile that needs an excluded call */
class Skip extends Error {}

const EPS = Number.EPSILON;
const MIN_NORMAL = 2 ** -1022;
const f64 = new Float64Array(1);
const i64 = new BigInt64Array(f64.buffer);

/** The next double above x (x itself for NaN and +Inf) */
function nextUp(x: number): number {
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x === 0) return Number.MIN_VALUE;
  f64[0] = x;
  i64[0]! += x > 0 ? 1n : -1n;
  return f64[0]!;
}

/** Runs f; an excluded call inside it skips the rest */
function skipping(f: () => void): void {
  try {
    f();
  } catch (e) {
    if (!(e instanceof Skip)) throw e;
  }
}

function stepUlps(x: number, k: number): number {
  for (let i = 0; i < Math.abs(k); i++) x = k > 0 ? nextUp(x) : -nextUp(-x);
  return x;
}

interface Recorded {
  kind: Kind;
  x: number;
  pr: Params;
  flags: Flags;
  value: number;
}

interface Point {
  x: number;
  P: number;
  Q: number;
  lP: number;
  lQ: number;
}

// Tolerances (relative unless stated; acc is the family's promised accuracy of p, docs/accuracy.md):
// - complement: |P + Q - 1| <= 8 ε + 2 acc min(P, Q) (the larger tail is 1 - (smaller) to a few ε, the smaller
//   accurate to acc)
// - log: |logP - log P| <= 1e-13 max(1, |logP|) where P is a normal double (absolute on the log scale, i.e. relative
//   on P; 10 acc because a log value is often a sum of large terms that cancel, as in a log density), and on the side
//   near 1 |logP - log1p(-Q)| <= 2 acc |logP|. The same for the density (log d against log(d))
// - monotonicity: a decrease of at most 8 ε relative between consecutive points (rounding, not accuracy: an
//   algorithm's change of branch may not move p backwards by more than a few ε)
// - quantile round trip (continuous): p must lie between p(x (1 ∓ 1e-14)) (at least 4 ulps either side), widened by
//   1e-12 relative (1e-12 absolute on the log scale). The 1e-14 is the documented accuracy of quantiles; it absorbs the
//   steep regions where x, not p, limits the round trip (x d(x) / p large). In flat regions 1e-12 is left for the root
//   finder, still 100 times the accuracy of p
// - quantile round trip (discrete): q(p(x)) = x where d(x) > 0, or a y satisfying the definition (satisfiesDefinition).
//   Skipped on a tail where p(x) is 0 or 1 (the ends of the support by definition) or d(x) < 64 ε p(x): the steps
//   there are below the slack of the definition, so the answer is decided by rounding (p near 1 carries no more
//   information about x)
// - density (continuous): the Richardson-extrapolated central difference of the smaller tail of p (on the log scale
//   where p or d is below 1e-250) within 1e-6 of d. Skipped where the difference cannot reach that: at the support's
//   ends and kinks, where the step would be below 1e6 ulps of x, or where an error of 10 acc in p (plus the rounding
//   of log p) would exceed 1e-7 of the difference
// - density (discrete): p(x) - p(x - 1) on the smaller tail equals d(x) within 1e-12 d + 2 acc p (on the log scale
//   below 1e-290, with the error of log p amplified by the cancellation)
// - range: 0 <= p <= 1, log p <= 0, d >= 0 (a probability mass also <= 1), q within the support; NaN is a violation
// - time: a call over 1 s (RunOptions.timeLimitMs)
// - order: bitwise equal results when a call is made again: every 11th call at the end of the family, and the calls of
//   each parameter set's three smallest points after the rest of the set
const TOL_LOG = 1e-13;
const TOL_MONOTONE = 8 * EPS;
const TOL_ROUNDTRIP = 1e-12;
const TOL_DENSITY = 1e-6;
const TOL_PMF = 1e-12;

/**
 * Runs the properties for one family; violations are collected in `violations`. A RangeError for a table past its
 * documented limit (signrank, wilcox) abandons the parameter set and is counted in `tableLimited`.
 */
export class FamilyRunner {
  readonly violations: Violation[] = [];
  readonly family: Family;
  calls = 0;
  tableLimited = 0;
  excluded = 0;
  private readonly dist: Record<string, unknown>;
  private readonly options: RunOptions;
  private readonly acc: number;
  private readonly recorded: Recorded[] = [];
  /** The calls of the current parameter set's first points (checked again after the set) */
  private captured: Recorded[] | undefined;

  constructor(dist: Record<string, unknown>, family: Family, options: RunOptions = {}) {
    this.dist = dist;
    this.family = family;
    this.options = options;
    this.acc = family.accuracy ?? 1e-14;
  }

  private report(property: string, call: string, detail: string, params: Params, x: number): void {
    this.violations.push({ family: this.family.name, property, call, detail, params, x });
  }

  /** Calls d/p/q with the bookkeeping (watchdog hook, time, call-order sample) */
  call(kind: Kind, x: number, pr: Params, flags: Flags = {}): number {
    const fam = this.family;
    if (this.options.exclude?.(kind, x, pr, flags)) {
      this.excluded++;
      throw new Skip();
    }
    const text = callText(fam, kind, x, pr, flags);
    this.options.onCall?.(text);
    const f = this.dist[kind + fam.fn] as (...args: unknown[]) => number;
    const opts: Record<string, unknown> = { ...flags };
    for (const [k, v] of Object.entries(pr)) if (!fam.positional.includes(k)) opts[k] = v;
    const t0 = performance.now();
    let value: number;
    try {
      value = f(x, ...fam.positional.map((k) => pr[k]), opts);
    } catch (e) {
      if (e instanceof RangeError && e.message.includes("needs too large a table")) {
        this.tableLimited++;
        throw new Abort();
      }
      this.report("throws", text, String(e), pr, x);
      throw new Abort();
    }
    const ms = performance.now() - t0;
    if (ms > (this.options.timeLimitMs ?? 1000)) this.report("time", text, `${ms.toFixed(0)} ms`, pr, x);
    // Every 11th call is evaluated again at the end (checkOrder)
    if (++this.calls % 11 === 0 && this.recorded.length < 500) this.recorded.push({ kind, x, pr, flags, value });
    this.captured?.push({ kind, x, pr, flags, value });
    return value;
  }

  /** Runs every property on one parameter set */
  runParamSet(pr: Params, r: Rng, sizes: Sizes): void {
    try {
      this.paramSet(pr, r, sizes);
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
    }
  }

  /** Results must not depend on what was evaluated before: the sampled calls again, in reverse order */
  checkOrder(): void {
    this.recheck(this.recorded.reverse());
    this.recorded.length = 0;
  }

  private recheck(calls: Recorded[]): void {
    for (const c of calls) {
      let v: number;
      try {
        v = this.call(c.kind, c.x, c.pr, c.flags);
      } catch (e) {
        if (e instanceof Abort || e instanceof Skip) continue;
        throw e;
      }
      if (!Object.is(v, c.value)) {
        this.report("order", callText(this.family, c.kind, c.x, c.pr, c.flags), `${c.value} first, ${v} later`, c.pr, c.x);
      }
    }
  }

  private paramSet(pr: Params, r: Rng, sizes: Sizes): void {
    const fam = this.family;
    const [lo, hi] = fam.support(pr);
    const xs = new Set<number>();
    for (let i = 0; i < sizes.quantile; i++) {
      const p0 = logUniform(r, 1e-300, 0.5);
      const flags = { lowerTail: r.unif() < 0.5, logP: r.unif() < 0.25 };
      const arg = flags.logP ? Math.log(p0) : p0;
      skipping(() => {
        const x = this.call("q", arg, pr, flags);
        if (!this.quantileInRange(x, lo, hi, arg, pr, flags)) return;
        if (Number.isFinite(x)) xs.add(x);
        if (!fam.discrete) this.roundTripContinuous(x, arg, pr, flags);
      });
    }
    for (let i = 0; i < sizes.raw; i++) xs.add(this.rawPoint(r, lo, hi));
    const m = fam.moments?.(pr);
    if (m !== undefined && Number.isFinite(m[0]) && Number.isFinite(m[1])) {
      for (let i = 0; i < sizes.central; i++) {
        const x = m[0] + 3 * m[1] * r.norm();
        xs.add(fam.discrete ? Math.round(x) : x);
      }
    }
    if (fam.discrete) {
      for (const x of [lo, lo + 1, hi - 1, hi]) if (Number.isFinite(x)) xs.add(x);
    }
    for (const x of sizes.extra ?? []) xs.add(x);
    // The calls of the three smallest points are made again after the set: a table built for a larger x must not
    // change them
    const points: Point[] = [];
    const first: Recorded[] = [];
    for (const x of [...xs].filter((x) => !Number.isNaN(x)).sort((a, b) => a - b)) {
      this.captured = points.length < 3 ? first : undefined;
      skipping(() => points.push(this.point(x, pr, lo, hi)));
    }
    this.captured = undefined;
    this.monotone(points, pr);
    this.recheck(first);
  }

  /** A raw point: log-uniform over the support (both signs on the real line), sometimes just outside it */
  private rawPoint(r: Rng, lo: number, hi: number): number {
    const fam = this.family;
    let x: number;
    const u = r.unif();
    if (u < 0.05) x = Number.isFinite(lo) ? lo - logUniform(r, 1e-3, 1e3) : -Infinity;
    else if (u < 0.1) x = Number.isFinite(hi) ? hi + logUniform(r, 1e-3, 1e3) : Infinity;
    else if (Number.isFinite(lo) && Number.isFinite(hi)) {
      const v = r.unif();
      const t = v < 0.3 ? logUniform(r, 1e-300, 1) : v < 0.6 ? 1 - logUniform(r, 1e-17, 1) : r.unif();
      x = lo + (hi - lo) * t;
    } else if (Number.isFinite(lo)) {
      x = lo + (lo === 0 ? 1 : Math.abs(lo)) * logUniform(r, 1e-300, 1e300);
    } else {
      x = (r.unif() < 0.5 ? -1 : 1) * logUniform(r, 1e-300, 1e300);
    }
    return fam.discrete && Number.isFinite(x) ? Math.round(x) : x;
  }

  private range(kind: Kind, v: number, x: number, pr: Params, flags: Flags): boolean {
    let ok: boolean;
    if (Number.isNaN(v)) ok = false;
    else if (kind === "p") ok = flags.logP === true ? v <= 0 : v >= 0 && v <= 1;
    else if (flags.log === true) ok = !this.family.discrete || v <= 0;
    else ok = v >= 0 && (!this.family.discrete || v <= 1);
    if (!ok) this.report("range", callText(this.family, kind, x, pr, flags), `= ${v}`, pr, x);
    return ok;
  }

  private quantileInRange(x: number, lo: number, hi: number, p: number, pr: Params, flags: Flags): boolean {
    const ok = x >= lo && x <= hi && (!this.family.discrete || Number.isInteger(x) || !Number.isFinite(x));
    if (!ok) this.report("range", callText(this.family, "q", p, pr, flags), `= ${x}, support [${lo}, ${hi}]`, pr, p);
    return ok;
  }

  /** p must lie between p(x (1 ∓ 1e-14)) (at least 4 ulps either side), within TOL_ROUNDTRIP */
  private roundTripContinuous(x: number, p: number, pr: Params, flags: Flags): void {
    const w = Number.isFinite(x) ? 1e-14 * Math.abs(x) : 0;
    const a = this.call("p", Math.min(stepUlps(x, -4), x - w), pr, flags);
    const b = this.call("p", Math.max(stepUlps(x, 4), x + w), pr, flags);
    const tol = flags.logP === true ? TOL_ROUNDTRIP : TOL_ROUNDTRIP * Math.abs(p);
    if (p >= Math.min(a, b) - tol && p <= Math.max(a, b) + tol) return;
    this.report(
      "roundtrip",
      callText(this.family, "q", p, pr, flags),
      `= ${x}; p at x (1 ∓ 1e-14): ${a}, ${b}`,
      pr,
      p,
    );
  }

  private point(x: number, pr: Params, lo: number, hi: number): Point {
    const fam = this.family;
    const acc = this.acc;
    // The density first, so that it is checked even where the distribution function is excluded
    let D = NaN;
    let lD = NaN;
    let okD = false;
    if (!fam.noDensity) {
      D = this.call("d", x, pr);
      lD = this.call("d", x, pr, { log: true });
      okD = [this.range("d", D, x, pr, {}), this.range("d", lD, x, pr, { log: true })].every(Boolean);
      if (okD && D >= MIN_NORMAL && Number.isFinite(D) && !(Math.abs(lD - Math.log(D)) <= TOL_LOG * Math.max(1, Math.abs(lD)))) {
        this.report("log", callText(fam, "d", x, pr, { log: true }), `= ${lD}, log of the linear value ${Math.log(D)}`, pr, x);
      }
    }
    const P = this.call("p", x, pr);
    const Q = this.call("p", x, pr, { lowerTail: false });
    const lP = this.call("p", x, pr, { logP: true });
    const lQ = this.call("p", x, pr, { lowerTail: false, logP: true });
    const okP = [
      this.range("p", P, x, pr, {}),
      this.range("p", Q, x, pr, { lowerTail: false }),
      this.range("p", lP, x, pr, { logP: true }),
      this.range("p", lQ, x, pr, { lowerTail: false, logP: true }),
    ].every(Boolean);
    const pt = { x, P, Q, lP, lQ };
    if (!okP) return pt;
    const text = (flags: Flags = {}): string => callText(fam, "p", x, pr, flags);

    // Complement
    const comp = Math.abs(P + Q - 1);
    if (!(comp <= 8 * EPS + 2 * acc * Math.min(P, Q))) {
      this.report("complement", text(), `lower ${P} + upper ${Q} - 1 = ${P + Q - 1}`, pr, x);
    }
    // Log consistency
    for (const [v, lv, other, flags] of [
      [P, lP, Q, { logP: true }],
      [Q, lQ, P, { lowerTail: false, logP: true }],
    ] as const) {
      if (v >= MIN_NORMAL && !(Math.abs(lv - Math.log(v)) <= TOL_LOG * Math.max(1, Math.abs(lv)))) {
        this.report("log", text(flags), `= ${lv}, log of the linear value ${Math.log(v)}`, pr, x);
      } else if (v > 0.5 && !(Math.abs(lv - Math.log1p(-other)) <= 2 * acc * Math.abs(lv) + Number.MIN_VALUE)) {
        this.report("log", text(flags), `= ${lv}, log1p(-other tail) ${Math.log1p(-other)}`, pr, x);
      }
    }
    if (!okD) return pt;
    if (fam.discrete) {
      this.pmfDifference(pt, D, lD, pr, lo, hi);
      this.roundTripDiscrete(pt, D, lD, pr, lo, hi);
    } else {
      this.densityDifference(pt, D, lD, pr, lo, hi);
    }
    return pt;
  }

  private densityDifference(pt: Point, D: number, lD: number, pr: Params, lo: number, hi: number): void {
    const { x, P, Q, lP, lQ } = pt;
    if (!Number.isFinite(x) || !Number.isFinite(lD) || D === Infinity) return;
    const lower = P <= Q;
    const logScale = Math.min(P, Q) < 1e-250 || D < 1e-250;
    const flags = { lowerTail: lower, logP: logScale };
    const tail = logScale ? (lower ? lP : lQ) : lower ? P : Q;
    // The derivative of the tail on its scale: d, or d / p on the log scale
    const target = logScale ? Math.exp(lD - tail) : D;
    if (!(target > 0 && Number.isFinite(target))) return;
    // Step: 1e-3 of the distance to the support's ends and kinks, of |x| (power-law tails vary on that scale) and of
    // the tail's own scale p / d (over which p, and log p, change by a factor of order e), so that Richardson's error
    // is of order 1e-12
    const kinks = (this.family.kinks?.(pr) ?? []).map((k) => Math.abs(x - k));
    const dist = Math.min(x - lo, hi - x, x !== 0 ? Math.abs(x) : Infinity, ...kinks);
    const h = 1e-3 * Math.min(logScale ? 1 / target : tail / D, dist);
    if (!(h > 0 && Number.isFinite(h)) || h < 1e6 * Math.max(EPS * Math.abs(x), Number.MIN_VALUE)) return;
    // Error of p: 10 times the promised accuracy, plus the rounding of log p. The difference over [x - h/2, x + h/2]
    // must be large enough for it to stay below 1e-7 of the difference
    const noise = logScale ? 10 * this.acc + 2 * EPS * Math.abs(tail) : 10 * this.acc * tail;
    if ((2 * noise) / (h * target) > 1e-7) return;
    const sign = lower ? 1 : -1;
    const estimate = (step: number): number => {
      const a = x - step;
      const b = x + step;
      return (sign * (this.call("p", b, pr, flags) - this.call("p", a, pr, flags))) / (b - a);
    };
    const e1 = estimate(h);
    const e2 = estimate(h / 2);
    // (4 e2 - e1) / 3 written so that it does not overflow near the largest double
    const rich = e2 + (e2 - e1) / 3;
    if (Math.abs(rich - target) <= TOL_DENSITY * target) return;
    this.report(
      "density",
      callText(this.family, "d", x, pr, logScale ? { log: true } : {}),
      `= ${logScale ? lD : D}; difference of ${callText(this.family, "p", x, pr, flags)} with step ${h}: ` +
        `${logScale ? "d / p" : "d"} ≈ ${rich}, expected ${target}`,
      pr,
      x,
    );
  }

  private pmfDifference(pt: Point, D: number, lD: number, pr: Params, lo: number, hi: number): void {
    const { x, P, Q, lP, lQ } = pt;
    if (!Number.isInteger(x) || x < lo || x > hi || Math.abs(x) >= 2 ** 52) return;
    const lower = P <= Q;
    const logScale = Math.min(P, Q) < 1e-290 || D < 1e-290;
    const flags = { lowerTail: lower, logP: logScale };
    // On the lower tail p(x) - p(x - 1), on the upper P[X > x - 1] - P[X > x]
    const atX = logScale ? (lower ? lP : lQ) : lower ? P : Q;
    const atPrev = this.call("p", x - 1, pr, flags);
    const [big, small] = lower ? [atX, atPrev] : [atPrev, atX];
    let ok: boolean;
    let diff: number;
    if (!logScale) {
      diff = big - small;
      ok = Math.abs(diff - D) <= TOL_PMF * D + 2 * this.acc * big;
    } else {
      const ratio = big === -Infinity ? 0 : Math.exp(small - big);
      diff = big + Math.log1p(-ratio);
      const err = (2 * this.acc + 4 * EPS * Math.abs(big)) * ((1 + ratio) / (1 - ratio));
      ok = diff === lD || Math.abs(diff - lD) <= TOL_PMF * Math.max(1, Math.abs(lD)) + err;
    }
    if (ok) return;
    this.report(
      "density",
      callText(this.family, "d", x, pr, logScale ? { log: true } : {}),
      `= ${logScale ? lD : D}; difference of ${callText(this.family, "p", x, pr, flags)} and at ${x - 1}: ${diff}`,
      pr,
      x,
    );
  }

  private roundTripDiscrete(pt: Point, D: number, lD: number, pr: Params, lo: number, hi: number): void {
    const { x, P, Q, lP, lQ } = pt;
    if (!Number.isInteger(x) || x < lo || x > hi || !(lD > -Infinity) || Math.abs(x) >= 2 ** 53) return;
    for (const lower of [true, false]) {
      const v = lower ? P : Q;
      const logP = v < 1e-290;
      const p = logP ? (lower ? lP : lQ) : v;
      // p = 0 and 1 are the ends of the support by definition
      if (p === -Infinity || v === 1 || D < 64 * EPS * v) continue;
      const flags = { lowerTail: lower, logP };
      const y = this.call("q", p, pr, flags);
      if (y === x) continue;
      const cdf = (t: number, logScale?: boolean): number => this.call("p", t, pr, { lowerTail: lower, logP: logP || logScale === true });
      if (satisfiesDefinition(p, lower, logP, y, cdf)) continue;
      this.report(
        "roundtrip",
        callText(this.family, "q", p, pr, flags),
        `= ${y}, expected ${x} (p = ${callText(this.family, "p", x, pr, flags)})`,
        pr,
        x,
      );
    }
  }

  private monotone(points: Point[], pr: Params): void {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const checks: [number, number, Flags][] = [
        [a.P, b.P, {}],
        [b.Q, a.Q, { lowerTail: false }],
        [a.lP, b.lP, { logP: true }],
        [b.lQ, a.lQ, { lowerTail: false, logP: true }],
      ];
      for (const [smaller, larger, flags] of checks) {
        if (Number.isNaN(smaller) || Number.isNaN(larger)) continue;
        if (smaller <= larger || smaller <= larger + TOL_MONOTONE * Math.max(Math.abs(smaller), Math.abs(larger))) continue;
        this.report(
          "monotone",
          callText(this.family, "p", b.x, pr, flags),
          `p(${a.x}) = ${flags.lowerTail === false ? larger : smaller}, p(${b.x}) = ${flags.lowerTail === false ? smaller : larger}`,
          pr,
          b.x,
        );
        break;
      }
    }
  }
}
