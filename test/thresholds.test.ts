import { describe, expect, it } from "vitest";
import {
  beta,
  darcsine,
  dbeta,
  dbinom,
  dcauchy,
  dchisq,
  dexp,
  df,
  dgamma,
  dgeom,
  dhyper,
  digamma,
  dinvgamma,
  dkumar,
  dlaplace,
  dlnorm,
  dlogis,
  dnbinom,
  dnorm,
  dpareto,
  dpois,
  dt,
  dtriang,
  dweibull,
  erf,
  erfc,
  erfinv,
  gamma,
  gammainc,
  lbeta,
  lgamma,
  lgamma1p,
  log1pexp,
  log1pmx,
  parcsine,
  pbeta,
  pcauchy,
  pchisq,
  pf,
  pgamma,
  pgeom,
  phyper,
  pinvgamma,
  pkumar,
  plnorm,
  pnbinom,
  pnorm,
  ppareto,
  pt,
  ptriang,
  ptukey,
  pweibull,
  qarcsine,
  qbeta,
  qbinom,
  qcauchy,
  qchisq,
  qexp,
  qf,
  qgamma,
  qhyper,
  qinvgamma,
  qkumar,
  qlnorm,
  qlogis,
  qnbinom,
  qnorm,
  qpareto,
  qpois,
  qt,
  qtriang,
  qtukey,
  qweibull,
} from "../src/index.js";
import { flipPoint, nextDown, nextUp, ulpsFrom } from "./helpers/float.js";

// Method-switching thresholds of the distribution functions and the special functions they are built on.
//
// Each entry names a condition in the code (file:line at the time of writing) that switches between two methods, and
// checks it through the public API:
// - continuity: the values at the two adjacent doubles that straddle the boundary (or, for a condition on a derived
//   quantity, the closest pair of inputs on either side) agree to 1e-13 relative, allowing for the change of the
//   function itself between the two inputs (the local slope times their distance). Where only an approximate boundary
//   is known, each side is extrapolated to it from four points by a cubic; across a sweep, each value is compared with
//   the cubic through its four neighbours
// - validity: for a branch whose condition reaches beyond the region where its method is valid, points inside the
//   condition but outside the method's assumption are checked against closed forms, the complement, or the range
// Entries that cannot be reached from the public API, or are dead code, are listed with the reason. Checks that fail
// because of a live bug are listed in KNOWN (the test fails once one passes), and calls that do not return in HANGS
// (not run). The boundary points are placed by mirroring the condition in the test (flipPoint finds the adjacent
// doubles where it changes); only the values come from the library.
// A recent bug of this kind: pchisq(3e9, 1, ncp = 3e9) took an asymptotic branch valid only far in the right tail and
// returned -21849.97.

type Fn = (v: number) => number;

/** An individual tolerance, with the reason it cannot be 1e-13 */
interface Tol {
  rel: number;
  why: string;
}

interface PairCase {
  kind: "pair";
  label: string;
  f: Fn;
  /** Inputs on the two sides (a < b) */
  a: number;
  b: number;
  tol?: Tol;
  /** Do not estimate the change of the function between a and b (for slow functions where it is negligible) */
  flat?: boolean;
}

interface ExtrapCase {
  kind: "extrap";
  label: string;
  f: Fn;
  /** Approximate boundary; each side is sampled at at ± k gap (k = 1..4) */
  at: number;
  gap: number;
  tol?: Tol;
  /**
   * Extrapolate by the least-squares line instead of the cubic (for values with noise, such as exp of a large log,
   * which the cubic's weights would amplify 15 times; the gap must then be small enough for the curvature not to matter)
   */
  linear?: boolean;
}

interface SweepCase {
  kind: "sweep";
  label: string;
  f: Fn;
  xs: number[];
  tol?: Tol;
}

interface CheckCase {
  kind: "check";
  label: string;
  /** undefined if the check passes, otherwise a description of the violation */
  run: () => string | undefined;
}

type Case = PairCase | ExtrapCase | SweepCase | CheckCase;

interface Entry {
  /** file:line in src (as of the last change to the file) */
  where: string;
  /** Public functions affected */
  fns: string;
  condition: string;
  /** The methods used when the condition is false | true */
  methods: string;
  /** The boundary point used */
  point: string;
  /** Why the entry is not tested */
  skip?: string;
  cases?: () => Case[];
}

/** A check that fails at the time of writing (a live bug). The test fails once it passes, so the list stays current */
interface KnownViolation {
  entry: string;
  check: string;
  reason: string;
}

/** A call that does not return in reasonable time (a synchronous hang cannot be interrupted, so it is not run) */
interface Hang {
  entry: string;
  call: string;
  reason: string;
}

const TOL = 1e-13;

// ---- Building cases ----

interface Tail {
  lowerTail: boolean;
  logP: boolean;
}
const TAILS: Tail[] = [
  { lowerTail: true, logP: false },
  { lowerTail: false, logP: false },
  { lowerTail: true, logP: true },
  { lowerTail: false, logP: true },
];
const tailName = (t: Tail): string => `${t.lowerTail ? "lower" : "upper"}${t.logP ? " log" : ""}`;

/** Continuity in all four tail/log modes of a distribution function g(v, tail) across [a, b] */
function pPairs(
  label: string,
  g: (v: number, t: Tail) => number,
  [a, b]: [number, number],
  opt: { tol?: Tol; flat?: boolean; tails?: Tail[] } = {},
): PairCase[] {
  return (opt.tails ?? TAILS).map((t) => ({
    kind: "pair",
    label: `${label} (${tailName(t)})`,
    f: (v) => g(v, t),
    a,
    b,
    ...(opt.tol && { tol: opt.tol }),
    ...(opt.flat && { flat: true }),
  }));
}

/** Continuity of a density g(v, log) on both scales across [a, b] */
function dPairs(label: string, g: (v: number, log: boolean) => number, [a, b]: [number, number], opt: { tol?: Tol } = {}): PairCase[] {
  return [false, true].map((log) => ({
    kind: "pair",
    label: `${label}${log ? " (log)" : ""}`,
    f: (v) => g(v, log),
    a,
    b,
    ...(opt.tol && { tol: opt.tol }),
  }));
}

/** A single continuity pair */
function pair(label: string, f: Fn, [a, b]: [number, number], opt: { tol?: Tol; flat?: boolean } = {}): PairCase {
  return { kind: "pair", label, f, a, b, ...(opt.tol && { tol: opt.tol }), ...(opt.flat && { flat: true }) };
}

/** The pair x - k ulp, x + k ulp around an approximate boundary x */
const around = (x: number, k = 4): [number, number] => [ulpsFrom(x, -k), ulpsFrom(x, k)];

/** [x, nextUp(x)] and [nextDown(x), x] */
const up = (x: number): [number, number] => [x, nextUp(x)];
const down = (x: number): [number, number] => [nextDown(x), x];

/**
 * Quantile continuity where the condition is on the probability of the smaller tail t (0 < t <= 1/2), as passed to the
 * start-value code: (P, Q) = (t, 1 - t) when solving the lower tail, (1 - t, t) for the upper. For each of the four
 * modes, the adjacent inputs at which cond(P, Q) flips within t in [lo, hi] (modes where it does not flip are left out)
 */
function qStartPairs(
  label: string,
  q: (p: number, t: Tail) => number,
  cond: (P: number, Q: number) => boolean,
  lo: number,
  hi: number,
): PairCase[] {
  const out: PairCase[] = [];
  for (const t of TAILS) {
    const pq = (lt: number): [number, number] => {
      const s = Math.exp(lt);
      const c = -Math.expm1(lt);
      return t.lowerTail ? [s, c] : [c, s];
    };
    const pred = t.logP ? (x: number) => cond(...pq(x)) : (x: number) => cond(...pq(Math.log(x)));
    const [l, h] = t.logP ? [Math.log(lo), Math.log(hi)] : [lo, hi];
    if (pred(l) === pred(h)) continue;
    out.push({ kind: "pair", label: `${label} (${tailName(t)})`, f: (v) => q(v, t), ...toAB(flipPoint(pred, l, h)) });
  }
  if (out.length === 0) throw new Error(`${label}: the condition does not flip in [${lo}, ${hi}]`);
  return out;
}
const toAB = ([a, b]: [number, number]) => ({ a, b });

// ---- Running cases ----

const relDiff = (x: number, y: number): number =>
  x === y ? 0 : Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y));
const fmt = (x: number): string => (Number.isInteger(x) && Math.abs(x) < 1e15 ? String(x) : x.toPrecision(17));

function runPair(c: PairCase): string | undefined {
  const fa = c.f(c.a);
  const fb = c.f(c.b);
  if (fa === fb) return undefined;
  const show = `f(${fmt(c.a)}) = ${fmt(fa)}, f(${fmt(c.b)}) = ${fmt(fb)}`;
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return show;
  const tol = c.tol?.rel ?? TOL;
  let allow = tol * Math.max(Math.abs(fa), Math.abs(fb));
  if (!c.flat) {
    // The change of the function itself over [a, b], from its slope over a wider interval around them (a jump at the
    // boundary enters that estimate only scaled by (b - a) / s)
    const s = Math.max(Math.abs(c.a), Math.abs(c.b)) * 1e-7;
    const lo = c.f(c.a - s);
    const hi = c.f(c.b + s);
    // (the ratio first: the product of a tiny value and a tiny distance underflows)
    if (Number.isFinite(lo) && Number.isFinite(hi)) allow += 2 * Math.abs(hi - lo) * ((c.b - c.a) / (c.b - c.a + 2 * s));
  }
  if (Math.abs(fa - fb) <= allow) return undefined;
  return `${show} (relative difference ${relDiff(fa, fb).toExponential(2)})`;
}

function runExtrap(c: ExtrapCase): string | undefined {
  // Cubic through the values at k = 1..4 steps from the boundary, evaluated at the boundary: 4 f1 - 6 f2 + 4 f3 - f4;
  // or the intercept of the least-squares line through them: f1 + f2/2 - f4/2
  const w = c.linear ? [1, 0.5, 0, -0.5] : [4, -6, 4, -1];
  const side = (dir: number): number => [1, 2, 3, 4].reduce((s, k, i) => s + w[i]! * c.f(c.at + dir * k * c.gap), 0);
  const l = side(-1);
  const r = side(1);
  const tol = c.tol?.rel ?? TOL;
  // (allow the rounding errors of the values times the sum of the weights on top of the tolerance)
  if (relDiff(l, r) <= tol + (c.linear ? 2 : 15) * Number.EPSILON) return undefined;
  return `extrapolated to ${fmt(c.at)}: from below ${fmt(l)}, from above ${fmt(r)} (relative difference ${relDiff(l, r).toExponential(2)})`;
}

function runSweep(c: SweepCase): string | undefined {
  const v = c.xs.map(c.f);
  const tol = c.tol?.rel ?? TOL;
  let worst = 0;
  let at = -1;
  for (let i = 2; i + 2 < v.length; i++) {
    const fit = (-v[i - 2]! + 4 * v[i - 1]! + 4 * v[i + 1]! - v[i + 2]!) / 6;
    const e = relDiff(v[i]!, fit);
    if (!(e <= worst)) {
      worst = e;
      at = i;
    }
  }
  if (worst <= tol + 2 * Number.EPSILON) return undefined;
  return `at ${fmt(c.xs[at]!)}: ${fmt(v[at]!)} against ${fmt((-v[at - 2]! + 4 * v[at - 1]! + 4 * v[at + 1]! - v[at + 2]!) / 6)} from its neighbours (relative ${worst.toExponential(2)})`;
}

function runCase(c: Case): string | undefined {
  switch (c.kind) {
    case "pair":
      return runPair(c);
    case "extrap":
      return runExtrap(c);
    case "sweep":
      return runSweep(c);
    case "check":
      return c.run();
  }
}

/** A validity check: |value - expected| <= tol |expected| (both NaN-free) */
function near(value: number, expected: number, tol: number, what: string): string | undefined {
  if (Number.isFinite(value) && Math.abs(value - expected) <= tol * Math.abs(expected)) return undefined;
  if (value === expected) return undefined;
  return `${what} = ${fmt(value)}, expected ${fmt(expected)} (relative error ${relDiff(value, expected).toExponential(2)})`;
}

/** lower + upper = 1 and the logs equal the logs of the values (p is the distribution function with tail options) */
function tailsConsistent(p: (t: Tail) => number, tol: number, what: string): string | undefined {
  const lo = p(TAILS[0]!);
  const hi = p(TAILS[1]!);
  const llo = p(TAILS[2]!);
  const lhi = p(TAILS[3]!);
  const bad: string[] = [];
  if (!(lo >= 0 && lo <= 1 && hi >= 0 && hi <= 1)) bad.push(`out of [0, 1]: ${fmt(lo)}, ${fmt(hi)}`);
  if (!(Math.abs(lo + hi - 1) <= 4 * Number.EPSILON)) bad.push(`lower + upper = ${fmt(lo + hi)}`);
  if (!(llo <= 0 && lhi <= 0)) bad.push(`logs not <= 0: ${fmt(llo)}, ${fmt(lhi)}`);
  // the log of the smaller tail against the log of its linear value (when that is a normal number)
  const [s, ls] = lo <= hi ? [lo, llo] : [hi, lhi];
  if (s > 1e-300 && !(relDiff(Math.log(s), ls) <= tol)) bad.push(`log of the smaller tail ${fmt(ls)} against log ${fmt(s)}`);
  // the larger tail on the log scale: log(1 - s)
  const [, lb] = lo <= hi ? [hi, lhi] : [lo, llo];
  if (!(relDiff(Math.log1p(-s), lb) <= tol || Math.abs(Math.log1p(-s) - lb) <= 1e-300)) bad.push(`log of the larger tail ${fmt(lb)} against log1p(-${fmt(s)})`);
  return bad.length === 0 ? undefined : `${what}: ${bad.join("; ")}`;
}

// ---- special/igam.ts: P(a, x) and Q(a, x) (pgamma, pchisq, ppois, the components of pchisq with ncp, pnt) ----

const pg = (shape: number) => (x: number, t: Tail) => pgamma(x, shape, t);
const pgShape = (x: number) => (shape: number, t: Tail) => pgamma(x, shape, t);

const IGAM: Entry[] = [
  {
    where: "special/igam.ts:55",
    fns: "pgamma, pchisq, ppois, gammainc",
    condition: "a > 1000 && x > 0.97 a",
    methods: "series for P in double | in double-double",
    point:
      "x = 0.97 a at a = 1e5 (x < a, outside Temme's region). Below a = 22500 every x in (0.97 a, a) is in Temme's " +
      "region (|x - a|/a < 4.5/sqrt(a)), so the a > 1000 side of the condition is not reached through gammaInc",
    cases: () => pPairs("pgamma(x, 1e5)", pg(1e5), flipPoint((x) => x > 0.97 * 1e5, 9e4, 9.9e4)),
  },
  {
    where: "special/igam.ts:320",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "x > 1.1 (then x < a)",
    methods: "small-x rules (P series if -0.4/log x < a or 1.1 x < a, else Q series) | P series or Q continued fraction",
    point: "x = 1.1 at a = 1.2 (Q series | P series) and a = 0.9 (Q series | continued fraction)",
    cases: () => [...pPairs("pgamma(x, 1.2)", pg(1.2), up(1.1)), ...pPairs("pgamma(x, 0.9)", pg(0.9), up(1.1))],
  },
  {
    where: "special/igam.ts:321",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "x < a (x > 1.1, outside Temme's region)",
    methods: "continued fraction for Q | series for P",
    point: "x = a = 5 and x = a = 20",
    cases: () => [...pPairs("pgamma(x, 5)", pg(5), down(5)), ...pPairs("pgamma(x, 20)", pg(20), down(20))],
  },
  {
    where: "special/igam.ts:325",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "x <= 0.5 ? -0.4/log(x) < a : 1.1 x < a",
    methods: "series for Q (DLMF 8.7.3) | series for P",
    point: "a = -0.4/log(0.3) at x = 0.3; x = 0.5 at a = 0.56; x = 0.8/1.1 at a = 0.8",
    cases: () => [
      ...pPairs("pgamma(0.3, a)", pgShape(0.3), flipPoint((a) => -0.4 / Math.log(0.3) < a, 0.2, 0.5)),
      ...pPairs("pgamma(x, 0.56)", pg(0.56), up(0.5)),
      ...pPairs("pgamma(x, 0.8)", pg(0.8), flipPoint((x) => x * 1.1 < 0.8, 0.6, 0.8)),
    ],
  },
  {
    where: "special/igam.ts:372, :414",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "x > 1e15 max(a, 1)",
    methods: "continued fraction | Q = x^(a-1) e^-x / Gamma(a) (1 + (a-1)/x)",
    point: "x = 1e15 at a = 0.5 and x = 2e15 at a = 2 (the next term ((a-1)/x)^2 is below 1e-30 relative there)",
    cases: () => [...pPairs("pgamma(x, 0.5)", pg(0.5), up(1e15)), ...pPairs("pgamma(x, 2)", pg(2), up(2e15))],
  },
  {
    where: "special/igam.ts:273 (:382, :427), 20 < a < 200",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "20 < a < 200 && |x - a|/a < 0.3",
    methods: "series / continued fraction | Temme's uniform expansion",
    point: "a = 20 at x = 18; x = 0.7 a and 1.3 a at a = 50 (a = 20 and 200 exactly fall to the series / continued fraction)",
    cases: () => {
      const rel = (a: number) => (x: number) => Math.abs(x - a) / a < 0.3;
      return [
        ...pPairs("pgamma(18, a)", pgShape(18), up(20)),
        ...pPairs("pgamma(x, 50)", pg(50), flipPoint(rel(50), 30, 40)),
        ...pPairs("pgamma(x, 50)", pg(50), flipPoint(rel(50), 60, 70)),
      ];
    },
  },
  {
    where: "special/igam.ts:273 (:382, :427), a > 200",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "a > 200 && |x - a|/a < 4.5/sqrt(a)",
    methods: "series / continued fraction | Temme's uniform expansion",
    point: "a = 200 at x = 190 (Temme on both sides of a = 200, the series at a = 200 itself); x = a (1 ± 0.045) at a = 1e4",
    cases: () => {
      const rel = (a: number) => (x: number) => Math.abs(x - a) / a < 4.5 / Math.sqrt(a);
      return [
        ...pPairs("pgamma(190, a)", pgShape(190), down(200)),
        ...pPairs("pgamma(190, a)", pgShape(190), up(200)),
        ...pPairs("pgamma(x, 1e4)", pg(1e4), flipPoint(rel(1e4), 9e3, 9.9e3)),
        ...pPairs("pgamma(x, 1e4)", pg(1e4), flipPoint(rel(1e4), 1.01e4, 1.1e4)),
      ];
    },
  },
];

// ---- special/igami.ts: starting values of qgamma (also qchisq, and Patnaik's start of qchisq/qf with ncp) ----
// A starting value only changes the number of Newton steps; the checks compare the final quantiles

const qg = (shape: number) => (p: number, t: Tail) => qgamma(p, shape, t);

/**
 * Mirror of the start-value computation for a >= 1 in igami.ts (DiDonato & Morris eq. 31, and eq. 35 below
 * w < 0.15 (a + 1)), used only to place the inputs on either side of its conditions
 */
function igamiStart(a: number, p: number, q: number): { w: number; z: number } {
  const horner = (x: number, c: number[]): number => c.slice(1).reduce((s, v) => s * x + v, c[0]!);
  const A = [0.213623493715853, 4.28342155967104, 11.6616720288968, 3.31125922108741];
  const B = [0.3611708101884203e-1, 1.27364489782223, 6.40691597760039, 6.61053765625462, 1];
  const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(q));
  let s = t - horner(t, A) / horner(t, B);
  if (p < 0.5) s = -s;
  const ra = Math.sqrt(a);
  let w = a + s * ra + (s * s - 1) / 3;
  w += (s * s * s - 7 * s) / (36 * ra);
  w -= (3 * s ** 4 + 7 * s * s - 16) / (810 * a);
  w += (9 * s ** 5 + 256 * s ** 3 - 433 * s) / (38880 * a * ra);
  let z = w;
  const ap1 = a + 1;
  const ap2 = a + 2;
  if (w < 0.15 * ap1) {
    const v = Math.log(p) + lgamma(ap1);
    z = Math.exp((v + w) / a);
    let u = Math.log1p((z / ap1) * (1 + z / ap2));
    z = Math.exp((v + z - u) / a);
    u = Math.log1p((z / ap1) * (1 + z / ap2));
    z = Math.exp((v + z - u) / a);
    u = Math.log1p((z / ap1) * (1 + (z / ap2) * (1 + z / (a + 3))));
    z = Math.exp((v + z - u) / a);
  }
  return { w, z };
}

const IGAMI: Entry[] = [
  {
    where: "special/igami.ts:64",
    fns: "qgamma, qchisq, qexp-like shape 1",
    condition: "a == 1: q > 0.9",
    methods: "-log(q) | -log1p(-p)",
    point: "lower-tail probability 0.1 at shape 1",
    cases: () => qStartPairs("qgamma(p, 1)", qg(1), (_P, Q) => Q > 0.9, 0.01, 0.5),
  },
  {
    where: "special/igami.ts:68",
    fns: "qgamma, qchisq",
    condition: "a < 1, b = q Gamma(a): b > 0.6 || (b >= 0.45 && a >= 0.3); a < 0.3 && b >= 0.35; b > 0.15 || a >= 0.3; b > 0.1",
    methods: "DiDonato & Morris eq. 21 | 22 | 23 | 24 | 25",
    point: "each b boundary at shape 0.2 (0.6, 0.35, 0.15, 0.1) and 0.5 (0.45); shape 0.3 itself at q = 0.167 and 0.03",
    cases: () => {
      const b = (a: number, lim: number, strict: boolean) => (_P: number, Q: number) =>
        strict ? Q * gamma(a) > lim : Q * gamma(a) >= lim;
      const upper = { lowerTail: false, logP: false };
      return [
        ...qStartPairs("qgamma(p, 0.2) at b = 0.6", qg(0.2), b(0.2, 0.6, true), 1e-4, 0.5),
        ...qStartPairs("qgamma(p, 0.2) at b = 0.35", qg(0.2), b(0.2, 0.35, false), 1e-4, 0.1),
        ...qStartPairs("qgamma(p, 0.2) at b = 0.15", qg(0.2), b(0.2, 0.15, true), 1e-4, 0.05),
        ...qStartPairs("qgamma(p, 0.2) at b = 0.1", qg(0.2), b(0.2, 0.1, true), 1e-4, 0.03),
        ...qStartPairs("qgamma(p, 0.5) at b = 0.45", qg(0.5), b(0.5, 0.45, false), 1e-4, 0.3),
        pair("qgamma(0.167, a, upper)", (a) => qgamma(0.167, a, upper), down(0.3)),
        pair("qgamma(0.03, a, upper)", (a) => qgamma(0.03, a, upper), down(0.3)),
      ];
    },
  },
  {
    where: "special/igami.ts:70",
    fns: "qgamma, qchisq",
    condition: "b q > 1e-8 && q > 1e-5 (inside eq. 21)",
    methods: "u = exp(-q/a - Euler) | u = (p Gamma(a) a)^(1/a)",
    point:
      "q = 1e-5 at shape 1e-6 (b = 10). Where b >= 0.45, b q > 1e-8 can only fail when q < 1e-5 already, so that part " +
      "of the condition never decides",
    cases: () => qStartPairs("qgamma(p, 1e-6)", qg(1e-6), (_P, Q) => Q > 1e-5, 1e-6, 1e-4),
  },
  {
    where: "special/igami.ts:108",
    fns: "qgamma, qchisq",
    skip:
      "no effect: |1 - w/a| < 1e-6 holds only for p > 1/2 (w is about a + s sqrt(a) - 1/3 with s the normal point), where " +
      "the next test (w < 3a) returns the same w",
    condition: "a >= 500 && |1 - w/a| < 1e-6",
    methods: "(continue) | return w",
    point: "-",
  },
  {
    where: "special/igami.ts:110",
    fns: "qgamma, qchisq",
    condition: "p > 0.5: w < 3a",
    methods: "eq. 33 / eq. 25 | w (eq. 31)",
    point: "upper-tail probability where w = 3a at shape 2",
    cases: () => qStartPairs("qgamma(p, 2)", qg(2), (P, Q) => P > 0.5 && igamiStart(2, P, Q).w < 6, 1e-6, 0.4),
  },
  {
    where: "special/igami.ts:113",
    fns: "qgamma, qchisq",
    condition: "p > 0.5, w >= 3a: lb = log q + lgamma(a) < -2.3 D, D = max(2, a (a - 1))",
    methods: "eq. 33 | eq. 25",
    point: "upper-tail probability exp(-13.8) / 2 at shape 3 (w >= 3a there)",
    cases: () => qStartPairs("qgamma(p, 3)", qg(3), (_P, Q) => Math.log(Q) + lgamma(3) < -2.3 * 6, 1e-9, 1e-4),
  },
  {
    where: "special/igami.ts:121",
    fns: "qgamma, qchisq",
    condition: "p <= 0.5: w < 0.15 (a + 1)",
    methods: "z = w | eq. 35 iterations",
    point: "lower-tail probability where w = 0.45 at shape 2",
    cases: () => qStartPairs("qgamma(p, 2)", qg(2), (P, Q) => P <= 0.5 && igamiStart(2, P, Q).w < 0.45, 1e-12, 0.4),
  },
  {
    where: "special/igami.ts:132",
    fns: "qgamma, qchisq",
    condition: "z <= 0.01 (a + 1) || z > 0.7 (a + 1)",
    methods: "eq. 36 | z",
    point: "z = 0.03 at shape 2 (after eq. 35) and z = 4.2 at shape 5",
    cases: () => [
      ...qStartPairs("qgamma(p, 2)", qg(2), (P, Q) => P <= 0.5 && igamiStart(2, P, Q).z <= 0.03, 1e-8, 0.1),
      ...qStartPairs("qgamma(p, 5)", qg(5), (P, Q) => P <= 0.5 && igamiStart(5, P, Q).z > 4.2, 0.01, 0.5),
    ],
  },
];

// ---- distributions/gamma.ts ----

const GAMMA: Entry[] = [
  {
    where: "distributions/gamma.ts:89, :115",
    fns: "dgamma, dchisq, qgamma (density in Newton steps)",
    condition: "shape < 1",
    methods: "dpois(shape - 1; x) | dpois(shape; x) shape / x",
    point: "shape = 1 at x = 0.5 and x = 30",
    cases: () => [
      ...dPairs("dgamma(0.5, shape)", (a, log) => dgamma(0.5, a, { log }), down(1)),
      ...dPairs("dgamma(30, shape)", (a, log) => dgamma(30, a, { log }), down(1)),
    ],
  },
  {
    where: "distributions/gamma.ts:203",
    fns: "qgamma, qchisq",
    condition: "shape > 1 && log p <= -700 (smaller tail); else log p > -700; else lower / upper",
    methods: "Wilson-Hilferty | DiDonato & Morris | x^a / Gamma(a + 1) or Q iteration",
    point: "smaller-tail log probability -700 at shapes 2 and 0.5",
    cases: () => {
      const out: Case[] = [];
      for (const shape of [2, 0.5]) {
        for (const lowerTail of [true, false]) {
          const t = { lowerTail, logP: true };
          out.push(pair(`qgamma(lp, ${shape}, ${tailName(t)})`, (lp) => qgamma(lp, shape, t), down(-700)));
          const tl = { lowerTail, logP: false };
          out.push(pair(`qgamma(p, ${shape}, ${tailName(tl)})`, (p) => qgamma(p, shape, tl), flipPoint((p) => Math.log(p) > -700, 1e-305, 1e-303)));
        }
      }
      return out;
    },
  },
];

// ---- special/incbet.ts: I_x(a, b) (pbeta, pt, pf, pbinom, pnbinom, the components of pbeta/pf with ncp) ----

const pb = (a: number, b: number) => (x: number, t: Tail) => pbeta(x, a, b, t);
const DBL_MIN = 2.2250738585072014e-308;
/** x^a (1-x)^b / B(a, b), the prefactor of the series and continued fractions, from the density */
const betaPrefactor = (x: number, a: number, b: number): number => dbeta(x, a, b) * x * (1 - x);

const INCBET: Entry[] = [
  {
    where: "special/incbet.ts:154, :779",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "prefactor x^a (1-x)^b / B(a, b) > 2.2e-305",
    methods: "exponent in double-double, one exp at the end | product on the linear scale",
    point: "prefactor = 2.2e-305 in the series (a = 10, b = 2) and in the continued fraction (a = 200, b = 300)",
    cases: () => {
      const lim = DBL_MIN * 1e3;
      const lin = TAILS.slice(0, 2);
      return [
        ...pPairs("pbeta(x, 10, 2)", pb(10, 2), around(flipPoint((x) => betaPrefactor(x, 10, 2) > lim, 1e-32, 1e-30)[0], 8), { tails: lin }),
        ...pPairs("pbeta(x, 200, 300)", pb(200, 300), around(flipPoint((x) => betaPrefactor(x, 200, 300) > lim, 1e-3, 0.1)[0], 8), { tails: lin }),
      ];
    },
  },
  {
    where: "special/incbet.ts:269, :650",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "max(a, b) >= 2^52, or a >= 2^20 with a + 200002 not exact (the steps a + 1, a + 2, ... cross into a binade where a's last bit does not fit)",
    methods: "continued fraction with double coefficients (loop inlined) | with double-double coefficients",
    point:
      "a = 2^52, b = 100, x = 1 - 1e-12 (continued fraction #1 in the lower frame; log P about -4030); a = 2^21 (exact " +
      "steps) against nextDown(2^21) (inexact) at b = 100, x = 1 - 4000/2^21. Validity: for huge a, I_x(a, b) = Q(b, u) " +
      "(1 + O(b²/a²)) with u = (a + (b - 1)/2)(-log x) (DiDonato & Morris eq. 9), checked just below powers of two, " +
      "where a + 1 and a + 2 are not exact for a non-integer a",
    cases: () => {
      const viaGamma = (as: number[]) => (): string | undefined => {
        const bad: string[] = [];
        for (const a of as) {
          const x = 1 - 4000 / a;
          const u = (a + 99 / 2) * -Math.log1p(-(1 - x));
          const r = near(pbeta(x, a, 100, { logP: true }), pgamma(u, 100, { lowerTail: false, logP: true }), 1e-13, `log pbeta(1 - 4000/a, ${a}, 100)`);
          if (r !== undefined) bad.push(r);
        }
        return bad.length === 0 ? undefined : bad.join("; ");
      };
      const ks = [40, 45, 48, 50, 51, 52];
      return [
        ...pPairs("pbeta(1 - 1e-12, a, 100)", (a, t) => pbeta(1 - 1e-12, a, 100, t), down(2 ** 52)),
        ...pPairs("pbeta(1 - 4000/2^21, a, 100)", (a, t) => pbeta(1 - 4000 / 2 ** 21, a, 100, t), down(2 ** 21)),
        { kind: "check", label: "integer a = 2^k - 1 against Q(b, u)", run: viaGamma(ks.map((k) => 2 ** k - 1)) },
        { kind: "check", label: "a = nextDown(2^k) against Q(b, u)", run: viaGamma(ks.map((k) => nextDown(2 ** k))) },
      ];
    },
  },
  {
    where: "special/incbet.ts:754",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "b x <= 1 && x <= 0.95 (series in the frame)",
    methods: "continued fraction / complement of the other frame's series | power series",
    point: "x = 0.1 at a = 2, b = 10; x = 0.95 at a = 3, b = 0.5",
    cases: () => [
      ...pPairs("pbeta(x, 2, 10)", pb(2, 10), flipPoint((x) => 10 * x <= 1, 0.05, 0.2)),
      ...pPairs("pbeta(x, 3, 0.5)", pb(3, 0.5), up(0.95)),
    ],
  },
  {
    where: "special/incbet.ts:763, :765",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "x <= a/(a + b), as 1 - x >= b/(a + b) above x = 1/2 (continued fraction in this frame)",
    methods: "1 - (continued fraction of the other frame) | continued fraction",
    point: "x = 5/13 at a = 5, b = 8; x = 8/13 at a = 8, b = 5",
    cases: () => [
      ...pPairs("pbeta(x, 5, 8)", pb(5, 8), flipPoint((x) => x <= 5 / 13, 0.3, 0.45)),
      ...pPairs("pbeta(x, 8, 5)", pb(8, 5), flipPoint((x) => 1 - x >= 5 / 13, 0.55, 0.7)),
    ],
  },
  {
    where: "special/incbet.ts:773",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "x (a + b - 2) - (a - 1) < 0",
    methods: "continued fraction #2 | #1",
    point: "x = 4/11 at a = 5, b = 8",
    cases: () => pPairs("pbeta(x, 5, 8)", pb(5, 8), flipPoint((x) => x * (5 + 8 - 2) - (5 - 1) < 0, 0.3, 0.38)),
  },
  {
    where: "special/incbet.ts:914, :915",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "x < DBL_MIN or 1 - x < DBL_MIN",
    methods: "series / continued fraction | the series with x^a / (a B(a, b)) in logs (betaIncTinyX)",
    point: "x = DBL_MIN at a = 0.5, b = 3; 1 - x = t^2/(3 + t^2) = DBL_MIN in pt(t, 3)",
    cases: () => [
      ...pPairs("pbeta(x, 0.5, 3)", pb(0.5, 3), down(DBL_MIN)),
      ...pPairs("pt(t, 3)", (v, t) => pt(v, 3, t), around(flipPoint((v) => (v * v) / (3 + v * v) < DBL_MIN, 1e-160, 1e-150)[0])),
    ],
  },
  {
    where: "special/incbet.ts:919",
    fns: "pbeta",
    skip: "only a shortcut: m = ab/(a + b) < min(a, b), so Temme's m >= 25 (incbetTemme.ts:187) already implies a, b >= 25",
    condition: "a >= 25 && b >= 25",
    methods: "-",
    point: "-",
  },
  {
    where: "special/incbet.ts:934",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "max(a, b) >= 15 && min(a, b) <= 40 (or x rounding to 1 in the large frame, see below)",
    methods: "continued fraction | expansion for large a (incbetLargeA.ts) where it applies",
    point: "a = 15 at b = 5, x = 0.8; b = 40 at a = 200, x = 0.95 (|τ| > 1, so not Temme's)",
    cases: () => [
      ...pPairs("pbeta(0.8, a, 5)", (a, t) => pbeta(0.8, a, 5, t), down(15)),
      ...pPairs("pbeta(0.95, 200, b)", (b, t) => pbeta(0.95, 200, b, t), up(40)),
    ],
  },
  {
    where: "special/incbet.ts:958, :1005",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition:
      "a |log x| > 32 v (v from the other frame's series) && the large-a expansion applies, or x below the mean and below " +
      "1 in the requested frame",
    methods: "complement of the other frame's series | large-a expansion, else continued fraction",
    point: "where 0.01 |log(1 - x)| = 32 I_x(1e4, 0.01), x about 1 - 8e-5 (the example of the comment, both frames)",
    cases: () => {
      const lower = { lowerTail: true, logP: false };
      const x0 = flipPoint((x) => 0.01 * Math.abs(Math.log(1 - x)) > 32 * pbeta(x, 1e4, 0.01, lower), 1 - 2e-4, 1 - 2e-5)[0];
      const q0 = flipPoint((x) => 0.01 * Math.abs(Math.log(x)) > 32 * pbeta(x, 0.01, 1e4, { lowerTail: false, logP: false }), 2e-5, 2e-4)[0];
      return [...pPairs("pbeta(x, 1e4, 0.01)", pb(1e4, 0.01), around(x0)), ...pPairs("pbeta(x, 0.01, 1e4)", pb(0.01, 1e4), around(q0))];
    },
  },
  {
    where: "special/incbet.ts:977",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "series in this frame with value v > 1/2, and the series applies in the other frame",
    methods: "v | 1 - (the other frame's series)",
    point: "v = 1/2 in pbeta(x, 0.3, 0.7)",
    cases: () => {
      const half = flipPoint((x) => pbeta(x, 0.3, 0.7) > 0.5, 0.05, 0.4)[0];
      return pPairs("pbeta(x, 0.3, 0.7)", pb(0.3, 0.7), around(half, 8));
    },
  },
  {
    where: "special/incbet.ts:995",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "series in the other frame only, its value o < 1/2",
    methods: "complement of the other frame's series (pseriesComplement) | 1 - o",
    point: "o = (1 - x)^0.1 = 1/2 in pbeta(x, 1, 0.1) (frame (0.1, 1, 1 - x) for the lower tail; x = 1 - 2^-10)",
    cases: () => pPairs("pbeta(x, 1, 0.1)", pb(1, 0.1), around(flipPoint((x) => Math.pow(1 - x, 0.1) < 0.5, 0.99, 0.9999)[0], 8)),
  },
  {
    where: "special/incbet.ts:970",
    fns: "pbeta, pt, pf, pbinom, pnbinom (log)",
    condition: "log wanted && v < 1e-290",
    methods: "log of the linear value | recomputed in logs",
    point: "lower tail = 1e-290 at a = 2, b = 3 (series) and a = 50, b = 100 (continued fraction)",
    cases: () => {
      const lin = (a: number, b: number) => (x: number) => pbeta(x, a, b) < 1e-290;
      const log = [TAILS[2]!];
      return [
        ...pPairs("pbeta(x, 2, 3)", pb(2, 3), flipPoint(lin(2, 3), 1e-150, 1e-140), { tails: log }),
        ...pPairs("pbeta(x, 50, 100)", pb(50, 100), flipPoint(lin(50, 100), 1e-10, 0.2), { tails: log }),
      ];
    },
  },
];

