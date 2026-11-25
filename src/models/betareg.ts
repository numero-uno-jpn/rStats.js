// Beta regression: betareg's betareg (maximum likelihood, bias-corrected and bias-reduced) with summary, confint,
// predict and residuals. Behaviour: oracle/tobit-betareg-loglin-behaviour.md (clean room: from betareg's
// documentation, the papers it cites and the output of R; no source of R or of a package was read). Written for
// rStats.js.
import { pnorm, qnorm } from "../distributions/normal.js";
import { dbeta1, pbeta1, qbeta1 } from "../distributions/beta.js";
import { digamma, trigamma, psigamma } from "../special/psigamma.js";
import { parseFormula, type FormulaNode } from "./formula.js";
import { design, type DesignContrast } from "./modelMatrix.js";
import type { DataFrame } from "./modelFrame.js";
import { dataRowCount } from "./inputRows.js";
import type { Sample } from "../htest/types.js";

/** Links of the mean in {@link betareg}. @category Regression models */
export type BetaregLink = "logit" | "probit" | "cloglog" | "cauchit" | "log" | "loglog";
/** Links of the precision in {@link betareg}. @category Regression models */
export type BetaregPhiLink = "identity" | "log" | "sqrt";
/** Estimators of {@link betareg}: maximum likelihood, bias-corrected, bias-reduced. @category Regression models */
export type BetaregType = "ML" | "BC" | "BR";

/**
 * Options for {@link betareg}.
 * @category Regression models
 */
export interface BetaregOptions {
  /** Link of the mean (default `"logit"`). */
  link?: BetaregLink;
  /** Link of the precision phi (default `"identity"` for `y ~ x`, `"log"` for `y ~ x | z`). */
  linkPhi?: BetaregPhiLink;
  /** Estimator: `"ML"` (default), `"BC"` (bias-corrected) or `"BR"` (bias-reduced), as Kosmidis and Firth (2010). */
  type?: BetaregType;
  /** Case weights, one per row of `data` (non-negative), or the name of a column of `data`. */
  weights?: Sample | string;
  /** A contrast per factor of the formula (default treatment contrasts). */
  contrasts?: Record<string, DesignContrast>;
  /** Iterations: at most `maxit` (default 5000) Fisher scoring steps for ML and BR. */
  maxit?: number;
}

interface Link { fun(m: number): number; inv(e: number): number; d1(e: number): number; d2(e: number): number }

const EPS = 2 ** -52;
/** A probability kept within (0, 1): the least double and the largest double below 1 at the ends */
const inUnit = (p: number): number => Math.min(Math.max(p, Number.MIN_VALUE), 1 - 2 ** -53);

function meanLink(name: string): Link {
  switch (name) {
    case "logit": return {
      fun: (m) => Math.log(m / (1 - m)),
      inv: (e) => inUnit(e >= 0 ? 1 / (1 + Math.exp(-e)) : Math.exp(e) / (1 + Math.exp(e))),
      d1: (e) => { const z = Math.exp(-Math.abs(e)); return z / ((1 + z) * (1 + z)); },
      d2: (e) => { const z = Math.exp(-Math.abs(e)), m = 1 / (1 + z), d = z / ((1 + z) * (1 + z)); return d * (e >= 0 ? 1 - 2 * m : 2 * m - 1); },
    };
    case "probit": return {
      fun: (m) => qnorm(m), inv: (e) => inUnit(pnorm(e)),
      d1: (e) => Math.exp(-0.5 * e * e) / Math.sqrt(2 * Math.PI), d2: (e) => -e * Math.exp(-0.5 * e * e) / Math.sqrt(2 * Math.PI),
    };
    // cloglog and loglog: R's bias correction uses the second derivative of the inverse link floored at 2.2e-16 where
    // it is negative (read off R's bias in intercept-only models, experiments/regression117-betareg-d2b.R; logit's
    // negative values are used as they are). Kept as R: it changes BC and BR estimates by about 1e-4
    case "cloglog": return {
      fun: (m) => Math.log(-Math.log1p(-m)), inv: (e) => inUnit(-Math.expm1(-Math.exp(e))),
      d1: (e) => Math.exp(e - Math.exp(e)), d2: (e) => Math.max(Math.exp(e - Math.exp(e)) * (1 - Math.exp(e)), EPS),
    };
    case "cauchit": return {
      fun: (m) => Math.tan(Math.PI * (m - 0.5)), inv: (e) => inUnit(0.5 + Math.atan(e) / Math.PI),
      d1: (e) => 1 / (Math.PI * (1 + e * e)), d2: (e) => -2 * e / (Math.PI * (1 + e * e) * (1 + e * e)),
    };
    // no clamp: a mean above 1 makes the log-likelihood NaN, as in R
    case "log": return { fun: Math.log, inv: Math.exp, d1: Math.exp, d2: Math.exp };
    case "loglog": return {
      fun: (m) => -Math.log(-Math.log(m)), inv: (e) => inUnit(Math.exp(-Math.exp(-e))),
      d1: (e) => Math.exp(-e - Math.exp(-e)), d2: (e) => Math.max(Math.exp(-e - Math.exp(-e)) * (Math.exp(-e) - 1), EPS),
    };
    default:
      throw new RangeError("'arg' should be one of “logit”, “probit”, “cloglog”, “cauchit”, “log”, “loglog”");
  }
}

