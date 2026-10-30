// Fisher's exact test (R's fisher.test).
//
// 2x2 tables, written for rStats.js from the textbook construction and R's documented behaviour: with the margins
// fixed, the (1, 1) cell follows Fisher's noncentral hypergeometric distribution, the central hypergeometric density
// tilted by psi^x (noncentrality psi = odds ratio; Fisher 1935, Cornfield 1956). The conditional MLE is the psi whose
// mean equals the observed cell; the confidence limits are the psi at which a one-sided tail probability equals α.
// - Densities are formed in logs from the accurate log dhyper (evaluated every 16 points, exact ratios in
//   between) and normalised with double-double sums, so the root
//   search sees accurate function values; at psi = 1 the tails are the central hypergeometric distribution function
// - Roots are found with R's uniroot conventions (Brent, tolerance eps^0.25; src/internal/uniroot.ts): if the root
//   lies below 1, on psi in [0, 1]; otherwise on s = 1/psi in [eps, 1]. R's estimate and limits are where this
//   iteration stops (1e-6 to 1e-2 from the true roots), so the brackets and tolerance are part of the result
// - The two-sided p-value is the sum of probabilities of tables whose probability is at most (1 + 1e-7) times the
//   observed one (R's convention); for or = 0 or Inf the distribution is a point mass at the end of the support
// - Counts are made integer by rounding half to even (R rounds with a warning)
// The same distribution and root conventions are used for the exact Mantel-Haenszel test (src/htest/core/mantelhaen.ts).
//
// rxc tables: the probabilities of tables with fixed margins (multivariate hypergeometric) are
// traversed via a network that fixes one column at a time (Mehta & Patel 1983, JASA 78, 427-434),
// summing the probabilities of tables whose probability is at most (1 + 1e-7) times the observed
// one. A node is "the multiset of remaining row sums (sorted)". For each node the maximum and
// minimum probability of the remaining subtable are precomputed: if everything beyond a path is at
// or below the threshold, the remaining mass (a sum of conditional probabilities, hence 1) is added
// at once; if everything exceeds it, the path is dropped. Paths reaching the same node with the
// same probability are merged. For nodes with two columns left, a cumulative sum over the sorted
// values of the remaining tables is prepared and each path is added via binary search.
// Probabilities are held as double-double logarithms.
//
// Simulated p-values (r x c only; R's documented behaviour): rows and columns that are all zero are dropped, B random
// tables with the observed margins are drawn with Patefield's algorithm (src/random/r2dtable.ts), and the p-value is
// (1 + #{simulated tables with -sum log(x_ij!) <= the observed one / (1 + 64 eps)}) / (B + 1). A 2 x 2 table is always
// tested exactly.
// R's hybrid is not implemented.

import { dhyper1, phyper1 } from "../distributions/hypergeometric.js";
import { roundHalfEven } from "../internal/integer.js";
import { logFactorialTable, rcont2 } from "../random/r2dtable.js";
import { lfactorial } from "../special/choose.js";
import { uniroot } from "../internal/uniroot.js";
import { ddAdd, ddLog, ddNeg, ddSub, type DD } from "../special/dd.js";
import { simulatedMethod } from "./core/simulate.js";
import { matchAlternative, type Alternative, type HTest, type Counts } from "./types.js";
import { maxOf, minOf } from "../internal/extremes.js";

/**
 * Options for {@link fisherTest}.
 *
 * @category Hypothesis tests
 */
