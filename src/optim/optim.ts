// General-purpose optimisation, R's optim() and optimHess(): Nelder-Mead, BFGS (variable metric) and CG (conjugate
// gradients) are J. C. Nash's Algorithms 19, 21 and 22 ("Compact Numerical Methods for Computers", 2nd ed., Adam
// Hilger, 1990) with R's details as described in oracle/optim-behaviour.md; L-BFGS-B is the Netlib code of Zhu, Byrd,
// Lu and Nocedal (src/optim/lbfgsb.ts); SANN is Bélisle's simulated annealing (C. J. P. Bélisle, "Convergence
// theorems for a class of simulated annealing algorithms on R^d", J. Appl. Probab. 29 (1992) 885-895) with R's random
// numbers; Brent is optimize(). Written for rStats.js from the specification (no R code was read or used).

import { optimize } from "../numerics/integrate.js";
import { normRand, unifRand } from "../random/rng.js";
import { lbfgsb } from "./lbfgsb.js";

/**
 * Methods of {@link optim}
 *
 * @category Numerical methods
 */
export type OptimMethod = "Nelder-Mead" | "BFGS" | "CG" | "L-BFGS-B" | "SANN" | "Brent";

/**
 * Control parameters of {@link optim} (R's `control`, in camelCase)
 *
 * @category Numerical methods
 */
export interface OptimControl {
  /** Maximum number of iterations. Default 500 for Nelder-Mead, 10000 for SANN, 100 otherwise. */
  maxit?: number;
  /** Relative convergence tolerance. Default `sqrt(eps)`. */
  reltol?: number;
  /** Absolute convergence tolerance (stop when the value falls to it). Default `-Infinity`. */
  abstol?: number;
  /** Scaling of the parameters: the optimisation is on `par / parscale`. Default 1. */
  parscale?: number | readonly number[];
  /** Scaling of the objective: `fn / fnscale` is minimised (negative to maximise). Default 1. */
  fnscale?: number;
  /** Steps of the finite-difference gradient, in the scaled parameters. Default 1e-3. */
  ndeps?: number | readonly number[];
  /** Nelder-Mead reflection factor. Default 1. */
  alpha?: number;
  /** Nelder-Mead contraction factor. Default 0.5. */
  beta?: number;
  /** Nelder-Mead expansion factor. Default 2. */
  gamma?: number;
  /** CG update: 1 Fletcher-Reeves (default), 2 Polak-Ribière, 3 Beale-Sorenson. */
  type?: number;
  /** L-BFGS-B: number of corrections kept. Default 5. */
  lmm?: number;
  /** L-BFGS-B: relative reduction tolerance in units of the machine epsilon. Default 1e7. */
  factr?: number;
  /** L-BFGS-B: tolerance on the projected gradient. Default 0. */
  pgtol?: number;
  /** SANN: starting temperature. Default 10. */
  temp?: number;
  /** SANN: evaluations per temperature. Default 10. */
  tmax?: number;
}

/**
 * Options of {@link optim}
 *
 * @category Numerical methods
 */
export interface OptimOptions {
  /** Gradient of fn (numerical by central differences when omitted) */
  gr?: (par: number[]) => number[];
  /** Default `"Nelder-Mead"` */
  method?: OptimMethod;
  /** Lower bounds (L-BFGS-B and Brent), recycled. Default `-Infinity`. */
  lower?: number | readonly number[];
  /** Upper bounds (L-BFGS-B and Brent), recycled. Default `Infinity`. */
  upper?: number | readonly number[];
  /** Also return the numerically differentiated Hessian at the solution. Default `false`. */
  hessian?: boolean;
  /** Control parameters (R's `control`). See {@link OptimControl}. */
  control?: OptimControl;
}

/**
 * Result of {@link optim}
 *
 * @category Numerical methods
 */
export interface OptimResult {
  /** The best parameters found. */
  par: number[];
  /** fn at `par`. */
  value: number;
  /** Evaluations of fn and gr (NaN where R has NA) */
  counts: [number, number];
  /** 0 success, 1 iteration limit reached, 10 Nelder-Mead simplex degenerate, 51 / 52 L-BFGS-B warning / error */
  convergence: number;
  /** L-BFGS-B's final message; null for the other methods */
  message: string | null;
  /** The numerically differentiated Hessian at `par`, when `hessian` is true (array of rows). */
  hessian?: number[][];
  /** R's warnings */
  warnings: string[];
}

