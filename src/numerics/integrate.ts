// Numerical integration, minimisation and root finding of a function of one variable: R's integrate, optimize and
// uniroot.
//
// Written for rStats.js (no ported code here; the cores are src/integrate/quadpack.ts, ported from SciPy's QUADPACK,
// and Brent's algorithms in src/optim/localmin.ts and below). integrate uses QUADPACK's dqags on finite ranges and
// dqagi on infinite ones with R's defaults (100 subdivisions, relative and absolute tolerance eps^0.25); optimize is
// Brent's localmin; uniroot is Brent's zeroin with R's options: the interval can be extended outwards (extendInt),
// and the result reports the iterations and Brent's estimate of the precision.

import { dqagie, dqagse } from "../integrate/quadpack.js";
import { localMin } from "../optim/localmin.js";

/** Options for {@link integrate}. */
export interface IntegrateOptions {
  /** Maximum number of subintervals. Default `100`. */
  subdivisions?: number;
  /** Relative accuracy requested. Default `eps^0.25` (about 1.2e-4). */
  relTol?: number;
  /** Absolute accuracy requested. Default `relTol`. */
  absTol?: number;
  /** Throw when QUADPACK reports a problem (default `true`); otherwise return the result with its code. */
  stopOnError?: boolean;
}

/** Result of {@link integrate}. */
export interface IntegrateResult {
  value: number;
  /** Estimate of the absolute error. */
  absError: number;
  /** Number of subintervals used. */
  subdivisions: number;
  /** QUADPACK's code: 0 OK, 1 maximum number of subdivisions reached, 2 roundoff error, 3 bad integrand
   *  behaviour, 4 roundoff error in the extrapolation table, 5 probably divergent, 6 invalid input. */
  ier: number;
  /** R's message for `ier`. */
  message: string;
}

const MESSAGES = [
  "OK",
  "maximum number of subdivisions reached",
  "roundoff error was detected",
  "extremely bad integrand behaviour",
  "roundoff error is detected in the extrapolation table",
  "the integral is probably divergent",
  "the input is invalid",
];

const TOL = Number.EPSILON ** 0.25;

/**
 * Integral of a function of one variable over a finite or infinite range. Equivalent to R's `integrate()`.
 *
 * @example
 * ```ts
 * integrate((x) => Math.exp(-x * x / 2), -Infinity, Infinity).value; // 2.5066282746310002 (sqrt(2 pi))
 * ```
 */
export function integrate(f: (x: number) => number, lower: number, upper: number, options: IntegrateOptions = {}): IntegrateResult {
  const limit = options.subdivisions ?? 100;
  const relTol = options.relTol ?? TOL;
  const absTol = options.absTol ?? relTol;
  const stopOnError = options.stopOnError ?? true;
  if (Number.isNaN(lower) || Number.isNaN(upper)) throw new RangeError("a limit is NA or NaN");
  if (limit < 1 || (absTol <= 0 && relTol < Math.max(50 * Number.EPSILON, 0.5e-28))) throw new RangeError("invalid parameter values");
  const g = (x: number): number => {
    const v = f(x);
    if (!Number.isFinite(v)) throw new RangeError("non-finite function value");
    return v;
  };
  const r =
    Number.isFinite(lower) && Number.isFinite(upper)
      ? dqagse(g, lower, upper, absTol, relTol, limit)
      : Number.isFinite(lower)
        ? dqagie(g, lower, 1, absTol, relTol, limit)
        : Number.isFinite(upper)
          ? dqagie(g, upper, -1, absTol, relTol, limit)
          : dqagie(g, 0, 2, absTol, relTol, limit);
  const message = MESSAGES[r.ier] ?? "unknown error";
  if (r.ier === 6) throw new RangeError("the input is invalid");
  if (r.ier !== 0 && stopOnError) throw new RangeError(message);
  return { value: r.result, absError: r.abserr, subdivisions: r.last, ier: r.ier, message };
}

