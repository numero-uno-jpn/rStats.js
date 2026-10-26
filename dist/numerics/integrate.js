// Numerical integration, minimisation and root finding of a function of one variable: R's integrate, optimize and
// uniroot.
//
// Written for rStats.js (the integration core is src/integrate/quadpack.ts, ported from SciPy's QUADPACK, and the
// minimiser src/optim/localmin.ts). integrate uses QUADPACK's dqags on finite ranges and dqagi on infinite ones with
// R's defaults (100 subdivisions, relative and absolute tolerance eps^0.25); optimize is Brent's localmin. uniroot's
// zero finder (`zero` below) is a port of netlib's public-domain zeroin.f (https://netlib.org/go/zeroin.f; Brent 1973,
// "Algorithms for Minimization without Derivatives", chapter 4, procedure zero). Around it, uniroot follows R's
// documented and observed behaviour: the interval can be extended outwards (extendInt), non-finite values of f are replaced by the
// largest finite numbers, and the result reports the iterations and Brent's estimate of the precision.
import { dqagie, dqagse } from "../integrate/quadpack.js";
import { localMin } from "../optim/localmin.js";
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
 * integrate((x) => Math.exp(-x * x / 2), -Infinity, Infinity).value; // 2.506628274115034 (sqrt(2 pi) = 2.5066282746310002)
 * ```
 *
 * @category Numerical methods
 */
export function integrate(f, lower, upper, options = {}) {
    const limit = options.subdivisions ?? 100;
    const relTol = options.relTol ?? TOL;
    const absTol = options.absTol ?? relTol;
    const stopOnError = options.stopOnError ?? true;
    if (Number.isNaN(lower) || Number.isNaN(upper))
        throw new RangeError("a limit is NA or NaN");
    if (limit < 1 || (absTol <= 0 && relTol < Math.max(50 * Number.EPSILON, 0.5e-28)))
        throw new RangeError("invalid parameter values");
    const g = (x) => {
        const v = f(x);
        if (!Number.isFinite(v))
            throw new RangeError("non-finite function value");
        return v;
    };
    const r = Number.isFinite(lower) && Number.isFinite(upper)
        ? dqagse(g, lower, upper, absTol, relTol, limit)
        : Number.isFinite(lower)
            ? dqagie(g, lower, 1, absTol, relTol, limit)
            : Number.isFinite(upper)
                ? dqagie(g, upper, -1, absTol, relTol, limit)
                : dqagie(g, 0, 2, absTol, relTol, limit);
    const message = MESSAGES[r.ier] ?? "unknown error";
    if (r.ier === 6)
        throw new RangeError("the input is invalid");
    if (r.ier !== 0 && stopOnError)
        throw new RangeError(message);
    return { value: r.result, absError: r.abserr, subdivisions: r.last, ier: r.ier, message };
}
/**
 * Minimum (or maximum) of a function of one variable on an interval, by Brent's golden-section and parabolic
 * search. Equivalent to R's `optimize()`. `optimum` is the location (R's `minimum`/`maximum`) and `objective` the
 * function there. `lower` must be less than `upper`, as in R.
 *
 * @example
 * ```ts
 * optimize((x) => (x - 1 / 3) ** 2, 0, 1).optimum; // 0.3333333333333333
 * ```
 *
 * @category Numerical methods
 */
export function optimize(f, lower, upper, options = {}) {
    const maximum = options.maximum ?? false;
    const tol = options.tol ?? TOL;
    if (!(lower < upper))
        throw new RangeError("'xmin' not less than 'xmax'");
    const r = localMin(maximum ? (x) => -f(x) : f, lower, upper, tol);
    return { optimum: r.x, objective: f(r.x) };
}
/**
 * A root of a function of one variable in an interval, by Brent's zeroin. Equivalent to R's `uniroot()`.
 *
 * @example
 * ```ts
 * uniroot((x) => x * x - 2, 0, 2, { tol: 1e-12 }).root; // 1.4142135623731364
 * ```
 *
 * @category Numerical methods
 */
export function uniroot(f, lower, upper, options = {}) {
    const tol = options.tol ?? TOL;
    const maxiter = options.maxiter ?? 1000;
    const extendInt = options.extendInt ?? "no";
    if (!(lower < upper))
        throw new RangeError("lower < upper  is not fulfilled");
    let fLo = options.fLower ?? f(lower);
    let fUp = options.fUpper ?? f(upper);
    if (Number.isNaN(fLo))
        throw new RangeError("f.lower = f(lower) is NA");
    if (Number.isNaN(fUp))
        throw new RangeError("f.upper = f(upper) is NA");
    // Extend the interval outwards (R's extendInt), in steps that double each time
    const bound = (v) => Math.max(-Number.MAX_VALUE, Math.min(Number.MAX_VALUE, v));
    const step0 = (u) => 0.01 * Math.max(1e-4, Math.abs(u));
    const sig = extendInt === "downX" ? -1 : extendInt === "upX" ? 1 : 0;
    const extend = extendInt === "yes" ? bound(fLo) * bound(fUp) > 0 : sig !== 0 && (sig * bound(fLo) > 0 || sig * bound(fUp) < 0);
    let extIter = 0;
    const count = () => {
        if (++extIter > maxiter)
            throw new RangeError(`no sign change found in ${extIter - 1} iterations`);
    };
    if (extend && extendInt === "yes") {
        let dLo = step0(lower);
        let dUp = step0(upper);
        while (fLo * fUp > 0 && (Number.isFinite(lower) || Number.isFinite(upper))) {
            count();
            if (Number.isFinite(lower)) {
                const x = lower - dLo;
                const fx = f(x);
                if (Number.isNaN(fx))
                    dLo /= 4;
                else
                    [lower, fLo] = [x, fx];
            }
            if (Number.isFinite(upper)) {
                const x = upper + dUp;
                const fx = f(x);
                if (Number.isNaN(fx))
                    dUp /= 4;
                else
                    [upper, fUp] = [x, fx];
            }
            dLo *= 2;
            dUp *= 2;
        }
    }
    else if (extend) {
        let d = step0(lower);
        while (sig * fLo > 0) {
            count();
            lower -= d;
            fLo = f(lower);
            d *= 2;
        }
        d = step0(upper);
        while (sig * fUp < 0) {
            count();
            upper += d;
            fUp = f(upper);
            d *= 2;
        }
    }
    if (!(Math.sign(fLo) * Math.sign(fUp) <= 0)) {
        throw new RangeError(extend ? "did not succeed extending the interval endpoints for f(lower) * f(upper) <= 0" : "f() values at end points not of opposite sign");
    }
    const z = zero((x) => finiteValue(f(x)), lower, upper, finiteValue(fLo), finiteValue(fUp), tol, maxiter);
    return {
        root: z.root,
        fRoot: f(z.root),
        iter: extend ? z.iter + extIter : z.iter,
        initIt: extend ? extIter : NaN,
        estimPrec: z.estimPrec,
    };
}
/** Non-finite values of f are replaced by the largest finite numbers of their sign (NaN by the positive one). */
function finiteValue(v) {
    if (v === -Infinity)
        return -Number.MAX_VALUE;
    return v === Infinity || Number.isNaN(v) ? Number.MAX_VALUE : v;
}
/**
 * A zero of f between a and b, where f(a) and f(b) (given) have opposite signs or one is 0. Port of netlib's
 * public-domain zeroin.f (Brent 1973, chapter 4, procedure zero), with its labelled jumps written as a loop.
 * Adaptations for uniroot: f(a) and f(b) are passed in; an endpoint where f is 0 is returned at once; at most
 * maxiter + 1 passes, `iter` being the number of passes completed before convergence (maxiter if it did not
 * converge); `estimPrec` is the final bracket width |c - b|.
 */
function zero(f, ax, bx, fax, fbx, tol, maxiter) {
    if (fax === 0)
        return { root: ax, iter: 0, estimPrec: 0 };
    if (fbx === 0)
        return { root: bx, iter: 0, estimPrec: 0 };
    const eps = Number.EPSILON;
    let a = ax;
    let b = bx;
    let fa = fax;
    let fb = fbx;
    // zeroin.f label 20: c is the end of the bracket opposite b; d is the latest step, e the one before it
    let c = a;
    let fc = fa;
    let d = b - a;
    let e = d;
    for (let pass = 0; pass <= maxiter; pass++) {
        // R's variant: the interpolation is judged against the step just taken (b - a), not the one before it as in
        // zeroin.f; with zeroin.f's own rule the iterates, and so R's tolerance-limited roots, differ
        e = b - a;
        // label 30: keep b the better estimate, |f(b)| <= |f(c)|
        if (Math.abs(fc) < Math.abs(fb)) {
            a = b;
            b = c;
            c = a;
            fa = fb;
            fb = fc;
            fc = fa;
        }
        // label 40: convergence test
        const tol1 = 2 * eps * Math.abs(b) + 0.5 * tol;
        const xm = 0.5 * (c - b);
        if (Math.abs(xm) <= tol1 || fb === 0)
            return { root: b, iter: pass, estimPrec: Math.abs(c - b) };
        if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
            // label 50: interpolation step p / q
            let s = fb / fa;
            let p;
            let q;
            if (a === c) {
                // linear interpolation
                p = 2 * xm * s;
                q = 1 - s;
            }
            else {
                // inverse quadratic interpolation
                q = fa / fc;
                const r = fb / fc;
                p = s * (2 * xm * q * (q - r) - (b - a) * (r - 1));
                q = (q - 1) * (r - 1) * (s - 1);
            }
            // label 70: make p >= 0
            if (p > 0)
                q = -q;
            else
                p = -p;
            // label 90: accept the interpolation only when it falls well inside the bracket and shrinks fast enough
            s = e;
            e = d;
            if (2 * p >= 3 * xm * q - Math.abs(tol1 * q) || p >= Math.abs(0.5 * s * q)) {
                d = xm;
                e = d;
            }
            else {
                d = p / q;
            }
        }
        else {
            // bisection forced
            d = xm;
            e = d;
        }
        // label 110: take the step, at least tol1
        a = b;
        fa = fb;
        if (Math.abs(d) > tol1)
            b += d;
        else if (xm > 0)
            b += tol1;
        else
            b -= tol1;
        // label 140: new value; when f(b) and f(c) have the same sign, restart the bracket from a (label 20)
        fb = f(b);
        if (fb * (fc / Math.abs(fc)) > 0) {
            c = a;
            fc = fa;
            d = b - a;
            e = d;
        }
    }
    return { root: b, iter: maxiter, estimPrec: Math.abs(c - b) };
}