// ---- special/incbetPrefactor.ts: x^a (1-x)^b / B(a, b) for a small or a huge shape ----

const PREFACTOR: Entry[] = [
  {
    where: "special/incbetPrefactor.ts:48, distributions/f.ts:88",
    fns: "pbeta, pt, pf, pbinom, pnbinom, df",
    condition: "min(a, b) < 1",
    methods: "Loader's binomial form | 1/B(a, b) = ab/(a + b) Γ(1+a+b)/(Γ(1+a) Γ(1+b))",
    point:
      "a = 1 at b = 3, x = 0.3 (series); b = 1 at a = 3, x = 0.3 (continued fraction) and at a = 200, x = 0.95 " +
      "(large-a expansion); df2 = 2 in df(0.7, 5, df2) (df1 = 2 switches the form of Loader's density as well, below)",
    cases: () => [
      ...pPairs("pbeta(0.3, a, 3)", (a, t) => pbeta(0.3, a, 3, t), down(1)),
      ...pPairs("pbeta(0.3, 3, b)", (b, t) => pbeta(0.3, 3, b, t), down(1)),
      ...pPairs("pbeta(0.95, 200, b)", (b, t) => pbeta(0.95, 200, b, t), down(1)),
      ...dPairs("df(0.7, 5, df2)", (n, log) => df(0.7, 5, n, { log }), down(2)),
    ],
  },
  {
    where: "special/incbetPrefactor.ts:51",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "max(a, b) >= 2^52 && min(a, b) <= 100",
    methods: "Loader's binomial form | 1/B(a, b) = Γ(l + s)/(Γ(l) Γ(s)) from Stirling's series",
    point: "a = 2^52 at b = 5, 1 - x = 5/2^52 (large-a expansion); b = 100 at a = 2^60, 1 - x = 400/2^60 (continued fraction)",
    cases: () => [
      ...pPairs("pbeta(1 - 5/2^52, a, 5)", (a, t) => pbeta(1 - 5 / 2 ** 52, a, 5, t), down(2 ** 52)),
      ...pPairs("pbeta(1 - 400/2^60, 2^60, b)", (b, t) => pbeta(1 - 400 / 2 ** 60, 2 ** 60, b, t), up(100)),
    ],
  },
];

// ---- special/incbetTemme.ts: uniform expansion for large a and b ----

/** τ² = 2E/m of Temme's expansion (E the deviance), in double precision (used to place the inputs) */
function temmeTau2(x: number, a: number, b: number): number {
  const r = a + b;
  const E = a * Math.log(a / (r * x)) + b * Math.log(b / (r * (1 - x)));
  return (2 * E) / ((a * b) / r);
}
/** x below the mean of Beta(a, b) where τ² crosses lim */
const temmeX = (a: number, b: number, lim: number): number =>
  flipPoint((x) => temmeTau2(x, a, b) <= lim, 1e-3, a / (a + b))[0];

const TEMME: Entry[] = [
  {
    where: "special/incbetTemme.ts:187",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "m = ab/(a + b) >= 25 (and a + b finite)",
    methods: "continued fraction / large-a expansion | Temme's expansion",
    point: "m = 25 at b = 100 (a = 100/3), x = 0.25",
    cases: () => pPairs("pbeta(0.25, a, 100)", (a, t) => pbeta(0.25, a, 100, t), flipPoint((a) => (a * 100) / (a + 100) >= 25, 30, 40)),
  },
  {
    where: "special/incbetTemme.ts:193",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "|x - p| > 2pq (cheap filter before τ)",
    methods: "Temme's expansion if |τ| <= 1 | not used",
    point: "x = p + 2pq at a = 60, b = 90 (p = 0.4, x = 0.88); |τ| > 1 there, so the filter decides nothing that τ does not",
    cases: () => {
      const [a, b] = [60, 90];
      const p = a / (a + b);
      const pq = (a * b) / (a + b) / (a + b);
      return pPairs("pbeta(x, 60, 90)", pb(a, b), flipPoint((x) => Math.abs(x - p) > 2 * pq, 0.5, 0.99));
    },
  },
  {
    where: "special/incbetTemme.ts:202",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "τ² <= 1",
    methods: "continued fraction / series | Temme's expansion",
    point: "τ² = 1 below the mean at a = 60, b = 90 and a = 1000, b = 30",
    cases: () => [
      ...pPairs("pbeta(x, 60, 90)", pb(60, 90), around(temmeX(60, 90, 1), 8)),
      ...pPairs("pbeta(x, 1000, 30)", pb(1000, 30), around(temmeX(1000, 30, 1), 8)),
    ],
  },
  {
    where: "special/incbetTemme.ts:205",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "|τ| <= 0.5 / <= 0.75",
    methods: "30 | 24 | 20 Taylor coefficients",
    point: "τ² = 0.25 and 0.5625 below the mean at a = 60, b = 90",
    cases: () => [
      ...pPairs("pbeta(x, 60, 90)", pb(60, 90), around(temmeX(60, 90, 0.25), 8)),
      ...pPairs("pbeta(x, 60, 90)", pb(60, 90), around(temmeX(60, 90, 0.5625), 8)),
    ],
  },
  {
    where: "special/incbetTemme.ts:211",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "y = sqrt(E) < 1.5",
    methods: "tail form e^-E (F(y) + ...) | ½ erfc(∓y) ∓ R",
    point: "E = 2.25 (τ² = 4.5/m) below the mean at a = 60, b = 90",
    cases: () => pPairs("pbeta(x, 60, 90)", pb(60, 90), around(temmeX(60, 90, 4.5 / 36), 8)),
  },
  {
    where: "special/incbetTemme.ts:134",
    fns: "pbeta, pt, pf, pbinom, pnbinom (Temme), pbeta with b = 1/2 (large-a expansion)",
    condition: "0.5 <= y < 1 in ½ erfc(y)",
    methods: "0.5 erfc(y) | erfc(1) + Gauss-Legendre integral",
    point: "E = 0.25 and 1 (y = 0.5, 1) below the mean at a = 60, b = 90",
    cases: () => [
      ...pPairs("pbeta(x, 60, 90)", pb(60, 90), around(temmeX(60, 90, 0.5 / 36), 8)),
      ...pPairs("pbeta(x, 60, 90)", pb(60, 90), around(temmeX(60, 90, 2 / 36), 8)),
    ],
  },
];

// ---- special/incbetLargeA.ts: expansion for large a and small b ----

/** u0 = -(a + (b - 1)/2) log1p(-y) of incbetLargeA.ts, y = 1 - x */
const largeAU0 = (x: number, a: number, b: number): number => -(a + (b - 1) / 2) * Math.log1p(-(1 - x));

const LARGE_A: Entry[] = [
  {
    where: "special/incbetLargeA.ts:124",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "y = 1 - x <= 0.3",
    methods: "continued fraction | expansion",
    point: "x = 0.7 at a = 100, b = 5",
    cases: () => pPairs("pbeta(x, 100, 5)", pb(100, 5), flipPoint((x) => 1 - x <= 0.3, 0.6, 0.8)),
  },
  {
    where: "special/incbetLargeA.ts:128",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "u0 >= median of Gamma(b, 1) (b - 1/3, or 2^(-1/b) for b < 1)",
    methods: "H side (lower incomplete gamma) | J side (upper)",
    point: "u0 = 14/3 at a = 100, b = 5 (x about 0.955)",
    cases: () => pPairs("pbeta(x, 100, 5)", pb(100, 5), around(flipPoint((x) => largeAU0(x, 100, 5) >= 5 - 1 / 3, 0.9, 0.99)[0], 2)),
  },
  {
    where: "special/incbetLargeA.ts:130",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "u0 > 500 (unless x rounds to 1), or J side with u0 < 0.1",
    methods: "expansion | continued fraction",
    point: "u0 = 500 at a = 2000, b = 5; u0 = 0.1 at a = 100, b = 0.1 (J side)",
    cases: () => [
      ...pPairs("pbeta(x, 2000, 5)", pb(2000, 5), around(flipPoint((x) => largeAU0(x, 2000, 5) > 500, 0.7, 0.8)[0], 2)),
      ...pPairs("pbeta(x, 100, 0.1)", pb(100, 0.1), around(flipPoint((x) => largeAU0(x, 100, 0.1) < 0.1, 0.99, 0.99999)[0], 2)),
    ],
  },
  {
    where: "special/incbetLargeA.ts:226",
    fns: "pbeta",
    skip:
      "unreachable except where x rounds to 1 (then the log form, see the extreme-parameter entries below): the H side " +
      "falls below 1e-290 only for a y < 1e-6, where the series in frame (b, a, y) is used first; the J side is at least " +
      "about Q(b, 500) > 1e-230",
    condition: "small >= 1e-290",
    methods: "-",
    point: "-",
  },
  {
    where: "special/incbetLargeA.ts:87, :89",
    fns: "pbeta, pt (b = 1/2 frames), pf",
    condition: "b == 0.5; then sqrt(u) >= 1",
    methods: "continued fraction for J_0 | closed form with erfcx (r >= 1) or with ½ erfc (r < 1)",
    point: "b = 0.5 at a = 100, x = 0.97 (u = 3); u = 1 at a = 100, b = 0.5",
    cases: () => {
      const u = (x: number) => (100 - 0.25) * -Math.log(x);
      return [
        ...pPairs("pbeta(0.97, 100, b)", (b, t) => pbeta(0.97, 100, b, t), up(0.5)),
        ...pPairs("pbeta(x, 100, 0.5)", pb(100, 0.5), around(flipPoint((x) => u(x) >= 1, 0.98, 0.999)[0], 2)),
      ];
    },
  },
];

// ---- special/beta.ts, special/lgammaDiff.ts: log B(a, b) (pbeta, pt, qt, pf, the noncentral ones) ----

const BETA_FN: Entry[] = [
  {
    where: "special/beta.ts:45, :109",
    fns: "beta, lbeta (and through them pt, qt, qbeta, pf, ...)",
    condition: "max(a, b) > 15",
    methods: "Cephes (gamma ratio) | double-double Stirling form",
    point: "a = 15 at b = 3",
    cases: () => [pair("lbeta(a, 3)", (a) => lbeta(a, 3), up(15)), pair("beta(a, 3)", (a) => beta(a, 3), up(15))],
  },
  {
    where: "special/beta.ts:49, :113",
    fns: "beta, lbeta",
    condition: "max > 15 and min(a, b) < 1",
    methods: "double-double Stirling form | lgamma(min) - lgammaDiff(min, max)",
    point: "b = 1 at a = 20",
    cases: () => [pair("lbeta(20, b)", (b) => lbeta(20, b), down(1)), pair("beta(20, b)", (b) => beta(20, b), down(1))],
  },
  {
    where: "special/beta.ts:53, :114",
    fns: "beta, lbeta, pbeta and pt with huge parameters",
    condition: "max(a, b) >= 2^52",
    methods: "double-double Stirling form | b log(b/a) form (lbetaHuge)",
    point: "a = 2^52 at b = 5",
    cases: () => [pair("lbeta(a, 5)", (a) => lbeta(a, 5), down(2 ** 52)), pair("beta(a, 5)", (a) => beta(a, 5), down(2 ** 52))],
  },
  {
    where: "special/beta.ts:61, :122",
    fns: "beta, lbeta",
    skip: "unreachable: reached only for max(a, b) <= 15, but needs a > 1e6 (lbetaAsymp); likewise MAXGAM (171) at :65, :119",
    condition: "a > 1e6 max(|b|, 1)",
    methods: "-",
    point: "-",
  },
  {
    where: "special/lgammaDiff.ts:32",
    fns: "lbeta (min < 1), pbeta (complement of the series), the noncentral beta",
    condition: "B <= 15",
    methods: "Stirling difference directly | upward recurrence to B > 15 first",
    point: "B = 15 in the complement of the series of pbeta(0.99, a, 2) at a = 15",
    cases: () => pPairs("pbeta(0.99, a, 2)", (a, t) => pbeta(0.99, a, 2, t), up(15)),
  },
  {
    where: "special/lgammaDiff.ts:39",
    fns: "lbeta (min < 1), pbeta",
    condition: "|a log(B + a)| > 2",
    methods: "a log(B + a) in double | in double-double",
    point: "lbeta(0.5, b) at b = e^4 - 0.5",
    cases: () => [pair("lbeta(0.5, b)", (b) => lbeta(0.5, b), flipPoint((b) => Math.abs(0.5 * Math.log(b + 0.5)) > 2, 50, 60))],
  },
];

// ---- special/loader.ts: Loader's stirlerr and bd0 (every density, and the prefactors of P(a, x) and I_x(a, b)) ----

/** dgamma(x, shape) is dpois(shape - 1; x): stirlerr(shape - 1) and bd0(shape - 1, x) */
const dgShape = (x: number) => (shape: number, log: boolean) => dgamma(x, shape, { log });

const LOADER: Entry[] = [
  {
    where: "special/loader.ts:41",
    fns: "every density (dgamma, dbeta, dbinom, dpois, dt, df, ...), pgamma, pbeta",
    condition: "n > 500 / > 80 / > 35 (in the Stirling series for n > 15)",
    methods: "2 | 3 | 4 | 7 terms of the Stirling series",
    point: "dgamma(n + 1, n + 1) at n = 500, 80, 35 (stirlerr(shape - 1))",
    cases: () => [500, 80, 35].flatMap((n) => dPairs(`dgamma(${n + 1}, shape)`, dgShape(n + 1), up(n + 1))),
  },
  {
    where: "special/loader.ts:52",
    fns: "every density, pgamma, pbeta",
    condition: "n > 15; 2n an integer; n < 1",
    methods: "table at half-integers | recurrence up to 15 | lgamma1p form below 1 | Stirling series above 15",
    point: "dgamma(x, shape) at shape - 1 = 15, 2.5, 1",
    cases: () => [
      ...dPairs("dgamma(16, shape)", dgShape(16), up(16)),
      ...dPairs("dgamma(3.5, shape)", dgShape(3.5), up(3.5)),
      ...dPairs("dgamma(3.5, shape)", dgShape(3.5), down(3.5)),
      ...dPairs("dgamma(2, shape)", dgShape(2), down(2)),
      ...dPairs("dgamma(2, shape)", dgShape(2), up(2)),
    ],
  },
  {
    where: "special/loader.ts:103, :361",
    fns: "every density, pgamma, pbeta",
    condition: "|x - M| < 0.1 (x + M) in bd0(x, M)",
    methods: "x log(x/M) + M - x | series in v = (x - M)/(x + M)",
    point: "dpois(100, λ) at λ = 100 (0.9/1.1) and 100 (1.1/0.9)",
    cases: () => {
      const pred = (l: number) => Math.abs(100 - l) < 0.1 * (100 + l);
      return [
        ...dPairs("dpois(100, λ)", (l, log) => dpois(100, l, { log }), flipPoint(pred, 70, 90)),
        ...dPairs("dpois(100, λ)", (l, log) => dpois(100, l, { log }), flipPoint(pred, 110, 130)),
      ];
    },
  },
  {
    where: "special/loader.ts:198",
    fns: "every density, pgamma, pbeta",
    condition: "|x v^3| <= 0.12 in the bd0 series",
    methods: "series tail in double-double | in double",
    point: "dpois(1e4, λ) at 1e4 v^3 = 0.12 (λ about 9552)",
    cases: () => {
      const pred = (l: number) => Math.abs(1e4 * ((1e4 - l) / (1e4 + l)) ** 3) <= 0.12;
      return dPairs("dpois(1e4, λ)", (l, log) => dpois(1e4, l, { log }), around(flipPoint(pred, 9000, 9900)[0], 8));
    },
  },
  {
    where: "special/loader.ts:354, :377",
    fns: "every density, pgamma, pbeta",
    condition: "1e-290 < x/M < 1e290 && max(x, M) < 1e300",
    methods: "log x - log M | log of the double-double quotient",
    point: "dpois(1e10, λ) at λ = 1e-280 and dpois(1, λ) at λ = 1e290 (log scale; the values underflow)",
    cases: () => [
      pair("dpois(1e10, λ, log)", (l) => dpois(1e10, l, { log: true }), flipPoint((l) => 1e10 / l < 1e290, 5e-281, 5e-280)),
      pair("dpois(1, λ, log)", (l) => dpois(1, l, { log: true }), flipPoint((l) => 1 / l > 1e-290, 5e289, 5e290)),
    ],
  },
  {
    where: "special/loader.ts:481, :491",
    fns: "dbinom, dgeom, dnbinom, pgeom, dhyper",
    condition: "x = 0 with p < 0.1 (n - x = 0 with q < 0.1)",
    methods: "n log q in double-double | -bd0(n, nq) - np",
    point: "dbinom(0, 50, p) and dgeom(0..., p) at p = 0.1; dbinom(50, 50, p) at 1 - p = 0.1",
    cases: () => [
      ...dPairs("dbinom(0, 50, p)", (p, log) => dbinom(0, 50, p, { log }), down(0.1)),
      ...dPairs("dgeom(30, p)", (p, log) => dgeom(30, p, { log }), down(0.1)),
      ...dPairs("dbinom(50, 50, p)", (p, log) => dbinom(50, 50, p, { log }), flipPoint((p) => 1 - p < 0.1, 0.85, 0.95)),
    ],
  },
  {
    where: "special/loader.ts:546",
    fns: "dpois, dgamma (shape < 1), pgamma",
    condition: "x <= λ DBL_MIN",
    methods: "Loader's form | e^-λ",
    point: "dgamma(1, shape) at shape = DBL_MIN; dpois(1, λ) at λ = 2^1022 (log)",
    cases: () => [
      ...dPairs("dgamma(1, shape)", (s, log) => dgamma(1, s, { log }), up(DBL_MIN)),
      pair("dpois(1, λ, log)", (l) => dpois(1, l, { log: true }), down(2 ** 1022)),
    ],
  },
  {
    where: "special/loader.ts:547",
    fns: "dpois, dgamma, pgamma",
    condition: "λ < x DBL_MIN",
    methods: "Loader's form | -λ + x log λ - lgamma1p(x)",
    point: "dpois(3, λ, log) at λ = 3 DBL_MIN",
    cases: () => [pair("dpois(3, λ, log)", (l) => dpois(3, l, { log: true }), flipPoint((l) => l < 3 * DBL_MIN, DBL_MIN, 4 * DBL_MIN))],
  },
];

// ---- special/gamma.ts: gamma, lgamma, lgamma1p ----

/** Γ(x) Γ(1 - x) = π / sin(π x) on both sides of a pole, as a validity check of the reflection branches */
function reflection(x: number): string | undefined {
  const lhs = lgamma(x) + lgamma(1 - x);
  const rhs = Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x)));
  return near(lhs, rhs, 1e-13, `lgamma(${x}) + lgamma(${1 - x})`);
}

const GAMMA_FN: Entry[] = [
  {
    where: "special/gamma.ts:85",
    fns: "gamma (and lbeta, beta, the start of qgamma)",
    condition: "|x| > 33",
    methods: "recurrence and rational approximation | Stirling form in double-double (reflection for x < 0)",
    point: "x = 33; x = -33 is a pole, so the negative side is checked by the reflection formula at -33 ± 0.3",
    cases: () => [
      pair("gamma(x)", (x) => gamma(x), up(33)),
      {
        kind: "check",
        label: "gamma(x) gamma(1 - x) sin(πx) = π at x = -33 ± 0.3",
        run: () => {
          const bad = [-33.3, -32.7].map((x) => near(gamma(x) * gamma(1 - x) * Math.sin(Math.PI * x), Math.PI, 1e-13, `gamma(${x}) gamma(${1 - x}) sin`));
          return bad.find((s) => s !== undefined);
        },
      },
    ],
  },
  {
    where: "special/gamma.ts:107, :112",
    fns: "gamma",
    condition: "|x| < 1e-9 during the reduction",
    methods: "recurrence and rational approximation | 1 / ((1 + γ x) x)",
    point: "x = ±1e-9",
    cases: () => [pair("gamma(x)", (x) => gamma(x), down(1e-9)), pair("gamma(x)", (x) => gamma(x), up(-1e-9))],
  },
  {
    where: "special/gamma.ts:151",
    fns: "lgamma (and every function using it)",
    condition: "x < -34",
    methods: "direct | reflection",
    point: "x = -34 is a pole: the reflection formula at -34.3 and -33.7",
    cases: () => [{ kind: "check", label: "reflection at -34 ± 0.3", run: () => reflection(-34.3) ?? reflection(-33.7) }],
  },
  {
    where: "special/gamma.ts:169, :195",
    fns: "lgamma",
    condition: "x < 13; x >= 1000",
    methods: "recurrence and rational approximation | Stirling series | Stirling with three terms",
    point: "x = 13 and x = 1000",
    cases: () => [pair("lgamma(x)", (x) => lgamma(x), down(13)), pair("lgamma(x)", (x) => lgamma(x), down(1000))],
  },
  {
    where: "special/gamma.ts:143",
    fns: "lgamma",
    condition: "x > 1e8",
    methods: "with the 1/(12x) correction | without",
    point: "x = 1e8 (the correction is 8e-10, 5e-19 of lgamma)",
    cases: () => [pair("lgamma(x)", (x) => lgamma(x), up(1e8))],
  },
  {
    where: "special/gamma.ts:220",
    fns: "lgamma",
    condition: "|x - 1| <= 0.2, |x - 2| <= 0.2",
    methods: "lgammaSign | lgamma1p(x - 1) or lgamma1p(x - 2) + log1p(x - 2)",
    point: "x = 0.8, 1.2, 1.8, 2.2",
    cases: () =>
      [
        [1, 0.7, 0.9],
        [1, 1.1, 1.3],
        [2, 1.7, 1.9],
        [2, 2.1, 2.3],
      ].map(([c, lo, hi]) => pair("lgamma(x)", (x) => lgamma(x), flipPoint((x) => Math.abs(x - c!) <= 0.2, lo!, hi!))),
  },
  {
    where: "special/gamma.ts:260",
    fns: "lgamma1p (and pgamma, pbeta, the start of qbeta through it)",
    condition: "|x| <= 0.2, |x - 1| <= 0.2",
    methods: "lgamma(x + 1) | log(x) + Taylor series of lgamma1p(x - 1) | Taylor series",
    point: "x = ±0.2, 0.8, 1.2",
    cases: () =>
      [
        [0, -0.3, -0.1],
        [0, 0.1, 0.3],
        [1, 0.7, 0.9],
        [1, 1.1, 1.3],
      ].map(([c, lo, hi]) => pair("lgamma1p(x)", (x) => lgamma1p(x), flipPoint((x) => Math.abs(x - c!) <= 0.2, lo!, hi!))),
  },
  {
    where: "special/gamma.ts:52",
    fns: "-",
    skip: "dead code: stirfXsf (and MAXSTIR) is never called",
    condition: "x > MAXSTIR",
    methods: "-",
    point: "-",
  },
];

// ---- special/erf.ts, special/ndtri.ts, distributions/normal.ts, special/log1pmx.ts, special/psigamma.ts ----

const NORMAL: Entry[] = [
  {
    where: "special/erf.ts:63, :89",
    fns: "erf, erfc (and pnorm, ptukey, pnt through them)",
    condition: "x > 1 in erf, x < 1 in erfc",
    methods: "rational approximation of erf | of erfc",
    point: "x = 1",
    cases: () => [pair("erf(x)", (x) => erf(x), up(1)), pair("erfc(x)", (x) => erfc(x), down(1))],
  },
  {
    where: "special/erf.ts:104, :107",
    fns: "pnorm (log), qnorm (log p < -2048), plnorm, pnt, ptukey",
    condition: "x < 1; x > 1e8 in erfcx",
    methods: "exp(x²)(1 - erf x) | rational approximation | 1/(sqrt(pi) x)",
    point: "pnorm(t, log) at t = -sqrt(2) (erfcx argument 1) and t = -sqrt(2) 1e8",
    cases: () => [
      ...pPairs("pnorm(t)", (t, o) => pnorm(t, o), flipPoint((t) => -t * Math.SQRT1_2 < 1, -1.5, -1.3), { tails: TAILS.slice(2) }),
      ...pPairs("pnorm(t)", (t, o) => pnorm(t, o), flipPoint((t) => -t * Math.SQRT1_2 > 1e8, -1.5e8, -1.4e8), { tails: TAILS.slice(2) }),
    ],
  },
  {
    where: "special/erf.ts:112",
    fns: "erfc, pnorm, plnorm, pnt, ptukey",
    condition: "x < 8 in the rational approximation of erfcx",
    methods: "R/S | P/Q",
    point: "erfc(8); pnorm(t) at t = -8 sqrt(2)",
    cases: () => [
      pair("erfc(x)", (x) => erfc(x), down(8)),
      ...pPairs("pnorm(t)", (t, o) => pnorm(t, o), flipPoint((t) => -t * Math.SQRT1_2 < 8, -11.4, -11.2)),
    ],
  },
  {
    where: "distributions/normal.ts:49",
    fns: "pnorm",
    condition: "a = -t < sqrt(2) (smaller tail)",
    methods: "erfcx(a/sqrt(2)) exp(-a²/2) / 2 | 0.5 - 0.5 erf(a/sqrt(2))",
    point: "t = -sqrt(2)",
    cases: () => pPairs("pnorm(t)", (t, o) => pnorm(t, o), flipPoint((t) => -t < Math.SQRT2, -1.5, -1.3), { tails: TAILS.slice(0, 2) }),
  },
  {
    where: "distributions/normal.ts:56",
    fns: "pnorm (log)",
    condition: "logP: t > -1",
    methods: "log(erfcx(a/sqrt(2)) / 2) - a²/2 | log1p(-(other tail))",
    point: "t = -1 (lower) and t = 1 (upper)",
    cases: () => [
      pair("pnorm(t, lower log)", (t) => pnorm(t, { logP: true }), up(-1)),
      pair("pnorm(t, upper log)", (t) => pnorm(t, { lowerTail: false, logP: true }), down(1)),
    ],
  },
  {
    where: "distributions/normal.ts:104",
    fns: "qnorm (log), qlnorm, qt start, qnt start",
    condition: "log p < -2048",
    methods: "Cephes tail approximation | with one Newton step on log Φ",
    point: "log p = -2048",
    cases: () => [pair("qnorm(lp, log)", (lp) => qnorm(lp, { logP: true }), down(-2048))],
  },
  {
    where: "distributions/normal.ts:127",
    fns: "dnorm",
    condition: "1 / (sd sqrt(2π)) finite",
    methods: "exp(-z²/2) / (sd sqrt(2π)) with sd scaled by 2^600 | the same unscaled",
    point: "sd where 1 / (sd sqrt(2π)) overflows (about 2.2e-309) at x = 6.6e-308 (z about 30)",
    cases: () => [pair("dnorm(6.6e-308, sd)", (sd) => dnorm(6.6e-308, { sd }), flipPoint((sd) => 0.3989422804014327 / sd < Infinity, 2e-309, 2.5e-309))],
  },
  {
    where: "special/ndtri.ts:60, :64",
    fns: "qnorm, qlnorm",
    condition: "y > e^-2 (and y > 1 - e^-2 mirrored)",
    methods: "tail approximation in sqrt(-2 log y) | central rational approximation",
    point: "p = e^-2 and 1 - e^-2",
    cases: () => [
      pair("qnorm(p)", (p) => qnorm(p), flipPoint((p) => p > 0.13533528323661269189, 0.13, 0.14)),
      pair("qnorm(p)", (p) => qnorm(p), flipPoint((p) => p > 1 - 0.13533528323661269189, 0.86, 0.87)),
    ],
  },
  {
    where: "special/ndtri.ts:49",
    fns: "qnorm, qlnorm",
    condition: "z = sqrt(-2 log y) < 8",
    methods: "P2/Q2 | P1/Q1",
    point: "p = e^-32 (linear) and log p = -32",
    cases: () => [
      pair("qnorm(p)", (p) => qnorm(p), flipPoint((p) => Math.sqrt(-2 * Math.log(p)) < 8, 1e-14, 1e-13)),
      pair("qnorm(lp, log)", (lp) => qnorm(lp, { logP: true }), flipPoint((y) => Math.sqrt(-2 * y) < 8, -33, -31)),
    ],
  },
  {
    where: "special/ndtri.ts:77, :82",
    fns: "qnorm (log), qlnorm, qt start",
    condition: "log p < -2; log p > log1p(-e^-2)",
    methods: "ndtri(exp(lp)) | tail approximation in sqrt(-2 lp) | -ndtri(-expm1(lp))",
    point: "log p = -2 and -0.14541345786885906",
    cases: () => [
      pair("qnorm(lp, log)", (lp) => qnorm(lp, { logP: true }), down(-2)),
      pair("qnorm(lp, log)", (lp) => qnorm(lp, { logP: true }), up(-0.14541345786885906)),
    ],
  },
  {
    where: "special/log1pmx.ts:9",
    fns: "log1pmx (Temme's expansion of pgamma reaches only |x| < 0.32)",
    condition: "|x| < 0.5",
    methods: "log1p(x) - x | series",
    point: "x = ±0.5",
    cases: () => [pair("log1pmx(x)", (x) => log1pmx(x), up(0.5)), pair("log1pmx(x)", (x) => log1pmx(x), down(-0.5))],
  },
  {
    where: "special/psigamma.ts:270",
    fns: "digamma (and the rounding corrections of pchisq/pbeta with ncp)",
    condition: "|x - x0| < 0.3, x0 = -0.504083 (the negative root)",
    methods: "reflection and recurrence | series around the root",
    point: "x = x0 ± 0.3",
    cases: () => {
      const r = -0.504083008264455409;
      return [
        pair("digamma(x)", (x) => digamma(x), flipPoint((x) => Math.abs(x - r) < 0.3, -0.9, -0.7)),
        pair("digamma(x)", (x) => digamma(x), flipPoint((x) => Math.abs(x - r) < 0.3, -0.3, -0.1)),
      ];
    },
  },
  {
    where: "special/psigamma.ts:71",
    fns: "digamma",
    condition: "x a positive integer <= 10; x < 1; x < 10 (recurrence into [1, 2]); else asymptotic",
    methods: "harmonic sum | recurrence and rational approximation on [1, 2] | asymptotic series",
    point: "x = 1, 2, 10 (integers) and their neighbours",
    cases: () => [1, 2, 10].flatMap((n) => [pair("digamma(x)", (x) => digamma(x), down(n)), pair("digamma(x)", (x) => digamma(x), up(n))]),
  },
  {
    where: "special/psigamma.ts:50",
    fns: "digamma",
    condition: "x < 1e17 in the asymptotic series",
    methods: "log x - 1/(2x) | with the 1/x² series",
    point: "x = 1e17",
    cases: () => [pair("digamma(x)", (x) => digamma(x), down(1e17))],
  },
];