function phiLink(name: string): Link {
  switch (name) {
    case "identity": return { fun: (m) => m, inv: (e) => e, d1: () => 1, d2: () => 0 };
    case "log": return { fun: Math.log, inv: Math.exp, d1: Math.exp, d2: Math.exp };
    case "sqrt": return { fun: Math.sqrt, inv: (e) => e * e, d1: (e) => 2 * e, d2: () => 2 };
    default:
      throw new RangeError("'arg' should be one of “identity”, “log”, “sqrt”");
  }
}

/** What predictions on new data need. @category Regression models */
export interface BetaregModel {
  meanRhs: FormulaNode | undefined;
  precisionRhs: FormulaNode | undefined;
  factorLevels: Record<string, readonly string[]>;
  contrasts: Record<string, DesignContrast>;
  /** The variables of both parts (without the response). */
  variables: string[];
  /** The model matrices, the response and the weights of the rows used. */
  x: number[][];
  z: number[][];
  y: number[];
  weights: number[];
  /** 0-based rows of the data used. */
  rows: number[];
}

/**
 * Result of {@link betareg}.
 * @category Regression models
 */
export interface BetaregResult {
  /** Coefficients of the mean model and of the precision model. */
  coefficients: { mean: number[]; precision: number[] };
  meanNames: string[];
  /** `(phi)` for a constant precision with the identity link, else `(phi)_` and the term. */
  precisionNames: string[];
  /** All names (mean, then precision), the rows and columns of `vcov`. */
  names: string[];
  /** Covariance of all coefficients: the inverse of the expected information at the estimates. */
  vcov: number[][];
  loglik: number;
  /** Squared (weighted) correlation of the linear predictor and the link-transformed response. */
  pseudoRSquared: number;
  /** The first-order bias at the maximum likelihood estimates (`type: "BC"` only), as R's `bias`. */
  bias?: number[];
  /** Fitted means, linear predictors of the mean, fitted precisions. */
  fitted: number[];
  linearPredictor: number[];
  precision: number[];
  link: BetaregLink;
  linkPhi: BetaregPhiLink;
  type: BetaregType;
  /** Rows used, rows with a positive weight, and the residual degrees of freedom of the null and of this model. */
  n: number;
  nobs: number;
  dfNull: number;
  dfResidual: number;
  /** Fisher scoring iterations (rStats.js's, not R's BFGS and scoring counts). */
  iterations: number;
  converged: boolean;
  model: BetaregModel;
  warnings: string[];
}

interface Eval { ll: number; score: number[]; info: number[][]; mu: number[]; phi: number[]; e1: number[]; e2: number[] }

