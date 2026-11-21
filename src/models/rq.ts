// Quantile regression. The linear-programming formulation follows Koenker and Bassett (1978)
// and the primal-dual interior-point method of Portnoy and Koenker (1997).
// This implementation is independently derived from those published equations and public numerical output.

import { reported } from "../internal/warnings.js";
import { qr, qrCoef } from "../linalg/qr.js";
import { parseFormula } from "./formula.js";
import { design, type DesignContrast } from "./modelMatrix.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
import { pt, qt } from "../distributions/t.js";
import { qnorm } from "../distributions/normal.js";
import { pf } from "../distributions/f.js";

/** Algorithm used to fit a quantile-regression model.
 *
 * @category Regression
 */
export type RqMethod = "br" | "fn";

/** Options for {@link rq}.
 *
 * @category Regression
 */
export interface RqOptions {
  tau?: number | Sample;
  method?: RqMethod;
  weights?: Sample | string;
  contrasts?: Record<string, DesignContrast>;
  levels?: Record<string, readonly string[]>;
  maxit?: number;
  eps?: number;
}

/** Model data retained by a quantile-regression fit.
 *
 * @category Regression
 */
export interface RqModel {
  formula: string;
  x: number[][];
  y: number[];
  weights: number[];
  rows: number[];
  columnNames: string[];
  tau: number[];
  method: RqMethod;
}

/** Result returned by {@link rq}.
 *
 * @category Regression
 */
export interface RqResult {
  coefficients: Record<string, number | number[]>;
  fittedValues: number[] | number[][];
  residuals: number[] | number[][];
  rho: number | number[];
  converged: boolean;
  iterations: number;
  warnings: string[];
  model: RqModel;
}

function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(m[i]![k]!) > Math.abs(m[pivot]![k]!)) pivot = i;
    let rowScale = 1;
    for (let j = 0; j < n; j++) rowScale = Math.max(rowScale, Math.abs(m[pivot]![j]!));
    if (!(Math.abs(m[pivot]![k]!) > Number.EPSILON * rowScale)) {
      throw new RangeError("singular design matrix");
    }
    [m[k], m[pivot]] = [m[pivot]!, m[k]!];
    const d = m[k]![k]!;
    for (let j = k; j <= n; j++) m[k]![j]! /= d;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = m[i]![k]!;
      if (f === 0) continue;
      for (let j = k; j <= n; j++) m[i]![j]! -= f * m[k]![j]!;
    }
  }
  return m.map((row) => row[n]!);
}

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function cholesky(a: readonly number[][]): number[][] {
  const n = a.length;
  const l = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let value = a[i]![j]!;
      for (let k = 0; k < j; k++) value -= l[i]![k]! * l[j]![k]!;
      if (i === j) {
        if (!(value > 0) || !Number.isFinite(value)) throw new RangeError("normal equations are not positive definite");
        l[i]![j] = Math.sqrt(value);
      } else {
        l[i]![j] = value / l[j]![j]!;
      }
    }
  }
  return l;
}

function solveCholesky(l: readonly number[][], rhs: readonly number[]): number[] {
  const n = rhs.length;
  const x = Array.from(rhs);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) x[i]! -= l[i]![j]! * x[j]!;
    x[i]! /= l[i]![i]!;
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j < n; j++) x[i]! -= l[j]![i]! * x[j]!;
    x[i]! /= l[i]![i]!;
  }
  return x;
}

interface DualDirection {
  db: number[];
  dl: number[];
  du: number[];
  dbeta: number[];
}

function dualDirection(
  x: readonly number[][],
  b: readonly number[],
  lower: readonly number[],
  upper: readonly number[],
  rp: readonly number[],
  rd: readonly number[],
  rcLower: readonly number[],
  rcUpper: readonly number[],
): DualDirection {
  const n = b.length;
  const p = x[0]!.length;
  const inverseW = new Array<number>(n);
  const rhs = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const bi = b[i]!;
    const oneMinus = 1 - bi;
    if (!(bi > 0 && oneMinus > 0 && lower[i]! > 0 && upper[i]! > 0)) {
      throw new RangeError("invalid interior point in quantile regression");
    }
    const w = lower[i]! / bi + upper[i]! / oneMinus;
    inverseW[i] = 1 / w;
    rhs[i] = -rd[i]! - rcLower[i]! / bi + rcUpper[i]! / oneMinus;
  }

  const gram = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const projected = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    const wi = inverseW[i]!;
    for (let j = 0; j < p; j++) {
      const xj = x[i]![j]!;
      projected[j]! += xj * wi * rhs[i]!;
      for (let k = 0; k <= j; k++) gram[j]![k]! += xj * wi * x[i]![k]!;
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) gram[k]![j] = gram[j]![k]!;
    projected[j]! += rp[j]!;
  }
  const dbeta = solveCholesky(cholesky(gram), projected);
  const db = new Array<number>(n);
  const dl = new Array<number>(n);
  const du = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let value = rhs[i]!;
    for (let j = 0; j < p; j++) value -= x[i]![j]! * dbeta[j]!;
    db[i] = inverseW[i]! * value;
    dl[i] = (-rcLower[i]! - lower[i]! * db[i]!) / b[i]!;
    du[i] = (-rcUpper[i]! + upper[i]! * db[i]!) / (1 - b[i]!);
  }
  return { db, dl, du, dbeta };
}

