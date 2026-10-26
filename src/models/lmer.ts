// Linear mixed models fitted by REML or maximum likelihood (lme4's lmer): the estimate of θ that minimises the
// profiled REML criterion or ML deviance, and the fit's results at it (fixed effects and their covariance, σ, the
// variance components, the conditional modes of the random effects, fitted values, log-likelihood and information
// criteria).
//
// Written for rStats.js (no ported code) from oracle/lmer-behaviour.md (stage 1c, "The fit and its results") and
// D. Bates, M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4", Journal of
// Statistical Software 67(1). The structure comes from src/models/mixedStructure.ts and the criterion with its
// analytic gradient from src/models/mixedDeviance.ts. The minimiser is found in two phases:
//   1. L-BFGS-B (src/optim/lbfgsb.ts) from the initial θ, with the analytic gradient and the lower bounds (0 for the
//      diagonal elements of each block T_k), run to tight tolerances;
//   2. an active-set Newton method that locates the minimiser to rounding error: the bounded elements left below
//      1e-4 are candidates for the boundary and held at exactly 0; Newton steps on the other ("free") elements, with
//      the Hessian from central differences of the analytic gradient (the step relative to |θ_j|, with a floor),
//      until the step is at rounding level; an element that a step would take below 0 joins the boundary. If the
//      Hessian is not positive definite, the point is not yet in the convex region around the minimiser and phase 1
//      is resumed from it. Then each element on the boundary is checked: it stays there if the derivative of the
//      criterion at 0 is positive, or zero (to rounding) with the derivative just inside the bound positive;
//      otherwise it is released, moved just inside the bound, and phase 1 is resumed.
// The second test matters because the criterion is even in the element of a 1 × 1 block (and, in general, in the
// sign of a column of T_k), so its derivative at 0 vanishes: 0 is then a stationary point, which L-BFGS-B may stop at
// (its projected gradient is exactly 0) although it is a local maximum along the element, with the minimiser just
// inside the bound. Between the two the criterion is concave, so Newton's method cannot start from near 0.
// lme4's own optimiser (and its convergence warnings) are not reproduced: the result is the exact minimiser, which
// lme4 approaches to its tolerances.

import { lbfgsb } from "../optim/lbfgsb.js";
import { profiledDeviance } from "./mixedDeviance.js";
import type { DataFrame } from "./modelFrame.js";
import type { ContrastName } from "./modelMatrix.js";
import { mixedModelStructure, type MixedModelStructure } from "./mixedStructure.js";

/**
 * Options of {@link lmer}.
 *
 * @category Mixed models
 */
export interface LmerOptions {
  /** Whether to minimise the REML criterion (default `true`) or the ML deviance (`false`). */
  REML?: boolean;
  /** A contrast per factor of the fixed-effects part (default `"contr.treatment"`); the random-effects terms always use treatment contrasts. */
  contrasts?: Record<string, ContrastName>;
  /** The order of the levels of a factor (`{ A: ["c", "a", "b"] }`), as `factor(x, levels = ...)` in R. */
  levels?: Record<string, readonly string[]>;
}

/**
 * The variance and correlation parameters of a random-effects term in a {@link LmerResult}: one entry of R's
 * `VarCorr()`.
 *
 * @category Mixed models
 */
export interface LmerVarCorr {
  /** The grouping factor's name, such as `"Subject"` or `"cask:batch"`. */
  group: string;
  /** The names of the term's columns, such as `["(Intercept)", "Days"]`. */
  columns: string[];
  /** The standard deviations of the random effects, one per column. */
  sd: number[];
  /** Their correlation matrix (array of rows; 1 on the diagonal). */
  corr: number[][];
}

/**
 * The conditional modes of the random effects of a grouping factor in a {@link LmerResult}: one entry of R's
 * `ranef()`.
 *
 * @category Mixed models
 */
export interface LmerRanef {
  /** The grouping factor's name. */
  group: string;
  /** Its levels (the rows of `values`). */
  levels: string[];
  /** The columns of all the terms of this grouping factor, in term order. */
  columns: string[];
  /** One array per level, one value per column. */
  values: number[][];
}

/**
 * Result of {@link lmer}: the fit of a linear mixed model and the quantities of R's methods for it.
 *
 * @category Mixed models
 */
