// Univariate root finding (zeroin from Brent 1973, "Algorithms for Minimization without Derivatives", chapter 4).
// Combines bisection, the secant method and inverse quadratic interpolation, returning a point in [a, b] where f changes sign.
// The procedure follows the ALGOL 60 procedure in Brent's book (the same as netlib's zeroin.f).

export interface UnirootOptions {
  /** Tolerance (interval width). Default is .Machine$double.eps^0.25, as in R's uniroot */
  tol?: number;
  maxIter?: number;
  /** Pass the endpoint values if known (saves calls to f) */
  fLower?: number;
  fUpper?: number;
}

export const UNIROOT_TOL = Math.pow(Number.EPSILON, 0.25);

/** f(lower) and f(upper) must differ in sign. Returns one root */
export function uniroot(f: (x: number) => number, lower: number, upper: number, opts: UnirootOptions = {}): number {
  const tol = opts.tol ?? UNIROOT_TOL;
  const maxIter = opts.maxIter ?? 1000;
  let a = lower;
  let b = upper;
  let fa = opts.fLower ?? f(a);
  let fb = opts.fUpper ?? f(b);
  if (Number.isNaN(fa) || Number.isNaN(fb)) throw new Error("the function value at an end point is NaN");
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa > 0 === fb > 0) throw new Error("the function values at the end points have the same sign");
  let c = a;
  let fc = fa;
  for (let iter = 0; iter < maxIter; iter++) {
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
    if (Math.abs(newStep) <= tolAct || fb === 0) return b;
    // Try interpolation (when the previous step was large enough and b is closer to the root)
    if (Math.abs(prevStep) >= tolAct && Math.abs(fa) > Math.abs(fb)) {
      const cb = c - b;
      let p: number;
      let q: number;
      if (a === c) {
        // Secant method
        const t1 = fb / fa;
        p = cb * t1;
        q = 1 - t1;
      } else {
        // Inverse quadratic interpolation
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
  return b;
}