function maxBoxStep(b: readonly number[], db: readonly number[]): number {
  let step = 1;
  for (let i = 0; i < b.length; i++) {
    if (db[i]! > 0) step = Math.min(step, (1 - b[i]!) / db[i]!);
    else if (db[i]! < 0) step = Math.min(step, -b[i]! / db[i]!);
  }
  return step;
}

function maxPositiveStep(v: readonly number[], dv: readonly number[]): number {
  let step = 1;
  for (let i = 0; i < v.length; i++) if (dv[i]! < 0) step = Math.min(step, -v[i]! / dv[i]!);
  return step;
}

/** Mehrotra predictor-corrector for the box-constrained dual regression-quantile LP. */
function fitFn(
  x: readonly number[][], y: readonly number[], tau: number, maxit: number, eps: number,
): { beta: number[]; dual: number[]; iterations: number } {
  const n = y.length;
  const p = x[0]!.length;
  const b = new Array<number>(n).fill(1 - tau);
  const lower = new Array<number>(n).fill(1);
  const upper = new Array<number>(n).fill(1);
  const beta = new Array<number>(p).fill(0);
  const h = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) h[j]! += (1 - tau) * x[i]![j]!;
  let iterations = 0;

  for (let it = 0; it < maxit; it++) {
    iterations = it + 1;
    const rp = new Array<number>(p).fill(0);
    const rd = new Array<number>(n);
    let rpScale = 1;
    let rdScale = 1;
    let gap = 0;
    let primalObjective = 0;
    let dualObjective = 0;
    for (let i = 0; i < n; i++) {
      dualObjective += y[i]! * b[i]!;
      gap += b[i]! * lower[i]! + (1 - b[i]!) * upper[i]!;
      for (let j = 0; j < p; j++) rp[j]! += x[i]![j]! * b[i]!;
      let fitted = 0;
      for (let j = 0; j < p; j++) fitted += x[i]![j]! * beta[j]!;
      rd[i] = fitted - lower[i]! + upper[i]! - y[i]!;
    }
    for (let j = 0; j < p; j++) {
      rp[j]! -= h[j]!;
      rpScale = Math.max(rpScale, Math.abs(h[j]!));
    }
    for (let i = 0; i < n; i++) rdScale = Math.max(rdScale, Math.abs(y[i]!));
    for (let i = 0; i < n; i++) {
      const residual = y[i]!;
      let fitted = 0;
      for (let j = 0; j < p; j++) fitted += x[i]![j]! * beta[j]!;
      const r = residual - fitted;
      primalObjective += r * (tau - (r < 0 ? 1 : 0));
    }
    const equalityNorm = rp.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / rpScale;
    const stationarityNorm = rd.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / rdScale;
    const gapNorm = gap / Math.max(1, Math.abs(primalObjective), Math.abs(dualObjective));
    if (Math.max(equalityNorm, stationarityNorm, gapNorm) <= eps) return { beta, dual: b, iterations };

    const rcLowerAffine = b.map((v, i) => v * lower[i]!);
    const rcUpperAffine = b.map((v, i) => (1 - v) * upper[i]!);
    const affine = dualDirection(x, b, lower, upper, rp, rd, rcLowerAffine, rcUpperAffine);
    const alphaPAff = Math.min(1, maxBoxStep(b, affine.db));
    const alphaDAff = Math.min(1, maxPositiveStep(lower, affine.dl), maxPositiveStep(upper, affine.du));
    let gapAffine = 0;
    for (let i = 0; i < n; i++) {
      const ba = b[i]! + alphaPAff * affine.db[i]!;
      const la = lower[i]! + alphaDAff * affine.dl[i]!;
      const ua = upper[i]! + alphaDAff * affine.du[i]!;
      gapAffine += ba * la + (1 - ba) * ua;
    }
    const mu = gap / (2 * n);
    const muAffine = gapAffine / (2 * n);
    const sigma = mu > 0 ? Math.max(0, Math.min(1, (muAffine / mu) ** 3)) : 0;
    const rcLower = b.map((v, i) => v * lower[i]! + affine.db[i]! * affine.dl[i]! - sigma * mu);
    const rcUpper = b.map((v, i) => (1 - v) * upper[i]! - affine.db[i]! * affine.du[i]! - sigma * mu);
    const step = dualDirection(x, b, lower, upper, rp, rd, rcLower, rcUpper);
    const alphaP = Math.min(1, 0.99995 * maxBoxStep(b, step.db));
    const alphaD = Math.min(1, 0.99995 * maxPositiveStep(lower, step.dl), 0.99995 * maxPositiveStep(upper, step.du));
    for (let i = 0; i < n; i++) {
      b[i]! += alphaP * step.db[i]!;
      lower[i]! += alphaD * step.dl[i]!;
      upper[i]! += alphaD * step.du[i]!;
    }
    for (let j = 0; j < p; j++) beta[j]! += alphaD * step.dbeta[j]!;
  }
  throw new Error("quantile regression interior-point method did not converge within maxit");
}

interface VertexDirection {
  slope: number;
  step: number;
  entering: number;
  direction: number[];
  leaving: number;
}