// ---- Location-scale and elementary distributions ----

const ELEMENTARY: Entry[] = [
  {
    where: "distributions/lognormal.ts:55",
    fns: "plnorm",
    condition: "-sqrt(2) < z < sqrt(2) (z = log x in double-double)",
    methods: "erfcx form of the smaller tail | pnorm(z)",
    point: "x = exp(±sqrt(2))",
    cases: () => [
      ...pPairs("plnorm(x)", (x, t) => plnorm(x, t), around(flipPoint((x) => Math.log(x) > -Math.SQRT2, 0.2, 0.3)[0])),
      ...pPairs("plnorm(x)", (x, t) => plnorm(x, t), around(flipPoint((x) => Math.log(x) < Math.SQRT2, 4, 4.2)[0])),
    ],
  },
  {
    where: "distributions/lognormal.ts:48, :38",
    fns: "plnorm, dlnorm (log scale; the values are 0 or 1)",
    condition: "|z| > 1e150 (z² in double); |z| < 1e300 (z in double-double)",
    methods: "double-double | double",
    point: "x = e, meanlog 0, sdlog = 1e-150 and 1e-300",
    cases: () => {
      const z = (x: number) => (sd: number) => Math.abs(Math.log(x) / sd);
      const out: Case[] = [];
      for (const lim of [1e150, 1e300]) {
        const ab = around(flipPoint((sd) => z(Math.E)(sd) > lim, 0.5 / lim, 2 / lim)[0]);
        out.push(...pPairs(`plnorm(e, sdlog) at |z| = ${lim}`, (sd, t) => plnorm(Math.E, { sdlog: sd, ...t }), ab, { tails: TAILS.slice(2) }));
        out.push(pair(`dlnorm(e, sdlog, log) at |z| = ${lim}`, (sd) => dlnorm(Math.E, { sdlog: sd, log: true }), ab));
      }
      return out;
    },
  },
  {
    where: "distributions/lognormal.ts:86, :90",
    fns: "qlnorm",
    condition: "s <= -sqrt(2); s >= sqrt(2) (s the standard normal point on the lower side)",
    methods: "residual from pnorm | from the erfcx form of either tail",
    point: "p = pnorm(±sqrt(2))",
    cases: () =>
      [-1, 1].flatMap((sg) =>
        TAILS.map((t) => {
          const s = (p: number) => (t.lowerTail ? 1 : -1) * qnorm(p, t);
          const p0 = pnorm((t.lowerTail ? sg : -sg) * Math.SQRT2, t);
          const pred = (p: number) => (sg < 0 ? s(p) <= -Math.SQRT2 : s(p) >= Math.SQRT2);
          const span = t.logP ? 0.01 : 1e-3;
          return pair(`qlnorm(p, ${tailName(t)}) at s = ${sg < 0 ? "-" : ""}sqrt(2)`, (p) => qlnorm(p, t), flipPoint(pred, p0 - span, p0 + span));
        }),
      ),
  },
  {
    where: "distributions/cauchy.ts:68, :100",
    fns: "dcauchy, pcauchy",
    condition: "|z| <= 1",
    methods: "forms in y = 1/|z| | forms in z",
    point: "x = ±1",
    cases: () => [
      ...dPairs("dcauchy(x)", (x, log) => dcauchy(x, { log }), up(1)),
      ...pPairs("pcauchy(x)", (x, t) => pcauchy(x, t), up(1)),
      ...pPairs("pcauchy(x)", (x, t) => pcauchy(x, t), down(-1)),
    ],
  },
  {
    where: "distributions/cauchy.ts:112",
    fns: "pcauchy (log)",
    condition: "w = 1/|z| < 1e-150",
    methods: "log(atan(w)/π) | log w - log π",
    point: "x = 1e150",
    cases: () => [pair("pcauchy(x, upper log)", (x) => pcauchy(x, { lowerTail: false, logP: true }), flipPoint((x) => 1 / x < 1e-150, 5e149, 2e150))],
  },
  {
    where: "distributions/cauchy.ts:142",
    fns: "qcauchy",
    condition: "s <= 0.25",
    methods: "-tan(π (1/2 - s)) | -1/tan(π s)",
    point: "p = 0.25 and 0.75",
    cases: () => [
      pair("qcauchy(p)", (p) => qcauchy(p), up(0.25)),
      pair("qcauchy(p)", (p) => qcauchy(p), down(0.75)),
      pair("qcauchy(lp, log)", (lp) => qcauchy(lp, { logP: true }), flipPoint((lp) => Math.exp(lp) <= 0.25, -1.5, -1.3)),
    ],
  },
  {
    where: "distributions/cauchy.ts:155, :159",
    fns: "qcauchy",
    condition: "p < 1e-200; log p < -460",
    methods: "tan forms | scale / (π p) (tan(πp) = πp to (πp)²/3)",
    point: "p = 1e-200 and log p = -460",
    cases: () => [
      pair("qcauchy(p)", (p) => qcauchy(p), down(1e-200)),
      pair("qcauchy(p, upper)", (p) => qcauchy(p, { lowerTail: false }), down(1e-200)),
      pair("qcauchy(lp, log)", (lp) => qcauchy(lp, { logP: true }), down(-460)),
    ],
  },
  {
    where: "distributions/cauchy.ts:49",
    fns: "dcauchy, pcauchy",
    condition: "x - location overflows (both finite)",
    methods: "x - location | from the halves x/2 - location/2",
    point: "q where q + 1e308 overflows at location -1e308, scale 1e300",
    cases: () => {
      const o = { location: -1e308, scale: 1e300 };
      const ab = flipPoint((q) => !Number.isFinite(q + 1e308), 7e307, 8e307);
      return [...pPairs("pcauchy(q, -1e308, 1e300)", (q, t) => pcauchy(q, { ...o, ...t }), ab), ...dPairs("dcauchy(x, -1e308, 1e300)", (x, log) => dcauchy(x, { ...o, log }), ab)];
    },
  },
  {
    where: "distributions/logistic.ts:57",
    fns: "qlogis",
    condition: "p < 0.25",
    methods: "log1p((2p - 1)/(1 - p)) | log(p/(1 - p))",
    point: "p = 0.25",
    cases: () => [pair("qlogis(p)", (p) => qlogis(p), down(0.25)), pair("qlogis(p, upper)", (p) => qlogis(p, { lowerTail: false }), down(0.25))],
  },
  {
    where: "distributions/kumaraswamy.ts:34, :44",
    fns: "dkumar, pkumar",
    condition: "x^a < 0.5",
    methods: "-expm1(a log x) | 1 - x^a",
    point: "x = sqrt(0.5) at a = 2, b = 3",
    cases: () => {
      const ab = flipPoint((x) => Math.pow(x, 2) < 0.5, 0.6, 0.8);
      return [...pPairs("pkumar(x, 2, 3)", (x, t) => pkumar(x, 2, 3, t), ab), ...dPairs("dkumar(x, 2, 3)", (x, log) => dkumar(x, 2, 3, { log }), ab)];
    },
  },
  {
    where: "distributions/kumaraswamy.ts:102",
    fns: "dkumar",
    condition: "x^a > 1e-290",
    methods: "x^(a-1) by pow | as x^a / x",
    point: "x = 1e-145 at a = 2, b = 3",
    cases: () => dPairs("dkumar(x, 2, 3)", (x, log) => dkumar(x, 2, 3, { log }), flipPoint((x) => Math.pow(x, 2) > 1e-290, 5e-146, 5e-145)),
  },
  {
    where: "distributions/kumaraswamy.ts:110 (d)",
    fns: "dkumar",
    condition: "DBL_MIN < d < Inf (d the product form)",
    methods: "exp(log density) | product",
    point: "d = DBL_MIN at a = 2, b = 1 (d = 2x)",
    cases: () => [
      pair("dkumar(x, 2, 1)", (x) => dkumar(x, 2, 1), flipPoint((x) => 2 * x > DBL_MIN, DBL_MIN / 4, DBL_MIN), {
        tol: { rel: 1e-12, why: "below DBL_MIN the density is exp of a log near -708, whose rounding (eps |log|) is 8e-14 relative" },
      }),
    ],
  },
  {
    where: "distributions/kumaraswamy.ts:125",
    fns: "pkumar (lower tail, log)",
    condition: "max(b, 1) x^a < 1e-10",
    methods: "log1mExp(b log(1 - x^a)) | log(b) + a log x + log1p(-(b - 1) x^a / 2)",
    point:
      "b x^a = 1e-10 at a = 1, b = 3. Validity: log P = log(-expm1(b log1p(-x^a))) (exact closed form) at x = 1e-21 for " +
      "b x^a from 1e-9 to 1e4 (the expansion was once used there for any b once x^a < 1e-20)",
    cases: () => {
      const ref = (x: number, a: number, b: number) => Math.log(-Math.expm1(b * Math.log1p(-Math.pow(x, a))));
      const check = (bs: number[]) => (): string | undefined => {
        const bad = bs.map((b) => near(pkumar(1e-21, 1, b, { logP: true }), ref(1e-21, 1, b), 1e-13, `log pkumar(1e-21, 1, ${b})`));
        const f = bad.filter((s) => s !== undefined);
        return f.length === 0 ? undefined : f.join("; ");
      };
      return [
        pair("pkumar(x, 1, 3, lower log)", (x) => pkumar(x, 1, 3, { logP: true }), flipPoint((x) => 3 * x < 1e-10, 2e-11, 5e-11)),
        { kind: "check", label: "b x^a <= 1e-9 against the closed form", run: check([1e3, 1e8, 1e12]) },
        { kind: "check", label: "b x^a >= 1e-5 against the closed form", run: check([1e16, 1e19, 1e21, 1e25]) },
      ];
    },
  },
  {
    where: "distributions/triangular.ts:46",
    fns: "dtriang",
    condition: "r < 0.5 (r the fraction from the mode to the end)",
    methods: "distance to the end | 1 - r",
    point: "x = 0.15 and 0.65 at a = 0, b = 1, c = 0.3",
    cases: () => {
      const o = { a: 0, b: 1, c: 0.3 };
      return [
        ...dPairs("dtriang(x)", (x, log) => dtriang(x, { ...o, log }), flipPoint((x) => (0.3 - x) / 0.3 < 0.5, 0.1, 0.2)),
        ...dPairs("dtriang(x)", (x, log) => dtriang(x, { ...o, log }), flipPoint((x) => (x - 0.3) / 0.7 < 0.5, 0.6, 0.7)),
      ];
    },
  },
  {
    where: "distributions/triangular.ts:66, :125",
    fns: "ptriang, qtriang",
    condition: "q <= c; lower <= (c - a)/w",
    methods: "forms from the upper end | from the lower end",
    point: "q = c = 0.3 and p = 0.3 at a = 0, b = 1",
    cases: () => {
      const o = { a: 0, b: 1, c: 0.3 };
      return [
        ...pPairs("ptriang(q)", (q, t) => ptriang(q, { ...o, ...t }), up(0.3)),
        pair("qtriang(p)", (p) => qtriang(p, o), up(0.3)),
        pair("qtriang(p, upper)", (p) => qtriang(p, { ...o, lowerTail: false }), down(0.7)),
      ];
    },
  },
  {
    where: "distributions/arcsine.ts:47, :56",
    fns: "parcsine, qarcsine",
    condition: "q - a <= b - q; qbeta(p, 1/2, 1/2) <= 1/2",
    methods: "from the upper end | from the lower end",
    point: "q = 1.5 at a = 0, b = 3; p = 1/2",
    cases: () => [
      ...pPairs("parcsine(q, 0, 3)", (q, t) => parcsine(q, { a: 0, b: 3, ...t }), flipPoint((q) => q <= 3 - q, 1.4, 1.6)),
      pair("qarcsine(p, 0, 3)", (p) => qarcsine(p, { a: 0, b: 3 }), flipPoint((p) => qbeta(p, 0.5, 0.5) <= 0.5, 0.4, 0.6)),
      ...dPairs("darcsine(x, 0, 3)", (x, log) => darcsine(x, { a: 0, b: 3, log }), up(1.5)),
    ],
  },
];

// ---- distributions/beta.ts, t.ts, f.ts ----

const BETA_T_F: Entry[] = [
  {
    where: "distributions/beta.ts:43, :48",
    fns: "dbeta",
    condition: "linear scale: E < 700, x and 1 - x > 1e-290, v = exp(-E) sqrt(m/2π) within 1e±290",
    methods: "log form | product on the linear scale",
    point: "v = 1e-290 at a = b = 50 (the E < 700 test never decides first); x = 1e-290 at a = 0.5, b = 2",
    cases: () => [
      pair("dbeta(x, 50, 50)", (x) => dbeta(x, 50, 50), around(flipPoint((x) => betaPrefactor(x, 50, 50) > 1e-290, 1e-15, 0.4)[0], 8)),
      pair("dbeta(x, 0.5, 2)", (x) => dbeta(x, 0.5, 2), up(1e-290)),
    ],
  },
  {
    where: "distributions/beta.ts:55, :57",
    fns: "dbeta (log, and linear where the product form is not used)",
    condition: "x and 1 - x > 1e-290; 1e-290 < m < 1e290",
    methods: "log x + log(1 - x), separate logs of a, b, a + b | log of the products",
    point: "x = 1e-290 at a = 0.5, b = 2; m = 1e-290 at b = 2; a b overflowing (m = Inf) at a = b = 1.3e154",
    cases: () => [
      pair("dbeta(x, 0.5, 2, log)", (x) => dbeta(x, 0.5, 2, { log: true }), up(1e-290)),
      pair("dbeta(0.5, a, 2, log)", (a) => dbeta(0.5, a, 2, { log: true }), flipPoint((a) => (a * 2) / (a + 2) > 1e-290, 5e-291, 5e-290)),
      ...dPairs("dbeta(0.5, a, a)", (a, log) => dbeta(0.5, a, a, { log }), flipPoint((a) => (a * a) / (a + a) < 1e290, 1e154, 2e154)),
    ],
  },
  {
    where: "distributions/beta.ts:117",
    fns: "dbeta (log)",
    condition: "a == 1 or b == 1",
    methods: "Loader's form | elementary log(b) + (b - 1) log(1 - x)",
    point: "a = 1 at b = 3, x = 0.3",
    cases: () => [pair("dbeta(0.3, a, 3, log)", (a) => dbeta(0.3, a, 3, { log: true }), down(1)), pair("dbeta(0.3, a, 3, log)", (a) => dbeta(0.3, a, 3, { log: true }), up(1))],
  },
  {
    where: "distributions/beta.ts:170",
    fns: "qbeta",
    condition: "coefficient of variation sqrt(b / (a (a + b + 1))) < 1e-15 (and the target bracketed in m (1 ± 1e-13))",
    methods: "Newton's method in log x | bisection of the doubles around the mean m",
    point:
      "a = 1e30 at b = 1e36 and a = b = 5e29 (the boundary), checked as the validity of both sides: the target lies " +
      "between the distribution function at x (1 ∓ 1e-14) (at least 4 ulps), as in the round trip of " +
      "test/helpers/properties.ts; beyond the boundary, the target lies between its values 2 ulps either side of x",
    cases: () => [
      {
        kind: "check",
        label: "qbeta at the step of the distribution function",
        run: () => {
          const bad: string[] = [];
          const sets: [number, number, boolean][] = [
            [0.99e30, 1e36, false],
            [1.01e30, 1e36, false],
            [4.9e29, 4.9e29, false],
            [5.1e29, 5.1e29, false],
            [1.3e32, 1.3e32, true],
            [1e40, 1e60, true],
            [1.6931854251429734e160, 1.6168490723157686e175, true],
          ];
          for (const [a, b, exact] of sets) {
            for (const lowerTail of [true, false]) {
              for (const p of [0.3, 1e-15]) {
                const x = qbeta(p, a, b, { lowerTail });
                const at = (v: number) => pbeta(v, a, b, { lowerTail });
                // (2 ulps either side at the step: in the right half x = 1 - y rounds y's last bit)
                const [l, h] = exact
                  ? [ulpsFrom(x, -2), ulpsFrom(x, 2)]
                  : [Math.min(x * (1 - 1e-14), ulpsFrom(x, -4)), Math.max(x * (1 + 1e-14), ulpsFrom(x, 4))];
                const [pl, ph] = [at(l), at(h)];
                const ok = Math.min(pl, ph) <= p * (1 + 1e-12) && p <= Math.max(pl, ph) * (1 + 1e-12);
                if (!ok) bad.push(`qbeta(${p}, ${a}, ${b}, ${lowerTail ? "lower" : "upper"}) = ${fmt(x)}: p there ${fmt(pl)}, ${fmt(ph)}`);
              }
            }
          }
          return bad.length === 0 ? undefined : bad.join("; ");
        },
      },
    ],
  },
  {
    where: "distributions/beta.ts:211",
    fns: "qbeta",
    condition: "tail guess x^a / (a B(a, b)) < 1e-3",
    methods: "A&S 26.5.22 start | tail start",
    point: "the guess = 1e-3 at a = 2, b = 3 (lower tail)",
    cases: () => {
      const guess = (lt: number) => Math.exp(Math.max((lt + Math.log(2) + lbeta(2, 3)) / 2, -745)) < 1e-3;
      return [
        pair("qbeta(p, 2, 3)", (p) => qbeta(p, 2, 3), flipPoint((p) => guess(Math.log(p)), 1e-7, 1e-4)),
        pair("qbeta(lp, 2, 3, log)", (lp) => qbeta(lp, 2, 3, { logP: true }), flipPoint(guess, -16, -9)),
      ];
    },
  },
  {
    where: "distributions/beta.ts:260",
    fns: "qbeta, qarcsine",
    condition: "target vs the distribution function at 1/2",
    methods: "1 - (lower quantile of Beta(b, a)) | lower quantile",
    point: "p = pbeta(1/2, 3, 2) = 0.3125",
    cases: () => {
      const half = pbeta(0.5, 3, 2, { logP: true });
      return [
        pair("qbeta(p, 3, 2)", (p) => qbeta(p, 3, 2), flipPoint((p) => Math.log(p) <= half, 0.3, 0.33)),
        pair("qbeta(lp, 3, 2, log)", (lp) => qbeta(lp, 3, 2, { logP: true }), up(half)),
      ];
    },
  },
  {
    where: "distributions/t.ts:36",
    fns: "dt",
    condition: "x²/n >= 1e30",
    methods: "Loader's form | log(x²/n) + log1p(n/x²) in double-double",
    point: "x = 1e15 at n = 1",
    cases: () => dPairs("dt(x, 1)", (x, log) => dt(x, 1, { log }), flipPoint((x) => x * x < 1e30, 5e14, 2e15)),
  },
  {
    where: "distributions/t.ts:48",
    fns: "dt, qt (density in Newton steps)",
    condition: "x² > 0.2 n",
    methods: "bd0(n/2, (n + x²)/2) - x²/2 | -n/2 log1p(x²/n)",
    point: "x = sqrt(2) at n = 10",
    cases: () => dPairs("dt(x, 10)", (x, log) => dt(x, 10, { log }), flipPoint((x) => x * x > 2, 1.3, 1.5)),
  },
  {
    where: "distributions/t.ts:144, :162",
    fns: "pt, qt",
    condition: "n/(n + t²) <= 1e-250",
    methods: "incomplete beta | first series term in logs",
    point: "t = 1.41e125 at n = 2",
    cases: () => pPairs("pt(t, 2)", (v, t) => pt(v, 2, t), flipPoint((v) => 2 / (2 + v * v) > 1e-250, 1e125, 2e125)),
  },
  {
    where: "distributions/t.ts:223",
    fns: "qt",
    condition: "log p < -30 and t0^2 > e n (start value; the power law t0 only in its region t^2 >> n)",
    methods: "Cornish-Fisher | power law t0 = (n^(n/2) / (n B(n/2, 1/2) p))^(1/n)",
    point:
      "log p = -30 at n = 5 and n = 1e6 (where the power-law start would be about sqrt(n) = 1000 while the answer is 7.8); " +
      "t0^2 = e n at n = 1000 (log p near -504). Validity: pt(qt(p)) = p at n = 1e6 for log p from -31 to -700",
    cases: () => {
      const out: Case[] = [];
      // log t0 for n = 1000 (mirror of t.ts)
      const lx0 = (lp: number) => (500 * Math.log(1000) - Math.log(1000) - lbeta(500, 0.5) - lp) / 1000;
      const ab = flipPoint((lp) => 2 * lx0(lp) > Math.log(1000) + 1, -520, -490);
      out.push(pair("qt(lp, 1000, lower log)", (lp) => qt(lp, 1000, { logP: true }), ab));
      out.push(pair("qt(lp, 1000, upper log)", (lp) => qt(lp, 1000, { lowerTail: false, logP: true }), ab));
      for (const n of [5, 1e6]) {
        for (const lowerTail of [true, false]) {
          out.push(pair(`qt(lp, ${n}, ${lowerTail ? "lower" : "upper"} log)`, (lp) => qt(lp, n, { lowerTail, logP: true }), down(-30)));
          out.push(pair(`qt(p, ${n}, ${lowerTail ? "lower" : "upper"})`, (p) => qt(p, n, { lowerTail }), flipPoint((p) => Math.log(p) < -30, 9e-14, 1e-13)));
        }
      }
      out.push({
        kind: "check",
        label: "pt(qt(p, 1e6), 1e6) = p in the deep upper tail",
        run: () => {
          for (const lp of [-31, -100, -700]) {
            const t = qt(lp, 1e6, { lowerTail: false, logP: true });
            const r = near(pt(t, 1e6, { lowerTail: false, logP: true }), lp, 1e-14, `log pt(qt(${lp}))`);
            if (r !== undefined) return r;
          }
          return undefined;
        },
      });
      return out;
    },
  },
  {
    where: "distributions/f.ts:57",
    fns: "df, pf, qf",
    condition: "|m x| < 1e290",
    methods: "1 - z = n/(m x) in double | z, 1 - z as double-double quotients",
    point: "x = 1e290 at m = 1, n = 5",
    cases: () => {
      const ab = flipPoint((x) => x < 1e290, 5e289, 2e290);
      return [...pPairs("pf(x, 1, 5)", (x, t) => pf(x, 1, 5, t), ab), ...dPairs("df(x, 1, 5)", (x, log) => df(x, 1, 5, { log }), ab)];
    },
  },
  {
    where: "distributions/f.ts:91",
    fns: "df, qf (density in Newton steps)",
    condition: "m >= 2",
    methods: "dbinom(m/2; (m+n)/2) form | dbinom((m-2)/2; (m+n-2)/2) form",
    point: "m = 2 at x = 0.7, n = 5",
    cases: () => dPairs("df(0.7, m, 5)", (m, log) => df(0.7, m, 5, { log }), down(2)),
  },
  {
    where: "distributions/f.ts:59",
    fns: "df, pf, qf",
    condition: "x > 0, m x < 1e-290 && n < 1e127",
    methods: "m x and n as they are | both scaled by 2^600",
    point: "3 x = 1e-290 at m = 3, n = 1e-288",
    cases: () => {
      const ab = flipPoint((x) => 3 * x < 1e-290, 3e-291, 4e-291);
      return [...pPairs("pf(x, 3, 1e-288)", (x, t) => pf(x, 3, 1e-288, t), ab), ...dPairs("df(x, 3, 1e-288)", (x, log) => df(x, 3, 1e-288, { log }), ab)];
    },
  },
  {
    where: "distributions/f.ts:73, :74, :134, :135",
    fns: "df, pf, qf",
    condition: "m x/n < DBL_MIN or n/(m x) < DBL_MIN (in logs)",
    methods: "the ratios m x/(n + m x), n/(n + m x) | the incomplete beta function (betaIncTinyX) and the density from the log of the tiny ratio",
    point: "3 x/5 = DBL_MIN and 5/(3 x) = DBL_MIN at m = 3, n = 5",
    cases: () => {
      const lo = around(flipPoint((x) => Math.log((3 * x) / 5) < Math.log(DBL_MIN), 3e-308, 5e-308)[0], 8);
      const hi = around(flipPoint((x) => Math.log(x * (3 / 5)) > -Math.log(DBL_MIN), 6e307, 9e307)[0], 8);
      return [
        ...pPairs("pf(x, 3, 5)", (x, t) => pf(x, 3, 5, t), lo),
        ...dPairs("df(x, 3, 5)", (x, log) => df(x, 3, 5, { log }), lo),
        ...pPairs("pf(x, 3, 5)", (x, t) => pf(x, 3, 5, t), hi),
        ...dPairs("df(x, 3, 5)", (x, log) => df(x, 3, 5, { log }), hi),
      ];
    },
  },
  {
    where: "distributions/f.ts:231, :239, :240",
    fns: "qf",
    condition:
      "upper tail whose leading term overflows, confirmed by pf at the largest double; lower tail and n < 1 with pf(largest " +
      "double) below the target; upper tail and m < 1 with the upper tail at the smallest positive number below it",
    methods: "Newton's method | Infinity; 0",
    point:
      "the target at the upper tail of pf(Number.MAX_VALUE, 2875.5, 1), at pf(Number.MAX_VALUE, 0.754, 4.56e-152), and at " +
      "the upper tail of pf(5e-324, 1e-200, 3)",
    cases: () => [
      {
        kind: "check",
        label: "qf on either side of the distribution function at the ends of the doubles",
        run: () => {
          const bad: string[] = [];
          const far = pf(Number.MAX_VALUE, 2875.5, 1, { lowerTail: false });
          if (qf(far * 0.99, 2875.5, 1, { lowerTail: false }) !== Infinity) bad.push("qf (upper) below pf(largest double) is not Infinity");
          const z = qf(far * 1.01, 2875.5, 1, { lowerTail: false });
          if (!(z < Infinity && pf(z, 2875.5, 1, { lowerTail: false }) <= far * 1.01 * (1 + 1e-12))) bad.push(`qf (upper) above pf(largest double) is ${fmt(z)}`);
          const top = pf(Number.MAX_VALUE, 0.754, 4.56e-152);
          if (qf(top * 1.01, 0.754, 4.56e-152) !== Infinity) bad.push("qf above pf(largest double) is not Infinity");
          const x = qf(top * 0.99, 0.754, 4.56e-152);
          if (!(x < Infinity && pf(x, 0.754, 4.56e-152) >= top * 0.99)) bad.push(`qf below pf(largest double) is ${fmt(x)}`);
          const bottom = pf(Number.MIN_VALUE, 1e-200, 3, { lowerTail: false });
          if (qf(bottom * 1.01, 1e-200, 3, { lowerTail: false }) !== 0) bad.push("qf (upper) above the upper tail at 5e-324 is not 0");
          // (y is subnormal, with a few significant bits: bracket the target 1% either side)
          const y = qf(bottom * 0.99, 1e-200, 3, { lowerTail: false });
          const up = (v: number) => pf(v, 1e-200, 3, { lowerTail: false });
          if (!(y > 0 && up(y * 1.01) <= bottom * 0.99 && bottom * 0.99 <= up(y * 0.99))) bad.push(`qf (upper) below the upper tail at 5e-324 is ${fmt(y)}`);
          return bad.length === 0 ? undefined : bad.join("; ");
        },
      },
    ],
  },
];

// ---- distributions/nbeta.ts: noncentral beta and F; internal/poissonMixture.ts ----

const pbn = (a: number, b: number, ncp: number) => (x: number, t: Tail) => pbeta(x, a, b, { ncp, ...t });

/** Start of the lower sum in poissonMixture.ts (mirror, to place mu where it passes LONG_WALK) */
function upperStart(mu: number): number {
  let j = Math.floor(mu);
  let r = 1;
  for (;;) {
    r *= mu / (j + 1);
    if (r / (1 - mu / (j + 2)) < 3e-21) return j;
    j++;
  }
}

