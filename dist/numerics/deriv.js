// Numerical derivatives: numDeriv's grad, jacobian and hessian (methods "Richardson" and "simple").
//
// Written for rStats.js from the textbook methods (no ported code); the defaults and the choice of steps follow
// numDeriv's documentation so the results agree with it. Richardson: central differences with steps h, h/2, ...,
// h/2^(r-1), h = d |x_i| (eps where |x_i| is below zeroTol), combined by Richardson extrapolation
// A <- (4^m A(h/2) - A(h)) / (4^m - 1) for m = 1, ..., r - 1. The Hessian is that of Bates and Watts (1988): the
// diagonal from second central differences, the off-diagonal entries from differences along e_i + e_j less the
// diagonal terms, each extrapolated the same way (with d = 0.1). "simple" is the forward difference with step eps.
// numDeriv's "complex" (complex-step) method needs a function of a complex argument and is not offered.
function checkEps(eps) {
    if (!(Number.isFinite(eps) && eps !== 0))
        throw new RangeError("'eps' must be a finite nonzero number");
}
/** The step of method "simple" */
function simpleEps(options) {
    const eps = options.eps ?? 1e-4;
    checkEps(eps);
    return eps;
}
function steps(x, options, d0) {
    const eps = options.eps ?? 1e-4;
    const d = options.d ?? d0;
    const zeroTol = options.zeroTol ?? Math.sqrt(Number.EPSILON / 7e-7);
    // a step of 0 or a non-finite step defines no difference quotient (numDeriv: an error for d = 0, NaN for eps = 0);
    // negative steps are differences taken the other way, as in numDeriv
    if (!(Number.isFinite(d) && d !== 0))
        throw new RangeError("'d' must be a finite nonzero number");
    checkEps(eps);
    if (!(Number.isFinite(zeroTol) && zeroTol >= 0))
        throw new RangeError("'zeroTol' must be a non-negative finite number");
    const r = options.r ?? 4;
    if (!(Number.isInteger(r) && r >= 1))
        throw new RangeError("'r' must be a positive integer");
    // from r = 513 on the extrapolation's 4^m overflows (m = 512) and every result is NaN, as in numDeriv; its O(r^2)
    // steps would not end for a huge r
    if (r > 512)
        throw new RangeError("'r' must be at most 512");
    const h0 = x.map((v) => Math.abs(d * v) + (Math.abs(v) < zeroTol ? eps : 0));
    // a step of 0 or a non-finite step defines no difference quotient: d abs(x[i]) overflowing (#213), or 0 for
    // x[i] = 0 with zeroTol 0 (#246) (numDeriv: NaN from jacobian and hessian, an error from grad's check of f)
    h0.forEach((h, i) => {
        if (!(Math.abs(h) > 0 && Math.abs(h) < Infinity))
            throw new RangeError(`the step for x[${i}] is ${h}: not a nonzero finite number`);
    });
    return { eps, r, h0 };
}
/** Richardson extrapolation of approximations at steps h, h/2, h/4, ... (errors in even powers of h) */
function extrapolate(a) {
    const t = [...a];
    for (let m = 1; m < t.length; m++) {
        const p = 4 ** m;
        for (let k = 0; k < t.length - m; k++)
            t[k] = (t[k + 1] * p - t[k]) / (p - 1);
    }
    return t[0];
}
function shifted(x, i, h) {
    const y = [...x];
    y[i] = y[i] + h;
    return y;
}
function method(options) {
    const m = options.method ?? "Richardson";
    if (m !== "Richardson" && m !== "simple")
        throw new RangeError(`unknown method "${String(m)}" (expected "Richardson" or "simple")`);
    return m;
}
/**
 * Gradient of a scalar function of a vector. Equivalent to `numDeriv::grad(func, x, method)` in R.
 *
 * @example
 * ```ts
 * grad((x) => x[0]! ** 2 + Math.sin(x[1]!), [1, 0]); // [2, 1]
 * ```
 *
 * @category Numerical methods
 */
export function grad(func, x, options = {}) {
    const xs = [...x];
    const n = xs.length;
    if (method(options) === "simple") {
        const eps = simpleEps(options);
        const f0 = func([...xs]);
        return xs.map((_, i) => (func(shifted(xs, i, eps)) - f0) / eps);
    }
    const { r, h0 } = steps(xs, options, 1e-4);
    const out = [];
    for (let i = 0; i < n; i++) {
        const a = [];
        let h = h0[i];
        for (let k = 0; k < r; k++) {
            // a central difference below 1e-20 is taken as 0 at the smaller steps (functions unstable near 0), as numDeriv does
            if (k > 0 && Math.abs(a[k - 1]) < 1e-20)
                a.push(0);
            else
                a.push((func(shifted(xs, i, h)) - func(shifted(xs, i, -h))) / (2 * h));
            if (Number.isNaN(a[k]))
                throw new RangeError(`func returned NaN at step ${h} from x`);
            h /= 2;
        }
        out.push(extrapolate(a));
    }
    return out;
}
/**
 * Jacobian of a vector function of a vector: row i holds the derivatives of the i-th value. Equivalent to
 * `numDeriv::jacobian(func, x, method)` in R.
 *
 * @example
 * ```ts
 * jacobian((x) => [x[0]! * x[1]!, x[0]! + 2 * x[1]!], [2, 3]); // [[3, 2], [1, 2]]
 * ```
 *
 * @category Numerical methods
 */