function directionalEdge(
  x: readonly number[][],
  y: readonly number[],
  weights: readonly number[],
  tau: number,
  beta: readonly number[],
  basis: readonly number[],
  leaving: number,
  sign: number,
): VertexDirection | undefined {
  const p = basis.length;
  const matrix = basis.map((i) => Array.from(x[i]!));
  const unit = new Array<number>(p).fill(0);
  unit[leaving] = sign;
  const direction = solveLinear(matrix, unit);
  const slopeTerms: Array<{ time: number; weight: number; index: number }> = [];
  let slope = 0;
  for (let i = 0; i < x.length; i++) {
    let fitted = 0;
    let movement = 0;
    for (let j = 0; j < p; j++) {
      fitted += x[i]![j]! * beta[j]!;
      movement -= x[i]![j]! * direction[j]!;
    }
    const residual = y[i]! - fitted;
    const scale = Math.max(1, Math.abs(y[i]!), Math.abs(fitted));
    if (Math.abs(residual) <= 32 * Number.EPSILON * scale) {
      if (movement > 0) slope += weights[i]! * tau * movement;
      else if (movement < 0) slope += weights[i]! * (tau - 1) * movement;
      continue;
    }
    slope += weights[i]! * movement * (tau - (residual < 0 ? 1 : 0));
    if (movement !== 0) {
      const time = -residual / movement;
      if (time > 32 * Number.EPSILON * Math.max(1, Math.abs(time))) {
        slopeTerms.push({ time, weight: weights[i]! * Math.abs(movement), index: i });
      }
    }
  }
  if (!(slope < 0) || slopeTerms.length === 0) return undefined;
  slopeTerms.sort((a, b) => a.time - b.time || a.index - b.index);
  let accumulated = 0;
  const target = -slope;
  let step = slopeTerms[slopeTerms.length - 1]!.time;
  for (const term of slopeTerms) {
    accumulated += term.weight;
    if (accumulated >= target) {
      step = term.time;
      break;
    }
  }
  const tolerance = 128 * Number.EPSILON * Math.max(1, Math.abs(step));
  const tied = slopeTerms.filter((term) => Math.abs(term.time - step) <= tolerance);
  for (const term of tied) {
    const candidate = basis.filter((_, j) => j !== leaving).concat(term.index);
    if (new Set(candidate).size !== p) continue;
    if (qr(candidate.map((i) => x[i]!)).rank === p) {
      return { slope, step, entering: term.index, direction, leaving };
    }
  }
  return undefined;
}

/** Vertex-to-vertex edge descent for the weighted check-loss objective. */
function fitBr(
  x: readonly number[][], y: readonly number[], weights: readonly number[], tau: number, maxit: number,
): { beta: number[]; iterations: number } {
  const n = y.length;
  const p = x[0]!.length;
  const leastSquares = qrCoef(qr(x), y);
  const residuals = y.map((v, i) => v - dot(x[i]!, leastSquares));
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    Math.abs(residuals[a]!) - Math.abs(residuals[b]!) || a - b);
  const basis: number[] = [];
  for (const i of order) {
    const trial = basis.concat(i);
    if (qr(trial.map((row) => x[row]!)).rank === trial.length) basis.push(i);
    if (basis.length === p) break;
  }
  if (basis.length !== p) throw new RangeError("could not construct a full-rank initial quantile-regression basis");
  let beta = solveLinear(basis.map((i) => Array.from(x[i]!)), basis.map((i) => y[i]!));
  const seen = new Set<string>();
  for (let iteration = 0; iteration < maxit; iteration++) {
    const key = basis.slice().sort((a, b) => a - b).join(",");
    if (seen.has(key)) throw new Error("quantile regression vertex walk cycled");
    seen.add(key);
    let best: VertexDirection | undefined;
    for (let j = 0; j < p; j++) {
      for (const sign of [1, -1]) {
        const edge = directionalEdge(x, y, weights, tau, beta, basis, j, sign);
        if (edge === undefined) continue;
        // Bland's deterministic entering/leaving order prevents cycling across
        // zero-length pivots at degenerate vertices.
        if (best === undefined || edge.entering < best.entering ||
          (edge.entering === best.entering && basis[edge.leaving]! < basis[best.leaving]!)) {
          best = edge;
        }
      }
    }
    if (best === undefined) {
      const fitted = x.map((row) => dot(row, beta));
      const residual = y.map((value, i) => value - fitted[i]!);
      const zeroRows = residual.map((value, i) => ({
        index: i,
        zero: Math.abs(value) <= 64 * Number.EPSILON * Math.max(1, Math.abs(y[i]!), Math.abs(fitted[i]!)),
      })).filter((item) => item.zero && !basis.includes(item.index)).map((item) => item.index);
      if (zeroRows.length === 0 || residual.every((value, i) =>
        Math.abs(value) <= 64 * Number.EPSILON * Math.max(1, Math.abs(y[i]!), Math.abs(fitted[i]!)))) {
        return { beta, iterations: iteration + 1 };
      }

      // Degenerate pivot: exchange an additional exact-fit observation into the
      // basis without moving beta. This exposes descent edges hidden by tied zeros.
      let swap: { basis: number[]; beta: number[] } | undefined;
      const leavingOrder = Array.from({ length: p }, (_, j) => j)
        .sort((a, b) => basis[a]! - basis[b]!);
      // Bland's rule also applies to zero-length exchanges: smallest entering
      // observation first, then smallest leaving basic observation.
      for (const entering of zeroRows) {
        for (const leaving of leavingOrder) {
          const candidateBasis = basis.filter((_, j) => j !== leaving).concat(entering);
          if (new Set(candidateBasis).size !== p) continue;
          const candidateKey = candidateBasis.slice().sort((a, b) => a - b).join(",");
          if (seen.has(candidateKey) || qr(candidateBasis.map((i) => x[i]!)).rank !== p) continue;
          const candidateBeta = solveLinear(candidateBasis.map((i) => Array.from(x[i]!)), candidateBasis.map((i) => y[i]!));
          let hasDescent = false;
          for (let j = 0; j < p && !hasDescent; j++) for (const sign of [1, -1]) {
            const edge = directionalEdge(x, y, weights, tau, candidateBeta, candidateBasis, j, sign);
            if (edge !== undefined) { hasDescent = true; break; }
          }
          if (hasDescent) {
            swap = { basis: candidateBasis, beta: candidateBeta };
            break;
          }
        }
        if (swap !== undefined) break;
      }
      if (swap === undefined) return { beta, iterations: iteration + 1 };
      basis.splice(0, basis.length, ...swap.basis);
      beta = swap.beta;
      continue;
    }
    const nextBasis = basis.filter((_, j) => j !== best!.leaving).concat(best.entering);
    const nextBeta = solveLinear(nextBasis.map((i) => Array.from(x[i]!)), nextBasis.map((i) => y[i]!));
    const currentLoss = x.reduce((sum, row, i) => {
      const r = y[i]! - dot(row, beta);
      return sum + weights[i]! * r * (tau - (r < 0 ? 1 : 0));
    }, 0);
    const nextLoss = x.reduce((sum, row, i) => {
      const r = y[i]! - dot(row, nextBeta);
      return sum + weights[i]! * r * (tau - (r < 0 ? 1 : 0));
    }, 0);
    const objectiveTolerance = 1e-12 * Math.max(1, Math.abs(currentLoss), Math.abs(nextLoss));
    const objectiveDecreased = nextLoss < currentLoss - objectiveTolerance;
    // A pivot with no numerically resolvable decrease is still necessary at a
    // degenerate vertex. Bland ordering and the visited-basis guard provide
    // deterministic anti-cycling; the objective comparison is diagnostic only.
    void objectiveDecreased;
    basis.splice(0, basis.length, ...nextBasis);
    beta = nextBeta;
  }
  throw new Error("quantile regression vertex walk did not converge within maxit");
}

