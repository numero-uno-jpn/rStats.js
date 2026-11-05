// The analytic gradient of glmer's deviances at the exact conditional mode: the Laplace deviance d₁(θ, β) (nAGQ = 1)
// and d₀(θ) (nAGQ = 0, β from the joint mode), by implicit differentiation through the mode. The adaptive
// Gauss-Hermite deviance (nAGQ > 1) has its own, in src/models/glmerDeviance.ts next to the deviance.
//
// Written for rStats.js (no ported code; lme4 has no analytic gradient) from the derivation in oracle/glmer-behaviour.md
// ("The gradient (rStats.js)"). In short, with M = ZΛ_θ, η = o + Xβ + Mu, μ = μ(η), the working (Fisher) weights
// W_i = w_i μ'_i² / V(μ_i), the score s_i = w_i (y_i − μ_i) μ'_i / V(μ_i), the observed weights Ŵ_i = −∂s_i/∂η_i,
// A = M'WM + I and H = M'ŴM + I (the Hessian of pdev / 2 in u; H = A for a canonical link):
//   D = log det A + ‖u‖² + aic(μ),  the mode u solves M's(η) = u.
// D depends on η directly (through aic and through W in A): ∂D/∂η_i = c_i = W'_i h_i + ∂aic/∂η_i, with W'_i = dW_i/dη_i
// and h_i = m_i' A⁻¹ m_i (m_i the i-th row of M), and on θ through Λ in A (2 tr(A⁻¹ Λ'Z'WZ ∂Λ), lmer's trace term with
// Z'WZ in place of Z'Z). The mode moves with the parameters: one solve of the adjoint system H v = M'c + 2u (nAGQ = 1;
// for nAGQ = 0 the bordered system of (u, β) with X'c below) replaces the derivatives of u. With r = c − Ŵ(Mv) (plus
// Ŵ X v_β for nAGQ = 0),
//   ∂D/∂β = X'r,   ∂D/∂θ_j = 2 tr(A⁻¹ Λ'Z'WZ ∂Λ) + Σ_(a,b) [(Z'r)_a u_b + (Z's)_a v_b],
// the sum over the entries (a, b) of Λ_θ that hold θ_j. The cost is about two factorisations (one when H = A), the
// selected inverse of A and a few products with Z, X and Λ.

import { potf2 } from "../linalg/chol.js";
import { roundHalfEven } from "../internal/integer.js";
import { digamma } from "../special/psigamma.js";
import { gradientWeights, type GlmerFamily } from "./glmerFamily.js";
import type { GlmerStructure } from "./glmerStructure.js";
import {
  backSolve,
  blocksOfA,
  factorise,
  forwardSolve,
  lambdaTimes,
  lambdaTransposeTimes,
  levelTraceSums,
  selectedInverse,
  solveL,
  solveLt,
  weightedCrossProduct,
  zTimes,
  zTransposeTimes,
  type SparseSystem,
} from "./mixedDeviance.js";

/** Whether the link is the family's canonical one (then Ŵ = W: s_i' = −W_i exactly) */
export function isCanonical(fam: GlmerFamily): boolean {
  return (
    (fam.family === "binomial" && fam.link === "logit") ||
    (fam.family === "poisson" && fam.link === "log") ||
    (fam.family === "Gamma" && fam.link === "inverse") ||
    (fam.family === "inverse.gaussian" && fam.link === "1/mu^2")
  );
}

/**
 * ψ(a) − log a + 1 / (2a) without cancellation for large a (the asymptotic series from a = 10 on: its next term is
 * below 1e-17 relative there)
 */
function digammaRemainder(a: number): number {
  if (a < 10) return digamma(a) - Math.log(a) + 1 / (2 * a);
  const a2 = 1 / (a * a);
  return -a2 * (1 / 12 - a2 * (1 / 120 - a2 * (1 / 252 - a2 * (1 / 240 - a2 / 132))));
}

/**
 * The derivative of the family's aic term (src/models/glmFamily.ts familyAic) with respect to each μ_i, the
 * dispersion of Gamma, inverse.gaussian and gaussian (dev / Σ w or dev / n) differentiated through dev = Σ d_i, with
 * ∂d_i/∂μ_i = −2 w_i (y_i − μ_i) / V(μ_i). Rows of prior weight 0 are not in the aic term (0).
 */