export interface LmerResult {
  /** The formula. */
  formula: string;
  /** Whether the REML criterion was minimised (otherwise the ML deviance). */
  REML: boolean;
  /** Number of rows used. */
  nObs: number;
  /** 0-based indices of the rows of `data` used (rows with a missing value in a variable of the formula dropped). */
  rows: number[];
  /** The estimate of the covariance parameters θ (R's `getME(fit, "theta")`): the lower triangles of the relative covariance factors, by term, column-major. */
  theta: number[];
  /** Names of the columns of the fixed-effects model matrix (aliased columns dropped). */
  fixefNames: string[];
  /** The fixed effects β̂ (R's `fixef()`). */
  fixef: number[];
  /** The coefficient table of the fixed effects (R's `coef(summary(fit))`). */
  coefTable: {
    /** Estimates (R's `Estimate`). */
    estimate: number[];
    /** Standard errors (R's `Std. Error`). */
    stdError: number[];
    /** t statistics (R's `t value`). */
    tValue: number[];
  };
  /** The covariance matrix of the fixed effects (R's `vcov()`), array of rows. */
  vcov: number[][];
  /** The residual standard deviation (R's `sigma()`). */
  sigma: number;
  /** The variance components, one entry per random-effects term (R's `VarCorr()`). */
  varCorr: LmerVarCorr[];
  /** The conditional modes of the random effects, one entry per grouping factor (R's `ranef()`). */
  ranef: LmerRanef[];
  /** Fitted values Xβ̂ + Zb̂, one per row used (R's `fitted()`). */
  fitted: number[];
  /** Residuals y − fitted (R's `residuals()`). */
  residuals: number[];
  /** The log-likelihood, or the REML log-likelihood for a REML fit (R's `logLik()`). */
  logLik: number;
  /** Degrees of freedom of the log-likelihood: the numbers of fixed effects and of θ, plus 1 (for σ). */
  df: number;
  /** Akaike's information criterion (R's `AIC()`). */
  AIC: number;
  /** Schwarz's Bayesian information criterion (R's `BIC()`). */
  BIC: number;
  /** The ML deviance at the estimates, for either kind of fit (R's `deviance(fit, REML = FALSE)`). */
  deviance: number;
  /** The REML criterion at the estimates, for either kind of fit (R's `REMLcrit()`). */
  REMLcrit: number;
  /** Whether the fit is singular: a diagonal element of a relative covariance factor below 1e-4 (R's `isSingular()`). */
  singular: boolean;
  /** R's messages (a rank-deficient fixed-effects matrix, a singular fit). */
  messages: string[];
  /** R's warnings (predictors on very different scales). */
  warnings: string[];
}

/** Bounded elements of θ below this value after the quasi-Newton phase are candidates for the boundary */
const BOUNDARY_CANDIDATE = 1e-4;
/** Step of the central differences of the gradient that give the Hessian, relative to |θ_j| ... */
const HESSIAN_STEP = 1e-4;
/** ... and at least this (relative to max(1, max |θ|)), for elements at or near 0 */
const HESSIAN_STEP_FLOOR = 1e-6;
/** Where the derivative is probed when it vanishes at the bound (relative to max(1, max |θ|)) */
const BOUNDARY_PROBE = 1e-6;
/** The largest move of the search along a descent direction (relative to max(1, max |θ|)) */
const SLOPE_SEARCH_LIMIT = 10;
/** The Newton phase stops when a step is below this, relative to max(1, max |θ|) */
const NEWTON_TOLERANCE = 1e-13;
/** ... or when the steps no longer decrease (rounding level) and are below this */
const NEWTON_FLOOR = 1e-10;
const MAX_NEWTON_STEPS = 50;
const MAX_ACTIVE_SET_ROUNDS = 20;

const OPTIMISATION_FAILED = "lmer: the minimisation of the criterion over theta did not converge";

/** Solves the symmetric positive definite system H x = g (k × k, array of rows) by Cholesky; undefined if not PD */
function solveSpd(h: number[][], g: number[]): number[] | undefined {
  const k = g.length;
  const l: number[][] = h.map(() => new Array<number>(k).fill(0));
  for (let j = 0; j < k; j++) {
    let d = h[j]![j]!;
    for (let m = 0; m < j; m++) d -= l[j]![m]! ** 2;
    if (!(d > 0)) return undefined;
    l[j]![j] = Math.sqrt(d);
    for (let i = j + 1; i < k; i++) {
      let s = h[i]![j]!;
      for (let m = 0; m < j; m++) s -= l[i]![m]! * l[j]![m]!;
      l[i]![j] = s / l[j]![j]!;
    }
  }
  const y = new Array<number>(k);
  for (let i = 0; i < k; i++) {
    let s = g[i]!;
    for (let m = 0; m < i; m++) s -= l[i]![m]! * y[m]!;
    y[i] = s / l[i]![i]!;
  }
  for (let i = k - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let m = i + 1; m < k; m++) s -= l[m]![i]! * y[m]!;
    y[i] = s / l[i]![i]!;
  }
  return y;
}