function evaluate(th: number[], m: BetaregModel, l1: Link, l2: Link): Eval {
  const { x, z, y, weights } = m, p = x[0]!.length, q = z[0]!.length, k = p + q;
  const score = new Array<number>(k).fill(0), info = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const mu: number[] = [], phi: number[] = [], e1s: number[] = [], e2s: number[] = [];
  let ll = 0;
  for (let i = 0; i < y.length; i++) {
    const xi = x[i]!, zi = z[i]!, w = weights[i]!;
    let e1 = 0, e2 = 0;
    for (let j = 0; j < p; j++) e1 += xi[j]! * th[j]!;
    for (let j = 0; j < q; j++) e2 += zi[j]! * th[p + j]!;
    const m1 = l1.inv(e1), f = l2.inv(e2);
    mu.push(m1); phi.push(f); e1s.push(e1); e2s.push(e2);
    if (w === 0) continue;
    const a = m1 * f, b = (1 - m1) * f, yi = y[i]!;
    ll += w * dbeta1(yi, a, b, true);
    const d1 = l1.d1(e1), d2 = l2.d1(e2);
    const ys = Math.log(yi) - Math.log1p(-yi), ms = digamma(a) - digamma(b);
    const s1 = w * f * (ys - ms) * d1, s2 = w * (m1 * (ys - ms) + Math.log1p(-yi) - digamma(b) + digamma(f)) * d2;
    const t1 = trigamma(a), t2 = trigamma(b);
    const W = w * f * f * (t1 + t2) * d1 * d1, C = w * f * (t1 * m1 - t2 * (1 - m1)) * d1 * d2;
    const D = w * (t1 * m1 * m1 + t2 * (1 - m1) * (1 - m1) - trigamma(f)) * d2 * d2;
    for (let j = 0; j < p; j++) score[j]! += s1 * xi[j]!;
    for (let j = 0; j < q; j++) score[p + j]! += s2 * zi[j]!;
    for (let r = 0; r < k; r++) {
      const ur = r < p ? xi[r]! : zi[r - p]!;
      for (let c = 0; c <= r; c++) {
        const uc = c < p ? xi[c]! : zi[c - p]!;
        const v = r < p ? W : c < p ? C : D;
        info[r]![c]! += v * ur * uc;
      }
    }
  }
  for (let r = 0; r < k; r++) for (let c = r + 1; c < k; c++) info[r]![c] = info[c]![r]!;
  return { ll, score, info, mu, phi, e1: e1s, e2: e2s };
}

/** Inverse of a symmetric positive definite matrix (Cholesky); null if it is not. */
function spdInverse(A: number[][]): number[][] | null {
  const n = A.length, L = A.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i]![j]!;
    for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
    if (i === j) { if (!(s > 0)) return null; L[i]![i] = Math.sqrt(s); }
    else L[i]![j] = s / L[j]![j]!;
  }
  const inv = A.map(() => new Array<number>(n).fill(0));
  for (let c = 0; c < n; c++) {
    const zc = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) { let s = i === c ? 1 : 0; for (let k = 0; k < i; k++) s -= L[i]![k]! * zc[k]!; zc[i] = s / L[i]![i]!; }
    for (let i = n - 1; i >= 0; i--) { let s = zc[i]!; for (let k = i + 1; k < n; k++) s -= L[k]![i]! * inv[k]![c]!; inv[i]![c] = s / L[i]![i]!; }
  }
  return inv;
}

const matVec = (A: number[][], v: number[]) => A.map((row) => row.reduce((s, a, j) => s + a * v[j]!, 0));

/** The Kosmidis-Firth adjustment A(theta) = 1/2 tr(F^-1 (P_t + Q_t)) (see the behaviour file for the closed forms). */
function adjustment(th: number[], m: BetaregModel, l1: Link, l2: Link, Finv: number[][]): number[] {
  const { x, z, y, weights } = m, p = x[0]!.length, q = z[0]!.length, k = p + q;
  const A = new Array<number>(k).fill(0);
  for (let i = 0; i < y.length; i++) {
    const w = weights[i]!;
    if (w === 0) continue;
    const xi = x[i]!, zi = z[i]!;
    let e1 = 0, e2 = 0;
    for (let j = 0; j < p; j++) e1 += xi[j]! * th[j]!;
    for (let j = 0; j < q; j++) e2 += zi[j]! * th[p + j]!;
    const mu = l1.inv(e1), f = l2.inv(e2), a = mu * f, b = (1 - mu) * f;
    const d1 = l1.d1(e1), d2 = l2.d1(e2), d1p = l1.d2(e1), d2p = l2.d2(e2);
    // the scores in (eta1, eta2) are C (L - E L), L = (log y, log(1 - y))
    const C = [[f * d1, -f * d1], [mu * d2, (1 - mu) * d2]];
    const tf = trigamma(f), S = [[trigamma(a) - tf, -tf], [-tf, trigamma(b) - tf]];
    const pf = psigamma(f, 2), kap = (r: number, s: number, t: number): number => {
      const ones = r + s + t;
      return ones === 0 ? psigamma(a, 2) - pf : ones === 3 ? psigamma(b, 2) - pf : -pf;
    };
    // dC_a / deta_b
    const dC = [[[f * d1p, -f * d1p], [d2 * d1, -d2 * d1]], [[d1 * d2, -d1 * d2], [mu * d2p, (1 - mu) * d2p]]];
    const SC = [0, 1].map((c) => [0, 1].map((r) => S[r]![0]! * C[c]![0]! + S[r]![1]! * C[c]![1]!)); // Sigma C_c'
    // G = J F^-1 J' (2 x 2)
    const J0 = [...xi, ...new Array<number>(q).fill(0)], J1 = [...new Array<number>(p).fill(0), ...zi];
    const FJ0 = matVec(Finv, J0), FJ1 = matVec(Finv, J1);
    const G = [[dot(J0, FJ0), dot(J0, FJ1)], [dot(J1, FJ0), dot(J1, FJ1)]];
    for (let c = 0; c < 2; c++) {
      let tr = 0;
      for (let r = 0; r < 2; r++) for (let s = 0; s < 2; s++) {
        let M = 0;
        for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) for (let t = 0; t < 2; t++) M += C[r]![u]! * C[s]![v]! * C[c]![t]! * kap(u, v, t);
        const Q = dC[r]![s]![0]! * SC[c]![0]! + dC[r]![s]![1]! * SC[c]![1]!;
        tr += (M + Q) * G[r]![s]!;
      }
      const Jc = c === 0 ? J0 : J1;
      for (let t = 0; t < k; t++) A[t]! += 0.5 * w * tr * Jc[t]!;
    }
  }
  return A;
}
const dot = (a: number[], b: number[]) => a.reduce((s, v, j) => s + v * b[j]!, 0);