const NBETA: Entry[] = [
  {
    where: "distributions/nbeta.ts:39",
    fns: "pbeta, dbeta, qbeta with ncp",
    condition: "x min(1, a + b) < 2^-830 (about 1.4e-250)",
    methods: "term ratio as is | scaled by 2^(500 K)",
    point:
      "x = 2^-830 at a = 2, b = 3, ncp = 5 (log scale; the values underflow), and where x (a + b) passes 2^-830 at " +
      "a = 1e-210, b = 1e-200, ncp = 5 (x about 1.4e-50)",
    cases: () => {
      const x0 = 2 ** -830;
      const ab = flipPoint((x) => Math.log2(x) + Math.log2(1e-210 + 1e-200) < -830, 1e-50, 2e-50);
      return [
        ...pPairs("pbeta(x, 2, 3, ncp 5)", pbn(2, 3, 5), down(x0), { tails: TAILS.slice(2) }),
        pair("dbeta(x, 2, 3, ncp 5, log)", (x) => dbeta(x, 2, 3, { ncp: 5, log: true }), down(x0)),
        ...pPairs("pbeta(x, 1e-210, 1e-200, ncp 5)", pbn(1e-210, 1e-200, 5), ab),
        ...dPairs("dbeta(x, 1e-210, 1e-200, ncp 5)", (x, log) => dbeta(x, 1e-210, 1e-200, { ncp: 5, log }), ab),
      ];
    },
  },
  {
    where: "distributions/nbeta.ts:101",
    fns: "pbeta, dbeta, pf, df with ncp",
    condition: "s < 1 and b < 1 (log of the increment where the binomial-probability helpers do not apply)",
    methods: "-log B(s, b) - log s | log Γ(1 + s) + log Γ(1 + b) - log Γ(1 + s + b) + log(1 + s/b)",
    point: "b = 1 at a = 1e-12 (the shape s = a + j is below 1e-10 at j = 0), x = 0.3, ncp = 1",
    cases: () => {
      const ab = flipPoint((b) => b < 1, 0.99, 1.01);
      return [
        ...pPairs("pbeta(0.3, 1e-12, b, ncp 1)", (b, t) => pbeta(0.3, 1e-12, b, { ncp: 1, ...t }), ab),
        ...dPairs("dbeta(0.3, 1e-12, b, ncp 1)", (b, log) => dbeta(0.3, 1e-12, b, { ncp: 1, log }), ab),
      ];
    },
  },
  {
    where: "distributions/nbeta.ts:47, :65, :77",
    fns: "pbeta, dbeta, qbeta with ncp",
    condition: "x and 1 - x > 1e-305, shapes s = a + j and b > 1e-10 (log of the increment)",
    methods: "-log B(s, b) - log s + s log x + b log(1 - x) | Loader's form",
    point: "x = 1e-305 at a = 0.5, b = 3, ncp = 5 (log scale); b = 1e-10 at x = 0.5, a = 2, ncp = 5",
    cases: () => {
      const ab = flipPoint((b) => b > 1e-10, 5e-11, 2e-10);
      return [
        ...pPairs("pbeta(x, 0.5, 3, ncp 5)", pbn(0.5, 3, 5), up(1e-305), { tails: TAILS.slice(2) }),
        pair("dbeta(x, 0.5, 3, ncp 5, log)", (x) => dbeta(x, 0.5, 3, { ncp: 5, log: true }), up(1e-305)),
        ...pPairs("pbeta(0.5, 2, b, ncp 5)", (b, t) => pbeta(0.5, 2, b, { ncp: 5, ...t }), ab),
        ...dPairs("dbeta(0.5, 2, b, ncp 5)", (b, log) => dbeta(0.5, 2, b, { ncp: 5, log }), ab),
      ];
    },
  },
  {
    where: "internal/poissonMixture.ts:367; distributions/nbeta.ts:132; distributions/nchisq.ts:119",
    fns: "pbeta, pf, pchisq with ncp",
    condition: "the tail guessed to be the smaller (below the mean) has a sum above 1/2",
    methods: "the requested tail summed | 1 - (the other tail)",
    point: "the medians of pbeta(x, 2, 3, ncp 5) and pchisq(x, 3, ncp 10), and the guesses' switch at the means",
    cases: () => {
      const mb = flipPoint((x) => (pbeta(x, 2, 3, { ncp: 5 }) as number) > 0.5, 0.3, 0.7);
      const mc = flipPoint((x) => (pchisq(x, 3, { ncp: 10 }) as number) > 0.5, 8, 16);
      return [
        ...pPairs("pbeta(x, 2, 3, ncp 5)", pbn(2, 3, 5), mb),
        ...pPairs("pbeta(x, 2, 3, ncp 5)", pbn(2, 3, 5), down(4.5 / 7.5)),
        ...pPairs("pchisq(x, 3, ncp 10)", (x, t) => pchisq(x, 3, { ncp: 10, ...t }), mc),
        ...pPairs("pchisq(x, 3, ncp 10)", (x, t) => pchisq(x, 3, { ncp: 10, ...t }), down(13)),
      ];
    },
  },
  {
    where: "distributions/nbeta.ts:148, :149, :157",
    fns: "pbeta, pf with ncp (methods for extreme parameters)",
    condition:
      "far left tail at a large λ: r = (λ/2) x max(1, (a + b)/(a + 1)) <= 100 (the sum with e^(-λ/2) taken out); " +
      "x max(...) <= 1e-16 (its first term)",
    methods: "integral | -λ/2 + log Σ (λ/2)^j/j! I_x(a + j, b) | -λ/2 + log I_x(a, b)",
    point: "r = 100 at a = 3, b = 5, ncp = 2e7 (x = 5e-6); x max(...) = 1e-16 at a = 3, b = 5, ncp = 1e30 (log scale)",
    cases: () => {
      const r100 = flipPoint((x) => 1e7 * x * 2 <= 100, 4e-6, 6e-6);
      const first = flipPoint((x) => x * 2 <= 1e-16, 4e-17, 6e-17);
      return [
        pair("pbeta(x, 3, 5, ncp 2e7, lower log)", (x) => pbeta(x, 3, 5, { ncp: 2e7, logP: true }), r100),
        pair("pbeta(x, 3, 5, ncp 1e30, lower log)", (x) => pbeta(x, 3, 5, { ncp: 1e30, logP: true }), first),
      ];
    },
  },
  {
    where: "distributions/nbeta.ts:345, :348",
    fns: "pbeta, pf with ncp (methods for extreme parameters)",
    condition: "λ/2 > 1e18 and (λ/2)(1 - x) >= 1e17 (a + b + 1) (log(λ/2) + 50)",
    methods: "the methods for extreme parameters | log P = -(λ/2)(1 - x), the rest below its rounding",
    point: "ncp where the second condition flips at a = 2, b = 3, x = 0.5 (about 2.2e20; log scale)",
    cases: () => {
      const ab = flipPoint((l) => (l / 2) * 0.5 >= 1e17 * 6 * (Math.log(l / 2) + 50), 1e20, 5e20);
      return [pair("pbeta(0.5, 2, 3, ncp, lower log)", (l) => pbeta(0.5, 2, 3, { ncp: l, logP: true }), ab)];
    },
  },
  {
    where: "distributions/nbeta.ts:401, :411, :413, :417",
    fns: "pbeta, pf with ncp (gamma expansion)",
    condition:
      "log scale: (v/2) L'^2 <= 1e-16 |log G| (log G alone); far in the tail of G, κ3 |L'|³/6 <= 1e-16 |log G| (log G " +
      "plus (v/2)(L'² + L'')); beyond 40 sqrt(b) + 750 from b with a relative spread of T times |t0 - b| above 1e-4, " +
      "the linear value from the log",
    methods: "the cumulant expansion | log G(b, t0) | log G(b, t0) + (v/2)(L'² + L'') | the integral",
    point:
      "a sweep of log pf(q, 1, 4.33, ncp 2.58e31) against log q through k = n/(m q) = 1e-16 (q = 4.33e16), where the " +
      "first condition flips (log P = -t0 = -1.3e15 there)",
    cases: () => {
      const xs = grid(Math.log(4.332294895430028e16) - 20 * 1e-4, 1e-4, 41);
      return [{ kind: "sweep", label: "log pf(q, 1, 4.33, ncp 2.58e31) against log q", f: (lq: number) => pf(Math.exp(lq), 1, 4.332294895430028, { ncp: 2.5806231220467997e31, logP: true }), xs }];
    },
  },
  {
    where: "distributions/nbeta.ts:308, :296",
    fns: "pbeta, dbeta, pf, df with ncp (methods for extreme parameters)",
    skip:
      "the distribution function of W: the smaller of P(b, t) and Q(b, t) (P below 1/2) taken from gammaInc and the other " +
      "as 1 - (it), both to the rounding on either side; below t = 1e-300 the first term of the series",
    condition: "P(b, t) <= 1/2; t < 1e-300",
    methods: "-",
    point: "-",
  },
  {
    where: "distributions/nbeta.ts:231 (λ/2 > 1e6)",
    fns: "pbeta, dbeta, qbeta, pf, df, qf with ncp",
    condition: "λ/2 > 1e6",
    methods: "Poisson mixture | integral over log y of f_Y(y) P[W >< y k] (integralLog)",
    point: "ncp = 2e6 at a = 3.5, b = 0.7, x = 1 - 2e-6 (near the mean)",
    cases: () => {
      const ab = flipPoint((l) => l / 2 > 1e6, 1.9e6, 2.1e6);
      return [...pPairs("pbeta(1 - 2e-6, 3.5, 0.7, ncp)", (l, t) => pbeta(1 - 2e-6, 3.5, 0.7, { ncp: l, ...t }), ab), ...dPairs("dbeta(1 - 2e-6, 3.5, 0.7, ncp)", (l, log) => dbeta(1 - 2e-6, 3.5, 0.7, { ncp: l, log }), ab)];
    },
  },
  {
    where: "distributions/nbeta.ts:231 (b > 1e15)",
    fns: "pbeta, dbeta, qbeta, pf, df, qf with ncp",
    condition: "a or b > 1e15 (the central incomplete beta function does not return for some such shapes)",
    methods: "Poisson mixture | integral over log y",
    point: "b = 1e15 at a = 2, ncp = 5, x = 4.5e-15 (b x near the mean of Y/2)",
    cases: () => {
      const ab = flipPoint((b) => b > 1e15, 0.9e15, 1.1e15);
      return [...pPairs("pbeta(4.5e-15, 2, b, ncp 5)", (b, t) => pbeta(4.5e-15, 2, b, { ncp: 5, ...t }), ab), ...dPairs("dbeta(4.5e-15, 2, b, ncp 5)", (b, log) => dbeta(4.5e-15, 2, b, { ncp: 5, log }), ab)];
    },
  },
  {
    where: "distributions/nbeta.ts:226",
    fns: "pbeta, dbeta, qbeta, pf, df, qf with ncp",
    condition: "b > 1e20 s², s = a + λ/2 + 10 sqrt(λ/2) + 10",
    methods: "integral over log y | P[Y <= -2b log(1 - x)] (the components' gamma limit)",
    point: "b at the condition for a = 2, ncp = 5 (about 9.2e22), x = 4.5 / b",
    cases: () => {
      const s = 2 + 2.5 + 10 * Math.sqrt(2.5) + 10;
      const ab = flipPoint((b) => b > 1e20 * s * s, 1e20 * s * s * 0.9, 1e20 * s * s * 1.1);
      const x = 4.5 / ab[0];
      return [...pPairs(`pbeta(${x}, 2, b, ncp 5)`, (b, t) => pbeta(x, 2, b, { ncp: 5, ...t }), ab), ...dPairs(`dbeta(${x}, 2, b, ncp 5)`, (b, log) => dbeta(x, 2, b, { ncp: 5, log }), ab)];
    },
  },
  {
    where: "distributions/nbeta.ts:227",
    fns: "pbeta, dbeta, qbeta, pf, df, qf with ncp",
    condition: "2 sqrt(a + λ) (40 sqrt(b) + 750) < 1e-4 (2a + λ)",
    methods: "integral over log y | expansion of E P(b, Y k/2) about the mean of Y (gammaExpansion)",
    point: "ncp at the condition for a = 2, b = 3 (about 2.7e14), x = 1 - 6/ncp (near the mean)",
    cases: () => {
      const cond = (l: number) => 2 * Math.sqrt(2 + l) * (40 * Math.sqrt(3) + 750) < 1e-4 * (4 + l);
      const ab = flipPoint(cond, 1e14, 1e15);
      const x = 1 - 6 / ab[0];
      return [...pPairs(`pbeta(${x}, 2, 3, ncp)`, (l, t) => pbeta(x, 2, 3, { ncp: l, ...t }), ab), ...dPairs(`dbeta(${x}, 2, 3, ncp)`, (l, log) => dbeta(x, 2, 3, { ncp: l, log }), ab)];
    },
  },
  {
    where: "distributions/nbeta.ts:228",
    fns: "pbeta, dbeta, qbeta, pf, df, qf with ncp",
    condition: "40 (2a + λ)/(2 sqrt(a + λ)) + 750 < 1e-5 sqrt(b)",
    methods: "integral over log y | expansion of E F_Y(W/k) about the mean of W (wExpansion)",
    point: "b at the condition for a = 2, ncp = 5 (about 6.7e15), x = 9/(2b) (near the mean)",
    cases: () => {
      const cond = (b: number) => (40 * 9) / (2 * Math.sqrt(7)) + 750 < 1e-5 * Math.sqrt(b);
      const ab = flipPoint(cond, 1e15, 1e17);
      const x = 9 / (2 * ab[0]);
      return [...pPairs(`pbeta(${x}, 2, b, ncp 5)`, (b, t) => pbeta(x, 2, b, { ncp: 5, ...t }), ab), ...dPairs(`dbeta(${x}, 2, b, ncp 5)`, (b, log) => dbeta(x, 2, b, { ncp: 5, log }), ab)];
    },
  },
  {
    where: "distributions/nbeta.ts:303",
    fns: "pbeta, pf with ncp (integral, gamma expansion)",
    condition: "b > 1e10 (the distribution function of W)",
    methods: "gammaInc | the central χ² by the uniform expansion (gammaTailHuge)",
    point: "b = 1e10 at a = 2, ncp = 1e8 (integral), x = 4.975e-3 (near the mean)",
    cases: () => pPairs("pbeta(4.975e-3, 2, b, ncp 1e8)", (b, t) => pbeta(4.975e-3, 2, b, { ncp: 1e8, ...t }), flipPoint((b) => b > 1e10, 0.9e10, 1.1e10)),
  },
  {
    where: "distributions/nbeta.ts:280",
    fns: "dbeta, df with ncp (integral, gamma expansion)",
    condition: "b > 1e10 (the density of W)",
    methods: "dgamma1 | Stirling's series in log form",
    point: "b = 1e10 at a = 2, ncp = 1e8 (integral), x = 4.975e-3 (near the mean)",
    cases: () => dPairs("dbeta(4.975e-3, 2, b, ncp 1e8)", (b, log) => dbeta(4.975e-3, 2, b, { ncp: 1e8, log }), flipPoint((b) => b > 1e10, 0.9e10, 1.1e10)),
  },
  {
    where: "distributions/nbeta.ts:284, :285, :296",
    fns: "pbeta, dbeta, pf, df with ncp (integral, gamma expansion)",
    skip:
      "the density and the distribution function of W for a tiny b, at t beyond 1e300 b or below 1e-300: closed forms " +
      "of the same quantity where the general functions break down (tiny shapes are also out of the central functions' " +
      "range, see the nbeta entry of test/helpers/distributionKnown.ts)",
    condition: "b < 1e-10; t > 1e300 b, b > 1e300 t; t < 1e-300",
    methods: "-",
    point: "-",
  },
  {
    where: "distributions/nbeta.ts:514, :551",
    fns: "pbeta, dbeta, pf, df with ncp (integral)",
    skip:
      "stopping rules of the integral: the log of the mode alone where its rounding exceeds the log of any integral of " +
      "exp(L - L(mode)); the rest of the downward integral bounded by the power law where leftSlope <= 1/2",
    condition: "|L(mode)| > 1e18; leftSlope > 1/2",
    methods: "-",
    point: "-",
  },
  {
    where: "distributions/nbeta.ts:667, :868",
    fns: "qbeta, qf with ncp",
    skip: "as distributions/nchisq.ts:658 (the quantile of a spread below 1e-10, by a search over the doubles)",
    condition: "relative spread of Y and W < 1e-10",
    methods: "-",
    point: "-",
  },
  {
    where: "distributions/nbeta.ts:691",
    fns: "pf, df with ncp",
    condition: "m q < 1e-290 (x = r/(1 + r) with r = (m/n) q)",
    methods: "x = m q/(n + m q) | x = r/(1 + r)",
    point: "q where m q = 1e-290 at m = 1e-250, n = 1e-200, ncp = 1 (r = 1e-40 there)",
    cases: () => {
      const ab = flipPoint((q) => 1e-250 * q < 1e-290, 5e-41, 2e-40);
      return [
        ...pPairs("pf(q, 1e-250, 1e-200, ncp 1)", (q, t) => pf(q, 1e-250, 1e-200, { ncp: 1, ...t }), ab),
        ...dPairs("df(q, 1e-250, 1e-200, ncp 1)", (q, log) => df(q, 1e-250, 1e-200, { ncp: 1, log }), ab),
      ];
    },
  },
  {
    where: "distributions/nbeta.ts:715, :737, :776",
    fns: "pf, df with ncp",
    condition: "(m/n) q < 1e-306",
    methods: "mixture | first term exp(-λ/2) (mq/n)^a / (a B(a, b))",
    point: "q = 2e-306 at m = 2, n = 4, ncp = 3",
    cases: () => {
      const ab = flipPoint((q) => (2 / 4) * q < 1e-306, 1e-306, 3e-306);
      return [...pPairs("pf(q, 2, 4, ncp 3)", (q, t) => pf(q, 2, 4, { ncp: 3, ...t }), ab), ...dPairs("df(q, 2, 4, ncp 3)", (q, log) => df(q, 2, 4, { ncp: 3, log }), ab)];
    },
  },
  {
    where: "distributions/nbeta.ts:697, :708",
    fns: "pf, df, qf with ncp",
    condition: "|m q| < 1e290; k = n/(m q) below 1e-300 (its log from those of n, m and q)",
    methods: "1 - x = n/(m q) in double | x, 1 - x as double-double quotients",
    point: "q = 1e290 at m = 1, n = 5, ncp = 2",
    cases: () => {
      const ab = flipPoint((q) => q < 1e290, 5e289, 2e290);
      return [...pPairs("pf(q, 1, 5, ncp 2)", (q, t) => pf(q, 1, 5, { ncp: 2, ...t }), ab), ...dPairs("df(q, 1, 5, ncp 2)", (q, log) => df(q, 1, 5, { ncp: 2, log }), ab)];
    },
  },
  {
    where: "internal/poissonMixture.ts:415",
    fns: "pchisq, pbeta, pf with ncp",
    condition: "start index J > 3000 (LONG_WALK)",
    methods: "walk down from J | locate the peak first",
    point: "mu where the start index of the lower sum passes 3000 (ncp about 5800), x at the mean, df = 3",
    cases: () => {
      const [m0, m1] = flipPoint((mu) => upperStart(mu) > 3000, 2000, 3000);
      return pPairs("pchisq(ncp + 3, 3, ncp)", (ncp, t) => pchisq(5803, 3, { ncp, ...t }), [2 * m0, 2 * m1]);
    },
  },
  {
    where: "internal/poissonMixture.ts:97, :132",
    fns: "pchisq, pbeta, pf with ncp",
    condition: "term above 1e-305 (else built from its log); log above -700 (approximate terms recomputed)",
    methods: "term from its log | from the linear value",
    point: "a sweep of the deep lower tail pchisq(q, 3, ncp 10, log) through log P = -700 (terms cross both bounds along it)",
    cases: () => {
      const xs = Array.from({ length: 41 }, (_, i) => 1e-300 * 10 ** (i / 4));
      return [{ kind: "sweep", label: "log pchisq(q, 3, ncp 10) against log q", f: (lq: number) => pchisq(Math.exp(lq), 3, { ncp: 10, logP: true }), xs: xs.map(Math.log) }];
    },
  },
  {
    where: "internal/poissonMixture.ts:105",
    fns: "pchisq, dchisq, pbeta, dbeta with ncp",
    condition: "|log of a term| / (500 log 2) > 2^50",
    methods: "mantissa from the remainder of the log | the exponent alone (the log known only to a few units)",
    point: "log dchisq(x, 3, ncp 1e-10) at x = 2^51 500 log 2 (about 7.8e17, where the j = 0 term crosses; extrapolated)",
    cases: () => {
      const at = 2 ** 51 * 500 * Math.LN2;
      return [{ kind: "extrap", label: "log dchisq(x, 3, ncp 1e-10)", f: (x) => dchisq(x, 3, { ncp: 1e-10, log: true }), at, gap: at * 1e-9, linear: true }];
    },
  },
  {
    where: "internal/poissonMixture.ts:455",
    fns: "pchisq, pbeta, pf with ncp (upper tail)",
    skip:
      "the restart happens when the terms of the upper sum are still growing 3000 steps after the start, which depends " +
      "on the walk itself; no single input moves it, and the restarted sum covers the same terms (bounded tail)",
    condition: "j - J >= 3000 && term still growing",
    methods: "-",
    point: "-",
  },
  {
    where: "internal/poissonMixture.ts:120",
    fns: "pchisq, pbeta, pf with ncp",
    condition:
      "x <= λ DBL_MIN or λ < x DBL_MIN (log Poisson weight), the latter unless 1 <= x <= 1e10 (the upper end is not " +
      "reached: the noncentral χ² takes the uniform expansion from a df of 2e4)",
    methods: "Loader's form | closed form",
    point:
      "ncp = 2 DBL_MIN (mu = DBL_MIN; the weights j >= 1 are then about mu^j, the result is the central one); the gamma " +
      "kernel's y = x/2 = DBL_MIN in pchisq(x, 3, ncp 1) (the components' log d_j at s = 3/2 + j); s = df/2 = 1 at " +
      "x = 1e-310 (y < s DBL_MIN on both sides)",
    cases: () => [
      ...pPairs("pchisq(5, 3, ncp)", (ncp, t) => pchisq(5, 3, { ncp, ...t }), down(2 * DBL_MIN)),
      ...pPairs("pchisq(x, 3, ncp 1)", (x, t) => pchisq(x, 3, { ncp: 1, ...t }), down(2 * DBL_MIN)),
      ...pPairs("pchisq(1e-310, df, ncp 1)", (df, t) => pchisq(1e-310, df, { ncp: 1, ...t }), down(2)),
    ],
  },
  {
    where: "internal/poissonMixture.ts:334, :342 (μ < 1e290)",
    fns: "pchisq, dchisq, pbeta, dbeta, pf, df with ncp",
    condition: "μ = λ/2 < 1e290 (the weight ratios μ / j and j / μ as double-double quotients)",
    methods: "w μ / j and w j / μ with μ scaled | w (μ / j) and w (j / μ)",
    point: "λ/2 = 1e290 in pchisq(1e-300, 3, ncp) and dchisq there (log; the linear values are 0)",
    cases: () => {
      const ab = flipPoint((ncp) => ncp / 2 < 1e290, 1.9e290, 2.1e290);
      return [
        pair("pchisq(1e-300, 3, ncp, log)", (ncp) => pchisq(1e-300, 3, { ncp, logP: true }), ab),
        pair("pchisq(1e-300, 3, ncp, upper log)", (ncp) => pchisq(1e-300, 3, { ncp, lowerTail: false, logP: true }), ab),
        pair("dchisq(1e-300, 3, ncp, log)", (ncp) => dchisq(1e-300, 3, { ncp, log: true }), ab),
      ];
    },
  },
  {
    where: "internal/poissonMixture.ts:170, :384",
    fns: "pchisq, pbeta, pf with ncp",
    skip:
      "exponents three or more units apart (the shifted mantissa is then 0 as it would be after the three steps), and the " +
      "argmax search cut off where its thirds round to its ends (beyond 2^53): no change of the result",
    condition: "to - from >= 3; 3000 iterations",
    methods: "-",
    point: "-",
  },
];

// ---- distributions/negbinomial.ts, hypergeometric.ts, internal/discrete.ts ----

/** P[X <= x] of the hypergeometric distribution by summing products of ratios (independent reference, small N) */
function hyperCdfRef(x: number, m: number, n: number, k: number): number {
  const N = m + n;
  let s = 0;
  for (let i = Math.max(0, k - n); i <= x; i++) {
    // C(m, i) C(n, k - i) / C(N, k) as a product of k ratios
    let v = 1;
    for (let j = 0; j < i; j++) v *= (m - j) / (i - j);
    for (let j = 0; j < k - i; j++) v *= (n - j) / (k - i - j);
    for (let j = 0; j < k; j++) v *= (k - j) / (N - j);
    s += v;
  }
  return s;
}

const DISCRETE: Entry[] = [
  {
    where: "distributions/geometric.ts:28",
    fns: "dgeom, pgeom",
    condition: "n < 1e290 (n = x for dgeom, x + 1 for pgeom)",
    methods: "n log q in double-double, scaled by 2^±64 | Loader's form",
    point: "x = 1e290 at prob = 1e-290 (q^n = e^-1)",
    cases: () => {
      const ab = flipPoint((x) => x < 1e290, 9e289, 2e290);
      return [
        ...pPairs("pgeom(x, 1e-290)", (x, t) => pgeom(x, 1e-290, t), ab),
        ...dPairs("dgeom(x, 1e-290)", (x, log) => dgeom(x, 1e-290, { log }), ab),
      ];
    },
  },
  {
    where: "distributions/negbinomial.ts:90",
    fns: "pnbinom, qnbinom",
    condition: "size <= 1 && q >= 0.95 && p >= 1e-4 (series for the upper tail)",
    methods: "incomplete beta | positive-term series",
    point: "size = 1 at x = 30, prob = 0.03; prob = 0.05 at size 0.5, x = 30; prob = 1e-4 at size 0.5, x = 20000",
    cases: () => {
      const nb = (x: number, size: number) => (prob: number, t: Tail) => pnbinom(x, size, { prob, ...t });
      return [
        ...pPairs("pnbinom(30, size, 0.03)", (size, t) => pnbinom(30, size, { prob: 0.03, ...t }), up(1)),
        ...pPairs("pnbinom(30, 0.5, prob)", nb(30, 0.5), around(flipPoint((p) => 1 - p >= 0.95, 0.04, 0.06)[0])),
        // (4e5 series terms a call; the change over the ulp of prob is 3e-16 relative)
        ...pPairs("pnbinom(20000, 0.5, prob)", nb(20000, 0.5), down(1e-4), { flat: true }),
      ];
    },
  },
  {
    where: "distributions/negbinomial.ts:101, :114",
    fns: "pnbinom, qnbinom",
    condition: "prefactor > 1e-290; series value <= 0.5",
    methods: "incomplete beta | series",
    point: "prefactor z^(x+1)(1 - z) = 1e-290 at size 1, x = 21800; upper tail = 1/2 at size 0.5, x = 30",
    cases: () => {
      const pre = (p: number) => 21801 * Math.log1p(-p) + Math.log(p) > Math.log(1e-290);
      return [
        ...pPairs("pnbinom(21800, 1, prob)", (prob, t) => pnbinom(21800, 1, { prob, ...t }), around(flipPoint(pre, 0.02, 0.04)[0], 64)),
        ...pPairs(
          "pnbinom(30, 0.5, prob)",
          (prob, t) => pnbinom(30, 0.5, { prob, ...t }),
          flipPoint((p) => pnbinom(30, 0.5, { prob: p, lowerTail: false }) <= 0.5, 0.005, 0.05),
        ),
      ];
    },
  },
  {
    where: "distributions/negbinomial.ts:129, :143",
    fns: "qnbinom",
    condition: "prob < 0.05 (gamma start); start > 1e4 (continuous refinement)",
    methods: "Cornish-Fisher | gamma quantile / -log q; integer search from the start | after Newton/secant steps",
    point: "prob = 0.05 at size 3, p = 0.3; the start 1e4 at size 3, prob = 0.001 (p about 0.99). Integer results: equal on both sides",
    cases: () => {
      const y0 = (p: number) => qgamma(p, 3) / Math.log1p(0.001 / 0.999) > 1e4;
      return [
        pair("qnbinom(0.3, 3, prob)", (prob) => qnbinom(0.3, 3, { prob }), down(0.05), { flat: true }),
        pair("qnbinom(p, 3, 0.001)", (p) => qnbinom(p, 3, { prob: 0.001 }), flipPoint(y0, 0.9, 0.999), { flat: true }),
      ];
    },
  },
  {
    where: "distributions/hypergeometric.ts:34",
    fns: "dhyper, phyper",
    condition: "b < 0.1 at the ends of the support (x = 0 or x = k)",
    methods: "n log a | -bd0(n, n a) - n b",
    point: "dhyper(0, m, n, 1) with k/N = 1/10 and 1/11 (integer parameters: each side against a product of ratios)",
    cases: () => [
      {
        kind: "check",
        label: "dhyper at the ends against the product of ratios",
        run: () => {
          for (const [x, m, n, k] of [
            [0, 3, 7, 1],
            [0, 3, 8, 1],
            [0, 30, 70, 10],
            [10, 70, 30, 10],
            [10, 80, 30, 10],
          ] as const) {
            const r = near(dhyper(x, m, n, k), hyperCdfRef(x, m, n, k) - (x > 0 ? hyperCdfRef(x - 1, m, n, k) : 0), 1e-13, `dhyper(${x}, ${m}, ${n}, ${k})`);
            if (r !== undefined) return r;
          }
          return undefined;
        },
      },
    ],
  },
  {
    where: "distributions/hypergeometric.ts:120",
    fns: "phyper, qhyper",
    condition: "x N < k m (which tail to sum); tail > 0.5 (sum the other)",
    methods: "upper tail summed | lower tail summed",
    point: "x = 4, 5, 6 at m = n = k = 10 (mean 5) and x = 7, 8 at m = 30, n = 2, k = 10 (mean near the top)",
    cases: () => [
      {
        kind: "check",
        label: "phyper on both sides of the mean against the sum of products",
        run: () => {
          for (const [x, m, n, k] of [
            [4, 10, 10, 10],
            [5, 10, 10, 10],
            [6, 10, 10, 10],
            [7, 30, 2, 10],
            [8, 30, 2, 10],
          ] as const) {
            const lo = hyperCdfRef(x, m, n, k);
            const r =
              near(phyper(x, m, n, k), lo, 1e-13, `phyper(${x}, ${m}, ${n}, ${k})`) ??
              near(phyper(x, m, n, k, { lowerTail: false }), 1 - lo, 1e-13, `phyper(${x}, ${m}, ${n}, ${k}, upper)`);
            if (r !== undefined) return r;
          }
          return undefined;
        },
      },
    ],
  },
  {
    where: "distributions/hypergeometric.ts:133",
    fns: "phyper (log)",
    condition: "tail > 1e-300",
    methods: "log form of the end probability + log of the sum | log of the linear tail",
    point: "the lower tail through 1e-300 at m = n = k = 1500 (against log-sum-exp of dhyper)",
    cases: () => [
      {
        kind: "check",
        label: "log phyper around 1e-300 against log-sum-exp of dhyper",
        run: () => {
          const [m, n, k] = [1500, 1500, 1500];
          // the x where the lower tail passes 1e-300
          let x = 0;
          while (phyper(x + 1, m, n, k) < 1e-300) x++;
          for (const y of [x - 1, x, x + 1, x + 2]) {
            const ld = Array.from({ length: y + 1 }, (_, i) => dhyper(i, m, n, k, { log: true }));
            const top = Math.max(...ld);
            const ref = top + Math.log(ld.reduce((s, l) => s + Math.exp(l - top), 0));
            const r = near(phyper(y, m, n, k, { logP: true }), ref, 1e-13, `log phyper(${y}, ${m}, ${n}, ${k})`);
            if (r !== undefined) return r;
          }
          return undefined;
        },
      },
    ],
  },
  {
    where: "internal/discrete.ts:40, :49",
    fns: "qpois, qbinom, qnbinom, qhyper, qgeom, qsignrank, qwilcox",
    condition: "logP || p < 1e-290 (compare on the log scale); t > 0.5 (compare the complements)",
    methods: "linear comparison | log comparison; F >= t | 1 - F <= 1 - t",
    point: "p = 1e-290 and p = 0.5 for qpois(p, 1000) and qbinom(p, 2000, 0.5); integer results equal on both sides",
    cases: () => [
      pair("qpois(p, 1000)", (p) => qpois(p, 1000), down(1e-290), { flat: true }),
      pair("qbinom(p, 2000, 0.5)", (p) => qbinom(p, 2000, 0.5), down(1e-290), { flat: true }),
      pair("qpois(p, 1000)", (p) => qpois(p, 1000), flipPoint((p) => p * (1 - 8 * Number.EPSILON) > 0.5, 0.5, 0.5000001), { flat: true }),
      pair("qhyper(p, 30, 20, 10)", (p) => qhyper(p, 30, 20, 10), flipPoint((p) => p * (1 - 8 * Number.EPSILON) > 0.5, 0.5, 0.5000001), { flat: true }),
    ],
  },
];

// ---- internal/invert.ts, internal/dpq.ts, internal/ddexp.ts ----

const INTERNAL: Entry[] = [
  {
    where: "internal/invert.ts:52, :67",
    fns: "every continuous q* solved by Newton (qgamma, qbeta, qt, qf, qchisq with ncp, ...)",
    condition: "log F > -700 (residual from the linear ratio)",
    methods: "log F - log target | log(F / target)",
    point: "target e^-700 for qbeta(p, 2, 3) and qf(p, 3, 7)",
    cases: () => {
      const ab = flipPoint((p) => Math.log(p) > -700, 1e-305, 1e-303);
      return [pair("qbeta(p, 2, 3)", (p) => qbeta(p, 2, 3), ab), pair("qf(p, 3, 7)", (p) => qf(p, 3, 7), ab)];
    },
  },
  {
    where: "internal/invert.ts:105",
    fns: "q* with a log-density derivative",
    skip: "a per-iteration choice between the Halley and Newton steps; it changes the path, not the converged root (checked by every quantile entry)",
    condition: "Halley/Newton step ratio in [0.5, 2]",
    methods: "-",
    point: "-",
  },
  {
    where: "internal/invert.ts:129",
    fns: "every continuous q* on a positive support",
    condition: "|log x| <= 2",
    methods: "Newton polish in x | none",
    point: "answer x = e^2 for qgamma(p, 5) and x = e^-2 for qbeta(p, 2, 3)",
    cases: () => [
      pair("qgamma(p, 5)", (p) => qgamma(p, 5), flipPoint((p) => qgamma(p, 5) > Math.exp(2), 0.7, 0.9)),
      pair("qbeta(p, 2, 3)", (p) => qbeta(p, 2, 3), flipPoint((p) => qbeta(p, 2, 3) > Math.exp(-2), 0.05, 0.2)),
    ],
  },
  {
    where: "internal/dpq.ts:80",
    fns: "every continuous q*",
    condition: "log p <= -log 2 (solve this tail, else the other)",
    methods: "other tail | this tail",
    point: "p = 1/2 for qgamma(p, 3) and qt(p, 4) (linear and log)",
    cases: () => [
      pair("qgamma(p, 3)", (p) => qgamma(p, 3), up(0.5)),
      pair("qgamma(lp, 3, log)", (lp) => qgamma(lp, 3, { logP: true }), up(-Math.LN2)),
      pair("qt(p, 4)", (p) => qt(p, 4), flipPoint((p) => Math.log(p) <= -Math.LN2, 0.49, 0.51)),
    ],
  },
  {
    where: "internal/ddexp.ts:17",
    fns: "pweibull, dweibull, qweibull",
    condition: "exponent < -708",
    methods: "double-double exp | exp(hi) (1 + lo)",
    point: "pweibull(q, 1) at log q = -708 (t = q)",
    cases: () => pPairs("pweibull(q, 1)", (q, t) => pweibull(q, 1, t), around(flipPoint((q) => Math.log(q) < -708, 1e-308, 1e-307)[0])),
  },
];

// ---- distributions/nchisq.ts: noncentral χ² ----
// For df = 1 and 3 the distribution has closed forms (X = (Z + sqrt(λ))² for df = 1):
//   df = 1: P[X <= x] = Φ(r - s) - Φ(-r - s),  f(x) = (φ(r - s) + φ(r + s)) / (2r)
//   df = 3: P[X <= x] = Φ(r - s) - Φ(-r - s) - (φ(r - s) - φ(r + s)) / s,  f(x) = (φ(r - s) - φ(r + s)) / (2s)
// with r = sqrt(x), s = sqrt(λ)

/** log P[X <= x] (lower) or log P[X > x] of the noncentral χ² with df = 1 or 3, from the closed forms */
function nchisqClosedLog(x: number, df: 1 | 3, ncp: number, lower: boolean): number {
  const r = Math.sqrt(x);
  const s = Math.sqrt(ncp);
  // r - s without cancellation (its absolute error would otherwise be ulp(s))
  const d = (x - ncp) / (r + s);
  // the φ terms of df = 3 relative to the leading Φ term, which is Φ(r - s) - Φ(-r - s) (lower) or Φ(s - r) + Φ(-r - s)
  const lphi = (z: number) => dnorm(z, { log: true });
  if (lower) {
    const la = pnorm(d, { logP: true });
    const l = la + Math.log1p(-Math.exp(pnorm(-r - s, { logP: true }) - la));
    return df === 3 ? l + Math.log1p(-(Math.exp(lphi(d) - l) - Math.exp(lphi(r + s) - l)) / s) : l;
  }
  const la = pnorm(-d, { logP: true });
  const l = la + Math.log1p(Math.exp(pnorm(-r - s, { logP: true }) - la));
  return df === 3 ? l + Math.log1p((Math.exp(lphi(d) - l) - Math.exp(lphi(r + s) - l)) / s) : l;
}

function nchisqDensityClosedLog(x: number, df: 1 | 3, ncp: number): number {
  const r = Math.sqrt(x);
  const s = Math.sqrt(ncp);
  const a = dnorm((x - ncp) / (r + s), { log: true });
  const b = dnorm(r + s, { log: true });
  return df === 1 ? a + Math.log1p(Math.exp(b - a)) - Math.log(2 * r) : a + Math.log(-Math.expm1(b - a)) - Math.log(2 * s);
}

/** sqrt(λ x), the Bessel argument (mirror of nchisq.ts) */
const besselZ = (x: number, ncp: number): number => Math.sqrt(ncp) * Math.sqrt(x);

/** Log density of the noncentral χ² by mpmath (summing the Poisson mixture at 80 digits) */
const NCHISQ_LOG_DENSITY: [number, number, number, number][] = [
  // x, df, ncp, log f(x)
  [2.0001e9, 1e6, 2e9, -62.94381384181123],
  [1.1e10, 1e10, 1e9, -12.86959836686902],
];

