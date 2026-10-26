// McDonald's omega, psych's omega() with its defaults (minres factoring, varimax then oblimin, a Schmid-Leiman
// transformation, items with a negative general loading flipped). Written for rStats.js from the specification
// oracle/omega-behaviour.md (no R, psych or GPArotation code was read or used): the minres uniquenesses minimise
// the off-diagonal residuals by L-BFGS-B (this library's optim), the oblique rotation is GPArotation's quartimin
// with its Barzilai-Borwein step and non-monotone line search, and the general factor comes from a one-factor
// minres analysis of the factor correlations.

import { eigen } from "../linalg/eigen.js";
import { solve } from "../linalg/solve.js";
import { svd } from "../linalg/svd.js";
import { optim } from "../optim/optim.js";
import { cor } from "./cov.js";
import { sumOnce, varimax } from "./factanal.js";

/** Options of {@link omega} */
export interface OmegaOptions {
  /** The number of first-order (group) factors. Default 3. */
  nfactors?: number;
  /** A correlation (or covariance) matrix to analyse instead of the data `x` (pass `null` as `x`). */
  covmat?: readonly (readonly number[])[];
}

/** Result of {@link omega} */
export interface OmegaResult {
  /** Omega hierarchical: the share of the total variance due to the general factor */
  omegaH: number;
  /** Omega asymptotic: the general factor's share of the common variance */
  omegaLim: number;
  /** Cronbach's alpha (standardised: of the correlations) */
  alpha: number;
  /** Omega total */
  omegaTot: number;
  /** Guttman's lambda 6 */
  G6: number;
  /** Explained common variance of the general factor */
  ECV: number;
  /** The Schmid-Leiman matrix, p rows; columns as `slNames` */
  sl: number[][];
  /** `["g", "F1*", ..., "h2", "u2", "p2", "com"]` */
  slNames: string[];
  /** The varimax loadings of the first-order minres solution */
  orthog: number[][];
  /** The oblimin pattern (the varimax loadings for one factor) */
  oblique: number[][];
  /** The factor correlations (absent for one factor) */
  phi?: number[][];
  /** The loadings of the first-order factors on the general factor */
  gloading: number[];
  /** The item signs (-1 for a flipped item) */
  key: number[];
  /** Rows g, F1*, ...; columns total, general, group (NaN for a group with no items) */
  omegaGroup: number[][];
  /** The warnings R would give (e.g. an ultra-Heywood case, or one factor), each once. */
  warnings: string[];
  /** The messages R would print (e.g. for two factors), each once. */
  messages: string[];
}

type Matrix = number[][];

const EPS = 2 ** -52;
const TWO_FACTOR_MESSAGE =
  "\nThree factors are required for identification -- general factor loadings set to be equal. \nProceed with caution. \nThink about redoing the analysis with alternative values of the 'option' setting.\n\n";

const matMul = (A: readonly (readonly number[])[], B: readonly (readonly number[])[]): Matrix =>
  A.map((row) => B[0]!.map((_, j) => {
    let s = 0;
    for (let k = 0; k < row.length; k++) s += row[k]! * B[k]![j]!;
    return s;
  }));
const transpose = (A: readonly (readonly number[])[]): Matrix => A[0]!.map((_, j) => A.map((r) => r[j]!));
const colSums = (m: readonly (readonly number[])[], f: (v: number) => number = (v) => v): number[] =>
  m[0]!.map((_, j) => sumOnce(m.map((r) => f(r[j]!))));
const rowSums = (m: readonly (readonly number[])[], f: (v: number) => number = (v) => v): number[] =>
  m.map((r) => sumOnce(r.map(f)));
/** Sum of all entries (column by column, as R) */
const sumAll = (m: readonly (readonly number[])[], f: (v: number) => number = (v) => v): number =>
  sumOnce(m[0]!.flatMap((_, j) => m.map((r) => f(r[j]!))));
const signOf = (v: number): number => (v < 0 ? -1 : 1);

/** r_ij / sqrt(r_ii r_jj) with unit diagonal */
function toCorrelation(S: readonly (readonly number[])[]): Matrix {
  const sd = S.map((r, i) => Math.sqrt(r[i]!));
  return S.map((r, i) => r.map((v, j) => (i === j ? 1 : v / (sd[i]! * sd[j]!))));
}