/** Splits "y ~ x | z" at its top-level bar. */
function splitBar(formula: string): [string, string | undefined] {
  let depth = 0;
  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "|" && depth === 0) return [formula.slice(0, i), formula.slice(i + 1)];
  }
  return [formula, undefined];
}

/**
 * Beta regression for rates and proportions in (0, 1): the mean linked to a linear predictor, the precision phi
 * constant (`y ~ x`) or linked to its own regressors (`y ~ x | z`), fitted by maximum likelihood, or bias-corrected or
 * bias-reduced (Kosmidis and Firth 2010). Equivalent to R's `betareg::betareg()`.
 *
 * The response must lie strictly between 0 and 1 (R fits an extended-support distribution to 0 and 1; rStats.js does
 * not). rStats.js maximises the likelihood to convergence by Fisher scoring; R stops its optimiser slightly earlier,
 * so estimates agree with R's to about 1e-7 relative.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * fit.coefficients; // { mean: [intercept, slope], precision: [phi] }
 * ```
 * @category Regression models
 */
export function betareg(formula: string, data: DataFrame, options: BetaregOptions = {}): BetaregResult {
  const type = options.type ?? "ML";
  if (type !== "ML" && type !== "BC" && type !== "BR") throw new RangeError("'arg' should be one of “ML”, “BC”, “BR”");
  const linkName = options.link ?? "logit", l1 = meanLink(linkName);
  const [meanPart, precPart] = splitBar(formula);
  const linkPhiName = options.linkPhi ?? (precPart === undefined ? "identity" : "log"), l2 = phiLink(linkPhiName);
  const maxit = options.maxit ?? 5000;
  if (!Number.isInteger(maxit) || maxit < 1) throw new RangeError("'maxit' must be a positive integer");
  const parsed = parseFormula(meanPart);
  if (parsed.response === undefined) throw new TypeError("the formula must have a response");
  const parsedZ = precPart === undefined ? undefined : parseFormula(`~ ${precPart}`);
  const contrasts = (options.contrasts ?? {}) as Record<string, DesignContrast>;
  // the rows: those complete in every variable of both parts
  const zVars = parsedZ === undefined ? [] : design(parsedZ, data, { contrasts }).terms.variables;
  const dOpts: Parameters<typeof design>[2] = { contrasts, extraVariables: zVars };
  if (options.weights !== undefined) dOpts.weights = options.weights;
  const d = design(parsed, data, dOpts);
  const y = d.y;
  if (y === undefined) throw new TypeError("the response must be numeric");
  if (y.some((v) => !(v >= 0 && v <= 1))) throw new RangeError("invalid dependent variable, all observations must be in [0, 1]");
  if (y.some((v) => v === 0 || v === 1)) {
    throw new RangeError("the responses must lie strictly between 0 and 1: rStats.js fits the beta distribution only (R's betareg switches to the extended-support beta distribution \"xbetax\" for 0 and 1)");
  }
  const rows = d.frame.rows;
  let z: number[][], zNames: string[];
  const factorLevels: Record<string, readonly string[]> = {};
  d.terms.variables.forEach((v, i) => { const fv = d.frame.variables[i]; if (i > 0 && fv?.kind === "factor") factorLevels[v] = fv.levels; });
  if (parsedZ === undefined) { z = y.map(() => [1]); zNames = ["(Intercept)"]; }
  else {
    const sub: DataFrame = {};
    for (const v of zVars) { const col = data[v]; if (col !== undefined) sub[v] = rows.map((r) => (col as ArrayLike<unknown>)[r] as never); }
    const dz = design(parsedZ, sub, { contrasts });
    if (dz.frame.rows.length !== rows.length) throw new RangeError("the precision model drops rows that the mean model keeps");
    z = dz.x; zNames = dz.colNames;
    dz.terms.variables.forEach((v, i) => { const fv = dz.frame.variables[i]; if (fv?.kind === "factor") factorLevels[v] = fv.levels; });
  }
  const weights = d.frame.weights ?? y.map(() => 1);
  if (weights.some((v) => !(v >= 0) || !Number.isFinite(v))) throw new RangeError("weights must be finite and non-negative");
  const x = d.x, p = x[0]?.length ?? 0, q = z[0]!.length, k = p + q;
  if (p === 0) throw new RangeError("the mean model has no coefficients");
  const model: BetaregModel = {
    meanRhs: parsed.rhs, precisionRhs: parsedZ?.rhs, factorLevels, contrasts,
    variables: [...new Set([...d.terms.variables.slice(1), ...zVars])], x, z, y, weights, rows,
  };
  // R's starting values: weighted least squares of g(y) on X; phi from the delta method (Ferrari and Cribari-Neto 2004)
  const gy = y.map((v) => l1.fun(v));
  const XtX = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => x.reduce((s, r, i) => s + weights[i]! * r[a]! * r[b]!, 0)));
  const XtXi = spdInverse(XtX);
  if (XtXi === null) throw new RangeError("the mean model's matrix is rank-deficient");
  const beta0 = matVec(XtXi, Array.from({ length: p }, (_, a) => x.reduce((s, r, i) => s + weights[i]! * r[a]! * gy[i]!, 0)));
  const eta0 = x.map((r) => dot(r, beta0));
  const sw = weights.reduce((s, v) => s + v, 0);
  const sse = eta0.reduce((s, e, i) => s + weights[i]! * (gy[i]! - e) ** 2, 0) / (sw - p);
  let phiSum = 0;
  eta0.forEach((e, i) => { const m = l1.inv(e), s2 = sse * l1.d1(e) ** 2; phiSum += weights[i]! * (m * (1 - m) / s2 - 1); });
  const phi0 = phiSum / sw;
  let th = [...beta0, l2.fun(phi0), ...new Array<number>(q - 1).fill(0)];
  let cur = evaluate(th, model, l1, l2);
  if (!Number.isFinite(cur.ll)) throw new RangeError("initial value in 'vmmin' is not finite");
  // Fisher scoring with step halving
  let iterations = 0, converged = false;
  const fisher = (target: (e: Eval, t: number[]) => number[], accept: (next: Eval, prev: Eval) => boolean): void => {
    for (let it = 0; it < maxit; it++) {
      const Fi = spdInverse(cur.info);
      if (Fi === null) break;
      const step = matVec(Fi, target(cur, th));
      let t = 1, next: Eval | undefined, cand: number[] = th;
      for (let h = 0; h < 60; h++) {
        cand = th.map((v, j) => v + t * step[j]!);
        const e = evaluate(cand, model, l1, l2);
        if (Number.isFinite(e.ll) && e.phi.every((f) => f > 0) && accept(e, cur)) { next = e; break; }
        t /= 2;
      }
      iterations++;
      if (next === undefined) break;
      const small = step.every((s, j) => Math.abs(t * s) <= 1e-12 * Math.max(1, Math.abs(th[j]!)));
      th = cand; cur = next;
      if (small) { converged = true; break; }
    }
  };
  fisher((e) => e.score, (next, prev) => next.ll >= prev.ll - 1e-12 * Math.abs(prev.ll));
  const warnings = [...d.warnings];
  let bias: number[] | undefined;
  if (type !== "ML") {
    const Fi = spdInverse(cur.info);
    if (Fi === null) throw new RangeError("the expected information is singular");
    if (type === "BC") {
      const A = adjustment(th, model, l1, l2, Fi);
      bias = matVec(Fi, A).map((v) => -v);
      th = th.map((v, j) => v - bias![j]!);
      cur = evaluate(th, model, l1, l2);
    } else {
      converged = false;
      fisher((e, t) => { const Fn = spdInverse(e.info)!; const A = adjustment(t, model, l1, l2, Fn); return e.score.map((s, j) => s + A[j]!); }, () => true);
    }
  }
  if (!converged && type !== "BC") warnings.push("the Fisher scoring did not converge");
  const vcov = spdInverse(cur.info);
  if (vcov === null) throw new RangeError("the expected information is singular");
  // pseudo R^2: squared weighted correlation of eta and g(y)
  const mE = cur.e1.reduce((s, v, i) => s + weights[i]! * v, 0) / sw, mY = gy.reduce((s, v, i) => s + weights[i]! * v, 0) / sw;
  let sxy = 0, sxx = 0, syy = 0;
  cur.e1.forEach((e, i) => { const w = weights[i]!; sxy += w * (e - mE) * (gy[i]! - mY); sxx += w * (e - mE) ** 2; syy += w * (gy[i]! - mY) ** 2; });
  const nobs = weights.filter((w) => w > 0).length;
  const precisionNames = parsedZ === undefined && linkPhiName === "identity" ? ["(phi)"] : zNames.map((nm) => `(phi)_${nm}`);
  const result: BetaregResult = {
    coefficients: { mean: th.slice(0, p), precision: th.slice(p) }, meanNames: d.colNames.slice(), precisionNames,
    names: [...d.colNames, ...precisionNames], vcov, loglik: cur.ll, pseudoRSquared: (sxy * sxy) / (sxx * syy),
    fitted: cur.mu, linearPredictor: cur.e1, precision: cur.phi, link: linkName, linkPhi: linkPhiName, type,
    n: y.length, nobs, dfNull: nobs - 2, dfResidual: nobs - k, iterations, converged, model, warnings,
  };
  if (bias !== undefined) result.bias = bias;
  return result;
}

