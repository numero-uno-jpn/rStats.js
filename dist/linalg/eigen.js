// Eigendecomposition (R's eigen).
//
// Symmetric matrices: tridiagonalise by Householder transformations, then diagonalise by the implicit QL method (same procedure as EISPACK's tred2 and tql2).
// Nonsymmetric matrices: reduce to Hessenberg form by Householder transformations, reach real Schur form by Francis's double-shift QR method,
// then compute eigenvectors by back substitution (same procedure as EISPACK's orthes and hqr2).
// The code is modelled on JAMA's EigenvalueDecomposition. EISPACK and JAMA are in the public domain.
// R uses LAPACK's dsyevr and dgeev, so eigenvalues agree to rounding error, while eigenvectors may differ in sign
// (phase for complex ones, orientation for repeated eigenvalues). Unlike dgeev, no balancing (dgebal) is done.
// Argument checks and result shapes follow R's documentation (?eigen) and observed output.
// - If symmetric is omitted, the matrix is treated as symmetric when sum|A - t(A)| / sum|A| <= 100 ε, as R's isSymmetric
// - For symmetric matrices only the lower triangle is used
// - Symmetric: eigenvalues in decreasing order. Nonsymmetric: decreasing absolute value (within a conjugate pair of equal modulus, positive imaginary part first)
// - Eigenvectors are unit-length columns. Complex eigenvectors are phase-normalised so the component of largest modulus is a positive real
//   (LAPACK's dgeev only makes that component real; signs may differ from R)
// - If a nonsymmetric matrix has all real eigenvalues, valuesIm and vectorsIm are omitted (R also returns real results)
// - NaN or Inf is an error
import { fromMat, newMat, requireSquare, toMat } from "./matrix.js";
/**
 * Eigenvalues and eigenvectors of a square matrix. Equivalent to R's `eigen()`.
 *
 * Symmetric matrices use tridiagonalization and the implicit QL method; other matrices use Hessenberg reduction
 * and the Francis double-shift QR method (no balancing). R uses LAPACK, so eigenvalues agree up to rounding, but
 * eigenvector signs may differ from R (both are correct); for repeated eigenvalues the basis may differ.
 * Complex eigenvalues and eigenvectors are returned as separate real and imaginary parts (`valuesIm`,
 * `vectorsIm`). Each complex eigenvector is scaled to unit length with its largest component real and positive.
 * Throws on `NaN` or infinite values.
 *
 * @param x A square matrix (array of rows).
 * @param options See {@link EigenOptions}.
 * @returns The eigenvalues and eigenvectors. See {@link EigenResult}.
 *
 * @example
 * ```ts
 * eigen([[2, 1], [1, 2]]);
 * // values: [3, 1] (up to rounding)
 * // vectors: [[0.7071, 0.7071], [0.7071, -0.7071]] (signs may differ from R)
 *
 * eigen([[0, -1], [1, 0]]);
 * // values: [0, 0], valuesIm: [1, -1]
 * ```
 */