function fitOne(
  x: readonly number[][], y: readonly number[], weights: readonly number[], tau: number,
  method: RqMethod, maxit: number, eps: number,
): { beta: number[]; fitted: number[]; residuals: number[]; rho: number; converged: boolean; iterations: number } {
  const n = y.length;
  const p = x[0]!.length;
  if (n === 0 || p === 0) throw new RangeError("the design matrix must have at least one column and one row");
  if (n < p) throw new RangeError("singular design matrix");
  if (qr(x).rank < p) throw new RangeError("singular design matrix");

  const weightScale = weights.reduce((m, v) => Math.max(m, v), 0);
  const yScale = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const columnScale = new Array<number>(p).fill(0);
  for (const row of x) for (let j = 0; j < p; j++) columnScale[j] = Math.max(columnScale[j]!, Math.abs(row[j]!));
  if (columnScale.some((v) => !(v > 0) || !Number.isFinite(v))) throw new RangeError("singular design matrix");
  const normalizedX = x.map((row, i) => row.map((v, j) => (weights[i]! / weightScale) * (v / columnScale[j]!)));
  const normalizedY = y.map((v, i) => (weights[i]! / weightScale) * (v / yScale));

  let normalizedBeta: number[];
  let iterations: number;
  if (p === 1 && x.every((row) => row[0] === x[0]![0])) {
    const scale = x[0]![0]!;
    const quantile = scale > 0 ? tau : 1 - tau;
    const ordered = y.map((value, i) => ({ value: value / scale, weight: weights[i]! }))
      .sort((a, b) => a.value - b.value);
    const total = ordered.reduce((sum, item) => sum + item.weight, 0);
    let cumulative = 0;
    let estimate = ordered[0]!.value;
    for (const item of ordered) {
      cumulative += item.weight;
      estimate = item.value;
      if (cumulative >= quantile * total) break;
    }
    normalizedBeta = [estimate * columnScale[0]! / yScale];
    iterations = ordered.length;
  } else if (method === "br") {
    const fit = fitBr(normalizedX, normalizedY, new Array<number>(n).fill(1), tau, maxit);
    normalizedBeta = fit.beta;
    iterations = fit.iterations;
  } else {
    const fit = fitFn(normalizedX, normalizedY, tau, maxit, eps);
    normalizedBeta = fit.beta;
    iterations = fit.iterations;
    // Move the central-path estimate to a nearby vertex when its dual certificate
    // verifies the same optimum. This is a bounded greedy basis selection, not enumeration.
    const residual = normalizedY.map((v, i) => v - dot(normalizedX[i]!, normalizedBeta));
    const ordered = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
      Math.abs(residual[a]!) - Math.abs(residual[b]!) || a - b);
    const basis: number[] = [];
    for (const i of ordered) {
      const trial = basis.concat(i);
      if (qr(trial.map((row) => normalizedX[row]!)).rank === trial.length) basis.push(i);
      if (basis.length === p) break;
    }
    if (basis.length === p) {
      try {
        const candidate = solveLinear(basis.map((i) => Array.from(normalizedX[i]!)), basis.map((i) => normalizedY[i]!));
        const oldLoss = normalizedX.reduce((sum, row, i) => {
          const r = normalizedY[i]! - dot(row, normalizedBeta);
          return sum + r * (tau - (r < 0 ? 1 : 0));
        }, 0);
        const candidateResidual = normalizedY.map((v, i) => v - dot(normalizedX[i]!, candidate));
        const newLoss = candidateResidual.reduce((sum, r) => sum + r * (tau - (r < 0 ? 1 : 0)), 0);
        let dualObjective = 0;
        let signCompatible = true;
        const residualScale = candidateResidual.reduce((m, v) => Math.max(m, Math.abs(v)), 1);
        for (let i = 0; i < n; i++) {
          const ai = fit.dual[i]!;
          dualObjective += normalizedY[i]! * ai;
           if (candidateResidual[i]! > 1e-8 * residualScale && ai < 1 - 1e-7) signCompatible = false;
          if (candidateResidual[i]! < -1e-8 * residualScale && ai > 1e-7) signCompatible = false;
        }
        const equalityResidual = new Array<number>(p).fill(0);
        for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) {
          equalityResidual[j]! += normalizedX[i]![j]! * (fit.dual[i]! - (1 - tau));
        }
        const dualEquality = equalityResidual.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        dualObjective -= (1 - tau) * normalizedY.reduce((sum, value) => sum + value, 0);
        const certificate = signCompatible &&
          dualEquality <= 1e-8 * Math.max(1, ...normalizedX[0]!.map((_, j) => Math.abs(
            normalizedX.reduce((sum, row) => sum + row[j]!, 0),
          ))) &&
          Math.abs(newLoss - dualObjective) <= 1e-8 * Math.max(1, Math.abs(newLoss), Math.abs(dualObjective));
        if (certificate && newLoss <= oldLoss + 1e-12 * Math.max(1, Math.abs(oldLoss))) normalizedBeta = candidate;
      } catch {
        // Retain the converged central-path estimate if the nearby basis is numerically singular.
      }
    }
  }

  const beta = normalizedBeta.map((v, j) => v * yScale / columnScale[j]!);
  const fitted = x.map((row) => dot(row, beta));
  const residuals = y.map((v, i) => v - fitted[i]!);
  let rho = 0;
  for (let i = 0; i < n; i++) rho += weights[i]! * residuals[i]! * (tau - (residuals[i]! < 0 ? 1 : 0));
  return { beta, fitted, residuals, rho, converged: true, iterations };
}