/**
 * Result of {@link betaregSummary}.
 * @category Regression models
 */
export interface BetaregSummaryResult {
  /** Wald tables of the mean and the precision coefficients. */
  mean: { names: string[]; estimate: number[]; se: number[]; z: number[]; p: number[] };
  precision: { names: string[]; estimate: number[]; se: number[]; z: number[]; p: number[] };
  loglik: number;
  /** Number of coefficients (the degrees of freedom of the log-likelihood). */
  df: number;
  aic: number;
  pseudoRSquared: number;
  type: BetaregType;
  link: BetaregLink;
  linkPhi: BetaregPhiLink;
  /** Minimum, quartiles and maximum of the quantile residuals. */
  residuals: number[];
}

/**
 * Summary of a {@link betareg} fit: Wald tests of the mean and precision coefficients. Equivalent to R's `summary()`
 * of a `betareg` fit.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * betaregSummary(fit).mean.p;
 * ```
 * @category Regression models
 */
export function betaregSummary(fit: BetaregResult): BetaregSummaryResult {
  const all = [...fit.coefficients.mean, ...fit.coefficients.precision];
  const se = fit.vcov.map((r, j) => Math.sqrt(r[j]!));
  const table = (from: number, to: number, names: string[]) => {
    const estimate = all.slice(from, to), s = se.slice(from, to), z = estimate.map((v, j) => v / s[j]!);
    return { names: names.slice(), estimate, se: s, z, p: z.map((v) => 2 * pnorm(-Math.abs(v))) };
  };
  const p = fit.coefficients.mean.length;
  const r = betaregResiduals(fit, { type: "quantile" }).slice().sort((a, b) => a - b);
  const quantile = (pr: number) => { const h = (r.length - 1) * pr, lo = Math.floor(h); return r[lo]! + (h - lo) * ((r[lo + 1] ?? r[lo]!) - r[lo]!); };
  return {
    mean: table(0, p, fit.meanNames), precision: table(p, all.length, fit.precisionNames), loglik: fit.loglik,
    df: all.length, aic: -2 * fit.loglik + 2 * all.length, pseudoRSquared: fit.pseudoRSquared, type: fit.type,
    link: fit.link, linkPhi: fit.linkPhi, residuals: [0, 0.25, 0.5, 0.75, 1].map(quantile),
  };
}

