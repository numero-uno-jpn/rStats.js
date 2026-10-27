import { describe, expect, it } from "vitest";
import {
  beta,
  darcsine,
  dbeta,
  dbinom,
  dcauchy,
  dchisq,
  df,
  dgamma,
  dgeom,
  dhyper,
  digamma,
  dkumar,
  dlnorm,
  dnorm,
  dpois,
  dt,
  dtriang,
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
  phyper,
  pkumar,
  plnorm,
  pnbinom,
  pnorm,
  pt,
  ptriang,
  ptukey,
  pweibull,
  qarcsine,
  qbeta,
  qbinom,
  qcauchy,
  qf,
  qgamma,
  qhyper,
  qlnorm,
  qlogis,
  qnbinom,
  qnorm,
  qpois,
  qt,
  qtriang,
  qtukey,
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
  /** file:line in src (as of commit 71aaadb) */
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
    where: "special/igam.ts:45",
    fns: "pgamma, pchisq, ppois, gammainc",
    condition: "a > 1000 && x > 0.97 a",
    methods: "series for P in double | in double-double",
    point:
      "x = 0.97 a at a = 1e5 (x < a, outside Temme's region). Below a = 22500 every x in (0.97 a, a) is in Temme's " +
      "region (|x - a|/a < 4.5/sqrt(a)), so the a > 1000 side of the condition is not reached through gammaInc",
    cases: () => pPairs("pgamma(x, 1e5)", pg(1e5), flipPoint((x) => x > 0.97 * 1e5, 9e4, 9.9e4)),
  },
  {
    where: "special/igam.ts:229",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "x > 1.1 (then x < a)",
    methods: "small-x rules (P series if -0.4/log x < a or 1.1 x < a, else Q series) | P series or Q continued fraction",
    point: "x = 1.1 at a = 1.2 (Q series | P series) and a = 0.9 (Q series | continued fraction)",
    cases: () => [...pPairs("pgamma(x, 1.2)", pg(1.2), up(1.1)), ...pPairs("pgamma(x, 0.9)", pg(0.9), up(1.1))],
  },
  {
    where: "special/igam.ts:230",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "x < a (x > 1.1, outside Temme's region)",
    methods: "continued fraction for Q | series for P",
    point: "x = a = 5 and x = a = 20",
    cases: () => [...pPairs("pgamma(x, 5)", pg(5), down(5)), ...pPairs("pgamma(x, 20)", pg(20), down(20))],
  },
  {
    where: "special/igam.ts:234",
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
    where: "special/igam.ts:273, :313",
    fns: "pgamma, pchisq, ppois, qgamma",
    condition: "x > 1e15 max(a, 1)",
    methods: "continued fraction | Q = x^(a-1) e^-x / Gamma(a) (1 + (a-1)/x)",
    point: "x = 1e15 at a = 0.5 and x = 2e15 at a = 2 (the next term ((a-1)/x)^2 is below 1e-30 relative there)",
    cases: () => [...pPairs("pgamma(x, 0.5)", pg(0.5), up(1e15)), ...pPairs("pgamma(x, 2)", pg(2), up(2e15))],
  },
  {
    where: "special/igam.ts:279, :320",
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
    where: "special/igam.ts:280, :321",
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
    where: "distributions/gamma.ts:47, :65",
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
    where: "distributions/gamma.ts:97",
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
    where: "special/incbet.ts:123, :699",
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
    where: "special/incbet.ts:221",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "max(a, b) >= 2^52",
    methods: "continued fraction with double coefficients (loop inlined) | with double-double coefficients",
    point:
      "a = 2^52, b = 100, x = 1 - 1e-12 (continued fraction #1 in the lower frame; log P about -4030). Validity: for " +
      "huge a, I_x(a, b) = Q(b, u) (1 + O(b²/a²)) with u = (a + (b - 1)/2)(-log x) (DiDonato & Morris eq. 9), checked " +
      "just below powers of two, where a + 1 and a + 2 are not exact for a non-integer a",
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
        { kind: "check", label: "integer a = 2^k - 1 against Q(b, u)", run: viaGamma(ks.map((k) => 2 ** k - 1)) },
        { kind: "check", label: "a = nextDown(2^k) against Q(b, u)", run: viaGamma(ks.map((k) => nextDown(2 ** k))) },
      ];
    },
  },
  {
    where: "special/incbet.ts:680",
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
    where: "special/incbet.ts:685",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "x <= a/(a + b) (continued fraction in this frame)",
    methods: "1 - (continued fraction of the other frame) | continued fraction",
    point: "x = 5/13 at a = 5, b = 8",
    cases: () => pPairs("pbeta(x, 5, 8)", pb(5, 8), flipPoint((x) => x <= 5 / 13, 0.3, 0.45)),
  },
  {
    where: "special/incbet.ts:693",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "x (a + b - 2) - (a - 1) < 0",
    methods: "continued fraction #2 | #1",
    point: "x = 4/11 at a = 5, b = 8",
    cases: () => pPairs("pbeta(x, 5, 8)", pb(5, 8), flipPoint((x) => x * (5 + 8 - 2) - (5 - 1) < 0, 0.3, 0.38)),
  },
  {
    where: "special/incbet.ts:766",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "x < DBL_MIN or 1 - x < DBL_MIN",
    methods: "series / continued fraction | first series term x^a / (a B(a, b)) in logs",
    point: "x = DBL_MIN at a = 0.5, b = 3; 1 - x = t^2/(3 + t^2) = DBL_MIN in pt(t, 3)",
    cases: () => [
      ...pPairs("pbeta(x, 0.5, 3)", pb(0.5, 3), down(DBL_MIN)),
      ...pPairs("pt(t, 3)", (v, t) => pt(v, 3, t), around(flipPoint((v) => (v * v) / (3 + v * v) < DBL_MIN, 1e-160, 1e-150)[0])),
    ],
  },
  {
    where: "special/incbet.ts:782",
    fns: "pbeta",
    skip: "only a shortcut: m = ab/(a + b) < min(a, b), so Temme's m >= 25 (incbetTemme.ts:175) already implies a, b >= 25",
    condition: "a >= 25 && b >= 25",
    methods: "-",
    point: "-",
  },
  {
    where: "special/incbet.ts:794",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "max(a, b) >= 15 && min(a, b) <= 40",
    methods: "continued fraction | expansion for large a (incbetLargeA.ts) where it applies",
    point: "a = 15 at b = 5, x = 0.8; b = 40 at a = 200, x = 0.95 (|τ| > 1, so not Temme's)",
    cases: () => [
      ...pPairs("pbeta(0.8, a, 5)", (a, t) => pbeta(0.8, a, 5, t), down(15)),
      ...pPairs("pbeta(0.95, 200, b)", (b, t) => pbeta(0.95, 200, b, t), up(40)),
    ],
  },
  {
    where: "special/incbet.ts:815, :838",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "a |log x| > 32 v && x below the mean in the requested frame (v from the other frame's series)",
    methods: "complement of the other frame's series | continued fraction (or the large-a expansion)",
    point: "where 0.01 |log(1 - x)| = 32 I_x(1e4, 0.01), x about 1 - 8e-5 (the example of the comment, both frames)",
    cases: () => {
      const lower = { lowerTail: true, logP: false };
      const x0 = flipPoint((x) => 0.01 * Math.abs(Math.log(1 - x)) > 32 * pbeta(x, 1e4, 0.01, lower), 1 - 2e-4, 1 - 2e-5)[0];
      const q0 = flipPoint((x) => 0.01 * Math.abs(Math.log(x)) > 32 * pbeta(x, 0.01, 1e4, { lowerTail: false, logP: false }), 2e-5, 2e-4)[0];
      return [...pPairs("pbeta(x, 1e4, 0.01)", pb(1e4, 0.01), around(x0)), ...pPairs("pbeta(x, 0.01, 1e4)", pb(0.01, 1e4), around(q0))];
    },
  },
  {
    where: "special/incbet.ts:825",
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
    where: "special/incbetTemme.ts:175",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "m = ab/(a + b) >= 25",
    methods: "continued fraction / large-a expansion | Temme's expansion",
    point: "m = 25 at b = 100 (a = 100/3), x = 0.25",
    cases: () => pPairs("pbeta(0.25, a, 100)", (a, t) => pbeta(0.25, a, 100, t), flipPoint((a) => (a * 100) / (a + 100) >= 25, 30, 40)),
  },
  {
    where: "special/incbetTemme.ts:181",
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
    where: "special/incbetTemme.ts:190",
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
    where: "special/incbetTemme.ts:193",
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
    where: "special/incbetTemme.ts:199",
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
    where: "special/incbetLargeA.ts:122",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "y = 1 - x <= 0.3",
    methods: "continued fraction | expansion",
    point: "x = 0.7 at a = 100, b = 5",
    cases: () => pPairs("pbeta(x, 100, 5)", pb(100, 5), flipPoint((x) => 1 - x <= 0.3, 0.6, 0.8)),
  },
  {
    where: "special/incbetLargeA.ts:126",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "u0 >= median of Gamma(b, 1) (b - 1/3, or 2^(-1/b) for b < 1)",
    methods: "H side (lower incomplete gamma) | J side (upper)",
    point: "u0 = 14/3 at a = 100, b = 5 (x about 0.955)",
    cases: () => pPairs("pbeta(x, 100, 5)", pb(100, 5), around(flipPoint((x) => largeAU0(x, 100, 5) >= 5 - 1 / 3, 0.9, 0.99)[0], 2)),
  },
  {
    where: "special/incbetLargeA.ts:127",
    fns: "pbeta, pt, pf, pbinom, pnbinom",
    condition: "u0 > 500, or J side with u0 < 0.1",
    methods: "expansion | continued fraction",
    point: "u0 = 500 at a = 2000, b = 5; u0 = 0.1 at a = 100, b = 0.1 (J side)",
    cases: () => [
      ...pPairs("pbeta(x, 2000, 5)", pb(2000, 5), around(flipPoint((x) => largeAU0(x, 2000, 5) > 500, 0.7, 0.8)[0], 2)),
      ...pPairs("pbeta(x, 100, 0.1)", pb(100, 0.1), around(flipPoint((x) => largeAU0(x, 100, 0.1) < 0.1, 0.99, 0.99999)[0], 2)),
    ],
  },
  {
    where: "special/incbetLargeA.ts:200",
    fns: "pbeta",
    skip:
      "unreachable: the H side falls below 1e-290 only for a y < 1e-6, where the series in frame (b, a, y) is used " +
      "first; the J side is at least about Q(b, 500) > 1e-230",
    condition: "small >= 1e-290",
    methods: "-",
    point: "-",
  },
  {
    where: "special/incbetLargeA.ts:85, :87",
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
    where: "special/beta.ts:45, :107",
    fns: "beta, lbeta (and through them pt, qt, qbeta, pf, ...)",
    condition: "max(a, b) > 15",
    methods: "Cephes (gamma ratio) | double-double Stirling form",
    point: "a = 15 at b = 3",
    cases: () => [pair("lbeta(a, 3)", (a) => lbeta(a, 3), up(15)), pair("beta(a, 3)", (a) => beta(a, 3), up(15))],
  },
  {
    where: "special/beta.ts:49, :111",
    fns: "beta, lbeta",
    condition: "max > 15 and min(a, b) < 1",
    methods: "double-double Stirling form | lgamma(min) - lgammaDiff(min, max)",
    point: "b = 1 at a = 20",
    cases: () => [pair("lbeta(20, b)", (b) => lbeta(20, b), down(1)), pair("beta(20, b)", (b) => beta(20, b), down(1))],
  },
  {
    where: "special/beta.ts:53, :112",
    fns: "beta, lbeta, pbeta and pt with huge parameters",
    condition: "max(a, b) >= 2^52",
    methods: "double-double Stirling form | b log(b/a) form (lbetaHuge)",
    point: "a = 2^52 at b = 5",
    cases: () => [pair("lbeta(a, 5)", (a) => lbeta(a, 5), down(2 ** 52)), pair("beta(a, 5)", (a) => beta(a, 5), down(2 ** 52))],
  },
  {
    where: "special/beta.ts:59, :117",
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
    where: "special/loader.ts:97, :354",
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
    where: "special/loader.ts:192",
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
    where: "special/loader.ts:347, :370",
    fns: "every density, pgamma, pbeta",
    condition: "1e-290 < x/M < 1e290",
    methods: "log x - log M | log of the double-double quotient",
    point: "dpois(1e10, λ) at λ = 1e-280 and dpois(1, λ) at λ = 1e290 (log scale; the values underflow)",
    cases: () => [
      pair("dpois(1e10, λ, log)", (l) => dpois(1e10, l, { log: true }), flipPoint((l) => 1e10 / l < 1e290, 5e-281, 5e-280)),
      pair("dpois(1, λ, log)", (l) => dpois(1, l, { log: true }), flipPoint((l) => 1 / l > 1e-290, 5e289, 5e290)),
    ],
  },
  {
    where: "special/loader.ts:423, :433",
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
    where: "special/loader.ts:480",
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
    where: "special/loader.ts:481",
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
    where: "special/gamma.ts:166, :192",
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
    where: "special/gamma.ts:217",
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
    where: "special/gamma.ts:257",
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
    where: "distributions/lognormal.ts:47",
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
    where: "distributions/lognormal.ts:35, :40",
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
    where: "distributions/lognormal.ts:78, :82",
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
    where: "distributions/cauchy.ts:21, :33",
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
    where: "distributions/cauchy.ts:52",
    fns: "pcauchy (log)",
    condition: "w = 1/|z| < 1e-150",
    methods: "log(atan(w)/π) | log w - log π",
    point: "x = 1e150",
    cases: () => [pair("pcauchy(x, upper log)", (x) => pcauchy(x, { lowerTail: false, logP: true }), flipPoint((x) => 1 / x < 1e-150, 5e149, 2e150))],
  },
  {
    where: "distributions/cauchy.ts:73",
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
    where: "distributions/cauchy.ts:86, :90",
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
    where: "distributions/logistic.ts:51",
    fns: "qlogis",
    condition: "p < 0.25",
    methods: "log1p((2p - 1)/(1 - p)) | log(p/(1 - p))",
    point: "p = 0.25",
    cases: () => [pair("qlogis(p)", (p) => qlogis(p), down(0.25)), pair("qlogis(p, upper)", (p) => qlogis(p, { lowerTail: false }), down(0.25))],
  },
  {
    where: "distributions/kumaraswamy.ts:17, :23",
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
    where: "distributions/kumaraswamy.ts:42",
    fns: "dkumar",
    condition: "x^a > 1e-290",
    methods: "x^(a-1) by pow | as x^a / x",
    point: "x = 1e-145 at a = 2, b = 3",
    cases: () => dPairs("dkumar(x, 2, 3)", (x, log) => dkumar(x, 2, 3, { log }), flipPoint((x) => Math.pow(x, 2) > 1e-290, 5e-146, 5e-145)),
  },
  {
    where: "distributions/kumaraswamy.ts:43",
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
    where: "distributions/kumaraswamy.ts:56",
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
    where: "distributions/triangular.ts:35",
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
    where: "distributions/triangular.ts:48, :69",
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
    where: "distributions/beta.ts:35, :40",
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
    where: "distributions/beta.ts:47, :49",
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
    where: "distributions/beta.ts:97",
    fns: "dbeta (log)",
    condition: "a == 1 or b == 1",
    methods: "Loader's form | elementary log(b) + (b - 1) log(1 - x)",
    point: "a = 1 at b = 3, x = 0.3",
    cases: () => [pair("dbeta(0.3, a, 3, log)", (a) => dbeta(0.3, a, 3, { log: true }), down(1)), pair("dbeta(0.3, a, 3, log)", (a) => dbeta(0.3, a, 3, { log: true }), up(1))],
  },
  {
    where: "distributions/beta.ts:158",
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
    where: "distributions/beta.ts:200",
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
    where: "distributions/t.ts:78, :97",
    fns: "pt, qt",
    condition: "n/(n + t²) <= 1e-250",
    methods: "incomplete beta | first series term in logs",
    point: "t = 1.41e125 at n = 2",
    cases: () => pPairs("pt(t, 2)", (v, t) => pt(v, 2, t), flipPoint((v) => 2 / (2 + v * v) > 1e-250, 1e125, 2e125)),
  },
  {
    where: "distributions/t.ts:138",
    fns: "qt",
    condition: "log p < -30 (start value; SUSPECT: the power law ignores n)",
    methods: "Cornish-Fisher | power law t = (n^(n/2) / (n B(n/2, 1/2) p))^(1/n)",
    point:
      "log p = -30 at n = 5 and n = 1e6 (where the power-law start is about sqrt(n) = 1000 while the answer is 7.8). " +
      "Validity: pt(qt(p)) = p at n = 1e6 for log p from -31 to -700",
    cases: () => {
      const out: Case[] = [];
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
    where: "distributions/f.ts:27, :72, :92",
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
    where: "distributions/f.ts:38",
    fns: "df, qf (density in Newton steps)",
    condition: "m >= 2",
    methods: "dbinom(m/2; (m+n)/2) form | dbinom((m-2)/2; (m+n-2)/2) form",
    point: "m = 2 at x = 0.7, n = 5",
    cases: () => dPairs("df(0.7, m, 5)", (m, log) => df(0.7, m, 5, { log }), down(2)),
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
    where: "distributions/nbeta.ts:31",
    fns: "pbeta, dbeta, qbeta with ncp",
    condition: "x < 1e-250",
    methods: "term ratio as is | scaled by 2^500",
    point: "x = 1e-250 at a = 2, b = 3, ncp = 5 (log scale; the values underflow)",
    cases: () => [
      ...pPairs("pbeta(x, 2, 3, ncp 5)", pbn(2, 3, 5), down(1e-250), { tails: TAILS.slice(2) }),
      pair("dbeta(x, 2, 3, ncp 5, log)", (x) => dbeta(x, 2, 3, { ncp: 5, log: true }), down(1e-250)),
    ],
  },
  {
    where: "distributions/nbeta.ts:49",
    fns: "pbeta, dbeta, qbeta with ncp",
    condition: "x and 1 - x > 1e-305 (log of the increment)",
    methods: "-log B(s, b) - log s + s log x + b log(1 - x) | Loader's form",
    point: "x = 1e-305 at a = 0.5, b = 3, ncp = 5 (log scale)",
    cases: () => [
      ...pPairs("pbeta(x, 0.5, 3, ncp 5)", pbn(0.5, 3, 5), up(1e-305), { tails: TAILS.slice(2) }),
      pair("dbeta(x, 0.5, 3, ncp 5, log)", (x) => dbeta(x, 0.5, 3, { ncp: 5, log: true }), up(1e-305)),
    ],
  },
  {
    where: "distributions/nbeta.ts:94",
    fns: "pbeta, pf with ncp (log)",
    condition: "linear value >= 1e-280",
    methods: "sum on the log scale | log of the linear sum",
    point: "lower tail = 1e-280 at a = 2, b = 3, ncp = 5",
    cases: () => [pair("pbeta(x, 2, 3, ncp 5, lower log)", (x) => pbeta(x, 2, 3, { ncp: 5, logP: true }), flipPoint((x) => pbeta(x, 2, 3, { ncp: 5 }) >= 1e-280, 1e-142, 1e-138))],
  },
  {
    where: "distributions/nbeta.ts:200, :222, :260",
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
    where: "distributions/nbeta.ts:191",
    fns: "pf, df, qf with ncp",
    condition: "|m q| < 1e290",
    methods: "1 - x = n/(m q) in double | x, 1 - x as double-double quotients",
    point: "q = 1e290 at m = 1, n = 5, ncp = 2",
    cases: () => {
      const ab = flipPoint((q) => q < 1e290, 5e289, 2e290);
      return [...pPairs("pf(q, 1, 5, ncp 2)", (q, t) => pf(q, 1, 5, { ncp: 2, ...t }), ab), ...dPairs("df(q, 1, 5, ncp 2)", (q, log) => df(q, 1, 5, { ncp: 2, log }), ab)];
    },
  },
  {
    where: "internal/poissonMixture.ts:318",
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
    where: "internal/poissonMixture.ts:97, :124",
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
    where: "internal/poissonMixture.ts:359",
    fns: "pchisq, pbeta, pf with ncp (upper tail)",
    skip:
      "the restart happens when the terms of the upper sum are still growing 3000 steps after the start, which depends " +
      "on the walk itself; no single input moves it, and the restarted sum covers the same terms (bounded tail)",
    condition: "j - J >= 3000 && term still growing",
    methods: "-",
    point: "-",
  },
  {
    where: "internal/poissonMixture.ts:112",
    fns: "pchisq, pbeta, pf with ncp",
    condition: "x <= λ DBL_MIN or λ < x DBL_MIN (log Poisson weight)",
    methods: "Loader's form | closed form",
    point: "ncp = 2 DBL_MIN (mu = DBL_MIN; the weights j >= 1 are then about mu^j, the result is the central one)",
    cases: () => pPairs("pchisq(5, 3, ncp)", (ncp, t) => pchisq(5, 3, { ncp, ...t }), down(2 * DBL_MIN)),
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
    where: "distributions/negbinomial.ts:83",
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
    where: "distributions/negbinomial.ts:88, :99",
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
    where: "distributions/negbinomial.ts:114, :124",
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
    where: "internal/discrete.ts:32, :41",
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
    where: "internal/invert.ts:47, :60",
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
    where: "internal/invert.ts:98",
    fns: "q* with a log-density derivative",
    skip: "a per-iteration choice between the Halley and Newton steps; it changes the path, not the converged root (checked by every quantile entry)",
    condition: "Halley/Newton step ratio in [0.5, 2]",
    methods: "-",
    point: "-",
  },
  {
    where: "internal/invert.ts:122",
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

const NCHISQ: Entry[] = [
  {
    where: "distributions/nchisq.ts:26",
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
    where: "distributions/nchisq.ts:67",
    fns: "pchisq, qchisq with ncp",
    condition: "(λ/2)(x/2) > 1e18 (SUSPECT: valid only for sqrt(λx) >> ν², ν = df/2 - 1, which is not checked)",
    methods: "Poisson mixture | integral of the large-argument Bessel expansion (besselTails)",
    point:
      "x = 2e9 at df = 3, ncp = 2e9 (the centre; each side against the closed form). Validity: closed forms for df = 1 " +
      "and 3 at ncp = 1e12 from sqrt(x) - sqrt(λ) = -38 to 38 and at x = 1e6, ncp = 1e13 (far left); df = 2e5 at " +
      "ncp = 2e9 against the normal approximation (skewness 1e-4). From about df = 3e5 at ncp = 2e9 the call does not return",
    cases: () => {
      const ncp = 2e9;
      const ab = flipPoint((x) => (ncp / 2) * (x / 2) > 1e18, 1.9e9, 2.1e9);
      const closed = (x: number, df: 1 | 3, l: number): string | undefined => {
        for (const t of TAILS) {
          const v = pchisq(x, df, { ncp: l, ...t });
          const ref = nchisqClosedLog(x, df, l, t.lowerTail);
          const r = near(v, t.logP ? ref : Math.exp(ref), 1e-13, `pchisq(${x}, ${df}, ncp ${l}, ${tailName(t)})`);
          if (r !== undefined) return r;
        }
        return undefined;
      };
      // (the mixture side takes 0.2 s per call, so the two sides are compared with the closed form in two modes only;
      // the true change over the ulp is 2e-12 relative, so they are not compared with each other directly)
      return [
        {
          kind: "check",
          label: "pchisq(x, 3, ncp 2e9) on both sides against the closed form (lower, upper log)",
          run: () =>
            ab
              .map((x) => near(pchisq(x, 3, { ncp }), Math.exp(nchisqClosedLog(x, 3, ncp, true)), 1e-13, `pchisq(${x}, 3, ncp 2e9)`) ??
                near(pchisq(x, 3, { ncp, lowerTail: false, logP: true }), nchisqClosedLog(x, 3, ncp, false), 1e-13, `log pchisq(${x}, 3, ncp 2e9, upper)`))
              .find((s) => s !== undefined),
        },
        {
          kind: "check",
          label: "df = 1, 3 against the closed forms at ncp = 1e12 (and the earlier bug at x = ncp = 3e9)",
          run: () => {
            for (const df of [1, 3] as const) {
              for (const k of [-38, -5, 0, 5, 38]) {
                const r = closed((1e6 + k) ** 2, df, 1e12);
                if (r !== undefined) return r;
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
        {
          kind: "check",
          label: "df = 2e5, ncp = 2e9: range, complement and the normal approximation",
          run: () => {
            const [df, mean] = [2e5, 2e5 + ncp];
            const sd = Math.sqrt(2 * (df + 2 * ncp));
            // (all three on the Bessel side: mean - 3 sd would fall below 2e9 and take the slow mixture)
            for (const k of [-1, 0, 3]) {
              const x = mean + k * sd;
              const r =
                tailsConsistent((t) => pchisq(x, df, { ncp, ...t }), 1e-13, `pchisq(${x}, 2e5, ncp 2e9)`) ??
                (Math.abs(pchisq(x, df, { ncp }) - pnorm(k)) < 5e-3 ? undefined : `pchisq(${x}, 2e5, ncp 2e9) = ${pchisq(x, df, { ncp })}, normal ${pnorm(k)}`);
              if (r !== undefined) return r;
            }
            return undefined;
          },
        },
      ];
    },
  },
  {
    where: "distributions/nchisq.ts:112",
    fns: "dchisq, qchisq (density in Newton steps) with ncp",
    condition: "(λ/2)(x/2) > 1e18 (SUSPECT, as above)",
    methods: "Poisson mixture | large-argument Bessel expansion (besselAsymptotic)",
    point:
      "x = 2e9 at df = 3, ncp = 2e9 (the mode, so the density hardly changes over an ulp). Validity: closed forms for " +
      "df = 1, 3 at ncp = 1e12; df = 1e6 at ncp = 2e9 and the example df = 1e10, ncp = 1e9, x = 1.1e10 (ν² >> z)",
    cases: () => {
      const ncp = 2e9;
      const ab = flipPoint((x) => (ncp / 2) * (x / 2) > 1e18, 1.9e9, 2.1e9);
      return [
        pair("dchisq(x, 3, ncp 2e9)", (x) => dchisq(x, 3, { ncp }), ab, { flat: true }),
        {
          kind: "check",
          label: "df = 1, 3 against the closed forms at ncp = 1e12",
          run: () => {
            for (const df of [1, 3] as const) {
              for (const k of [-38, -5, 0, 5, 38]) {
                const x = (1e6 + k) ** 2;
                const r = near(dchisq(x, df, { ncp: 1e12, log: true }), nchisqDensityClosedLog(x, df, 1e12), 1e-13, `log dchisq(${x}, ${df}, ncp 1e12)`);
                if (r !== undefined) return r;
              }
            }
            return undefined;
          },
        },
        {
          kind: "check",
          label: "large df: the log density is finite",
          run: () => {
            const bad = [
              [2.0001e9, 1e6, 2e9],
              [1.1e10, 1e10, 1e9],
            ].filter(([x, df, l]) => !Number.isFinite(dchisq(x!, df!, { ncp: l!, log: true })));
            return bad.length === 0 ? undefined : bad.map(([x, df, l]) => `dchisq(${x}, ${df}, ncp ${l}, log) = ${dchisq(x!, df!, { ncp: l!, log: true })}`).join("; ");
          },
        },
      ];
    },
  },
];

// ---- distributions/nt.ts: noncentral t ----
// With ncp = 1e-300 the integral is computed as for any ncp, and its value is the central t to far below rounding

const ptn = (df: number, ncp: number) => (v: number, t: Tail) => pt(v, df, { ncp, ...t });
const grid = (from: number, step: number, n: number): number[] => Array.from({ length: n }, (_, i) => from + i * step);

const NT: Entry[] = [
  {
    where: "distributions/nt.ts:302",
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
    where: "distributions/nt.ts:63, :75, :90, :203, :206",
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
    where: "distributions/nt.ts:329, :349, :180",
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
    where: "distributions/nt.ts:365, :382, :405, :416, :485",
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
    where: "distributions/tukey.ts:237, :268, :278, :446, :482",
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
    where: "distributions/tukey.ts:461, :663",
    fns: "ptukey, qtukey",
    condition: "w > 40 (integration range around w/2); log w <= log 40 (interpolant of 1 - W)",
    methods: "interpolant of (1 - W) e^(w²/4) | direct integral on [w/2 - 15, w/2 + 15]",
    point: "q = 40 at k = 5, df = Inf",
    cases: () => pPairs("ptukey(q, 5, Inf)", ptk(5, Infinity), flipPoint((q) => Math.log(q) <= Math.log(40), 39.9, 40.1)),
  },
  {
    where: "distributions/tukey.ts:466, :476",
    fns: "ptukey, qtukey (log)",
    condition: "w > 100",
    methods: "log integral | log(k (k - 1) Φc(w/sqrt(2))) (the correction is below e^-833)",
    point: "q = 100 at k = 5, df = Inf (upper tail, log)",
    cases: () => [pair("ptukey(q, 5, Inf, upper log)", (q) => ptukey(q, 5, Infinity, { lowerTail: false, logP: true }), up(100))],
  },
  {
    where: "distributions/tukey.ts:481",
    fns: "ptukey, qtukey (deep upper tail, log)",
    condition: "lt = log(Φ(z - w)/Φ(z)) < -40 (SUSPECT: first order, relative error about k e^lt / 2 <= k 2e-18 whatever k)",
    methods: "log(-expm1((k - 1) log1p(-e^lt))) | log(k - 1) + lt",
    point:
      "reached only in the log integrals (results below 1e-290). It costs 1e-13 only for nmeans above about 1e5, where " +
      "building the interpolants takes many seconds (14 s at 1e6); tested by the continuity of the switch to the log " +
      "integral (tukey.ts:837) at nmeans = 50 (5 there)",
    cases: () => [tukeySwitch290(50)],
  },
  {
    where: "distributions/tukey.ts:616",
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
    where: "distributions/tukey.ts:647, :655",
    fns: "ptukey, qtukey",
    condition: "log w >= log 20: W = 1 (SUSPECT: assumes nmeans <= 1000, unchecked)",
    methods: "interpolant of log W | 1",
    point:
      "q = 20 at k = 5, df = Inf. 1 - W(20) is about k² Φc(14.1), above 1e-17 only for nmeans > 3e13, where the " +
      "interpolants cannot be built in reasonable time (2 min at 1e10); there the lower tail is formed as 1 - (upper) anyway",
    cases: () => pPairs("ptukey(q, 5, Inf)", ptk(5, Infinity), flipPoint((q) => Math.log(q) >= Math.log(20), 19.9, 20.1)),
  },
  {
    where: "distributions/tukey.ts:649, :650, :661",
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
    where: "distributions/tukey.ts:679",
    fns: "ptukey, qtukey (nranges > 1)",
    condition: "1 - W <= 0.5",
    methods: "1 - W^r | -expm1(r log1p(-(1 - W)))",
    point: "1 - W = 1/2 at k = 3, nranges = 2, df = Inf",
    cases: () => pPairs("ptukey(q, 3, Inf, nranges 2)", ptk(3, Infinity, 2), flipPoint((q) => ptukey(q, 3, Infinity, { lowerTail: false }) <= 0.5, 1, 3)),
  },
  {
    where: "distributions/tukey.ts:723, :746",
    fns: "ptukey, qtukey (finite df)",
    condition: "per node of the outer integral: |v| < 0.5 (series for e^v - 1 - v); t = e^u > 1e-300 (log density by dpoisRaw)",
    methods: "expm1(v) - v | series; a u - t - lgamma(a + 1) | Loader's form",
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
    where: "distributions/tukey.ts:828, :830",
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
    where: "distributions/tukey.ts:837",
    fns: "ptukey, qtukey (finite df)",
    condition: "smaller tail < 1e-290",
    methods: "linear integral | log integral",
    point: "upper tail = 1e-290 at k = 5, df = 10 (see also tukey.ts:481, at nmeans = 50)",
    cases: () => [tukeySwitch290(5)],
  },
  {
    where: "distributions/tukey.ts:864, :879",
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

// ---- Running the entries ----

const ENTRIES: Entry[] = [
  ...IGAM,
  ...IGAMI,
  ...GAMMA,
  ...INCBET,
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
  ...TUKEY,
  ...DISCRETE,
  ...INTERNAL,
  ...EXTRA,
];

/** Checks that fail at the time of writing (live bugs, not fixed here) */
const KNOWN: KnownViolation[] = [
  {
    entry: "special/incbet.ts:221",
    check: "pbeta(1 - 1e-12, a, 100) (lower log)",
    reason:
      "the continued fraction advances a + 1, a + 2, ... in double below 2^52, which is not exact for a non-integer a " +
      "near the top of its binade: log pbeta(1 - 1e-12, 2^52 - 0.5, 100) = -4029.76346, -4029.76358 at a = 2^52 and from Q(b, u)",
  },
  {
    entry: "special/incbet.ts:221",
    check: "a = nextDown(2^k) against Q(b, u)",
    reason: "the same rounding of a + 1, a + 2: the error of log P grows with a (3e-8 at a = 2^40 - 2^-13, 1.3e-4 at 2^52 - 0.5)",
  },
  {
    entry: "distributions/nchisq.ts:112",
    check: "large df: the log density is finite",
    reason:
      "the Bessel expansion diverges for ν² >> sqrt(λ x): dchisq(1.1e10, 1e10, ncp = 1e9, log) and " +
      "dchisq(2.0001e9, 1e6, ncp = 2e9, log) are NaN (normal approximation about -12.3 for the latter)",
  },
];

const HANGS: Hang[] = [
  {
    entry: "distributions/nchisq.ts:67",
    call: "pchisq(1.1e10, 1e10, { ncp: 1e9 })",
    reason: "besselTails with ν = 5e9 >> sqrt(λ x) = 3.3e9: the Bessel series diverges (NaN) and the adaptive rule bisects to depth 40",
  },
  {
    entry: "distributions/nchisq.ts:67",
    call: "pchisq(2.0003e9, 3e5, { ncp: 2e9 })",
    reason: "the same from about df = 3e5 at ncp = 2e9 (ν² = 2.25e10 > sqrt(λ x) = 2e9), although dchisq is finite there; df = 2e5 still returns",
  },
];

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