/** Options for {@link optimize}. */
export interface OptimizeOptions {
  /** Maximise instead of minimise. Default `false`. */
  maximum?: boolean;
  /** Accuracy. Default `eps^0.25`. */
  tol?: number;
}

/**
 * Minimum (or maximum) of a function of one variable on an interval, by Brent's golden-section and parabolic
 * search. Equivalent to R's `optimize()`: `optimum` is the location (R's `minimum`/`maximum`) and `objective` the
 * function there.
 *
 * @example
 * ```ts
 * optimize((x) => (x - 1 / 3) ** 2, 0, 1).optimum; // 0.3333333333333333
 * ```
 */
export function optimize(f: (x: number) => number, lower: number, upper: number, options: OptimizeOptions = {}): { optimum: number; objective: number } {
  const maximum = options.maximum ?? false;
  const tol = options.tol ?? TOL;
  const lo = Math.min(lower, upper);
  const hi = Math.max(lower, upper);
  const r = localMin(maximum ? (x) => -f(x) : f, lo, hi, tol);
  return { optimum: r.x, objective: f(r.x) };
}

/** Options for {@link uniroot}. */
export interface UnirootOptions {
  /** Accuracy. Default `eps^0.25`. */
  tol?: number;
  /** Maximum number of iterations. Default `1000`. */
  maxiter?: number;
  /**
   * Extend the interval when f has the same sign at both ends: `"yes"` (both ways), `"downX"` (f decreasing),
   * `"upX"` (f increasing) or `"no"` (default).
   */
  extendInt?: "no" | "yes" | "downX" | "upX";
  /** f(lower), when already known. */
  fLower?: number;
  /** f(upper), when already known. */
  fUpper?: number;
}

/** Result of {@link uniroot}. */
export interface UnirootResult {
  root: number;
  /** f at the root. */
  fRoot: number;
  /** Iterations used (including those extending the interval). */
  iter: number;
  /** Iterations used to extend the interval (NaN when it was not extended). */
  initIt: number;
  /** Brent's estimate of the precision of the root. */
  estimPrec: number;
}

/**
 * A root of a function of one variable in an interval, by Brent's zeroin. Equivalent to R's `uniroot()`.
 *
 * @example
 * ```ts
 * uniroot((x) => x * x - 2, 0, 2, { tol: 1e-12 }).root; // 1.4142135623731364
 * ```
 */
