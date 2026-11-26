// Time-dependent ROC curves for censored event times (1.19.0): timeROC's estimators (Blanche, Dartigues and
// Jacqmin-Gadda 2013) with marginal (Kaplan-Meier), Cox or Aalen inverse probability of censoring weights, a single
// event or competing risks, the iid representation and the standard errors, confint, compare and SeSpPPVNPV; and
// survivalROC's Kaplan-Meier estimator (Heagerty, Lumley and Pepe 2000). The behaviour is in
// oracle/tdroc-behaviour.md, the R experiments behind it in experiments/tdroc119-*.R (log experiments/tdroc119-log.md).
//
// Every estimate is a ratio of weighted totals W(f) = sum_i w_i f_i / n, w_i the subject's weight at the evaluation
// time t: 1 / G(T_i-) for a subject with an event at T_i <= t, 1 / G(t) for a subject with T_i > t, 0 otherwise. With
// the marginal weights, the influence of a total is w_k f_k - W + Q_k, Q_k the censoring martingale's term
// sum_u (dN_k(u) - Y_k(u) dLambda(u)) V(u) / R(u), V(u) the weighted mass whose weight runs through u (computed per
// distinct time, so that each total costs O(n)). This is the tie-correct form chosen by the user (2026-11-26): without
// tied times it equals R's iid; with ties R mixes a by-time jump with a positional compensator and depends on the
// data order within ties, which is not followed here.
import { pnorm, qnorm, pnorm1, qnorm1 } from "../distributions/normal.js";
import { pbvnorm } from "../distributions/bvnorm.js";
import { quantile } from "../descriptive/quantile.js";
import { normRand } from "../random/rng.js";
import { survfitCoxph } from "../models/survfitCoxph.js";

/** The censoring weights of {@link timeROC}: marginal (Kaplan-Meier), Cox or Aalen. */
export type TimeROCWeighting = "marginal" | "cox" | "aalen";

/**
 * Options for {@link timeROC}.
 *
 * @category Diagnostic tests
 */
export interface TimeROCOptions {
  /** Evaluation times (required; used as given: R adds 0 to a single time). */
  times: readonly number[];
  /** The event of interest among the values of `delta`. Default 1. */
  cause?: number;
  /** Censoring weights: `"marginal"` (default, Kaplan-Meier), `"cox"` or `"aalen"` (models of the censoring with the
   * marker and `otherMarkers` as covariates). */
  weighting?: TimeROCWeighting;
  /** Further covariates of the censoring model (one row per subject), for `"cox"` and `"aalen"`. */
  otherMarkers?: readonly (readonly number[])[];
  /** Compute the iid representation and the standard errors (marginal weights only). Default false. */
  iid?: boolean;
  /** Return the TP and FP curves. Default true. */
  roc?: boolean;
}

/** Counts per evaluation time: cases (T < t, the cause), survivors (T > t), other events before t (competing risks
 * only) and the rest ("censored at t": censored by t, or with an event at t). */
export interface TimeROCStats {
  cases: number;
  survivors: number;
  otherEvents?: number;
  censored: number;
}

/** The weights of a {@link timeROC} fit, subjects in the order of the sorted times. */
export type TimeROCWeights =
  | { method: "marginal"; /** G(t) per time. */ ipcwTimes: number[]; /** G(T_i-) per subject. */ ipcwSubjectTimes: number[] }
  | { method: "cox" | "aalen"; /** G(t | Z_i) per time and subject. */ ipcwTimes: number[][]; /** G(T_i- | Z_i). */ ipcwSubjectTimes: number[] };

interface TimeROCCommon {
  /** The evaluation times. */
  times: number[];
  /** Number of subjects. */
  n: number;
  /** Cumulative incidence of the cause at each time (the cases' weights over n). */
  cumulativeIncidence: number[];
  /** Kaplan-Meier probability of no event of any kind at each time. */
  survProb: number[];
  /** Counts per time. */
  stats: TimeROCStats[];
  /** The censoring weights. */
  weights: TimeROCWeights;
  /** True positive rates per time, one per distinct marker value from the largest ("marker > value") and a last 1. */
  tp?: number[][];
}

/**
 * Result of {@link timeROC} without competing risks.
 *
 * @category Diagnostic tests
 */
export interface TimeROCSingle extends TimeROCCommon {
  competingRisks: false;
  /** The cumulative/dynamic AUC at each time. */
  auc: number[];
  /** False positive rates per time (controls: T > t). */
  fp?: number[][];
  /** With `iid`: the iid representation (per time, subjects in the order of the sorted times) and the standard errors. */
  inference?: { iid: number[][]; sd: number[] };
}

/**
 * Result of {@link timeROC} with competing risks: definition (i) has the controls T > t, definition (ii) also the
 * subjects with another event before t.
 *
 * @category Diagnostic tests
 */
export interface TimeROCCompeting extends TimeROCCommon {
  competingRisks: true;
  auc1: number[];
  auc2: number[];
  fp1?: number[][];
  fp2?: number[][];
  inference?: { iid1: number[][]; sd1: number[]; iid2: number[][]; sd2: number[] };
}

/**
 * Result of {@link timeROC}.
 *
 * @category Diagnostic tests
 */
export type TimeROCResult = TimeROCSingle | TimeROCCompeting;

/** What compare needs to check that two fits come from the same subjects. */
const fitData = new WeakMap<object, { time: readonly number[]; delta: readonly number[] }>();

// ---------------------------------------------------------------------------------------------------------------
// Data and the censoring Kaplan-Meier

/** @internal */
export interface Data {
  n: number;
  time: number[];
  delta: number[];
  marker: number[];
  /** Subjects in the order of the sorted times (ties in the data order). */
  order: number[];
  /** Distinct times, increasing. */
  u: number[];
  /** Each subject's index in u. */
  ti: number[];
  /** Censoring risk set at u: T > u, or censored at u (the events at u are left out). */
  R: number[];
  /** Number censored at u. */
  C: number[];
  /** Censoring KM after each u: G(u). */
  G: number[];
}

function checkVector(x: readonly number[], what: string, allowNaN = false): number[] {
  if (!Array.isArray(x) && !ArrayBuffer.isView(x)) throw new TypeError(`'${what}' must be an array of numbers`);
  const v = Array.from(x as ArrayLike<number>);
  for (const e of v) {
    if (typeof e !== "number") throw new TypeError(`'${what}' must be an array of numbers`);
    if (Number.isNaN(e) ? !allowNaN : !Number.isFinite(e)) throw new RangeError(`'${what}' must contain finite numbers${allowNaN ? " (or NaN for NA)" : ""}`);
  }
  return v;
}

/** The subjects without NaN (R's NA) in time, delta, marker and the other markers, as R drops them. */
function completeCases(time: readonly number[], delta: readonly number[], marker: readonly number[], other?: readonly (readonly number[])[]): number[] {
  const t = checkVector(time, "time", true);
  const d = checkVector(delta, "delta", true);
  const m = checkVector(marker, "marker", true);
  if (d.length !== t.length || m.length !== t.length) throw new RangeError("'time', 'delta' and 'marker' must have the same length");
  return t.map((_, i) => i).filter((i) => !Number.isNaN(t[i]!) && !Number.isNaN(d[i]!) && !Number.isNaN(m[i]!) && !(other?.[i]?.some((v) => Number.isNaN(v)) ?? false));
}

