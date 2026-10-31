// Profile likelihood confidence intervals for the coefficients of a glm (R's confint for a glm fit, MASS's method
// before R 4.4), with the exact limits instead of R's spline interpolation of the profile.
//
// Written for rStats.js (no ported code) from oracle/glm-behaviour.md and R's help pages (?confint, ?profile.glm).
// The signed root of the likelihood ratio statistic (McCullagh and Nelder 1989) of coefficient j is
//   z(b) = sign(b - b_j) sqrt((D(b) - D) / phi),
// with D(b) the deviance of the fit with b_j fixed at b (its column moved into the offset), D the deviance of the fit and
// phi its dispersion; for the score test (test = "Rao") D(b) - D is replaced by the score statistic of the restricted
// fit. The limits solve z(b) = qnorm((1 -/+ level) / 2) by Brent's method on a bracket found by doubling the distance
// from the estimate (up to 2^30 standard errors). All fits are iterated until the coefficients stop changing (to
// rounding, at most 100 iterations): the deviance is stationary at the estimate, so R's rule on its relative change
// stops while the coefficients, the dispersion and the score statistic can still move by about sqrt(epsilon).

import { qnorm } from "../distributions/normal.js";
import { ldexp } from "../internal/summary.js";
import { uniroot } from "../internal/uniroot.js";
import { qr, qrResid } from "../linalg/qr.js";
import { glmSummary, refit, scaledView, type GlmResult, type IrlsFit } from "./glm.js";
import { Warnings } from "./glmFamily.js";

/**
 * Options for {@link glmConfint}.
 *
 * @category Generalized linear models
 */
export interface GlmConfintOptions {
  /** Indices of the coefficients (0-based, intercept first). Default: all. */
  parm?: readonly number[];
  /** Confidence level. Default `0.95`. */
  level?: number;
  /** `"LRT"` (default; the likelihood ratio) or `"Rao"` (the score statistic). */
  test?: "LRT" | "Rao";
}

/**
 * Settings of the fits iterated to convergence: until the coefficients stop changing (at most 100 iterations), and
 * the tolerance of the QR decomposition that of epsilon = 1e-300 (columns found aliased by the fit are left out)
 */
const CONVERGED = { epsilon: 1e-300, maxit: 100, untilCoefficients: true };

/**
 * Score statistic of residuals r with weights v regressed on the columns of x (rows of weight 0 left out): the
 * weighted sum of squares of r about its weighted mean (about 0 without intercept) minus the residual sum of squares.
 */
export function scoreStatistic(x: number[][], r: number[], v: number[], intercept: boolean, tol = 1e-11): number {
  const rows: number[] = [];
  for (let i = 0; i < r.length; i++) if (v[i]! > 0) rows.push(i);
  let sw = 0;
  let swr = 0;
  for (const i of rows) {
    sw += v[i]!;
    swr += v[i]! * r[i]!;
  }
  const centre = intercept ? swr / sw : 0;
  let total = 0;
  for (const i of rows) total += v[i]! * (r[i]! - centre) ** 2;
  const p = x.length > 0 ? x[0]!.length : 0;
  if (p === 0 || rows.length === 0) return 0;
  const s = rows.map((i) => Math.sqrt(v[i]!));
  const q = qr(rows.map((i, k) => x[i]!.map((t) => t * s[k]!)), { tol });
  const res = qrResid(q, rows.map((i, k) => r[i]! * s[k]!));
  let rss = 0;
  for (const e of res) rss += e * e;
  return total - rss;
}

/**
 * Profile likelihood confidence intervals for the coefficients of a generalized linear model (NaN for aliased
 * columns, and for a limit that the profile does not reach), for a `glm` fit. Equivalent to R's `confint()`. With
 * the exact solutions of the profile equations, where R interpolates a spline through a grid of profile points (and
 * is up to about 5e-4 standard errors from them).
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmConfint(fit); // { lower: [-15.124, -0.065819], upper: [0.57792, 4.1592] }
 * ```
 *
 * @category Generalized linear models
 */
