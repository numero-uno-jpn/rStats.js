// Elastic-net regularized generalized linear models, derived from the published objective and public numerical output.
// The path solver uses a monotone proximal-gradient method; no glmnet or R implementation code is used.

export type GlmnetFamily = "gaussian" | "binomial" | "poisson";
export type GlmnetPredictType = "link" | "response" | "class" | "nonzero";

export interface GlmnetOptions {
  family?: GlmnetFamily;
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

export interface GlmnetResult {
  family: GlmnetFamily;
  alpha: number;
  lambda: number[];
  a0: number[];
  beta: number[][];
  df: number[];
  devRatio: number[];
  nullDev: number;
  npasses: number;
  converged: boolean[];
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

export interface GlmnetPredictOptions {
  s?: number | readonly number[];
  type?: GlmnetPredictType;
  offset?: readonly number[];
}

export interface CvGlmnetOptions extends GlmnetOptions {
  foldid: readonly number[];
  typeMeasure?: "deviance" | "mse" | "mae" | "class" | "auc";
  grouped?: boolean;
  keep?: boolean;
}

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
  fitPreval?: number[][];
}

const EPS = Number.EPSILON;

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
function fitOne(
  x: readonly (readonly number[])[], y: readonly number[], weights: readonly number[], offset: readonly number[],
  family: GlmnetFamily, alpha: number, lambda: number, start: number[], intercept: boolean,
  penalty: readonly number[], lower: readonly number[], upper: readonly number[], maxit: number, thresh: number,
): { a0: number; beta: number[]; eta: number[]; passes: number; converged: boolean } {
  const n = y.length, p = penalty.length;
  let a0 = start[0] ?? 0;
  const beta = start.slice(1);
  let eta = y.map((_, i) => a0 + offset[i]! + x[i]!.reduce((v, z, j) => v + z * beta[j]!, 0));
  let objective = loss(y, eta, weights, family);
  for (let j = 0; j < p; j++) objective += lambda * penalty[j]! * (alpha * Math.abs(beta[j]!) + (1 - alpha) * beta[j]! ** 2 / 2);
  let converged = false, passes = 0;
  let previous = new Array<number>(p + 1).fill(0);
  for (let it = 0; it < maxit; it++) {
    passes++;
    const oldA = a0, oldB = beta.slice();
    let step = 1;
    let accepted = false;
    for (let back = 0; back < 50; back++) {
      const proposal = oldB.slice();
      let proposalA = oldA;
      const currentEta = y.map((_, i) => oldA + offset[i]! + x[i]!.reduce((v, z, j) => v + z * oldB[j]!, 0));
      const gradientA = intercept ? sum(y.map((v, i) => (inverseLink(currentEta[i]!, family) - v) * weights[i]!)) / n : 0;
      let lipschitz = 1;
      for (let j = 0; j < p; j++) {
        let g = 0, hBound = 0;
        for (let i = 0; i < n; i++) {
          const mu = inverseLink(currentEta[i]!, family);
          const d = family === "gaussian" ? 1 : family === "binomial" ? mu * (1 - mu) : mu;
          g += (mu - y[i]!) * weights[i]! * x[i]![j]!;
          hBound += d * weights[i]! * x[i]![j]! ** 2;
        }
        g /= n; hBound /= n;
        const denom = Math.max(hBound + lambda * (1 - alpha) * penalty[j]!, 1e-12);
        proposal[j] = Math.max(lower[j]!, Math.min(upper[j]!,
          soft(oldB[j]! - step * g, step * lambda * alpha * penalty[j]!) / (1 + step * lambda * (1 - alpha) * penalty[j]!)));
        lipschitz = Math.max(lipschitz, hBound);
        void denom;
      }
      if (intercept) proposalA = oldA - step * gradientA;
      const nextEta = y.map((_, i) => proposalA + offset[i]! + x[i]!.reduce((v, z, j) => v + z * proposal[j]!, 0));
      let nextObjective = loss(y, nextEta, weights, family);
      for (let j = 0; j < p; j++) nextObjective += lambda * penalty[j]! * (alpha * Math.abs(proposal[j]!) + (1 - alpha) * proposal[j]! ** 2 / 2);
      if (Number.isFinite(nextObjective) && nextObjective <= objective + 1e-14) {
        a0 = proposalA; for (let j = 0; j < p; j++) beta[j] = proposal[j]!;
        eta = nextEta; objective = nextObjective; accepted = true; break;
      }
      step *= 0.5;
    }
    if (!accepted) break;
    let change = Math.abs(a0 - oldA);
    for (let j = 0; j < p; j++) change = Math.max(change, Math.abs(beta[j]! - oldB[j]!));
    if (change <= thresh * (1 + Math.max(Math.abs(a0), ...beta.map(Math.abs)))) { converged = true; break; }
    previous = [a0, ...beta];
    void previous;
  }
  return { a0, beta, eta, passes, converged };
}

export function glmnet(x: readonly (readonly number[])[], y: readonly number[], options: GlmnetOptions = {}): GlmnetResult {
  const n = y.length, p = x[0]?.length ?? 0;
  if (n < 2 || p < 2 || x.length !== n || x.some(r => r.length !== p)) throw new RangeError("x must be a rectangular matrix with at least two columns and two rows");
  if (y.some(v => !Number.isFinite(v)) || x.some(r => r.some(v => !Number.isFinite(v)))) throw new RangeError("x and y must contain only finite values");
  const family = options.family ?? "gaussian", alpha = options.alpha ?? 1;
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
  const lambdaMax = Math.max(...residualGradient.map((v, j) => pf[j]! > 0 ? v / (alphaForMax * pf[j]!) : 0));
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
    lower[j] *= xScale[j]!; upper[j] *= xScale[j]!;
  }
  const maxit = options.maxit ?? 100000, thresh = options.thresh ?? 1e-10;
  if (!Number.isInteger(maxit) || maxit < 1 || !(thresh > 0)) throw new RangeError("invalid convergence controls");
  const a0: number[] = [], beta: number[][] = [], df: number[] = [], devRatio: number[] = [], converged: boolean[] = [];
  const nullDev = deviance(y, eta0, w, family);
  let start = [y0, ...new Array<number>(p).fill(0)], npasses = 0;
  for (const lambda of lambdas) {
    const fit = fitOne(xs, y, w, offset, family, alpha, lambda, start, intercept, pf, lower, upper, maxit, thresh);
    start = [fit.a0, ...fit.beta]; npasses += fit.passes;
    a0.push(fit.a0);
    beta.push(fit.beta.map((v, j) => v / xScale[j]!));
    df.push(fit.beta.filter(v => v !== 0).length);
    devRatio.push(nullDev === 0 ? 0 : 1 - deviance(y, fit.eta, w, family) / nullDev);
    converged.push(fit.converged);
  }
  return { family, alpha, lambda: lambdas, a0, beta, df, devRatio, nullDev, npasses, converged,
    model: { x: x.map(r => Array.from(r)), y: Array.from(y), weights: w, offset, xMean, xScale, intercept, columns: p } };
}