const NCHISQ: Entry[] = [
  {
    where: "distributions/nchisq.ts:34",
    fns: "pchisq, dchisq, qchisq with ncp",
    condition: "y = x/2 < 1e-250",
    methods: "term ratio as is | scaled by 2^500",
    point: "x = 2e-250 at df = 3, ncp = 5 (log scale; the values underflow)",
    cases: () => [
      ...pPairs("pchisq(x, 3, ncp 5)", (x, t) => pchisq(x, 3, { ncp: 5, ...t }), flipPoint((x) => x / 2 < 1e-250, 1e-250, 3e-250), { tails: TAILS.slice(2) }),
      pair("dchisq(x, 3, ncp 5, log)", (x) => dchisq(x, 3, { ncp: 5, log: true }), flipPoint((x) => x / 2 < 1e-250, 1e-250, 3e-250)),
    ],
  },
  {
    where: "distributions/nchisq.ts:35",
    fns: "pchisq, dchisq, qchisq with ncp",
    condition: "y = x/2 > 1e250",
    methods: "term ratio as is | scaled by 2^-500",
    point: "x = 2e250 at df = 3, ncp = 1e-10 (log scale; the linear values are 0 or 1)",
    cases: () => {
      const ab = flipPoint((x) => x / 2 > 1e250, 1.9e250, 2.1e250);
      return [
        ...pPairs("pchisq(x, 3, ncp 1e-10)", (x, t) => pchisq(x, 3, { ncp: 1e-10, ...t }), ab, { tails: TAILS.slice(2) }),
        pair("dchisq(x, 3, ncp 1e-10, log)", (x) => dchisq(x, 3, { ncp: 1e-10, log: true }), ab),
      ];
    },
  },
  {
    where: "distributions/nchisq.ts:223",
    fns: "pchisq, dchisq, qchisq with ncp (the large-argument expansion)",
    condition: "x > 1e300 (the double-double square root from x/4)",
    methods: "Newton correction of sqrt(x) | the same for x/4, doubled",
    point: "x = 1e300 at df = 3, ncp = 1e300 (log scale)",
    cases: () => [
      ...pPairs("pchisq(x, 3, ncp 1e300)", (x, t) => pchisq(x, 3, { ncp: 1e300, ...t }), up(1e300), { tails: TAILS.slice(2) }),
      pair("dchisq(x, 3, ncp 1e300, log)", (x) => dchisq(x, 3, { ncp: 1e300, log: true }), up(1e300)),
    ],
  },
  {
    where: "distributions/nchisq.ts:417, :423",
    fns: "pchisq, dchisq, qchisq with ncp (the uniform expansion)",
    condition: "x > 1e307 (N = λ + 2ν - x in halves); D = x + λ x / (R + ν) finite",
    methods: "N in double-double | from the halves; x / D | (R + ν) / (R + ν + λ)",
    point: "x = 1e307 at df = 3e4, ncp = 1e307; D overflowing at df = 3.3e268, ncp = 6.9e307 (log scale)",
    cases: () => {
      const [k, ncp] = [3.2994201097489077e268, 6.93900544389044e307];
      const nu = k / 2 - 1;
      const d = (x: number): number => {
        const z = Math.sqrt(ncp) * Math.sqrt(x);
        return x + z * (z / (Math.hypot(nu, z) + nu));
      };
      return [
        ...pPairs("pchisq(x, 3e4, ncp 1e307)", (x, t) => pchisq(x, 3e4, { ncp: 1e307, ...t }), up(1e307), { tails: TAILS.slice(2) }),
        pair("dchisq(x, 3e4, ncp 1e307, log)", (x) => dchisq(x, 3e4, { ncp: 1e307, log: true }), up(1e307)),
        ...pPairs("pchisq(x, 3.3e268, ncp 6.9e307)", (x, t) => pchisq(x, k, { ncp, ...t }), flipPoint((x) => d(x) < Infinity, 8e307, 1e308), {
          tails: TAILS.slice(2),
        }),
        pair("dchisq(x, 3.3e268, ncp 6.9e307, log)", (x) => dchisq(x, k, { ncp, log: true }), flipPoint((x) => d(x) < Infinity, 8e307, 1e308)),
      ];
    },
  },
  {
    where: "distributions/nchisq.ts:42, :52",
    fns: "pchisq, dchisq, qchisq with ncp",
    condition: "shape s = df/2 + j < 1e-8 (the j = 0 increment of a tiny df)",
    methods: "dpoisRaw (Stirling form) | s log y - y - log Γ(1 + s)",
    point: "df = 2e-8 at x = 1, ncp = 2",
    cases: () => {
      const ab = flipPoint((df) => df / 2 < 1e-8, 1e-8, 3e-8);
      return [...pPairs("pchisq(1, df, ncp 2)", (df, t) => pchisq(1, df, { ncp: 2, ...t }), ab), ...dPairs("dchisq(1, df, ncp 2)", (df, log) => dchisq(1, df, { ncp: 2, log }), ab)];
    },
  },
  {
    where: "distributions/nchisq.ts:91, :132, :168",
    fns: "pchisq, dchisq, qchisq with ncp",
    condition: "x/2 rounded (a subnormal x with an odd last bit)",
    methods: "the mixture at y = x/2 | the mixture at x2 = 2 (x/2) times (x/x2)^(df/2) (the density (x/x2)^(df/2 - 1))",
    point: "x = 7.022937096e-315 (odd) and the next double (even) at df = 0.5, ncp = 24.3; 33 and 34 times 2^-1074 at df = 0.49, ncp = 1",
    cases: () => {
      const o = { ncp: 24.327519525000625 };
      const odd = 7.022937096e-315;
      return [
        ...pPairs("pchisq(x, 0.5, ncp 24.3)", (x, t) => pchisq(x, 0.5, { ...o, ...t }), up(odd)),
        ...dPairs("dchisq(x, 0.5, ncp 24.3)", (x, log) => dchisq(x, 0.5, { ...o, log }), up(odd)),
        ...pPairs("pchisq(x, 0.49, ncp 1)", (x, t) => pchisq(x, 0.4879396427871575, { ncp: 1, ...t }), [33 * 2 ** -1074, 34 * 2 ** -1074]),
      ];
    },
  },
  {
    where: "distributions/nchisq.ts:207 (z > 1e4)",
    fns: "pchisq, dchisq, qchisq with ncp",
    condition: "z = sqrt(λ x) > 1e4 and ν² <= z/100 (ν = df/2 - 1)",
    methods: "Poisson mixture | large-argument Bessel expansion (besselAsymptotic; besselTails integrates it)",
    point:
      "x = 1e4 at df = 3, ncp = 1e4 (the centre). Validity: closed forms for df = 1 and 3 at ncp = 1e4 and 1e12 from " +
      "sqrt(x) - sqrt(λ) = -38 to 38, at x = 1e6, ncp = 1e13 (far left) and the earlier bug at x = ncp = 3e9",
    cases: () => {
      const ab = flipPoint((x) => besselZ(x, 1e4) > 1e4, 9e3, 1.1e4);
      const closed = (x: number, df: 1 | 3, l: number): string | undefined => {
        for (const t of TAILS) {
          const v = pchisq(x, df, { ncp: l, ...t });
          const ref = nchisqClosedLog(x, df, l, t.lowerTail);
          const r = near(v, t.logP ? ref : Math.exp(ref), 1e-13, `pchisq(${x}, ${df}, ncp ${l}, ${tailName(t)})`);
          if (r !== undefined) return r;
        }
        return near(dchisq(x, df, { ncp: l, log: true }), nchisqDensityClosedLog(x, df, l), 1e-13, `log dchisq(${x}, ${df}, ncp ${l})`);
      };
      return [
        ...pPairs("pchisq(x, 3, ncp 1e4)", (x, t) => pchisq(x, 3, { ncp: 1e4, ...t }), ab),
        ...dPairs("dchisq(x, 3, ncp 1e4)", (x, log) => dchisq(x, 3, { ncp: 1e4, log }), ab),
        {
          kind: "check",
          label: "df = 1, 3 against the closed forms at ncp = 1e4 and 1e12 (and the earlier bug at x = ncp = 3e9)",
          run: () => {
            // (at ncp = 1e4 not as far as 38: the tails there are subnormal, the logs of the near tails with them)
            for (const [l, far] of [
              [1e4, 30],
              [1e12, 38],
            ] as const) {
              for (const df of [1, 3] as const) {
                for (const k of [-far, -5, 0, 5, far]) {
                  const r = closed((Math.sqrt(l) + k) ** 2, df, l);
                  if (r !== undefined) return r;
                }
              }
            }
            return closed(3e9, 1, 3e9);
          },
        },
        {
          kind: "check",
          label: "df = 1 far left (x = 1e6, ncp = 1e13) against the closed form",
          run: () => near(pchisq(1e6, 1, { ncp: 1e13, logP: true }), nchisqClosedLog(1e6, 1, 1e13, true), 1e-13, "log pchisq(1e6, 1, ncp 1e13)"),
        },
      ];
    },
  },
  {
    where: "distributions/nchisq.ts:207 (ν² <= z/100)",
    fns: "pchisq, dchisq, qchisq with ncp",
    condition: "ν² <= z/100 (z > 1e4)",
    methods: "uniform expansion in ν (debyeAt, debyeTails) | large-argument expansion",
    point: "x = 1e8 at df = 2002 (ν = 1000), ncp = 1e8, near the mean",
    cases: () => {
      const ab = flipPoint((x) => 1000 * 1000 <= besselZ(x, 1e8) / 100, 0.9e8, 1.1e8);
      return [
        ...pPairs("pchisq(x, 2002, ncp 1e8)", (x, t) => pchisq(x, 2002, { ncp: 1e8, ...t }), ab),
        ...dPairs("dchisq(x, 2002, ncp 1e8)", (x, log) => dchisq(x, 2002, { ncp: 1e8, log }), ab),
      ];
    },
  },
  {
    where: "distributions/nchisq.ts:208 (z > 1e6)",
    fns: "pchisq, dchisq, qchisq with ncp",
    condition: "z > 1e6 where ν² > z/100 (so ν > 100)",
    methods: "Poisson mixture | uniform expansion in ν",
    point:
      "x = 1e6 at df = 1000, ncp = 1e6 (the centre). Validity: the reported cases of ν² >> z: log dchisq(2.0001e9, 1e6, " +
      "ncp 2e9) and (1.1e10, 1e10, ncp 1e9) against mpmath (they were NaN), pchisq(1.1e10, 1e10, ncp 1e9) and " +
      "pchisq(2.0003e9, 3e5, ncp 2e9) (they did not return), df = 2e5 at ncp = 2e9, against the normal approximation",
    cases: () => {
      const ab = flipPoint((x) => besselZ(x, 1e6) > 1e6, 0.9e6, 1.1e6);
      return [
        ...pPairs("pchisq(x, 1000, ncp 1e6)", (x, t) => pchisq(x, 1000, { ncp: 1e6, ...t }), ab),
        ...dPairs("dchisq(x, 1000, ncp 1e6)", (x, log) => dchisq(x, 1000, { ncp: 1e6, log }), ab),
        {
          kind: "check",
          label: "large df: log density against mpmath",
          run: () =>
            NCHISQ_LOG_DENSITY.map(([x, df, l, ref]) => near(dchisq(x, df, { ncp: l, log: true }), ref, 1e-13, `log dchisq(${x}, ${df}, ncp ${l})`)).find(
              (s) => s !== undefined,
            ),
        },
        {
          kind: "check",
          label: "large df: range, complement and the normal approximation",
          run: () => {
            for (const [df, l, ks] of [
              [1e10, 1e9, [-1, 0, 3]],
              [3e5, 2e9, [-3, 0, 1]],
              [2e5, 2e9, [-1, 0, 3]],
            ] as const) {
              const mean = df + l;
              const sd = Math.sqrt(2 * (df + 2 * l));
              for (const k of ks) {
                const x = mean + k * sd;
                const r =
                  tailsConsistent((t) => pchisq(x, df, { ncp: l, ...t }), 1e-13, `pchisq(${x}, ${df}, ncp ${l})`) ??
                  (Math.abs(pchisq(x, df, { ncp: l }) - pnorm(k)) < 5e-3 ? undefined : `pchisq(${x}, ${df}, ncp ${l}) = ${pchisq(x, df, { ncp: l })}, normal ${pnorm(k)}`);
                if (r !== undefined) return r;
              }
            }
            return undefined;
          },
        },
      ];
    },
  },
  {
    where: "distributions/nchisq.ts:208 (ν > 1e4)",
    fns: "pchisq, dchisq, qchisq with ncp",
    condition: "ν = df/2 - 1 > 1e4 (z <= 1e6)",
    methods: "Poisson mixture | uniform expansion in ν",
    point: "df = 20002 at x = 20012 (the mean), ncp = 10",
    cases: () => {
      const ab = flipPoint((df) => df / 2 - 1 > 1e4, 20001, 20003);
      return [
        ...pPairs("pchisq(20012, df, ncp 10)", (df, t) => pchisq(20012, df, { ncp: 10, ...t }), ab),
        ...dPairs("dchisq(20012, df, ncp 10)", (df, log) => dchisq(20012, df, { ncp: 10, log }), ab),
      ];
    },
  },
  {
    where: "distributions/nchisq.ts:243",
    fns: "pchisq, dchisq, qchisq with ncp (large-argument expansion)",
    condition: "d / sqrt(λ) > -1/2 (d = sqrt(x) - sqrt(λ))",
    methods: "log(sqrt(x)/sqrt(λ)) as log(x)/2 - log sqrt(λ) | log1p(d/sqrt(λ))",
    point: "x = λ/4 at df = 3, ncp = 1e8 (far in the lower tail; log scale)",
    cases: () => [
      ...pPairs("pchisq(x, 3, ncp 1e8)", (x, t) => pchisq(x, 3, { ncp: 1e8, ...t }), around(2.5e7), { tails: TAILS.slice(2) }),
      pair("dchisq(x, 3, ncp 1e8, log)", (x) => dchisq(x, 3, { ncp: 1e8, log: true }), around(2.5e7)),
    ],
  },
  {
    where: "distributions/nchisq.ts:426",
    fns: "pchisq, dchisq, qchisq with ncp (uniform expansion)",
    condition: "e = x/(ν + R) - 1 > -1/2",
    methods: "log(1 + e) - e as log x - log(ν + R) - e | log1pmx(e)",
    point: "x = (λ/2 + 2ν)/2 at df = 1000, ncp = 4e6 (far in the lower tail; extrapolated, log scale)",
    cases: () => {
      const at = (4e6 / 2 + 2 * 499) / 2;
      return [
        { kind: "extrap", label: "log dchisq(x, 1000, ncp 4e6)", f: (x) => dchisq(x, 1000, { ncp: 4e6, log: true }), at, gap: at * 1e-7 },
        { kind: "extrap", label: "log pchisq(x, 1000, ncp 4e6)", f: (x) => pchisq(x, 1000, { ncp: 4e6, logP: true }), at, gap: at * 1e-7 },
      ];
    },
  },
  {
    where: "distributions/nchisq.ts:105; internal/poissonMixture.ts:254, :266",
    fns: "pchisq, qchisq with ncp",
    condition: "λ/2 > 1e8 (where the mixture is used: z <= 1e4, x far below the mean)",
    methods: "each tail summed | the upper tail as 1 - the lower; the start of the sums searched for on the log scale",
    point: "ncp = 2e8 at x = 0.3, df = 3",
    cases: () => pPairs("pchisq(0.3, 3, ncp)", (l, t) => pchisq(0.3, 3, { ncp: l, ...t }), flipPoint((l) => l / 2 > 1e8, 1.9e8, 2.1e8)),
  },
  {
    where: "distributions/nchisq.ts:600",
    fns: "pchisq with ncp",
    skip:
      "decides only whether a tail is below the double range (Chernoff bound); the two forms are the same bound, " +
      "rearranged, and a tail near the decision is computed in full either way",
    condition: "s <= 1/4",
    methods: "-",
    point: "-",
  },
  {
    where: "distributions/nchisq.ts:626",
    fns: "qchisq, qbeta, qf with ncp",
    skip:
      "acceptance of the Newton iteration's quantile: within 1e-15 of the target log p, or within 1e-9 and the quantile " +
      "to 1e-14 by its definition; otherwise the search over the doubles, which ends at the same quantile",
    condition: "|log p - target| <= 1e-15 |target|",
    methods: "-",
    point: "-",
  },
  {
    where: "distributions/nchisq.ts:652",
    fns: "qchisq with ncp",
    skip: "only the starting value of the Newton iteration (Wilson and Hilferty's cube root of Patnaik's χ² for ν > 1e5)",
    condition: "ν > 1e5",
    methods: "-",
    point: "-",
  },
  {
    where: "distributions/nchisq.ts:658",
    fns: "qchisq with ncp",
    condition: "relative spread sqrt(2(k + 2λ))/(k + λ) < 1e-10",
    methods: "Newton iteration | search over the doubles around the start (narrowQuantile)",
    point: "df on both sides of the condition at ncp = 1 (df about 2e20): the quantile reaches p, and the previous double does not",
    cases: () => [
      {
        kind: "check",
        label: "qchisq at df either side of a relative spread of 1e-10",
        run: () => {
          const [d0, d1] = flipPoint((df) => Math.sqrt(2 * (df + 2)) < 1e-10 * (df + 1), 1e20, 1e21);
          for (const df of [d0, d1]) {
            for (const p of [1e-100, 0.3]) {
              const q = qchisq(p, df, { ncp: 1 });
              const pq = pchisq(q, df, { ncp: 1 });
              const pPrev = pchisq(nextDown(q), df, { ncp: 1 });
              if (!(pq >= p * (1 - 1e-9) && pPrev <= p * (1 + 1e-9))) return `qchisq(${p}, ${df}, ncp 1) = ${q}: pchisq there ${pq}, at the previous double ${pPrev}`;
            }
          }
          return undefined;
        },
      },
    ],
  },
  {
    where: "distributions/nchisq.ts:506",
    fns: "pbeta, pf with ncp (the integral of nbeta.ts)",
    skip: "x0 e^v formed from the logs only where e^v over- or underflows on its own: the same x",
    condition: "|v| < 700",
    methods: "-",
    point: "-",
  },
];

// ---- distributions/nt.ts: noncentral t ----
// With ncp = 1e-300 the integral is computed as for any ncp, and its value is the central t to far below rounding

const ptn = (df: number, ncp: number) => (v: number, t: Tail) => pt(v, df, { ncp, ...t });
const grid = (from: number, step: number, n: number): number[] => Array.from({ length: n }, (_, i) => from + i * step);

const NT: Entry[] = [
  {
    where: "distributions/nt.ts:363",
    fns: "pt, qt with ncp",
    condition: "|t| S width/2 > 2 (S = e^(w*/2) at the peak, width = 1/sqrt(a e^w*)); this is |t| > 4 sqrt(a) unless the width is clipped at 10",
    methods: "formula A (E[Φ(tS - δ)]) | formula B (integration by parts)",
    point: "t = ±4 sqrt(5) at df = 10, ncp = 1 and t = 4 sqrt(1.5) at df = 3. Validity: ncp = 1e-300 against the central pt on both sides",
    cases: () => {
      const t10 = 4 * Math.sqrt(5);
      const t3 = 4 * Math.sqrt(1.5);
      return [
        ...pPairs("pt(t, 10, ncp 1)", ptn(10, 1), around(t10, 8)),
        ...pPairs("pt(t, 10, ncp 1)", ptn(10, 1), around(-t10, 8)),
        ...pPairs("pt(t, 3, ncp -2)", ptn(3, -2), around(t3, 8)),
        {
          kind: "check",
          label: "ncp = 1e-300 against the central pt at t = ±4 sqrt(a) (1 ± 1e-3)",
          run: () => {
            for (const [df, t0] of [
              [10, t10],
              [3, t3],
            ] as const) {
              for (const v of [t0 * 0.999, t0 * 1.001, -t0 * 0.999, -t0 * 1.001]) {
                for (const t of TAILS) {
                  const r = near(pt(v, df, { ncp: 1e-300, ...t }), pt(v, df, t), 1e-13, `pt(${v}, ${df}, ncp 1e-300, ${tailName(t)})`);
                  if (r !== undefined) return r;
                }
              }
            }
            return undefined;
          },
        },
      ];
    },
  },
  {
    where: "distributions/nt.ts:67, :79, :94, :250, :255",
    fns: "pt, dt, qt with ncp",
    condition: "per node: |w| < 1e-6 / < 0.1 (e^w - 1 - w by series); z < 0 (Mills ratio); rounding estimate <= 4 peak (double-precision fast path)",
    methods: "double-double node | double node; direct | series forms",
    point: "the nodes move with t: sweeps of pt(t, 10, ncp 1) and dt(t, 10, ncp 1) over t in [1, 1.008] and [-2, -1.992]",
    cases: () => [
      { kind: "sweep", label: "pt(t, 10, ncp 1)", f: (v) => pt(v, 10, { ncp: 1 }), xs: grid(1, 2e-4, 41) },
      { kind: "sweep", label: "pt(t, 10, ncp 1, upper)", f: (v) => pt(v, 10, { ncp: 1, lowerTail: false }), xs: grid(-2, 2e-4, 41) },
      { kind: "sweep", label: "dt(t, 10, ncp 1)", f: (v) => dt(v, 10, { ncp: 1 }), xs: grid(1, 2e-4, 41) },
    ],
  },
  {
    where: "distributions/nt.ts:535, :555, :227",
    fns: "pt, dt, qt with ncp",
    condition: "peak log integrand L outside ±650 (sum on the log scale); exp(offset) with offset > -700; log Φ in double-double for z <= -5",
    methods: "linear sum | sum relative to the peak, on the log scale",
    point: "a sweep of log pt(1, 10, ncp δ, upper) over δ through log P = -650",
    cases: () => {
      const d0 = flipPoint((d) => pt(1, 10, { ncp: d, lowerTail: false, logP: true }) < -650, -37, -30)[0];
      return [{ kind: "sweep", label: "log pt(1, 10, ncp δ, upper)", f: (d) => pt(1, 10, { ncp: d, lowerTail: false, logP: true }), xs: grid(d0 - 0.3, 0.015, 41) }];
    },
  },
  {
    where: "distributions/nt.ts:571, :622, :646, :802",
    fns: "pt, dt, qt with ncp",
    condition: "|t| > T0 = 1e10 (|δ| + 10) sqrt(a + 1) (minor SUSPECT: the bound on the correction assumes Z bounded, but its weight peaks near sqrt(2a))",
    methods: "integral | power law P(T0) (T0/|t|)^(2a), f(T0) (T0/|t|)^(2a+1)",
    point:
      "t = T0 at df = 10, ncp = 1 (p, d and the quantile at P(T0)). Validity: ncp = 1e-300 against the central pt at 10 T0 " +
      "for df = 10 and 2e6. The neglected correction, about 2a/1e22 relative in P (2e-16 at df = 2e6), is far below the " +
      "rounding of log P itself there (log P = -5.5e7, whose ulp is 7e-9)",
    cases: () => {
      const T0 = 1e10 * 11 * Math.sqrt(6);
      const lT0 = pt(T0, 10, { ncp: 1, lowerTail: false, logP: true });
      const far = (df: number): string | undefined => {
        const t = 10 * 1e10 * 10 * Math.sqrt(df / 2 + 1);
        return near(pt(t, df, { ncp: 1e-300, lowerTail: false, logP: true }), pt(t, df, { lowerTail: false, logP: true }), 1e-13, `log pt(${t}, ${df}, ncp 1e-300, upper)`);
      };
      return [
        ...pPairs("pt(t, 10, ncp 1)", ptn(10, 1), around(T0, 8), { tails: TAILS.slice(2) }),
        pair("dt(t, 10, ncp 1, log)", (v) => dt(v, 10, { ncp: 1, log: true }), around(T0, 8)),
        pair("qt(lp, 10, ncp 1, upper log)", (lp) => qt(lp, 10, { ncp: 1, lowerTail: false, logP: true }), up(lT0)),
        { kind: "check", label: "power law against the central t (df 10)", run: () => far(10) },
        { kind: "check", label: "power law against the central t (df 2e6)", run: () => far(2e6) },
      ];
    },
  },
  {
    where: "distributions/nt.ts:628, :630",
    fns: "pt, qt with ncp",
    condition: "the tail guessed to be the smaller (lower for t < δ) has a value above 1/2",
    methods: "the requested tail integrated | 1 - (the other tail)",
    point: "the median of pt(t, 10, ncp 1) and the guess's switch at t = δ = 1",
    cases: () => [...pPairs("pt(t, 10, ncp 1)", ptn(10, 1), flipPoint((t) => (pt(t, 10, { ncp: 1 }) as number) > 0.5, 0.5, 2)), ...pPairs("pt(t, 10, ncp 1)", ptn(10, 1), down(1))],
  },
  {
    where: "distributions/nt.ts:351, :520",
    fns: "pt, dt, qt with ncp",
    condition: "a > 1e5 and the neglected terms of Laplace's method, 1/L2² + q^6, below 1e-17 max(1, |log value|)",
    methods: "integral | Laplace's method",
    point:
      "df = 2e5 at t = -3000, ncp = -0.5 (far in the lower tail, where Laplace's method is taken from a = 1e5 on); a " +
      "sweep of log pt(t, 2e8, ncp 0) through log P = -10, from where on it is taken at a = 1e8 (1/L2² = 1e-16)",
    cases: () => {
      const ab = flipPoint((d) => d / 2 > 1e5, 1.9e5, 2.1e5);
      return [
        ...pPairs("pt(-3000, df, ncp -0.5)", (d, t) => pt(-3000, d, { ncp: -0.5, ...t }), ab, { tails: TAILS.slice(2) }),
        pair("dt(-3000, df, ncp -0.5, log)", (d) => dt(-3000, d, { ncp: -0.5, log: true }), ab),
        {
          kind: "sweep",
          label: "log pt(t, 2e8, ncp 0)",
          f: (v) => pt(v, 2e8, { ncp: 1e-300, logP: true }),
          xs: grid(flipPoint((v) => (pt(v, 2e8, { ncp: 1e-300, logP: true }) as number) < -10, -5, -3)[0] - 20 * 2e-4, 2e-4, 41),
        },
      ];
    },
  },
  {
    where: "distributions/nt.ts:413, :427",
    fns: "pt, dt, qt with ncp (Laplace's method)",
    condition: "u < -3 (u + m and 1 + ℓ2 from the continued fraction); u < -1e3 (ℓ3, ℓ4 from their series)",
    methods: "direct | continued fraction | asymptotic series",
    point: "sweeps of log pt(t, 1e12, ncp 0) through t = -3 and t = -1000 (u = t at ncp 0)",
    cases: () => [
      { kind: "sweep", label: "log pt(t, 1e12, ncp 1e-300) through u = -3", f: (v) => pt(v, 1e12, { ncp: 1e-300, logP: true }), xs: grid(-3.004, 2e-4, 41) },
      { kind: "sweep", label: "log pt(t, 1e12, ncp 1e-300) through u = -1000", f: (v) => pt(v, 1e12, { ncp: 1e-300, logP: true }), xs: grid(-1000.004, 2e-4, 41) },
    ],
  },
  {
    where: "distributions/nt.ts:358, :373",
    fns: "pt, qt with ncp",
    condition: "a < 1e-5",
    methods: "formula A or B by the steepness at the peak | formula B (for t < 0 as Φ(-δ) minus the part with Q(a, a S²))",
    point: "df = 2e-5 at t = -3, 0.5 and 1000 with ncp = 1 and 40",
    cases: () => {
      const ab = flipPoint((d) => d / 2 < 1e-5, 1.9e-5, 2.1e-5);
      return [-3, 0.5, 1000].flatMap((t) => [1, 40].flatMap((ncp) => pPairs(`pt(${t}, df, ncp ${ncp})`, (d, tl) => pt(t, d, { ncp, ...tl }), ab)));
    },
  },
  {
    where: "distributions/nt.ts:618",
    fns: "pt, qt with ncp",
    condition: "(|t|/sqrt(a)) sqrt(4a + 2δ² + 800) (|δ| + 2) <= 1e-17",
    methods: "integral | Φ(-δ), Φ(δ)",
    point: "t where the condition flips at df = 10, ncp = 1, at df = 2e-20, ncp = 7 and at df = 1e-300, ncp = 1e4 (both signs of t)",
    cases: () => {
      const cond = (a: number, d: number) => (t: number) =>
        (Math.abs(t) / Math.sqrt(a)) * Math.hypot(Math.SQRT2 * d, Math.sqrt(4 * a + 800)) * (Math.abs(d) + 2) <= 1e-17;
      const f1 = flipPoint(cond(5, 1), 1e-20, 1e-18);
      const f2 = flipPoint(cond(1e-20, 7), 1e-38, 1e-26);
      const f3 = flipPoint(cond(5e-301, 1e4), 1e-180, 1e-170);
      return [
        ...pPairs("pt(t, 10, ncp 1)", ptn(10, 1), f1),
        ...pPairs("pt(-t, 10, ncp 1)", (t, tl) => pt(-t, 10, { ncp: 1, ...tl }), f1),
        ...pPairs("pt(t, 2e-20, ncp 7)", ptn(2e-20, 7), f2),
        ...pPairs("pt(-t, 2e-20, ncp 7)", (t, tl) => pt(-t, 2e-20, { ncp: 7, ...tl }), f2),
        ...pPairs("pt(t, 1e-300, ncp 1e4)", ptn(1e-300, 1e4), f3),
        ...pPairs("pt(-t, 1e-300, ncp 1e4)", (t, tl) => pt(-t, 1e-300, { ncp: 1e4, ...tl }), f3),
      ];
    },
  },
  {
    where: "distributions/nt.ts:594",
    fns: "pt, qt with ncp",
    condition: "|t| > T0 with the far tail still above 1/2 (a tiny a: it falls only as |t|^(-2a))",
    methods: "integral | near tail at T0 plus what the far tail lost",
    point: "t = T0 = 1.7e11 at df = 2e-20, ncp = 7",
    cases: () => pPairs("pt(t, 2e-20, ncp 7)", ptn(2e-20, 7), around(1e10 * 17 * Math.sqrt(1 + 1e-20), 8)),
  },
  {
    where: "distributions/nt.ts:115, :119, :128, :139, :254, :275, :292",
    fns: "pt, dt, qt with ncp",
    skip:
      "per node of the integrals: x = a e^w below 1e-300 in formula B (P(a, x) from log x, and log Q from log a where " +
      "a log x is above -1e-10), a e^w formed from logs beyond e^700, the density's terms in one exp where C_a e^-E " +
      "underflows; the same values in other forms",
    condition: "a e^w < 1e-300; a log x > -1e-10; w >= 700; log of C_a e^-E φ below -700",
    methods: "-",
    point: "-",
  },
  {
    where: "distributions/nt.ts:811",
    fns: "qt with ncp",
    condition: "df < 1e-3 and P[T <= largest double] below the target (the near tail of a small a)",
    methods: "-",
    point: "validity: the quantile is Infinity where the lower tail at the largest double is below p (df 5.4e-96, ncp 48.9)",
    cases: () => [
      {
        kind: "check",
        label: "qt beyond the largest double",
        run: () => {
          const [p, d, ncp] = [1.4426402575659767e-62, 5.449761356942939e-96, 48.87598483697083];
          const q = qt(p, d, { ncp });
          const pMax = pt(Number.MAX_VALUE, d, { ncp }) as number;
          return q === Infinity && pMax < p ? undefined : `qt(${p}, ${d}, ncp ${ncp}) = ${q}, pt at the largest double ${pMax}`;
        },
      },
    ],
  },
];

// ---- distributions/t.ts, nt.ts: the ends of df ----

/** log pt(t, 1e300, upper) and dt on the log scale (the linear values are 0 or 1 on both sides) */
const hugeTails: Tail[] = [{ lowerTail: false, logP: true }];
const ratio300 = (t: number) => (t / 1e150) ** 2;

