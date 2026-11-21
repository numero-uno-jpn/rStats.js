// Elastic-net regularized generalized linear models, derived from the published objective and public numerical output.
// The path solver uses IRLS with coordinate descent; no glmnet or R implementation code is used.

/**
 * Family used for the penalized generalized linear model.
 * @category Regression
 */
export type GlmnetFamily = "gaussian" | "binomial" | "poisson" | "multinomial";
/**
 * Multinomial penalty structure.
 * @category Regression
 */
export type GlmnetMultiType = "ungrouped" | "grouped";
/**
 * Scale or coefficient selection returned by a penalized-model prediction.
 * @category Regression
 */
export type GlmnetPredictType = "link" | "response" | "class" | "nonzero";

/**
 * Options for {@link glmnet}.
 * @category Regression
 */
export interface GlmnetOptions {
  family?: GlmnetFamily;
  typeMultinomial?: GlmnetMultiType;
  alpha?: number;
  lambda?: readonly number[];
  nlambda?: number;
  lambdaMinRatio?: number;
  standardize?: boolean;
  intercept?: boolean;
  weights?: readonly number[];
  offset?: readonly number[];
  penaltyFactor?: readonly number[];
  lowerLimits?: number | readonly number[];
  upperLimits?: number | readonly number[];
  dfmax?: number;
  pmax?: number;
  maxit?: number;
  thresh?: number;
}

/**
 * Result of a scalar-family {@link glmnet} fit.
 * @category Regression
 */
export interface GlmnetScalarResult {
  family: "gaussian" | "binomial" | "poisson";
  alpha: number;
  lambda: number[];
  a0: number[];
  beta: number[][];
  df: number[];
  devRatio: number[];
  nullDev: number;
  npasses: number;
  converged: boolean[];
  kktResidual: number[];
  model: {
    x: number[][];
    y: number[];
    weights: number[];
    offset: number[];
    xMean: number[];
    xScale: number[];
    intercept: boolean;
    columns: number;
  };
}

/**
 * Result of a multinomial {@link glmnet} fit.
 * @category Regression
 */
export interface GlmnetMultinomialResult {
  family: "multinomial";
  alpha: number;
  lambda: number[];
  a0: number[][];
  beta: Record<string, number[][]>;
  dfmat: number[][];
  devRatio: number[];
  nullDev: number;
  npasses: number;
  converged: boolean[];
  kktResidual: number[];
  model: {
    x: number[][];
    y: string[];
    weights: number[];
    offset: number[];
    xMean: number[];
    xScale: number[];
    intercept: boolean;
    columns: number;
    classes: string[];
    typeMultinomial: GlmnetMultiType;
  };
}

/**
 * Union of scalar-family and multinomial regularization paths.
 * @category Regression
 */
export type GlmnetResult = GlmnetScalarResult | GlmnetMultinomialResult;

/**
 * Options for {@link glmnetPredict}.
 * @category Regression
 */
export interface GlmnetPredictOptions {
  s?: number | readonly number[];
  type?: GlmnetPredictType;
  offset?: readonly number[];
}

/**
 * Options for {@link cvGlmnet}; fold assignments are required.
 * @category Regression
 */
export interface CvGlmnetOptions extends GlmnetOptions {
  foldid: readonly number[];
  typeMeasure?: "deviance" | "mse" | "mae" | "class" | "auc";
  grouped?: boolean;
  keep?: boolean;
}

/**
 * Cross-validation summary returned by {@link cvGlmnet}.
 * @category Regression
 */
export interface CvGlmnetResult {
  fit: GlmnetResult;
  lambda: number[];
  cvm: number[];
  cvsd: number[];
  cvup: number[];
  cvlo: number[];
  nzero: number[];
  lambdaMin: number;
  lambda1se: number;
  foldid: number[];
  name?: string;
  warnings?: string[];
  fitPreval?: number[][] | number[][][];
}

function soft(value: number, threshold: number): number {
  return value > threshold ? value - threshold : value < -threshold ? value + threshold : 0;
}
function sum(values: readonly number[]): number {
  let out = 0;
  for (const value of values) out += value;
  return out;
}
function mean(values: readonly number[], weights: readonly number[]): number {
  let a = 0, b = 0;
  for (let i = 0; i < values.length; i++) { a += values[i]! * weights[i]!; b += weights[i]!; }
  return a / b;
}
function normalizeVector(value: number | readonly number[] | undefined, n: number, fallback: number): number[] {
  if (value === undefined) return new Array<number>(n).fill(fallback);
  if (typeof value === "number") return new Array<number>(n).fill(value);
  if (value.length !== n) throw new RangeError("vector length must match the number of predictors");
  return Array.from(value);
}
function log1pexp(x: number): number {
  return x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x));
}
function inverseLink(eta: number, family: GlmnetFamily): number {
  if (family === "binomial") return eta >= 0 ? 1 / (1 + Math.exp(-eta)) : Math.exp(eta) / (1 + Math.exp(eta));
  if (family === "poisson") return Math.exp(Math.max(-700, Math.min(700, eta)));
  return eta;
}
function nullIntercept(y: readonly number[], weights: readonly number[], offset: readonly number[], family: GlmnetFamily, intercept: boolean): number {
  if (!intercept) return 0;
  let b = family === "binomial" ? Math.log((sum(y.map((v, i) => v * weights[i]!)) + 0.5) /
    (sum(weights) - sum(y.map((v, i) => v * weights[i]!)) + 0.5)) :
    family === "poisson" ? Math.log(Math.max(1e-12, mean(y, weights))) : mean(y, weights);
  for (let it = 0; it < 100; it++) {
    let g = 0, h = 0;
    for (let i = 0; i < y.length; i++) {
      const mu = inverseLink(b + offset[i]!, family);
      if (family === "gaussian") { g += weights[i]! * (mu - y[i]!); h += weights[i]!; }
      else if (family === "binomial") { g += weights[i]! * (mu - y[i]!); h += weights[i]! * mu * (1 - mu); }
      else { g += weights[i]! * (mu - y[i]!); h += weights[i]! * mu; }
    }
    if (!(h > 0)) break;
    const step = g / h;
    b -= Math.max(-2, Math.min(2, step));
    if (Math.abs(step) < 1e-12) break;
  }
  return b;
}
function loss(y: readonly number[], eta: readonly number[], weights: readonly number[], family: GlmnetFamily): number {
  let value = 0;
  for (let i = 0; i < y.length; i++) {
    const e = eta[i]!, yi = y[i]!, w = weights[i]!;
    if (family === "gaussian") value += 0.5 * w * (yi - e) ** 2;
    else if (family === "binomial") value += w * (log1pexp(e) - yi * e);
    else value += w * (Math.exp(Math.max(-700, Math.min(700, e))) - yi * e);
  }
  return value / y.length;
}
function deviance(y: readonly number[], eta: readonly number[], weights: readonly number[], family: GlmnetFamily): number {
  if (family === "gaussian") return 2 * loss(y, eta, weights, family);
  let out = 0;
  for (let i = 0; i < y.length; i++) {
    const mu = inverseLink(eta[i]!, family), yi = y[i]!, w = weights[i]!;
    if (family === "binomial") {
      const a = yi > 0 ? yi * Math.log(yi / mu) : 0;
      const b = yi < 1 ? (1 - yi) * Math.log((1 - yi) / (1 - mu)) : 0;
      out += 2 * w * (a + b);
    } else out += 2 * w * (yi === 0 ? mu : yi * Math.log(yi / mu) - (yi - mu));
  }
  return out;
}
function scalarKktResidual(
  x: readonly (readonly number[])[], y: readonly number[], weights: readonly number[], eta: readonly number[],
  family: "gaussian" | "binomial" | "poisson", alpha: number, lambda: number,
  beta: readonly number[], intercept: boolean, penalty: readonly number[],
  lower: readonly number[], upper: readonly number[],
): number {
  const n = y.length, p = beta.length, gradient = new Array<number>(p).fill(0);
  let interceptGradient = 0;
  for (let i = 0; i < n; i++) {
    const residual = weights[i]! * (inverseLink(eta[i]!, family) - y[i]!) / n;
    interceptGradient += residual;
    for (let j = 0; j < p; j++) gradient[j] = gradient[j]! + residual * x[i]![j]!;
  }
  let maximum = intercept ? Math.abs(interceptGradient) : 0;
  for (let j = 0; j < p; j++) {
    const value = beta[j]!, smooth = gradient[j]! + lambda * (1 - alpha) * penalty[j]! * value;
    const l1 = lambda * alpha * penalty[j]!;
    let violation = 0;
    if (lower[j] === upper[j]) violation = 0;
    else if (value <= lower[j]! + 1e-12) violation = Math.max(0, -(smooth + (value < 0 ? -l1 : l1)));
    else if (value >= upper[j]! - 1e-12) violation = Math.max(0, smooth + (value > 0 ? l1 : -l1));
    else if (value > 0) violation = Math.abs(smooth + l1);
    else if (value < 0) violation = Math.abs(smooth - l1);
    else violation = Math.max(0, Math.abs(smooth) - l1);
    maximum = Math.max(maximum, violation);
  }
  return maximum;
}