// R's constants (oracle/optim-behaviour.md, rule 5)
/** Scale at which a step is taken to change nothing */
const SHIFT = 10;
/** Sufficient-decrease factor of the line searches */
const DECREASE = 1e-4;
/** Step reduction of the line searches */
const REDUCTION = 0.2;
/** Growth of the first step of CG's next line search */
const GROWTH = 1.7;
/** Value used for a function value that is not finite (Nelder-Mead, SANN) */
const HUGE_VALUE = 1e35;
/** e - 1 to 8 digits, SANN's temperature schedule */
const E_MINUS_1 = 1.7182818;

function recycle(v: number | readonly number[] | undefined, n: number, dflt: number): number[] {
  if (v === undefined) return new Array<number>(n).fill(dflt);
  const a = typeof v === "number" ? [v] : v;
  if (a.length === 0) throw new RangeError("argument of length 0");
  return Array.from({ length: n }, (_, i) => a[i % a.length]!);
}

/** The scaled problem: p = par / parscale, f(p) = fn(p * parscale) / fnscale */
class Scaled {
  readonly n: number;
  constructor(
    private readonly fn: (par: number[]) => number,
    private readonly gr: ((par: number[]) => number[]) | undefined,
    readonly parscale: number[],
    readonly fnscale: number,
    readonly ndeps: number[],
  ) {
    this.n = parscale.length;
  }

  unscale(p: readonly number[]): number[] {
    return p.map((v, i) => v * this.parscale[i]!);
  }

  f(p: readonly number[]): number {
    return this.fn(this.unscale(p)) / this.fnscale;
  }

  /** Gradient in the scaled parameters; numerical steps are cut at the bounds when given (L-BFGS-B) */
  g(p: readonly number[], lower?: readonly number[], upper?: readonly number[]): number[] {
    const { n, parscale, fnscale } = this;
    if (this.gr !== undefined) {
      const gx = this.gr(this.unscale(p));
      if (gx.length !== n) throw new RangeError(`gradient in optim evaluated to length ${gx.length} not ${n}`);
      return gx.map((v, i) => (v * parscale[i]!) / fnscale);
    }
    const x = this.unscale(p);
    const slopes = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const eps = this.ndeps[i]!;
      let up = p[i]! + eps;
      let down = p[i]! - eps;
      let width: number;
      if (lower === undefined || upper === undefined) width = 2 * eps;
      else {
        let epsUp = eps;
        let epsDown = eps;
        if (up > upper[i]!) {
          up = upper[i]!;
          epsUp = up - p[i]!;
        }
        if (down < lower[i]!) {
          down = lower[i]!;
          epsDown = p[i]! - down;
        }
        width = epsUp + epsDown;
      }
      x[i] = up * parscale[i]!;
      const v1 = this.fn(x.slice()) / fnscale;
      x[i] = down * parscale[i]!;
      const v2 = this.fn(x.slice()) / fnscale;
      slopes[i] = (v1 - v2) / width;
      if (!Number.isFinite(slopes[i]!)) throw new Error(`non-finite finite-difference value [${i + 1}]`);
      x[i] = p[i]! * parscale[i]!;
    }
    return slopes;
  }
}

/** What a method returns, in the scaled parameters */
interface MethodResult {
  par: number[];
  value: number;
  fnEvals: number;
  gradEvals: number;
  code: number;
}

/** Replaces a value that is not finite by a large one (for the derivative-free methods) */
const orHuge = (v: number): number => (Number.isFinite(v) ? v : HUGE_VALUE);

/** Whether `from + amount` is indistinguishable from `from` at the scale of SHIFT (the rule "10 + x == 10 + y") */
const unchanged = (from: number, to: number): boolean => SHIFT + from === SHIFT + to;

interface Backtrack {
  /** Step length when the search ended (accepted, or the one at which nothing changed) */
  step: number;
  /** Whether a point was accepted (otherwise the trial point no longer differs from the start) */
  accepted: boolean;
  /** The last function value computed (or `lastValue` if none was) */
  value: number;
  evals: number;
}