export interface FisherTestOptions {
  /**
   * Alternative hypothesis: `"two.sided"`, `"less"` or `"greater"`. Default `"two.sided"`.
   * Unambiguous abbreviations are accepted. Used for 2 x 2 tables only.
   */
  alternative?: Alternative | "two" | "l" | "g";
  /** Compute a confidence interval for the odds ratio (2 x 2 tables only). Default `true`. */
  confInt?: boolean;
  /** Confidence level of the interval (2 x 2 tables only). Default `0.95`. */
  confLevel?: number;
  /** Odds ratio under the null hypothesis (2 x 2 tables only). Default `1`. */
  or?: number;
  /**
   * Compute the p-value of an r x c table (larger than 2 x 2) by Monte Carlo simulation with `B` replicates (R's
   * `simulate.p.value`), using the random stream of {@link setSeed} as R does. Ignored for 2 x 2 tables. Default
   * `false`.
   */
  simulatePValue?: boolean;
  /** Number of replicates for `simulatePValue`. Default `2000`. */
  B?: number;
}

/**
 * Result of {@link fisherTest}. Has no `statistic` or `statisticName`, because R's
 * `fisher.test()` does not return a statistic. For 2 x 2 tables, `estimate` is the
 * conditional maximum likelihood estimate of the odds ratio and `confInt` its interval;
 * for larger tables only `method`, `alternative` and `pValue` are set.
 *
 * @category Hypothesis tests
 */
export interface FisherTestResult extends Omit<HTest, "statistic" | "statisticName"> {}

/**
 * Fisher's exact test for count data. Equivalent to R's `fisher.test()`.
 *
 * Tests independence in an r x c contingency table with fixed margins. For 2 x 2 tables
 * it also returns the conditional MLE of the odds ratio and its confidence interval,
 * reproducing R's numbers (including R's root-finding tolerance). The two-sided p-value
 * sums the probabilities of tables no more likely than the observed one (relative
 * tolerance `1e-7`, as in R). Non-integer counts are rounded to the nearest integer
 * (ties to even), where R warns and rounds.
 *
 * With `simulatePValue: true`, the p-value of a table larger than 2 x 2 is computed from `B` random tables with the
 * observed margins, drawn from the random stream of {@link setSeed} exactly as in R.
 *
 * Not implemented: R's `hybrid` option.
 *
 * @param x Contingency table as an array of rows (at least 2 x 2).
 * @param options See {@link FisherTestOptions}.
 * @returns The test result; see {@link FisherTestResult}.
 *
 * @example
 * ```ts
 * const r = fisherTest([[3, 1], [1, 3]]);
 * r.pValue;   // 0.4857142857142857
 * r.estimate; // 6.408308867005792 (conditional MLE of the odds ratio)
 * r.confInt;  // [0.2117329153055031, 621.9337505454175]
 * ```
 *
 * @category Hypothesis tests
 */
export function fisherTest(x: readonly Counts[], options: FisherTestOptions = {}): FisherTestResult {
  const nr = x.length;
  const nc = nr === 0 ? 0 : x[0]!.length;
  if (x.some((r) => r.length !== nc)) throw new TypeError("all rows of the matrix must have the same length");
  if (nr < 2 || nc < 2) throw new TypeError("'x' must have at least 2 rows and columns");
  const raw = x.map((r) => Array.from(r));
  if (raw.flat().some((v) => Number.isNaN(v) || v < 0)) {
    throw new RangeError("all entries of 'x' must be non-negative and finite");
  }
  if (raw.flat().some((v) => v === Infinity)) throw new RangeError("'x' has entries too large to be integer");
  const t = raw.map((r) => r.map(roundHalfEven));
  const method = "Fisher's Exact Test for Count Data";
  if (nr === 2 && nc === 2) return fisher2x2(t, options, method);
  // For rxc, alternative etc. are not validated and are returned as given (as in R)
  const alternative = (options.alternative ?? "two.sided") as Alternative;
  if (options.simulatePValue ?? false) {
    const B = options.B ?? 2000;
    if (!(B >= 0 && B < 2 ** 31)) throw new RangeError("'B' must be a non-negative number");
    return { method: method + simulatedMethod(B), alternative, pValue: fisherSimulated(t, B) };
  }
  return { method, alternative, pValue: fisherRxC(t) };
}

