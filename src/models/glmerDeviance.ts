// The Laplace deviance of a generalised linear mixed model (lme4's glmer) at given parameters: the conditional mode
// of the spherical random effects by penalised iteratively reweighted least squares (PIRLS), the log determinant of
// L_θ at the mode, and the family's aic term. Nothing is optimised here.
//
// Written for rStats.js (no ported code) from oracle/glmer-behaviour.md ("The Laplace deviance", stage 2a) and the
// notation of D. Bates, M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4",
// Journal of Statistical Software 67(1).
//
// With M = ZΛ_θ, η = o + Xβ + M u and μ = μ(η), the conditional mode ũ minimises the penalised deviance
// pdev(u) = Σ d_i + ‖u‖² (for nAGQ = 0, (ũ, β̃) minimise it jointly). Each PIRLS iteration is a Fisher scoring step,
// written here as an increment: with the working weights W_i = w_i μ'_i² / V(μ_i) and the score
// s_i = w_i (y_i − μ_i) μ'_i / V(μ_i),
//   (M'WM + I) δu = M's − u                                        (nAGQ = 1)
//   [M'WM + I, M'WX; X'WM, X'WX] (δu, δβ) = (M's − u, X's)          (nAGQ = 0)
// which is lme4's update u_new = (M'WM + I)⁻¹ M'W z (z the working response) in exact arithmetic, but whose fixed
// point (the score equations) does not depend on the accuracy of the solve. M'WM + I is factorised sparsely with the
// pattern of lmer's Λ'Z'ZΛ + I (src/models/mixedDeviance.ts), Z'WZ formed by blocks at each iteration.
//
// Unlike lme4, which stops when the relative change of pdev is below 1e-7 and takes the log determinant from the
// weights of the means before its last update (so that its deviance is off by up to about 1e-5), the iteration goes
// on to the exact mode: until the Fisher step is below 1e-13 (relative to the largest element of u and β, at least
// 1), or stops shrinking once below 1e-10 (rounding); the weights, the factor and the aic term are then those at the
// mode. Every evaluation starts from the same point, whatever was evaluated before: u = 0 for nAGQ = 1; for
// nAGQ = 0, the first step is lme4's first PIRLS step from the family's starting means (η0 = o + g(μ0)). A step that
// makes pdev NaN or larger is halved (up to 20 times, towards the previous iterate; the first step of nAGQ = 0, which
// has no previous pdev, only for NaN, towards u = 0, β = 0), with lme4's errors where that fails.

import { potf2 } from "../linalg/chol.js";
import { Warnings, withWarnings } from "../internal/warnings.js";
import { familyAic } from "./glmFamily.js";
import type { GlmerStructure } from "./glmerStructure.js";
import {
  backSolve,
  blocksOf,
  blocksOfA,
  factorise,
  forwardSolve,
  lambdaTimes,
  lambdaTransposeTimes,
  solveL,
  solveLt,
  sparseSystemOf,
  weightedCrossProduct,
  zTimes,
  zTransposeTimes,
} from "./mixedDeviance.js";

/** The Laplace deviance and the conditional mode at given parameters. */
export interface GlmerDeviance {
  /** The deviance ldL2 + ussq + aic (−2 times the Laplace approximation of the log-likelihood). */
  deviance: number;
  /** The fixed effects: the given ones (nAGQ = 1), those of the joint mode (nAGQ = 0). */
  beta: number[];
  /** The conditional mode ũ of the spherical random effects. */
  u: number[];
  /** The random effects b = Λ_θ ũ. */
  b: number[];
  /** The conditional means μ (one per row used). */
  mu: number[];
  /** The sum of the deviance residuals at μ. */
  devResid: number;
  /** ‖ũ‖². */
  ussq: number;
  /** The penalised deviance devResid + ussq. */
  pdev: number;
  /** log det(Λ_θ' Z'WZ Λ_θ + I), W the working weights at the mode. */
  ldL2: number;
  /** The family's aic term at μ (−2 log-likelihood; the dispersion from the deviance for Gamma, inverse.gaussian, gaussian). */
  aic: number;
  /** The number of PIRLS iterations. */
  iterations: number;
  /** R's warnings of the evaluation (poisson's non-integer counts). */
  warnings: string[];
}

/** lme4's maximum number of step halvings */
const MAX_HALVINGS = 20;
/** The largest number of iterations (more than lme4's 100: Fisher scoring converges linearly for non-canonical links) */
const MAX_ITERATIONS = 500;
/** The step (relative to the largest element of u and β, at least 1) at which the mode is reached */
const STEP_TOLERANCE = 1e-13;
/** Below this step, a step that does not shrink means rounding: the mode is reached */
const ROUNDING_STEP = 1e-10;
/** lme4's tolPwrss: an increase of pdev larger than this (absolute) after the halvings is an error */
const TOL_PWRSS = 1e-7;