export function eigen(x, options = {}) {
    const a = toMat(x);
    requireSquare(a);
    if (a.nrow === 0)
        throw new RangeError("the matrix has zero dimension");
    for (const v of a.data)
        if (!Number.isFinite(v))
            throw new RangeError("the matrix contains NaN or infinite values");
    const symmetric = options.symmetric ?? isSymmetric(a);
    const wantVectors = !(options.onlyValues ?? false);
    return symmetric ? symmetricEigen(a, wantVectors) : generalEigen(a, wantVectors);
}
/** Same test as R's isSymmetric (all.equal(A, t(A), tolerance = 100 ε)) */
export function isSymmetric(a) {
    const n = a.nrow;
    let diff = 0;
    let size = 0;
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            diff += Math.abs(a.data[i + j * n] - a.data[j + i * n]);
            size += Math.abs(a.data[i + j * n]);
        }
    }
    const tol = 100 * Number.EPSILON;
    const N = n * n;
    const xn = size / N;
    const xy = diff / N;
    return (Number.isFinite(xn) && xn > tol ? xy / xn : xy) <= tol;
}
function symmetricEigen(A, wantVectors) {
    const n = A.nrow;
    // Build a symmetric matrix from the lower triangle (V[i][j] column-major as v[i + j n])
    const V = newMat(n, n);
    for (let j = 0; j < n; j++) {
        for (let i = j; i < n; i++) {
            V.data[i + j * n] = A.data[i + j * n];
            V.data[j + i * n] = A.data[i + j * n];
        }
    }
    const d = new Float64Array(n);
    const e = new Float64Array(n);
    tred2(V, d, e);
    tql2(V, d, e);
    // tql2 sorts in increasing order, so re-sort in decreasing order
    const values = Array.from(d).reverse();
    if (!wantVectors)
        return { values };
    const vec = newMat(n, n);
    for (let j = 0; j < n; j++)
        vec.data.set(V.data.subarray((n - 1 - j) * n, (n - j) * n), j * n);
    return { values, vectors: fromMat(vec) };
}
/** Tridiagonalise a symmetric matrix by Householder transformations (tred2). Overwrites V with the product of the transformations */
function tred2(V, d, e) {
    const n = V.nrow;
    const v = V.data;
    const at = (i, j) => i + j * n;
    for (let j = 0; j < n; j++)
        d[j] = v[at(n - 1, j)];
    for (let i = n - 1; i > 0; i--) {
        let scale = 0;
        let h = 0;
        for (let k = 0; k < i; k++)
            scale += Math.abs(d[k]);
        if (scale === 0) {
            e[i] = d[i - 1];
            for (let j = 0; j < i; j++) {
                d[j] = v[at(i - 1, j)];
                v[at(i, j)] = 0;
                v[at(j, i)] = 0;
            }
        }
        else {
            for (let k = 0; k < i; k++) {
                d[k] /= scale;
                h += d[k] * d[k];
            }
            let f = d[i - 1];
            let g = Math.sqrt(h);
            if (f > 0)
                g = -g;
            e[i] = scale * g;
            h -= f * g;
            d[i - 1] = f - g;
            for (let j = 0; j < i; j++)
                e[j] = 0;
            for (let j = 0; j < i; j++) {
                f = d[j];
                v[at(j, i)] = f;
                g = e[j] + v[at(j, j)] * f;
                for (let k = j + 1; k <= i - 1; k++) {
                    g += v[at(k, j)] * d[k];
                    e[k] += v[at(k, j)] * f;
                }
                e[j] = g;
            }
            f = 0;
            for (let j = 0; j < i; j++) {
                e[j] /= h;
                f += e[j] * d[j];
            }
            const hh = f / (h + h);
            for (let j = 0; j < i; j++)
                e[j] -= hh * d[j];
            for (let j = 0; j < i; j++) {
                f = d[j];
                g = e[j];
                for (let k = j; k <= i - 1; k++)
                    v[at(k, j)] -= f * e[k] + g * d[k];
                d[j] = v[at(i - 1, j)];
                v[at(i, j)] = 0;
            }
        }
        d[i] = h;
    }
    // Accumulate the transformations
    for (let i = 0; i < n - 1; i++) {
        v[at(n - 1, i)] = v[at(i, i)];
        v[at(i, i)] = 1;
        const h = d[i + 1];
        if (h !== 0) {
            for (let k = 0; k <= i; k++)
                d[k] = v[at(k, i + 1)] / h;
            for (let j = 0; j <= i; j++) {
                let g = 0;
                for (let k = 0; k <= i; k++)
                    g += v[at(k, i + 1)] * v[at(k, j)];
                for (let k = 0; k <= i; k++)
                    v[at(k, j)] -= g * d[k];
            }
        }
        for (let k = 0; k <= i; k++)
            v[at(k, i + 1)] = 0;
    }
    for (let j = 0; j < n; j++) {
        d[j] = v[at(n - 1, j)];
        v[at(n - 1, j)] = 0;
    }
    v[at(n - 1, n - 1)] = 1;
    e[0] = 0;
}
/** Diagonalise a symmetric tridiagonal matrix by the implicit QL method (tql2). Sorts eigenvalues increasingly and permutes the columns of V */
function tql2(V, d, e) {
    const n = V.nrow;
    const v = V.data;
    const at = (i, j) => i + j * n;
    for (let i = 1; i < n; i++)
        e[i - 1] = e[i];
    e[n - 1] = 0;
    let f = 0;
    let tst1 = 0;
    const eps = Number.EPSILON;
    for (let l = 0; l < n; l++) {
        // Look for a small subdiagonal element
        tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l]));
        let m = l;
        while (m < n - 1 && Math.abs(e[m]) > eps * tst1)
            m++;
        if (m > l) {
            let iter = 0;
            do {
                if (++iter > 100)
                    throw new Error("the eigendecomposition did not converge");
                // Choose the shift
                let g = d[l];
                let p = (d[l + 1] - g) / (2 * e[l]);
                let r = Math.hypot(p, 1);
                if (p < 0)
                    r = -r;
                d[l] = e[l] / (p + r);
                d[l + 1] = e[l] * (p + r);
                const dl1 = d[l + 1];
                let h = g - d[l];
                for (let i = l + 2; i < n; i++)
                    d[i] -= h;
                f += h;
                // Implicit QL transformation
                p = d[m];
                let c = 1;
                let c2 = c;
                let c3 = c;
                const el1 = e[l + 1];
                let s = 0;
                let s2 = 0;
                for (let i = m - 1; i >= l; i--) {
                    c3 = c2;
                    c2 = c;
                    s2 = s;
                    g = c * e[i];
                    h = c * p;
                    r = Math.hypot(p, e[i]);
                    e[i + 1] = s * r;
                    s = e[i] / r;
                    c = p / r;
                    p = c * d[i] - s * g;
                    d[i + 1] = h + s * (c * g + s * d[i]);
                    for (let k = 0; k < n; k++) {
                        h = v[at(k, i + 1)];
                        v[at(k, i + 1)] = s * v[at(k, i)] + c * h;
                        v[at(k, i)] = c * v[at(k, i)] - s * h;
                    }
                }
                p = (-s * s2 * c3 * el1 * e[l]) / dl1;
                e[l] = s * p;
                d[l] = c * p;
            } while (Math.abs(e[l]) > eps * tst1);
        }
        d[l] = d[l] + f;
        e[l] = 0;
    }
    // Sort in increasing order (eigenvectors too)
    for (let i = 0; i < n - 1; i++) {
        let k = i;
        let p = d[i];
        for (let j = i + 1; j < n; j++) {
            if (d[j] < p) {
                k = j;
                p = d[j];
            }
        }
        if (k !== i) {
            d[k] = d[i];
            d[i] = p;
            for (let j = 0; j < n; j++) {
                const t = v[at(j, i)];
                v[at(j, i)] = v[at(j, k)];
                v[at(j, k)] = t;
            }
        }
    }
}
function generalEigen(A, wantVectors) {
    const n = A.nrow;
    const H = { nrow: n, ncol: n, data: A.data.slice() };
    const V = newMat(n, n);
    const d = new Float64Array(n);
    const e = new Float64Array(n);
    orthes(H, V);
    hqr2(H, V, d, e);
    // Sort by decreasing absolute value (ties keep original order; conjugate pairs already have the positive imaginary part first)
    const mod = Array.from(d, (re, i) => Math.hypot(re, e[i]));
    const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => mod[j] - mod[i] || i - j);
    const complex = e.some((v) => v !== 0);
    const out = { values: order.map((i) => d[i]) };
    if (complex)
        out.valuesIm = order.map((i) => e[i]);
    if (!wantVectors)
        return out;
    // Eigenvectors: real eigenvalues use columns of V; a complex pair (j, j+1) gives V[:, j] ± i V[:, j+1]
    const re = newMat(n, n);
    const im = newMat(n, n);
    for (let j = 0; j < n; j++) {
        const vj = V.data.subarray(j * n, (j + 1) * n);
        if (e[j] === 0) {
            re.data.set(vj, j * n);
        }
        else if (e[j] > 0) {
            const vk = V.data.subarray((j + 1) * n, (j + 2) * n);
            re.data.set(vj, j * n);
            im.data.set(vk, j * n);
            re.data.set(vj, (j + 1) * n);
            for (let i = 0; i < n; i++)
                im.data[i + (j + 1) * n] = -vk[i];
        }
    }
    normalizeVectors(re, im);
    const sre = newMat(n, n);
    const sim = newMat(n, n);
    order.forEach((src, j) => {
        sre.data.set(re.data.subarray(src * n, (src + 1) * n), j * n);
        sim.data.set(im.data.subarray(src * n, (src + 1) * n), j * n);
    });
    out.vectors = fromMat(sre);
    if (complex)
        out.vectorsIm = fromMat(sim);
    return out;
}
/** Normalise each column to unit length and rotate its phase so the component of largest modulus is a positive real */
function normalizeVectors(re, im) {
    const n = re.nrow;
    for (let j = 0; j < n; j++) {
        const o = j * n;
        let ss = 0;
        let k = 0;
        let big = -1;
        for (let i = 0; i < n; i++) {
            const m = Math.hypot(re.data[o + i], im.data[o + i]);
            ss += m * m;
            if (m > big) {
                big = m;
                k = i;
            }
        }
        const norm = Math.sqrt(ss);
        if (norm === 0)
            continue;
        // Multiplying by (cr - i ci) / (|v_k| norm) makes v_k a positive real
        const cr = re.data[o + k] / big / norm;
        const ci = -im.data[o + k] / big / norm;
        for (let i = 0; i < n; i++) {
            const a = re.data[o + i];
            const b = im.data[o + i];
            re.data[o + i] = a * cr - b * ci;
            im.data[o + i] = a * ci + b * cr;
        }
        im.data[o + k] = 0;
    }
}
/** Reduce to Hessenberg form by Householder transformations (orthes). V becomes the product of the transformations */
function orthes(H, V) {
    const n = H.nrow;
    const h = H.data;
    const v = V.data;
    const at = (i, j) => i + j * n;
    const ort = new Float64Array(n);
    const low = 0;
    const high = n - 1;
    for (let m = low + 1; m <= high - 1; m++) {
        let scale = 0;
        for (let i = m; i <= high; i++)
            scale += Math.abs(h[at(i, m - 1)]);
        if (scale === 0)
            continue;
        let hh = 0;
        for (let i = high; i >= m; i--) {
            ort[i] = h[at(i, m - 1)] / scale;
            hh += ort[i] * ort[i];
        }
        let g = Math.sqrt(hh);
        if (ort[m] > 0)
            g = -g;
        hh -= ort[m] * g;
        ort[m] = ort[m] - g;
        // H = (I - u u^T / h) H (I - u u^T / h)
        for (let j = m; j < n; j++) {
            let f = 0;
            for (let i = high; i >= m; i--)
                f += ort[i] * h[at(i, j)];
            f /= hh;
            for (let i = m; i <= high; i++)
                h[at(i, j)] -= f * ort[i];
        }
        for (let i = 0; i <= high; i++) {
            let f = 0;
            for (let j = high; j >= m; j--)
                f += ort[j] * h[at(i, j)];
            f /= hh;
            for (let j = m; j <= high; j++)
                h[at(i, j)] -= f * ort[j];
        }
        ort[m] = scale * ort[m];
        h[at(m, m - 1)] = scale * g;
    }
    // Accumulate the transformations
    for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
            v[at(i, j)] = i === j ? 1 : 0;
    for (let m = high - 1; m >= low + 1; m--) {
        if (h[at(m, m - 1)] === 0)
            continue;
        for (let i = m + 1; i <= high; i++)
            ort[i] = h[at(i, m - 1)];
        for (let j = m; j <= high; j++) {
            let g = 0;
            for (let i = m; i <= high; i++)
                g += ort[i] * v[at(i, j)];
            // Divide in two steps (avoids underflow to 0)
            g = g / ort[m] / h[at(m, m - 1)];
            for (let i = m; i <= high; i++)
                v[at(i, j)] += g * ort[i];
        }
    }
}
/** Complex division (xr + i xi) / (yr + i yi) (Smith's method) */
function cdiv(xr, xi, yr, yi) {
    if (Math.abs(yr) > Math.abs(yi)) {
        const r = yi / yr;
        const d = yr + r * yi;
        return [(xr + r * xi) / d, (xi - r * xr) / d];
    }
    const r = yr / yi;
    const d = yi + r * yr;
    return [(r * xr + xi) / d, (r * xi - xr) / d];
}
/**
 * Reduce a Hessenberg matrix to real Schur form by the double-shift QR method and compute eigenvalues (d + i e) and eigenvectors (columns of V) (hqr2).
 * For a complex pair, the eigenvector of d[j] + i e[j] (e[j] > 0) is V[:, j] + i V[:, j+1]
 */