export function aicDerivative(
  fam: GlmerFamily,
  y: readonly number[],
  mu: ArrayLike<number>,
  w: readonly number[],
  size: readonly number[] | undefined,
  dev: number,
): Float64Array {
  const n = y.length;
  const out = new Float64Array(n);
  switch (fam.family) {
    case "binomial": {
      // −2 Σ (w/m) log dbinom(k, N, μ), k = round(m y), N = round(m)
      const m = size !== undefined && size.some((v) => v > 1) ? size : w;
      for (let i = 0; i < n; i++) {
        const mi = m[i]!;
        if (!(mi > 0)) continue;
        const k = roundHalfEven(mi * y[i]!);
        const total = roundHalfEven(mi);
        const ui = mu[i]!;
        out[i] = -2 * (w[i]! / mi) * ((k === 0 ? 0 : k / ui) - (total - k === 0 ? 0 : (total - k) / (1 - ui)));
      }
      return out;
    }
    case "poisson":
      for (let i = 0; i < n; i++) if (w[i]! > 0) out[i] = -2 * w[i]! * (y[i]! / mu[i]! - 1);
      return out;
    case "Gamma": {
      // −2 Σ w log dgamma(y; 1/D, μ D) + 2, D = dev / Σ w: directly −2 w (y − μ) / (D μ²), and through D, with
      // ∂aic/∂D = −2 Σ w (ψ(a) − log a + 1/(2a)) / D² (a = 1/D; Σ w (y/μ − 1 − log(y/μ)) = dev / 2 used)
      let sw = 0;
      for (const wi of w) sw += wi;
      const a = sw / dev;
      const factor = a - 2 * a * a * digammaRemainder(a);
      for (let i = 0; i < n; i++) {
        if (!(w[i]! > 0)) continue;
        const num = -2 * w[i]! * (y[i]! - mu[i]!) * factor;
        const m2 = mu[i]! * mu[i]!;
        // (divided by μ twice where μ² overflows: a mean of 1e200; the gradient multiplies by μ' again)
        out[i] = m2 < Infinity ? num / m2 : num / mu[i]! / mu[i]!;
      }
      return out;
    }
    case "inverse.gaussian": {
      // Σw (log(2π dev / Σw) + 1) + ...: Σw / dev times ∂dev/∂μ
      let sw = 0;
      for (const wi of w) if (wi > 0) sw += wi;
      for (let i = 0; i < n; i++) {
        if (!(w[i]! > 0)) continue;
        const num = -2 * w[i]! * (y[i]! - mu[i]!);
        const m3 = mu[i]! * mu[i]! * mu[i]!;
        // (divided by μ three times where μ³ is out of range: a mean of 1e110 or 1e-110)
        out[i] = (sw / dev) * (Math.abs(m3) >= 2 ** -1022 && m3 < Infinity ? num / m3 : num / mu[i]! / mu[i]! / mu[i]!);
      }
      return out;
    }
    case "gaussian": {
      let nPos = 0;
      for (const wi of w) if (wi > 0) nPos++;
      for (let i = 0; i < n; i++) if (w[i]! > 0) out[i] = (nPos / dev) * -2 * w[i]! * (y[i]! - mu[i]!);
      return out;
    }
  }
}

/** The weights of the rows at η, μ: W, dW/dη, Ŵ and the score s */
export interface RowWeights {
  ww: Float64Array;
  dww: Float64Array;
  observed: Float64Array;
  score: Float64Array;
}

/** {@link RowWeights} at the mode (rows of prior weight 0: all 0) */
export function rowWeights(s: GlmerStructure, eta: ArrayLike<number>, mu: ArrayLike<number>): RowWeights {
  const n = s.y.length;
  const fam = s.family;
  const canonical = isCanonical(fam);
  const ww = new Float64Array(n);
  const dww = new Float64Array(n);
  const observed = new Float64Array(n);
  const score = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const wi = s.weights[i]!;
    if (wi === 0) continue;
    const g = gradientWeights(fam, wi, s.y[i]!, eta[i]!, mu[i]!, canonical);
    ww[i] = g.ww;
    dww[i] = g.dww;
    score[i] = g.score;
    observed[i] = g.observed;
  }
  return { ww, dww, observed, score };
}