function prepare(time: readonly number[], delta: readonly number[], marker: readonly number[]): Data {
  const t = checkVector(time, "time");
  const d = checkVector(delta, "delta");
  const m = checkVector(marker, "marker");
  const n = t.length;
  if (n === 0) throw new RangeError("no subjects");
  if (d.length !== n || m.length !== n) throw new RangeError("'time', 'delta' and 'marker' must have the same length");
  for (const e of d) if (!Number.isInteger(e) || e < 0) throw new RangeError("'delta' must hold non-negative integers (0 censored)");
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => t[a]! - t[b]! || a - b);
  const u: number[] = [];
  const ti = new Array<number>(n);
  for (const i of order) {
    if (u.length === 0 || t[i]! !== u[u.length - 1]) u.push(t[i]!);
    ti[i] = u.length - 1;
  }
  const m_ = u.length;
  const atRiskFrom = new Array<number>(m_ + 1).fill(0); // #(T >= u_m)
  const C = new Array<number>(m_).fill(0);
  const ev = new Array<number>(m_).fill(0);
  for (let i = 0; i < n; i++) {
    atRiskFrom[ti[i]!]!++;
    if (d[i] === 0) C[ti[i]!]!++;
    else ev[ti[i]!]!++;
  }
  for (let k = m_ - 1; k >= 0; k--) atRiskFrom[k]! += atRiskFrom[k + 1]!;
  const R = u.map((_, k) => atRiskFrom[k]! - ev[k]!);
  const G = new Array<number>(m_);
  let g = 1;
  for (let k = 0; k < m_; k++) {
    if (R[k]! > 0) g *= 1 - C[k]! / R[k]!;
    G[k] = g;
  }
  return { n, time: t, delta: d, marker: m, order, u, ti, R, C, G };
}

/** Index of the last distinct time <= s (or < s with strict), -1 if none. */
function lastIndex(u: readonly number[], s: number, strict: boolean): number {
  let lo = 0;
  let hi = u.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (strict ? u[mid]! < s : u[mid]! <= s) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

// ---------------------------------------------------------------------------------------------------------------
// Weights at an evaluation time and the influence of weighted totals

/** @internal */
export interface AtTime {
  t: number;
  /** Weight of each subject (0 for those with none). */
  w: number[];
  /** The weight is 1 / G(T_i-) (true) or 1 / G(t) (false); only meaningful where w > 0. */
  left: boolean[];
  /** Roles: 1 case, 2 control (T > t), 3 other event before t, 4 an event at exactly t, 0 none. */
  role: number[];
}

function weightsAt(data: Data, t: number, cause: number, gLeft: (i: number) => number, gAt: (i: number) => number): AtTime {
  const { n, time, delta } = data;
  const w = new Array<number>(n).fill(0);
  const left = new Array<boolean>(n).fill(false);
  const role = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const T = time[i]!;
    if (T > t) {
      role[i] = 2;
      w[i] = 1 / gAt(i);
    } else if (delta[i] !== 0) {
      role[i] = T < t ? (delta[i] === cause ? 1 : 3) : 4;
      w[i] = 1 / gLeft(i);
      left[i] = true;
    }
  }
  return { t, w, left, role };
}

/** The marginal weights' left and at-t censoring probabilities. */
function marginalG(data: Data, t: number): { gLeft: (i: number) => number; gAt: (i: number) => number; Gt: number } {
  const k = lastIndex(data.u, t, false);
  const Gt = k >= 0 ? data.G[k]! : 1;
  return { gLeft: (i) => (data.ti[i]! > 0 ? data.G[data.ti[i]! - 1]! : 1), gAt: () => Gt, Gt };
}

/** A weighted total and its influence (marginal weights): value sum w f / n and w_k f_k - W + Q_k. */
/** @internal */
export interface Total {
  value: number;
  inf: number[];
}

/**
 * The influence of W(f) = sum_i w_i f_i / n. `exact` takes the derivative of the weighted Kaplan-Meier itself
 * (1 / (R - C) in place of 1 / R; used by the tests' infinitesimal jackknife), the default the usual asymptotic form.
 */
function total(data: Data, at: AtTime, f: readonly number[], exact = false): Total {
  const { n, u, ti, R, C, delta } = data;
  const m = u.length;
  const acc = new Array<number>(m).fill(0);
  let atT = 0;
  let value = 0;
  for (let i = 0; i < n; i++) {
    const wf = at.w[i]! * f[i]!;
    if (wf === 0) continue;
    value += wf;
    if (at.left[i]) acc[ti[i]!]! += wf;
    else atT += wf;
  }
  value /= n;
  // V(u_k) = sum over the left weights with T_i > u_k + [u_k <= t] the at-t mass; g = V / D
  const g = new Array<number>(m).fill(0);
  let suffix = 0;
  for (let k = m - 1; k >= 0; k--) {
    const V = suffix + (u[k]! <= at.t ? atT : 0);
    const D = exact ? R[k]! - C[k]! : R[k]!;
    g[k] = D > 0 ? V / D : 0;
    suffix += acc[k]!;
  }
  const comp = new Array<number>(m + 1).fill(0); // sum_{u' < u_k} dLambda g
  for (let k = 0; k < m; k++) comp[k + 1] = comp[k]! + (R[k]! > 0 ? (C[k]! / R[k]!) * g[k]! : 0);
  const inf = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const k = ti[i]!;
    let q = -comp[k]!;
    if (delta[i] === 0) q += g[k]! - (R[k]! > 0 ? (C[k]! / R[k]!) * g[k]! : 0);
    inf[i] = at.w[i]! * f[i]! - value + q;
  }
  return { value, inf };
}

/** Influence of a ratio a / b of totals. */
function ratioInf(a: Total, b: Total): number[] {
  const r = a.value / b.value;
  return a.inf.map((x, k) => (x - r * b.inf[k]!) / b.value);
}

/** sum_ij h_ij a_i c_j / n^2 for the cases (role 1) against the controls in `isControl`, with each subject's partial sum. */
function concordance(data: Data, at: AtTime, isControl: (r: number) => boolean): { N: number; v: number[] } {
  const { n, marker } = data;
  const cases: number[] = [];
  const ctrls: number[] = [];
  for (let i = 0; i < n; i++) {
    if (at.role[i] === 1) cases.push(i);
    else if (isControl(at.role[i]!)) ctrls.push(i);
  }
  // A_i = sum_ctrl c_j h_ij, B_j = sum_case a_i h_ij, by sorting both groups by the marker
  const cumBelow = (group: number[]): ((x: number) => number) => {
    const s = [...group].sort((a, b) => marker[a]! - marker[b]!);
    const vals: number[] = [];
    const cum: number[] = [0];
    const eq: number[] = [];
    for (const j of s) {
      if (vals.length && vals[vals.length - 1] === marker[j]) {
        eq[eq.length - 1]! += at.w[j]!;
        cum[cum.length - 1]! += at.w[j]!;
      } else {
        vals.push(marker[j]!);
        eq.push(at.w[j]!);
        cum.push(cum[cum.length - 1]! + at.w[j]!);
      }
    }
    // weight strictly below x plus half the weight equal to x
    return (x: number) => {
      let lo = 0;
      let hi = vals.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (vals[mid]! < x) lo = mid + 1;
        else hi = mid;
      }
      return cum[lo]! + (lo < vals.length && vals[lo] === x ? eq[lo]! / 2 : 0);
    };
  };
  const totalOf = (group: number[]) => group.reduce((s, j) => s + at.w[j]!, 0);
  const belowCtrl = cumBelow(ctrls);
  const belowCase = cumBelow(cases);
  const caseTotal = totalOf(cases);
  const v = new Array<number>(n).fill(0);
  let N = 0;
  for (const i of cases) {
    const A = belowCtrl(marker[i]!);
    v[i] = A / n;
    N += at.w[i]! * A;
  }
  // B_j = sum_case a_i ([M_i > M_j] + [M_i = M_j] / 2) = caseTotal - (weight below M_j + half equal)
  for (const j of ctrls) v[j] = (caseTotal - belowCase(marker[j]!)) / n;
  return { N: N / (n * n), v };
}

