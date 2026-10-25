// Profile likelihood confidence intervals for the coefficients of a generalized linear model (R's confint for glm,
// from MASS's and stats' profile.glm), computed exactly instead of by R's interpolation.
//
// Written for rStats.js (no ported code). For a coefficient b_j, the signed root statistic
//   z(b) = sign(b - hat b_j) sqrt((D(b) - D(hat b)) / dispersion)
// (D(b): the deviance of the model refitted with b_j fixed at b, that is with b x_j as part of the offset; for
// test = "Rao" the score statistic of that restricted fit instead of D(b) - D(hat b)) is solved for z(b) = qnorm((1 -/+
// level) / 2), as in R (also for the families with an estimated dispersion, which R does not refer to the t
// distribution here). The definition follows P. McCullagh and J. A. Nelder, Generalized Linear Models (2nd ed., 1989),
// §7.2 (likelihood ratio and score statistics), and R's documentation of confint.glm and profile.glm (R's code, GPL,
// was not copied). R moves b on a
// grid of about 1/5 of a standard error and interpolates b as a function of z by a spline, which is accurate to about
// 1e-4; here every refit is iterated to rounding and the root is found by Brent's method (R's uniroot), so the limits
// are the exact solutions (see docs/differences-from-r.md). The fit and its dispersion are those of the maximum
// likelihood estimate to rounding, refitted from the model of `fit`.

import { qnorm1 } from "../distributions/normal.js";
import { qr, qrCoef } from "../linalg/qr.js";
import { uniroot } from "../internal/uniroot.js";
import { familyOf, glmFitCore, type FitInput, type FitOutput, type GlmResult } from "./glm.js";
import { initialize } from "./glmFamily.js";

/** Options for {@link glmConfint}. */
export interface GlmConfintOptions {
  /** Confidence level. Default `0.95`. */
  level?: number;
  /** Indices of the coefficients (0-based, intercept first). Default: all. */
  parm?: number[];
  /** `"LRT"` (default; the likelihood ratio statistic) or `"Rao"` (the score statistic). */
  test?: "LRT" | "Rao";
}

/** Weighted least squares deviance of r on X (rows of positive weight), and the weighted sum of squares of r */
export function weightedScore(X: readonly (readonly number[])[], r: readonly number[], w: readonly number[], centre: boolean): number {
  const rows: number[][] = [];
  const rw: number[] = [];
  for (let i = 0; i < r.length; i++) {
    if (!(w[i]! > 0)) continue;
    const s = Math.sqrt(w[i]!);
    rows.push(X[i]!.map((v) => v * s));
    rw.push(r[i]! * s);
  }
  let sw = 0;
  let swr = 0;
  for (let i = 0; i < r.length; i++) {
    sw += w[i]!;
    swr += w[i]! * r[i]!;
  }
  const m = centre ? swr / sw : 0;
  let nullDev = 0;
  for (let i = 0; i < r.length; i++) nullDev += w[i]! * (r[i]! - m) ** 2;
  if (rows.length === 0 || rows[0]!.length === 0) return 0;
  const b = qrCoef(qr(rows, { tol: 1e-11 }), rw).map((v) => (Number.isNaN(v) ? 0 : v));
  let dev = 0;
  for (let i = 0; i < r.length; i++) {
    let f = 0;
    for (let j = 0; j < b.length; j++) f += X[i]![j]! * b[j]!;
    dev += w[i]! * (r[i]! - f) ** 2;
  }
  return nullDev - dev;
}

/**
 * Profile likelihood confidence intervals for the coefficients of a {@link glm} fit. Equivalent to R's `confint(fit,
 * parm, level, test)` for a glm (which profiles the deviance), but the limits are the exact solutions of
 * z(b) = qnorm((1 -/+ level) / 2) for the signed root z of the likelihood ratio (or score) statistic, where R
 * interpolates between points of a grid (R's limits differ by up to about 5e-4 relative). NaN for aliased columns and
 * where the profile does not reach the cutoff (within 2^30 standard errors).
 */
export function glmConfint(fit: GlmResult, options: GlmConfintOptions = {}): { lower: number[]; upper: number[] } {
  return profileConfint(fit, options, false);
}

/**
 * glmConfint, with the refits iterated to rounding, or (rRule, for the tests) stopped by R's rule with epsilon = 1e-14
 * from the family's starting values, as the references of test/fixtures/glmConfint.json were computed.
 */