/** The minimiser of the criterion over θ, subject to the lower bounds (see the header) */
function minimiseCriterion(s: MixedModelStructure, reml: boolean): number[] {
  const nTheta = s.theta.length;
  const bounded = s.lower.map((b) => b === 0);
  const evaluate = (theta: readonly number[]): { f: number; g: number[] } => {
    const r = profiledDeviance(s, theta, reml, { gradient: true });
    return { f: r.deviance, g: r.gradient! };
  };
  const gradientAt = (theta: readonly number[]): number[] => evaluate(theta).g;

  /** Quasi-Newton with bounds from `start` (all elements free, the bounds enforced by projection) */
  const quasiNewton = (start: readonly number[]): number[] => {
    const qn = lbfgsb(
      nTheta,
      10,
      start,
      new Array<number>(nTheta).fill(0),
      new Array<number>(nTheta).fill(0),
      bounded.map((b) => (b ? 1 : 0)),
      10,
      0,
      (x) => evaluate(x),
      () => false,
    );
    if (qn.task.startsWith("ERROR") || !qn.x.every(Number.isFinite)) throw new Error(OPTIMISATION_FAILED);
    return qn.x.map((v, j) => (bounded[j] && v < 0 ? 0 : v));
  };

  const theta = s.theta.slice();
  const fixed = new Set<number>();
  /** Elements released from the boundary (not candidates for it again unless a Newton step takes them there) */
  const released = new Set<number>();
  /** Runs the quasi-Newton phase from the current θ and holds the candidates for the boundary at 0 */
  const restart = (): void => {
    quasiNewton(theta).forEach((v, j) => (theta[j] = v));
    fixed.clear();
    theta.forEach((v, j) => {
      if (bounded[j] && v < BOUNDARY_CANDIDATE && !released.has(j)) {
        fixed.add(j);
        theta[j] = 0;
      }
    });
  };
  const scaleOf = (): number => Math.max(1, ...theta.map(Math.abs));

  /**
   * Newton steps on the free elements: "converged", the bounded elements that a step took to 0 or below, or
   * "indefinite" when the Hessian is not positive definite (the point is not yet in the convex region around the
   * minimiser: the quasi-Newton phase is resumed from it)
   */
  const newton = (free: number[]): "converged" | "indefinite" | number[] => {
    const hessian = (): number[][] => {
      const floor = HESSIAN_STEP_FLOOR * scaleOf();
      const cols = free.map((j) => {
        const h = Math.max(HESSIAN_STEP * Math.abs(theta[j]!), floor);
        const plus = theta.slice();
        plus[j] = theta[j]! + h;
        const minus = theta.slice();
        minus[j] = theta[j]! - h;
        const gp = gradientAt(plus);
        const gm = gradientAt(minus);
        return free.map((i) => (gp[i]! - gm[i]!) / (2 * h));
      });
      return free.map((_, a) => free.map((_, b) => (cols[a]![b]! + cols[b]![a]!) / 2));
    };
    let h = hessian();
    let previous = Infinity;
    for (let step = 0; step < MAX_NEWTON_STEPS; step++) {
      const g = gradientAt(theta);
      const delta = solveSpd(
        h,
        free.map((j) => g[j]!),
      );
      if (delta === undefined) return "indefinite";
      const hit: number[] = [];
      free.forEach((j, a) => {
        theta[j] = theta[j]! - delta[a]!;
        if (bounded[j] && theta[j]! <= 0) hit.push(j);
      });
      if (hit.length > 0) {
        for (const j of hit) theta[j] = 0;
        return hit;
      }
      const size = Math.max(...delta.map(Math.abs)) / scaleOf();
      if (!Number.isFinite(size)) throw new Error(OPTIMISATION_FAILED);
      if (size <= NEWTON_TOLERANCE) return "converged";
      if (size > 0.5 * previous) {
        if (size <= NEWTON_FLOOR) return "converged";
        h = hessian(); // slow contraction: the Hessian is renewed
      }
      previous = size;
    }
    throw new Error(OPTIMISATION_FAILED);
  };

  /**
   * Elements held at 0 that must be released: the criterion decreases from 0 into the feasible side. Where the
   * derivative at 0 vanishes (to rounding), as it does for a 1 × 1 block (the criterion is even in its element), the
   * sign of the derivative just inside the bound decides.
   */
  const toRelease = (): number[] => {
    const out: number[] = [];
    if (fixed.size === 0) return out;
    const { f, g } = evaluate(theta);
    const tolerance = 1e-12 * Math.max(1, Math.abs(f));
    for (const j of fixed) {
      if (g[j]! > tolerance) continue;
      if (g[j]! >= -tolerance) {
        const probe = theta.slice();
        probe[j] = BOUNDARY_PROBE * scaleOf();
        if (gradientAt(probe)[j]! > 0) continue;
      }
      out.push(j);
    }
    return out;
  };

  /**
   * Moves θ along `direction` (a descent direction) until the directional derivative is no longer negative: the
   * steps grow by 4 from BOUNDARY_PROBE (relative to the scale of θ) up to SLOPE_SEARCH_LIMIT, and stop short of the
   * bounds. Only the gradient is used: where the criterion is flat to rounding (near a stationary point on the
   * bound), its values cannot show the descent, and L-BFGS-B, which needs a decrease of the criterion, would stop
   * where it starts.
   */
  const slopeSearch = (direction: number[]): void => {
    const size = Math.max(...direction.map(Math.abs));
    if (!(size > 0)) return;
    const scale = scaleOf();
    const base = theta.slice();
    for (let alpha = (BOUNDARY_PROBE * scale) / size; alpha * size <= SLOPE_SEARCH_LIMIT * scale; alpha *= 4) {
      const trial = base.map((v, j) => v + alpha * direction[j]!);
      if (trial.some((v, j) => bounded[j] && v < 0)) return;
      trial.forEach((v, j) => (theta[j] = v));
      const g = gradientAt(trial);
      if (g.reduce((sum, gj, j) => sum + gj * direction[j]!, 0) >= 0) return;
    }
  };

  restart();
  for (let round = 0; round < MAX_ACTIVE_SET_ROUNDS; round++) {
    const free = theta.map((_, j) => j).filter((j) => !fixed.has(j));
    const outcome = free.length > 0 ? newton(free) : "converged";
    if (outcome === "indefinite") {
      // not yet in the convex region around the minimiser: along the steepest descent, then quasi-Newton again
      const g = gradientAt(theta);
      slopeSearch(theta.map((_, j) => (fixed.has(j) ? 0 : -g[j]!)));
      restart();
      continue;
    }
    if (outcome !== "converged") {
      for (const j of outcome) {
        fixed.add(j);
        released.delete(j);
      }
      continue;
    }
    const release = toRelease();
    if (release.length === 0) return theta;
    // moved into the feasible side until the criterion no longer decreases along the released elements, then
    // quasi-Newton again
    for (const j of release) {
      fixed.delete(j);
      released.add(j);
    }
    slopeSearch(theta.map((_, j) => (release.includes(j) ? 1 : 0)));
    restart();
  }
  throw new Error(OPTIMISATION_FAILED);
}