/**
 * Backtracking line search shared by BFGS and CG: from `from` along `dir`, trial points `from + step dir` with the
 * step cut by REDUCTION until the value satisfies the sufficient-decrease test against `best` or the trial point no
 * longer moves any coordinate. `point` receives the last trial point.
 */
function backtrack(s: Scaled, from: readonly number[], dir: readonly number[], slope: number, best: number, firstStep: number, point: number[], lastValue: number): Backtrack {
  const n = from.length;
  let step = firstStep;
  let value = lastValue;
  let evals = 0;
  for (;;) {
    let same = 0;
    for (let i = 0; i < n; i++) {
      point[i] = from[i]! + step * dir[i]!;
      if (unchanged(from[i]!, point[i]!)) same++;
    }
    if (same === n) return { step, accepted: false, value, evals };
    value = s.f(point);
    evals++;
    if (Number.isFinite(value) && value <= best + slope * step * DECREASE) return { step, accepted: true, value, evals };
    step *= REDUCTION;
  }
}

/** Nelder-Mead simplex (Nash's Algorithm 19, with R's details from the specification) */
function simplexSearch(s: Scaled, start: readonly number[], reflect: number, contract: number, expand: number, abstol: number, reltol: number, maxit: number): MethodResult {
  const n = start.length;
  if (maxit <= 0) return { par: start.slice(), value: s.f(start), fnEvals: 0, gradEvals: NaN, code: 0 };
  const startValue = s.f(start);
  if (!Number.isFinite(startValue)) throw new Error("function cannot be evaluated at initial parameters");
  let evals = 1;
  const tolerance = reltol * (Math.abs(startValue) + reltol);
  // the vertices and their values (NaN: to be computed)
  const vertex: number[][] = [start.slice()];
  const value: number[] = [startValue];
  let initialStep = 0;
  for (const v of start) if (0.1 * Math.abs(v) > initialStep) initialStep = 0.1 * Math.abs(v);
  if (initialStep === 0) initialStep = 0.1;
  let extent = 0;
  for (let j = 0; j < n; j++) {
    const v = start.slice();
    let used = initialStep;
    v[j] = start[j]! + used;
    while (v[j] === start[j]) {
      used *= 10;
      v[j] = start[j]! + used;
    }
    extent += used;
    vertex.push(v);
    value.push(NaN);
  }
  let lastExtent = extent;
  let low = 0;
  let code = 0;
  const centroid = new Array<number>(n);
  do {
    for (let j = 0; j <= n; j++) {
      if (j !== low && Number.isNaN(value[j]!)) {
        value[j] = orHuge(s.f(vertex[j]!));
        evals++;
      }
    }
    let lowValue = value[low]!;
    let highValue = lowValue;
    let high = low;
    for (let j = 0; j <= n; j++) {
      if (j === low) continue;
      const v = value[j]!;
      if (v < lowValue) {
        low = j;
        lowValue = v;
      }
      if (v > highValue) {
        high = j;
        highValue = v;
      }
    }
    if (highValue <= lowValue + tolerance || lowValue <= abstol) break;
    const worst = vertex[high]!;
    for (let i = 0; i < n; i++) {
      // all vertices summed, less the worst one
      let total = -worst[i]!;
      for (const v of vertex) total += v[i]!;
      centroid[i] = total / n;
    }
    const reflected = centroid.map((m, i) => (1 + reflect) * m - reflect * worst[i]!);
    const reflectedValue = orHuge(s.f(reflected));
    evals++;
    if (reflectedValue < lowValue) {
      const expanded = reflected.map((r, i) => expand * r + (1 - expand) * centroid[i]!);
      const expandedValue = orHuge(s.f(expanded));
      evals++;
      const better = expandedValue < reflectedValue;
      vertex[high] = better ? expanded : reflected;
      value[high] = better ? expandedValue : reflectedValue;
      continue;
    }
    if (reflectedValue < highValue) {
      vertex[high] = reflected;
      value[high] = reflectedValue;
    }
    const contracted = vertex[high]!.map((h, i) => (1 - contract) * h + contract * centroid[i]!);
    const contractedValue = orHuge(s.f(contracted));
    evals++;
    if (contractedValue < value[high]!) {
      vertex[high] = contracted;
      value[high] = contractedValue;
    } else if (reflectedValue >= highValue) {
      // shrink towards the lowest vertex; its values are recomputed on the next pass
      const best = vertex[low]!;
      extent = 0;
      vertex.forEach((v, j) => {
        if (j === low) return;
        for (let i = 0; i < n; i++) {
          v[i] = contract * (v[i]! - best[i]!) + best[i]!;
          extent += Math.abs(v[i]! - best[i]!);
        }
        value[j] = NaN;
      });
      if (!(extent < lastExtent)) {
        code = 10;
        break;
      }
      lastExtent = extent;
    }
  } while (evals <= maxit);
  if (code !== 10 && evals > maxit) code = 1;
  return { par: vertex[low]!.slice(), value: value[low]!, fnEvals: evals, gradEvals: NaN, code };
}

