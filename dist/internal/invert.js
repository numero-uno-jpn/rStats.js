// Quantiles of continuous distributions from the distribution function and density, via a safeguarded Newton method.
//
// The target is "the log probability of one tail" (built by smallerTail). Root finding is done directly on log F(x),
// so deep tails such as p = 1e-300, and regions where the probability itself would underflow, are solved with the same accuracy.
// A bracketing interval [lo, hi] is maintained; when a Newton step would leave it, bisection is used instead.
export function invertContinuous(problem) {
    const { logTarget, lower, cdfLog, pdfLog, linearTarget, cdf, cdfBoth, dlogPdf } = problem;
    // Residual log F(x) - log target. With a linear target, measured as the log of F(x)/target
    const residual = (x, lF) => {
        if (linearTarget !== undefined && cdf !== undefined && lF > -700) {
            const F = cdf(x, lower);
            if (F > 0 && F / linearTarget < Infinity)
                return Math.log(F / linearTarget);
        }
        return lF - logTarget;
    };
    // [log F, residual] at x. With cdfBoth, the distribution function is computed once
    const evaluate = (x) => {
        if (cdfBoth === undefined) {
            const lF = cdfLog(x, lower);
            return [lF, residual(x, lF)];
        }
        const [lF, F] = cdfBoth(x, lower);
        // (F / target overflows for a subnormal target; the residual was then Infinity and the steps went astray:
        // qgamma(7.2e-317, 3.3e126, { scale: 0.136, lowerTail: false }) was 8.2e146, 1e21 times the mean)
        if (linearTarget !== undefined && lF > -700 && F > 0 && F / linearTarget < Infinity)
            return [lF, Math.log(F / linearTarget)];
        return [lF, lF - logTarget];
    };
    const positive = problem.positive ?? false;
    const maxIter = problem.maxIter ?? 200;
    // Variable u being solved for (u = log x if positive)
    const toX = positive ? Math.exp : (u) => u;
    let lo = positive ? Math.log(problem.lo) : problem.lo;
    let hi = positive ? Math.log(problem.hi) : problem.hi;
    let u = positive ? Math.log(problem.x0) : problem.x0;
    if (!(u > lo && u < hi))
        u = midpoint(lo, hi, NaN);
    let best = u;
    let bestResid = Infinity;
    for (let i = 0; i < maxIter; i++) {
        const x = toX(u);
        const [lF, resid] = evaluate(x);
        if (Math.abs(resid) < bestResid) {
            bestResid = Math.abs(resid);
            best = u;
        }
        if (resid === 0 || Math.abs(resid) <= (problem.residualTolerance ?? 0))
            return x;
        // The lower probability is increasing in x, the upper decreasing
        if (resid < 0 === lower)
            lo = u;
        else
            hi = u;
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
            if (ratio >= 0.5 && ratio <= 2)
                step = h;
        }
        let next = u - step;
        // If rounding keeps the Newton step from moving u, it has converged (do not fall back to bisection even if a bracket end equals u)
        const stuck = next === u && Number.isFinite(slope) && slope !== 0;
        if (!stuck && (!Number.isFinite(next) || next <= lo || next >= hi))
            next = midpoint(lo, hi, u);
        // Convergence test: in u = log x, the absolute error of u (= relative error of x); otherwise the relative error
        const converged = positive ? Math.abs(next - u) <= 2e-16 : Math.abs(next - u) <= 4e-16 * Math.abs(u);
        if (stuck || converged) {
            // Converged. The next step would be below 2e-16, so instead of re-evaluating, return the evaluated point with the smallest residual
            return polish(toX(best));
        }
        if (lo === hi)
            break;
        u = next;
    }
    return polish(toX(best));
    /**
     * After solving in u = log x, polish with Newton's method in x itself,
     * because for large |u| the spacing of u (1.1e-13 at |u| = 511) limits the relative accuracy of x.
     */
    function polish(x0) {
        if (!positive || !(x0 > 0) || !Number.isFinite(x0))
            return x0;
        // If |log x| <= 2, the spacing of u (at most 2^-51) is already about 1 ulp of x, and polishing changes nothing
        if (Math.abs(Math.log(x0)) <= 2)
            return x0;
        let x = x0;
        let [lF, r] = evaluate(x);
        for (let k = 0; k < 4 && r !== 0; k++) {
            const lf = pdfLog(x) - lF;
            const slope = (lower ? 1 : -1) * Math.exp(lf);
            // (where f/F overflows, as at a subnormal x, the step relative to x: qbeta(3.8e-277, 27.9, 1.5e299) is 9.6e-309,
            // and the step there was 0, which left the answer 5e-14 off)
            const xn = Number.isFinite(slope) ? x - r / slope : x - (lower ? 1 : -1) * r * x * Math.exp(-(lf + Math.log(x)));
            if (!(xn > 0) || !Number.isFinite(xn) || xn === x)
                break;
            const [lFn, rn] = evaluate(xn);
            if (!(Math.abs(rn) < Math.abs(r)))
                break;
            x = xn;
            lF = lFn;
            r = rn;
        }
        if (Math.abs(r) > 1e-9)
            return bisectX(x, r);
        return x;
    }
    /**
     * Where Newton's method in x makes no progress (the distribution function rises across a few ulps of x, as for
     * qchisq(1.5e-233, 6.3e234), whose standard deviation is 1e-117 of the mean; the density there underflows), bisect
     * in x within the bracket of the search in u (spacing 1.1e-13 relative at |u| = 500) down to adjacent doubles
     */
    function bisectX(x0, r0) {
        // x with residual r lies below the solution if r < 0 for the lower tail (r > 0 for the upper)
        const below = (r) => r < 0 === lower;
        let xl = toX(lo);
        let xh = toX(hi);
        if (below(r0))
            xl = Math.max(xl, x0);
        else
            xh = Math.min(xh, x0);
        // An end the search never reached: step away from x0 by doubling relative steps
        for (let k = 0, s = 1e-13; k < 60 && !(xl > 0); k++, s *= 2) {
            const t = s < 0.5 ? x0 * (1 - s) : x0 / (2 * s);
            if (below(evaluate(t)[1]))
                xl = t;
            else
                xh = Math.min(xh, t);
        }
        for (let k = 0, s = 1e-13; k < 60 && !Number.isFinite(xh); k++, s *= 2) {
            const t = x0 * (1 + s);
            if (below(evaluate(t)[1]))
                xl = Math.max(xl, t);
            else
                xh = t;
        }
        if (!(xl > 0 && xh > xl && Number.isFinite(xh)))
            return x0;
        for (let k = 0; k < 64; k++) {
            const mid = xl + (xh - xl) / 2;
            if (mid <= xl || mid >= xh)
                break;
            const r = evaluate(mid)[1];
            if (r === 0)
                return mid;
            if (below(r))
                xl = mid;
            else
                xh = mid;
        }
        // The end with the smaller residual (the residual can jump across the last ulp; x0 itself may be far off with a
        // residual no larger, as the probability saturates at 0 or 1 on either side)
        return Math.abs(evaluate(xl)[1]) < Math.abs(evaluate(xh)[1]) ? xl : xh;
    }
}
/** Midpoint of the bracketing interval. If an end is infinite, expand outward from the current value */
function midpoint(lo, hi, x) {
    if (Number.isFinite(lo) && Number.isFinite(hi))
        return lo + (hi - lo) / 2;
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