/**
 * The Laplace deviance of a generalised linear mixed model at `theta` (and `beta` for nAGQ = 1), at the exact
 * conditional mode (oracle/glmer-behaviour.md, stage 2a). Internal: not exported from the package.
 *
 * @param structure The structure from {@link glmerStructure}.
 * @param theta The covariance parameters (finite, of the length of `structure.theta`; values below the lower bounds
 *   are accepted).
 * @param beta The fixed effects (one per column of X) for nAGQ = 1; ignored for nAGQ = 0.
 * @param nAGQ 1: the deviance is a function of (θ, β), the mode is found for u; 0: a function of θ, the mode is found
 *   for u and β jointly.
 */
export function glmerDeviance(structure: GlmerStructure, theta: readonly number[], beta: readonly number[] | undefined, nAGQ: 0 | 1 = 1): GlmerDeviance {
  if (nAGQ !== 0 && nAGQ !== 1) throw new RangeError("nAGQ must be 0 or 1 here");
  if (theta.length !== structure.theta.length) throw new RangeError(`theta must have length ${structure.theta.length}, not ${theta.length}`);
  if (theta.some((v) => !Number.isFinite(v))) throw new RangeError("theta must be finite");
  const sys = sparseSystemOf(structure);
  const { n, p, q } = sys;
  if (nAGQ === 1) {
    if (beta === undefined || beta.length !== p) throw new RangeError(`beta must have length ${p}`);
    if (beta.some((v) => !Number.isFinite(v))) throw new RangeError("beta must be finite");
  }
  const joint = nAGQ === 0;
  const fam = structure.family;
  const { x, y, weights: w, offset } = structure;
  const t = blocksOf(sys, theta);
  const warnings = new Warnings();

  return withWarnings(warnings, () => {
    /** A point of the iteration: u, β, the linear predictor, the means and pdev */
    interface Point {
      u: Float64Array;
      beta: Float64Array;
      eta: Float64Array;
      mu: Float64Array;
      devResid: number;
      pdev: number;
    }
    const pointAt = (u: Float64Array, b: Float64Array): Point => {
      const mb = zTimes(sys, lambdaTimes(sys, t, u));
      const eta = new Float64Array(n);
      const mu = new Float64Array(n);
      let devResid = 0;
      for (let i = 0; i < n; i++) {
        const xi = x[i]!;
        let e = offset[i]! + mb[i]!;
        for (let k = 0; k < p; k++) e += xi[k]! * b[k]!;
        eta[i] = e;
        const m = fam.linkinv(e);
        mu[i] = m;
        devResid += fam.devResid(y[i]!, m, w[i]!);
      }
      let ussq = 0;
      for (const v of u) ussq += v * v;
      return { u, beta: b, eta, mu, devResid, pdev: devResid + ussq };
    };

    /** The working weights and W(η − o − Xβ_base) + s (the right-hand side's data part) at η, μ */
    const weightsAt = (eta: Float64Array, mu: Float64Array): { ww: Float64Array; score: Float64Array } => {
      const ww = new Float64Array(n);
      const score = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const wi = w[i]!;
        if (wi === 0) continue;
        const me = fam.muEta(eta[i]!);
        const v = fam.variance(mu[i]!);
        ww[i] = (wi * me * me) / v;
        score[i] = (wi * (y[i]! - mu[i]!) * me) / v;
      }
      return { ww, score };
    };

    /**
     * Factorises the system at the weights `ww` and returns its factor L and the solver of the step: overwrites gu
     * with δu (and gb with δβ for nAGQ = 0)
     */
    const systemAt = (ww: Float64Array): { l: Float64Array; solve: (gu: Float64Array, gb: Float64Array) => void } => {
      const l = factorise(sys, blocksOfA(sys, t, weightedCrossProduct(sys, structure, ww)));
      if (!joint) {
        return {
          l,
          solve: (gu) => {
            solveL(sys, l, gu);
            solveLt(sys, l, gu);
          },
        };
      }
      // C = L⁻¹ Λ'Z'WX (q × p, column-major) and R_X'R_X = X'WX − C'C (the matrix of the step only: its accuracy
      // affects the speed of the iteration, not its fixed point)
      const c = new Float64Array(q * p);
      for (let k = 0; k < p; k++) {
        const col = lambdaTransposeTimes(sys, t, zTransposeTimes(sys, Float64Array.from(x, (row, i) => ww[i]! * row[k]!)));
        solveL(sys, l, col);
        c.set(col, k * q);
      }
      const rx = new Float64Array(p * p);
      for (let k = 0; k < p; k++) {
        for (let m = k; m < p; m++) {
          let sum = 0;
          for (let i = 0; i < n; i++) sum += ww[i]! * x[i]![k]! * x[i]![m]!;
          for (let i = 0; i < q; i++) sum -= c[i + k * q]! * c[i + m * q]!;
          rx[k + m * p] = sum;
          rx[m + k * p] = sum;
        }
      }
      if (p > 0 && potf2({ nrow: p, ncol: p, data: rx }) > 0) {
        throw new Error("the fixed-effects matrix of the penalised least squares is not positive definite");
      }
      return {
        l,
        solve: (gu, gb) => {
          solveL(sys, l, gu);
          for (let k = 0; k < p; k++) {
            let sum = gb[k]!;
            for (let i = 0; i < q; i++) sum -= c[i + k * q]! * gu[i]!;
            gb[k] = sum;
          }
          forwardSolve(rx, p, gb);
          backSolve(rx, p, gb);
          for (let k = 0; k < p; k++) {
            const bk = gb[k]!;
            for (let i = 0; i < q; i++) gu[i]! -= c[i + k * q]! * bk;
          }
          solveLt(sys, l, gu);
        },
      };
    };

    const infNorm = (v: Float64Array): number => {
      let m = 0;
      for (const e of v) m = Math.max(m, Math.abs(e));
      return m;
    };
    const fixedBeta = Float64Array.from(beta ?? new Array<number>(p).fill(0));

    // the starting point: u = 0 (nAGQ = 1); for nAGQ = 0, η0 = o + g(μ0), which is not of the form o + Xβ + Mu: the
    // first step solves for (u, β) from it (base u = 0, β = 0)
    let cur: Point;
    let first = joint;
    if (joint) {
      const eta = Float64Array.from(structure.mustart, (m, i) => offset[i]! + fam.linkfun(m));
      const mu = eta.map((e) => fam.linkinv(e));
      cur = { u: new Float64Array(q), beta: new Float64Array(p), eta, mu, devResid: NaN, pdev: Infinity };
    } else cur = pointAt(new Float64Array(q), fixedBeta);

    let prevSize = Infinity;
    let l: Float64Array | undefined;
    let iterations = 0;
    for (;;) {
      if (iterations >= MAX_ITERATIONS) throw new Error("pwrssUpdate did not converge in (maxit) iterations");
      const { ww, score } = weightsAt(cur.eta, cur.mu);
      const system = systemAt(ww);
      l = system.l;
      // the right-hand side: (M's − u, X's); for the first step of nAGQ = 0 (from η0, base 0) (M'r, X'r) with
      // r = W(η0 − o) + s, the working response times the weights
      let rhs = score;
      if (first) rhs = score.map((s, i) => s + ww[i]! * (cur.eta[i]! - offset[i]!));
      const du = lambdaTransposeTimes(sys, t, zTransposeTimes(sys, rhs));
      if (!first) for (let i = 0; i < q; i++) du[i]! -= cur.u[i]!;
      const db = new Float64Array(p);
      if (joint) {
        for (let i = 0; i < n; i++) {
          const xi = x[i]!;
          const r = rhs[i]!;
          for (let k = 0; k < p; k++) db[k]! += xi[k]! * r;
        }
      }
      system.solve(du, db);
      iterations++;

      const base = first ? { u: new Float64Array(q), beta: new Float64Array(p) } : cur;
      if (!first) {
        const size = Math.max(infNorm(du) / Math.max(1, infNorm(cur.u)), joint ? infNorm(db) / Math.max(1, infNorm(cur.beta)) : 0);
        // the mode: the step is negligible, or has stopped shrinking at the level of rounding
        if (size <= STEP_TOLERANCE || (size < ROUNDING_STEP && size >= prevSize)) break;
        prevSize = size;
      }
      const candidate = (): Point => {
        const u = base.u.map((v, i) => v + du[i]!);
        const b = joint ? base.beta.map((v, k) => v + db[k]!) : fixedBeta;
        return pointAt(u, b);
      };
      let next = candidate();
      // step halving: for NaN, or (after the first step of nAGQ = 0) an increase beyond rounding
      const pdevOld = cur.pdev;
      const slack = Number.isFinite(pdevOld) ? 1e-13 * pdevOld : 0;
      for (let k = 0; k < MAX_HALVINGS && (Number.isNaN(next.pdev) || next.pdev > pdevOld + slack); k++) {
        for (let i = 0; i < q; i++) du[i]! /= 2;
        for (let i = 0; i < p; i++) db[i]! /= 2;
        next = candidate();
      }
      if (Number.isNaN(next.pdev)) throw new Error("PIRLS loop resulted in NaN value");
      if (next.pdev - pdevOld > TOL_PWRSS) throw new Error("(maxstephalfit) PIRLS step-halvings failed to reduce deviance in pwrssUpdate");
      cur = next;
      first = false;
    }

    // at the mode: the factor of the last iteration was formed with the weights at the mode
    let ldL2 = 0;
    for (let j = 0; j < q; j++) ldL2 += Math.log(l[sys.colStart[j]!]!);
    ldL2 *= 2;
    const mu = Array.from(cur.mu);
    const aic = familyAic(fam.glm, y, mu, w, structure.size, cur.devResid, warnings);
    let ussq = 0;
    for (const v of cur.u) ussq += v * v;
    return {
      deviance: ldL2 + ussq + aic,
      beta: Array.from(cur.beta),
      u: Array.from(cur.u),
      b: Array.from(lambdaTimes(sys, t, cur.u)),
      mu,
      devResid: cur.devResid,
      ussq,
      pdev: cur.devResid + ussq,
      ldL2,
      aic,
      iterations,
      warnings: warnings.list,
    };
  });
}