/**
 * Fit a linear conditional quantile model. Equivalent to `quantreg::rq()` in R.
 * Uses the formula/model-matrix interface of other regression models.
 *
 * @param formula A formula such as `y ~ x`.
 * @param data A data frame of columns.
 * @param options Quantile, algorithm, and prior weights.
 * @example
 * ```ts
 * rq("y ~ x", { x: [1, 2, 3, 4], y: [2, 1, 4, 3] }, { tau: 0.5 });
 * ```
 * @category Regression
 */
export function rq(formula: string, data: DataFrame, options: RqOptions = {}): RqResult {
  const tauValues = typeof options.tau === "number" ? [options.tau] : options.tau === undefined ? [0.5] : Array.from(options.tau);
  if (tauValues.length === 0 || tauValues.some((v) => !(v > 0 && v < 1) || !Number.isFinite(v))) {
    throw new RangeError("tau must contain values strictly between 0 and 1");
  }
  const method = options.method ?? "br";
  if (method !== "br" && method !== "fn") throw new RangeError("method must be 'br' or 'fn'");
  const maxit = options.maxit ?? 100;
  const eps = options.eps ?? 1e-12;
  if (!Number.isInteger(maxit) || maxit < 1) throw new RangeError("maxit must be a positive integer");
  if (!(eps > 0) || !Number.isFinite(eps)) throw new RangeError("eps must be positive and finite");
  const d = design(parseFormula(formula), data, {
    ...(options.weights === undefined ? {} : { weights: options.weights }),
    ...(options.contrasts === undefined ? {} : { contrasts: options.contrasts }),
    ...(options.levels === undefined ? {} : { levels: options.levels }),
  });
  if (d.y === undefined) throw new TypeError("the formula must have a numeric response");
  const weights = d.frame.weights ?? new Array<number>(d.y.length).fill(1);
  if (weights.some((v) => !Number.isFinite(v) || v < 0)) throw new RangeError("weights must be non-negative and finite");
  const kept = d.y.map((v, i) => i).filter((i) => weights[i]! > 0);
  if (kept.length < d.x[0]!.length) throw new RangeError("singular design matrix");
  const x = kept.map((i) => d.x[i]!);
  const y = kept.map((i) => d.y![i]!);
  const w = kept.map((i) => weights[i]!);
  if (x.some((row) => row.some((v) => !Number.isFinite(v))) || y.some((v) => !Number.isFinite(v))) {
    throw new RangeError("x and y must contain only finite values");
  }
  const fits = tauValues.map((tau) => fitOne(x, y, w, tau, method, maxit, eps));
  const coefficients: Record<string, number | number[]> = {};
  d.colNames.forEach((name, j) => {
    coefficients[name] = tauValues.length === 1 ? fits[0]!.beta[j]! : fits.map((fit) => fit.beta[j]!);
  });
  const model: RqModel = { formula, x, y, weights: w, rows: kept.map((i) => d.frame.rows[i]!), columnNames: d.colNames, tau: tauValues, method };
  const warnings = [...d.warnings];
  if (fits.some((fit) => !fit.converged)) warnings.push("quantile regression did not converge within the iteration limit");
  const fittedValues = tauValues.length === 1 ? fits[0]!.fitted : fits.map((fit) => fit.fitted);
  const residuals = tauValues.length === 1 ? fits[0]!.residuals : fits.map((fit) => fit.residuals);
  const rho = tauValues.length === 1 ? fits[0]!.rho : fits.map((fit) => fit.rho);
  return reported("rq", {
    coefficients, fittedValues, residuals, rho, converged: fits.every((fit) => fit.converged),
    iterations: fits.reduce((m, fit) => Math.max(m, fit.iterations), 0), warnings, model,
  });
}

