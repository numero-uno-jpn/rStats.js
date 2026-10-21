// Quantiles of continuous distributions from the distribution function and density, via a safeguarded Newton method.
//
// The target is "the log probability of one tail" (built by smallerTail). Root finding is done directly on log F(x),
// so deep tails such as p = 1e-300, and regions where the probability itself would underflow, are solved with the same accuracy.
// A bracketing interval [lo, hi] is maintained; when a Newton step would leave it, bisection is used instead.

export interface InvertProblem {
  /** Target log probability (log P[X <= x] if lower, otherwise log P[X > x]) */
  logTarget: number;
  /** Target linear probability (if available). The residual is then measured as log(F(x) / target) */
  linearTarget?: number;
  /** Linear P[X <= x] / P[X > x] (used with linearTarget) */
  cdf?: (x: number, lower: boolean) => number;
  lower: boolean;
  /** log P[X <= x] (lower) / log P[X > x] (!lower) */
  cdfLog: (x: number, lower: boolean) => number;
  /**
   * (Optional) Function returning [log P, linear P] in one computation. If given, it is used instead of cdfLog and cdf
   * (computing the log and linear distribution function at the same x separately would do the main work twice).
   * Its values must equal those of cdfLog and cdf respectively
   */
  cdfBoth?: (x: number, lower: boolean) => [number, number];
  /** log f(x) */
  pdfLog: (x: number) => number;
  /**
   * (Optional) Derivative of the log density, d/dx log f(x). If given, steps use Halley's method (cubic convergence) when positive
   */
  dlogPdf?: (x: number) => number;
  /** Starting value */
  x0: number;
  /** Lower and upper ends of the support (±Infinity allowed) */
  lo: number;
  hi: number;
  /**
   * True when the support is positive only. Solves in u = log x.
   * For distributions with power-law tails like x^a (gamma and beta near 0),
   * log F is nearly linear in log x and Newton's method converges in a few steps
   */
  positive?: boolean;
  maxIter?: number;
}

export function invertContinuous(problem: InvertProblem): number {
  const { logTarget, lower, cdfLog, pdfLog, linearTarget, cdf, cdfBoth, dlogPdf } = problem;
  // Residual log F(x) - log target. With a linear target, measured as the log of F(x)/target
  const residual = (x: number, lF: number): number => {
    if (linearTarget !== undefined && cdf !== undefined && lF > -700) {
      const F = cdf(x, lower);
      if (F > 0) return Math.log(F / linearTarget);
    }
    return lF - logTarget;
  };
  // [log F, residual] at x. With cdfBoth, the distribution function is computed once
  const evaluate = (x: number): [number, number] => {
    if (cdfBoth === undefined) {
      const lF = cdfLog(x, lower);
      return [lF, residual(x, lF)];
    }
    const [lF, F] = cdfBoth(x, lower);
    if (linearTarget !== undefined && lF > -700 && F > 0) return [lF, Math.log(F / linearTarget)];
    return [lF, lF - logTarget];
  };
  const positive = problem.positive ?? false;
  const maxIter = problem.maxIter ?? 200;
  // Variable u being solved for (u = log x if positive)
  const toX = positive ? Math.exp : (u: number) => u;
  let lo = positive ? Math.log(problem.lo) : problem.lo;
  let hi = positive ? Math.log(problem.hi) : problem.hi;
  let u = positive ? Math.log(problem.x0) : problem.x0;
  if (!(u > lo && u < hi)) u = midpoint(lo, hi, NaN);

  let best = u;
  let bestResid = Infinity;
  for (let i = 0; i < maxIter; i++) {
    const x = toX(u);
    const [lF, resid] = evaluate(x);
    if (Math.abs(resid) < bestResid) {
      bestResid = Math.abs(resid);
      best = u;
    }
    if (resid === 0) return x;
    // The lower probability is increasing in x, the upper decreasing
    if (resid < 0 === lower) lo = u;
    else hi = u;

    // d/dx log F = f / F (sign reversed for the upper tail). If u = log x, multiply by x
    // (done inside the exponent, so it does not overflow even when x is subnormal)
    const slope = (lower ? 1 : -1) * Math.exp(pdfLog(x) - lF + (positive ? Math.log(x) : 0));
    let step = resid / slope;
    if (positive && dlogPdf !== undefined) {
      // Halley's method. In u = log x, r' = slope, r'' = r' (1 + x (log f)') - r'^2
      // (from g' = g (log f)' - g^2 when d/dx log G = g). The step is 2 r r' / (2 r'^2 - r r'').
      // Used only when its ratio to the Newton step is between 1/2 and 2 (so the correction does not run wild far away;
      // with extreme corrections, the step became almost 0 in deep tails (log p = -1e10) and made no progress)
      const d2 = slope * (1 + x * dlogPdf(x)) - slope * slope;
      const h = (2 * resid * slope) / (2 * slope * slope - resid * d2);
      const ratio = h / step;
      if (ratio >= 0.5 && ratio <= 2) step = h;
    }
    let next = u - step;
    // If rounding keeps the Newton step from moving u, it has converged (do not fall back to bisection even if a bracket end equals u)
    const stuck = next === u && Number.isFinite(slope) && slope !== 0;
    if (!stuck && (!Number.isFinite(next) || next <= lo || next >= hi)) next = midpoint(lo, hi, u);
    // Convergence test: in u = log x, the absolute error of u (= relative error of x); otherwise the relative error
    const converged = positive ? Math.abs(next - u) <= 2e-16 : Math.abs(next - u) <= 4e-16 * Math.abs(u);
    if (stuck || converged) {
      // Converged. The next step would be below 2e-16, so instead of re-evaluating, return the evaluated point with the smallest residual
      return polish(toX(best));
    }
    if (lo === hi) break;
    u = next;
  }
  return polish(toX(best));

  /**
   * After solving in u = log x, polish with Newton's method in x itself,
   * because for large |u| the spacing of u (1.1e-13 at |u| = 511) limits the relative accuracy of x.
   */
  function polish(x0: number): number {
    if (!positive || !(x0 > 0) || !Number.isFinite(x0)) return x0;
    // If |log x| <= 2, the spacing of u (at most 2^-51) is already about 1 ulp of x, and polishing changes nothing
    if (Math.abs(Math.log(x0)) <= 2) return x0;
    let x = x0;
    let [lF, r] = evaluate(x);
    for (let k = 0; k < 4 && r !== 0; k++) {
      const slope = (lower ? 1 : -1) * Math.exp(pdfLog(x) - lF);
      const xn = x - r / slope;
      if (!(xn > 0) || !Number.isFinite(xn) || xn === x) break;
      const [lFn, rn] = evaluate(xn);
      if (!(Math.abs(rn) < Math.abs(r))) break;
      x = xn;
      lF = lFn;
      r = rn;
    }
    return x;
  }
}

/** Midpoint of the bracketing interval. If an end is infinite, expand outward from the current value */
function midpoint(lo: number, hi: number, x: number): number {
  if (Number.isFinite(lo) && Number.isFinite(hi)) return lo + (hi - lo) / 2;
  if (Number.isFinite(lo)) {
    const base = Number.isFinite(x) ? Math.max(x, lo) : lo;
    return base + Math.max(1, Math.abs(base));
  }
  if (Number.isFinite(hi)) {
    const base = Number.isFinite(x) ? Math.min(x, hi) : hi;
    return base - Math.max(1, Math.abs(base));
  }
  return Number.isFinite(x) ? x * 2 + 1 : 0;
}