function fitOne(
  x: readonly (readonly number[])[], y: readonly number[], weights: readonly number[], offset: readonly number[],
  family: "gaussian" | "binomial" | "poisson", alpha: number, lambda: number, start: number[], intercept: boolean,
  penalty: readonly number[], lower: readonly number[], upper: readonly number[], maxit: number, thresh: number,
): { a0: number; beta: number[]; eta: number[]; passes: number; converged: boolean; kkt: number } {
  const n = y.length, p = penalty.length;
  let a0 = start[0] ?? 0;
  const beta = start.slice(1);
  let eta = y.map((_, i) => a0 + offset[i]! + x[i]!.reduce((v, z, j) => v + z * beta[j]!, 0));
  let converged = false, passes = 0;
  const maxSweeps = Math.min(2000, maxit);
  for (let outer = 0; outer < maxit; outer++) {
    const oldA = a0, oldB = beta.slice();
    const workWeight = new Array<number>(n), target = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const mu = inverseLink(eta[i]!, family);
      const derivative = family === "gaussian" ? 1 :
        family === "binomial" ? Math.max(1e-12, mu * (1 - mu)) : Math.max(1e-12, mu);
      workWeight[i] = weights[i]! * derivative;
      target[i] = eta[i]! + (y[i]! - mu) / derivative - offset[i]!;
    }
    let innerConverged = false;
    for (let sweep = 0; sweep < maxSweeps; sweep++) {
      passes++;
      const sweepA = a0, sweepB = beta.slice();
      if (intercept) {
        let numerator = 0, denominator = 0;
        for (let i = 0; i < n; i++) {
          let residual = target[i]!;
          for (let j = 0; j < p; j++) residual -= x[i]![j]! * beta[j]!;
          numerator += workWeight[i]! * residual;
          denominator += workWeight[i]!;
        }
        if (denominator > 0) a0 = numerator / denominator;
      }
      for (let j = 0; j < p; j++) {
        let numerator = 0, denominator = 0;
        for (let i = 0; i < n; i++) {
          let partial = target[i]! - a0;
          for (let k = 0; k < p; k++) if (k !== j) partial -= x[i]![k]! * beta[k]!;
          const w = workWeight[i]!, xj = x[i]![j]!;
          numerator += w * xj * partial;
          denominator += w * xj * xj;
        }
        const curvature = denominator / n + lambda * (1 - alpha) * penalty[j]!;
        const value = curvature > 0
          ? soft(numerator / n, lambda * alpha * penalty[j]!) / curvature
          : 0;
        beta[j] = Math.max(lower[j]!, Math.min(upper[j]!, value));
      }
      let change = Math.abs(a0 - sweepA), scale = Math.abs(a0);
      for (let j = 0; j < p; j++) {
        change = Math.max(change, Math.abs(beta[j]! - sweepB[j]!));
        scale = Math.max(scale, Math.abs(beta[j]!));
      }
      if (change <= Math.max(thresh * 0.1, 1e-15) * (1 + scale)) { innerConverged = true; break; }
    }
    eta = y.map((_, i) => a0 + offset[i]! + x[i]!.reduce((v, z, j) => v + z * beta[j]!, 0));
    let change = Math.abs(a0 - oldA), scale = Math.abs(a0);
    for (let j = 0; j < p; j++) {
      change = Math.max(change, Math.abs(beta[j]! - oldB[j]!));
      scale = Math.max(scale, Math.abs(beta[j]!));
    }
    if (change <= thresh * (1 + scale) && innerConverged) {
      const kkt = scalarKktResidual(x, y, weights, eta, family, alpha, lambda, beta, intercept, penalty, lower, upper);
      if (kkt <= thresh * (1 + scale)) { converged = true; break; }
    }
  }
  const kkt = scalarKktResidual(x, y, weights, eta, family, alpha, lambda, beta, intercept, penalty, lower, upper);
  return { a0, beta, eta, passes, converged, kkt };
}
function glmnetScalar(x: readonly (readonly number[])[], y: readonly number[], options: GlmnetOptions = {}): GlmnetScalarResult {
  const n = y.length, p = x[0]?.length ?? 0;
  if (n < 2 || p < 2 || x.length !== n || x.some(r => r.length !== p)) throw new RangeError("x must be a rectangular matrix with at least two columns and two rows");
  if (y.some(v => !Number.isFinite(v)) || x.some(r => r.some(v => !Number.isFinite(v)))) throw new RangeError("x and y must contain only finite values");
  const family = (options.family ?? "gaussian") as "gaussian" | "binomial" | "poisson", alpha = options.alpha ?? 1;
  if (!["gaussian", "binomial", "poisson"].includes(family)) throw new RangeError("unsupported family");
  if (!(alpha >= 0 && alpha <= 1)) throw new RangeError("alpha must be in [0, 1]");
  if (family === "binomial" && y.some(v => v < 0 || v > 1)) throw new RangeError("binomial y must be in [0, 1]");
  if (family === "poisson" && y.some(v => v < 0)) throw new RangeError("poisson y must be non-negative");
  if (family === "gaussian" && y.every(v => v === y[0])) throw new RangeError("y is constant");
  const intercept = options.intercept ?? true;
  const weights = options.weights ? Array.from(options.weights) : new Array<number>(n).fill(1);
  const offset = options.offset ? Array.from(options.offset) : new Array<number>(n).fill(0);
  if (weights.length !== n || weights.some(v => !(v >= 0) || !Number.isFinite(v)) || sum(weights) <= 0) throw new RangeError("invalid weights");
  if (offset.length !== n || offset.some(v => !Number.isFinite(v))) throw new RangeError("invalid offset");
  const wsum = sum(weights), w = weights.map(v => v * n / wsum);
  const penalty = normalizeVector(options.penaltyFactor, p, 1);
  if (penalty.some(v => !(v >= 0) || !Number.isFinite(v)) || sum(penalty) <= 0) throw new RangeError("invalid penalty.factor");
  const pf = penalty.map(v => v * p / sum(penalty));
  const xMean = Array.from({ length: p }, (_, j) => intercept ? mean(x.map(r => r[j]!), w) : 0);
  const xScale = Array.from({ length: p }, (_, j) => {
    let v = 0; for (let i = 0; i < n; i++) v += w[i]! * (x[i]![j]! - xMean[j]!) ** 2;
    const s = Math.sqrt(v / n);
    if (!(s > 0)) throw new RangeError("x contains a constant column");
    return options.standardize === false ? 1 : s;
  });
  const xs = x.map(r => r.map((v, j) => (v - xMean[j]!) / xScale[j]!));
  const y0 = nullIntercept(y, w, offset, family, intercept);
  const eta0 = y.map((_, i) => y0 + offset[i]!);
  const residualGradient = Array.from({ length: p }, (_, j) => {
    let g = 0; for (let i = 0; i < n; i++) g += w[i]! * (inverseLink(eta0[i]!, family) - y[i]!) * xs[i]![j]!;
    return Math.abs(g / n);
  });
  const alphaForMax = alpha === 0 ? 0.001 : alpha;
  let lambdaMax = 0; for (let j = 0; j < p; j++) if (pf[j]! > 0) lambdaMax = Math.max(lambdaMax, residualGradient[j]! / (alphaForMax * pf[j]!));
  const nlambda = options.nlambda ?? 100;
  if (!Number.isInteger(nlambda) || nlambda < 1) throw new RangeError("nlambda must be a positive integer");
  const minRatio = options.lambdaMinRatio ?? (n > p ? 1e-4 : 1e-2);
  if (!(minRatio > 0 && minRatio <= 1)) throw new RangeError("lambdaMinRatio must be in (0, 1]");
  const lambdas = options.lambda ? Array.from(options.lambda) :
    Array.from({ length: nlambda }, (_, i) => lambdaMax * Math.exp(Math.log(minRatio) * i / Math.max(1, nlambda - 1)));
  if (lambdas.length === 0 || lambdas.some((v, i) => !(v > 0) || (i > 0 && v > lambdas[i - 1]!))) throw new RangeError("lambda must be a decreasing positive sequence");
  const lower = normalizeVector(options.lowerLimits, p, -Infinity);
  const upper = normalizeVector(options.upperLimits, p, Infinity);
  for (let j = 0; j < p; j++) {
    if (lower[j]! > 0 || lower[j]! > upper[j]!) throw new RangeError("invalid coefficient limits");
    lower[j] = lower[j]! * xScale[j]!; upper[j] = upper[j]! * xScale[j]!;
  }
  const maxit = options.maxit ?? 100000, thresh = options.thresh ?? 1e-10;
  if (!Number.isInteger(maxit) || maxit < 1 || !(thresh > 0)) throw new RangeError("invalid convergence controls");
  const dfmax = options.dfmax ?? p + 1, pmax = options.pmax ?? p;
  if (!Number.isInteger(dfmax) || dfmax < 1 || !Number.isInteger(pmax) || pmax < 1) throw new RangeError("dfmax and pmax must be positive integers");
  const a0: number[] = [], beta: number[][] = [], df: number[] = [], devRatio: number[] = [], converged: boolean[] = [], kktResidual: number[] = [];
  const nullDev = deviance(y, eta0, w, family);
  let start = [y0, ...new Array<number>(p).fill(0)], npasses = 0;
  const everActive = new Set<number>();
  for (const lambda of lambdas) {
    const fit = fitOne(xs, y, w, offset, family, alpha, lambda, start, intercept, pf, lower, upper, maxit, thresh);
    const active = fit.beta.filter(v => v !== 0).length;
    for (let j = 0; j < p; j++) if (fit.beta[j] !== 0) everActive.add(j);
    if (active > dfmax || everActive.size > pmax) break;
    start = [fit.a0, ...fit.beta]; npasses += fit.passes;
    const originalBeta = fit.beta.map((v, j) => v / xScale[j]!);
    let originalIntercept = fit.a0;
    if (intercept) for (let j = 0; j < p; j++) originalIntercept -= xMean[j]! * originalBeta[j]!;
    a0.push(originalIntercept);
    beta.push(originalBeta);
    df.push(active);
    devRatio.push(nullDev === 0 ? 0 : 1 - deviance(y, fit.eta, w, family) / nullDev);
    converged.push(fit.converged);
    kktResidual.push(fit.kkt);
  }
  if (a0.length === 0) throw new RangeError("no lambda values satisfy dfmax and pmax");
  return { family, alpha, lambda: lambdas.slice(0, a0.length), a0, beta, df, devRatio, nullDev, npasses, converged, kktResidual,
    model: { x: x.map(r => Array.from(r)), y: Array.from(y), weights: w, offset, xMean, xScale, intercept, columns: p } };
}