/**
 * Predict conditional quantiles for new observations. Equivalent to `quantreg::predict.rq()` in R.
 *
 * @category Regression
 */
export function rqPredict(fit: RqResult, newdata: DataFrame): number[] | number[][] {
  const rhs = fit.model.formula.slice(fit.model.formula.indexOf("~") + 1);
  const parsed = parseFormula("~ " + rhs);
  const d = design(parsed, newdata, { anyResponse: true, dropUnusedLevels: true });
  const matrix = d.x;
  const coefs = fit.model.tau.map((_, k) => fit.model.columnNames.map((name) => {
    const v = fit.coefficients[name]!;
    return Array.isArray(v) ? v[k]! : v;
  }));
  const values = coefs.map((beta) => matrix.map((row) => dot(row, beta)));
  return values.length === 1 ? values[0]! : values;
}

/** Options for rqSummary.
 * @category Regression
 */
export interface RqSummaryOptions { se?: "nid" | "iid" | "rank" | "ker" | "boot"; covariance?: boolean; level?: number; }
/** A coefficient row in an rq summary.
 * @category Regression
 */
export interface RqCoefficientSummary { tau: number; term: string; estimate: number; stdError: number; statistic: number; pValue: number; }
/** Result of rqSummary.
 * @category Regression
 */
export interface RqSummaryResult { coefficients: RqCoefficientSummary[]; covariance?: number[][][]; se: string; warnings: string[]; }
/** Options for confidence prediction intervals.
 * @category Regression
 */
export interface RqPredictOptions { interval?: "none" | "confidence"; type?: "none" | "direct" | "percentile"; level?: number; }
/** Result of confidence prediction.
 * @category Regression
 */
export interface RqPredictResult { fit: number[] | number[][]; lower?: number[] | number[][]; upper?: number[] | number[][]; level: number; type: string; }

function rqInverse(a: readonly number[][]): number[][] {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => +(i === j))]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(m[i]![k]!) > Math.abs(m[pivot]![k]!)) pivot = i;
    if (!(Math.abs(m[pivot]![k]!) > Number.EPSILON)) throw new RangeError("singular covariance matrix");
    [m[k], m[pivot]] = [m[pivot]!, m[k]!];
    const d = m[k]![k]!;
    for (let j = 0; j < 2 * n; j++) m[k]![j]! /= d;
    for (let i = 0; i < n; i++) if (i !== k) {
      const v = m[i]![k]!;
      for (let j = 0; j < 2 * n; j++) m[i]![j]! -= v * m[k]![j]!;
    }
  }
  return m.map((row) => row.slice(n));
}
function rqMul(a: readonly number[][], b: readonly number[][]): number[][] {
  return a.map((row) => b[0]!.map((_, j) => row.reduce((sum, v, k) => sum + v * b[k]![j]!, 0)));
}
const NID_DENSITY_EPS = 2 ** -26;
function rqBandwidth(n: number, tau: number, level: number): number {
  const z = qnorm(tau) as number;
  const critical = qnorm((1 + level) / 2) as number;
  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  return Math.cbrt((1.5 * phi * phi * critical * critical) / (n * (2 * z * z + 1)));
}
function rqBread(model: RqModel, tau: number, level: number, warnings?: string[]): number[][] {
  const h = rqBandwidth(model.y.length, tau, level);
  const minus = fitOne(model.x, model.y, model.weights, tau - h, model.method, 500, 1e-12).beta;
  const plus = fitOne(model.x, model.y, model.weights, tau + h, model.method, 500, 1e-12).beta;
  const p = model.columnNames.length;
  const bread = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  let nonPositive = 0;
  for (let i = 0; i < model.y.length; i++) {
    const row = model.x[i]!;
    const difference = dot(row, plus) - dot(row, minus);
    const density = difference > NID_DENSITY_EPS ? (2 * h) / (difference - NID_DENSITY_EPS) : 0;
    if (density === 0) nonPositive++;
    for (let j = 0; j < p; j++) for (let k = 0; k <= j; k++) bread[j]![k]! += model.weights[i]! * density * row[j]! * row[k]!;
  }
  if (nonPositive > 0) warnings?.push(`${nonPositive} non-positive fis`);
  for (let j = 0; j < p; j++) for (let k = 0; k < j; k++) bread[k]![j] = bread[j]![k]!;
  return bread;
}
function rqMeat(model: RqModel): number[][] {
  const p = model.columnNames.length;
  const meat = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < model.y.length; i++) {
    const row = model.x[i]!;
    for (let j = 0; j < p; j++) for (let k = 0; k <= j; k++) meat[j]![k]! += model.weights[i]! ** 2 * row[j]! * row[k]!;
  }
  for (let j = 0; j < p; j++) for (let k = 0; k < j; k++) meat[k]![j] = meat[j]![k]!;
  return meat;
}
function rqNidCovariance(model: RqModel, tau: number, level: number, warnings?: string[]): number[][] {
  const inv = rqInverse(rqBread(model, tau, level, warnings));
  const middle = rqMul(rqMul(inv, rqMeat(model)), inv);
  const scale = tau * (1 - tau);
  return middle.map((row) => row.map((v) => v * scale));
}