/** Monte Carlo p-value of an r x c table: tables with fixed margins drawn by Patefield's algorithm */
function fisherSimulated(t: number[][], B: number): number {
  const keepRows = t.filter((r) => r.some((v) => v > 0));
  const keepCols = t[0]!.map((_, j) => j).filter((j) => t.some((r) => r[j]! > 0));
  if (keepRows.length <= 1) throw new RangeError("need 2 or more non-zero row marginals");
  if (keepCols.length <= 1) throw new RangeError("need 2 or more non-zero column marginals");
  const x = keepRows.map((r) => keepCols.map((j) => r[j]!));
  const sr = x.map((r) => r.reduce((a, b) => a + b, 0));
  const sc = x[0]!.map((_, j) => x.reduce((a, r) => a + r[j]!, 0));
  const nr = sr.length;
  const nc = sc.length;
  // the observed -sum log(x_ij!), summed in double-double
  let acc: DD = [0, 0];
  for (const v of x.flat()) acc = ddAdd(acc, [-lfactorial(v), 0]);
  const threshold = acc[0] / (1 + 64 * Number.EPSILON);
  const fact = logFactorialTable(sr.reduce((a, b) => a + b, 0));
  const table = new Int32Array(nr * nc);
  let count = 0;
  const reps = Math.trunc(B);
  for (let b = 0; b < reps; b++) {
    rcont2(sr, sc, fact, table);
    let s = 0;
    for (let k = 0; k < table.length; k++) s -= fact[table[k]!]!;
    if (s <= threshold) count++;
  }
  return Math.max(0, Math.min(1, (1 + count) / (reps + 1)));
}

// ---- 2×2 ----

/** Relative slack for counting a table as "no more likely than the observed one" in the two-sided p-value */
const SLACK = 1 + 1e-7;

/** Spacing of the points at which the central log density is evaluated directly */
const ANCHOR = 16;

/** Double-double sum of v[from..to] (inclusive, clipped to the array) */
function accurateSum(v: Float64Array, from: number, to: number): number {
  let acc: DD = [0, 0];
  for (let i = Math.max(0, from); i <= Math.min(to, v.length - 1); i++) if (v[i] !== 0) acc = ddAdd(acc, [v[i]!, 0]);
  return acc[0];
}

/**
 * Fisher's noncentral hypergeometric distribution of the (1, 1) cell of a 2 x 2 table with margins fixed:
 * P(X = i; psi) proportional to dhyper(i; m, n, k) psi^i on lo..hi
 */
class OddsRatioDistribution {
  readonly lo: number;
  readonly hi: number;
  /** log dhyper(i; m, n, k) for i = lo..hi */
  private readonly logCentral: Float64Array;

  constructor(
    private readonly m: number,
    private readonly n: number,
    private readonly k: number,
  ) {
    this.lo = Math.max(0, k - n);
    this.hi = Math.min(k, m);
    this.logCentral = new Float64Array(this.hi - this.lo + 1);
    // dhyper1 at every ANCHOR-th point; in between, multiply by the exact ratio
    // c(i+1)/c(i) = (m - i)(k - i) / ((i + 1)(n - k + i + 1)) (the product stays within a few ulps)
    let anchor = 0;
    let prod = 1;
    for (let i = this.lo; i <= this.hi; i++) {
      const j = i - this.lo;
      if (j % ANCHOR === 0 || !(prod > 0 && prod < Infinity)) {
        anchor = dhyper1(i, m, n, k, true);
        prod = 1;
        this.logCentral[j] = anchor;
      } else this.logCentral[j] = anchor + Math.log(prod);
      prod *= ((m - i) * (k - i)) / ((i + 1) * (n - k + i + 1));
    }
  }