function interpolate(fit: GlmnetResult, s: number): { a0: number; beta: number[] } {
  const path = fit.lambda;
  if (s >= path[0]!) return { a0: fit.a0[0]!, beta: fit.beta[0]!.slice() };
  if (s <= path[path.length - 1]!) return { a0: fit.a0[path.length - 1]!, beta: fit.beta[path.length - 1]!.slice() };
  let k = 0; while (k + 1 < path.length && path[k + 1]! > s) k++;
  const t = (Math.log(s) - Math.log(path[k]!)) / (Math.log(path[k + 1]!) - Math.log(path[k]!));
  return { a0: fit.a0[k]! * (1 - t) + fit.a0[k + 1]! * t,
    beta: fit.beta[k]!.map((v, j) => v * (1 - t) + fit.beta[k + 1]![j]! * t) };
}

export function glmnetCoef(fit: GlmnetResult, s?: number | readonly number[]): number[][] {
  const values = s === undefined ? fit.lambda : typeof s === "number" ? [s] : Array.from(s);
  return values.map(v => { const c = interpolate(fit, v); return [c.a0, ...c.beta]; });
}
export function glmnetPredict(
  fit: GlmnetResult, newx: readonly (readonly number[])[], options: GlmnetPredictOptions = {},
): number[][] {
  if (newx.some(r => r.length !== fit.model.columns)) throw new RangeError("newx has the wrong number of columns");
  const values = options.s === undefined ? [fit.lambda[fit.lambda.length - 1]!] :
    typeof options.s === "number" ? [options.s] : Array.from(options.s);
  const type = options.type ?? "link";
  const offset = options.offset ?? new Array<number>(newx.length).fill(0);
  if (offset.length !== newx.length) throw new RangeError("offset length must match newx");
  return values.map(s => {
    const c = interpolate(fit, s);
    return newx.map((row, i) => {
      const eta = c.a0 + offset[i]! + row.reduce((v, z, j) => v + z * c.beta[j]!, 0);
      if (type === "response") return inverseLink(eta, fit.family);
      if (type === "class") return inverseLink(eta, fit.family) >= 0.5 ? 1 : 0;
      if (type === "nonzero") return c.beta.some(v => v !== 0) ? 1 : 0;
      return eta;
    });
  });
}