const T_ENDS: Entry[] = [
  {
    where: "distributions/t.ts:71, :178, :194; distributions/nt.ts:730, :753, :772",
    fns: "pt, dt, qt (also with ncp)",
    condition: "df > 1e200",
    methods: "incomplete beta, Loader's density, the integral | the normal, or -(df/2) log1p(t²/df) in the far tail",
    point: "df = 1e200 at t = 0.3, -40 and 1e95 (the far tail), ncp 0 and 1; qt at p = 1e-10 and log p = -1e185",
    cases: () => {
      const ab = up(1e200);
      const out: Case[] = [];
      for (const v of [0.3, -40, 1e95]) {
        out.push(...pPairs(`pt(${v}, df)`, (n, t) => pt(v, n, t), ab));
        out.push(...pPairs(`pt(${v}, df, ncp 1)`, (n, t) => pt(v, n, { ncp: 1, ...t }), ab));
        out.push(...dPairs(`dt(${v}, df)`, (n, log) => dt(v, n, { log }), ab));
        out.push(...dPairs(`dt(${v}, df, ncp 1)`, (n, log) => dt(v, n, { ncp: 1, log }), ab));
      }
      out.push(pair("qt(1e-10, df)", (n) => qt(1e-10, n), ab));
      out.push(pair("qt(-1e185, df, upper log)", (n) => qt(-1e185, n, { lowerTail: false, logP: true }), ab));
      out.push(pair("qt(1e-10, df, ncp 1)", (n) => qt(1e-10, n, { ncp: 1 }), ab));
      return out;
    },
  },
  {
    where: "distributions/t.ts:72, :178, :197; distributions/nt.ts:731, :754, :775",
    fns: "pt, dt, qt (also with ncp), df > 1e200",
    condition: "t²/df < 1e-17",
    methods: "-(df/2) log1p(t²/df) | the normal",
    point: "t = 3.2e141 at df = 1e300, ncp 0 and 1; qt at the log p where qnorm crosses it",
    cases: () => {
      const ab = flipPoint((v) => ratio300(v) < 1e-17, 3e141, 3.3e141);
      const lp = flipPoint((l) => ratio300(qnorm(l, { logP: true })) < 1e-17, -5.1e282, -4.9e282);
      return [
        ...pPairs("pt(t, 1e300)", (v, t) => pt(v, 1e300, t), ab, { tails: hugeTails }),
        ...pPairs("pt(t, 1e300, ncp 1)", (v, t) => pt(v, 1e300, { ncp: 1, ...t }), ab, { tails: hugeTails }),
        pair("dt(t, 1e300, log)", (v) => dt(v, 1e300, { log: true }), ab),
        pair("dt(t, 1e300, ncp 1, log)", (v) => dt(v, 1e300, { ncp: 1, log: true }), ab),
        pair("qt(lp, 1e300, log)", (l) => qt(l, 1e300, { logP: true }), lp),
      ];
    },
  },
  {
    where: "distributions/nt.ts:708",
    fns: "pt, dt, qt with ncp, df > 1e200 and t²/df >= 1e-17",
    condition: "|δ| <= 1e-20 min(|t|, sqrt(df))",
    methods: "the integral | the central far tail -(df/2) log1p(t²/df)",
    point: "δ = 1e122 at t = ±1e142, df = 1e300",
    cases: () => {
      const ab = flipPoint((d) => d <= 1e-20 * 1e142, 0.9e122, 1.1e122);
      return [
        ...pPairs("pt(1e142, 1e300, ncp δ)", (d, t) => pt(1e142, 1e300, { ncp: d, ...t }), ab, { tails: hugeTails }),
        ...pPairs("pt(-1e142, 1e300, ncp δ)", (d, t) => pt(-1e142, 1e300, { ncp: d, ...t }), ab, { tails: TAILS.slice(2, 3) }),
        pair("dt(1e142, 1e300, ncp δ, log)", (d) => dt(1e142, 1e300, { ncp: d, log: true }), ab),
      ];
    },
  },
  {
    where: "distributions/nt.ts:678, :681",
    fns: "pt, dt, qt (also with ncp), df > 1e200",
    condition: "t/sqrt(df) > 1e8; t²/df < 1e-5",
    methods: "(t²/2) log1p(y)/y (series below 1e-5) | df (log u + log1p(1/u²)/2)",
    point: "t = 1e158 and t = 3.2e147 at df = 1e300",
    cases: () => [
      ...[flipPoint((v) => v / 1e150 > 1e8, 9e157, 1.1e158), flipPoint((v) => ratio300(v) < 1e-5, 3e147, 3.3e147)].flatMap((ab) => [
        ...pPairs("pt(t, 1e300)", (v, t) => pt(v, 1e300, t), ab, { tails: hugeTails }),
        pair("dt(t, 1e300, log)", (v) => dt(v, 1e300, { log: true }), ab),
      ]),
    ],
  },
  {
    where: "distributions/nt.ts:691",
    fns: "qt (also with ncp), df > 1e200",
    condition: "-2 log p / df < 700",
    methods: "sqrt(df) exp(r/2) | sqrt(df expm1(r))",
    point: "log p = -3.5e302 at df = 1e300",
    cases: () => [pair("qt(lp, 1e300, upper log)", (l) => qt(l, 1e300, { lowerTail: false, logP: true }), flipPoint((l) => 2 * (-l / 1e300) < 700, -3.6e302, -3.4e302))],
  },
  {
    where: "distributions/t.ts:76",
    fns: "dt",
    condition: "df < 1e-20",
    methods: "Loader's form | sqrt(df) / (2 sqrt(1 + x²/df))",
    point: "df = 1e-20 at x = 0, 3 and 1e100",
    cases: () => [0, 3, 1e100].flatMap((v) => dPairs(`dt(${v}, df)`, (n, log) => dt(v, n, { log }), down(1e-20))),
  },
  {
    where: "distributions/t.ts:202",
    fns: "qt",
    condition: "df < 1e-15",
    methods: "Newton | 1/2 - (df/2) asinh(t / sqrt(df)) inverted",
    point:
      "validity on both sides of df = 1e-15: the round trip of p within 1e-13 of 1/2 (where 1/2 - p is resolved to " +
      "its rounding only, so the quantiles on the two sides differ by much more than 1e-13), and Infinity for p = 0.4",
    cases: () => [
      {
        kind: "check",
        label: "qt(p, df, upper) at df = 1e-15 and the double below",
        run: () => {
          for (const n of [nextDown(1e-15), 1e-15]) {
            if (qt(0.4, n, { lowerTail: false }) !== Infinity) return `qt(0.4, ${n}, upper) is not Infinity`;
            for (const p of [0.49999999999999, 0.4999999999999]) {
              const q = qt(p, n, { lowerTail: false });
              const back = pt(q, n, { lowerTail: false });
              if (!(Math.abs(back - p) <= 4e-16)) return `pt(qt(${p}, ${n}, upper)) = ${back}`;
            }
          }
          return undefined;
        },
      },
    ],
  },
  {
    where: "distributions/nt.ts:131, :135",
    fns: "pt, dt, qt with ncp",
    condition: "a = df/2 < 1e-300",
    methods: "log Q(a, x) | log Q(1e-300, x) + log(a / 1e-300); lgamma1p(a)/a | -γ",
    point: "df = 2e-300 at t = 1 and 52, ncp = 40 (Φ(-40) is far below the term of order a)",
    cases: () => {
      const ab = flipPoint((d) => d / 2 < 1e-300, 1.9e-300, 2.1e-300);
      return [1, 52].flatMap((v) => pPairs(`pt(${v}, df, ncp 40)`, (d, t) => pt(v, d, { ncp: 40, ...t }), ab, { tails: TAILS.slice(2) }));
    },
  },
  {
    where: "distributions/nt.ts:598",
    fns: "pt, qt with ncp",
    condition: "k = 2a log(|t|/T0) < 1e-10 (|t| > T0 with the far tail above 1/2)",
    methods: "log(-expm1(-k)) | log(2a) + log(log(|t|/T0)) - k/2",
    point: "t = T0 e^0.005 at df = 2e-8, ncp = 7",
    cases: () => {
      const T0 = 1e10 * 17 * Math.sqrt(1 + 1e-8);
      return pPairs("pt(t, 2e-8, ncp 7)", ptn(2e-8, 7), flipPoint((v) => 2e-8 * (Math.log(v) - Math.log(T0)) < 1e-10, T0 * 1.004, T0 * 1.006));
    },
  },
  {
    where: "distributions/nt.ts:171",
    fns: "pt, dt, qt with ncp",
    condition: "x = a e^w > 1e8 (a + 1) at the peak of formula B with Q (only the width of the peak changes)",
    methods: "xf (x - a - xf) | -xf (1 + (a-1)/x)",
    point:
      "t where x at the peak, a (t δ/(t² + 2a))², is 1e8 (a + 1) at df = 1e-200 and 1e-310, ncp = 1e5 (log of the lower tail " +
      "swept over 1e-9 relative steps of t: the peak found lies within 1e-9 of that)",
    cases: () =>
      [1e-200, 1e-310].map((df) => {
        const a = df / 2;
        const t0 = flipPoint((v) => a * ((v * 1e5) / (v * v + 2 * a)) ** 2 > 1e8 * (a + 1), Math.sqrt(df), 1e10 * Math.sqrt(df))[0];
        return {
          kind: "sweep" as const,
          label: `log pt(t, ${df}, ncp 1e5)`,
          f: (v: number) => pt(v, df, { ncp: 1e5, logP: true }),
          xs: grid(-20, 1, 41).map((k) => t0 * (1 + k * 1e-9)),
        };
      }),
  },
  {
    where: "distributions/nt.ts:716",
    fns: "pt, dt, qt with ncp",
    skip: "a single point, not a boundary: at df = 5e-324, whose half rounds to 0, df = 1e-323 is used",
    condition: "df = 5e-324",
    methods: "-",
    point: "-",
  },
  {
    where: "distributions/t.ts:137, :159, :237",
    fns: "qt",
    skip: "the limit at t = Infinity for steps of the solver, and the normal point as the start where the Cornish-Fisher terms overflow: the same quantile",
    condition: "t = Infinity; Cornish-Fisher start not finite",
    methods: "-",
    point: "-",
  },
];

// ---- distributions/gamma.ts, lognormal.ts and their special functions: the ends of the parameters ----

/** The upper tails, on both scales */
const upperTails: Tail[] = [TAILS[1]!, TAILS[3]!];
/** log P of pgamma(1e-310, shape) as the code forms it (shape log y - lgamma(shape + 1)) */
const tinyLowerLog = (shape: number) => shape * Math.log(1e-310) - lgamma1p(shape);

const GAMMA_ENDS: Entry[] = [
  {
    where: "special/igam.ts:377, :420",
    fns: "pgamma, pchisq, pinvgamma (the upper tail of the gamma)",
    condition: "a < 1e-300 (upper tail)",
    methods: "series or continued fraction | (a / 1e-300) Q(1e-300, x)",
    point: "a = 1e-300 at x = 1e-200, 1 and 30",
    cases: () => [1e-200, 1, 30].flatMap((x) => pPairs(`pgamma(${x}, shape)`, pgShape(x), down(1e-300), { tails: upperTails })),
  },
  {
    where: "distributions/gamma.ts:156, :160",
    fns: "pgamma, pchisq, pinvgamma (upper tail, log scale), y = q / scale below 2^-1022",
    condition: "log P > -1e-10; shape < 1e-300 inside",
    methods: "log(-expm1(log P)) | log(shape) + log(-m) + log1p(log P / 2), m = log y - lgamma1p(shape) / shape (-γ below 1e-300)",
    point: "q = 1e-310: the shape where log P = -1e-10 (1.4e-13), and shape = 1e-300",
    cases: () => [
      ...pPairs("pgamma(1e-310, shape)", pgShape(1e-310), flipPoint((a) => tinyLowerLog(a) > -1e-10, 1e-13, 2e-13), { tails: [TAILS[3]!] }),
      ...pPairs("pgamma(1e-310, shape)", pgShape(1e-310), down(1e-300), { tails: [TAILS[3]!] }),
    ],
  },
  {
    where: "special/loader.ts:387; special/igam.ts:289",
    fns: "pgamma, pchisq, ppois, dgamma (and the other users of the deviance)",
    condition: "x < 1e299 in the deviance x log(x/M) + M - x with M below 1e-250; a > 1e299 for Temme's expansion",
    methods: "double-double product | the same scaled by 2^-64 (exact); series | Temme's expansion",
    point: "a = 1e299 at x = 1e-260 and 1e-300 (log scale; the linear values are 0 and 1)",
    cases: () =>
      [1e-260, 1e-300].flatMap((x) => pPairs(`pgamma(${x}, shape)`, pgShape(x), up(1e299), { tails: TAILS.slice(2) })),
  },
  {
    where: "special/loader.ts:560",
    fns: "dgamma, dchisq, dpois, dinvgamma (linear scale)",
    condition: "x > 2e307 in Loader's density (2 pi x overflows from 2.9e307)",
    methods: "exp(-E) / sqrt(2 pi x) | exp(-E) / sqrt(pi x / 8) / 4",
    point:
      "validity on both sides of shape = 2e307 (one ulp of the shape moves the mode by 1e138 standard deviations, so " +
      "no pair): the density at the mode, x = shape - 1 (= shape), is 1/sqrt(2 pi shape) up to stirlerr (1e-308)",
    cases: () => [
      {
        kind: "check",
        label: "dgamma(shape, shape) at shape = 2e307 and the doubles next to it",
        run: () => {
          for (const a of [nextDown(2e307), 2e307, nextUp(2e307), 1e308]) {
            const v = dgamma(a, a);
            const ref = 1 / (Math.sqrt(2 * Math.PI) * Math.sqrt(a));
            if (!(Math.abs(v - ref) <= 4 * Number.EPSILON * ref)) return `dgamma(${a}, ${a}) = ${v}, not ${ref}`;
          }
          return undefined;
        },
      },
    ],
  },
  {
    where: "special/loader.ts:551",
    fns: "dgamma, dchisq, dpois (log scale)",
    condition: "lgamma1p(x) overflows (x above 2.5e305) where λ < x 2^-1022",
    methods: "-λ + x log λ - lgamma1p(x) | -Infinity",
    point: "validity: the log density at shape 2.5e305 and above is below -1.7e308 or -Infinity (not NaN)",
    cases: () => [
      {
        kind: "check",
        label: "dgamma(1e-3, shape, log) around the overflow of lgamma1p",
        run: () => {
          for (const a of [2.5e305, 2.55e305, 2.6e305, 1e306, 1e308]) {
            const v = dgamma(1e-3, a, { log: true });
            if (!(v < -1.7e308)) return `dgamma(1e-3, ${a}, log) = ${v}`;
          }
          return undefined;
        },
      },
    ],
  },
  {
    where: "distributions/lognormal.ts:39",
    fns: "plnorm, dlnorm",
    condition: "sdlog < 1e300",
    methods: "z = (log x - meanlog) / sdlog in double-double | the same with both scaled by 2^-64",
    point: "sdlog = 1e300 at meanlog -1e302 and -5e299 (z near 100 and 0.5)",
    cases: () =>
      [-1e302, -5e299].flatMap((m) => [
        ...pPairs(`plnorm(2, ${m}, sdlog)`, (sd, t) => plnorm(2, { meanlog: m, sdlog: sd, ...t }), down(1e300)),
        pair(`dlnorm(2, ${m}, sdlog, log)`, (sd) => dlnorm(2, { meanlog: m, sdlog: sd, log: true }), down(1e300)),
      ]),
  },
  {
    where: "distributions/lognormal.ts:157",
    fns: "qlnorm",
    condition: "sdlog >= 1e300",
    methods: "exp(meanlog + sdlog z) with the exponent in double-double | in double (0 or Infinity unless z = 0)",
    point: "sdlog = 1e300 at p = 0.3, 0.5 and 0.7, meanlog 3",
    cases: () => [0.3, 0.5, 0.7].map((p) => pair(`qlnorm(${p}, 3, sdlog)`, (sd) => qlnorm(p, { meanlog: 3, sdlog: sd }), down(1e300))),
  },
];

// ---- beta, F, noncentral F and Tukey: the ends of the parameters ----

const BETA_F_ENDS: Entry[] = [
  {
    where: "special/incbet.ts:657, :662",
    fns: "pbeta, pf, pbinom, pnbinom (the continued fraction for max(a, b) > 1e150)",
    condition: "a divisor above 1e299 (the frame's first shape and the steps from it)",
    methods: "ddDiv, ddMul | the same with the operands scaled by 2^±64",
    point: "b = 1e299 in pbeta(1e-236, 9220.5, b) (the continued fraction in the frame of b, far above the mean)",
    cases: () => pPairs("pbeta(1e-236, 9220.5, b)", (b, t) => pbeta(1e-236, 9220.5, b, t), up(1e299)),
  },
  {
    where: "special/incbet.ts:658, :663",
    fns: "pbeta, pf, pbinom, pnbinom (the continued fraction for max(a, b) > 1e150)",
    condition: "a quotient (a + b)/(a + 1), or an operand of a product, above 1e299",
    methods: "ddDiv, ddMul | the same with the operands scaled by 2^±64",
    point: "(55.1 + b)/56.1 = 1e299 in pbeta(1e-307, 55.1, b) (the continued fraction below the mean)",
    cases: () =>
      pPairs("pbeta(1e-307, 55.1, b)", (b, t) => pbeta(1e-307, 55.1, b, t), flipPoint((b) => 55.1 + b > 1e299 * (55.1 + 1), 5e300, 6e300)),
  },
  {
    where: "special/incbet.ts:75",
    fns: "pbeta, pf, pbinom, pnbinom",
    skip:
      "not reachable as a boundary: the prefactor is below the normal range through c (the smaller shape, or the series " +
      "factor) alone where e > -700; in the series in the frame of a shape below 2e-305, e is between -3.2 and 0, and " +
      "with the smaller shape below 2e-305 times the larger (so the larger above 4.5e4) x <= 0.95 puts e below -2300",
    condition: "e > -700 where the prefactor c e^e (small-shape or huge-shape form) is below 2.2e-305",
    methods: "exp(e + 700) c exp(-700) | exp(e) c",
    point: "-",
  },
  {
    where: "special/incbet.ts:946",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "series in this frame only, its value v > 1/2, and the complement of the series passes the cancellation check",
    methods: "v | 1 - (pseriesComplement)",
    point: "v = 1/2 in pbeta(x, 0.05, 0.5) (x about 3.7e-6; the other frame's series needs x >= 0.05)",
    cases: () => {
      const half = flipPoint((x) => pbeta(x, 0.05, 0.5) > 0.5, 1e-6, 1e-5)[0];
      return pPairs("pbeta(x, 0.05, 0.5)", pb(0.05, 0.5), around(half, 8));
    },
  },
  {
    where: "special/incbet.ts:909, :910",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "a < 1e-300 with b > 1e-280 (b < 1e-300 with a > 1e-280)",
    methods: "the series and continued fractions | the tail of the order of the shape at 1e-300, scaled",
    point: "a = 1e-300 in pbeta(0.3, a, 2) and b = 1e-300 in pbeta(0.3, 2, b); b = 1e-280 in pbeta(0.3, 1e-310, b)",
    cases: () => [
      ...pPairs("pbeta(0.3, a, 2)", (a, t) => pbeta(0.3, a, 2, t), down(1e-300)),
      ...pPairs("pbeta(0.3, 2, b)", (b, t) => pbeta(0.3, 2, b, t), down(1e-300)),
      ...pPairs("pbeta(0.3, 1e-310, b)", (b, t) => pbeta(0.3, 1e-310, b, t), up(1e-280)),
    ],
  },
  {
    where: "special/incbetLargeA.ts:141, :167",
    fns: "pbeta, pf, pbinom, pnbinom (the expansion for large a)",
    condition: "T = a + (b - 1)/2 > 1e299 in u = T l; a > 1e299 in ab/(a + b)",
    methods: "double-double products | the same with the operands scaled by 2^±64",
    point: "b = 1e299 in pbeta(1e-297, 55.1, b) and pbeta(1e-297, 200, b) (the frame of b; 200 is above the huge-shape form)",
    cases: () => [
      ...pPairs("pbeta(1e-297, 55.1, b)", (b, t) => pbeta(1e-297, 55.1, b, t), up(1e299)),
      ...pPairs("pbeta(1e-297, 200, b)", (b, t) => pbeta(1e-297, 200, b, t), up(1e299)),
    ],
  },
  {
    where: "internal/poissonMixture.ts:497, :342 (μ > 1e-290)",
    fns: "dbeta, df, dchisq (with ncp)",
    condition: "λ/2 > 0 (the peak's index from jStar); λ/2 > 1e-290 (the downward weights w (j + 1)/μ)",
    methods: "j = 0 alone | from jStar; w ((j + 1)/μ) | (w (j + 1))/μ with μ scaled",
    point: "λ = 5e-324 against 1e-323 in dbeta(0.5, 1e-310, 1) (log); λ/2 = 1e-290 in dbeta(0.5, 1e-280, 1)",
    cases: () => [
      pair("dbeta(0.5, 1e-310, 1, ncp, log)", (ncp) => dbeta(0.5, 1e-310, 1, { ncp, log: true }), [5e-324, 1e-323]),
      ...dPairs(
        "dbeta(0.5, 1e-280, 1, ncp)",
        (ncp, log) => dbeta(0.5, 1e-280, 1, { ncp, log }),
        flipPoint((ncp) => ncp / 2 > 1e-290, 1.9e-290, 2.1e-290),
      ),
    ],
  },
  {
    where: "distributions/nbeta.ts:605, :764; nchisq.ts:490",
    fns: "dbeta, df, dchisq (with ncp)",
    condition: "λ/2 max(1, r) < 1e-20 (r the ratio of the densities of the first two components)",
    methods: "the Poisson mixture | the central density",
    point: "λ/2 = 1e-20 in dchisq(1, 1) (r = 1), dbeta(0.5, 2, 3) (r = 1.25) and df(1, 3, 5) (r = 1)",
    cases: () => [
      ...dPairs("dchisq(1, 1, ncp)", (ncp, log) => dchisq(1, 1, { ncp, log }), flipPoint((ncp) => ncp / 2 < 1e-20, 1e-20, 3e-20)),
      ...dPairs("dbeta(0.5, 2, 3, ncp)", (ncp, log) => dbeta(0.5, 2, 3, { ncp, log }), flipPoint((ncp) => (ncp / 2) * 1.25 < 1e-20, 1e-20, 3e-20)),
      ...dPairs("df(1, 3, 5, ncp)", (ncp, log) => df(1, 3, 5, { ncp, log }), flipPoint((ncp) => ncp / 2 < 1e-20, 1e-20, 3e-20)),
    ],
  },
  {
    where: "distributions/beta.ts:267",
    fns: "qbeta",
    condition: "the answer's distance y from 1 below 2^-55 (the right half)",
    methods: "search for y | 1",
    point: "p = I(2^-55; 0.5, 3) in qbeta(p, 3, 0.5, upper)",
    cases: () => [pair("qbeta(p, 3, 0.5, upper)", (p) => qbeta(p, 3, 0.5, { lowerTail: false }), around(pbeta(2 ** -55, 0.5, 3)))],
  },
  {
    where: "distributions/f.ts:223",
    fns: "qf",
    condition: "n > 1e20 (m + 2 |log p| + 1e3)² (p the smaller tail)",
    methods: "the search on pf | the quantile of χ²_m / m",
    point: "n = 1e20 (2 - 2 log 0.3 + 1e3)² in qf(0.3, 2, n)",
    cases: () => [pair("qf(0.3, 2, n)", (n) => qf(0.3, 2, n), flipPoint((n) => n > 1e20 * (2 - 2 * Math.log(0.3) + 1e3) ** 2, 1e26, 1.1e26))],
  },
  {
    where: "distributions/f.ts:183, :190",
    fns: "pf, qf (df2 = Inf)",
    condition: "q m below 2^-1022 (the χ² quantile or the answer below 2^-1022), with m above 2^-1022",
    methods: "pgamma(q m, m/2, scale 2) (qgamma / m) | with scale 2/m",
    point: "q = 2^-1023 in pf(q, 2, Inf); the answer 2^-1022 in qf(p, 2, Inf); m = 2^-1022 in pf(0.5, m, Inf)",
    cases: () => [
      ...pPairs("pf(q, 2, Inf)", (q, t) => pf(q, 2, Infinity, t), down(DBL_MIN / 2)),
      pair("qf(p, 2, Inf)", (p) => qf(p, 2, Infinity), around(flipPoint((p) => qchisq(p, 2) / 2 < DBL_MIN, 1e-308, 1e-307)[0])),
      ...pPairs("pf(0.5, m, Inf)", (m, t) => pf(0.5, m, Infinity, t), up(DBL_MIN)),
    ],
  },
  {
    where: "distributions/nbeta.ts:837, :838",
    fns: "qf (with ncp)",
    condition: "the Chernoff bound on log P[F <= MAX] (log P[F >= 2^-1074]) below the target, or below -log 2 for the other tail",
    methods: "the distribution function at the ends, and the search | Infinity (0)",
    point:
      "validity: where F lies beyond the doubles but for the point mass e^(-λ/2) at 0 (subnormal df1, λ = 1.7e243), " +
      "both tails give Infinity; and qf(1e-300, 5, 20, { ncp: 10 }) in both tails maps back to p",
    cases: () => [
      {
        kind: "check",
        label: "qf beyond the doubles, and in an ordinary case",
        run: () => {
          const [m, n, ncp] = [3.69345607573e-313, 1249.223519976018, 1.676553834669942e243];
          const bad: string[] = [];
          for (const lowerTail of [true, false]) {
            const q = qf(5.390320876058269e-11, m, n, { ncp, lowerTail });
            if (q !== Infinity) bad.push(`qf(5.4e-11, ${m}, ${n}, { ncp: ${ncp}, lowerTail: ${lowerTail} }) = ${q}`);
            const back = pf(qf(1e-300, 5, 20, { ncp: 10, lowerTail }), 5, 20, { ncp: 10, lowerTail, logP: true });
            const r = near(back, Math.log(1e-300), 1e-12, `log pf(qf(1e-300, 5, 20, { ncp: 10, lowerTail: ${lowerTail} }))`);
            if (r !== undefined) bad.push(r);
          }
          return bad.length === 0 ? undefined : bad.join("; ");
        },
      },
    ],
  },
  {
    where: "distributions/nbeta.ts:846",
    fns: "qf (with ncp)",
    condition: "n > 1e40 (|log p| + 1) and n > 1e20 (m + 2 |log p| + 1e3 + 4 sqrt((m + λ)(|log p| + 1)))",
    methods: "the search on pf | the quantile of the noncentral χ² limit, divided by m",
    point: "n = 1e40 (1 - log 0.3) in qf(0.3, 2, n, { ncp: 1 }) (the second condition holds from 1e23)",
    cases: () => [
      pair(
        "qf(0.3, 2, n, ncp 1)",
        (n) => qf(0.3, 2, n, { ncp: 1 }),
        flipPoint((n) => n > 1e40 * (-Math.log(0.3) + 1), 2e40, 2.4e40),
      ),
    ],
  },
  {
    where: "distributions/nbeta.ts:864, :884; internal/invert.ts:88",
    fns: "qf (with ncp)",
    condition: "n > 1e15 with m in [1e-10, 1e15]",
    methods:
      "start (m + λ)/m, steps until they stall | start from the quantile of the noncentral χ² limit, stop within " +
      "1e-12 max(1, |log p|) of the target",
    point: "validity: the quantile maps back to p at n = 1e15, the double above it and 1e16 (qf(1e-100, 3, n, { ncp: 2 }), both tails)",
    cases: () => [
      {
        kind: "check",
        label: "pf(qf(p)) = p on both sides of n = 1e15",
        run: () => {
          const bad: string[] = [];
          for (const n of [1e15, nextUp(1e15), 1e16]) {
            for (const lowerTail of [true, false]) {
              const q = qf(1e-100, 3, n, { ncp: 2, lowerTail });
              const back = pf(q, 3, n, { ncp: 2, lowerTail, logP: true });
              const r = near(back, Math.log(1e-100), 1e-12, `log pf(qf(1e-100, 3, ${n}, { ncp: 2, lowerTail: ${lowerTail} }))`);
              if (r !== undefined) bad.push(r);
            }
          }
          return bad.length === 0 ? undefined : bad.join("; ");
        },
      },
    ],
  },
  {
    where: "distributions/tukey.ts:714",
    fns: "ptukey, qtukey (nranges > 1, upper tail, log)",
    condition: "log(1 - W) < -700",
    methods: "log(1 - (1 - (1 - W))^r) | log r + log(1 - W)",
    point: "log(1 - W) = -700 at k = 3, r = 2 (q about 53.1)",
    cases: () => {
      const q0 = flipPoint((q) => ptukey(q, 3, Infinity, { lowerTail: false, logP: true }) < -700, 52, 54)[0];
      const f = (q: number) => ptukey(q, 3, Infinity, { nranges: 2, lowerTail: false, logP: true });
      return [pair("ptukey(q, 3, Inf, nranges 2, upper log)", f, around(q0))];
    },
  },
  {
    where: "special/loader.ts:527; special/incbetPrefactor.ts:63, :104; distributions/beta.ts:40; distributions/nbeta.ts:802",
    fns: "pbeta, dbeta, pf, qf (with ncp), and the other users of the binomial exponent",
    condition: "a deviance, or b log(1 - x), beyond the doubles; q m overflowing in the Chernoff bounds of the noncentral F",
    methods: "double-double sums | [Infinity, 0] (the log -Infinity, the value 0); (q m)/n | q (m/n)",
    point:
      "validity: pbeta(0.998, 55.1, b) and dbeta for b from 1e307 (finite logs) to 6.3e307 (beyond the doubles); where " +
      "q m overflows the bound was NaN before (no decision), so only its validity matters (Chernoff's bound holds for any c)",
    cases: () => [
      {
        kind: "check",
        label: "the logs reach -Infinity, not NaN",
        run: () => {
          const bad: string[] = [];
          for (const b of [1e307, 3e307, 6.3e307, 1e308]) {
            const lq = pbeta(0.998, 55.1, b, { lowerTail: false, logP: true });
            const ld = dbeta(0.998, 55.1, b, { log: true });
            const expected = b * Math.log1p(-0.998);
            if (!(pbeta(0.998, 55.1, b) === 1 && (lq === -Infinity ? expected === -Infinity : Math.abs(lq / expected - 1) < 1e-3))) {
              bad.push(`pbeta(0.998, 55.1, ${b}): ${pbeta(0.998, 55.1, b)}, upper log ${lq}`);
            }
            if (!(dbeta(0.998, 55.1, b) === 0 && (ld === -Infinity ? expected === -Infinity : Math.abs(ld / expected - 1) < 1e-3))) {
              bad.push(`dbeta(0.998, 55.1, ${b}, log) = ${ld}`);
            }
          }
          return bad.length === 0 ? undefined : bad.join("; ");
        },
      },
    ],
  },
  {
    where: "internal/invert.ts:137",
    fns: "every continuous quantile (the polishing in x)",
    condition: "f/F finite",
    methods: "r F/f | the step relative to x, x r F/(x f)",
    point: "f/F = 2/x = MAX in qbeta(lp, 2, 3, log) (P = 6x², the answer about 1.1e-308)",
    cases: () => [
      pair(
        "qbeta(lp, 2, 3, log)",
        (lp) => qbeta(lp, 2, 3, { logP: true }),
        around(flipPoint((lp) => 2 / Math.exp((lp - Math.log(6)) / 2) > Number.MAX_VALUE, -1420, -1410)[0]),
      ),
    ],
  },
];

// ---- distributions/tukey.ts: studentized range ----
// With df = Inf the distribution function is the inner integral itself, so q is the argument w of W(w)

const ptk = (k: number, df: number, nranges = 1) => (q: number, t: Tail) => ptukey(q, k, df, { nranges, ...t });

/**
 * The switch from the linear to the log integral where the upper tail of ptukey(q, k, 10) passes 1e-290: q from
 * Newton steps on log q (P is about c q^-10 there), then each side extrapolated to it by a line (a call takes up to
 * 50 ms, so the exact flip is not searched for). Over 4e-10 relative the curvature of q^-10 is 1e-17
 */
function tukeySwitch290(k: number): ExtrapCase {
  const up = { lowerTail: false };
  let q = 1e30;
  for (let i = 0; i < 3; i++) q *= Math.exp((ptukey(q, k, 10, { ...up, logP: true }) - Math.log(1e-290)) / 10);
  return {
    kind: "extrap",
    label: `ptukey(q, ${k}, 10, upper) at 1e-290`,
    f: (v) => ptukey(v, k, 10, up),
    at: q,
    gap: q * 1e-10,
    linear: true,
    tol: {
      rel: 5e-13,
      why: "below 1e-290 the value is exp of a log near -668, whose ulp (1.1e-13) is the resolution of P (and errors of the log integrand are of that size too)",
    },
  };
}

