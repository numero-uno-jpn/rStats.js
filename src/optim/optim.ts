// General-purpose optimisation, R's optim() and optimHess(): Nelder-Mead, BFGS (variable metric) and CG (conjugate
// gradients) are J. C. Nash's Algorithms 19, 21 and 22 ("Compact Numerical Methods for Computers", 2nd ed., Adam
// Hilger, 1990) with R's details as described in oracle/optim-behaviour.md; L-BFGS-B is the Netlib code of Zhu, Byrd,
// Lu and Nocedal (src/optim/lbfgsb.ts); SANN is Bélisle's simulated annealing (C. J. P. Bélisle, "Convergence
// theorems for a class of simulated annealing algorithms on R^d", J. Appl. Probab. 29 (1992) 885-895) with R's random
// numbers; Brent is optimize(). Written for rStats.js from the specification (no R code was read or used).

import { optimize } from "../numerics/integrate.js";
import { normRand, unifRand } from "../random/rng.js";
import { lbfgsb } from "./lbfgsb.js";

/** Methods of {@link optim} */
export type OptimMethod = "Nelder-Mead" | "BFGS" | "CG" | "L-BFGS-B" | "SANN" | "Brent";

/** Control parameters of {@link optim} (R's `control`, in camelCase) */
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

/** Options of {@link optim} */
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
  control?: OptimControl;
}

/** Result of {@link optim} */
export interface OptimResult {
  par: number[];
  value: number;
  /** Evaluations of fn and gr (NaN where R has NA) */
  counts: [number, number];
  /** 0 success, 1 iteration limit reached, 10 Nelder-Mead simplex degenerate, 51 / 52 L-BFGS-B warning / error */
  convergence: number;
  /** L-BFGS-B's final message; null for the other methods */
  message: string | null;
  hessian?: number[][];
  /** R's warnings */
  warnings: string[];
}

const REL_TEST = 10;
const ACC_TOL = 1e-4;
const STEP_REDN = 0.2;
const BIG = 1e35;

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
    const df = new Array<number>(n);
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
      df[i] = (v1 - v2) / width;
      if (!Number.isFinite(df[i]!)) throw new Error(`non-finite finite-difference value [${i + 1}]`);
      x[i] = p[i]! * parscale[i]!;
    }
    return df;
  }
}

interface Run {
  par: number[];
  value: number;
  fncount: number;
  grcount: number;
  fail: number;
}