/** Squared multiple correlations from the pseudo-inverse, clipped to [0, 1] (messages as psych's smc) */
function smc(S: readonly (readonly number[])[], messages: string[]): number[] {
  const R = toCorrelation(S);
  const { d, u, v } = svd(R);
  const kept = d.map((_, k) => k).filter((k) => d[k]! > Math.sqrt(EPS) * d[0]!);
  const out = R.map((_, i) => {
    let s = 0;
    for (const k of kept) s += v![i]![k]! * (1 / d[k]!) * u![i]![k]!;
    return 1 - 1 / s;
  });
  if (out.some((x) => x > 1)) addMessage(messages, "In smc, smcs > 1 were set to 1.0");
  if (out.some((x) => x < 0)) addMessage(messages, "In smc, smcs < 0 were set to .0");
  return out.map((x) => (x > 1 ? 1 : x < 0 ? 0 : x));
}

const addMessage = (list: string[], m: string): void => {
  if (!list.includes(m)) list.push(m);
};

/** The first q eigenvectors of S with diagonal `diag`, times the square roots of their eigenvalues (clipped by `clip`) */
function principalLoadings(S: readonly (readonly number[])[], diag: readonly number[], q: number, clip: (e: number) => number): Matrix {
  const M = S.map((r, i) => r.map((v, j) => (i === j ? diag[i]! : v)));
  const E = eigen(M, { symmetric: true });
  const w = E.values.slice(0, q).map((e) => Math.sqrt(clip(e)));
  return E.vectors!.map((row) => row.slice(0, q).map((v, k) => v * w[k]!));
}

const outer = (L: Matrix): Matrix => matMul(L, transpose(L));

/** Minres factor analysis of a correlation matrix with q factors (varimax for q > 1) */
function minres(S0: readonly (readonly number[])[], q: number, warnings: string[], messages: string[]): Matrix {
  const S = toCorrelation(S0);
  const p = S.length;
  const s = smc(S, messages);
  const objective = (psi: number[]): number => {
    const L = principalLoadings(S, psi.map((v) => 1 - v), q, (e) => (e < EPS ? 100 * EPS : e));
    const model = outer(L);
    const terms: number[] = [];
    for (let j = 0; j < p; j++) for (let i = j + 1; i < p; i++) terms.push((S[i]![j]! - model[i]![j]!) ** 2);
    return sumOnce(terms);
  };
  const gradient = (psi: number[]): number[] => {
    const L = principalLoadings(S, psi.map((v, i) => S[i]![i]! - v), q, (e) => Math.max(e, 0));
    return psi.map((v, i) => {
      let h = 0;
      for (let k = 0; k < q; k++) h += L[i]![k]! * L[i]![k]!;
      return h + v - S[i]![i]!;
    });
  };
  const fit = optim(s.map((v) => 1 - v), objective, {
    gr: gradient,
    method: "L-BFGS-B",
    lower: 0.005,
    upper: Math.max(Math.max(...s), 1),
    control: { fnscale: 1, parscale: new Array<number>(p).fill(0.01) },
  });
  const psi = fit.par;
  let L = principalLoadings(S, psi.map((v, i) => S[i]![i]! - v), q, (e) => Math.max(e, 0));
  L = signColumns(L, q);
  L = L.map((r) => r.map((v) => (v === 0 ? 1e-15 : v)));
  if (rowSums(L, (v) => v * v).some((h) => h > 1)) {
    addMessage(warnings, "An ultra-Heywood case was detected.  Examine the results carefully");
  }
  if (q > 1) {
    L = signColumns(varimax(L).loadings, q);
    const ssq = colSums(L, (v) => v * v);
    const order = ssq.map((_, j) => j).sort((a, b) => ssq[b]! - ssq[a]! || a - b);
    L = L.map((r) => order.map((j) => r[j]!));
  } else {
    L = signColumns(L, q);
  }
  return L;
}

/** q > 1: each column times the sign of its sum; q = 1: negated if its sum is negative */
function signColumns(L: Matrix, q: number): Matrix {
  const sign = colSums(L).map(signOf);
  if (q === 1) return sign[0]! < 0 ? L.map((r) => r.map((v) => -v)) : L;
  return L.map((r) => r.map((v, j) => sign[j]! * v));
}

/** Quartimin criterion and gradient at loadings L */
function quartimin(L: Matrix): { f: number; Gq: Matrix } {
  const q = L[0]!.length;
  const L2 = L.map((r) => r.map((v) => v * v));
  const X = L2.map((r) => r.map((_, j) => {
    let s = 0;
    for (let m = 0; m < q; m++) if (m !== j) s += r[m]!;
    return s;
  }));
  return { f: sumAll(L2.map((r, i) => r.map((v, j) => v * X[i]![j]!))) / 4, Gq: L.map((r, i) => r.map((v, j) => v * X[i]![j]!)) };
}