/** Coefficient summary with Hall–Sheather bandwidth and the nid sandwich covariance. Equivalent to R's `summary.rq()`.
 *
 * @category Regression
 */
export function rqSummary(fit: RqResult, options: RqSummaryOptions = {}): RqSummaryResult {
  for (const key of Object.keys(options)) if (!["se", "covariance", "level"].includes(key)) throw new TypeError("unused argument (" + key + ")");
  const model = fit.model;
  const se = options.se ?? (model.y.length <= 1000 ? "rank" : "nid");
  if (se !== "nid") throw new RangeError("rqSummary currently supports se = 'nid'; iid, rank, ker and boot remain unresolved");
  const level = options.level ?? 0.95;
  if (!(level > 0 && level < 1)) throw new RangeError("level must be between 0 and 1");
  const warnings = [...fit.warnings];
  const covariances = model.tau.map((tau) => rqNidCovariance(model, tau, level, warnings));
  const coefficients: RqCoefficientSummary[] = [];
  for (let k = 0; k < model.tau.length; k++) for (let j = 0; j < model.columnNames.length; j++) {
    const term = model.columnNames[j]!;
    const raw = fit.coefficients[term]!;
    const estimate = Array.isArray(raw) ? raw[k]! : raw;
    const stdError = Math.sqrt(covariances[k]![j]![j]!);
    const statistic = estimate / stdError;
    const pValue = 2 * (pt(-Math.abs(statistic), model.y.length - model.columnNames.length) as number);
    coefficients.push({ tau: model.tau[k]!, term, estimate, stdError, statistic, pValue });
  }
  return { coefficients, ...(options.covariance ? { covariance: covariances } : {}), se, warnings };
}

/** Confidence intervals for conditional quantile predictions using nid or direct quantile refits. Equivalent to R's `predict.rq()`.
 *
 * @category Regression
 */
export function rqPredictInterval(fit: RqResult, newdata: DataFrame, options: RqPredictOptions = {}): RqPredictResult {
  for (const key of Object.keys(options)) if (!["interval", "type", "level"].includes(key)) throw new TypeError("unused argument (" + key + ")");
  const interval = options.interval ?? "none";
  const type = options.type ?? "none";
  const level = options.level ?? 0.95;
  if (!(level > 0 && level < 1)) throw new RangeError("level must be between 0 and 1");
  const predicted = rqPredict(fit, newdata);
  if (interval === "none") return { fit: predicted, level, type };
  if (interval !== "confidence") throw new RangeError("interval must be 'none' or 'confidence'");
  if (type === "percentile") throw new RangeError("percentile prediction intervals require bootstrap inference");
  const model = fit.model;
  if (model.tau.length !== 1) throw new RangeError("confidence intervals currently require a single tau");
  const rhs = model.formula.slice(model.formula.indexOf("~") + 1);
  const matrix = design(parseFormula("~ " + rhs), newdata, { anyResponse: true, dropUnusedLevels: true }).x;
  const tau = model.tau[0]!;
  let lower: number[];
  let upper: number[];
  if (type === "direct") {
    const h = rqBandwidth(model.y.length, tau, level);
    if (!(tau - h > 0 && tau + h < 1)) throw new RangeError("direct interval bandwidth leaves the unit interval");
    const lo = fitOne(model.x, model.y, model.weights, tau - h, model.method, 500, 1e-12).beta;
    const hi = fitOne(model.x, model.y, model.weights, tau + h, model.method, 500, 1e-12).beta;
    lower = matrix.map((row) => dot(row, lo));
    upper = matrix.map((row) => dot(row, hi));
  } else if (type === "none") {
    const cov = rqNidCovariance(model, tau, level);
    const beta = model.columnNames.map((name) => fit.coefficients[name] as number);
    const critical = qt((1 + level) / 2, model.y.length - model.columnNames.length) as number;
    lower = [];
    upper = [];
    for (const row of matrix) {
      const cv = cov.map((r) => dot(r, row));
      const variance = dot(row, cv);
      const center = dot(row, beta);
      const half = critical * Math.sqrt(Math.max(0, variance));
      lower.push(center - half);
      upper.push(center + half);
    }
  } else throw new RangeError("type must be 'none', 'direct' or 'percentile'");
  return { fit: predicted, lower, upper, level, type };
}