/** Nelder-Mead simplex (Nash's Algorithm 19) */
function nelderMead(s: Scaled, start: readonly number[], alpha: number, beta: number, gamma: number, abstol: number, reltol: number, maxit: number): Run {
  const n = start.length;
  const fin = (v: number): number => (Number.isFinite(v) ? v : BIG);
  if (maxit <= 0) return { par: start.slice(), value: s.f(start), fncount: 0, grcount: NaN, fail: 0 };
  const f0 = s.f(start);
  if (!Number.isFinite(f0)) throw new Error("function cannot be evaluated at initial parameters");
  let funcount = 1;
  const convtol = reltol * (Math.abs(f0) + reltol);
  const P: number[][] = [start.slice()];
  const fv: number[] = [f0];
  let step = 0;
  for (const v of start) if (0.1 * Math.abs(v) > step) step = 0.1 * Math.abs(v);
  if (step === 0) step = 0.1;
  let size = 0;
  for (let j = 1; j <= n; j++) {
    const v = start.slice();
    let trystep = step;
    let used = 0;
    while (v[j - 1] === start[j - 1]) {
      v[j - 1] = start[j - 1]! + trystep;
      used = trystep;
      trystep *= 10;
    }
    size += used;
    P.push(v);
    fv.push(NaN);
  }
  let oldsize = size;
  let L = 0;
  let calcvert = true;
  let fail = 0;
  const C = new Array<number>(n);
  do {
    if (calcvert) {
      for (let j = 0; j <= n; j++) {
        if (j === L) continue;
        fv[j] = fin(s.f(P[j]!));
        funcount++;
      }
      calcvert = false;
    }
    let VL = fv[L]!;
    let VH = VL;
    let H = L;
    for (let j = 0; j <= n; j++) {
      if (j === L) continue;
      const fj = fv[j]!;
      if (fj < VL) {
        L = j;
        VL = fj;
      }
      if (fj > VH) {
        H = j;
        VH = fj;
      }
    }
    if (VH <= VL + convtol || VL <= abstol) break;
    const PH = P[H]!;
    for (let i = 0; i < n; i++) {
      let temp = -PH[i]!;
      for (let j = 0; j <= n; j++) temp += P[j]![i]!;
      C[i] = temp / n;
    }
    const R = C.map((c, i) => (1 + alpha) * c - alpha * PH[i]!);
    const VR = fin(s.f(R));
    funcount++;
    if (VR < VL) {
      const E = R.map((r, i) => gamma * r + (1 - gamma) * C[i]!);
      const fE = fin(s.f(E));
      funcount++;
      if (fE < VR) {
        P[H] = E;
        fv[H] = fE;
      } else {
        P[H] = R;
        fv[H] = VR;
      }
    } else {
      if (VR < VH) {
        P[H] = R;
        fv[H] = VR;
      }
      const cur = P[H]!;
      const Kp = cur.map((h, i) => (1 - beta) * h + beta * C[i]!);
      const fK = fin(s.f(Kp));
      funcount++;
      if (fK < fv[H]!) {
        P[H] = Kp;
        fv[H] = fK;
      } else if (VR >= VH) {
        // shrink towards the lowest vertex
        calcvert = true;
        size = 0;
        const PL = P[L]!;
        for (let j = 0; j <= n; j++) {
          if (j === L) continue;
          const v = P[j]!;
          for (let i = 0; i < n; i++) {
            v[i] = beta * (v[i]! - PL[i]!) + PL[i]!;
            size += Math.abs(v[i]! - PL[i]!);
          }
        }
        if (size < oldsize) oldsize = size;
        else {
          fail = 10;
          break;
        }
      }
    }
  } while (funcount <= maxit);
  if (fail !== 10) fail = funcount > maxit ? 1 : 0;
  return { par: P[L]!.slice(), value: fv[L]!, fncount: funcount, grcount: NaN, fail };
}

