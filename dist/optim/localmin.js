// One-dimensional minimisation without derivatives (localmin from Brent 1973, "Algorithms for Minimization without
// Derivatives", chapter 5), the algorithm behind R's optimize(). Golden-section search combined with successive
// parabolic interpolation. The procedure follows the ALGOL 60 procedure in Brent's book (the same as netlib's
// fmin.f, public domain), written for rStats.js.
/** Default tolerance .Machine$double.eps^0.25, as in R's optimize */
export const LOCALMIN_TOL = Math.pow(Number.EPSILON, 0.25);
/**
 * A local minimum of f in [lower, upper], to within about 3 tol + 2 sqrt(eps) |x| (Brent's localmin).
 *
 * @param tol - Tolerance (default .Machine$double.eps^0.25).
 */
export function localMin(f, lower, upper, tol = LOCALMIN_TOL) {
    const c = 0.5 * (3 - Math.sqrt(5));
    const eps = Math.sqrt(Number.EPSILON);
    let a = lower;
    let b = upper;
    let v = a + c * (b - a);
    let w = v;
    let x = v;
    let d = 0;
    let e = 0;
    let fx = f(x);
    let fv = fx;
    let fw = fx;
    let evaluations = 1;
    const tol3 = tol / 3;
    for (;;) {
        const xm = 0.5 * (a + b);
        const tol1 = eps * Math.abs(x) + tol3;
        const t2 = 2 * tol1;
        // stopping criterion
        if (Math.abs(x - xm) <= t2 - 0.5 * (b - a))
            break;
        let golden = true;
        if (Math.abs(e) > tol1) {
            // fit a parabola through (v, fv), (w, fw), (x, fx)
            let r = (x - w) * (fx - fv);
            let q = (x - v) * (fx - fw);
            let p = (x - v) * q - (x - w) * r;
            q = 2 * (q - r);
            if (q > 0)
                p = -p;
            else
                q = -q;
            r = e;
            e = d;
            if (Math.abs(p) < Math.abs(0.5 * q * r) && p > q * (a - x) && p < q * (b - x)) {
                // parabolic interpolation step
                d = p / q;
                const u = x + d;
                // f must not be evaluated too close to a or b
                if (u - a < t2 || b - u < t2)
                    d = x <= xm ? tol1 : -tol1; // sign(tol1, xm - x), + for 0
                golden = false;
            }
        }
        if (golden) {
            // golden-section step
            e = x < xm ? b - x : a - x;
            d = c * e;
        }
        // f must not be evaluated too close to x
        const u = Math.abs(d) >= tol1 ? x + d : d >= 0 ? x + tol1 : x - tol1; // x + sign(tol1, d)
        const fu = f(u);
        evaluations++;
        // update a, b, v, w and x
        if (fu <= fx) {
            if (u < x)
                b = x;
            else
                a = x;
            v = w;
            fv = fw;
            w = x;
            fw = fx;
            x = u;
            fx = fu;
        }
        else {
            if (u < x)
                a = u;
            else
                b = u;
            if (fu <= fw || w === x) {
                v = w;
                fv = fw;
                w = u;
                fw = fu;
            }
            else if (fu <= fv || v === x || v === w) {
                v = u;
                fv = fu;
            }
        }
    }
    return { x, fx, evaluations };
}