function centeredPenaltyShift(values: readonly number[], alpha: number): number {
  if (alpha >= 1) {
    const sorted = Array.from(values).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? -sorted[middle]! : -(sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  if (alpha <= 0) return -mean(values, new Array<number>(values.length).fill(1));
  let lo = Infinity, hi = -Infinity;
  for (const value of values) { lo = Math.min(lo, -value); hi = Math.max(hi, -value); }
  const derivative = (shift: number): number => {
    let total = 0;
    for (const value of values) {
      const v = value + shift;
      total += alpha * (v > 0 ? 1 : v < 0 ? -1 : 0) + (1 - alpha) * v;
    }
    return total;
  };
  const span = Math.max(1, hi - lo);
  lo -= span; hi += span;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (derivative(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function multinomialObjective(
  x: readonly (readonly number[])[], y: readonly number[], weights: readonly number[],
  a0: readonly number[], beta: readonly (readonly number[])[], lambda: number,
  alpha: number, penalty: readonly number[], grouped: boolean,
): number {
  const n = y.length, p = penalty.length, kCount = a0.length;
  let value = 0;
  for (let i = 0; i < n; i++) {
    let maxEta = -Infinity;
    const eta = new Array<number>(kCount);
    for (let k = 0; k < kCount; k++) {
      let v = a0[k]!;
      for (let j = 0; j < p; j++) v += x[i]![j]! * beta[j]![k]!;
      eta[k] = v;
      maxEta = Math.max(maxEta, v);
    }
    let denominator = 0;
    for (let k = 0; k < kCount; k++) denominator += Math.exp(eta[k]! - maxEta);
    value += weights[i]! * (Math.log(denominator) + maxEta - eta[y[i]!]!);
  }
  value /= n;
  for (let j = 0; j < p; j++) {
    if (grouped) {
      let norm = 0;
      for (let k = 0; k < kCount; k++) norm += beta[j]![k]! ** 2;
      norm = Math.sqrt(norm);
      value += lambda * penalty[j]! * (alpha * norm + (1 - alpha) * norm * norm / 2);
    } else {
      for (let k = 0; k < kCount; k++) {
        const v = beta[j]![k]!;
        value += lambda * penalty[j]! * (alpha * Math.abs(v) + (1 - alpha) * v * v / 2);
      }
    }
  }
  return value;
}

function multinomialKktResidual(
  x: readonly (readonly number[])[], y: readonly number[], weights: readonly number[],
  a0: readonly number[], beta: readonly (readonly number[])[], lambda: number,
  alpha: number, penalty: readonly number[], grouped: boolean,
): number {
  const n = y.length, p = penalty.length, kCount = a0.length;
  const gradA = new Array<number>(kCount).fill(0);
  const gradB = Array.from({ length: p }, () => new Array<number>(kCount).fill(0));
  for (let i = 0; i < n; i++) {
    const eta = a0.map((v, k) => {
      let out = v;
      for (let j = 0; j < p; j++) out += x[i]![j]! * beta[j]![k]!;
      return out;
    });
    let maxEta = -Infinity; for (const v of eta) maxEta = Math.max(maxEta, v);
    let denominator = 0; for (const v of eta) denominator += Math.exp(v - maxEta);
    for (let k = 0; k < kCount; k++) {
      const residual = weights[i]! * (Math.exp(eta[k]! - maxEta) / denominator - (y[i] === k ? 1 : 0)) / n;
      gradA[k] = gradA[k]! + residual;
      for (let j = 0; j < p; j++) gradB[j]![k] = gradB[j]![k]! + residual * x[i]![j]!;
    }
  }
  let maximum = 0;
  for (const value of gradA) maximum = Math.max(maximum, Math.abs(value));
  for (let j = 0; j < p; j++) {
    const l1 = lambda * alpha * penalty[j]!, ridge = lambda * (1 - alpha) * penalty[j]!;
    if (grouped) {
      let norm = 0, gradientNorm = 0, residualNorm = 0;
      for (let k = 0; k < kCount; k++) norm += beta[j]![k]! ** 2;
      norm = Math.sqrt(norm);
      if (norm === 0) {
        for (let k = 0; k < kCount; k++) gradientNorm += gradB[j]![k]! ** 2;
        maximum = Math.max(maximum, Math.max(0, Math.sqrt(gradientNorm) - l1));
      } else {
        for (let k = 0; k < kCount; k++) {
          const residual = gradB[j]![k]! + ridge * beta[j]![k]! + l1 * beta[j]![k]! / norm;
          residualNorm += residual * residual;
        }
        maximum = Math.max(maximum, Math.sqrt(residualNorm));
      }
    } else {
      const fixed: number[] = [], intervals: Array<[number, number]> = [];
      for (let k = 0; k < kCount; k++) {
        const value = beta[j]![k]!, smooth = gradB[j]![k]! + ridge * value;
        if (value > 0) fixed.push(smooth + l1);
        else if (value < 0) fixed.push(smooth - l1);
        else intervals.push([smooth - l1, smooth + l1]);
      }
      const candidates = fixed.slice();
      for (const interval of intervals) { candidates.push(interval[0], interval[1], (interval[0] + interval[1]) / 2); }
      if (candidates.length === 0) continue;
      let best = Infinity;
      for (const center of candidates) {
        let violation = 0;
        for (const value of fixed) violation = Math.max(violation, Math.abs(value - center));
        for (const interval of intervals) violation = Math.max(violation, interval[0] - center, center - interval[1]);
        best = Math.min(best, Math.max(0, violation));
      }
      maximum = Math.max(maximum, best);
    }
  }
  return maximum;
}

function fitMultinomialOne(
  x: readonly (readonly number[])[], y: readonly number[], weights: readonly number[],
  startA: readonly number[], startB: readonly (readonly number[])[], lambda: number,
  alpha: number, penalty: readonly number[], grouped: boolean,
  lower: readonly number[], upper: readonly number[], maxit: number, thresh: number,
): { a0: number[]; beta: number[][]; eta: number[][]; passes: number; converged: boolean; kkt: number } {
  const n = y.length, p = penalty.length, kCount = startA.length;
  let a0 = Array.from(startA), beta = startB.map(row => Array.from(row));
  let extrapA = a0.slice(), extrapB = beta.map(row => row.slice()), acceleration = 1;
  let eta = x.map(row => a0.map((v, k) => {
    let out = v;
    for (let j = 0; j < p; j++) out += row[j]! * beta[j]![k]!;
    return out;
  }));
  let current = multinomialObjective(x, y, weights, a0, beta, lambda, alpha, penalty, grouped);
  let step = 2 / (p + 1), converged = false, passes = 0;
  const gradientAt = (a: readonly number[], b: readonly (readonly number[])[]) => {
    const gradA = new Array<number>(kCount).fill(0);
    const gradB = Array.from({ length: p }, () => new Array<number>(kCount).fill(0));
    for (let i = 0; i < n; i++) {
      const rowEta = a.map((v, k) => {
        let out = v;
        for (let j = 0; j < p; j++) out += x[i]![j]! * b[j]![k]!;
        return out;
      });
      let maxEta = -Infinity; for (const v of rowEta) maxEta = Math.max(maxEta, v);
      let denominator = 0; for (const v of rowEta) denominator += Math.exp(v - maxEta);
      for (let k = 0; k < kCount; k++) {
        const residual = weights[i]! * (Math.exp(rowEta[k]! - maxEta) / denominator - (y[i] === k ? 1 : 0)) / n;
        gradA[k] = gradA[k]! + residual;
        for (let j = 0; j < p; j++) gradB[j]![k] = gradB[j]![k]! + residual * x[i]![j]!;
      }
    }
    return { gradA, gradB };
  };
  for (let iteration = 0; iteration < maxit; iteration++) {
    let gradients = gradientAt(extrapA, extrapB);
    let candidateA: number[] = [], candidateB: number[][] = [], candidateEta: number[][] = [];
    let candidateObjective = Infinity, accepted = false;
    for (let restart = 0; restart < 20; restart++) {
      candidateA = extrapA.map((v, k) => v - step * gradients.gradA[k]!);
      let centerA = 0; for (const v of candidateA) centerA += v; centerA /= kCount;
      for (let k = 0; k < kCount; k++) candidateA[k] = candidateA[k]! - centerA;
      candidateB = extrapB.map((row, j) => {
        const z = row.map((v, k) => v - step * gradients.gradB[j]![k]!);
        const penaltyWeight = step * lambda * alpha * penalty[j]!;
        const ridge = 1 + step * lambda * (1 - alpha) * penalty[j]!;
        if (grouped) {
          let norm = 0; for (const v of z) norm += v * v; norm = Math.sqrt(norm);
          const shrink = norm > 0 ? Math.max(0, 1 - penaltyWeight / norm) / ridge : 0;
          const values = z.map(v => v * shrink);
          let center = 0; for (const v of values) center += v; center /= kCount;
          return values.map(v => Math.max(lower[j]!, Math.min(upper[j]!, v - center)));
        }
        const values = z.map(v => soft(v, penaltyWeight) / ridge);
        const shift = centeredPenaltyShift(values, alpha);
        return values.map(v => Math.max(lower[j]!, Math.min(upper[j]!, v + shift)));
      });
      candidateEta = x.map(row => candidateA.map((v, k) => {
        let out = v;
        for (let j = 0; j < p; j++) out += row[j]! * candidateB[j]![k]!;
        return out;
      }));
      candidateObjective = multinomialObjective(x, y, weights, candidateA, candidateB, lambda, alpha, penalty, grouped);
      if (Number.isFinite(candidateObjective) && candidateObjective <= current + 1e-13) {
        accepted = true;
        break;
      }
      if (restart === 0) {
        extrapA = a0.slice(); extrapB = beta.map(row => row.slice()); acceleration = 1;
        gradients = gradientAt(extrapA, extrapB);
      } else step *= 0.5;
    }
    passes++;
    if (!accepted) break;
    const oldA = a0, oldB = beta;
    a0 = candidateA; beta = candidateB; eta = candidateEta; current = candidateObjective;
    const nextAcceleration = (1 + Math.sqrt(1 + 4 * acceleration * acceleration)) / 2;
    const momentum = (acceleration - 1) / nextAcceleration;
    extrapA = a0.map((v, k) => v + momentum * (v - oldA[k]!));
    extrapB = beta.map((row, j) => row.map((v, k) => v + momentum * (v - oldB[j]![k]!)));
    acceleration = nextAcceleration;
    let change = 0, scale = 0;
    for (let k = 0; k < kCount; k++) {
      change = Math.max(change, Math.abs(a0[k]! - oldA[k]!));
      scale = Math.max(scale, Math.abs(a0[k]!));
    }
    for (let j = 0; j < p; j++) for (let k = 0; k < kCount; k++) {
      change = Math.max(change, Math.abs(beta[j]![k]! - oldB[j]![k]!));
      scale = Math.max(scale, Math.abs(beta[j]![k]!));
    }
    if (change <= thresh * (1 + scale)) {
      const kkt = multinomialKktResidual(x, y, weights, a0, beta, lambda, alpha, penalty, grouped);
      if (kkt <= thresh * (1 + scale)) { converged = true; break; }
    }
  }
  const kkt = multinomialKktResidual(x, y, weights, a0, beta, lambda, alpha, penalty, grouped);
  return { a0, beta, eta, passes, converged, kkt };
}

function glmnetMultinomial(
  x: readonly (readonly number[])[], labels: readonly string[], options: GlmnetOptions,
): GlmnetMultinomialResult {
  const n = labels.length, p = x[0]?.length ?? 0;
  if (n < 2 || p < 2 || x.length !== n || x.some(row => row.length !== p)) throw new RangeError("x must be a rectangular matrix with at least two columns and two rows");
  if (x.some(row => row.some(v => !Number.isFinite(v)))) throw new RangeError("x must contain only finite values");
  const classes = Array.from(new Set(labels)).sort();
  if (classes.length < 2) throw new RangeError("multinomial y must contain at least two classes");
  const classIndex = new Map(classes.map((value, index) => [value, index]));
  const y = labels.map(value => classIndex.get(value)!);
  const kCount = classes.length, alpha = options.alpha ?? 1, grouped = (options.typeMultinomial ?? "ungrouped") === "grouped";
  if (!(alpha >= 0 && alpha <= 1)) throw new RangeError("alpha must be in [0, 1]");
  if (options.offset?.some(v => v !== 0)) throw new RangeError("multinomial offsets must be class-specific and are not supported");
  const intercept = options.intercept ?? true;
  const weights = options.weights ? Array.from(options.weights) : new Array<number>(n).fill(1);
  if (weights.length !== n || weights.some(v => !(v >= 0) || !Number.isFinite(v)) || sum(weights) <= 0) throw new RangeError("invalid weights");
  const w = weights.map(v => v * n / sum(weights));
  const penaltyRaw = normalizeVector(options.penaltyFactor, p, 1);
  if (penaltyRaw.some(v => !(v >= 0) || !Number.isFinite(v)) || sum(penaltyRaw) <= 0) throw new RangeError("invalid penalty.factor");
  const penalty = penaltyRaw.map(v => v * p / sum(penaltyRaw));
  const xMean = Array.from({ length: p }, (_, j) => intercept ? mean(x.map(row => row[j]!), w) : 0);
  const xScale = Array.from({ length: p }, (_, j) => {
    let v = 0; for (let i = 0; i < n; i++) v += w[i]! * (x[i]![j]! - xMean[j]!) ** 2;
    const scale = Math.sqrt(v / n);
    if (!(scale > 0)) throw new RangeError("x contains a constant column");
    return options.standardize === false ? 1 : scale;
  });
  const xs = x.map(row => row.map((v, j) => (v - xMean[j]!) / xScale[j]!));
  const classWeight = classes.map((_, k) => y.reduce((v, cls, i) => v + (cls === k ? w[i]! : 0), 0));
  const initialA = classWeight.map(v => Math.log(Math.max(v / n, 1e-15)));
  let center = 0; for (const v of initialA) center += v; center /= kCount;
  const aNull = intercept ? initialA.map(v => v - center) : new Array<number>(kCount).fill(0);
  const nullEta = xs.map(() => aNull.slice());
  const nullDev = 2 * multinomialObjective(xs, y, w, aNull, xs[0]!.map(() => new Array<number>(kCount).fill(0)), 0, alpha, penalty, grouped);
  const gradient = Array.from({ length: p }, () => new Array<number>(kCount).fill(0));
  let nullDenominator = 0; for (const v of aNull) nullDenominator += Math.exp(v);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < kCount; k++) {
      const prob = Math.exp(aNull[k]!) / nullDenominator;
      const residual = w[i]! * (prob - (y[i] === k ? 1 : 0)) / n;
      for (let j = 0; j < p; j++) gradient[j]![k] = gradient[j]![k]! + residual * xs[i]![j]!;
    }
  }
  const alphaForMax = alpha === 0 ? 0.001 : alpha;
  let lambdaMax = 0;
  for (let j = 0; j < p; j++) {
    let norm = 0;
    if (grouped) {
      for (let k = 0; k < kCount; k++) norm += gradient[j]![k]! ** 2;
      norm = Math.sqrt(norm);
    } else {
      for (let k = 0; k < kCount; k++) norm = Math.max(norm, Math.abs(gradient[j]![k]!));
    }
    if (penalty[j]! > 0) lambdaMax = Math.max(lambdaMax, norm / (alphaForMax * penalty[j]!));
  }
  const nlambda = options.nlambda ?? 100, minRatio = options.lambdaMinRatio ?? (n > p ? 1e-4 : 1e-2);
  if (!Number.isInteger(nlambda) || nlambda < 1 || !(minRatio > 0 && minRatio <= 1)) throw new RangeError("invalid lambda path controls");
  const lambdas = options.lambda ? Array.from(options.lambda) :
    Array.from({ length: nlambda }, (_, i) => lambdaMax * Math.exp(Math.log(minRatio) * i / Math.max(1, nlambda - 1)));
  if (!lambdas.length || lambdas.some((v, i) => !(v > 0) || (i > 0 && v > lambdas[i - 1]!))) throw new RangeError("lambda must be a decreasing positive sequence");
  const lower = normalizeVector(options.lowerLimits, p, -Infinity), upper = normalizeVector(options.upperLimits, p, Infinity);
  for (let j = 0; j < p; j++) {
    if (lower[j]! > 0 || lower[j]! > upper[j]!) throw new RangeError("invalid coefficient limits");
    lower[j] = lower[j]! * xScale[j]!; upper[j] = upper[j]! * xScale[j]!;
  }
  const maxit = options.maxit ?? 100000, thresh = options.thresh ?? 1e-10;
  const a0: number[][] = classes.map(() => [] as number[]), betaByClass: Record<string, number[][]> = Object.fromEntries(classes.map(name => [name, Array.from({ length: p }, () => [] as number[])]));
  const dfmat = classes.map(() => [] as number[]), devRatio: number[] = [], converged: boolean[] = [], kktResidual: number[] = [];
  let startA = aNull.slice(), startB = Array.from({ length: p }, () => new Array<number>(kCount).fill(0)), npasses = 0;
  const everActive = new Set<number>();
  for (const lambda of lambdas) {
    const fit = fitMultinomialOne(xs, y, w, startA, startB, lambda, alpha, penalty, grouped, lower, upper, maxit, thresh);
    const classDf = new Array<number>(kCount).fill(0);
    for (let j = 0; j < p; j++) for (let k = 0; k < kCount; k++) if (fit.beta[j]![k] !== 0) { classDf[k] = classDf[k]! + 1; everActive.add(j); }
    if (classDf.some(v => v > (options.dfmax ?? p + 1)) || everActive.size > (options.pmax ?? p)) break;
    startA = fit.a0.slice(); startB = fit.beta.map(row => row.slice()); npasses += fit.passes;
    const originalByClass = classes.map((_, k) => {
      const row = fit.beta.map((v, j) => v[k]! / xScale[j]!);
      let interceptValue = fit.a0[k]!;
      if (intercept) for (let j = 0; j < p; j++) interceptValue -= xMean[j]! * row[j]!;
      return [interceptValue, ...row];
    });
    for (let k = 0; k < kCount; k++) a0[k]!.push(originalByClass[k]![0]!);
    for (let k = 0; k < kCount; k++) for (let j = 0; j < p; j++) betaByClass[classes[k]!]![j]!.push(originalByClass[k]![j + 1]!);
    for (let k = 0; k < kCount; k++) dfmat[k]!.push(classDf[k]!);
    const fittedDev = 2 * multinomialObjective(xs, y, w, fit.a0, fit.beta, 0, alpha, penalty, grouped);
    devRatio.push(nullDev === 0 ? 0 : 1 - fittedDev / nullDev);
    converged.push(fit.converged);
    kktResidual.push(fit.kkt);
  }
  if (!a0.length) throw new RangeError("no lambda values satisfy dfmax and pmax");
  return { family: "multinomial", alpha, lambda: lambdas.slice(0, a0.length), a0, beta: betaByClass, dfmat,
    devRatio, nullDev, npasses, converged, kktResidual,
    model: { x: x.map(row => Array.from(row)), y: Array.from(labels), weights: w, offset: new Array<number>(n).fill(0),
      xMean, xScale, intercept, columns: p, classes, typeMultinomial: options.typeMultinomial ?? "ungrouped" } };
}

/**
 * Fit a penalized generalized linear model path. Equivalent to R's `glmnet::glmnet()`.
 *
 * @category Regression
 */
export function glmnet(x: readonly (readonly number[])[], y: readonly number[], options?: GlmnetOptions & { family?: "gaussian" | "binomial" | "poisson" }): GlmnetScalarResult;
export function glmnet(x: readonly (readonly number[])[], y: readonly string[], options: GlmnetOptions & { family: "binomial" }): GlmnetScalarResult;
export function glmnet(x: readonly (readonly number[])[], y: readonly string[], options: GlmnetOptions & { family: "multinomial" }): GlmnetMultinomialResult;
export function glmnet(x: readonly (readonly number[])[], y: readonly (number | string)[], options: GlmnetOptions = {}): GlmnetResult {
  const family = options.family ?? "gaussian";
  if (family === "multinomial") return glmnetMultinomial(x, y.map(String), options);
  if (y.some(v => typeof v !== "number")) {
    if (family !== "binomial") throw new TypeError("non-numeric y is supported only for binomial or multinomial families");
    const classes = Array.from(new Set(y.map(String))).sort();
    if (classes.length !== 2) throw new RangeError("binomial factor y must have exactly two classes");
    return glmnetScalar(x, y.map(v => String(v) === classes[1] ? 1 : 0), options);
  }
  return glmnetScalar(x, y as readonly number[], options);
}

function interpolate(fit: GlmnetScalarResult, s: number): { a0: number; beta: number[] } {
  const path = fit.lambda;
  if (s >= path[0]!) return { a0: fit.a0[0]!, beta: fit.beta[0]!.slice() };
  if (s <= path[path.length - 1]!) return { a0: fit.a0[path.length - 1]!, beta: fit.beta[path.length - 1]!.slice() };
  let k = 0; while (k + 1 < path.length && path[k + 1]! > s) k++;
  const t = (Math.log(s) - Math.log(path[k]!)) / (Math.log(path[k + 1]!) - Math.log(path[k]!));
  return { a0: fit.a0[k]! * (1 - t) + fit.a0[k + 1]! * t,
    beta: fit.beta[k]!.map((v, j) => v * (1 - t) + fit.beta[k + 1]![j]! * t) };
}

function interpolateMultinomial(fit: GlmnetMultinomialResult, s: number): { a0: number[]; beta: number[][] } {
  const path = fit.lambda, p = fit.model.columns, kCount = fit.model.classes.length;
  let left = 0, t = 0;
  if (s >= path[0]!) left = 0;
  else if (s <= path[path.length - 1]!) left = path.length - 1;
  else {
    while (left + 1 < path.length && path[left + 1]! > s) left++;
    t = (Math.log(s) - Math.log(path[left]!)) / (Math.log(path[left + 1]!) - Math.log(path[left]!));
  }
  const right = Math.min(path.length - 1, left + 1);
  const a0 = new Array<number>(kCount);
  const beta = Array.from({ length: p }, () => new Array<number>(kCount));
  for (let k = 0; k < kCount; k++) {
    a0[k] = fit.a0[k]![left]! * (1 - t) + fit.a0[k]![right]! * t;
    for (let j = 0; j < p; j++) {
      beta[j]![k] = fit.beta[fit.model.classes[k]!]![j]![left]! * (1 - t) +
        fit.beta[fit.model.classes[k]!]![j]![right]! * t;
    }
  }
  return { a0, beta };
}

/** Extract coefficients at selected penalty values. Equivalent to R's `coef.glmnet()`.
 *
 * @category Regression
 */
export function glmnetCoef(fit: GlmnetScalarResult, s?: number | readonly number[]): number[][];
export function glmnetCoef(fit: GlmnetMultinomialResult, s?: number | readonly number[]): Record<string, number[][]>;
export function glmnetCoef(fit: GlmnetResult, s?: number | readonly number[]): number[][] | Record<string, number[][]> {
  const values = s === undefined ? fit.lambda : typeof s === "number" ? [s] : Array.from(s);
  if (fit.family === "multinomial") {
    const out: Record<string, number[][]> = {};
    for (let k = 0; k < fit.model.classes.length; k++) {
      const name = fit.model.classes[k]!;
      out[name] = [
        values.map(value => interpolateMultinomial(fit, value).a0[k]!),
        ...Array.from({ length: fit.model.columns }, (_, j) =>
          values.map(value => interpolateMultinomial(fit, value).beta[j]![k]!)),
      ];
    }
    return out;
  }
  return values.map(v => { const result = interpolate(fit, v); return [result.a0, ...result.beta]; });
}

/** Predict from a penalized generalized linear model. Equivalent to R's `predict.glmnet()`.
 *
 * @category Regression
 */
export function glmnetPredict(
  fit: GlmnetScalarResult, newx: readonly (readonly number[])[], options?: GlmnetPredictOptions,
): number[][];
export function glmnetPredict(
  fit: GlmnetMultinomialResult, newx: readonly (readonly number[])[], options: GlmnetPredictOptions & { type: "class" },
): string[][];
export function glmnetPredict(
  fit: GlmnetMultinomialResult, newx: readonly (readonly number[])[], options?: GlmnetPredictOptions & { type?: "link" | "response" | "nonzero" },
): number[][][];
export function glmnetPredict(
  fit: GlmnetResult, newx: readonly (readonly number[])[], options: GlmnetPredictOptions = {},
): number[][] | number[][][] | string[][] {
  if (newx.some(r => r.length !== fit.model.columns)) throw new RangeError("newx has the wrong number of columns");
  const values = options.s === undefined ? fit.lambda.slice() :
    typeof options.s === "number" ? [options.s] : Array.from(options.s);
  const type = options.type ?? "link";
  if (fit.family === "multinomial") {
    if (options.offset?.some(v => v !== 0)) throw new RangeError("multinomial offsets must be class-specific");
    if (type === "nonzero") return values.map(s => {
      const result = interpolateMultinomial(fit, s);
      return fit.model.classes.map((_, k) => result.beta.map((row, j) => row[k] !== 0 ? j + 1 : 0).filter(v => v !== 0));
    });
    if (type === "class") return values.map(s => newx.map(row => {
      const result = interpolateMultinomial(fit, s);
      let best = 0, bestEta = -Infinity;
      for (let k = 0; k < fit.model.classes.length; k++) {
        let eta = result.a0[k]!;
        for (let j = 0; j < fit.model.columns; j++) eta += row[j]! * result.beta[j]![k]!;
        if (eta > bestEta) { bestEta = eta; best = k; }
      }
      return fit.model.classes[best]!;
    }));
    return values.map(s => newx.map(row => {
      const result = interpolateMultinomial(fit, s);
      const eta = result.a0.map((v, k) => {
        let out = v;
        for (let j = 0; j < fit.model.columns; j++) out += row[j]! * result.beta[j]![k]!;
        return out;
      });
      let maxEta = -Infinity; for (const v of eta) maxEta = Math.max(maxEta, v);
      let denominator = 0; for (const v of eta) denominator += Math.exp(v - maxEta);
      const probabilities = eta.map(v => Math.exp(v - maxEta) / denominator);
      return type === "response" ? probabilities : eta;
    }));
  }
  const offset = options.offset ?? new Array<number>(newx.length).fill(0);
  if (offset.length !== newx.length) throw new RangeError("offset length must match newx");
  if (type === "nonzero") return values.map(s => {
    const result = interpolate(fit, s), indices: number[] = [];
    for (let j = 0; j < result.beta.length; j++) if (result.beta[j] !== 0) indices.push(j + 1);
    return indices;
  });
  return values.map(s => {
    const result = interpolate(fit, s);
    return newx.map((row, i) => {
      const eta = result.a0 + offset[i]! + row.reduce((v, z, j) => v + z * result.beta[j]!, 0);
      if (type === "response") return inverseLink(eta, fit.family);
      if (type === "class") return inverseLink(eta, fit.family) >= 0.5 ? 1 : 0;
      return eta;
    });
  });
}

/** Cross-validate a penalized generalized linear model. Equivalent to R's `cv.glmnet()`.
 *
 * @category Regression
 */
function cvGlmnetMultinomial(
  x: readonly (readonly number[])[], y: readonly string[], options: CvGlmnetOptions,
): CvGlmnetResult {
  if (!options.foldid || options.foldid.length !== y.length) throw new RangeError("foldid is required and must match y");
  const foldid = Array.from(options.foldid), folds = Array.from(new Set(foldid)).sort((a, b) => a - b);
  if (folds.length < 3) throw new RangeError("at least three folds are required");
  const fit = glmnetMultinomial(x, y, options), classes = fit.model.classes;
  const foldFits: Array<{ test: number[]; fit: GlmnetMultinomialResult }> = [];
  let commonLength = fit.lambda.length;
  for (const fold of folds) {
    const train = y.map((_, i) => i).filter(i => foldid[i] !== fold);
    const test = y.map((_, i) => i).filter(i => foldid[i] === fold);
    const subOptions: GlmnetOptions = { ...options, lambda: fit.lambda,
      ...(options.weights === undefined ? {} : { weights: train.map(i => options.weights![i]!) }) };
    const sub = glmnetMultinomial(train.map(i => x[i]!), train.map(i => y[i]!), subOptions);
    commonLength = Math.min(commonLength, sub.lambda.length);
    foldFits.push({ test, fit: sub });
  }
  if (commonLength < 1) throw new Error("cross-validation folds have no common converged lambda");
  const lambda = fit.lambda.slice(0, commonLength);
  const predictions = Array.from({ length: y.length }, () =>
    Array.from({ length: lambda.length }, () => new Array<number>(classes.length).fill(NaN)));
  for (const foldFit of foldFits) {
    const pred = glmnetPredict(foldFit.fit, foldFit.test.map(i => x[i]!), { s: lambda, type: "response" }) as number[][][];
    for (let i = 0; i < foldFit.test.length; i++) for (let k = 0; k < lambda.length; k++)
      predictions[foldFit.test[i]!]![k] = pred[k]![i]!.slice();
  }
  const measure = options.typeMeasure ?? "deviance", grouped = options.grouped ?? true;
  if (measure === "auc") throw new RangeError("AUC cross-validation is not defined for multinomial responses");
  const observationLoss = (i: number, lambdaIndex: number): number => {
    const probs = predictions[i]![lambdaIndex]!, observed = classes.indexOf(y[i]!);
    if (measure === "class") {
      let best = 0; for (let k = 1; k < probs.length; k++) if (probs[k]! > probs[best]!) best = k;
      return best === observed ? 0 : 1;
    }
    if (measure === "mae" || measure === "mse") {
      let total = 0;
      for (let k = 0; k < probs.length; k++) {
        const d = probs[k]! - (k === observed ? 1 : 0);
        total += measure === "mae" ? Math.abs(d) : d * d;
      }
      return total / probs.length;
    }
    return -2 * Math.log(Math.max(1e-15, probs[observed]!));
  };
  const foldRows = folds.map(fold => y.map((_, i) => i).filter(i => foldid[i] === fold));
  const foldScores = lambda.map((_, k) => foldRows.map(rows => sum(rows.map(i => observationLoss(i, k))) / rows.length));
  const cvm = lambda.map((_, k) => grouped
    ? sum(foldScores[k]!)/folds.length
    : sum(y.map((_, i) => observationLoss(i, k))) / y.length);
  const cvsd = lambda.map((_, k) => {
    if (grouped) {
      const m = cvm[k]!;
      return Math.sqrt(sum(foldScores[k]!.map(v => (v - m) ** 2)) / (folds.length - 1) / folds.length);
    }
    const vals = y.map((_, i) => observationLoss(i, k)), m = sum(vals) / vals.length;
    return Math.sqrt(sum(vals.map(v => (v - m) ** 2)) / (vals.length - 1) / vals.length);
  });
  let min = 0; for (let k = 1; k < cvm.length; k++) if (cvm[k]! < cvm[min]!) min = k;
  const cutoff = cvm[min]! + cvsd[min]!;
  let one = min; for (let k = 0; k < lambda.length; k++) if (cvm[k]! <= cutoff) one = k;
  const nzero = lambda.map((_, k) => fit.dfmat.reduce((v, row) => v + row[k]!, 0));
  return { fit, lambda, cvm, cvsd, cvup: cvm.map((v, i) => v + cvsd[i]!),
    cvlo: cvm.map((v, i) => v - cvsd[i]!), nzero, lambdaMin: lambda[min]!, lambda1se: lambda[one]!, foldid,
    name: measure, ...(options.keep ? { fitPreval: predictions } : {}) };
}

/** Cross-validate a penalized generalized linear model. Equivalent to R's `cv.glmnet()`.
 *
 * @category Regression
 */
export function cvGlmnet(x: readonly (readonly number[])[], y: readonly number[], options: CvGlmnetOptions): CvGlmnetResult;
export function cvGlmnet(x: readonly (readonly number[])[], y: readonly string[], options: CvGlmnetOptions & { family: "binomial" | "multinomial" }): CvGlmnetResult;
export function cvGlmnet(
  x: readonly (readonly number[])[], y: readonly (number | string)[], options: CvGlmnetOptions,
): CvGlmnetResult {
  if (options.family === "multinomial") return cvGlmnetMultinomial(x, y.map(String), options);
  if (y.some(v => typeof v !== "number")) {
    if (options.family !== "binomial") throw new TypeError("non-numeric y is supported only for binomial or multinomial families");
    const classes = Array.from(new Set(y.map(String))).sort();
    if (classes.length !== 2) throw new RangeError("binomial factor y must have exactly two classes");
    return cvGlmnet(x, y.map(v => String(v) === classes[1] ? 1 : 0), options);
  }
  const numericY = y as readonly number[];
  if (!options.foldid || options.foldid.length !== numericY.length) throw new RangeError("foldid is required and must match y");
  const foldid = Array.from(options.foldid), folds = Array.from(new Set(foldid)).sort((a,b)=>a-b);
  if (folds.length < 3) throw new RangeError("at least three folds are required");
  const fit = glmnetScalar(x, numericY, options), measures: number[][] = [];
  const foldFits: Array<{ test: number[]; fit: GlmnetScalarResult }> = [];
  let commonLength = fit.lambda.length;
  for (const fold of folds) {
    const train = numericY.map((_,i)=>i).filter(i=>foldid[i]!==fold), test = numericY.map((_,i)=>i).filter(i=>foldid[i]===fold);
    const subx=train.map(i=>x[i]!), suby=train.map(i=>numericY[i]!);
    const subOptions: GlmnetOptions = {...options, lambda: fit.lambda,
      ...(options.weights === undefined ? {} : { weights: train.map(i=>options.weights![i]!) }),
      ...(options.offset === undefined ? {} : { offset: train.map(i=>options.offset![i]!) })};
    const sub=glmnetScalar(subx,suby,subOptions);
    commonLength = Math.min(commonLength, sub.lambda.length);
    foldFits.push({ test, fit: sub });
  }
  if (commonLength < 1) throw new Error("cross-validation folds have no common converged lambda");
  const lambda = fit.lambda.slice(0, commonLength);
  const predictions = Array.from({length:numericY.length},()=>new Array<number>(lambda.length).fill(NaN));
  for (const foldFit of foldFits) {
    const pred=glmnetPredict(foldFit.fit,foldFit.test.map(i=>x[i]!),{s:lambda,type:"response",...(options.offset === undefined ? {} : { offset: foldFit.test.map(i=>options.offset![i]!) })});
    for(let i=0;i<foldFit.test.length;i++) for(let k=0;k<lambda.length;k++) predictions[foldFit.test[i]!]![k]=pred[k]![i]!;
  }
  const grouped=options.grouped??true;
  let measure = options.typeMeasure ?? (fit.family === "gaussian" ? "mse" : "deviance");
  const foldScores = folds.map(fold => numericY.map((_,i)=>i).filter(i=>foldid[i]===fold));
  const warnings: string[] = [];
  if (measure === "auc" && (foldScores.some(rows => rows.length < 10) ||
      foldScores.some(rows => !rows.some(i => numericY[i]! >= 0.5) || !rows.some(i => numericY[i]! < 0.5)))) {
    warnings.push("AUC requires at least ten observations and both classes in every fold; using deviance instead.");
    measure = "deviance";
  }
  const score = (indices: readonly number[], k: number): number => {
    if (measure === "auc") {
      let concordant = 0, ties = 0, pairs = 0;
      for (const i of indices) if (numericY[i]! >= 0.5) for (const j of indices) if (numericY[j]! < 0.5) {
        pairs++;
        if (predictions[i]![k]! > predictions[j]![k]!) concordant++;
        else if (predictions[i]![k] === predictions[j]![k]) ties++;
      }
      return pairs === 0 ? NaN : 1 - (concordant + ties / 2) / pairs;
    }
    let total = 0;
    for (const i of indices) {
      const observed = numericY[i]!, predicted = predictions[i]![k]!;
      if (measure === "mae") total += Math.abs(predicted - observed);
      else if (measure === "class") total += (predicted >= 0.5) === (observed >= 0.5) ? 0 : 1;
      else if (measure === "deviance" && fit.family !== "gaussian") {
        const mu = Math.max(1e-15, Math.min(fit.family === "binomial" ? 1 - 1e-15 : Infinity, predicted));
        if (fit.family === "binomial") {
          total += 2 * ((observed > 0 ? observed * Math.log(observed / mu) : 0) +
            (observed < 1 ? (1 - observed) * Math.log((1 - observed) / (1 - mu)) : 0));
        } else total += 2 * (observed === 0 ? mu : observed * Math.log(observed / mu) - (observed - mu));
      } else total += (predicted - observed) ** 2;
    }
    return total / indices.length;
  };
  for (let k=0;k<lambda.length;k++) measures.push(foldScores.map(indices=>score(indices,k)));
  const cvm=lambda.map((_,k)=>grouped
    ? sum(measures[k]!)/folds.length
    : score(numericY.map((_,i)=>i),k));
  const cvsd=lambda.map((_,k)=>{
    if(grouped){const m=cvm[k]!;return Math.sqrt(sum(measures[k]!.map(v=>(v-m)**2))/(folds.length-1)/folds.length);}
    const vals=numericY.map((_,i)=> {
      const observed=numericY[i]!, predicted=predictions[i]![k]!;
      if(measure==="mae") return Math.abs(predicted-observed);
      if(measure==="class") return (predicted>=0.5)===(observed>=0.5)?0:1;
      if(measure==="deviance" && fit.family === "binomial") {
        const mu=Math.max(1e-15,Math.min(1-1e-15,predicted));
        return 2*((observed>0?observed*Math.log(observed/mu):0)+(observed<1?(1-observed)*Math.log((1-observed)/(1-mu)):0));
      }
      if(measure==="deviance" && fit.family === "poisson") {
        const mu=Math.max(1e-15,predicted);
        return 2*(observed===0?mu:observed*Math.log(observed/mu)-(observed-mu));
      }
      return (predicted-observed)**2;
    });
    const m=sum(vals)/vals.length;
    return Math.sqrt(sum(vals.map(v=>(v-m)**2))/(vals.length-1)/vals.length);
  });
  let min=0;for(let k=1;k<cvm.length;k++)if(cvm[k]!<cvm[min]!)min=k;
  const cutoff=cvm[min]!+cvsd[min]!;
  let one=min;for(let k=0;k<lambda.length;k++)if(cvm[k]!<=cutoff)one=k;
  return {fit,lambda,cvm,cvsd,cvup:cvm.map((v,i)=>v+cvsd[i]!),cvlo:cvm.map((v,i)=>v-cvsd[i]!),
    nzero:fit.df.slice(0, lambda.length),lambdaMin:lambda[min]!,lambda1se:lambda[one]!,foldid,name:measure,warnings,
    ...(options.keep?{fitPreval:predictions}:{})};
}