export function profileConfint(fit: GlmResult, options: GlmConfintOptions, rRule: boolean): { lower: number[]; upper: number[] } {
  const level = options.level ?? 0.95;
  if (!(level > 0 && level < 1)) throw new RangeError("'level' must be in (0, 1)");
  const test = options.test ?? "LRT";
  if (test !== "LRT" && test !== "Rao") throw new RangeError(`invalid 'test' "${String(test)}"`);
  const p = fit.coefficients.length;
  const parm = options.parm ?? Array.from({ length: p }, (_, j) => j);
  for (const j of parm) if (!Number.isInteger(j) || j < 0 || j >= p) throw new RangeError(`'parm' must be indices from 0 to ${p - 1}`);
  const fam = familyOf(fit);
  const cols = fit.coefficients.flatMap((c, j) => (Number.isNaN(c) ? [] : [j]));
  const nobs = fit.y.length;
  const offset = fit.offset ?? new Array<number>(nobs).fill(0);
  const ini = initialize(fam, fit.y, fit.priorWeights, false, () => {});
  const base = (X: number[][], off: number[], etastart?: number[]): FitInput => ({
    X, y: ini.y, weights: ini.weights, offset: off, fam, n: ini.n, mustart: ini.mustart, etastart, epsilon: 1e-14, maxit: 200,
    intercept: fit.intercept, warn: () => {}, qrTol: 1e-7, toRounding: !rRule,
  });
  const Xfull = fit.modelMatrix.map((r) => cols.map((j) => r[j]!));
  // the maximum likelihood estimate to rounding
  const full = glmFitCore(base(Xfull, offset, rRule ? undefined : fit.linearPredictors));
  let disp = 1;
  if (!fam.fixedDispersion) {
    let s = 0;
    full.w.forEach((w, i) => {
      if (w > 0) s += w * full.residuals[i]! ** 2;
    });
    disp = s / full.dfResidual;
  }
  const bhat = new Array<number>(p).fill(NaN);
  cols.forEach((j, k) => (bhat[j] = full.coef[k]!));
  // standard errors of the full fit
  const R = full.qr.qr;
  const rank = full.rank;
  const se = new Array<number>(p).fill(NaN);
  if (rank === cols.length) {
    // diagonal of (R'R)^-1 in pivot order: row norms of R^-1
    const piv = full.qr.pivot;
    const Rinv: number[][] = Array.from({ length: rank }, () => new Array<number>(rank).fill(0));
    for (let c = 0; c < rank; c++) {
      for (let i = c; i >= 0; i--) {
        let s = i === c ? 1 : 0;
        for (let k = i + 1; k <= c; k++) s -= R[i]![k]! * Rinv[k]![c]!;
        Rinv[i]![c] = s / R[i]![i]!;
      }
    }
    for (let i = 0; i < rank; i++) se[cols[piv[i]!]!] = Math.sqrt(disp * Rinv[i]!.reduce((s, v) => s + v * v, 0));
  }
  const cut = [qnorm1((1 - level) / 2, 0, 1, true, false), qnorm1((1 + level) / 2, 0, 1, true, false)];
  const lower: number[] = [];
  const upper: number[] = [];
  for (const j of parm) {
    const k = cols.indexOf(j);
    if (k < 0 || !Number.isFinite(se[j]!)) {
      lower.push(NaN);
      upper.push(NaN);
      continue;
    }
    const keep = cols.map((_, kk) => kk).filter((kk) => kk !== k);
    const Xr = Xfull.map((r) => keep.map((kk) => r[kk]!));
    const xj = Xfull.map((r) => r[k]!);
    // each refit starts from the linear predictor of the full fit (or, failing that, from the family's starting
    // values): a start shifted by x_j (b - hat b) can send the first step far away
    const restricted = (b: number): FitOutput | undefined => {
      const off = offset.map((o, i) => o + xj[i]! * b);
      for (const etastart of [full.eta, undefined]) {
        try {
          const out = glmFitCore(base(Xr, off, etastart));
          if (out.conv) return out;
        } catch {
          // try the next starting values
        }
      }
      return undefined;
    };
    const z = (b: number): number => {
      const out = restricted(b);
      if (out === undefined) return NaN;
      const zz = test === "LRT" ? (out.dev - full.dev) / disp : weightedScore(Xfull, out.residuals, out.w, false) / disp;
      return Math.sign(b - bhat[j]!) * Math.sqrt(Math.max(zz, 0));
    };
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? -1 : 1;
      const target = cut[side]!;
      let inner = bhat[j]!;
      let fInner = -target;
      let root = NaN;
      for (let e = 0; e <= 30; e++) {
        const b = bhat[j]! + sgn * 2 ** e * se[j]!;
        const zb = z(b);
        if (Number.isNaN(zb)) break;
        if (Math.abs(zb) >= Math.abs(target)) {
          const lo = Math.min(inner, b);
          const hi = Math.max(inner, b);
          const f = (t: number): number => z(t) - target;
          const fb = zb - target;
          root = uniroot(f, lo, hi, {
            tol: 1e-15 * Math.max(1, Math.abs(b)),
            maxIter: 500,
            fLower: lo === inner ? fInner : fb,
            fUpper: hi === inner ? fInner : fb,
          });
          break;
        }
        inner = b;
        fInner = zb - target;
      }
      (side === 0 ? lower : upper).push(root);
    }
  }
  return { lower, upper };
}