/**
 * Options for {@link betaregConfint}.
 * @category Regression models
 */
export interface BetaregConfintOptions {
  /** Confidence level (default 0.95). */
  level?: number;
}

/**
 * Wald confidence intervals of all coefficients of a {@link betareg} fit. Equivalent to R's `confint()` of a
 * `betareg` fit.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * betaregConfint(fit, { level: 0.9 }); // { names, lower, upper }
 * ```
 * @category Regression models
 */
export function betaregConfint(fit: BetaregResult, options: BetaregConfintOptions = {}): { names: string[]; lower: number[]; upper: number[] } {
  const level = options.level ?? 0.95;
  if (!(level > 0 && level < 1)) throw new RangeError("'level' must be between 0 and 1");
  const zq = qnorm((1 + level) / 2);
  const all = [...fit.coefficients.mean, ...fit.coefficients.precision];
  const se = fit.vcov.map((r, j) => Math.sqrt(r[j]!));
  return { names: fit.names.slice(), lower: all.map((v, j) => v - zq * se[j]!), upper: all.map((v, j) => v + zq * se[j]!) };
}

/**
 * Options for {@link betaregPredict}.
 * @category Regression models
 */
export interface BetaregPredictOptions {
  /** New data (default: the rows of the fit). */
  newdata?: DataFrame;
  /**
   * `"response"` (the mean, default), `"link"`, `"precision"`, `"variance"`, `"parameters"` (rows of [mu, phi]),
   * `"density"`, `"probability"` or `"quantile"` (at `at`).
   */
  type?: "response" | "link" | "precision" | "variance" | "parameters" | "density" | "probability" | "quantile";
  /** Where `"density"`, `"probability"` and `"quantile"` are evaluated (default 0.5). */
  at?: number | readonly number[];
  /**
   * One value of `at` per row (a vector) or every value at every row (a matrix of rows x at). Default: per row when
   * `at` has as many values as there are rows, else the matrix (as R).
   */
  elementwise?: boolean;
}