  /** Normalised density on lo..hi for 0 < psi < Infinity */
  density(psi: number): Float64Array {
    const len = this.logCentral.length;
    const lp = Math.log(psi);
    const out = new Float64Array(len);
    let top = -Infinity;
    for (let j = 0; j < len; j++) {
      const v = this.logCentral[j]! + (this.lo + j) * lp;
      out[j] = v;
      if (v > top) top = v;
    }
    // exp underflows to exactly 0 below -746; skipping those terms leaves every sum unchanged
    for (let j = 0; j < len; j++) {
      const e = out[j]! - top;
      out[j] = e < -746 ? 0 : Math.exp(e);
    }
    const total = accurateSum(out, 0, len - 1);
    for (let j = 0; j < len; j++) if (out[j] !== 0) out[j] = out[j]! / total;
    return out;
  }

  /** E[X; psi] */
  mean(psi: number): number {
    if (psi === 0) return this.lo;
    if (psi === Infinity) return this.hi;
    const d = this.density(psi);
    let acc: DD = [0, 0];
    for (let j = 0; j < d.length; j++) if (d[j] !== 0) acc = ddAdd(acc, [(this.lo + j) * d[j]!, 0]);
    return acc[0];
  }

  /** P(X <= q; psi), or P(X >= q; psi) when upper */
  tail(q: number, psi: number, upper: boolean): number {
    if (psi === 1) {
      return upper ? phyper1(q - 1, this.m, this.n, this.k, false, false) : phyper1(q, this.m, this.n, this.k, true, false);
    }
    if (psi === 0 || psi === Infinity) {
      const at = psi === 0 ? this.lo : this.hi;
      return (upper ? q <= at : q >= at) ? 1 : 0;
    }
    const d = this.density(psi);
    const j = q - this.lo;
    return upper ? accurateSum(d, j, d.length - 1) : accurateSum(d, 0, j);
  }
}

/**
 * Root of f, monotone in the odds ratio psi: searched for as psi in [0, 1] when it lies below 1, otherwise as
 * s = 1/psi in [eps, 1] (uniroot with its default tolerance in both cases)
 */
function oddsRatioRoot(f: (psi: number) => number, belowOne: boolean): number {
  return belowOne ? uniroot(f, 0, 1) : 1 / uniroot((s) => f(1 / s), Number.EPSILON, 1);
}

function fisher2x2(t: number[][], options: FisherTestOptions, method: string): FisherTestResult {
  const alternative = matchAlternative(options.alternative);
  const or = options.or ?? 1;
  if (!(or >= 0)) throw new RangeError("'or' must be a single number between 0 and Inf");
  const confLevel = options.confLevel ?? 0.95;
  if (!(confLevel > 0 && confLevel < 1)) throw new RangeError("confLevel must be a single number between 0 and 1");
  const [[a, b], [c, d]] = t as [[number, number], [number, number]];
  const x = a;
  const dist = new OddsRatioDistribution(a + c, b + d, a + b);
  const { lo, hi } = dist;

  let pValue: number;
  if (alternative === "less") pValue = dist.tail(x, or, false);
  else if (alternative === "greater") pValue = dist.tail(x, or, true);
  else if (or === 0) pValue = x === lo ? 1 : 0;
  else if (or === Infinity) pValue = x === hi ? 1 : 0;
  else {
    const dens = dist.density(or);
    const cut = dens[x - lo]! * SLACK;
    let acc: DD = [0, 0];
    for (const v of dens) if (v <= cut) acc = ddAdd(acc, [v, 0]);
    pValue = acc[0];
  }

  let estimate: number;
  if (x === lo) estimate = 0;
  else if (x === hi) estimate = Infinity;
  else {
    const mu1 = dist.mean(1);
    estimate = mu1 === x ? 1 : oddsRatioRoot((psi) => dist.mean(psi) - x, mu1 > x);
  }

  const result: FisherTestResult = {
    method,
    alternative,
    pValue,
    estimate,
    estimateNames: "odds ratio",
    nullValue: or,
    nullValueName: "odds ratio",
  };
  if (!(options.confInt ?? true)) return result;

  // P(X <= x; psi) decreases and P(X >= x; psi) increases in psi
  const upperLimit = (level: number): number => {
    if (x === hi) return Infinity;
    const p1 = dist.tail(x, 1, false);
    return p1 === level ? 1 : oddsRatioRoot((psi) => dist.tail(x, psi, false) - level, p1 < level);
  };
  const lowerLimit = (level: number): number => {
    if (x === lo) return 0;
    const p1 = dist.tail(x, 1, true);
    return p1 === level ? 1 : oddsRatioRoot((psi) => dist.tail(x, psi, true) - level, p1 > level);
  };
  let confInt: [number, number];
  if (alternative === "less") confInt = [0, upperLimit(1 - confLevel)];
  else if (alternative === "greater") confInt = [lowerLimit(1 - confLevel), Infinity];
  else {
    const alpha = (1 - confLevel) / 2;
    confInt = [lowerLimit(alpha), upperLimit(alpha)];
  }
  return { ...result, confInt, confLevel };
}