/** Variable metric (Nash's Algorithm 21) */
function vmmin(s: Scaled, start: readonly number[], abstol: number, reltol: number, maxit: number): Run {
  const n = start.length;
  const b = start.slice();
  if (maxit <= 0) return { par: b, value: s.f(b), fncount: 0, grcount: 0, fail: 0 };
  let f = s.f(b);
  if (!Number.isFinite(f)) throw new Error("initial value in 'vmmin' is not finite");
  let Fmin = f;
  let funcount = 1;
  let gradcount = 1;
  let g = s.g(b);
  let iter = 1;
  let ilast = gradcount;
  // lower triangle of the inverse Hessian approximation
  const B: number[][] = Array.from({ length: n }, (_, i) => new Array<number>(i + 1).fill(0));
  const Bij = (i: number, j: number): number => (j <= i ? B[i]![j]! : B[j]![i]!);
  const t = new Array<number>(n).fill(0);
  const X = new Array<number>(n).fill(0);
  let c = new Array<number>(n).fill(0);
  let count = 0;
  let fail = 1;
  do {
    if (ilast === gradcount) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) B[i]![j] = 0;
        B[i]![i] = 1;
      }
    }
    for (let i = 0; i < n; i++) X[i] = b[i]!;
    c = g.slice();
    let gradproj = 0;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) sum -= Bij(i, j) * g[j]!;
      t[i] = sum;
      gradproj += sum * g[i]!;
    }
    if (gradproj < 0) {
      let steplength = 1;
      let accpoint = false;
      do {
        count = 0;
        for (let i = 0; i < n; i++) {
          b[i] = X[i]! + steplength * t[i]!;
          if (REL_TEST + X[i]! === REL_TEST + b[i]!) count++;
        }
        if (count < n) {
          f = s.f(b);
          funcount++;
          accpoint = Number.isFinite(f) && f <= Fmin + gradproj * steplength * ACC_TOL;
          if (!accpoint) steplength *= STEP_REDN;
        }
      } while (!(count === n || accpoint));
      const enough = f > abstol && Math.abs(f - Fmin) > reltol * (Math.abs(Fmin) + reltol);
      // not enough change: as no change, with f taken as the minimum (R's behaviour, see the fixture)
      if (!enough) {
        count = n;
        Fmin = f;
      }
      if (count < n) {
        Fmin = f;
        g = s.g(b);
        gradcount++;
        iter++;
        let D1 = 0;
        for (let i = 0; i < n; i++) {
          t[i] = steplength * t[i]!;
          c[i] = g[i]! - c[i]!;
          D1 += t[i]! * c[i]!;
        }
        if (D1 > 0) {
          let D2 = 0;
          for (let i = 0; i < n; i++) {
            let sum = 0;
            for (let j = 0; j < n; j++) sum += Bij(i, j) * c[j]!;
            X[i] = sum;
            D2 += sum * c[i]!;
          }
          D2 = 1 + D2 / D1;
          for (let i = 0; i < n; i++) {
            for (let j = 0; j <= i; j++) B[i]![j] = B[i]![j]! + (D2 * t[i]! * t[j]! - X[i]! * t[j]! - t[i]! * X[j]!) / D1;
          }
        } else ilast = gradcount;
      } else if (ilast < gradcount) {
        // no progress: reset unless just reset
        count = 0;
        ilast = gradcount;
      }
    } else {
      // uphill direction: reset unless just reset
      count = 0;
      if (ilast === gradcount) count = n;
      else ilast = gradcount;
    }
    if (iter >= maxit) break;
    if (gradcount - ilast > 2 * n) ilast = gradcount;
  } while (count !== n || ilast !== gradcount);
  if (iter < maxit) fail = 0;
  return { par: b, value: Fmin, fncount: funcount, grcount: gradcount, fail };
}

/** Conjugate gradients (Nash's Algorithm 22) */
function cgmin(s: Scaled, start: readonly number[], type: number, abstol: number, reltol: number, maxit: number): Run {
  const n = start.length;
  const b = start.slice();
  if (maxit <= 0) return { par: b, value: s.f(b), fncount: 0, grcount: 0, fail: 0 };
  if (type !== 1 && type !== 2 && type !== 3) throw new RangeError("unknown 'type' in \"CG\" method of 'optim'");
  const tol = reltol * n * Math.sqrt(reltol);
  const setstep = 1.7;
  let f = s.f(b);
  if (!Number.isFinite(f)) throw new Error("function cannot be evaluated at initial parameters");
  let Fmin = f;
  let funcount = 1;
  let gradcount = 0;
  const t = new Array<number>(n).fill(0);
  const c = new Array<number>(n).fill(0);
  const X = new Array<number>(n).fill(0);
  let count = 0;
  let cycle = 0;
  let G1 = 0;
  do {
    for (let i = 0; i < n; i++) {
      t[i] = 0;
      c[i] = 0;
    }
    cycle = 0;
    let oldstep = 1;
    count = 0;
    do {
      cycle++;
      gradcount++;
      // the result is the point of the last gradient (X), with the last accepted value (R's behaviour, see the fixture)
      if (gradcount > maxit) return { par: X.slice(), value: Fmin, fncount: funcount, grcount: gradcount, fail: 1 };
      const g = s.g(b);
      G1 = 0;
      let G2 = 0;
      for (let i = 0; i < n; i++) {
        X[i] = b[i]!;
        const gi = g[i]!;
        if (type === 1) {
          G1 += gi * gi;
          G2 += c[i]! * c[i]!;
        } else if (type === 2) {
          G1 += gi * (gi - c[i]!);
          G2 += c[i]! * c[i]!;
        } else {
          G1 += gi * (gi - c[i]!);
          G2 += t[i]! * (gi - c[i]!);
        }
        c[i] = gi;
      }
      if (G1 > tol) {
        const G3 = G2 > 0 ? G1 / G2 : 1;
        let gradproj = 0;
        for (let i = 0; i < n; i++) {
          t[i] = t[i]! * G3 - g[i]!;
          gradproj += t[i]! * g[i]!;
        }
        let steplength = oldstep;
        let accpoint = false;
        do {
          count = 0;
          for (let i = 0; i < n; i++) {
            b[i] = X[i]! + steplength * t[i]!;
            if (REL_TEST + X[i]! === REL_TEST + b[i]!) count++;
          }
          if (count < n) {
            f = s.f(b);
            funcount++;
            accpoint = Number.isFinite(f) && f <= Fmin + gradproj * steplength * ACC_TOL;
            if (!accpoint) steplength *= STEP_REDN;
            else Fmin = f;
          }
        } while (!(count === n || accpoint));
        if (count < n) {
          let newstep = 2 * (f - Fmin - gradproj * steplength);
          if (newstep > 0) {
            newstep = -((gradproj * (steplength * steplength)) / newstep);
            for (let i = 0; i < n; i++) b[i] = X[i]! + newstep * t[i]!;
            Fmin = f;
            f = s.f(b);
            funcount++;
            if (f < Fmin) Fmin = f;
            else for (let i = 0; i < n; i++) b[i] = X[i]! + steplength * t[i]!;
          }
        }
        oldstep = setstep * steplength;
        if (oldstep > 1) oldstep = 1;
      }
    } while (count !== n && G1 > tol && cycle !== n);
  } while (cycle !== 1 || (count !== n && G1 > tol && Fmin > abstol));
  return { par: X.slice(), value: Fmin, fncount: funcount, grcount: gradcount, fail: 0 };
}