/** TP or FP curve: the weighted proportion of the group above each distinct marker value, decreasing, then 1. */
function curve(data: Data, at: AtTime, inGroup: (r: number) => boolean, cuts: readonly number[]): number[] {
  const { n, marker } = data;
  let tot = 0;
  const idx: number[] = [];
  for (let i = 0; i < n; i++) if (inGroup(at.role[i]!)) {
    tot += at.w[i]!;
    idx.push(i);
  }
  idx.sort((a, b) => marker[b]! - marker[a]!);
  const out: number[] = [];
  let p = 0;
  let acc = 0;
  for (const c of cuts) {
    while (p < idx.length && marker[idx[p]!]! > c) acc += at.w[idx[p++]!]!;
    out.push(acc / tot);
  }
  out.push(1);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Conditional censoring weights: Cox and Aalen

interface Conditional {
  /** G(T_i- | Z_i). */
  left: number[];
  /** G(t | Z_i) per time. */
  at: number[][];
}

function covariates(data: Data, other: readonly (readonly number[])[] | undefined): number[][] {
  const { n, marker } = data;
  if (other !== undefined) {
    if (!Array.isArray(other) || other.length !== n) throw new RangeError("'otherMarkers' must have one row per subject");
    const p = other[0]?.length ?? 0;
    for (const row of other) {
      if (!Array.isArray(row)) throw new TypeError("'otherMarkers' must be an array of rows");
      if (row.length !== p) throw new RangeError("the rows of 'otherMarkers' must have the same length");
      for (const e of row as readonly unknown[]) if (typeof e !== "number" || !Number.isFinite(e)) throw new RangeError("'otherMarkers' must contain finite numbers (or NaN for NA)");
    }
  }
  return marker.map((m, i) => [m, ...(other?.[i] ?? [])]);
}

function coxWeights(data: Data, Z: number[][], times: readonly number[]): Conditional {
  const { n, time, delta } = data;
  if (!delta.some((d) => d === 0)) return { left: new Array(n).fill(1), at: times.map(() => new Array(n).fill(1)) };
  // One curve at the fit's means and S_i = S_0^exp(beta'(z_i - means)), the relation of survfit's curves for a Cox fit
  // (exp(-H_0 exp(lp))), so that n curves cost one. timefix off: the weights depend on the order of the times only
  // (aeqSurv's tolerance would merge tiny or nearly equal times).
  const sf = survfitCoxph(time, delta.map((d) => (d === 0 ? 1 : 0)), Z, { ties: "efron", confType: "none", control: { timefix: false } });
  const beta = sf.fit.coefficients.map((b) => (Number.isNaN(b) ? 0 : b)); // aliased columns: R's NA, no effect
  const means = sf.fit.means;
  const H0 = sf.surv[0]!.map((v) => -Math.log(v));
  const risk = Z.map((z) => Math.exp(z.reduce((acc, v, j) => acc + beta[j]! * (v - means[j]!), 0)));
  const read = (i: number, s: number, strict: boolean) => {
    const k = lastIndex(sf.time, s, strict);
    return k >= 0 ? Math.exp(-H0[k]! * risk[i]!) : 1;
  };
  return {
    left: Array.from({ length: n }, (_, i) => read(i, time[i]!, true)),
    at: times.map((t) => Array.from({ length: n }, (_, i) => read(i, t, false))),
  };
}

/** Solves the small symmetric system A x = b by Gaussian elimination with partial pivoting; null if singular. */
function solveSmall(A: number[][], b: number[]): number[] | null {
  const p = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  const scale = Math.max(...A.map((row, i) => Math.abs(row[i]!)));
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    if (!(Math.abs(M[piv]![c]!) > 1e-10 * scale)) return null;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    for (let r = c + 1; r < p; r++) {
      const f = M[r]![c]! / M[c]![c]!;
      for (let k = c; k <= p; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  const x = new Array<number>(p).fill(0);
  for (let r = p - 1; r >= 0; r--) {
    let s = M[r]![p]!;
    for (let k = r + 1; k < p; k++) s -= M[r]![k]! * x[k]!;
    x[r] = s / M[r]![r]!;
  }
  return x;
}

/**
 * Aalen's additive hazards model of the censoring, least-squares increments at each censoring time over the risk set
 * of the marginal weights (T > u, or censored at u), the tied censorings of a time together (R's timereg breaks ties
 * with random noise; Choice 2). The covariates enter centred and scaled by powers of 2, which leaves the fitted G
 * unchanged (the same linear span) and keeps X'X in range; columns dependent on the earlier ones are left out. From the
 * first singular X'X on (too few subjects at risk), G is kept.
 */
function aalenWeights(data: Data, Z: number[][], times: readonly number[]): Conditional {
  const { n, delta, u, ti, C } = data;
  const q = Z[0]!.length;
  const X = Z.map(() => [1]);
  for (let j = 0; j < q; j++) {
    const col = Z.map((r) => r[j]!);
    const mid = (Math.max(...col) + Math.min(...col)) / 2;
    const half = (Math.max(...col) - Math.min(...col)) / 2;
    const s = half > 0 ? 2 ** Math.round(Math.log2(half)) : 1;
    for (let i = 0; i < n; i++) X[i]!.push((col[i]! - mid) / s);
  }
  // columns dependent on the intercept and the earlier ones (a constant or collinear covariate: R's NA) are left out,
  // by Gram-Schmidt on the centred and scaled columns
  const basis: number[][] = [];
  const keep: number[] = [];
  for (let j = 1; j <= q; j++) {
    const v = X.map((r) => r[j]!);
    const m = v.reduce((a, b) => a + b, 0) / n;
    const w = v.map((x) => x - m);
    const norm0 = Math.hypot(...w);
    for (const b of basis) {
      const dot = w.reduce((a, x, i) => a + x * b[i]!, 0);
      for (let i = 0; i < n; i++) w[i]! -= dot * b[i]!;
    }
    const norm = Math.hypot(...w);
    if (norm0 > 0 && norm > 1e-7 * norm0) {
      basis.push(w.map((x) => x / norm));
      keep.push(j);
    }
  }
  for (let i = 0; i < n; i++) X[i] = [1, ...keep.map((j) => X[i]![j]!)];
  const p = keep.length + 1;
  // cumulative B after each distinct time (rows of u), increments only at censoring times
  const B: number[][] = [];
  let cur = new Array<number>(p).fill(0);
  let stopped = false;
  const byTime: number[][] = u.map(() => []);
  for (let i = 0; i < n; i++) byTime[ti[i]!]!.push(i);
  // risk set at u_k: T > u_k or censored at u_k; built from the latest times backwards
  const XtX: number[][][] = [];
  const acc = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let k = u.length - 1; k >= 0; k--) {
    for (const i of byTime[k]!) if (delta[i] === 0) for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) acc[a]![b]! += X[i]![a]! * X[i]![b]!;
    XtX[k] = acc.map((r) => [...r]);
    for (const i of byTime[k]!) if (delta[i] !== 0) for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) acc[a]![b]! += X[i]![a]! * X[i]![b]!;
  }
  for (let k = 0; k < u.length; k++) {
    if (!stopped && C[k]! > 0) {
      const rhs = new Array<number>(p).fill(0);
      for (const i of byTime[k]!) if (delta[i] === 0) for (let a = 0; a < p; a++) rhs[a]! += X[i]![a]!;
      const dB = solveSmall(XtX[k]!, rhs);
      if (dB === null) stopped = true;
      else cur = cur.map((x, a) => x + dB[a]!);
    }
    B.push(cur);
  }
  const G = (i: number, k: number) => {
    if (k < 0) return 1;
    let eta = 0;
    for (let a = 0; a < p; a++) eta += X[i]![a]! * B[k]![a]!;
    return Math.min(1, Math.max(0, Math.exp(-eta)));
  };
  return {
    left: Array.from({ length: n }, (_, i) => G(i, ti[i]! - 1)),
    at: times.map((t) => {
      const k = lastIndex(u, t, false);
      return Array.from({ length: n }, (_, i) => G(i, k));
    }),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// timeROC

interface Prepared {
  data: Data;
  cause: number;
  competing: boolean;
  times: number[];
  weighting: TimeROCWeighting;
  cond: Conditional | null;
}

function prepareFit(time: readonly number[], delta: readonly number[], marker: readonly number[], options: {
  times: readonly number[]; cause?: number; weighting?: TimeROCWeighting; otherMarkers?: readonly (readonly number[])[];
}, fn: string): Prepared {
  if (options === null || typeof options !== "object") throw new TypeError(`${fn}: 'options' with 'times' is required`);
  if (options.otherMarkers !== undefined && (!Array.isArray(options.otherMarkers) || options.otherMarkers.length !== time.length))
    throw new RangeError("'otherMarkers' must have one row per subject");
  const keep = completeCases(time, delta, marker, options.otherMarkers);
  const data = prepare(keep.map((i) => time[i]!), keep.map((i) => delta[i]!), keep.map((i) => marker[i]!));
  const otherMarkers = options.otherMarkers === undefined ? undefined : keep.map((i) => options.otherMarkers![i]!);
  const times = checkVector(options.times ?? [], "times");
  if (times.length === 0) throw new RangeError("'times' must have at least one time");
  const cause = options.cause ?? 1;
  if (!Number.isInteger(cause) || cause <= 0) throw new RangeError("'cause' must be a positive integer");
  const weighting = options.weighting ?? "marginal";
  if (!["marginal", "cox", "aalen"].includes(weighting)) throw new RangeError(`'weighting' must be "marginal", "cox" or "aalen"`);
  if (options.otherMarkers !== undefined && weighting === "marginal") throw new RangeError("'otherMarkers' is used by the cox and aalen weights only");
  const competing = data.delta.some((d) => d !== 0 && d !== cause);
  let cond: Conditional | null = null;
  if (weighting !== "marginal") {
    const Z = covariates(data, otherMarkers);
    cond = weighting === "cox" ? coxWeights(data, Z, times) : aalenWeights(data, Z, times);
  }
  return { data, cause, competing, times, weighting, cond };
}

function atTimes(p: Prepared): AtTime[] {
  return p.times.map((t, j) =>
    p.cond === null
      ? (() => {
          const g = marginalG(p.data, t);
          return weightsAt(p.data, t, p.cause, g.gLeft, g.gAt);
        })()
      : weightsAt(p.data, t, p.cause, (i) => p.cond!.left[i]!, (i) => p.cond!.at[j]![i]!),
  );
}

function statsOf(at: AtTime, competing: boolean): TimeROCStats {
  let cases = 0;
  let survivors = 0;
  let other = 0;
  for (const r of at.role) {
    if (r === 1) cases++;
    else if (r === 2) survivors++;
    else if (r === 3) other++;
  }
  const n = at.role.length;
  return competing ? { cases, survivors, otherEvents: other, censored: n - cases - survivors - other } : { cases, survivors, censored: n - cases - survivors };
}

const sorted = (data: Data, v: readonly number[]) => data.order.map((i) => v[i]!);
const sdOver = (x: readonly number[]) => {
  const n = x.length;
  const m = x.reduce((s, v) => s + v, 0) / n;
  return Math.sqrt(x.reduce((s, v) => s + (v - m) * (v - m), 0) / (n - 1) / n);
};

/** The AUC's influence: definition "i" (controls T > t) or "ii" (with the other events before t). @internal */
export function aucInfluence(data: Data, at: AtTime, definition: "i" | "ii", exact = false): { auc: number; inf: number[] } {
  const isCtrl = definition === "i" ? (r: number) => r === 2 : (r: number) => r === 2 || r === 3;
  const { N, v } = concordance(data, at, isCtrl);
  const Nt = total(data, at, v, exact);
  const IFN = Nt.inf; // W(v) = 2N, so the total's influence w v - 2N + Q is IF(N)
  const F = total(data, at, at.role.map((r) => (r === 1 ? 1 : 0)), exact);
  let S: Total;
  if (definition === "i") S = total(data, at, at.role.map((r) => (r === 2 ? 1 : 0)), exact);
  else {
    // S = 1 - F - M, M the mass of the events at exactly t: IF(S) = -IF(F) - IF(M) (R's form when M = 0)
    const M = total(data, at, at.role.map((r) => (r === 4 ? 1 : 0)), exact);
    const Sv = total(data, at, at.role.map((r) => (r === 2 || r === 3 ? 1 : 0)), exact).value;
    S = { value: Sv, inf: F.inf.map((x, k) => -x - M.inf[k]!) };
  }
  const auc = N / (F.value * S.value);
  const inf = IFN.map((x, k) => (x - auc * (S.value * F.inf[k]! + F.value * S.inf[k]!)) / (F.value * S.value));
  return { auc, inf };
}

/**
 * Time-dependent ROC curves and AUC for censored event times, with a single event or competing risks: the
 * cumulative/dynamic definition (cases T < t with the cause, controls T > t, and for competing risks definition (ii)
 * also the subjects with another event before t), inverse probability of censoring weights from the Kaplan-Meier of
 * the censoring (`"marginal"`), a Cox model (`"cox"`, Efron ties) or Aalen's additive model (`"aalen"`) with the marker
 * and `otherMarkers`; ties in the marker count 1/2. With `iid` (marginal weights), the iid representation of the AUC and
 * its standard error.
 *
 * Differences from R: the times are used as given (R adds 0 to a single time); the iid handles tied times correctly
 * (independent of the data order; equal to R's without ties) and definition (ii)'s is centred on the reported AUC_2;
 * the Cox weights use the maximum of the partial likelihood (R's cph stops about 5e-7 short); Aalen's increments take
 * tied censorings together (R breaks ties at random); a time with a single survivor works (R's competing-risks iid
 * fails there).
 *
 * Equivalent to `timeROC::timeROC()` in R.
 *
 * @param time observed times
 * @param delta 0 censored, otherwise the kind of event
 * @param marker the marker (larger values: the event sooner)
 * @param options `times` (required) and the options of timeROC
 * @category Diagnostic tests
 */
export function timeROC(time: readonly number[], delta: readonly number[], marker: readonly number[], options: TimeROCOptions): TimeROCResult {
  const p = prepareFit(time, delta, marker, options, "timeROC");
  const iid = options.iid ?? false;
  if (iid && p.weighting !== "marginal") throw new RangeError("weighting must be marginal for computing the iid representation (as R)");
  const roc = options.roc ?? true;
  const { data, competing } = p;
  const ats = atTimes(p);
  const cuts = [...new Set(data.marker)].sort((a, b) => b - a);
  const cumulativeIncidence = ats.map((at) => at.w.reduce((s, w, i) => s + (at.role[i] === 1 ? w : 0), 0) / data.n);
  const common = {
    times: p.times,
    n: data.n,
    cumulativeIncidence,
    // R's survProb: the survivors' weighted mass (the Kaplan-Meier with the marginal weights, exactly)
    survProb: ats.map((at) => at.w.reduce((s, w, i) => s + (at.role[i] === 2 ? w : 0), 0) / data.n),
    stats: ats.map((at) => statsOf(at, competing)),
    weights: (p.cond === null
      ? { method: "marginal", ipcwTimes: p.times.map((t) => marginalG(data, t).Gt), ipcwSubjectTimes: sorted(data, data.ti.map((k) => (k > 0 ? data.G[k - 1]! : 1))) }
      : { method: p.weighting, ipcwTimes: p.cond.at.map((g) => sorted(data, g)), ipcwSubjectTimes: sorted(data, p.cond.left) }) as TimeROCWeights,
    ...(roc ? { tp: ats.map((at) => curve(data, at, (r) => r === 1, cuts)) } : {}),
  };
  const aucs = (def: "i" | "ii") => ats.map((at) => aucInfluence(data, at, def));
  const r1 = aucs("i");
  let result: TimeROCResult;
  if (!competing) {
    result = {
      ...common,
      competingRisks: false,
      auc: r1.map((r) => r.auc),
      ...(roc ? { fp: ats.map((at) => curve(data, at, (r) => r === 2, cuts)) } : {}),
      ...(iid ? { inference: { iid: r1.map((r) => sorted(data, r.inf)), sd: r1.map((r) => sdOver(r.inf)) } } : {}),
    };
  } else {
    const r2 = aucs("ii");
    result = {
      ...common,
      competingRisks: true,
      auc1: r1.map((r) => r.auc),
      auc2: r2.map((r) => r.auc),
      ...(roc ? { fp1: ats.map((at) => curve(data, at, (r) => r === 2, cuts)), fp2: ats.map((at) => curve(data, at, (r) => r === 2 || r === 3, cuts)) } : {}),
      ...(iid ? { inference: { iid1: r1.map((r) => sorted(data, r.inf)), sd1: r1.map((r) => sdOver(r.inf)), iid2: r2.map((r) => sorted(data, r.inf)), sd2: r2.map((r) => sdOver(r.inf)) } } : {}),
    };
  }
  fitData.set(result, { time: data.time, delta: data.delta });
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// confint and compare

/**
 * Options for {@link timeROCConfint}.
 *
 * @category Diagnostic tests
 */
export interface TimeROCConfintOptions {
  /** Confidence level. Default 0.95. */
  level?: number;
  /** Number of simulations of the simultaneous band. Default 2000. */
  nSim?: number;
}

/** Pointwise intervals and the simultaneous band of one AUC, in percent. */
export interface TimeROCInterval {
  /** Lower and upper pointwise limits per time (percent, not rounded). */
  ci: [number, number][];
  /** Lower and upper limits of the simultaneous band per time (percent). */
  band: [number, number][];
  /** The band's multiplier (the `level` quantile of the maximum standardized deviation). */
  cAlpha: number;
}

/**
 * Result of {@link timeROCConfint}: `auc` without competing risks, `auc1` and `auc2` with them.
 *
 * @category Diagnostic tests
 */
export interface TimeROCConfintResult {
  times: number[];
  level: number;
  auc?: TimeROCInterval;
  auc1?: TimeROCInterval;
  auc2?: TimeROCInterval;
}

function iidOf(fit: TimeROCResult, which: 1 | 2): { auc: number[]; iid: number[][]; sd: number[] } {
  if (fit === null || typeof fit !== "object" || !("competingRisks" in fit)) throw new TypeError("'fit' must be a result of timeROC");
  if (fit.inference === undefined) throw new RangeError("the fit has no iid representation: call timeROC with iid: true (marginal weights)");
  if (!fit.competingRisks) return { auc: fit.auc, iid: fit.inference.iid, sd: fit.inference.sd };
  return which === 1
    ? { auc: fit.auc1, iid: fit.inference.iid1, sd: fit.inference.sd1 }
    : { auc: fit.auc2, iid: fit.inference.iid2, sd: fit.inference.sd2 };
}

/** The intervals of one or more AUC definitions; with competing risks R uses the same draws for both (log 49). */
function intervals(list: readonly { auc: number[]; iid: number[][]; sd: number[] }[], level: number, nSim: number): TimeROCInterval[] {
  const z = qnorm((1 + level) / 2) as number;
  const n = list[0]!.iid[0]!.length;
  const max = list.map(() => new Array<number>(nSim));
  const xi = new Array<number>(n);
  for (let s = 0; s < nSim; s++) {
    for (let i = 0; i < n; i++) xi[i] = normRand();
    list.forEach((a, l) => {
      let m = -Infinity;
      for (let j = 0; j < a.auc.length; j++) {
        const col = a.iid[j]!;
        let acc = 0;
        for (let i = 0; i < n; i++) acc += xi[i]! * col[i]!;
        const v = Math.abs(acc / (n * a.sd[j]!));
        if (v > m) m = v;
      }
      max[l]![s] = m;
    });
  }
  return list.map((a, l) => {
    const cAlpha = quantile(max[l]!, level);
    return {
      ci: a.auc.map((x, j) => [100 * (x - z * a.sd[j]!), 100 * (x + z * a.sd[j]!)] as [number, number]),
      band: a.auc.map((x, j) => [100 * (x - cAlpha * a.sd[j]!), 100 * (x + cAlpha * a.sd[j]!)] as [number, number]),
      cAlpha,
    };
  });
}

/**
 * Pointwise confidence intervals of the time-dependent AUC and a simultaneous confidence band over the times, from the
 * iid representation: the band's multiplier is the `level` quantile of the maximum over the times of the
 * standardized multiplier-bootstrap process (`nSim` draws of n standard normals, from rStats.js's generator: set it
 * with `setSeed`; the same seed as R's `set.seed` gives R's band). Percent, not rounded (R rounds to 2 decimals).
 *
 * Equivalent to `confint()` on a timeROC fit in R (`timeROC:::confint.ipcwsurvivalROC`).
 *
 * @param fit a result of {@link timeROC} with `iid: true`
 * @param options `level` and `nSim`
 * @category Diagnostic tests
 */
export function timeROCConfint(fit: TimeROCResult, options: TimeROCConfintOptions = {}): TimeROCConfintResult {
  const level = options.level ?? 0.95;
  if (!(level > 0 && level < 1)) throw new RangeError("'level' must be in (0, 1)");
  const nSim = options.nSim ?? 2000;
  if (!Number.isInteger(nSim) || nSim < 1) throw new RangeError("'nSim' must be a positive integer");
  const a1 = iidOf(fit, 1);
  if (!fit.competingRisks) return { times: fit.times, level, auc: intervals([a1], level, nSim)[0]! };
  const [auc1, auc2] = intervals([a1, iidOf(fit, 2)], level, nSim) as [TimeROCInterval, TimeROCInterval];
  return { times: fit.times, level, auc1, auc2 };
}

/** Options for {@link timeROCCompare}. */
export interface TimeROCCompareOptions {
  /** Also the p-values adjusted for the several times (the maximum of the correlated statistics). Default false. */
  adjusted?: boolean;
}

/** The comparison of one AUC definition. */
export interface TimeROCComparison {
  /** p-values per time. */
  pValues: number[];
  /** With `adjusted`: the p-values adjusted for the several times. */
  adjusted?: number[];
  /** With `adjusted`: the correlation of the statistics across the times. */
  cor?: number[][];
}

/**
 * Result of {@link timeROCCompare}.
 *
 * @category Diagnostic tests
 */
export interface TimeROCCompareResult {
  times: number[];
  auc?: TimeROCComparison;
  auc1?: TimeROCComparison;
  auc2?: TimeROCComparison;
}

function comparison(x: { auc: number[]; iid: number[][] }, y: { auc: number[]; iid: number[][] }, adjusted: boolean): TimeROCComparison {
  const T = x.auc.length;
  const d = x.iid.map((col, j) => col.map((v, i) => v - y.iid[j]![i]!));
  const se = d.map(sdOver);
  const z = x.auc.map((a, j) => (a - y.auc[j]!) / se[j]!);
  const pValues = z.map((v) => 2 * (pnorm(-Math.abs(v)) as number));
  if (!adjusted) return { pValues };
  const n = d[0]!.length;
  const sdv = se.map((s) => s * Math.sqrt(n));
  const means = d.map((col) => col.reduce((s, v) => s + v, 0) / n);
  const cor = Array.from({ length: T }, (_, a) =>
    Array.from({ length: T }, (_, b) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += (d[a]![i]! - means[a]!) * (d[b]![i]! - means[b]!);
      return s / (n - 1) / (sdv[a]! * sdv[b]!);
    }),
  );
  const adj = z.map((v) => {
    const b = Math.abs(v);
    if (Number.isNaN(b)) return NaN;
    return Math.min(1, Math.max(0, 1 - pmvnormSymmetric(b, cor)));
  });
  return { pValues, adjusted: adj, cor };
}

/**
 * Compares the time-dependent AUCs of two markers measured on the same subjects at each time, by the z statistic of
 * the difference with the standard error from the difference of the iid representations; with `adjusted`, also the
 * p-values adjusted for the several times, P(max_t |Z_t| >= |z_t|) for Z normal with the correlation of the
 * statistics (computed deterministically: exactly up to three times, to about 1e-7 from four on; R integrates at
 * random with mvtnorm's default absolute tolerance of 1e-3, so the two differ by up to about 1e-4).
 *
 * Equivalent to `timeROC::compare()` in R.
 *
 * @param x a result of {@link timeROC} with `iid: true`
 * @param y another, on the same subjects and times
 * @param options `adjusted`
 * @category Diagnostic tests
 */
export function timeROCCompare(x: TimeROCResult, y: TimeROCResult, options: TimeROCCompareOptions = {}): TimeROCCompareResult {
  const adjusted = options.adjusted ?? false;
  const dx = fitData.get(x);
  const dy = fitData.get(y);
  iidOf(x, 1);
  iidOf(y, 1);
  if (x.n !== y.n || x.times.length !== y.times.length || x.times.some((t, j) => t !== y.times[j]) || x.competingRisks !== y.competingRisks
    || (dx && dy && (dx.time.some((t, i) => t !== dy.time[i]) || dx.delta.some((t, i) => t !== dy.delta[i]))))
    throw new RangeError("the two fits must come from the same subjects and times");
  if (!x.competingRisks) return { times: x.times, auc: comparison(iidOf(x, 1), iidOf(y, 1), adjusted) };
  return { times: x.times, auc1: comparison(iidOf(x, 1), iidOf(y, 1), adjusted), auc2: comparison(iidOf(x, 2), iidOf(y, 2), adjusted) };
}

// ---------------------------------------------------------------------------------------------------------------
// The multivariate normal probability P(|Z_j| <= b for all j), Z ~ N(0, cor)

/**
 * P(|Z_j| <= b for all j), Z ~ N(0, cor). One and two dimensions exactly (pnorm, pbvnorm); three by composite
 * Gauss-Legendre over Z_1 of the conditional bivariate probability (pbvnorm), when no correlation with Z_1 is ±1; else
 * Genz's separation of variables (Genz 1992) with a Richtmyer lattice rule, periodized by the baker's transform and
 * randomized by fixed shifts from a private generator (deterministic, not touching the user's random numbers), the
 * points doubled until three standard errors over the shifts fall below 1e-8.
 *
 * @internal
 */
export function pmvnormSymmetric(b: number, cor: readonly (readonly number[])[]): number {
  const d = cor.length;
  if (b === Infinity) return 1;
  if (!(b > 0)) return 0;
  if (d === 1) return 1 - 2 * pnorm1(-b, 0, 1, true, false);
  if (d === 2) return pbvnorm([-b, -b], [b, b], Math.max(-1, Math.min(1, cor[0]![1]!)));
  if (d === 3) {
    const r12 = cor[0]![1]!;
    const r13 = cor[0]![2]!;
    const r23 = cor[1]![2]!;
    if (Math.abs(r12) < 1 - 1e-9 && Math.abs(r13) < 1 - 1e-9) {
      const s2 = Math.sqrt(1 - r12 * r12);
      const s3 = Math.sqrt(1 - r13 * r13);
      const rho = Math.max(-1, Math.min(1, (r23 - r12 * r13) / (s2 * s3)));
      const lim = Math.min(b, 40);
      const panels = 200;
      const h = (2 * lim) / panels;
      let tot = 0;
      for (let k = 0; k < panels; k++) {
        for (let q = 0; q < GL_X.length; q++) {
          const x = -lim + h * (k + 0.5 + GL_X[q]! / 2);
          const phi = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
          tot += (GL_W[q]! * h / 2) * phi * pbvnorm([(-b - r12 * x) / s2, (-b - r13 * x) / s3], [(b - r12 * x) / s2, (b - r13 * x) / s3], rho);
        }
      }
      return tot;
    }
  }
  return genzLattice(b, cor);
}

/** Ten-point Gauss-Legendre nodes and weights on [-1, 1]. */
const GL_X = [-0.9739065285171717, -0.8650633666889845, -0.6794095682990244, -0.4333953941292472, -0.1488743389816312,
  0.1488743389816312, 0.4333953941292472, 0.6794095682990244, 0.8650633666889845, 0.9739065285171717];
const GL_W = [0.0666713443086881, 0.1494513491505806, 0.219086362515982, 0.2692667193099963, 0.2955242247147529,
  0.2955242247147529, 0.2692667193099963, 0.219086362515982, 0.1494513491505806, 0.0666713443086881];

function genzLattice(b: number, cor: readonly (readonly number[])[]): number {
  const d = cor.length;
  // Cholesky (positive semidefinite: a zero pivot makes that variable a combination of the earlier ones)
  const L = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      let s = cor[i]![j]!;
      for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
      if (i === j) L[i]![i] = s > 1e-12 ? Math.sqrt(s) : 0;
      else L[i]![j] = L[j]![j]! > 0 ? s / L[j]![j]! : 0;
    }
  }
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
  const gen = Array.from({ length: d - 1 }, (_, j) => {
    const s = Math.sqrt(primes[j % primes.length]! + 100 * Math.floor(j / primes.length));
    return s - Math.floor(s);
  });
  let seed = 0x2545f491;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const y = new Array<number>(d);
  const point = (w: readonly number[]) => {
    let f = 1;
    for (let i = 0; i < d; i++) {
      let s = 0;
      for (let k = 0; k < i; k++) s += L[i]![k]! * y[k]!;
      let lo: number;
      let hi: number;
      if (L[i]![i]! > 0) {
        lo = pnorm1((-b - s) / L[i]![i]!, 0, 1, true, false);
        hi = pnorm1((b - s) / L[i]![i]!, 0, 1, true, false);
      } else {
        lo = 0;
        hi = s >= -b && s <= b ? 1 : 0;
      }
      f *= hi - lo;
      if (f <= 0) return 0;
      if (i < d - 1) y[i] = qnorm1(Math.min(Math.max(lo + w[i]! * (hi - lo), 1e-300), 1 - 1e-16), 0, 1, true, false);
    }
    return f;
  };
  const shifts = 10;
  let N = 1009;
  let est = NaN;
  const w = new Array<number>(d - 1);
  for (let round = 0; round < 10; round++) {
    const vals: number[] = [];
    for (let s = 0; s < shifts; s++) {
      const shift = gen.map(() => rand());
      let acc = 0;
      for (let k = 1; k <= N; k++) {
        for (let j = 0; j < d - 1; j++) {
          const x = (k * gen[j]! + shift[j]!) % 1;
          w[j] = Math.abs(2 * x - 1);
        }
        acc += point(w);
      }
      vals.push(acc / N);
    }
    const m = vals.reduce((s, v) => s + v, 0) / shifts;
    const se = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (shifts - 1) / shifts);
    est = m;
    if (2 * se < 1e-7) break;
    N *= 2;
  }
  return est;
}