/**
 * Fit a linear mixed model by REML (default) or maximum likelihood. Equivalent to `lme4::lmer()` in R. With the
 * quantities of its methods: `fixef()`, `coef(summary())` (without p-values), `vcov()`, `sigma()`, `VarCorr()`,
 * `ranef()`, `fitted()`, `residuals()`, `logLik()`, `AIC()`, `BIC()`, `deviance()`, `REMLcrit()` and `isSingular()`.
 *
 * The formula has random-effects terms `(lhs | group)` (correlated effects of the columns of `lhs` within each level
 * of `group`) or `(lhs || group)` (uncorrelated); `group` may be `a:b` (the combinations), `a/b` (nested: `b:a` and
 * `a`) and so on, as in lme4. The fixed-effects part is coded as in {@link lm}; aliased columns are dropped (with a
 * message). Rows with a missing value in a variable of the formula are dropped (`rows` lists those used).
 *
 * The covariance parameters θ are the lower triangles of the relative covariance factors of the terms; the estimate
 * is the exact minimiser of the profiled criterion (lme4's optimiser stops close to it, so lme4's values typically
 * differ in the 5th to 9th significant digit). Elements on the boundary are exactly 0, and the fit is then singular.
 * The computation is dense: the time grows with the cube of the number of random effects.
 *
 * @param formula A formula such as `"Reaction ~ Days + (Days | Subject)"`.
 * @param data The data frame: an object of columns.
 * @param options `REML`, and `contrasts` and `levels` as in {@link lm}.
 *
 * @example
 * ```ts
 * // R: lme4::lmer(y ~ 1 + (1 | g), data)
 * const fit = lmer("y ~ 1 + (1 | g)", {
 *   y: [9.8, 10.4, 10.1, 12.3, 12.9, 12.0, 8.1, 7.6, 8.4],
 *   g: ["a", "a", "a", "b", "b", "b", "c", "c", "c"],
 * });
 * fit.fixef;           // [10.177778]
 * fit.sigma;           // 0.39299
 * fit.varCorr[0].sd;   // [2.1726]
 * fit.ranef[0].levels; // ["a", "b", "c"]
 * fit.ranef[0].values; // [[-0.076939], [2.1982], [-2.1213]]
 * fit.REMLcrit;        // 19.015
 * ```
 *
 * @category Mixed models
 */