/**
 * h_i = m_i' A⁻¹ m_i for every row (m_i = Λ_θ' z_i, the i-th row of ZΛ_θ), from the selected inverse `inv` of A (the
 * layout of L): the groups of a row are adjacent in A, so the blocks of A⁻¹ needed are on the pattern of L
 */
export function rowLeverages(s: GlmerStructure, sys: SparseSystem, t: Float64Array[], inv: Float64Array, rows: ArrayLike<number>): Float64Array {
  const n = s.y.length;
  const nTerms = s.terms.length;
  const nPairs = (nTerms * (nTerms + 1)) / 2;
  const { colStart, blockPatternOffset, rowBlocks } = sys;
  const h = new Float64Array(n);
  const m = s.terms.map((term) => new Float64Array(term.columns.length));
  const first = new Int32Array(nTerms);
  for (let i = 0; i < n; i++) {
    if (rows[i] === 0) continue;
    for (let k = 0; k < nTerms; k++) {
      const term = s.terms[k]!;
      const nc = term.columns.length;
      const zi = term.matrix[i]!;
      const tk = t[k]!;
      const mk = m[k]!;
      for (let c = 0; c < nc; c++) {
        let sum = 0;
        for (let r = c; r < nc; r++) sum += tk[r + c * nc]! * zi[r]!;
        mk[c] = sum;
      }
      first[k] = term.zOffset + s.groups[term.group]!.codes[i]! * nc;
    }
    let sum = 0;
    for (let k = 0; k < nTerms; k++) {
      const nck = m[k]!.length;
      const mk = m[k]!;
      // the diagonal block (lower triangle stored)
      for (let cc = 0; cc < nck; cc++) {
        const col = colStart[first[k]! + cc]!;
        sum += mk[cc]! * mk[cc]! * inv[col]!;
        for (let rr = cc + 1; rr < nck; rr++) sum += 2 * mk[rr]! * mk[cc]! * inv[col + rr - cc]!;
      }
      for (let l = 0; l < k; l++) {
        const ml = m[l]!;
        const ncl = ml.length;
        const b = rowBlocks[i * nPairs + (k * (k + 1)) / 2 + l]!;
        for (let cc = 0; cc < ncl; cc++) {
          const at = colStart[first[l]! + cc]! + (ncl - cc) + blockPatternOffset[b]!;
          for (let rr = 0; rr < nck; rr++) sum += 2 * mk[rr]! * ml[cc]! * inv[at + rr]!;
        }
      }
    }
    h[i] = sum;
  }
  return h;
}

/** What the Laplace gradient needs from the evaluation at the mode */
export interface LaplaceState {
  structure: GlmerStructure;
  sys: SparseSystem;
  /** The blocks T_k at θ */
  t: Float64Array[];
  /** The factor of A = Λ'Z'WZΛ + I at the mode */
  l: Float64Array;
  u: Float64Array;
  eta: Float64Array;
  mu: Float64Array;
  /** Σ d_i at the mode (the dev of the aic term) */
  devResid: number;
  /** nAGQ = 0: β from the joint mode (the gradient is in θ only) */
  joint: boolean;
}

/**
 * The gradient of the Laplace deviance (see the header): with respect to (θ, β) for nAGQ = 1, θ for nAGQ = 0. Throws
 * the Error of {@link factorise} if H is not positive definite (a non-canonical link far from a minimum of pdev).
 */