/** Variable metric (BFGS; Nash's Algorithm 21, with R's details and order of arithmetic from the specification) */
function variableMetric(s: Scaled, start: readonly number[], abstol: number, reltol: number, maxit: number): MethodResult {
  const n = start.length;
  const point = start.slice();
  if (maxit <= 0) return { par: point, value: s.f(point), fnEvals: 0, gradEvals: 0, code: 0 };
  let value = s.f(point);
  if (!Number.isFinite(value)) throw new Error("initial value in 'vmmin' is not finite");
  let best = value;
  let fnEvals = 1;
  let gradEvals = 1;
  let grad = s.g(point);
  let lastReset = gradEvals;
  // the inverse Hessian approximation H, kept as its lower triangle
  const H: number[][] = Array.from({ length: n }, (_, i) => new Array<number>(i + 1).fill(0));
  const h = (i: number, j: number): number => (j <= i ? H[i]![j]! : H[j]![i]!);
  const dir = new Array<number>(n).fill(0);
  const from = new Array<number>(n).fill(0);
  const Hy = new Array<number>(n).fill(0);
  let stalled = false;
  let limitReached = false;
  do {
    if (lastReset === gradEvals) {
      for (let i = 0; i < n; i++) {
        H[i]!.fill(0);
        H[i]![i] = 1;
      }
    }
    for (let i = 0; i < n; i++) from[i] = point[i]!;
    const prevGrad = grad.slice();
    let slope = 0;
    for (let i = 0; i < n; i++) {
      let d = 0;
      for (let j = 0; j < n; j++) d -= h(i, j) * grad[j]!;
      dir[i] = d;
      slope += d * grad[i]!;
    }
    if (slope < 0) {
      const search = backtrack(s, from, dir, slope, best, 1, point, value);
      fnEvals += search.evals;
      value = search.value;
      let progressed = search.accepted;
      // too small a change counts as none, with the value taken as the best
      if (!(value > abstol && Math.abs(value - best) > reltol * (Math.abs(best) + reltol))) {
        progressed = false;
        best = value;
      }
      if (progressed) {
        best = value;
        grad = s.g(point);
        gradEvals++;
        // step and change of gradient
        const y = prevGrad;
        let sy = 0;
        for (let i = 0; i < n; i++) {
          dir[i] = search.step * dir[i]!;
          y[i] = grad[i]! - y[i]!;
          sy += dir[i]! * y[i]!;
        }
        if (sy > 0) {
          let yHy = 0;
          for (let i = 0; i < n; i++) {
            let v = 0;
            for (let j = 0; j < n; j++) v += h(i, j) * y[j]!;
            Hy[i] = v;
            yHy += v * y[i]!;
          }
          const factor = 1 + yHy / sy;
          for (let i = 0; i < n; i++) {
            for (let j = 0; j <= i; j++) H[i]![j] = H[i]![j]! + (factor * dir[i]! * dir[j]! - Hy[i]! * dir[j]! - dir[i]! * Hy[j]!) / sy;
          }
        } else lastReset = gradEvals;
        stalled = false;
      } else {
        // no progress: start again from the identity, unless that was just done
        stalled = lastReset === gradEvals;
        lastReset = gradEvals;
      }
    } else {
      // not a descent direction: the same
      stalled = lastReset === gradEvals;
      lastReset = gradEvals;
    }
    if (gradEvals >= maxit) {
      limitReached = true;
      break;
    }
    if (gradEvals - lastReset > 2 * n) lastReset = gradEvals;
  } while (!stalled || lastReset !== gradEvals);
  return { par: point, value: best, fnEvals, gradEvals, code: limitReached ? 1 : 0 };
}