export function uniroot(f: (x: number) => number, lower: number, upper: number, options: UnirootOptions = {}): UnirootResult {
  const tol = options.tol ?? TOL;
  const maxiter = options.maxiter ?? 1000;
  const ext = options.extendInt ?? "no";
  if (!(lower < upper)) throw new RangeError("lower < upper  is not fulfilled");
  let lo = lower;
  let up = upper;
  let flo = options.fLower ?? f(lo);
  let fup = options.fUpper ?? f(up);
  if (Number.isNaN(flo)) throw new RangeError("f.lower = f(lower) is NA");
  if (Number.isNaN(fup)) throw new RangeError("f.upper = f(upper) is NA");
  const clamp = (v: number): number => Math.max(Math.min(v, Number.MAX_VALUE), -Number.MAX_VALUE);
  const sig = ext === "yes" ? undefined : ext === "downX" ? -1 : ext === "upX" ? 1 : 0;
  const doX = (sig === undefined && clamp(flo) * clamp(fup) > 0) || (sig !== undefined && sig !== 0 && (sig * clamp(flo) > 0 || sig * clamp(fup) < 0));
  let it = 0;
  if (doX) {
    const delta = (u: number): number => 0.01 * Math.max(1e-4, Math.abs(u));
    const fail = (): never => {
      throw new RangeError(`no sign change found in ${it - 1} iterations`);
    };
    if (sig === undefined) {
      let d = [delta(lo), delta(up)];
      while (flo * fup > 0 && (Number.isFinite(lo) || Number.isFinite(up))) {
        if (++it > maxiter) fail();
        if (Number.isFinite(lo)) {
          const [ol, of] = [lo, flo];
          lo -= d[0]!;
          flo = f(lo);
          if (Number.isNaN(flo)) {
            [lo, flo] = [ol, of];
            d[0]! /= 4;
          }
        }
        if (Number.isFinite(up)) {
          const [ou, of] = [up, fup];
          up += d[1]!;
          fup = f(up);
          if (Number.isNaN(fup)) {
            [up, fup] = [ou, of];
            d[1]! /= 4;
          }
        }
        d = [2 * d[0]!, 2 * d[1]!];
      }
    } else {
      let d = delta(lo);
      while (sig * flo > 0) {
        if (++it > maxiter) fail();
        lo -= d;
        flo = f(lo);
        d *= 2;
      }
      d = delta(up);
      while (sig * fup < 0) {
        if (++it > maxiter) fail();
        up += d;
        fup = f(up);
        d *= 2;
      }
    }
  }
  if (!(Math.sign(flo) * Math.sign(fup) <= 0)) {
    throw new RangeError(
      doX ? "did not succeed extending the interval endpoints for f(lower) * f(upper) <= 0" : "f() values at end points not of opposite sign",
    );
  }
  const z = zeroin(f, lo, up, clamp(flo), clamp(fup), tol, maxiter);
  const iter = (z.iter < 0 ? maxiter : z.iter) + (doX ? it : 0);
  return { root: z.root, fRoot: f(z.root), iter, initIt: doX ? it : NaN, estimPrec: z.estimPrec };
}

/**
 * Brent's zeroin (Algorithms for Minimization without Derivatives, 1973, chapter 4): bisection, secant and inverse
 * quadratic interpolation on a bracketing interval. iter is the number of function evaluations, -1 when maxit + 1
 * steps did not converge; estimPrec is the final |c - b|.
 */
function zeroin(
  f: (x: number) => number,
  ax: number,
  bx: number,
  faIn: number,
  fbIn: number,
  tol: number,
  maxit: number,
): { root: number; iter: number; estimPrec: number } {
  let a = ax;
  let b = bx;
  let fa = faIn;
  let fb = fbIn;
  let c = a;
  let fc = fa;
  if (fa === 0) return { root: a, iter: 0, estimPrec: 0 };
  if (fb === 0) return { root: b, iter: 0, estimPrec: 0 };
  for (let k = 0; k <= maxit; k++) {
    const prevStep = b - a;
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tolAct = 2 * Number.EPSILON * Math.abs(b) + tol / 2;
    let newStep = (c - b) / 2;
    if (Math.abs(newStep) <= tolAct || fb === 0) return { root: b, iter: k, estimPrec: Math.abs(c - b) };
    if (Math.abs(prevStep) >= tolAct && Math.abs(fa) > Math.abs(fb)) {
      const cb = c - b;
      let p: number;
      let q: number;
      if (a === c) {
        const t1 = fb / fa;
        p = cb * t1;
        q = 1 - t1;
      } else {
        const qq = fa / fc;
        const t1 = fb / fc;
        const t2 = fb / fa;
        p = t2 * (cb * qq * (qq - t1) - (b - a) * (t1 - 1));
        q = (qq - 1) * (t1 - 1) * (t2 - 1);
      }
      if (p > 0) q = -q;
      else p = -p;
      if (p < 0.75 * cb * q - Math.abs(tolAct * q) / 2 && p < Math.abs((prevStep * q) / 2)) newStep = p / q;
    }
    if (Math.abs(newStep) < tolAct) newStep = newStep > 0 ? tolAct : -tolAct;
    a = b;
    fa = fb;
    b += newStep;
    fb = f(b);
    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
      c = a;
      fc = fa;
    }
  }
  return { root: b, iter: -1, estimPrec: Math.abs(c - b) };
}