export function laplaceGradient(state: LaplaceState): number[] {
  const { structure: s, sys, t, l, u, eta, mu, devResid, joint } = state;
  const { n, p, q } = sys;
  const fam = s.family;
  const x = s.x;
  const { ww, dww, observed, score } = rowWeights(s, eta, mu);
  const dAic = aicDerivative(fam, s.y, mu, s.weights, s.size, devResid);
  const inv = selectedInverse(sys, l);
  const h = rowLeverages(s, sys, t, inv, dww);
  const c = new Float64Array(n);
  for (let i = 0; i < n; i++) if (s.weights[i]! !== 0) c[i] = dww[i]! * h[i]! + dAic[i]! * fam.muEta(eta[i]!);

  // the trace term: lmer's, with Z'WZ
  const nTheta = s.theta.length;
  const gradient = new Array<number>(nTheta + (joint ? 0 : p)).fill(0);
  const sums = levelTraceSums(sys, inv, t, weightedCrossProduct(sys, s, ww));
  sys.termTheta.forEach((idx, k) => {
    const nc = sys.termNc[k]!;
    for (let cl = 0; cl < nc; cl++) for (let rl = cl; rl < nc; rl++) gradient[idx[rl + cl * nc]!]! += 2 * sums[k]![cl + rl * nc]!;
  });

  // the adjoint system H v = Λ'Z'c + 2u (with X'c for nAGQ = 0)
  const lh = isCanonical(fam) ? l : factorise(sys, blocksOfA(sys, t, weightedCrossProduct(sys, s, observed)));
  const v = lambdaTransposeTimes(sys, t, zTransposeTimes(sys, c));
  for (let j = 0; j < q; j++) v[j]! += 2 * u[j]!;
  let xi: Float64Array;
  if (joint) {
    const vb = new Float64Array(p);
    for (let i = 0; i < n; i++) for (let k = 0; k < p; k++) vb[k]! += x[i]![k]! * c[i]!;
    solveBordered(s, sys, t, lh, observed, v, vb);
    xi = zTimes(sys, lambdaTimes(sys, t, v));
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < p; k++) xi[i]! += x[i]![k]! * vb[k]!;
    }
  } else {
    solveL(sys, lh, v);
    solveLt(sys, lh, v);
    xi = zTimes(sys, lambdaTimes(sys, t, v));
  }
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = c[i]! - observed[i]! * xi[i]!;
  const zr = zTransposeTimes(sys, r);
  const zs = zTransposeTimes(sys, score);
  for (const { row, col, theta } of s.lambda) gradient[theta]! += zr[row]! * u[col]! + zs[row]! * v[col]!;
  if (!joint) {
    for (let i = 0; i < n; i++) {
      const ri = r[i]!;
      if (ri === 0) continue;
      const xr = x[i]!;
      for (let k = 0; k < p; k++) gradient[nTheta + k]! += xr[k]! * ri;
    }
  }
  return gradient;
}

/**
 * Solves [Λ'Z'ŴZΛ + I, Λ'Z'ŴX; X'ŴZΛ, X'ŴX] (v, vb) = (v, vb) in place, `lh` the factor of the upper left block (the
 * Schur complement X'ŴX − C'C, C = L_H⁻¹ Λ'Z'ŴX, by Cholesky)
 */
function solveBordered(
  s: GlmerStructure,
  sys: SparseSystem,
  t: Float64Array[],
  lh: Float64Array,
  weights: Float64Array,
  v: Float64Array,
  vb: Float64Array,
): void {
  const { n, p, q } = sys;
  const x = s.x;
  const cm = new Float64Array(q * p);
  for (let k = 0; k < p; k++) {
    const col = lambdaTransposeTimes(sys, t, zTransposeTimes(sys, Float64Array.from(x, (row, i) => weights[i]! * row[k]!)));
    solveL(sys, lh, col);
    cm.set(col, k * q);
  }
  const sm = new Float64Array(p * p);
  for (let k = 0; k < p; k++) {
    for (let m = k; m < p; m++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += weights[i]! * x[i]![k]! * x[i]![m]!;
      for (let i = 0; i < q; i++) sum -= cm[i + k * q]! * cm[i + m * q]!;
      sm[k + m * p] = sum;
      sm[m + k * p] = sum;
    }
  }
  if (p > 0 && potf2({ nrow: p, ncol: p, data: sm }) > 0) throw new Error("the fixed-effects matrix of the penalised least squares is not positive definite");
  solveL(sys, lh, v);
  for (let k = 0; k < p; k++) {
    let sum = vb[k]!;
    for (let i = 0; i < q; i++) sum -= cm[i + k * q]! * v[i]!;
    vb[k] = sum;
  }
  forwardSolve(sm, p, vb);
  backSolve(sm, p, vb);
  for (let k = 0; k < p; k++) {
    const bk = vb[k]!;
    for (let i = 0; i < q; i++) v[i]! -= cm[i + k * q]! * bk;
  }
  solveLt(sys, lh, v);
}