/** Conjugate gradients (Nash's Algorithm 22, with R's details from the specification) */
function conjugateGradients(s: Scaled, start: readonly number[], type: number, abstol: number, reltol: number, maxit: number): MethodResult {
  const n = start.length;
  const point = start.slice();
  if (maxit <= 0) return { par: point, value: s.f(point), fnEvals: 0, gradEvals: 0, code: 0 };
  if (type !== 1 && type !== 2 && type !== 3) throw new RangeError("unknown 'type' in \"CG\" method of 'optim'");
  const threshold = reltol * n * Math.sqrt(reltol);
  let value = s.f(point);
  if (!Number.isFinite(value)) throw new Error("function cannot be evaluated at initial parameters");
  let best = value;
  let fnEvals = 1;
  let gradEvals = 0;
  const dir = new Array<number>(n);
  const prevGrad = new Array<number>(n);
  const from = new Array<number>(n).fill(0);
  let moved = true;
  let inner = 0;
  let numer = 0;
  for (;;) {
    // restart: steepest descent, first step 1
    dir.fill(0);
    prevGrad.fill(0);
    inner = 0;
    let firstStep = 1;
    moved = true;
    do {
      inner++;
      gradEvals++;
      // the result is the point of the last gradient, with the best value
      if (gradEvals > maxit) return { par: from.slice(), value: best, fnEvals, gradEvals, code: 1 };
      const grad = s.g(point);
      numer = 0;
      let denom = 0;
      for (let i = 0; i < n; i++) {
        from[i] = point[i]!;
        const gi = grad[i]!;
        const ci = prevGrad[i]!;
        if (type === 1) {
          numer += gi * gi;
          denom += ci * ci;
        } else if (type === 2) {
          numer += gi * (gi - ci);
          denom += ci * ci;
        } else {
          numer += gi * (gi - ci);
          denom += dir[i]! * (gi - ci);
        }
        prevGrad[i] = gi;
      }
      if (!(numer > threshold)) break;
      const beta = denom > 0 ? numer / denom : 1;
      let slope = 0;
      for (let i = 0; i < n; i++) {
        dir[i] = dir[i]! * beta - grad[i]!;
        slope += dir[i]! * grad[i]!;
      }
      const search = backtrack(s, from, dir, slope, best, firstStep, point, value);
      fnEvals += search.evals;
      value = search.value;
      moved = search.accepted;
      const step = search.step;
      if (moved) {
        best = value;
        // minimum of the parabola through the start (value and slope) and the accepted point
        let curvature = 2 * (value - best - slope * step);
        if (curvature > 0) {
          curvature = -((slope * step * step) / curvature);
          for (let i = 0; i < n; i++) point[i] = from[i]! + curvature * dir[i]!;
          best = value;
          value = s.f(point);
          fnEvals++;
          if (value < best) best = value;
          else for (let i = 0; i < n; i++) point[i] = from[i]! + step * dir[i]!;
        }
      }
      firstStep = Math.min(1, GROWTH * step);
    } while (moved && inner !== n);
    if (inner === 1 && (!moved || !(numer > threshold) || best <= abstol)) break;
  }
  return { par: from.slice(), value: best, fnEvals, gradEvals, code: 0 };
}