function hqr2(Hm, Vm, d, e) {
    const nn = Hm.nrow;
    const H = Hm.data;
    const V = Vm.data;
    const at = (i, j) => i + j * nn;
    let n = nn - 1;
    const low = 0;
    const high = nn - 1;
    const eps = Number.EPSILON;
    let exshift = 0;
    let p = 0;
    let q = 0;
    let r = 0;
    let s = 0;
    let z = 0;
    let t;
    let w;
    let x;
    let y;
    let norm = 0;
    for (let i = 0; i < nn; i++)
        for (let j = Math.max(i - 1, 0); j < nn; j++)
            norm += Math.abs(H[at(i, j)]);
    let iter = 0;
    let total = 0;
    while (n >= low) {
        // Look for a small subdiagonal element
        let l = n;
        while (l > low) {
            s = Math.abs(H[at(l - 1, l - 1)]) + Math.abs(H[at(l, l)]);
            if (s === 0)
                s = norm;
            if (Math.abs(H[at(l, l - 1)]) < eps * s)
                break;
            l--;
        }
        if (l === n) {
            // One eigenvalue found
            H[at(n, n)] = H[at(n, n)] + exshift;
            d[n] = H[at(n, n)];
            e[n] = 0;
            n--;
            iter = 0;
        }
        else if (l === n - 1) {
            // Two eigenvalues found
            w = H[at(n, n - 1)] * H[at(n - 1, n)];
            p = (H[at(n - 1, n - 1)] - H[at(n, n)]) / 2;
            q = p * p + w;
            z = Math.sqrt(Math.abs(q));
            H[at(n, n)] = H[at(n, n)] + exshift;
            H[at(n - 1, n - 1)] = H[at(n - 1, n - 1)] + exshift;
            x = H[at(n, n)];
            if (q >= 0) {
                // Real pair
                z = p >= 0 ? p + z : p - z;
                d[n - 1] = x + z;
                d[n] = d[n - 1];
                if (z !== 0)
                    d[n] = x - w / z;
                e[n - 1] = 0;
                e[n] = 0;
                x = H[at(n, n - 1)];
                s = Math.abs(x) + Math.abs(z);
                p = x / s;
                q = z / s;
                r = Math.sqrt(p * p + q * q);
                p /= r;
                q /= r;
                for (let j = n - 1; j < nn; j++) {
                    z = H[at(n - 1, j)];
                    H[at(n - 1, j)] = q * z + p * H[at(n, j)];
                    H[at(n, j)] = q * H[at(n, j)] - p * z;
                }
                for (let i = 0; i <= n; i++) {
                    z = H[at(i, n - 1)];
                    H[at(i, n - 1)] = q * z + p * H[at(i, n)];
                    H[at(i, n)] = q * H[at(i, n)] - p * z;
                }
                for (let i = low; i <= high; i++) {
                    z = V[at(i, n - 1)];
                    V[at(i, n - 1)] = q * z + p * V[at(i, n)];
                    V[at(i, n)] = q * V[at(i, n)] - p * z;
                }
            }
            else {
                // Complex pair
                d[n - 1] = x + p;
                d[n] = x + p;
                e[n - 1] = z;
                e[n] = -z;
            }
            n -= 2;
            iter = 0;
        }
        else {
            // Not converged yet: choose the shift
            x = H[at(n, n)];
            y = 0;
            w = 0;
            if (l < n) {
                y = H[at(n - 1, n - 1)];
                w = H[at(n, n - 1)] * H[at(n - 1, n)];
            }
            // Wilkinson's exceptional shift
            if (iter === 10) {
                exshift += x;
                for (let i = low; i <= n; i++)
                    H[at(i, i)] -= x;
                s = Math.abs(H[at(n, n - 1)]) + Math.abs(H[at(n - 1, n - 2)]);
                x = y = 0.75 * s;
                w = -0.4375 * s * s;
            }
            // MATLAB's exceptional shift
            if (iter === 30) {
                s = (y - x) / 2;
                s = s * s + w;
                if (s > 0) {
                    s = Math.sqrt(s);
                    if (y < x)
                        s = -s;
                    s = x - w / ((y - x) / 2 + s);
                    for (let i = low; i <= n; i++)
                        H[at(i, i)] -= s;
                    exshift += s;
                    x = y = w = 0.964;
                }
            }
            iter++;
            if (++total > 100 * nn)
                throw new Error("the eigendecomposition did not converge");
            // Look for two consecutive small subdiagonal elements
            let m = n - 2;
            while (m >= l) {
                z = H[at(m, m)];
                r = x - z;
                s = y - z;
                p = (r * s - w) / H[at(m + 1, m)] + H[at(m, m + 1)];
                q = H[at(m + 1, m + 1)] - z - r - s;
                r = H[at(m + 2, m + 1)];
                s = Math.abs(p) + Math.abs(q) + Math.abs(r);
                p /= s;
                q /= s;
                r /= s;
                if (m === l)
                    break;
                if (Math.abs(H[at(m, m - 1)]) * (Math.abs(q) + Math.abs(r)) <
                    eps * (Math.abs(p) * (Math.abs(H[at(m - 1, m - 1)]) + Math.abs(z) + Math.abs(H[at(m + 1, m + 1)])))) {
                    break;
                }
                m--;
            }
            for (let i = m + 2; i <= n; i++) {
                H[at(i, i - 2)] = 0;
                if (i > m + 2)
                    H[at(i, i - 3)] = 0;
            }
            // Double QR step on rows l..n, columns m..n
            for (let k = m; k <= n - 1; k++) {
                const notlast = k !== n - 1;
                if (k !== m) {
                    p = H[at(k, k - 1)];
                    q = H[at(k + 1, k - 1)];
                    r = notlast ? H[at(k + 2, k - 1)] : 0;
                    x = Math.abs(p) + Math.abs(q) + Math.abs(r);
                    if (x === 0)
                        continue;
                    p /= x;
                    q /= x;
                    r /= x;
                }
                s = Math.sqrt(p * p + q * q + r * r);
                if (p < 0)
                    s = -s;
                if (s !== 0) {
                    if (k !== m)
                        H[at(k, k - 1)] = -s * x;
                    else if (l !== m)
                        H[at(k, k - 1)] = -H[at(k, k - 1)];
                    p += s;
                    x = p / s;
                    y = q / s;
                    z = r / s;
                    q /= p;
                    r /= p;
                    for (let j = k; j < nn; j++) {
                        p = H[at(k, j)] + q * H[at(k + 1, j)];
                        if (notlast) {
                            p += r * H[at(k + 2, j)];
                            H[at(k + 2, j)] = H[at(k + 2, j)] - p * z;
                        }
                        H[at(k, j)] = H[at(k, j)] - p * x;
                        H[at(k + 1, j)] = H[at(k + 1, j)] - p * y;
                    }
                    for (let i = 0; i <= Math.min(n, k + 3); i++) {
                        p = x * H[at(i, k)] + y * H[at(i, k + 1)];
                        if (notlast) {
                            p += z * H[at(i, k + 2)];
                            H[at(i, k + 2)] = H[at(i, k + 2)] - p * r;
                        }
                        H[at(i, k)] = H[at(i, k)] - p;
                        H[at(i, k + 1)] = H[at(i, k + 1)] - p * q;
                    }
                    for (let i = low; i <= high; i++) {
                        p = x * V[at(i, k)] + y * V[at(i, k + 1)];
                        if (notlast) {
                            p += z * V[at(i, k + 2)];
                            V[at(i, k + 2)] = V[at(i, k + 2)] - p * r;
                        }
                        V[at(i, k)] = V[at(i, k)] - p;
                        V[at(i, k + 1)] = V[at(i, k + 1)] - p * q;
                    }
                }
            }
        }
    }
    // Eigenvectors of the upper triangular (real Schur) form by back substitution
    if (norm === 0)
        return;
    for (n = nn - 1; n >= 0; n--) {
        p = d[n];
        q = e[n];
        if (q === 0) {
            // Real vector
            let l = n;
            H[at(n, n)] = 1;
            for (let i = n - 1; i >= 0; i--) {
                w = H[at(i, i)] - p;
                r = 0;
                for (let j = l; j <= n; j++)
                    r += H[at(i, j)] * H[at(j, n)];
                if (e[i] < 0) {
                    z = w;
                    s = r;
                }
                else {
                    l = i;
                    if (e[i] === 0) {
                        H[at(i, n)] = w !== 0 ? -r / w : -r / (eps * norm);
                    }
                    else {
                        x = H[at(i, i + 1)];
                        y = H[at(i + 1, i)];
                        q = (d[i] - p) * (d[i] - p) + e[i] * e[i];
                        t = (x * s - z * r) / q;
                        H[at(i, n)] = t;
                        H[at(i + 1, n)] = Math.abs(x) > Math.abs(z) ? (-r - w * t) / x : (-s - y * t) / z;
                    }
                    // Guard against overflow
                    t = Math.abs(H[at(i, n)]);
                    if (eps * t * t > 1)
                        for (let j = i; j <= n; j++)
                            H[at(j, n)] = H[at(j, n)] / t;
                }
            }
        }
        else if (q < 0) {
            // Complex vector (at the second position n of the pair, build the real and imaginary parts in columns n-1 and n)
            let l = n - 1;
            if (Math.abs(H[at(n, n - 1)]) > Math.abs(H[at(n - 1, n)])) {
                H[at(n - 1, n - 1)] = q / H[at(n, n - 1)];
                H[at(n - 1, n)] = -(H[at(n, n)] - p) / H[at(n, n - 1)];
            }
            else {
                [H[at(n - 1, n - 1)], H[at(n - 1, n)]] = cdiv(0, -H[at(n - 1, n)], H[at(n - 1, n - 1)] - p, q);
            }
            H[at(n, n - 1)] = 0;
            H[at(n, n)] = 1;
            for (let i = n - 2; i >= 0; i--) {
                let ra = 0;
                let sa = 0;
                for (let j = l; j <= n; j++) {
                    ra += H[at(i, j)] * H[at(j, n - 1)];
                    sa += H[at(i, j)] * H[at(j, n)];
                }
                w = H[at(i, i)] - p;
                if (e[i] < 0) {
                    z = w;
                    r = ra;
                    s = sa;
                }
                else {
                    l = i;
                    if (e[i] === 0) {
                        [H[at(i, n - 1)], H[at(i, n)]] = cdiv(-ra, -sa, w, q);
                    }
                    else {
                        x = H[at(i, i + 1)];
                        y = H[at(i + 1, i)];
                        let vr = (d[i] - p) * (d[i] - p) + e[i] * e[i] - q * q;
                        const vi = (d[i] - p) * 2 * q;
                        if (vr === 0 && vi === 0)
                            vr = eps * norm * (Math.abs(w) + Math.abs(q) + Math.abs(x) + Math.abs(y) + Math.abs(z));
                        [H[at(i, n - 1)], H[at(i, n)]] = cdiv(x * r - z * ra + q * sa, x * s - z * sa - q * ra, vr, vi);
                        if (Math.abs(x) > Math.abs(z) + Math.abs(q)) {
                            H[at(i + 1, n - 1)] = (-ra - w * H[at(i, n - 1)] + q * H[at(i, n)]) / x;
                            H[at(i + 1, n)] = (-sa - w * H[at(i, n)] - q * H[at(i, n - 1)]) / x;
                        }
                        else {
                            [H[at(i + 1, n - 1)], H[at(i + 1, n)]] = cdiv(-r - y * H[at(i, n - 1)], -s - y * H[at(i, n)], z, q);
                        }
                    }
                    // Guard against overflow
                    t = Math.max(Math.abs(H[at(i, n - 1)]), Math.abs(H[at(i, n)]));
                    if (eps * t * t > 1) {
                        for (let j = i; j <= n; j++) {
                            H[at(j, n - 1)] = H[at(j, n - 1)] / t;
                            H[at(j, n)] = H[at(j, n)] / t;
                        }
                    }
                }
            }
        }
    }
    // Transform back to the eigenvectors of the original matrix
    for (let j = nn - 1; j >= low; j--) {
        for (let i = low; i <= high; i++) {
            z = 0;
            for (let k = low; k <= Math.min(j, high); k++)
                z += V[at(i, k)] * H[at(k, j)];
            V[at(i, j)] = z;
        }
    }
}
