// Univariate root finding for internal callers (the confidence limits and estimates of fisherTest, wilcoxTest and
// mantelhaenTest): a thin wrapper around the public uniroot (src/numerics/integrate.ts, Brent's method with R's
// conventions), returning just the root.
import { uniroot as unirootFull } from "../numerics/integrate.js";
export const UNIROOT_TOL = Math.pow(Number.EPSILON, 0.25);
/** f(lower) and f(upper) must differ in sign. Returns one root */
export function uniroot(f, lower, upper, opts = {}) {
    const options = { tol: opts.tol ?? UNIROOT_TOL, maxiter: opts.maxIter ?? 1000 };
    if (opts.fLower !== undefined)
        options.fLower = opts.fLower;
    if (opts.fUpper !== undefined)
        options.fUpper = opts.fUpper;
    return unirootFull(f, lower, upper, options).root;
}