// ---------------------------------------------------------------------------------------------------------------
// SeSpPPVNPV

/**
 * Options for {@link seSpPPVNPV}.
 *
 * @category Diagnostic tests
 */
export interface SeSpPPVNPVOptions extends TimeROCOptions {}

/** Standard errors of {@link seSpPPVNPV} (with `iid`), per time. */
export interface SeSpPPVNPVInference {
  se: { se: number[]; sp1: number[]; sp2: number[]; ppv: number[]; npv1: number[]; npv2: number[] };
  /** The iid representations, per time, subjects in the order of the sorted times. */
  iid: { se: number[][]; sp1: number[][]; sp2: number[][]; ppv: number[][]; npv1: number[][]; npv2: number[][] };
}

/**
 * Result of {@link seSpPPVNPV}: `fp` and `npv` without competing risks, `fp1`, `fp2`, `npv1` and `npv2` with them.
 *
 * @category Diagnostic tests
 */
export interface SeSpPPVNPVResult {
  cutpoint: number;
  times: number[];
  n: number;
  competingRisks: boolean;
  tp: number[];
  fp?: number[];
  fp1?: number[];
  fp2?: number[];
  ppv: number[];
  npv?: number[];
  npv1?: number[];
  npv2?: number[];
  /** Counts per time, with the positives (marker > cutpoint) and negatives. */
  stats: (TimeROCStats & { positive: number; negative: number })[];
  weights: TimeROCWeights;
  inference?: SeSpPPVNPVInference;
}