/** Simulated annealing with Gaussian candidates (R's default generator) */
function samin(s: Scaled, start: readonly number[], maxit: number, tmax: number, ti: number): Run {
  const n = start.length;
  // e - 1 as R has it, to 8 digits (the fixture follows this constant, not e - 1 in full)
  const E1 = 1.7182818;
  const fin = (v: number): number => (Number.isFinite(v) ? v : BIG);
  let p = start.slice();
  if (maxit <= 0) return { par: p, value: s.f(p), fncount: 0, grcount: NaN, fail: 0 };
  const scale = 1 / ti;
  let y = fin(s.f(p));
  let ybest = y;
  let pbest = p.slice();
  let its = 1;
  while (its < maxit) {
    const t = ti / Math.log(its + E1);
    let k = 1;
    while (k <= tmax && its < maxit) {
      const ptry = new Array<number>(n);
      for (let i = 0; i < n; i++) ptry[i] = p[i]! + scale * t * normRand();
      const ytry = fin(s.f(ptry));
      const dy = ytry - y;
      if (dy <= 0 || unifRand() < Math.exp(-dy / t)) {
        p = ptry;
        y = ytry;
        if (y <= ybest) {
          pbest = p.slice();
          ybest = y;
        }
      }
      its++;
      k++;
    }
  }
  return { par: pbest, value: ybest, fncount: maxit, grcount: NaN, fail: 0 };
}

/**
 * Numerically differentiated Hessian of fn at par, from central differences of the gradient (gr, or the numerical
 * gradient of fn). Equivalent to R's `optimHess()`; `control` uses `fnscale`, `parscale` and `ndeps`.
 *
 * @example
 * ```ts
 * optimHess([1, 2], (x) => x[0] ** 2 + 3 * x[0] * x[1] + x[1] ** 2); // ≈ [[2, 3], [3, 2]]
 * ```
 */
export function optimHess(par: readonly number[], fn: (par: number[]) => number, gr?: (par: number[]) => number[], control: OptimControl = {}): number[][] {
  const n = par.length;
  const s = new Scaled(fn, gr, recycle(control.parscale, n, 1), control.fnscale ?? 1, recycle(control.ndeps, n, 1e-3));
  return hessianOf(s, par);
}