/** Oblique quartimin (oblimin) rotation of A by gradient projection: the pattern and the factor correlations */
function oblimin(A: Matrix): { loadings: Matrix; phi: Matrix; converged: boolean } {
  const q = A[0]!.length;
  const at = (T: Matrix) => {
    const Ti = solve(T) as Matrix;
    const L = matMul(A, transpose(Ti));
    const { f, Gq } = quartimin(L);
    const G = transpose(matMul(matMul(transpose(L), Gq), Ti)).map((r) => r.map((v) => -v));
    return { L, f, G };
  };
  let T: Matrix = Array.from({ length: q }, (_, i) => Array.from({ length: q }, (_, j) => (i === j ? 1 : 0)));
  let alpha = 1;
  let cur = at(T);
  let previous: { T: Matrix; Gp: Matrix } | undefined;
  const values: number[] = [];
  let converged = false;
  for (let iter = 0; iter <= 2000; iter++) {
    const d = colSums(T.map((r, i) => r.map((v, j) => v * cur.G[i]![j]!)));
    const Gp = cur.G.map((r, i) => r.map((v, j) => v - T[i]![j]! * d[j]!));
    const s = Math.sqrt(sumAll(Gp, (v) => v * v));
    values.push(cur.f);
    if (s < 1e-5) {
      converged = true;
      break;
    }
    if (previous !== undefined) {
      const P = previous;
      const dT = T.map((r, i) => r.map((v, j) => v - P.T[i]![j]!));
      const dG = Gp.map((r, i) => r.map((v, j) => v - P.Gp[i]![j]!));
      if (sumAll(dG, (v) => v * v) > 0) {
        alpha = sumAll(dT, (v) => v * v) / Math.abs(sumAll(dT.map((r, i) => r.map((v, j) => v * dG[i]![j]!))));
        alpha = Math.max(1e-10, Math.min(alpha, 20));
      }
    } else {
      alpha = 2 * alpha;
    }
    const target = Math.max(...values.slice(-10));
    let trial = cur;
    let Tt = T;
    for (let i = 0; i <= 10; i++) {
      const X = T.map((r, a) => r.map((v, b) => v - alpha * Gp[a]![b]!));
      const len = colSums(X, (v) => v * v).map((v) => 1 / Math.sqrt(v));
      Tt = X.map((r) => r.map((v, j) => v * len[j]!));
      trial = at(Tt);
      if (target - trial.f > 0.5 * s * s * alpha) break;
      alpha = alpha / 2;
    }
    previous = { T, Gp };
    T = Tt;
    cur = trial;
  }
  return { loadings: cur.L, phi: matMul(transpose(T), T), converged };
}

/**
 * McDonald's omega (hierarchical, asymptotic and total) from a Schmid-Leiman transformation of an oblique minres
 * factor solution. Equivalent to `psych::omega()` in R. With its defaults (`fm = "minres"`, `rotate = "oblimin"`,
 * `option = "equal"`, `flip = TRUE`).
 *
 * @param x The data matrix (array of rows, NaN for missing values: correlations of pairwise complete observations),
 *   or `null` with `options.covmat`.
 * @param options See {@link OmegaOptions}.
 *
 * @example
 * ```ts
 * // 6 items: general loadings 0.6, three pairs with group loadings 0.4
 * const R = [
 *   [1, 0.52, 0.36, 0.36, 0.36, 0.36],
 *   [0.52, 1, 0.36, 0.36, 0.36, 0.36],
 *   [0.36, 0.36, 1, 0.52, 0.36, 0.36],
 *   [0.36, 0.36, 0.52, 1, 0.36, 0.36],
 *   [0.36, 0.36, 0.36, 0.36, 1, 0.52],
 *   [0.36, 0.36, 0.36, 0.36, 0.52, 1],
 * ];
 * const om = omega(null, { covmat: R });
 * om.omegaH;   // 0.7297
 * om.omegaTot; // 0.8378378378378378
 * ```
 */