/** Simulated annealing with Gaussian candidates (Bélisle 1992; R's default candidate generator) */
function annealing(s: Scaled, start: readonly number[], maxit: number, perTemperature: number, startTemperature: number): MethodResult {
  let current = start.slice();
  if (maxit <= 0) return { par: current, value: s.f(current), fnEvals: 0, gradEvals: NaN, code: 0 };
  const spread = 1 / startTemperature;
  let currentValue = orHuge(s.f(current));
  let bestValue = currentValue;
  let bestPoint = current.slice();
  let evals = 1;
  while (evals < maxit) {
    const temperature = startTemperature / Math.log(evals + E_MINUS_1);
    for (let k = 0; k < perTemperature && evals < maxit; k++) {
      const candidate = current.map((v) => v + spread * temperature * normRand());
      const candidateValue = orHuge(s.f(candidate));
      const rise = candidateValue - currentValue;
      if (rise <= 0 || unifRand() < Math.exp(-rise / temperature)) {
        current = candidate;
        currentValue = candidateValue;
        if (currentValue <= bestValue) {
          bestPoint = current.slice();
          bestValue = currentValue;
        }
      }
      evals++;
    }
  }
  return { par: bestPoint, value: bestValue, fnEvals: maxit, gradEvals: NaN, code: 0 };
}

/**
 * Numerically differentiated Hessian of fn at par, from central differences of the gradient (gr, or the numerical
 * gradient of fn). Equivalent to R's `optimHess()`. `control` uses `fnscale`, `parscale` and `ndeps`.
 *
 * @example
 * ```ts
 * optimHess([1, 2], (x) => x[0] ** 2 + 3 * x[0] * x[1] + x[1] ** 2); // [[2, 3], [3, 2]]
 * ```
 *
 * @category Numerical methods
 */
export function optimHess(par: readonly number[], fn: (par: number[]) => number, gr?: (par: number[]) => number[], control: OptimControl = {}): number[][] {
  const n = par.length;
  const s = new Scaled(fn, gr, recycle(control.parscale, n, 1), control.fnscale ?? 1, recycle(control.ndeps, n, 1e-3));
  return hessianOf(s, par);
}

function hessianOf(s: Scaled, par: readonly number[]): number[][] {
  const { n, parscale, fnscale, ndeps } = s;
  const p = par.map((v, i) => v / parscale[i]!);
  const hess: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    const step = ndeps[i]! / parscale[i]!;
    const centre = p[i]!;
    p[i] = centre + step;
    const gradUp = s.g(p);
    p[i] = centre - step;
    const gradDown = s.g(p);
    p[i] = centre;
    for (let j = 0; j < n; j++) hess[i]![j] = (fnscale * (gradUp[j]! - gradDown[j]!)) / (2 * step * parscale[i]! * parscale[j]!);
  }
  // symmetrise
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const v = 0.5 * (hess[i]![j]! + hess[j]![i]!);
      hess[i]![j] = v;
      hess[j]![i] = v;
    }
  }
  return hess;
}

const METHODS: readonly OptimMethod[] = ["Nelder-Mead", "BFGS", "CG", "L-BFGS-B", "SANN", "Brent"];

/**
 * General-purpose minimisation of `fn` from the starting point `par`. Equivalent to R's `optim()`. The same methods
 * with the same iterations, so the same results and counts.
 *
 * @example
 * ```ts
 * const rosen = (x: number[]) => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2;
 * optim([-1.2, 1], rosen).par; // [1.0002601387256695, 1.000505999303765]
 * optim([-1.2, 1], rosen, { method: "BFGS" }).counts; // [118, 38]
 * ```
 *
 * @category Numerical methods
 */