/**
 * Predictions of a {@link betareg} fit: means, linear predictors, precisions, variances, or the density,
 * distribution function or quantiles of the fitted beta distributions. Equivalent to R's `predict()` of a `betareg`
 * fit.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * betaregPredict(fit, { newdata: { x: [2.5, 9] } });
 * betaregPredict(fit, { type: "quantile", at: [0.1, 0.9] }); // one row per observation
 * ```
 * @category Regression models
 */
export function betaregPredict(fit: BetaregResult, options: BetaregPredictOptions = {}): number[] | number[][] {
  const type = options.type ?? "response";
  const types = ["response", "link", "precision", "variance", "parameters", "density", "probability", "quantile"];
  if (!types.includes(type)) throw new RangeError(`'arg' should be one of ${types.map((t) => `“${t}”`).join(", ")}`);
  const l1 = meanLink(fit.link), l2 = phiLink(fit.linkPhi);
  let e1: number[], e2: number[];
  if (options.newdata === undefined) { e1 = fit.linearPredictor.slice(); e2 = fit.precision.map((f) => l2.fun(f)); }
  else {
    const data = options.newdata, m = fit.model;
    const nRows = dataRowCount(data, m.variables);
    if (nRows === undefined) throw new TypeError("cannot determine the number of rows in newdata");
    const build = (rhs: FormulaNode | undefined, names: string[], constant: boolean): number[][] => {
      if (constant) return Array.from({ length: nRows }, () => [1]);
      const dd = design({ response: undefined, rhs }, data, { levels: m.factorLevels as Record<string, string[]>, contrasts: m.contrasts });
      if (dd.frame.rows.length !== nRows) throw new RangeError("newdata has missing values");
      const cols = names.map((nm) => dd.colNames.indexOf(nm));
      if (cols.some((j) => j < 0)) throw new RangeError("newdata does not produce the fitted model matrix columns");
      return dd.x.map((r) => cols.map((j) => r[j]!));
    };
    const X = build(m.meanRhs, fit.meanNames, false);
    const Z = build(m.precisionRhs, fit.precisionNames.map((nm) => (nm === "(phi)" ? "(Intercept)" : nm.slice(6))), m.precisionRhs === undefined);
    e1 = X.map((r) => dot(r, fit.coefficients.mean));
    e2 = Z.map((r) => dot(r, fit.coefficients.precision));
  }
  const mu = e1.map((e) => l1.inv(e)), phi = e2.map((e) => l2.inv(e));
  switch (type) {
    case "response": return mu;
    case "link": return e1;
    case "precision": return phi;
    case "variance": return mu.map((m, i) => (m * (1 - m)) / (1 + phi[i]!));
    case "parameters": return mu.map((m, i) => [m, phi[i]!]);
    default: {
      const at = typeof options.at === "number" ? [options.at] : Array.from(options.at ?? [0.5]);
      const f = (v: number, i: number): number => {
        const a = mu[i]! * phi[i]!, b = (1 - mu[i]!) * phi[i]!;
        return type === "density" ? dbeta1(v, a, b, false) : type === "probability" ? pbeta1(v, a, b, true, false) : qbeta1(v, a, b, true, false);
      };
      const elementwise = options.elementwise ?? (at.length === mu.length);
      if (elementwise) {
        if (at.length !== mu.length && at.length !== 1) throw new RangeError("'at' must have one value per row for elementwise evaluation");
        return mu.map((_, i) => f(at.length === 1 ? at[0]! : at[i]!, i));
      }
      return mu.map((_, i) => at.map((v) => f(v, i)));
    }
  }
}