// ---- r×c ----

/** Table of log k! in double-double (extended as needed) */
const LOG_FACT: DD[] = [[0, 0]];
function logFact(k: number): DD {
  for (let i = LOG_FACT.length; i <= k; i++) LOG_FACT.push(ddAdd(LOG_FACT[i - 1]!, ddLog([i, 0])));
  return LOG_FACT[k]!;
}

/** Network node (the multiset R of remaining row sums after fixing columns up to j) */
interface NetNode {
  R: number[];
  /** The total probability of the tables beyond this node is exp(KZ + past) (KZ = K + log m! - Σ log R! - Σ (remaining columns) log c!) */
  KZ: DD;
  /** Maximum and minimum of -Σ log x! beyond this node */
  max: number;
  min: number;
  /** Edges to the next column (edges with the same destination and -Σ log x! are merged and counted in mult) */
  edges: { to: NetNode; hi: number; lo: number; mult: number }[];
  /** Bundle of paths that reached here: -Σ log x! of the fixed cells (double-double) and the number of paths */
  pastHi: number[];
  pastLo: number[];
  count: number[];
  index: Map<number, number>;
  /**
   * Only for nodes with two columns left: the values of -Σ log x! beyond (ascending, double-double) and
   * the cumulative sum of Σ mult exp(value - vmax) in increasing order of value
   */
  dist?: { hi: Float64Array; lo: Float64Array; cum: Float64Array; vmax: number; kv: DD };
}

/** Double-double sum hi + lo (simplified Dekker; exact when the summands have the same sign or differ in magnitude) */
function dd2(ah: number, al: number, bh: number, bl: number): DD {
  const s = ah + bh;
  const bb = s - ah;
  const e = ah - (s - bb) + (bh - bb) + al + bl;
  const h = s + e;
  return [h, e - (h - s)];
}

/** A sum of probabilities held as a sum of log-shifted values (avoids overflow and underflow to 0) */
class LogSum {
  private scale = -Infinity;
  private hi = 0;
  private lo = 0;

  /** Add w × exp(lh + ll) */
  add(lh: number, ll: number, w: number): void {
    if (lh > this.scale) {
      const r = Number.isFinite(this.scale) ? Math.exp(this.scale - lh) : 0;
      this.hi *= r;
      this.lo *= r;
      this.scale = lh;
    }
    const v = w * Math.exp(lh - this.scale) * (1 + ll);
    const s = this.hi + v;
    const bb = s - this.hi;
    const e = this.hi - (s - bb) + (v - bb) + this.lo;
    this.hi = s + e;
    this.lo = e - (this.hi - s);
  }

  value(): number {
    return this.scale === -Infinity ? 0 : this.hi * Math.exp(this.scale);
  }
}