export function optim(par: readonly number[], fn: (par: number[]) => number, options: OptimOptions = {}): OptimResult {
  const n = par.length;
  let method: OptimMethod = options.method ?? "Nelder-Mead";
  if (!METHODS.includes(method)) throw new RangeError(`unknown method '${String(method)}'`);
  const control = options.control ?? {};
  const warnings: string[] = [];
  const lower = recycle(options.lower, n, -Infinity);
  const upper = recycle(options.upper, n, Infinity);
  if ((lower.some((v) => v > -Infinity) || upper.some((v) => v < Infinity)) && method !== "L-BFGS-B" && method !== "Brent") {
    warnings.push("bounds can only be used with method L-BFGS-B (or Brent)");
    method = "L-BFGS-B";
  }
  const parscale = recycle(control.parscale, n, 1);
  const fnscale = control.fnscale ?? 1;
  const ndeps = recycle(control.ndeps, n, 1e-3);
  const maxit = control.maxit ?? (method === "Nelder-Mead" ? 500 : method === "SANN" ? 10000 : 100);
  const reltol = control.reltol ?? Math.sqrt(2 ** -52);
  const abstol = control.abstol ?? -Infinity;
  if (!(reltol >= 0 && reltol < Infinity)) throw new RangeError("'reltol' must be a non-negative finite number");
  if (Number.isNaN(abstol)) throw new RangeError("'abstol' must not be NaN");
  if (method === "Nelder-Mead" && n === 1)
    warnings.push('one-dimensional optimization by Nelder-Mead is unreliable:\nuse "Brent" or optimize() directly');
  if (method === "L-BFGS-B" && (control.reltol !== undefined || control.abstol !== undefined))
    warnings.push("method L-BFGS-B uses 'factr' (and 'pgtol') instead of 'reltol' and 'abstol'");
  const s = new Scaled(fn, options.gr, parscale, fnscale, ndeps);
  const start = par.map((v, i) => v / parscale[i]!);

  let run: MethodResult;
  let message: string | null = null;
  switch (method) {
    case "Nelder-Mead":
      run = simplexSearch(s, start, control.alpha ?? 1, control.beta ?? 0.5, control.gamma ?? 2, abstol, reltol, maxit);
      break;
    case "BFGS":
      run = variableMetric(s, start, abstol, reltol, maxit);
      break;
    case "CG":
      run = conjugateGradients(s, start, control.type ?? 1, abstol, reltol, maxit);
      break;
    case "SANN": {
      const perTemperature = control.tmax ?? 10;
      if (!(perTemperature >= 1)) throw new RangeError("'tmax' is not a positive integer");
      run = annealing(s, start, maxit, Math.trunc(perTemperature), control.temp ?? 10);
      break;
    }
    case "Brent": {
      if (n !== 1) throw new RangeError('method = "Brent" is only available for one-dimensional optimization');
      if (!Number.isFinite(lower[0]!) || !Number.isFinite(upper[0]!)) throw new RangeError("'lower' and 'upper' must be finite values");
      const r = optimize((x) => fn([x]) / fnscale, lower[0]!, upper[0]!, { tol: reltol });
      run = { par: [r.optimum], value: r.objective, fnEvals: NaN, gradEvals: NaN, code: 0 };
      // par is not scaled for Brent
      const result: OptimResult = { par: run.par, value: run.value * fnscale, counts: [NaN, NaN], convergence: 0, message: null, warnings };
      if (options.hessian) result.hessian = hessianOf(s, result.par);
      return result;
    }
    default: {
      // L-BFGS-B
      const lo = lower.map((v, i) => v / parscale[i]!);
      const up = upper.map((v, i) => v / parscale[i]!);
      if (n === 0) {
        run = { par: [], value: s.f([]), fnEvals: 0, gradEvals: 0, code: 0 };
        message = "NOTHING TO DO";
        break;
      }
      const nbd = lo.map((l, i) => {
        const fl = Number.isFinite(l);
        const fu = Number.isFinite(up[i]!);
        return fl && fu ? 2 : fl ? 1 : fu ? 3 : 0;
      });
      let iterations = 0;
      const r = lbfgsb(
        n,
        control.lmm ?? 5,
        start,
        lo,
        up,
        nbd,
        control.factr ?? 1e7,
        control.pgtol ?? 0,
        (x) => {
          const f = s.f(x);
          if (!Number.isFinite(f)) throw new Error("L-BFGS-B needs finite values of 'fn'");
          return { f, g: s.g(x, lo, up) };
        },
        () => ++iterations > maxit,
      );
      message = r.task;
      const code = r.task.startsWith("NEW_X") ? 1 : r.task.startsWith("CONV") ? 0 : r.task.startsWith("WARN") ? 51 : 52;
      run = { par: r.x, value: r.f, fnEvals: r.nfgv, gradEvals: r.nfgv, code };
    }
  }
  const result: OptimResult = {
    par: s.unscale(run.par),
    value: run.value * fnscale,
    counts: [run.fnEvals, run.gradEvals],
    convergence: run.code,
    message,
    warnings,
  };
  if (options.hessian) result.hessian = hessianOf(s, result.par);
  return result;
}