function hessianOf(s: Scaled, par: readonly number[]): number[][] {
  const { n, parscale, fnscale, ndeps } = s;
  const p = par.map((v, i) => v / parscale[i]!);
  const H: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    const eps = ndeps[i]! / parscale[i]!;
    const pi = p[i]!;
    p[i] = pi + eps;
    const g1 = s.g(p);
    p[i] = pi - eps;
    const g2 = s.g(p);
    p[i] = pi;
    for (let j = 0; j < n; j++) H[i]![j] = (fnscale * (g1[j]! - g2[j]!)) / (2 * eps * parscale[i]! * parscale[j]!);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const v = 0.5 * (H[i]![j]! + H[j]![i]!);
      H[i]![j] = v;
      H[j]![i] = v;
    }
  }
  return H;
}

const METHODS: readonly OptimMethod[] = ["Nelder-Mead", "BFGS", "CG", "L-BFGS-B", "SANN", "Brent"];

/**
 * General-purpose minimisation of `fn` from the starting point `par`. Equivalent to R's `optim()`: the same methods
 * with the same iterations, so the same results and counts.
 *
 * @example
 * ```ts
 * const rosen = (x: number[]) => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2;
 * optim([-1.2, 1], rosen).par; // [1.0002601387256695, 1.000505999303765]
 * optim([-1.2, 1], rosen, { method: "BFGS" }).counts; // [120, 38]
 * ```
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
  if (method === "Nelder-Mead" && n === 1)
    warnings.push('one-dimensional optimization by Nelder-Mead is unreliable:\nuse "Brent" or optimize() directly');
  if (method === "L-BFGS-B" && (control.reltol !== undefined || control.abstol !== undefined))
    warnings.push("method L-BFGS-B uses 'factr' (and 'pgtol') instead of 'reltol' and 'abstol'");
  const s = new Scaled(fn, options.gr, parscale, fnscale, ndeps);
  const start = par.map((v, i) => v / parscale[i]!);

  let run: Run;
  let message: string | null = null;
  switch (method) {
    case "Nelder-Mead":
      run = nelderMead(s, start, control.alpha ?? 1, control.beta ?? 0.5, control.gamma ?? 2, abstol, reltol, maxit);
      break;
    case "BFGS":
      run = vmmin(s, start, abstol, reltol, maxit);
      break;
    case "CG":
      run = cgmin(s, start, control.type ?? 1, abstol, reltol, maxit);
      break;
    case "SANN": {
      const tmax = control.tmax ?? 10;
      if (!(tmax >= 1)) throw new RangeError("'tmax' is not a positive integer");
      run = samin(s, start, maxit, Math.trunc(tmax), control.temp ?? 10);
      break;
    }
    case "Brent": {
      if (n !== 1) throw new RangeError('method = "Brent" is only available for one-dimensional optimization');
      if (!Number.isFinite(lower[0]!) || !Number.isFinite(upper[0]!)) throw new RangeError("'lower' and 'upper' must be finite values");
      const r = optimize((x) => fn([x]) / fnscale, lower[0]!, upper[0]!, { tol: reltol });
      run = { par: [r.optimum], value: r.objective, fncount: NaN, grcount: NaN, fail: 0 };
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
        run = { par: [], value: s.f([]), fncount: 0, grcount: 0, fail: 0 };
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
      const fail = r.task.startsWith("NEW_X") ? 1 : r.task.startsWith("CONV") ? 0 : r.task.startsWith("WARN") ? 51 : 52;
      run = { par: r.x, value: r.f, fncount: r.nfgv, grcount: r.nfgv, fail };
    }
  }
  const result: OptimResult = {
    par: s.unscale(run.par),
    value: run.value * fnscale,
    counts: [run.fncount, run.grcount],
    convergence: run.fail,
    message,
    warnings,
  };
  if (options.hessian) result.hessian = hessianOf(s, result.par);
  return result;
}