/**
 * Options for {@link betaregResiduals}.
 * @category Regression models
 */
export interface BetaregResidualsOptions {
  /** `"quantile"` (default), `"deviance"`, `"pearson"`, `"response"`, `"weighted"`, `"sweighted"` or `"sweighted2"`. */
  type?: "quantile" | "deviance" | "pearson" | "response" | "weighted" | "sweighted" | "sweighted2";
}

/**
 * Residuals of a {@link betareg} fit (Espinheira, Ferrari and Cribari-Neto 2008; quantile residuals of Dunn and Smyth
 * 1996). Every type but `"response"` is multiplied by the square root of the case weight, as R. Equivalent to R's
 * `residuals()` of a `betareg` fit.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * betaregResiduals(fit, { type: "sweighted2" });
 * ```
 * @category Regression models
 */
export function betaregResiduals(fit: BetaregResult, options: BetaregResidualsOptions = {}): number[] {
  const type = options.type ?? "quantile";
  const types = ["quantile", "deviance", "pearson", "response", "weighted", "sweighted", "sweighted2"];
  if (!types.includes(type)) throw new RangeError(`'arg' should be one of ${types.map((t) => `“${t}”`).join(", ")}`);
  const { y, weights } = fit.model, mu = fit.fitted, phi = fit.precision;
  if (type === "response") return y.map((v, i) => v - mu[i]!);
  const h = type === "sweighted2" ? betaregHatvalues(fit) : undefined;
  return y.map((v, i) => {
    const m = mu[i]!, f = phi[i]!, a = m * f, b = (1 - m) * f, sw = Math.sqrt(weights[i]!);
    let r: number;
    switch (type) {
      case "quantile": r = qnorm(pbeta1(v, a, b, true, false)); break;
      case "pearson": r = (v - m) / Math.sqrt((m * (1 - m)) / (1 + f)); break;
      // |l(y | mean y) - l(y | mean mu)|: mean y is not the maximum, the difference can be negative (R takes abs)
      case "deviance": r = Math.sign(v - m) * Math.sqrt(2 * Math.abs(dbeta1(v, v * f, (1 - v) * f, true) - dbeta1(v, a, b, true))); break;
      default: {
        const ys = Math.log(v) - Math.log1p(-v), ms = digamma(a) - digamma(b), vv = trigamma(a) + trigamma(b);
        r = type === "weighted" ? (ys - ms) / Math.sqrt(f * vv) : type === "sweighted" ? (ys - ms) / Math.sqrt(vv) : (ys - ms) / Math.sqrt(vv * (1 - h![i]!));
      }
    }
    return sw * r;
  });
}

/** Diagonal of the hat matrix W^1/2 X (X'WX)^-1 X' W^1/2, W = w phi (psi'(a) + psi'(b)) (dmu/deta)^2 */
function betaregHatvalues(fit: BetaregResult): number[] {
  const { x, weights } = fit.model, l1 = meanLink(fit.link), p = x[0]!.length;
  const W = fit.fitted.map((m, i) => {
    const f = fit.precision[i]!;
    return weights[i]! * f * (trigamma(m * f) + trigamma((1 - m) * f)) * l1.d1(fit.linearPredictor[i]!) ** 2;
  });
  const XtWX = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => x.reduce((s, r, i) => s + W[i]! * r[a]! * r[b]!, 0)));
  const inv = spdInverse(XtWX);
  if (inv === null) return x.map(() => NaN);
  return x.map((r, i) => W[i]! * dot(r, matVec(inv, r)));
}