export function omega(x: readonly (readonly number[])[] | null, options: OmegaOptions = {}): OmegaResult {
  const q = options.nfactors ?? 3;
  if (!Number.isInteger(q) || q < 1) throw new RangeError("'nfactors' must be a positive integer");
  let R: Matrix;
  if (options.covmat !== undefined) {
    R = toCorrelation(options.covmat);
  } else {
    if (x === null) throw new TypeError("neither 'x' nor 'covmat' supplied");
    R = cor(x as number[][], undefined, { use: "pairwise.complete.obs" }) as Matrix;
  }
  const p = R.length;
  const warnings: string[] = [];
  const messages: string[] = [];

  const orthog = minres(R, q, warnings, messages);
  let oblique: Matrix;
  let phi: Matrix | undefined;
  let gloading: number[];
  if (q === 1) {
    oblique = orthog.map((r) => r.slice());
    gloading = [1];
    addMessage(messages, "Omega_h for 1 factor is not meaningful, just omega_t\n");
    addMessage(warnings, "Omega_h and Omega_asymptotic are not meaningful with one factor");
  } else {
    const rot = oblimin(orthog);
    if (!rot.converged) addMessage(warnings, "oblimin did not converge in 2000 iterations");
    oblique = rot.loadings;
    phi = rot.phi;
    if (q === 2) {
      const r12 = phi[0]![1]!;
      const a = Math.sqrt(Math.abs(r12));
      gloading = [a, signOf(r12) * a];
      addMessage(messages, TWO_FACTOR_MESSAGE);
    } else {
      gloading = minres(phi, 1, warnings, messages).map((r) => r[0]!);
    }
  }

  // Schmid-Leiman
  const g = oblique.map((r) => {
    let s = 0;
    for (let k = 0; k < q; k++) s += r[k]! * gloading[k]!;
    return s;
  });
  const h2 = rowSums(orthog, (v) => v * v);
  const u2 = h2.map((h, i) => R[i]![i]! - h);
  const groupLoadings = oblique.map((r, i) => r.map((v, k) => {
    // one factor (gloading 1): v is 0 exactly, the formula would leave only a rounding residue
    if (q === 1) return 0;
    const Rii = R[i]![i]!;
    let w = Rii - (Rii - v * v) - (v * gloading[k]!) ** 2;
    if (w < 0) w = 0;
    return signOf(v) * Math.sqrt(w);
  }));
  const p2 = g.map((v, i) => (v * v) / h2[i]!);
  const com = g.map((v, i) => {
    const F = [v, ...groupLoadings[i]!];
    return sumOnce(F.map((f) => f * f)) ** 2 / sumOnce(F.map((f) => f ** 4));
  });

  // flip
  const key = g.map(signOf);
  if (key.some((k) => k < 0)) R = R.map((r, i) => r.map((v, j) => key[i]! * v * key[j]!));
  const gs = g.map((v, i) => key[i]! * v);
  const Fs = groupLoadings.map((r, i) => r.map((v) => key[i]! * v));
  const sl = gs.map((v, i) => [v, ...Fs[i]!, h2[i]!, u2[i]!, p2[i]!, com[i]!]);

  // statistics
  const Vt = sumAll(R);
  const Vitem = sumOnce(R.map((r, i) => r[i]!));
  const gsq = sumOnce(gs) ** 2;
  const U = sumOnce(u2);
  const omegaH = gsq / Vt;
  const omegaTot = (Vt - U) / Vt;
  const omegaLim = gsq / (Vt - U);
  const alpha = (((Vt - Vitem) / Vt) * p) / (p - 1);
  const G6 = (Vt + sumOnce(smc(R, messages)) - Vitem) / Vt;
  const ev = colSums(sl.map((r) => r.slice(0, q + 1)), (v) => v * v);
  const ECV = ev[0]! / sumOnce(ev);

  // omega of each group
  const group = Fs.map((r) => {
    let best = 0;
    for (let k = 1; k < q; k++) if (Math.abs(r[k]!) > Math.abs(r[best]!)) best = k;
    return best;
  });
  const groupRows: number[][] = [];
  const aSquares: number[] = [];
  for (let k = 0; k < q; k++) {
    const items = group.map((_, i) => i).filter((i) => group[i] === k);
    const V = sumOnce(items.flatMap((j) => items.map((i) => R[i]![j]!)));
    const a = sumOnce(items.map((i) => Fs[i]![k]!));
    const b = sumOnce(items.map((i) => gs[i]!));
    aSquares.push(a * a);
    groupRows.push([(a * a + b * b) / V, (b * b) / V, (a * a) / V]);
  }
  const omegaGroup = [[omegaTot, sumOnce(gs) ** 2 / Vt, sumOnce(aSquares) / Vt], ...groupRows];

  const out: OmegaResult = {
    omegaH,
    omegaLim,
    alpha,
    omegaTot,
    G6,
    ECV,
    sl,
    slNames: ["g", ...Array.from({ length: q }, (_, k) => `F${k + 1}*`), "h2", "u2", "p2", "com"],
    orthog,
    oblique,
    gloading,
    key,
    omegaGroup,
    warnings,
    messages,
  };
  if (phi !== undefined) out.phi = phi;
  return out;
}