/**
 * Time-dependent sensitivity, specificity and predictive values of the rule "marker > cutpoint", with the weights of
 * {@link timeROC}: PPV = TP F / (TP F + FP S) and NPV = (1 − FP) S / ((1 − FP) S + (1 − TP) F) (F the cumulative
 * incidence, S its complement); with competing risks PPV and NPV_2 with definition (ii) and NPV_1 = (1 − FP_1) S_1 /
 * ((1 − FP_2) S_2 + (1 − TP) F). With `iid` (marginal weights), the iid representations and standard errors of Se,
 * Sp (both definitions), PPV and the NPVs.
 *
 * Differences from R: as {@link timeROC}; Sp2's denominator is the weighted mass of the definition (ii) controls (R's
 * 1 − F, the same unless events fall at t).
 *
 * Equivalent to `timeROC::SeSpPPVNPV()` in R.
 *
 * @param cutpoint the marker's threshold
 * @param time observed times
 * @param delta 0 censored, otherwise the kind of event
 * @param marker the marker
 * @param options `times` (required) and the options of timeROC
 * @category Diagnostic tests
 */
export function seSpPPVNPV(cutpoint: number, time: readonly number[], delta: readonly number[], marker: readonly number[], options: SeSpPPVNPVOptions): SeSpPPVNPVResult {
  if (typeof cutpoint !== "number" || Number.isNaN(cutpoint)) throw new RangeError("'cutpoint' must be a number");
  const p = prepareFit(time, delta, marker, options, "seSpPPVNPV");
  const iid = options.iid ?? false;
  if (iid && p.weighting !== "marginal") throw new RangeError("weighting must be marginal for computing the iid representation (as R)");
  const { data, competing } = p;
  const pos: number[] = data.marker.map((m) => (m > cutpoint ? 1 : 0));
  const ats = atTimes(p);
  const res = ats.map((at) => {
    const sel = (pred: (r: number, i: number) => boolean) => at.role.map((r, i) => (pred(r, i) ? 1 : 0));
    const isC1 = (r: number) => r === 2;
    const isC2 = (r: number) => r === 2 || r === 3;
    const T = (f: number[]) => total(data, at, f);
    const aP = T(sel((r, i) => r === 1 && pos[i] === 1));
    const a = T(sel((r) => r === 1));
    const aN = T(sel((r, i) => r === 1 && pos[i] === 0));
    const c1P = T(sel((r, i) => isC1(r) && pos[i] === 1));
    const c1 = T(sel(isC1));
    const c1N = T(sel((r, i) => isC1(r) && pos[i] === 0));
    const c2P = T(sel((r, i) => isC2(r) && pos[i] === 1));
    const c2 = T(sel(isC2));
    const c2N = T(sel((r, i) => isC2(r) && pos[i] === 0));
    const sum = (x: Total, y: Total): Total => ({ value: x.value + y.value, inf: x.inf.map((v, k) => v + y.inf[k]!) });
    const se = { value: aP.value / a.value, inf: ratioInf(aP, a) };
    const fp1 = c1P.value / c1.value;
    const fp2 = c2P.value / c2.value;
    const sp1 = ratioInf(c1P, c1).map((v) => -v);
    const sp2 = ratioInf(c2P, c2).map((v) => -v);
    const ppvD = sum(aP, c2P);
    const negD = sum(c2N, aN);
    return {
      tp: se.value, fp1, fp2,
      ppv: aP.value / ppvD.value, npv1: c1N.value / negD.value, npv2: c2N.value / negD.value,
      inf: { se: se.inf, sp1, sp2, ppv: ratioInf(aP, ppvD), npv1: ratioInf(c1N, negD), npv2: ratioInf(c2N, negD) },
      stats: { ...statsOf(at, competing), positive: pos.reduce((s, v) => s + v, 0), negative: pos.length - pos.reduce((s, v) => s + v, 0) },
    };
  });
  const keys = ["se", "sp1", "sp2", "ppv", "npv1", "npv2"] as const;
  const inference: SeSpPPVNPVInference | undefined = iid
    ? {
        se: Object.fromEntries(keys.map((k) => [k, res.map((r) => sdOver(r.inf[k]))])) as SeSpPPVNPVInference["se"],
        iid: Object.fromEntries(keys.map((k) => [k, res.map((r) => sorted(data, r.inf[k]))])) as SeSpPPVNPVInference["iid"],
      }
    : undefined;
  const weights = (p.cond === null
    ? { method: "marginal", ipcwTimes: p.times.map((t) => marginalG(data, t).Gt), ipcwSubjectTimes: sorted(data, data.ti.map((k) => (k > 0 ? data.G[k - 1]! : 1))) }
    : { method: p.weighting, ipcwTimes: p.cond.at.map((g) => sorted(data, g)), ipcwSubjectTimes: sorted(data, p.cond.left) }) as TimeROCWeights;
  return {
    cutpoint, times: p.times, n: data.n, competingRisks: competing,
    tp: res.map((r) => r.tp),
    ...(competing ? { fp1: res.map((r) => r.fp1), fp2: res.map((r) => r.fp2) } : { fp: res.map((r) => r.fp1) }),
    ppv: res.map((r) => r.ppv),
    ...(competing ? { npv1: res.map((r) => r.npv1), npv2: res.map((r) => r.npv2) } : { npv: res.map((r) => r.npv1) }),
    stats: res.map((r) => r.stats),
    weights,
    ...(inference ? { inference } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The values behind plotAUCcurve and plotAUCcurveDiff

/** Options for {@link timeROCAucCurve} and {@link timeROCAucDiff}. */
export interface TimeROCAucCurveOptions extends TimeROCConfintOptions {
  /** With competing risks, the definition of the controls: 1 (default) or 2. */
  fp?: 1 | 2;
}

/**
 * Result of {@link timeROCAucCurve}: the AUC per time with its pointwise interval and simultaneous band (as
 * proportions).
 *
 * @category Diagnostic tests
 */
export interface TimeROCAucCurveResult {
  times: number[];
  auc: number[];
  lower: number[];
  upper: number[];
  bandLower: number[];
  bandUpper: number[];
}

/**
 * The values that R's `plotAUCcurve` draws: the AUC over the times with the pointwise confidence interval and the
 * simultaneous band of {@link timeROCConfint} (as proportions). No plot.
 *
 * Equivalent to `timeROC::plotAUCcurve()` in R.
 *
 * @param fit a result of {@link timeROC} with `iid: true`
 * @param options `level`, `nSim` and `fp`
 * @category Diagnostic tests
 */
export function timeROCAucCurve(fit: TimeROCResult, options: TimeROCAucCurveOptions = {}): TimeROCAucCurveResult {
  const which = options.fp ?? 1;
  if (which !== 1 && which !== 2) throw new RangeError("'fp' must be 1 or 2");
  const level = options.level ?? 0.95;
  if (!(level > 0 && level < 1)) throw new RangeError("'level' must be in (0, 1)");
  const nSim = options.nSim ?? 2000;
  if (!Number.isInteger(nSim) || nSim < 1) throw new RangeError("'nSim' must be a positive integer");
  const a = iidOf(fit, which);
  const iv = intervals([a], level, nSim)[0]!;
  return {
    times: fit.times, auc: a.auc,
    lower: iv.ci.map((c) => c[0] / 100), upper: iv.ci.map((c) => c[1] / 100),
    bandLower: iv.band.map((c) => c[0] / 100), bandUpper: iv.band.map((c) => c[1] / 100),
  };
}

/**
 * Result of {@link timeROCAucDiff}.
 *
 * @category Diagnostic tests
 */
export interface TimeROCAucDiffResult {
  times: number[];
  /** AUC of x minus AUC of y. */
  diff: number[];
  lower: number[];
  upper: number[];
}

/**
 * The values behind R's `plotAUCcurveDiff`: the difference of two time-dependent AUCs over the times with the
 * pointwise confidence interval from the difference of the iid representations (as {@link timeROCCompare}). R also
 * draws a simultaneous band, whose simulation cannot be checked (R returns nothing); it is not offered. No plot.
 *
 * Not an R function.
 *
 * @param x a result of {@link timeROC} with `iid: true`
 * @param y another, on the same subjects and times
 * @param options `level` and `fp`
 * @category Diagnostic tests
 */
export function timeROCAucDiff(x: TimeROCResult, y: TimeROCResult, options: Omit<TimeROCAucCurveOptions, "nSim"> = {}): TimeROCAucDiffResult {
  const which = options.fp ?? 1;
  if (which !== 1 && which !== 2) throw new RangeError("'fp' must be 1 or 2");
  const level = options.level ?? 0.95;
  if (!(level > 0 && level < 1)) throw new RangeError("'level' must be in (0, 1)");
  timeROCCompare(x, y);
  const a = iidOf(x, which);
  const b = iidOf(y, which);
  const z = qnorm((1 + level) / 2) as number;
  const diff = a.auc.map((v, j) => v - b.auc[j]!);
  const se = a.iid.map((col, j) => sdOver(col.map((v, i) => v - b.iid[j]![i]!)));
  return { times: x.times, diff, lower: diff.map((v, j) => v - z * se[j]!), upper: diff.map((v, j) => v + z * se[j]!) };
}

// ---------------------------------------------------------------------------------------------------------------
// survivalROC (Kaplan-Meier)

/**
 * Options for {@link survivalROC}.
 *
 * @category Diagnostic tests
 */
export interface SurvivalROCOptions {
  /** The time of the prediction (required). */
  predictTime: number;
  /** Thresholds of the marker, sorted (R prepends −Inf; from two thresholds on, the last one's point is (0, 0), as R).
   * Default: the sorted distinct marker values. */
  cutValues?: readonly number[];
  /** The estimator: only `"KM"` (R's default, the nearest-neighbour estimator `"NNE"`, is not offered). Default "KM". */
  method?: "KM";
}

/**
 * Result of {@link survivalROC}.
 *
 * @category Diagnostic tests
 */
export interface SurvivalROCResult {
  /** −Inf, then the thresholds. */
  cutValues: number[];
  tp: number[];
  fp: number[];
  predictTime: number;
  /** Kaplan-Meier survival at the prediction time. */
  survival: number;
  /** Trapezoid over the points in the order of the thresholds (not bounded by 1, as R). */
  auc: number;
}

/** Kaplan-Meier survival at t of the subjects selected by `sel`, over the subjects sorted by time (events before
 * censorings at a tie). */
function kmOf(time: readonly number[], status: readonly number[], byTime: readonly number[], sel: (i: number) => boolean, t: number): number {
  let atRisk = 0;
  for (const i of byTime) if (sel(i)) atRisk++;
  let surv = 1;
  let k = 0;
  while (k < byTime.length && time[byTime[k]!]! <= t) {
    const u = time[byTime[k]!]!;
    let ev = 0;
    let all = 0;
    for (; k < byTime.length && time[byTime[k]!]! === u; k++) {
      const i = byTime[k]!;
      if (!sel(i)) continue;
      if (status[i] === 1) ev++;
      all++;
    }
    if (atRisk > 0 && ev > 0) surv *= 1 - ev / atRisk;
    atRisk -= all;
  }
  return surv;
}

/**
 * Time-dependent ROC curve at a prediction time by Heagerty, Lumley and Pepe's Kaplan-Meier estimator: S(c, t) =
 * KM_{marker > c}(t) P(marker > c), TP(c) = (P(marker > c) − S(c, t)) / (1 − S(t)), FP(c) = S(c, t) / S(t) (neither
 * is forced to be monotone or below 1, as R), and the AUC by the trapezoid over the thresholds in order.
 *
 * Differences from R: only the Kaplan-Meier estimator (`method = "KM"`); R's default, the nearest-neighbour estimator,
 * is not offered.
 *
 * Equivalent to `survivalROC::survivalROC()` in R.
 *
 * @param time observed times
 * @param status 1 event, 0 censored
 * @param marker the marker
 * @param options `predictTime` (required), `cutValues` and `method`
 * @category Diagnostic tests
 */
export function survivalROC(time: readonly number[], status: readonly number[], marker: readonly number[], options: SurvivalROCOptions): SurvivalROCResult {
  if (options === null || typeof options !== "object") throw new TypeError("survivalROC: 'options' with 'predictTime' is required");
  if ((options.method ?? "KM") !== "KM") throw new RangeError(`only method "KM" is offered (the nearest-neighbour estimator "NNE" is not)`);
  const keep = completeCases(time, status, marker);
  const t = keep.map((i) => time[i]!);
  const st = keep.map((i) => status[i]!);
  const m = keep.map((i) => marker[i]!);
  const n = t.length;
  if (n === 0) throw new RangeError("no subjects (without NA)");
  for (const e of st) if (e !== 0 && e !== 1) throw new RangeError("'status' must be 0 or 1");
  const pt = options.predictTime;
  if (typeof pt !== "number" || !Number.isFinite(pt)) throw new RangeError("'predictTime' must be a finite number");
  // R sorts given thresholds and, from two given thresholds on, sets the last point to (0, 0) even when markers lie
  // above it; a single given threshold is computed (log 48, 52)
  const cuts = options.cutValues === undefined ? [...new Set(m)].sort((a, b) => a - b) : checkVector(options.cutValues, "cutValues").sort((a, b) => a - b);
  const byTime = Array.from({ length: n }, (_, i) => i).sort((a, b) => t[a]! - t[b]!);
  const St = kmOf(t, st, byTime, () => true, pt);
  const cutValues = [-Infinity, ...cuts];
  const tp: number[] = [];
  const fp: number[] = [];
  for (const [k, c] of cutValues.entries()) {
    if (k === cutValues.length - 1 && cutValues.length > 2) {
      tp.push(0);
      fp.push(0);
      break;
    }
    const above = (i: number) => m[i]! > c;
    const count = m.reduce((acc, v) => acc + (v > c ? 1 : 0), 0);
    const pc = count / n;
    const Sc = count > 0 ? kmOf(t, st, byTime, above, pt) * pc : 0;
    tp.push((pc - Sc) / (1 - St));
    fp.push(Sc / St);
  }
  let auc = 0;
  for (let k = 0; k + 1 < fp.length; k++) auc += (fp[k]! - fp[k + 1]!) * (tp[k]! + tp[k + 1]!) / 2;
  return { cutValues, tp, fp, predictTime: pt, survival: St, auc };
}

/** The pieces used by the tests' infinitesimal jackknife. @internal */
export const timeROCInternals = { prepare, weightsAt, marginalG, total, aucInfluence };