export function jacobian(func, x, options = {}) {
    const xs = [...x];
    const n = xs.length;
    const f0 = Array.from(func([...xs]));
    const J = f0.map(() => new Array(n).fill(NaN));
    // every evaluation must return as many values as f0: shorter ones gave NaN rows, longer ones were cut (issue #356)
    const evaluate = (at) => {
        const v = func(at);
        if (v.length !== f0.length)
            throw new RangeError(`jacobian: func returned ${v.length} values at a shifted x, but ${f0.length} at x`);
        return v;
    };
    if (method(options) === "simple") {
        const eps = simpleEps(options);
        for (let j = 0; j < n; j++) {
            const f1 = evaluate(shifted(xs, j, eps));
            f0.forEach((v, i) => (J[i][j] = (f1[i] - v) / eps));
        }
        return J;
    }
    const { r, h0 } = steps(xs, options, 1e-4);
    for (let j = 0; j < n; j++) {
        const a = f0.map(() => []);
        let h = h0[j];
        for (let k = 0; k < r; k++) {
            const fp = evaluate(shifted(xs, j, h));
            const fm = evaluate(shifted(xs, j, -h));
            f0.forEach((_, i) => a[i].push((fp[i] - fm[i]) / (2 * h)));
            h /= 2;
        }
        f0.forEach((_, i) => (J[i][j] = extrapolate(a[i])));
    }
    return J;
}
/**
 * Hessian matrix of a scalar function of a vector, by Richardson extrapolation (Bates and Watts). Equivalent to
 * `numDeriv::hessian(func, x)` in R.
 *
 * @example
 * ```ts
 * hessian((x) => x[0]! ** 2 * x[1]! ** 2, [1, 2]); // [[8, 8], [8, 2]]
 * ```
 *
 * @category Numerical methods
 */
export function hessian(func, x, options = {}) {
    if ((options.method ?? "Richardson") !== "Richardson")
        throw new RangeError('hessian supports only method "Richardson"');
    const xs = [...x];
    const n = xs.length;
    const { r, h0 } = steps(xs, options, 0.1);
    const f0 = func([...xs]);
    const diag = [];
    for (let i = 0; i < n; i++) {
        const a = [];
        let h = h0[i];
        for (let k = 0; k < r; k++) {
            const fp = func(shifted(xs, i, h));
            const fm = func(shifted(xs, i, -h));
            const num = fp - 2 * f0 + fm;
            // where h^2 overflows (h beyond 1.3e154), divided by h twice: a finite curvature was 0 or NaN (issue #214)
            const h2 = h ** 2;
            // where the sum of finite values overflows (f(+-1e200) near 1e308), every term divided by h first (issue #504)
            if (!Number.isFinite(num) && Number.isFinite(fp) && Number.isFinite(fm) && Number.isFinite(f0))
                a.push((fp / h - 2 * (f0 / h) + fm / h) / h);
            else
                a.push(Number.isFinite(h2) ? num / h2 : num / h / h);
            h /= 2;
        }
        diag.push(extrapolate(a));
    }
    const H = xs.map(() => new Array(n).fill(NaN));
    for (let i = 0; i < n; i++) {
        H[i][i] = diag[i];
        for (let j = 0; j < i; j++) {
            const a = [];
            let hi = h0[i];
            let hj = h0[j];
            for (let k = 0; k < r; k++) {
                const up = shifted(shifted(xs, i, hi), j, hj);
                const down = shifted(shifted(xs, i, -hi), j, -hj);
                const fu = func(up);
                const fd = func(down);
                const num = fu - 2 * f0 + fd;
                const den = 2 * hi * hj;
                // where the sum of finite values overflows, every term divided by hi hj first (issue #504)
                if (!Number.isFinite(num) && Number.isFinite(fu) && Number.isFinite(fd) && Number.isFinite(f0)) {
                    a.push((fu / hi / hj - 2 * (f0 / hi / hj) + fd / hi / hj - diag[i] * (hi / hj) - diag[j] * (hj / hi)) / 2);
                }
                else if (Number.isFinite(den) && Number.isFinite(hi ** 2) && Number.isFinite(hj ** 2))
                    a.push((num - diag[i] * hi ** 2 - diag[j] * hj ** 2) / den);
                // where a squared step or 2 hi hj overflows, every term divided by hi hj first (issue #214)
                else
                    a.push((num / hi / hj - diag[i] * (hi / hj) - diag[j] * (hj / hi)) / 2);
                hi /= 2;
                hj /= 2;
            }
            H[i][j] = H[j][i] = extrapolate(a);
        }
    }
    return H;
}