/** Wald test of equality of slopes across the quantiles in a multiple-tau fit. Equivalent to R's `anova.rq()`.
 *
 * @category Regression
 */
/** Wald comparisons for nested models or slopes across multiple quantiles. Equivalent to R's `anova.rq()`.
 *
 * @category Regression
 */
export function rqAnova(fit: RqResult): RqWaldResult;
export function rqAnova(fit: RqResult, joint: true): RqWaldResult;
export function rqAnova(fit: RqResult, joint: false): RqWaldResult[];
export function rqAnova(fit: RqResult, joint: boolean): RqWaldResult | RqWaldResult[];
export function rqAnova(fit: RqResult, reduced: RqResult): RqWaldResult;
export function rqAnova(fit: RqResult, reducedOrJoint?: RqResult | boolean): RqWaldResult | RqWaldResult[] {
  if (typeof reducedOrJoint === "object" && reducedOrJoint !== null) {
    const model = fit.model;
    const smallModel = reducedOrJoint.model;
    if (model.tau.length !== 1 || smallModel.tau.length !== 1 || model.tau[0] !== smallModel.tau[0]) {
      throw new RangeError("nested Wald comparison requires two fits at the same single tau");
    }
    if (model.y.length !== smallModel.y.length || model.weights.some((w, i) => w !== smallModel.weights[i])) {
      throw new RangeError("nested Wald comparison requires the same observations and weights");
    }
    const omitted = model.columnNames.map((name, i) => ({ name, i })).filter(({ name }) => !smallModel.columnNames.includes(name));
    if (omitted.length === 0 || smallModel.columnNames.some((name) => !model.columnNames.includes(name))) {
      throw new RangeError("the second model must be a strict nested submodel of the first");
    }
    const covariance = rqNidCovariance(model, model.tau[0]!, 0.95);
    const indices = omitted.map((v) => v.i);
    const small = indices.map((i) => indices.map((j) => covariance[i]![j]!));
    const inv = rqInverse(small);
    const difference = omitted.map(({ name }) => fit.coefficients[name] as number);
    const weighted = inv.map((row) => row.reduce((sum, value, i) => sum + value * difference[i]!, 0));
    const statistic = difference.reduce((sum, value, i) => sum + value * weighted[i]!, 0);
    const df = omitted.length;
    const dfResidual = model.y.length - model.columnNames.length;
    const fStatistic = statistic / df;
    return { statistic: fStatistic, df, dfResidual, pValue: pf(fStatistic, df, dfResidual, { lowerTail: false }) as number, method: "Wald" };
  }
  const model = fit.model;
  const tested = Array.from({ length: model.columnNames.length - 1 }, (_, j) => j + 1);
  if (reducedOrJoint === false) return tested.map((j) => rqMultiTauWald(fit, [j]));
  return rqMultiTauWald(fit, tested);
}

/** Result of a quantile-regression Wald comparison.
 * @category Regression
 */
export interface RqWaldResult {
  statistic: number;
  df: number;
  dfResidual: number;
  pValue: number;
  method: "Wald";
}

function rqMultiTauWald(fit: RqResult, tested: number[]): RqWaldResult {
  const model = fit.model;
  const p = model.columnNames.length;
  const m = model.tau.length;
  if (m < 2) throw new RangeError("Wald anova requires a multiple-tau fit");
  if (tested.length === 0) throw new RangeError("Wald anova has no slope restrictions");
  const restrictions: number[][] = [];
  const difference: number[] = [];
  for (const j of tested) {
    const raw = fit.coefficients[model.columnNames[j]!]!;
    if (!Array.isArray(raw)) throw new RangeError("multiple-tau coefficients are required");
    for (let k = 1; k < m; k++) {
      const row = new Array<number>(p * m).fill(0);
      row[k * p + j] = 1;
      row[j] = -1;
      restrictions.push(row);
      difference.push(raw[k]! - raw[0]!);
    }
  }
  const q = restrictions.length;
  const bread = model.tau.map((tau) => rqInverse(rqBread(model, tau, 0.95)));
  const meat = rqMeat(model);
  const covariance = Array.from({ length: p * m }, () => new Array<number>(p * m).fill(0));
  for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) {
    const block = rqMul(rqMul(bread[a]!, meat), bread[b]!);
    const scale = Math.min(model.tau[a]!, model.tau[b]!) - model.tau[a]! * model.tau[b]!;
    for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) covariance[a * p + j]![b * p + k] = block[j]![k]! * scale;
  }
  const small = restrictions.map((r) => restrictions.map((c) => {
    let value = 0;
    for (let i = 0; i < r.length; i++) for (let j = 0; j < c.length; j++) value += r[i]! * covariance[i]![j]! * c[j]!;
    return value;
  }));
  const inv = rqInverse(small);
  const weighted = inv.map((row) => row.reduce((sum, value, i) => sum + value * difference[i]!, 0));
  const statistic = difference.reduce((sum, value, i) => sum + value * weighted[i]!, 0);
  const dfResidual = model.y.length - (tested.length + 1) * (m - 1);
  const fStatistic = statistic / q;
  return { statistic: fStatistic, df: q, dfResidual, pValue: pf(fStatistic, q, dfResidual, { lowerTail: false }) as number, method: "Wald" };
}