export function cvGlmnet(x: readonly (readonly number[])[], y: readonly number[], options: CvGlmnetOptions): CvGlmnetResult {
  if (!options.foldid || options.foldid.length !== y.length) throw new RangeError("foldid is required and must match y");
  const foldid = Array.from(options.foldid), folds = Array.from(new Set(foldid)).sort((a,b)=>a-b);
  if (folds.length < 3) throw new RangeError("at least three folds are required");
  const fit = glmnet(x, y, options), lambda = fit.lambda, measures: number[][] = [], predictions = Array.from({length:y.length},()=>new Array<number>(lambda.length).fill(NaN));
  for (const fold of folds) {
    const train = y.map((_,i)=>i).filter(i=>foldid[i]!==fold), test = y.map((_,i)=>i).filter(i=>foldid[i]===fold);
    const subx=train.map(i=>x[i]!), suby=train.map(i=>y[i]!);
    const subOptions: GlmnetOptions = {...options, lambda, weights: options.weights ? train.map(i=>options.weights![i]!) : undefined,
      offset: options.offset ? train.map(i=>options.offset![i]!) : undefined};
    const sub=glmnet(subx,suby,subOptions);
    const pred=glmnetPredict(sub,test.map(i=>x[i]!),{s:lambda,type:"response",offset:options.offset?test.map(i=>options.offset![i]!):undefined});
    for(let i=0;i<test.length;i++) for(let k=0;k<lambda.length;k++) predictions[test[i]!]![k]=pred[k]![i]!;
    const err=lambda.map((_,k)=>test.reduce((v,i)=>v+((pred[k]![test.indexOf(i)]!-y[i]!)**2),0)/test.length);
    measures.push(err);
  }
  const grouped=options.grouped??true;
  const cvm=lambda.map((_,k)=>sum(measures.map(v=>v[k]!))/folds.length);
  const cvsd=lambda.map((_,k)=>{
    if(grouped){const m=cvm[k]!;return Math.sqrt(sum(measures.map(v=>(v[k]!-m)**2))/(folds.length-1)/folds.length);}
    const vals=y.map((v,i)=>(predictions[i]![k]!-v)**2);const m=sum(vals)/vals.length;
    return Math.sqrt(sum(vals.map(v=>(v-m)**2))/(vals.length-1)/vals.length);
  });
  let min=0;for(let k=1;k<cvm.length;k++)if(cvm[k]!<cvm[min]!)min=k;
  const cutoff=cvm[min]!+cvsd[min]!;
  let one=min;for(let k=0;k<lambda.length;k++)if(cvm[k]!<=cutoff)one=k;
  return {fit,lambda,cvm,cvsd,cvup:cvm.map((v,i)=>v+cvsd[i]!),cvlo:cvm.map((v,i)=>v-cvsd[i]!),
    nzero:fit.df,lambdaMin:lambda[min]!,lambda1se:lambda[one]!,foldid,
    ...(options.keep?{fitPreval:predictions}:{})};
}