const TUKEY: Entry[] = [
  {
    where: "distributions/tukey.ts:248, :279, :289, :458, :494",
    fns: "ptukey, qtukey",
    condition:
      "per node of the inner integral: narrow window w max(1, |z|, |z - w|) < 0.5; z > 0 && z - w < 0; a < P/2; lt < -log 2",
    methods: "Gauss-Legendre window | subtraction with first-order correction; direct | log1p forms",
    point:
      "the nodes move with w: sweeps of log ptukey(q, 5, Inf, upper) over q in [45, 46] (1 - W integrated directly) and " +
      "[70, 71] (its log integrated)",
    cases: () => [
      { kind: "sweep", label: "log ptukey(q, 5, Inf, upper), direct", f: (q) => ptukey(q, 5, Infinity, { lowerTail: false, logP: true }), xs: grid(45, 0.025, 41) },
      { kind: "sweep", label: "log ptukey(q, 5, Inf, upper), log integral", f: (q) => ptukey(q, 5, Infinity, { lowerTail: false, logP: true }), xs: grid(70, 0.025, 41) },
    ],
  },
  {
    where: "distributions/tukey.ts:473, :681",
    fns: "ptukey, qtukey",
    condition: "w > 40 (integration range around w/2); log w <= log 40 (interpolant of 1 - W)",
    methods: "interpolant of (1 - W) e^(w²/4) | direct integral on [w/2 - 15, w/2 + 15]",
    point: "q = 40 at k = 5, df = Inf",
    cases: () => pPairs("ptukey(q, 5, Inf)", ptk(5, Infinity), flipPoint((q) => Math.log(q) <= Math.log(40), 39.9, 40.1)),
  },
  {
    where: "distributions/tukey.ts:478, :488",
    fns: "ptukey, qtukey (log)",
    condition: "w > 100",
    methods: "log integral | log(k (k - 1) Φc(w/sqrt(2))) (the correction is below e^-833)",
    point: "q = 100 at k = 5, df = Inf (upper tail, log)",
    cases: () => [pair("ptukey(q, 5, Inf, upper log)", (q) => ptukey(q, 5, Infinity, { lowerTail: false, logP: true }), up(100))],
  },
  {
    where: "distributions/tukey.ts:493",
    fns: "ptukey, qtukey (deep upper tail, log)",
    condition: "lt = log(Φ(z - w)/Φ(z)) < -40 (SUSPECT: first order, relative error about k e^lt / 2 <= k 2e-18 whatever k)",
    methods: "log(-expm1((k - 1) log1p(-e^lt))) | log(k - 1) + lt",
    point:
      "reached only in the log integrals (results below 1e-290). It costs 1e-13 only for nmeans above about 1e5, where " +
      "building the interpolants takes many seconds (14 s at 1e6); tested by the continuity of the switch to the log " +
      "integral (tukey.ts:870) at nmeans = 50 (5 there)",
    cases: () => [tukeySwitch290(50)],
  },
  {
    where: "distributions/tukey.ts:634",
    fns: "ptukey, qtukey",
    condition: "W > 1e-290 (while building the interpolants)",
    methods: "log W integrated | log of W",
    point: "a sweep of log ptukey(q, 50, Inf) over q around 1e-6, where W = 1e-290 (the small-w interpolant)",
    cases: () => {
      const lq0 = Math.log(flipPoint((q) => ptukey(q, 50, Infinity, { logP: true }) < Math.log(1e-290), 1e-8, 1e-3)[0]);
      return [{ kind: "sweep", label: "log ptukey(e^x, 50, Inf)", f: (x) => ptukey(Math.exp(x), 50, Infinity, { logP: true }), xs: grid(lq0 - 0.2, 0.01, 41) }];
    },
  },
  {
    where: "distributions/tukey.ts:665, :673",
    fns: "ptukey, qtukey",
    condition: "log w >= log 20: W = 1 (SUSPECT: assumes nmeans <= 1000, unchecked)",
    methods: "interpolant of log W | 1",
    point:
      "q = 20 at k = 5, df = Inf. 1 - W(20) is about k² Φc(14.1), above 1e-17 only for nmeans > 3e13, where the " +
      "interpolants cannot be built in reasonable time (2 min at 1e10); there the lower tail is formed as 1 - (upper) anyway",
    cases: () => pPairs("ptukey(q, 5, Inf)", ptk(5, Infinity), flipPoint((q) => Math.log(q) >= Math.log(20), 19.9, 20.1)),
  },
  {
    where: "distributions/tukey.ts:667, :668, :679",
    fns: "ptukey, qtukey",
    condition: "log w >= log 0.01 (interpolant of log W; of 1 - W); log w >= log 1e-10 (small-w interpolant)",
    methods: "small-w interpolant + (k - 1) log w (constant below 1e-10) | interpolant of log W; 1 - W | interpolant of 1 - W",
    point: "q = 0.01 and q = 1e-10 at k = 5, df = Inf",
    cases: () => [
      ...pPairs("ptukey(q, 5, Inf)", ptk(5, Infinity), flipPoint((q) => Math.log(q) >= Math.log(0.01), 0.009, 0.011)),
      ...pPairs("ptukey(q, 5, Inf)", ptk(5, Infinity), flipPoint((q) => Math.log(q) >= Math.log(1e-10), 9e-11, 1.1e-10)),
    ],
  },
  {
    where: "distributions/tukey.ts:697",
    fns: "ptukey, qtukey (nranges > 1)",
    condition: "1 - W <= 0.5",
    methods: "1 - W^r | -expm1(r log1p(-(1 - W)))",
    point: "1 - W = 1/2 at k = 3, nranges = 2, df = Inf",
    cases: () => pPairs("ptukey(q, 3, Inf, nranges 2)", ptk(3, Infinity, 2), flipPoint((q) => ptukey(q, 3, Infinity, { lowerTail: false }) <= 0.5, 1, 3)),
  },
  {
    where: "distributions/tukey.ts:750",
    fns: "ptukey, qtukey (finite df)",
    condition: "per node of the outer integral: |v| < 0.5 (series for e^v - 1 - v)",
    methods: "expm1(v) - v | series",
    point: "sweeps of ptukey(q, 5, 10) over q in [3.4, 3.42] and of log ptukey(q, 5, 5, upper) over log q around 1e150",
    cases: () => [
      { kind: "sweep", label: "ptukey(q, 5, 10)", f: (q) => ptukey(q, 5, 10), xs: grid(3.4, 5e-4, 41) },
      // (50 ms a call in the log integral)
      {
        kind: "sweep",
        label: "log ptukey(e^x, 5, 5, upper)",
        f: (x) => ptukey(Math.exp(x), 5, 5, { lowerTail: false, logP: true }),
        xs: grid(Math.log(1e150) - 0.4, 0.1, 9),
      },
    ],
  },
  {
    where: "distributions/tukey.ts:872, :874",
    fns: "ptukey, qtukey (finite df)",
    condition: "df = Inf value of the guessed side > 0.5; integrated side > 0.5 (then the other side)",
    methods: "integrate the guessed tail | the other tail",
    point: "q where ptukey(q, 5, Inf, upper) = 1/2, and where ptukey(q, 5, 10, upper) = 1/2",
    cases: () => [
      ...pPairs("ptukey(q, 5, 10)", ptk(5, 10), flipPoint((q) => ptukey(q, 5, Infinity, { lowerTail: false }) > 0.5, 2, 3.5), { flat: true }),
      ...pPairs("ptukey(q, 5, 10)", ptk(5, 10), flipPoint((q) => ptukey(q, 5, 10, { lowerTail: false }) > 0.5, 2, 3.5), { flat: true }),
    ],
  },
  {
    where: "distributions/tukey.ts:881",
    fns: "ptukey, qtukey (finite df)",
    condition: "smaller tail < 1e-290",
    methods: "linear integral | log integral",
    point: "upper tail = 1e-290 at k = 5, df = 10 (see also tukey.ts:493, at nmeans = 50)",
    cases: () => [tukeySwitch290(5)],
  },
  {
    where: "distributions/tukey.ts:908, :923",
    fns: "qtukey",
    condition: "linear target > 1e-290",
    methods: "residual from the log | log of the linear ratio",
    point: "p = 1e-290 (upper tail) at k = 5, df = Inf and df = 10",
    cases: () => [
      pair("qtukey(p, 5, Inf, upper)", (p) => qtukey(p, 5, Infinity, { lowerTail: false }), up(1e-290)),
      pair("qtukey(p, 5, 10, upper)", (p) => qtukey(p, 5, 10, { lowerTail: false }), up(1e-290)),
    ],
  },
];

// ---- Other public special functions (special/extra.ts, special/log1p.ts) ----

const EXTRA: Entry[] = [
  {
    where: "special/extra.ts:63, :65",
    fns: "gammainc",
    condition: "Gamma(a) P a normal number (and Gamma(a) finite)",
    methods: "lgamma(a) + log P, or the smaller tail from its own series in logs | the product",
    point: "lower = DBL_MIN at a = 2 (x about 2.1e-154); a where Gamma(a) overflows (171.62) at x = 150",
    cases: () => {
      const g = (part: "lower" | "logLower" | "upper" | "logUpper", a: number) => (x: number) => gammainc(x, a)[part];
      const ga = (part: "logLower" | "logUpper", x: number) => (a: number) => gammainc(x, a)[part];
      const ab = flipPoint((x) => pgamma(x, 2) > DBL_MIN, 1e-155, 1e-153);
      const aa = flipPoint((a) => Number.isFinite(gamma(a)), 171, 172);
      return [
        pair("gammainc(x, 2).lower", g("lower", 2), ab),
        pair("gammainc(x, 2).logLower", g("logLower", 2), ab),
        pair("gammainc(150, a).logLower", ga("logLower", 150), aa),
        pair("gammainc(150, a).logUpper", ga("logUpper", 150), aa),
      ];
    },
  },
  {
    where: "special/extra.ts:123, :124",
    fns: "erfinv",
    condition: "|y| >= 0.5; |y| < 1e-8",
    methods: "erfcinv(1 - |y|) refined by Newton | series y sqrt(pi)/2 (1 + pi y²/12) | erfcinv(1 - |y|)",
    point: "y = 0.5 and y = 1e-8",
    cases: () => [pair("erfinv(y)", (y) => erfinv(y), down(0.5)), pair("erfinv(y)", (y) => erfinv(y), down(1e-8))],
  },
  {
    where: "special/log1p.ts:91",
    fns: "log1pexp",
    condition: "x <= -37; x <= 18; x <= 33.3",
    methods: "e^x | log1p(e^x) | x + e^-x | x",
    point: "x = -37, 18, 33.3",
    cases: () => [-37, 18, 33.3].map((x) => pair("log1pexp(x)", (v) => log1pexp(v), up(x))),
  },
];

// ---- Switches added for extreme parameters (test/extremeParameters.test.ts) ----

/** η of Temme's expansion of P(a, x), with the sign of x - a */
const temmeEta = (a: number, x: number): number => {
  const s = (x - a) / a;
  return Math.sign(s) * Math.sqrt(2 * (s - Math.log1p(s)));
};

const EXTREME: Entry[] = [
  {
    where: "special/igam.ts:289 (:386, :433)",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "a > 200 && (|x - a|/a < 1e-3 || a > 1e299)",
    methods: "series / continued fraction | Temme's expansion in the form e^-bd0(a, x) (erfcx(y)/2 ± S/sqrt(2π a))",
    point: "x = a (1 ± 1e-3) at a = 1e10 (100 standard deviations); a = 1e299 at x = 0.99e299",
    cases: () => {
      const rel = (a: number) => (x: number) => Math.abs(x - a) / a < 1e-3;
      return [
        ...pPairs("pgamma(x, 1e10)", pg(1e10), flipPoint(rel(1e10), 0.998e10, 0.9995e10)),
        ...pPairs("pgamma(x, 1e10)", pg(1e10), flipPoint(rel(1e10), 1.0005e10, 1.002e10)),
        ...pPairs("pgamma(0.99e299, a)", pgShape(0.99e299), up(1e299)),
      ];
    },
  },
  {
    where: "special/igam.ts:303",
    fns: "pgamma, pchisq, ppois",
    condition: "a > 1e299 && |η| > 0.1",
    methods: "c_0(η) by its power series | 1/(λ - 1) - 1/η",
    point: "η = ±0.1 at a = 2^1000",
    cases: () => {
      const a = 2 ** 1000;
      return [
        ...pPairs("pgamma(x, 2^1000)", pg(a), flipPoint((x) => Math.abs(temmeEta(a, x)) > 0.1, 0.85 * a, 0.95 * a)),
        ...pPairs("pgamma(x, 2^1000)", pg(a), flipPoint((x) => Math.abs(temmeEta(a, x)) > 0.1, 1.05 * a, 1.15 * a)),
      ];
    },
  },
  {
    where: "special/igam.ts:306",
    fns: "pgamma, pchisq, ppois",
    condition: "bd0(a, x) > 2000 (the smaller tail by Temme's form)",
    methods: "e^-E B | 0",
    point: "-",
    skip: "both sides are 0 on the linear scale (e^-2000 underflows); the log is the same expression on both sides",
  },
  {
    where: "special/igam.ts:138",
    fns: "pgamma, pchisq, ppois",
    condition: "x > 1e20 (continued fraction for Q)",
    methods: "convergents with rescaling | modified Lentz method",
    point: "x = 1e20 at a = 1e19",
    cases: () => pPairs("pgamma(x, 1e19)", pg(1e19), up(1e20)),
  },
  {
    where: "special/loader.ts:78",
    fns: "every density, pgamma, pbeta",
    condition: "max(x, M) > 1e299 && min(x, M) > 1e-250",
    methods: "bd0(x, M) | 2^64 bd0(x 2^-64, M 2^-64)",
    point: "dpois(9.9e298, λ) at λ = 1e299 (log scale)",
    cases: () => [pair("dpois(9.9e298, λ, log)", (l) => dpois(9.9e298, l, { log: true }), up(1e299))],
  },
  {
    where: "special/loader.ts:407, :410",
    fns: "dbinom, dbeta, df, pbeta, pf, pnbinom",
    condition: "n > 1e299 (n scaled in the product n p); n p >= 1e-290",
    methods: "bd0(x, n p) | n p scaled by 2^-64 and back; x (log x - log n - log p) + n p - x | bd0(x, n p)",
    point: "dbinom(1e298, n, 0.1) at n = 1e299; dbinom(1, 10, p) at 10 p = 1e-290 (log scale)",
    cases: () => [
      pair("dbinom(1e298, n, 0.1, log)", (n) => dbinom(1e298, n, 0.1, { log: true }), up(1e299)),
      pair("dbinom(1, 10, p, log)", (p) => dbinom(1, 10, p, { log: true }), flipPoint((p) => 10 * p >= 1e-290, 5e-292, 5e-291)),
    ],
  },
  {
    where: "special/loader.ts:428",
    fns: "dpois, dgamma, dbinom, dbeta",
    condition: "e > 2000 (linear scale)",
    methods: "exp(700 - e) (1 - e_low) exp(-700) | 0",
    point: "-",
    skip: "both sides are 0 (e^-2000 underflows); the guard only keeps 1 - e_low, with e_low half an ulp of e, from giving -0",
  },
  {
    where: "special/loader.ts:440",
    fns: "dnbinom, dbinom, dbeta at x = 0 or n - x = 0",
    condition: "n > 1e299 (the products n p, n q and n log p, n log q)",
    methods: "double-double product | the same with n scaled by 2^-64 and back",
    point: "dnbinom(0, n, prob) at n = 1e299, prob = 1 - 2^-36 (n q, by the deviance) and 0.5 (n log p) (log scale)",
    cases: () => [
      pair("dnbinom(0, n, 1 - 2^-36, log)", (n) => dnbinom(0, n, { prob: 1 - 2 ** -36, log: true }), up(1e299)),
      pair("dnbinom(0, n, 0.5, log)", (n) => dnbinom(0, n, { prob: 0.5, log: true }), up(1e299)),
    ],
  },
  {
    where: "special/loader.ts:448",
    fns: "dnbinom, dbinom, dbeta at x = 0 or n - x = 0",
    condition: "log probability < -2000 (linear scale)",
    methods: "exp(l) (1 + l_low) | 0",
    point: "-",
    skip: "both sides are 0 (e^-2000 underflows); the guard only keeps 1 + l_low, with l_low up to half an ulp of l, from giving -0",
  },
  {
    where: "special/incbet.ts:652",
    fns: "pbeta, pf, pbinom, pnbinom",
    condition: "max(a, b) > 1e150 (continued fraction)",
    methods: "partial numerators as products over products | quotients first",
    point: "pbeta(0.5, a, 5) at a = 1e150 (the upper tail, by the continued fraction in the frame of a)",
    cases: () => pPairs("pbeta(0.5, a, 5)", (a, t) => pbeta(0.5, a, 5, t), up(1e150)),
  },
  {
    where: "special/incbetTemme.ts:164, :186",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "r = a + b > 1e299 (r x scaled); a b overflows (m = a (b / r))",
    methods: "r x | 2^64 ((r 2^-64) x); a b / r | a (b / r)",
    point: "pbeta(0.4999, a, a) at a = 5e298 (r = 1e299) and at a = 1.3407807929942596e154 (a^2 overflows)",
    cases: () => [
      ...pPairs("pbeta(0.4999, a, a)", (a, t) => pbeta(0.4999, a, a, t), flipPoint((a) => 2 * a > 1e299, 4e298, 6e298)),
      ...pPairs("pbeta(0.4999, a, a)", (a, t) => pbeta(0.4999, a, a, t), flipPoint((a) => !Number.isFinite(a * a), 1.3e154, 1.4e154)),
    ],
  },
  {
    where: "special/incbetLargeA.ts:137",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "y = 1 - x < 1e-15",
    methods: "l = -log x by ddLog | y + y^2/2",
    point: "pnbinom(1e16, 5, prob) at prob = 1e-15 (I_q(1e16 + 1, 5) with y = prob, u = 10; in pbeta, 1 - x moves by 10% per ulp there)",
    cases: () =>
      pPairs("pnbinom(1e16, 5, prob)", (p, t) => pnbinom(1e16, 5, { prob: p, ...t }), flipPoint((p) => p < 1e-15, 5e-16, 2e-15)),
  },
  {
    where: "special/incbet.ts:934, special/incbetLargeA.ts:130, :226",
    fns: "pbeta, pf, pnbinom",
    condition: "x rounds to 1 in the frame of the large parameter (b up to 1e4, b < 1e-8 a): the expansion also for b > 40, u > 500, and on the log scale below 1e-290",
    methods: "continued fraction (NaN there) | expansion",
    point: "-",
    skip:
      "reached only where 1 - x is below ε in the frame of a, where the methods of the other side do not apply (they gave NaN " +
      "or -Infinity); test/extremeParameters.test.ts checks the values against the gamma limit",
  },
  {
    where: "distributions/beta.ts:33",
    fns: "dbeta, qbeta",
    condition: "(a + b) min(x, 1 - x) < 2^-1022",
    methods: "Loader's form | (a - 1) log x + (b - 1) log(1 - x) - log B(a, b)",
    point: "dbeta(x, 2, 3) at 5 x = 2^-1022 (x subnormal)",
    cases: () => dPairs("dbeta(x, 2, 3)", (x, log) => dbeta(x, 2, 3, { log }), flipPoint((x) => 5 * x < DBL_MIN, 4e-309, 5e-309)),
  },
  {
    where: "distributions/beta.ts:215",
    fns: "qbeta",
    condition: "b > 1e10 && b > 1e10 a (left half)",
    methods: "starting value from the tails or A&S 26.5.22 | qgamma(p, a) / b",
    point: "-",
    skip: "a starting value: the search ends at the same quantile",
  },
  {
    where: "distributions/negbinomial.ts:137",
    fns: "qnbinom",
    condition: "starting value beyond the doubles (prob < 0.05)",
    methods: "integer search | Infinity",
    point: "-",
    skip: "the quantile itself is beyond the largest double there",
  },
  {
    where: "distributions/tukey.ts:726, :776",
    fns: "ptukey, qtukey",
    condition: "max((k-1) r, q^2, 1)^2 < 1e-17 df",
    methods: "outer integral over the χ density | the df = ∞ value",
    point: "df = 1.6e18 at q = 1, nmeans = 5",
    cases: () => pPairs("ptukey(1, 5, df)", (df, t) => ptukey(1, 5, df, t), flipPoint((df) => 16 < 1e-17 * df, 1e18, 1e19)),
  },
  {
    where: "distributions/tukey.ts:511",
    fns: "ptukey, qtukey",
    condition: "ε |M| > 1 (log outer integral)",
    methods: "M + log ∫ exp(lf - M) | M",
    point: "-",
    skip:
      "the log of the integral (a few dozen at most) is then below the rounding of M (above 4.5e15); reached for huge df with " +
      "q above about 1e8",
  },
  {
    where: "distributions/tukey.ts:150, :169, :943; internal/discrete.ts:65, :93; internal/invert.ts:145",
    fns: "ptukey, qtukey, qpois, qbinom, qnbinom, every continuous quantile",
    condition:
      "integrals: error at the noise level of the integrand, or 256 intervals; searches: first step the spacing of the " +
      "doubles, stop at Infinity or past the doubles; Newton's polish leaving |r| > 1e-9",
    methods: "-",
    point: "-",
    skip:
      "bounds on work and the search path: they do not change converged values. The polish fallback (bisection in x) is " +
      "reached only where the distribution function rises within a few ulps (qchisq at df = 6e234, qbeta at shapes 1e190)",
  },
];

// ---- Switches for subnormal, overflowing and huge intermediates (the location-scale and extraDistr families, the
// gamma family, t) ----

/** log of the lower probability below which qgamma's answer (standardized) is below 2^-1022 (mirror of gamma.ts) */
const tinyGammaLog = (shape: number): number => shape * (-1022 * Math.LN2) - lgamma1p(shape);