export function lmer(formula: string, data: DataFrame, options: LmerOptions = {}): LmerResult {
  const reml = options.REML ?? true;
  const modelOptions: { contrasts?: Record<string, ContrastName>; levels?: Record<string, readonly string[]> } = {};
  if (options.contrasts !== undefined) modelOptions.contrasts = options.contrasts;
  if (options.levels !== undefined) modelOptions.levels = options.levels;
  const s = mixedModelStructure(formula, data, modelOptions);
  const theta = minimiseCriterion(s, reml);

  const r = profiledDeviance(s, theta, reml, { rxInverse: true });
  const n = s.y.length;
  const p = s.xColNames.length;
  const twoPi = 2 * Math.PI;
  const deviance = r.logDetL + n * (1 + Math.log((twoPi * r.prss) / n));
  const REMLcrit = r.logDetL + r.logDetRX + (n - p) * (1 + Math.log((twoPi * r.prss) / (n - p)));
  const sigma2 = r.prss / (reml ? n - p : n);
  const sigma = Math.sqrt(sigma2);

  const vcov = r.rxInverse!.map((row) => row.map((v) => sigma2 * v));
  const stdError = vcov.map((row, i) => Math.sqrt(row[i]!));
  const tValue = r.beta.map((b, i) => b / stdError[i]!);

  // the blocks T_k and the variance components
  const varCorr: LmerVarCorr[] = s.terms.map((term) => {
    const nc = term.columns.length;
    const t: number[][] = Array.from({ length: nc }, () => new Array<number>(nc).fill(0));
    let k = term.thetaOffset;
    for (let j = 0; j < nc; j++) for (let i = j; i < nc; i++) t[i]![j] = theta[k++]!;
    const cov = t.map((ti) => t.map((tj) => sigma2 * ti.reduce((sum, v, m) => sum + v * tj[m]!, 0)));
    const sd = cov.map((row, i) => Math.sqrt(row[i]!));
    const corr = cov.map((row, i) => row.map((v, j) => (i === j ? 1 : v / (sd[i]! * sd[j]!))));
    return { group: s.groups[term.group]!.name, columns: [...term.columns], sd, corr };
  });

  const ranef: LmerRanef[] = s.groups.map((g, gi) => {
    const terms = s.terms.filter((t) => t.group === gi);
    return {
      group: g.name,
      levels: [...g.levels],
      columns: terms.flatMap((t) => t.columns),
      values: g.levels.map((_, l) =>
        terms.flatMap((t) => {
          const nc = t.columns.length;
          return t.columns.map((_, j) => r.b[t.zOffset + l * nc + j]!);
        }),
      ),
    };
  });

  const fitted = s.x.map((xi) => xi.reduce((sum, v, k) => sum + v * r.beta[k]!, 0));
  s.z.forEach((col, j) => {
    const bj = r.b[j]!;
    if (bj !== 0) col.rows.forEach((i, k) => (fitted[i]! += col.values[k]! * bj));
  });
  const residuals = s.y.map((y, i) => y - fitted[i]!);

  const logLik = -(reml ? REMLcrit : deviance) / 2;
  const df = p + theta.length + 1;
  const singular = theta.some((v, j) => s.lower[j] === 0 && v < 1e-4);
  const messages = [...s.messages];
  if (singular) messages.push("boundary (singular) fit: see help('isSingular')");

  return {
    formula,
    REML: reml,
    nObs: n,
    rows: [...s.rows],
    theta,
    fixefNames: [...s.xColNames],
    fixef: r.beta,
    coefTable: { estimate: [...r.beta], stdError, tValue },
    vcov,
    sigma,
    varCorr,
    ranef,
    fitted,
    residuals,
    logLik,
    df,
    AIC: -2 * logLik + 2 * df,
    BIC: -2 * logLik + Math.log(n) * df,
    deviance,
    REMLcrit,
    singular,
    messages,
    warnings: [...s.warnings],
  };
}