function fisherRxC(t: number[][]): number {
  // Drop rows and columns with zero sum (they do not affect the probability)
  let rows = t.filter((r) => r.some((v) => v > 0));
  if (rows.length === 0) throw new RangeError("all entries of the table are zero");
  const keep = rows[0]!.map((_, j) => rows.some((r) => r[j]! > 0));
  rows = rows.map((r) => r.filter((_, j) => keep[j]));
  if (rows.length < 2 || rows[0]!.length < 2) return 1;
  // Fewer rows means fewer nodes and edges, so orient the table with rows <= columns
  if (rows.length > rows[0]!.length) rows = rows[0]!.map((_, j) => rows.map((r) => r[j]!));
  const nr = rows.length;
  const rowSums = rows.map((r) => r.reduce((a, b) => a + b, 0));
  // Traverse columns in decreasing order (remaining row sums shrink sooner, giving fewer nodes)
  const colSums = rows[0]!.map((_, j) => rows.reduce((a, r) => a + r[j]!, 0)).sort((a, b) => b - a);
  const ncol = colSums.length;
  const total = rowSums.reduce((a, b) => a + b, 0);

  // Table probability = exp(K - Σ log x!), K = Σ log r! + Σ log c! - log n!
  let K: DD = ddNeg(logFact(total));
  for (const r of rowSums) K = ddAdd(K, logFact(r));
  for (const c of colSums) K = ddAdd(K, logFact(c));
  let obs: DD = [0, 0];
  for (const v of rows.flat()) obs = ddSub(obs, logFact(v));
  // Threshold: -Σ log x! <= obs + log(1 + 1e-7)
  const thr = ddAdd(obs, [Math.log1p(1e-7), 0]);
  // The upper and lower bounds are in double precision, so near the threshold do not decide early; keep going
  const margin = 1e-9 * (1 + Math.abs(thr[0]));
  const [thrHi, thrLo] = thr;

  // Build the network (a node at stage j is determined by the multiset R of remaining row sums; R is ascending)
  const levels: Map<string, NetNode>[] = Array.from({ length: ncol }, () => new Map());
  const nodeOf = (j: number, R: number[]): NetNode => {
    const key = R.join(",");
    const hit = levels[j]!.get(key);
    if (hit !== undefined) return hit;
    let KZ: DD = ddAdd(K, logFact(R.reduce((a, b) => a + b, 0)));
    for (const r of R) KZ = ddSub(KZ, logFact(r));
    for (let jj = j; jj < ncol; jj++) KZ = ddSub(KZ, logFact(colSums[jj]!));
    const node: NetNode = { R, KZ, max: 0, min: 0, edges: [], pastHi: [], pastLo: [], count: [], index: new Map() };
    levels[j]!.set(key, node);
    if (j === ncol - 1) {
      // The last column is determined by the remaining row sums
      let v: DD = [0, 0];
      for (const r of R) v = ddSub(v, logFact(r));
      node.max = node.min = v[0];
      node.edges.push({ to: node, hi: v[0], lo: v[1], mult: 1 });
      return node;
    }
    // Enumerate the cell combinations xs of column j (0 <= xs[i] <= R[i], summing to colSums[j])
    const groups = new Map<string, { to: NetNode; hi: number; lo: number; mult: number }>();
    const tail = new Array<number>(nr + 1).fill(0);
    for (let i = nr - 1; i >= 0; i--) tail[i] = tail[i + 1]! + R[i]!;
    const xs = new Array<number>(nr).fill(0);
    const rec = (i: number, rest: number, edge: DD): void => {
      if (i === nr - 1) {
        xs[i] = rest;
        const e = ddSub(edge, logFact(rest));
        const R2 = R.map((r, k) => r - xs[k]!).sort((a, b) => a - b);
        const to = nodeOf(j + 1, R2);
        const gk = `${R2.join(",")}|${e[0]}`;
        const g = groups.get(gk);
        if (g === undefined) groups.set(gk, { to, hi: e[0], lo: e[1], mult: 1 });
        else g.mult++;
        return;
      }
      const from = Math.max(0, rest - tail[i + 1]!);
      const to = Math.min(R[i]!, rest);
      for (let v = from; v <= to; v++) {
        xs[i] = v;
        rec(i + 1, rest - v, ddSub(edge, logFact(v)));
      }
    };
    rec(0, colSums[j]!, [0, 0]);
    node.edges = [...groups.values()];
    node.max = maxOf(node.edges.map((e) => e.hi + e.to.max));
    node.min = minOf(node.edges.map((e) => e.hi + e.to.min));
    if (j === ncol - 2) {
      // With two columns left, the rest of the table is determined by a single edge. Sort by value and take cumulative sums,
      // then find the threshold position per path by binary search (reducing paths × edges work to paths × log(edges))
      const vals = node.edges.map((e) => {
        const leaf = e.to.edges[0]!;
        return { v: ddAdd([e.hi, e.lo], [leaf.hi, leaf.lo]), mult: e.mult };
      });
      vals.sort((a, b) => a.v[0] - b.v[0] || a.v[1] - b.v[1]);
      const n = vals.length;
      const vmax = vals[n - 1]!.v[0];
      const hi = new Float64Array(n);
      const lo = new Float64Array(n);
      const cum = new Float64Array(n);
      let acc: DD = [0, 0];
      vals.forEach(({ v, mult }, i) => {
        hi[i] = v[0];
        lo[i] = v[1];
        const d = ddSub(v, [vmax, 0]);
        acc = ddAdd(acc, [mult * Math.exp(d[0]) * (1 + d[1]), 0]);
        cum[i] = acc[0];
      });
      node.dist = { hi, lo, cum, vmax, kv: ddAdd(K, [vmax, 0]) };
    }
    return node;
  };
  const root = nodeOf(0, [...rowSums].sort((a, b) => a - b));

  const p = new LogSum();
  /**
   * Settle count paths that reached a node with past, without enumerating beyond. If everything beyond is below the threshold,
   * add them all; if everything exceeds it, drop them; with two columns left, add via binary search. Returns false if unsettled
   */
  const settle = (node: NetNode, ph: number, pl: number, count: number): boolean => {
    if (ph + node.max <= thrHi - margin) {
      const [lh, ll] = dd2(node.KZ[0], node.KZ[1], ph, pl);
      p.add(lh, ll, count);
      return true;
    }
    if (ph + node.min > thrHi + margin) return true;
    const dist = node.dist;
    if (dist === undefined) return false;
    // Sum of the values v beyond such that past + v <= thr (v <= thr - past)
    const [ch, cl] = dd2(thrHi, thrLo, -ph, -pl);
    let a = 0;
    let b = dist.hi.length;
    while (a < b) {
      const mid = (a + b) >>> 1;
      const vh = dist.hi[mid]!;
      if (vh < ch || (vh === ch && dist.lo[mid]! <= cl)) a = mid + 1;
      else b = mid;
    }
    if (a > 0) {
      const [lh, ll] = dd2(dist.kv[0], dist.kv[1], ph, pl);
      p.add(lh, ll, count * dist.cum[a - 1]!);
    }
    return true;
  };

  if (!settle(root, 0, 0, 1)) {
    root.pastHi.push(0);
    root.pastLo.push(0);
    root.count.push(1);
  }
  for (let j = 0; j < ncol - 2; j++) {
    for (const node of levels[j]!.values()) {
      const { pastHi, pastLo, count } = node;
      if (count.length === 0) continue;
      for (const { to, hi: eh, lo: el, mult } of node.edges) {
        for (let i = 0; i < count.length; i++) {
          // Both signs are negative, so the simplified double-double sum suffices
          const [h, l] = dd2(pastHi[i]!, pastLo[i]!, eh, el);
          const c = count[i]! * mult;
          if (settle(to, h, l, c)) continue;
          // Unsettled paths with the same value are merged and advanced at the next stage
          const k = to.index.get(h);
          if (k === undefined) {
            to.index.set(h, to.count.length);
            to.pastHi.push(h);
            to.pastLo.push(l);
            to.count.push(c);
          } else to.count[k]! += c;
        }
      }
      // Discard paths that have been used
      node.pastHi = node.pastLo = node.count = [];
      node.index.clear();
    }
  }
  return Math.min(1, p.value());
}