const SUBNORMAL: Entry[] = [
  {
    where: "distributions/exponential.ts:35",
    fns: "dexp",
    condition: "exp(-rate x) < 2^-1022 and rate > 1",
    methods: "rate exp(-rate x) | exp(log rate - rate x) in double-double",
    point: "rate x = log(2^1022) at rate = 1e300",
    cases: () => [
      pair("dexp(x, 1e300)", (x) => dexp(x, { rate: 1e300 }), around(flipPoint((x) => Math.exp(-1e300 * x) < DBL_MIN, 7e-298, 7.2e-298)[0])),
    ],
  },
  {
    where: "distributions/gamma.ts:107, :151",
    fns: "dgamma, pgamma, dchisq, pchisq, dinvgamma, pinvgamma",
    condition: "y = x / scale < 2^-1022 (x > 0)",
    methods: "Loader's density, incomplete gamma | y^shape / Γ(shape + 1) and y^shape / (Γ(shape) x), log y = log x - log scale",
    point: "x = 2^-1022 at shapes 0.5 and 2; x = 2^-1022 1e10 at scale 1e10",
    cases: () => {
      const ab = flipPoint((x) => x / 1e10 < DBL_MIN, 1e-298, 1e-297);
      return [
        ...pPairs("pgamma(x, 0.5)", pg(0.5), down(DBL_MIN)),
        ...pPairs("pgamma(x, 2)", pg(2), down(DBL_MIN), { tails: TAILS.slice(2) }),
        ...dPairs("dgamma(x, 0.5)", (x, log) => dgamma(x, 0.5, { log }), down(DBL_MIN)),
        ...dPairs("dgamma(x, 2)", (x, log) => dgamma(x, 2, { log }), down(DBL_MIN)),
        ...pPairs("pgamma(x, 0.5, scale 1e10)", (x, t) => pgamma(x, 0.5, { scale: 1e10, ...t }), ab),
        ...dPairs("dgamma(x, 0.5, scale 1e10)", (x, log) => dgamma(x, 0.5, { scale: 1e10, log }), ab),
      ];
    },
  },
  {
    where: "distributions/gamma.ts:185",
    fns: "qgamma, qchisq, qinvgamma, qbeta (its gamma start)",
    condition: "log P < shape log(2^-1022) - lgamma(shape + 1) (the standardized quantile below 2^-1022)",
    methods: "Newton | (P Γ(shape + 1))^(1/shape) in logs, scaled in logs",
    point: "that P at shapes 0.5 and 2 (lower tail; 2 only on the log scale), from the upper tail on the log scale at 0.5, and at shape 1e-4 from the upper tail (Q near 0.07)",
    cases: () => {
      const out: Case[] = [];
      for (const shape of [0.5, 2]) {
        const lp0 = tinyGammaLog(shape);
        out.push(pair(`qgamma(lp, ${shape}, log)`, (lp) => qgamma(lp, shape, { logP: true }), flipPoint((lp) => lp < lp0, lp0 - 1, lp0 + 1)));
      }
      const lp0 = tinyGammaLog(0.5);
      // the upper tail given on the log scale, near 0: the lower tail is -expm1(lp)
      out.push(pair("qgamma(lp, 0.5, upper log)", (lp) => qgamma(lp, 0.5, { lowerTail: false, logP: true }), flipPoint((lp) => Math.log(-Math.expm1(lp)) < lp0, -1e-150, -1e-160)));
      out.push(pair("qgamma(p, 0.5)", (p) => qgamma(p, 0.5), flipPoint((p) => Math.log(p) < lp0, Math.exp(lp0) / 2, Math.exp(lp0) * 2)));
      out.push(pair("qgamma(p, 0.5, scale 1e100)", (p) => qgamma(p, 0.5, { scale: 1e100 }), flipPoint((p) => Math.log(p) < lp0, Math.exp(lp0) / 2, Math.exp(lp0) * 2)));
      const lq = tinyGammaLog(1e-4);
      out.push(pair("qgamma(q, 1e-4, upper)", (q) => qgamma(q, 1e-4, { lowerTail: false }), flipPoint((q) => Math.log1p(-q) < lq, 0.01, 0.2)));
      return out;
    },
  },
  {
    where: "distributions/gamma.ts:92, :121",
    fns: "dgamma (log), qgamma (density in Newton steps)",
    condition: "shape / x normal and finite (shape < 1)",
    methods: "log shape - log x | log(shape / x)",
    point: "shape / x = 2^-1022 at shape 1e-300, scale 1e8 (x about 4.5e7)",
    cases: () => [
      pair("dgamma(x, 1e-300, scale 1e8, log)", (x) => dgamma(x, 1e-300, { scale: 1e8, log: true }), flipPoint((x) => 1e-300 / x >= DBL_MIN, 4e7, 5e7)),
    ],
  },
  {
    where: "distributions/gamma.ts:122, :130; invgamma.ts:63",
    fns: "dgamma, dchisq, dinvgamma (log)",
    condition: "the log density below half of the log of the Poisson (gamma) factor (the two logs cancelling)",
    methods: "sum of the logs | log of the linear value",
    point: "dgamma(x, 2, scale 1e-200, log) at y = x / scale near 313; dinvgamma(x, 2, beta 1e-300, log) at beta / x near 475",
    cases: () => [
      pair(
        "dgamma(x, 2, scale 1e-200, log)",
        (x) => dgamma(x, 2, { scale: 1e-200, log: true }),
        flipPoint((x) => Math.abs(dgamma(x, 2, { scale: 1e-200, log: true })) < 0.5 * Math.abs(dpois(1, x / 1e-200, { log: true })), 2.5e-198, 4e-198),
      ),
      pair(
        "dinvgamma(x, 2, beta 1e-300, log)",
        (x) => dinvgamma(x, 2, { beta: 1e-300, log: true }),
        flipPoint((x) => Math.abs(dinvgamma(x, 2, { beta: 1e-300, log: true })) < 0.5 * Math.abs(dgamma(1e-300 / x, 2, { log: true })), 1e-303, 3e-303),
      ),
    ],
  },
  {
    where: "distributions/invgamma.ts:41, :79",
    fns: "dinvgamma, pinvgamma",
    condition: "z = beta / x < 2^-1022",
    methods: "gamma functions at z (double-double z) | in logs (pgamma with scale x, log beta - log x)",
    point: "x = 2^1022 at beta = 1, alpha 0.5 and 2",
    cases: () =>
      [0.5, 2].flatMap((alpha) => [
        ...pPairs(`pinvgamma(x, ${alpha})`, (x, t) => pinvgamma(x, alpha, t), up(2 ** 1022)),
        ...dPairs(`dinvgamma(x, ${alpha})`, (x, log) => dinvgamma(x, alpha, { log }), up(2 ** 1022)),
      ]),
  },
  {
    where: "distributions/invgamma.ts:58",
    fns: "dinvgamma",
    condition: "f_Gamma(z) and f_Gamma(z) z normal",
    methods: "exp of the log density | f_Gamma(z) z / x",
    point: "f_Gamma(z) = 2^-1022 at alpha = 2 (z near 715, x = 1 / z)",
    cases: () => [
      pair("dinvgamma(x, 2)", (x) => dinvgamma(x, 2), flipPoint((x) => dgamma(1 / x, 2) >= DBL_MIN, 1 / 730, 1 / 700)),
    ],
  },
  {
    where: "distributions/invgamma.ts:52, :85",
    fns: "dinvgamma, pinvgamma",
    condition: "alpha <= 1e15",
    methods: "the functions at the rounded z | corrected to first order for the low part of z",
    point: "alpha = 1e15 at x = 1e-15 (z = 1e15, the centre)",
    cases: () =>
      pPairs("pinvgamma(1e-15, alpha)", (a, t) => pinvgamma(1e-15, a, t), up(1e15), {
        tol: {
          rel: 1e-8,
          why: "discontinuous by design: the jump is the first-order term for the low part of z, up to eps sqrt(alpha) relative near the centre",
        },
      }),
  },
  {
    where: "distributions/invgamma.ts:91",
    fns: "pinvgamma (log)",
    condition: "|log P| < 1e8",
    methods: "log P | log P + f / P zl",
    point: "log Q_Gamma(z, 2) = -1e8 (z near 1e8 + log z)",
    cases: () => [
      pair("pinvgamma(x, 2, log)", (x) => pinvgamma(x, 2, { logP: true }), flipPoint((x) => Math.abs(pgamma(1 / x, 2, { lowerTail: false, logP: true })) < 1e8, 0.9e-8, 1.1e-8)),
    ],
  },
  {
    where: "distributions/invgamma.ts:104",
    fns: "qinvgamma",
    condition: "the gamma quantile below 2^-1022 (gamma.ts:166 for 1 - p)",
    methods: "beta / qgamma | exp(log beta - log of the gamma quantile)",
    point: "the gamma lower tail at the flip of gamma.ts:166 at alpha = 0.5, beta = 1e-300",
    cases: () => {
      const lp0 = tinyGammaLog(0.5);
      const o = { beta: 1e-300, lowerTail: false };
      return [
        pair("qinvgamma(p, 0.5, upper)", (p) => qinvgamma(p, 0.5, o), flipPoint((p) => Math.log(p) < lp0, Math.exp(lp0) / 2, Math.exp(lp0) * 2)),
        pair("qinvgamma(lp, 0.5, upper log)", (lp) => qinvgamma(lp, 0.5, { ...o, logP: true }), flipPoint((lp) => lp < lp0, lp0 - 1, lp0 + 1)),
      ];
    },
  },
  {
    where: "distributions/t.ts:220",
    fns: "qt",
    condition: "log t0 > 709.79, or > 709.77 with the tail at the largest double above the target",
    methods: "Newton | ±Infinity",
    point: "-",
    skip: "the quantile passes the largest double there: Infinity on one side by definition",
  },
  {
    where: "distributions/t.ts:138, :159",
    fns: "pt, qt",
    condition: "n < 1e-15",
    methods: "incomplete beta | 1/2 - (n/2) asinh(t / sqrt(n))",
    point: "n = 1e-15 at t = 0.001, 3 and 1e100",
    cases: () => [1e-3, 3, 1e100].flatMap((v) => pPairs(`pt(${v}, n)`, (n, t) => pt(v, n, t), down(1e-15))),
  },
  {
    where: "distributions/t.ts:112",
    fns: "pt",
    condition: "t / sqrt(n) < 1e300 (n < 1e-15)",
    methods: "log(2 r) | asinh(r)",
    point: "t = 1e290 at n = 1e-20",
    cases: () => pPairs("pt(t, 1e-20)", (v, t) => pt(v, 1e-20, t), flipPoint((v) => v / 1e-10 < 1e300, 9e289, 1.1e290)),
  },
  {
    where: "distributions/t.ts:123",
    fns: "pt, qt",
    condition: "t > 1e150 || n > 1e290",
    methods: "x and 1 - x as double-double quotients | the same after scaling t^2 and n by a power of 2",
    point: "t = 1e150 at n = 1e100; n = 1e290 at t = 2e145",
    cases: () => [
      ...pPairs("pt(t, 1e100)", (v, t) => pt(v, 1e100, t), down(1e150)),
      ...pPairs("pt(2e145, n)", (n, t) => pt(2e145, n, t), down(1e290)),
    ],
  },
  {
    where: "distributions/arcsine.ts:58",
    fns: "parcsine",
    condition: "z < 1e-20 (z the distance to the nearer end over b - a)",
    methods: "pbeta(z, 1/2, 1/2) | (2/π) sqrt(d) / sqrt(w), its log from log d - log w",
    point: "q = 1e-20 at a = 0, b = 1; q = -1e-20 at a = -1, b = 0",
    cases: () => [
      ...pPairs("parcsine(q, 0, 1)", (q, t) => parcsine(q, t), down(1e-20)),
      ...pPairs("parcsine(q, -1, 0)", (q, t) => parcsine(q, { a: -1, b: 0, ...t }), up(-1e-20)),
    ],
  },
  {
    where: "distributions/arcsine.ts:92",
    fns: "qarcsine",
    condition: "log of the lower or upper probability < -40",
    methods: "a + w qbeta(p, 1/2, 1/2) | w (π p / 2)^2 from logs",
    point: "p = e^-40 on either side at a = 0, b = 1",
    cases: () =>
      TAILS.map((t) => ({
        kind: "pair" as const,
        label: `qarcsine(p, ${tailName(t)})`,
        f: (p: number) => qarcsine(p, t),
        ...toAB(t.logP ? down(-40) : flipPoint((p) => Math.log(p) < -40, 1e-18, 1e-17)),
      })),
  },
  {
    where: "distributions/lognormal.ts:127",
    fns: "dlnorm",
    condition: "exp(-z^2/2) < 2^-1022",
    methods: "the product exp(-z^2/2) / (sqrt(2π) sdlog x) | exp of the whole exponent in double-double",
    point: "z^2/2 = 708.4 at meanlog 0, sdlog 1 (x = e^-37.64)",
    cases: () => [pair("dlnorm(x)", (x) => dlnorm(x), around(flipPoint((x) => Math.exp(-(Math.log(x) ** 2) / 2) >= DBL_MIN, 4e-17, 6e-17)[0]))],
  },
  {
    where: "distributions/lognormal.ts:126",
    fns: "dlnorm",
    condition: "exp(-z^2/2) underflows to 0",
    methods: "as above | 0",
    point: "-",
    skip:
      "discontinuous by design, as R: the density is 0 there even where 1 / x would bring it back into range (fixture " +
      "dlnorm(1e-100, -100, 3) is 0)",
  },
  {
    where: "internal/ddexp.ts:59",
    fns: "every function using standardizeDD (dinvgamma, pinvgamma, dweibull, pweibull, dlogis, ...)",
    condition: "|x - location| < 2^-900",
    methods: "remainder x - q1 scale | the same for everything times 2^600, scaled back",
    point: "x = 2^-900 at shape 2, scale 1e-271 (x / scale near 1.2)",
    cases: () => [
      ...pPairs("pweibull(x, 2, scale 1e-271)", (x, t) => pweibull(x, 2, { scale: 1e-271, ...t }), down(2 ** -900)),
      ...dPairs("dweibull(x, 2, scale 1e-271)", (x, log) => dweibull(x, 2, { scale: 1e-271, log }), down(2 ** -900)),
    ],
  },
  {
    where: "internal/ddexp.ts:67",
    fns: "every function using standardizeDD (dinvgamma, pinvgamma, dlogis, ...)",
    condition: "q1 scale overflows (x / scale near the largest double)",
    methods: "remainder x - q1 scale | the same for x 2^-40, scaled back",
    point:
      "pinvgamma(x, 2, { beta: 1.797e308, log }) for x from 3.8905 over 61 steps of 2^-46 (z = beta / x near 4.6e307; the " +
      "log, about -z, scaled by 1e-300 so that the fit through the neighbours does not overflow)",
    cases: () => [
      {
        kind: "sweep",
        label: "pinvgamma(x, 2, beta max, log)",
        f: (x) => pinvgamma(x, 2, { beta: Number.MAX_VALUE, logP: true }) * 1e-300,
        xs: grid(3.8905, 2 ** -46, 61),
      },
    ],
  },
  // weibull.ts, pareto.ts, triangular.ts, kumaraswamy.ts: the switches for subnormal and overflowing intermediates
  {
    where: "distributions/weibull.ts:39",
    fns: "dweibull, pweibull, qweibull",
    condition: "x / scale normal and finite, x < 1e300",
    methods: "log x - log scale | log of the double-double quotient",
    point: "x / scale = 2^-1022 at scale 1e10 (shape 0.5); x = 1e300 at scale 1e290 (shape 0.05)",
    cases: () => {
      const ab = flipPoint((x) => x / 1e10 >= DBL_MIN, 1e-298, 1e-297);
      return [
        ...pPairs("pweibull(x, 0.5, scale 1e10)", (x, t) => pweibull(x, 0.5, { scale: 1e10, ...t }), ab),
        ...dPairs("dweibull(x, 0.5, scale 1e10)", (x, log) => dweibull(x, 0.5, { scale: 1e10, log }), ab),
        ...pPairs("pweibull(x, 0.05, scale 1e290)", (x, t) => pweibull(x, 0.05, { scale: 1e290, ...t }), down(1e300)),
        ...dPairs("dweibull(x, 0.05, scale 1e290)", (x, log) => dweibull(x, 0.05, { scale: 1e290, log }), down(1e300)),
      ];
    },
  },
  {
    where: "distributions/weibull.ts:46",
    fns: "dweibull, pweibull",
    condition: "shape < 1e300 and the product finite",
    methods: "the double product | shape log u in double-double",
    point: "-",
    skip:
      "both sides give the same value: log u is 0 or at least 1.1e-16 in magnitude, so shape log u near shape = 1e300 is 0 " +
      "or beyond 1e284, and t is 1, 0 or Infinity on both sides",
  },
  {
    where: "distributions/weibull.ts:85",
    fns: "dweibull",
    condition: "E < -2500",
    methods: "the forms below | 0",
    point: "-",
    skip: "both sides are 0: |log(shape / scale)| < 1455, so the density is below e^-1045",
  },
  {
    where: "distributions/weibull.ts:86",
    fns: "dweibull",
    condition: "shape / scale normal and finite, E > -708",
    methods: "exp(log(shape / scale) + E) | (shape / scale) exp(E)",
    point: "x = 708 at shape = scale = 1 (E = -x); scale = 2^1022 at shape 1, x = 1e300",
    cases: () => [
      pair("dweibull(x, 1)", (x) => dweibull(x, 1), down(708)),
      pair("dweibull(1e300, 1, scale)", (s) => dweibull(1e300, 1, { scale: s }), up(2 ** 1022)),
    ],
  },
  {
    where: "distributions/weibull.ts:104",
    fns: "pweibull (lower log)",
    condition: "shape log u < -700",
    methods: "log(1 - exp(-t)) | log t",
    point: "q = e^-700 at shape = scale = 1",
    cases: () => [pair("pweibull(q, 1, lower log)", (q) => pweibull(q, 1, { logP: true }), around(flipPoint((q) => Math.log(q) < -700, 1e-305, 1e-303)[0]))],
  },
  {
    where: "distributions/weibull.ts:135",
    fns: "qweibull",
    condition: "(-log P[X > x])^(1/shape) normal and finite",
    methods: "exp(log scale + log(-lu) / shape) | scale times it",
    point: "p = 2^-1022 at shape 1, scale 1e100",
    cases: () => [pair("qweibull(p, 1, scale 1e100)", (p) => qweibull(p, 1, { scale: 1e100 }), down(DBL_MIN))],
  },
  {
    where: "distributions/pareto.ts:36, :38",
    fns: "dpareto, ppareto",
    condition: "x < 1e308 and x / b finite",
    methods: "log x - log b | double-double x / b",
    point: "x = 1e308 at b = 1; x / b overflowing at b = 0.5 (a = 0.5)",
    cases: () => [
      ...pPairs("ppareto(x, 0.5, 1)", (x, t) => ppareto(x, { a: 0.5, b: 1, ...t }), down(1e308)),
      ...pPairs("ppareto(x, 0.5, 0.5)", (x, t) => ppareto(x, { a: 0.5, b: 0.5, ...t }), flipPoint((x) => x / 0.5 < Infinity, 8e307, 9e307)),
      ...dPairs("dpareto(x, 0.5, 0.5)", (x, log) => dpareto(x, { a: 0.5, b: 0.5, log }), flipPoint((x) => x / 0.5 < Infinity, 8e307, 9e307)),
    ],
  },
  {
    where: "distributions/pareto.ts:53, :56",
    fns: "ppareto",
    condition: "|a e| < 1e-8 (e the relative low part of x / b) and the powers normal",
    methods: "exp(-a log r) | pow corrected to first order",
    point: "a = 1e9, b = 3, x over 61 steps of 2^-48 (8 ulps) from 3.000000003 (|a e| above and below 1e-8); x = 2^511 at a = 2, b = 1",
    cases: () => [
      { kind: "sweep", label: "ppareto(x, 1e9, 3, upper)", f: (x) => ppareto(x, { a: 1e9, b: 3, lowerTail: false }), xs: grid(3.000000003, 2 ** -48, 61) },
      ...pPairs("ppareto(x, 2, 1)", (x, t) => ppareto(x, { a: 2, b: 1, ...t }), up(2 ** 511)),
    ],
  },
  {
    where: "distributions/pareto.ts:67, :71-76, :85",
    fns: "dpareto",
    condition: "a / b normal; r^-a, r^(-a/2) and the density normal; |a e| < 1e-8",
    methods: "exp(log(a/b) - (a + 1) log r) | (a/b) r^-a / r, or (a/b) h / r h with h = r^(-a/2)",
    point: "x = 2^511 at a = 2, b = 1 (r^-a = 2^-1022); the density 2 x^-3 = 2^-1022; a / b = 2^-1022 at a = 1, x = 2^1023 (log)",
    cases: () => [
      ...dPairs("dpareto(x, 2, 1)", (x, log) => dpareto(x, { a: 2, b: 1, log }), up(2 ** 511)),
      pair("dpareto(x, 2, 1)", (x) => dpareto(x, { a: 2, b: 1 }), flipPoint((x) => 2 * x ** -3 >= DBL_MIN, 2 ** 341, 2 ** 342)),
      pair("dpareto(2^1023, 1, b, log)", (b) => dpareto(2 ** 1023, { a: 1, b, log: true }), up(2 ** 1022)),
    ],
  },
  {
    where: "distributions/pareto.ts:80",
    fns: "dpareto (log)",
    condition: "|log density| < |log(a / b)| / 2 (the logs cancelling)",
    methods: "log(a / b) - (a + 1) log r | log of the product",
    point: "a = 1, b = 1e-300 at log(x / b) = 3 log(1e300) / 4",
    cases: () => [
      pair(
        "dpareto(x, 1, 1e-300, log)",
        (x) => dpareto(x, { a: 1, b: 1e-300, log: true }),
        flipPoint((x) => Math.abs(dpareto(x, { a: 1, b: 1e-300, log: true })) < 0.5 * Math.log(1e300), 1e-226, 1e-224),
      ),
    ],
  },
  {
    where: "distributions/pareto.ts:101",
    fns: "ppareto (lower log)",
    condition: "a log(x / b) < 2^-1022 (a subnormal log of the upper tail)",
    methods: "log1mExp(lu) | log a + log log(x / b)",
    point: "a = 2^-1022 / log 2 at x = 2, b = 1",
    cases: () => [
      pair("ppareto(2, a, lower log)", (a) => ppareto(2, { a, logP: true }), flipPoint((a) => a * Math.LN2 < DBL_MIN, 3e-308, 3.4e-308)),
    ],
  },
  {
    where: "distributions/pareto.ts:112",
    fns: "qpareto",
    condition: "exp(-log P[X > x] / a) finite",
    methods: "exp(log b - lu / a) | b exp(-lu / a)",
    point: "log p = -709.78 (upper tail) at a = 1, b = 1e-10",
    cases: () => [
      pair(
        "qpareto(lp, 1, 1e-10, upper log)",
        (lp) => qpareto(lp, { a: 1, b: 1e-10, lowerTail: false, logP: true }),
        flipPoint((lp) => Math.exp(-lp) < Infinity, -710, -709),
      ),
    ],
  },
  {
    where: "distributions/triangular.ts:36, :93, :108",
    fns: "dtriang, ptriang, qtriang",
    condition: "b - a finite",
    methods: "everything halved (x, a, b, c) | direct",
    point: "b - a overflowing at a = -1e308, c = 0",
    cases: () => {
      const ab = flipPoint((b) => Number.isFinite(b + 1e308), 7.9e307, 8e307);
      return [
        ...pPairs("ptriang(-1e307, -1e308, b, 0)", (b, t) => ptriang(-1e307, { a: -1e308, b, c: 0, ...t }), ab),
        ...dPairs("dtriang(-1e307, -1e308, b, 0)", (b, log) => dtriang(-1e307, { a: -1e308, b, c: 0, log }), ab),
        pair("qtriang(0.3, -1e308, b, 0)", (b) => qtriang(0.3, { a: -1e308, b, c: 0 }), ab),
      ];
    },
  },
  {
    where: "distributions/triangular.ts:101",
    fns: "ptriang (log of the near tail)",
    condition: "the near tail below 2^-1022",
    methods: "log v | log s + log t",
    point: "2 q^2 = 2^-1022 at a = 0, b = 1, c = 0.5",
    cases: () => [pair("ptriang(q, lower log)", (q) => ptriang(q, { a: 0, b: 1, c: 0.5, logP: true }), flipPoint((q) => 2 * q * q < DBL_MIN, 1e-154, 2e-154))],
  },
  {
    where: "distributions/triangular.ts:113",
    fns: "qtriang (log)",
    condition: "exp(p) < 2^-1022",
    methods: "sqrt(exp(p)) | exp(p / 2)",
    point: "log p = log 2^-1022 at a = 0, b = 1, c = 0.5",
    cases: () => [pair("qtriang(lp, log)", (lp) => qtriang(lp, { a: 0, b: 1, c: 0.5, logP: true }), flipPoint((lp) => Math.exp(lp) < DBL_MIN, -709, -707))],
  },
  {
    where: "distributions/triangular.ts:128, :134",
    fns: "qtriang",
    condition: "t <= 1/2 (t the share of the probability on the quantile's side of the mode)",
    methods: "from the mode, (1 - t) / (1 + sqrt(t)) | from the end, sqrt(t)",
    point: "lower = 0.25 and upper = 0.25 at a = 0, b = 1, c = 0.5",
    cases: () => {
      const o = { a: 0, b: 1, c: 0.5 };
      return [
        pair("qtriang(p)", (p) => qtriang(p, o), up(0.25)),
        pair("qtriang(p)", (p) => qtriang(p, o), down(0.75)),
        pair("qtriang(p, upper)", (p) => qtriang(p, { ...o, lowerTail: false }), up(0.25)),
      ];
    },
  },
  {
    where: "distributions/kumaraswamy.ts:29",
    fns: "dkumar, pkumar",
    condition: "a log x subnormal (x near 1, a tiny)",
    methods: "-expm1(a log x) | -a log x from the factors (log a + log(-log x), or the base scaled by 2^600)",
    point: "x = 1 - 2^-40, a where a (-log x) = 2^-1022",
    cases: () => {
      const lx = -Math.log(1 - 2 ** -40);
      const ab = flipPoint((a) => a * lx < DBL_MIN, 1e-296, 1e-295);
      return [
        pair("dkumar(1 - 2^-40, a, 0.5, log)", (a) => dkumar(1 - 2 ** -40, a, 0.5, { log: true }), ab),
        pair("dkumar(1 - 2^-40, a, 0.5)", (a) => dkumar(1 - 2 ** -40, a, 0.5), ab),
        ...pPairs("pkumar(1 - 2^-40, a, 0.5)", (a, tl) => pkumar(1 - 2 ** -40, a, 0.5, tl), ab),
      ];
    },
  },
  {
    where: "distributions/kumaraswamy.ts:54",
    fns: "dkumar, pkumar",
    condition: "|c| < 1e-8 (c = e lo / hi, the first-order correction for the rounding of 1 - x^a)",
    methods: "exp(e log1p(-x^a)) | pow(1 - x^a, e) (1 + c)",
    point: "a = 1, b = 1e9, x over 61 steps of 2^-70 from 1e-9 (|c| above and below 1e-8)",
    cases: () => [{ kind: "sweep", label: "pkumar(x, 1, 1e9, upper)", f: (x) => pkumar(x, 1, 1e9, { lowerTail: false }), xs: grid(1e-9, 2 ** -70, 61) }],
  },
  {
    where: "distributions/kumaraswamy.ts:93, :119",
    fns: "dkumar, pkumar",
    condition: "x^a < 2^-1022",
    methods: "log1p(-x^a) | -x^a from logs",
    point: "x^2 = 2^-1022 at a = 2, b = 3",
    cases: () => {
      const ab = flipPoint((x) => Math.pow(x, 2) < DBL_MIN, 1e-154, 2e-154);
      return [
        ...pPairs("pkumar(x, 2, 3)", (x, t) => pkumar(x, 2, 3, t), ab),
        ...dPairs("dkumar(x, 2, 3)", (x, log) => dkumar(x, 2, 3, { log }), ab),
      ];
    },
  },
  {
    where: "distributions/kumaraswamy.ts:103",
    fns: "dkumar",
    condition: "x^(a-1) < 2^-1022",
    methods: "the product | exp(log density)",
    point: "x^2 = 2^-1022 at a = 3, b = 1e300",
    cases: () => [pair("dkumar(x, 3, 1e300)", (x) => dkumar(x, 3, 1e300), flipPoint((x) => Math.pow(x, 2) < DBL_MIN, 1e-154, 2e-154))],
  },
  {
    where: "distributions/kumaraswamy.ts:110",
    fns: "dkumar",
    condition: "a b, a b x^(a-1) and (1 - x^a)^(b-1) normal (and the density normal and finite)",
    methods: "exp(log density) | the product",
    point: "a b = 2^-1022 at a = 1e-154, x = 1e-200",
    cases: () => [pair("dkumar(1e-200, 1e-154, b)", (b) => dkumar(1e-200, 1e-154, b), flipPoint((b) => 1e-154 * b >= DBL_MIN, 2e-154, 3e-154))],
  },
  {
    where: "distributions/kumaraswamy.ts:68, :78",
    fns: "dkumar",
    condition: "x = 0, or a or b beyond 1e300 (double); x^a > 1e-10 (log(1 - x^a) from x^a in double-double)",
    methods: "double | double-double sum; log1p(-x^a) | log of 1 - exp(a log x) in double-double",
    point: "x^a = 1e-10 at a = 2, b = 3 (x = 1e-5); a = 1e300 at x = 0.5, b = 2 (log)",
    cases: () => [
      ...dPairs("dkumar(x, 2, 3)", (x, log) => dkumar(x, 2, 3, { log }), flipPoint((x) => Math.pow(x, 2) > 1e-10, 9e-6, 1.1e-5)),
      pair("dkumar(0.5, a, 2, log)", (a) => dkumar(0.5, a, 2, { log: true }), down(1e300)),
    ],
  },
  {
    where: "distributions/kumaraswamy.ts:129",
    fns: "pkumar (lower log)",
    condition: "-b log(1 - x^a) < 2^-1022 (a subnormal log of the upper tail)",
    methods: "log1mExp(lu) | log b + log(-log(1 - x^a))",
    point: "b = 2^-1022 / log 2 at q = 0.5, a = 1",
    cases: () => [
      pair("pkumar(0.5, 1, b, lower log)", (b) => pkumar(0.5, 1, b, { logP: true }), flipPoint((b) => -(b * Math.log1p(-0.5)) < DBL_MIN, 3e-308, 3.4e-308)),
    ],
  },
  {
    where: "distributions/kumaraswamy.ts:130",
    fns: "pkumar (lower log)",
    condition: "log P[X > q] < -log 2 (and x^a normal)",
    methods: "log1mExp(lu) | log1p(-(1 - x^a)^b)",
    point: "q = 0.5 at a = b = 1",
    cases: () => [pair("pkumar(q, 1, 1, lower log)", (q) => pkumar(q, 1, 1, { logP: true }), up(0.5))],
  },
  {
    where: "distributions/kumaraswamy.ts:146, :154, :159",
    fns: "qkumar",
    condition: "lu / b <= -2^-1022; lu / b < -log 2; a < 1e300 and 1/a < 1e300",
    methods:
      "(-lu / b)^(1/a) in logs | log1p(-exp(t)) / a | w^(1/a) corrected for the rounding of 1/a (or plain above 1e300 " +
      "and below 1e-300, where it underflows to 0)",
    point: "b = log 2 / 2^-1022 at p = 1/2, a = 2; p = 1/2 at a = 2, b = 1; a = 1e300 and 1/a = 1e300 at p = 1/2, b = 1",
    cases: () => [
      pair("qkumar(0.5, 2, b)", (b) => qkumar(0.5, 2, b), flipPoint((b) => Math.log(0.5) / b <= -DBL_MIN, 3e307, 3.2e307)),
      pair("qkumar(p, 2, 1)", (p) => qkumar(p, 2, 1), flipPoint((p) => Math.log1p(-p) < -Math.LN2, 0.49, 0.51)),
      pair("qkumar(0.5, a, 1)", (a) => qkumar(0.5, a, 1), down(1e300)),
      pair("qkumar(0.5, a, 1)", (a) => qkumar(0.5, a, 1), flipPoint((a) => 1 / a < 1e300, 9e-301, 1.1e-300)),
    ],
  },
];

/** -1022 log 2: log p below it means a probability below the normal range */
const LOG_DBL_MIN = -1022 * Math.LN2;

const SUBNORMAL_PARTS: Entry[] = [
  {
    where: "internal/invert.ts:54, :67",
    fns: "quantiles solved by invertContinuous (qgamma, qbeta, qf, ...)",
    skip:
      "a switch of the residual inside the search (F / p overflows only at points far from the root, where the residual is " +
      "hundreds either way), not of the answer; the qgamma case in extremeAccuracy.test.ts covers it",
    condition: "F / p finite (a subnormal linear target p)",
    methods: "log F - log p | log(F / p)",
    point: "-",
  },
  {
    where: "special/incbet.ts:854, :865",
    fns: "pbeta, pf, pbinom, pnbinom (x or 1 - x below 2^-1022)",
    condition: "a log x overflows to -Infinity; e < -746 (the exponent of the series' prefactor)",
    methods: "the series | the limits 0 and 1; r e^e (1 + e_lo) | 0 (e^-746 rounds to 0 as the product did)",
    point: "validity: pbeta(4.2e-310, a, 1113) on both sides of the a where a log x overflows",
    cases: () => {
      const x = 4.2200334418145e-310;
      const ab = flipPoint((a) => a * Math.log(x) === -Infinity, 1e305, 1e306);
      return [
        {
          kind: "check",
          label: "pbeta(4.2e-310, a, 1113): lower 0 and upper 1 on both sides, the lower log -Infinity (the true log is below -1.8e308)",
          run: () => {
            const v = ab.map((a) => [pbeta(x, a, 1113), pbeta(x, a, 1113, { lowerTail: false }), pbeta(x, a, 1113, { logP: true })]);
            const ok = v.every(([lo, up, l]) => Object.is(lo, 0) && up === 1 && l === -Infinity);
            return ok ? undefined : v.map((r) => r.join(", ")).join("; ");
          },
        },
      ];
    },
  },
  {
    where: "distributions/f.ts:56",
    fns: "pf, df, qf",
    condition: "x > 1e290 or df1 > 1e290 (the factor scaled by 2^-600 and the other by 2^600 before twoProd)",
    methods: "twoProd(m, x) | the scaled factors",
    point: "x = 1e290 at df1 = 1e-300, df2 = 3; df1 = 1e290 at q = 1e-295, df2 = 3",
    cases: () => [
      ...pPairs("pf(x, 1e-300, 3)", (x, t) => pf(x, 1e-300, 3, t), up(1e290)),
      ...pPairs("pf(1e-295, df1, 3)", (m, t) => pf(1e-295, m, 3, t), up(1e290)),
    ],
  },
  {
    where: "special/gamma.ts:168",
    fns: "lgamma, lbeta, and everything taking log Γ of a tiny argument",
    condition: "0 < |x| < 1e-300",
    methods: "the product of 1/x and the series | -log|x|",
    point: "x = ±1e-300",
    cases: () => [pair("lgamma(x)", lgamma, down(1e-300)), pair("lgamma(-x)", lgamma, up(-1e-300))],
  },
  {
    where: "special/beta.ts:59, :120",
    fns: "beta, lbeta",
    condition: "1 / min(a, b) overflows (beta); min(a, b) < 1e-300 (lbeta, both below 15)",
    methods: "the gamma products | Infinity; lgamma(a) + lgamma(b) - lgamma(a + b)",
    point: "a = 1e-300 at b = 3 and b = a (lbeta); the a where 1/a overflows at b = 3 (beta)",
    cases: () => {
      const ab = flipPoint((a) => 1 / a === Infinity, 5e-309, 6e-309);
      return [
        pair("lbeta(a, 3)", (a) => lbeta(a, 3), down(1e-300)),
        pair("lbeta(a, a)", (a) => lbeta(a, a), down(1e-300)),
        {
          kind: "check",
          label: "beta(a, 3) Infinity where 1/a overflows, finite and above 1.7e308 just above",
          run: () => {
            const [lo, hi] = [beta(ab[0], 3), beta(ab[1], 3)];
            return lo === Infinity && hi > 1.7e308 && hi < Infinity ? undefined : `beta = ${lo}, ${hi}`;
          },
        },
      ];
    },
  },
  {
    where: "distributions/nbeta.ts:860",
    fns: "qf with ncp",
    skip: "the starting value of the search (the df1 = Inf limit out of the mixture's range), not the answer",
    condition: "not the mixture method and df2 in the central range",
    methods: "(m + λ)/m | (m + λ)/m times the F quantile at df1 = Inf",
    point: "-",
  },
  {
    where: "distributions/laplace.ts:36; logistic.ts:37",
    fns: "dlaplace, dlogis",
    condition: "exp(-|z|) >= 2^-1022",
    methods: "expNegOver (powers of two applied last) | exp(-|z|) / (2 sigma), and the logistic form",
    point: "|z| = 1022 log 2 at sigma = scale = 1e-300",
    cases: () => {
      const ab = flipPoint((x) => Math.exp(-x / 1e-300) >= DBL_MIN, 7.07e-298, 7.09e-298);
      return [
        pair("dlaplace(x, 0, 1e-300)", (x) => dlaplace(x, { sigma: 1e-300 }), ab),
        pair("dlogis(x, 0, 1e-300)", (x) => dlogis(x, { scale: 1e-300 }), ab),
      ];
    },
  },
  {
    where: "distributions/logistic.ts:38",
    fns: "dlogis",
    condition: "scale >= 2^-1022",
    methods: "e / (1 + e)^2 / scale | e / (scale (1 + e)^2)",
    point: "scale = 2^-1022 at x = 2^-1021 (z = 2)",
    cases: () => [pair("dlogis(2^-1021, 0, scale)", (sc) => dlogis(2 * DBL_MIN, { scale: sc }), down(DBL_MIN))],
  },
  {
    where: "distributions/normal.ts:143",
    fns: "dnorm (an sd whose reciprocal overflows)",
    condition: "hi²/2 > 1400 (hi = |z| floored to sixteenths)",
    methods: "exp(700 - hi²/2) | exp(1400 - hi²/2) and two factors of exp(-700)",
    point: "z = 52.9375 at sd = 2^-1070",
    cases: () => {
      const sd = 2 ** -1070;
      const ab = flipPoint((x) => (Math.floor((x / sd) * 16) / 16) ** 2 / 2 > 1400, 52.5 * sd, 53.5 * sd);
      return [...dPairs("dnorm(x, 0, 2^-1070)", (x, log) => dnorm(x, { sd, log }), ab)];
    },
  },
  {
    where: "distributions/cauchy.ts:67",
    fns: "dcauchy",
    condition: "scale < 2^-1022",
    methods: "1 / (π scale (1 + z²)) and the y = 1/|z| form | the powers of two of scale and x - location applied last",
    point: "scale = 2^-1022 at x = 3 2^-1022 (|z| > 1) and x = 2^-1023 (|z| < 1)",
    cases: () => [
      ...dPairs("dcauchy(3 2^-1022, 0, scale)", (sc, log) => dcauchy(3 * DBL_MIN, { scale: sc, log }), down(DBL_MIN)),
      ...dPairs("dcauchy(2^-1023, 0, scale)", (sc, log) => dcauchy(DBL_MIN / 2, { scale: sc, log }), down(DBL_MIN)),
    ],
  },
  {
    where: "distributions/exponential.ts:68; weibull.ts:118, :128; kumaraswamy.ts:147",
    fns: "qexp, qweibull, qkumar (lower tail, log p)",
    condition: "log p < -1022 log 2 (then exp(p / shape) below 2^-1022 for qweibull)",
    methods: "-log1p(-exp(p)) | exp(p) without rounding it on the subnormal grid",
    point: "log p = -1022 log 2 at rate 1e-300, shapes 1 and 2 (scale 1e-300 and 1), a = 2, b = 3",
    cases: () => {
      const ab = down(LOG_DBL_MIN);
      return [
        pair("qexp(lp, 1e-300, log)", (lp) => qexp(lp, { rate: 1e-300, logP: true }), ab),
        pair("qweibull(lp, 2, log)", (lp) => qweibull(lp, 2, { logP: true }), ab),
        pair("qweibull(lp, 1, 1e-300, log)", (lp) => qweibull(lp, 1, { scale: 1e-300, logP: true }), ab),
        pair("qweibull(lp, 1, 1e300, log)", (lp) => qweibull(lp, 1, { scale: 1e300, logP: true }), ab),
        pair("qkumar(lp, 2, 3, log)", (lp) => qkumar(lp, 2, 3, { logP: true }), ab),
      ];
    },
  },
  {
    where: "distributions/negbinomial.ts:58",
    fns: "dnbinom",
    condition: "size / (size + x) >= 2^-1022",
    methods: "log size - log(size + x), (b / (size + x)) size | the ratio",
    point: "size where size / (size + 5) = 2^-1022 at x = 5, prob 0.5",
    cases: () => [
      ...dPairs("dnbinom(5, size, 0.5)", (n, log) => dnbinom(5, n, { prob: 0.5, log }), flipPoint((n) => n / (n + 5) >= DBL_MIN, 1e-307, 2e-307)),
    ],
  },
  {
    where: "distributions/triangular.ts:48, :64, :100",
    fns: "dtriang, ptriang (log)",
    condition: "the ratios s, t of lengths >= 2^-1022 (density, near tail); the tail >= 2^-1022 (far tail)",
    methods: "from the lengths themselves, the far tail as a sum of logs | from the ratios",
    point: "x = 2^-1022 at a = 0, c = 1, b = 2; the far lower tail 2x - x² = 2^-1022 at a = c = 0, b = 1",
    cases: () => {
      const o = { a: 0, b: 2, c: 1 };
      const far = flipPoint((x) => 2 * x - x * x < DBL_MIN, DBL_MIN / 4, DBL_MIN);
      return [
        ...dPairs("dtriang(x, 0, 2, 1)", (x, log) => dtriang(x, { ...o, log }), down(DBL_MIN)),
        pair("ptriang(x, 0, 2, 1, log)", (x) => ptriang(x, { ...o, logP: true }), flipPoint((x) => x / 2 < DBL_MIN, DBL_MIN, 4 * DBL_MIN)),
        pair("ptriang(x, 0, 1, 0, log)", (x) => ptriang(x, { a: 0, b: 1, c: 0, logP: true }), far),
      ];
    },
  },
  {
    where: "special/igam.ts:42, :50, :125, :133",
    fns: "pgamma, pchisq, ppois, pinvgamma (linear)",
    condition: "x^a e^-x / Γ(a + 1) >= 2^-1022",
    methods: "exp of the log | the factor times the series or continued fraction",
    point: "that factor at 2^-1022 for a = 100 (series, x near 0.03) and a = 2 (continued fraction, x near 717)",
    cases: () => [
      pair("pgamma(x, 100)", (x) => pgamma(x, 100), flipPoint((x) => dpois(100, x) >= DBL_MIN, 0.01, 0.1)),
      pair("pgamma(x, 2, upper)", (x) => pgamma(x, 2, { lowerTail: false }), flipPoint((x) => dpois(2, x) >= DBL_MIN, 700, 730)),
    ],
  },
  {
    where: "distributions/tukey.ts:842",
    fns: "ptukey, qtukey",
    condition: "q < 2^-1000",
    methods: "the integrals | the lower tail scaled from 2^-1000 by q^((k-1) r)",
    point: "q = 2^-1000 at k = 2, df = 486.9 and at k = 5, df = 10, nranges = 3",
    cases: () => [
      ...pPairs("ptukey(q, 2, 486.9)", (q, t) => ptukey(q, 2, 486.8681928207351, t), down(2 ** -1000)),
      ...pPairs("ptukey(q, 5, 10, 3)", (q, t) => ptukey(q, 5, 10, { nranges: 3, ...t }), down(2 ** -1000), { tails: TAILS.slice(2) }),
    ],
  },
  {
    where: "distributions/geometric.ts:31",
    fns: "pgeom, dgeom (x from 1e290)",
    condition: "1 - prob rounds to 1",
    methods: "ddLog(1 - prob) | -prob - prob²/2",
    point: "prob = 2^-54 at x = 1e291 (upper log)",
    cases: () => [
      pair("pgeom(1e291, prob, upper log)", (p) => pgeom(1e291, p, { lowerTail: false, logP: true }), flipPoint((p) => 1 - p === 1, 1e-17, 1e-16)),
    ],
  },
];

// ---- Running the entries ----

const ENTRIES: Entry[] = [
  ...IGAM,
  ...IGAMI,
  ...GAMMA,
  ...INCBET,
  ...PREFACTOR,
  ...TEMME,
  ...LARGE_A,
  ...BETA_FN,
  ...LOADER,
  ...GAMMA_FN,
  ...NORMAL,
  ...ELEMENTARY,
  ...BETA_T_F,
  ...NCHISQ,
  ...NBETA,
  ...NT,
  ...T_ENDS,
  ...GAMMA_ENDS,
  ...BETA_F_ENDS,
  ...TUKEY,
  ...DISCRETE,
  ...INTERNAL,
  ...EXTRA,
  ...EXTREME,
  ...SUBNORMAL,
  ...SUBNORMAL_PARTS,
];

/** Checks that fail at the time of writing (live bugs, not fixed here) */
const KNOWN: KnownViolation[] = [];

const HANGS: Hang[] = [];

const used = new Set<KnownViolation>();

describe("method-switching thresholds", () => {
  it("the checks detect a jump of 2e-13 and pass a smooth function", () => {
    const smooth = (x: number) => Math.exp(3 * x);
    const jump = (x: number) => (x < 1 ? smooth(x) : smooth(x) * (1 + 2e-13));
    const cases = (f: Fn): Case[] => [
      pair("pair", f, down(1)),
      { kind: "extrap", label: "extrap", f, at: 1 - 2 ** -40, gap: 1e-6 },
      { kind: "extrap", label: "line", f, at: 1 - 2 ** -40, gap: 1e-9, linear: true },
      { kind: "sweep", label: "sweep", f, xs: grid(0.997, 1e-4, 61) },
    ];
    expect(cases(smooth).map(runCase)).toEqual([undefined, undefined, undefined, undefined]);
    for (const r of cases(jump).map(runCase)) expect(r).toBeTypeOf("string");
  });

  for (const e of ENTRIES) {
    const name = `${e.where}: ${e.condition}`;
    if (e.skip !== undefined) {
      it.skip(`${name} (${e.skip})`, () => {});
      continue;
    }
    it(name, () => {
      const cases = e.cases!();
      expect(cases.length).toBeGreaterThan(0);
      const failures: string[] = [];
      for (const c of cases) {
        const r = runCase(c);
        if (r === undefined) continue;
        const known = KNOWN.find((k) => k.entry === e.where && k.check === c.label);
        if (known !== undefined) used.add(known);
        else failures.push(`${c.label}: ${r}`);
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  }

  it("the table is consistent and every known violation is still present", () => {
    const wheres = ENTRIES.map((e) => e.where);
    expect(new Set(wheres).size).toBe(wheres.length);
    for (const e of ENTRIES) expect(e.skip !== undefined || e.cases !== undefined, e.where).toBe(true);
    for (const h of HANGS) expect(wheres, h.call).toContain(h.entry);
    const unused = KNOWN.filter((k) => !used.has(k)).map((k) => `${k.entry} / ${k.check}`);
    const skipped = ENTRIES.filter((e) => e.skip !== undefined).length;
    console.log(
      [
        `thresholds: ${ENTRIES.length} entries, ${ENTRIES.length - skipped} tested, ${skipped} skipped`,
        `  ${used.size} known violations:`,
        ...[...used].map((k) => `    ${k.entry} / ${k.check}: ${k.reason}`),
        `  ${HANGS.length} calls not run (they do not return):`,
        ...HANGS.map((h) => `    ${h.call}: ${h.reason}`),
      ].join("\n"),
    );
    expect(unused, "known violations no longer needed").toEqual([]);
  });
});