export function glmConfint(
  given: GlmResult,
  options: GlmConfintOptions = {},
): {
  /** Lower limits, one per coefficient (R's first column, `2.5 %` by default). */
  lower: number[];
  /** Upper limits, one per coefficient (R's second column, `97.5 %` by default). */
  upper: number[];
} {
  // on the scaled fit (scaledView); the limits scaled back
  const { fit, k } = scaledView(given);
  const level = options.level ?? 0.95;
  const test = options.test ?? "LRT";
  if (test !== "LRT" && test !== "Rao") throw new RangeError(`invalid 'test': ${String(test)}`);
  if (!(level > 0 && level < 1)) throw new RangeError("'level' must be in (0, 1)");
  const p = fit.coefficients.length;
  const parm = options.parm ?? Array.from({ length: p }, (_, j) => j);
  for (const j of parm) if (!Number.isInteger(j) || j < 0 || j >= p) throw new RangeError(`invalid coefficient index ${j}`);
  const model = fit.model;
  const cols = fit.coefficients.map((_, j) => j).filter((j) => !Number.isNaN(fit.coefficients[j]!));
  const warnings = new Warnings();
  // the fit iterated until it has converged (columns found aliased left out)
  const full = refit(model, cols, warnings, {
    ...CONVERGED,
    start: model.start === undefined ? undefined : cols.map((j) => model.start![j]!),
  });
  const B = new Array<number>(p).fill(NaN);
  cols.forEach((j, k) => (B[j] = full.fit.coefficients[k]!));
  const convergedFit: GlmResult = {
    ...fit,
    coefficients: B,
    weights: full.fit.workingWeights,
    residuals: full.fit.workingResiduals,
    qr: full.fit.qr,
    rank: full.fit.rank,
  };
  const summary = glmSummary(convergedFit);
  const dispersion = summary.dispersion;
  const se = new Array<number>(p).fill(NaN);
  const piv = full.fit.qr === undefined ? [] : full.fit.qr.pivot.slice(0, full.fit.rank);
  piv.forEach((k, m) => (se[cols[k]!] = summary.stdError[m]!));
  const xFull = model.x.map((r) => cols.map((j) => r[j]!));
  const eta0 = full.fit.eta;

  const zStat = (j: number, b: number): number => {
    const others = cols.filter((c) => c !== j);
    const restricted: IrlsFit = refit(model, others, new Warnings(), {
      ...CONVERGED,
      start: undefined,
      etastart: eta0,
      extraOffset: model.x.map((r) => r[j]! * b),
    }).fit;
    const stat =
      test === "LRT"
        ? restricted.deviance - full.fit.deviance
        : scoreStatistic(xFull, restricted.workingResiduals, restricted.workingWeights, false);
    return Math.sign(b - B[j]!) * Math.sqrt(Math.max(stat / dispersion, 0));
  };

  const cut = [qnorm((1 - level) / 2), qnorm((1 + level) / 2)] as const;
  const lower = parm.map(() => NaN);
  const upper = parm.map(() => NaN);
  parm.forEach((j, k) => {
    if (Number.isNaN(B[j]!)) return;
    for (const side of [0, 1] as const) {
      const dir = side === 0 ? -1 : 1;
      let far = NaN;
      let zFar = NaN;
      for (let e = 0; e <= 30; e++) {
        const b = B[j]! + dir * 2 ** e * se[j]!;
        const z = zStat(j, b);
        if (Math.abs(z) >= Math.abs(cut[side])) {
          far = b;
          zFar = z;
          break;
        }
      }
      if (Number.isNaN(far)) continue;
      const f = (b: number) => (b === B[j] ? -cut[side] : zStat(j, b) - cut[side]);
      const [lo, hi] = side === 0 ? [far, B[j]!] : [B[j]!, far];
      const [fLo, fHi] = side === 0 ? [zFar - cut[side], -cut[side]] : [-cut[side], zFar - cut[side]];
      const root = uniroot(f, lo, hi, { tol: 1e-14 * se[j]!, maxIter: 500, fLower: fLo, fUpper: fHi });
      if (side === 0) lower[k] = root;
      else upper[k] = root;
    }
  });
  return { lower: lower.map((v) => ldexp(v, k)), upper: upper.map((v) => ldexp(v, k)) };
}
