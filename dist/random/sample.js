// Random sampling: sample and sampleInt.
//
// Uses uniforms the same way as R's default (sample.kind = "Rejection") and returns the same results as R.
// Weighted sampling sorts the weights in decreasing order and selects by cumulative probability (with replacement,
// when more than 200 candidates have large weights, Walker's (1977) alias method). The sort is a heapsort,
// and the order of equal weights also matches R.
// All of this was verified against observed R output.
import { unifIndex, unifRand } from "./rng.js";
/**
 * Random sample of integers from `0..n-1`. Equivalent to R's `sample.int()`, but 0-based.
 *
 * The result is R's `sample.int(n, ...)` minus 1, so it can be used directly as array
 * indices. It consumes the same random numbers as R (default `sample.kind = "Rejection"`).
 *
 * @param n Number of candidates (a non-negative number less than 2^31).
 * @param options See {@link SampleOptions}.
 * @returns The drawn integers, each in `0..n-1`.
 *
 * @example
 * ```ts
 * setSeed(42);
 * sampleInt(10, { size: 3 }); // [0, 4, 9]  (R: set.seed(42); sample.int(10, 3) - 1)
 * ```
 */
export function sampleInt(n, options = {}) {
    return sampleInt1(n, options).map((v) => v - 1);
}
/** Sample from 1..n (1-based values as in R; internal) */
function sampleInt1(n, options) {
    if (!Number.isFinite(n) || n < 0 || n >= 2 ** 31)
        throw new RangeError("n must be a non-negative number less than 2^31");
    n = Math.trunc(n);
    const { replace = false, prob } = options;
    const sizeGiven = options.size !== undefined;
    const size = sizeGiven ? options.size : n;
    if (!Number.isFinite(size) || size < 0)
        throw new RangeError("size must be a non-negative number");
    const k = Math.trunc(size);
    if (prob !== undefined) {
        if (prob.length !== n)
            throw new TypeError("prob must have length n");
        const p = fixupProb(prob, k, replace);
        if (replace) {
            let nc = 0;
            for (let i = 0; i < n; i++)
                if (n * p[i] > 0.1)
                    nc++;
            return nc > 200 ? walkerSample(p, k) : probSampleReplace(p, k);
        }
        if (k > n)
            throw new RangeError("cannot take a sample larger than the population when replace is false");
        return probSampleNoReplace(p, k);
    }
    if (!replace && k > n)
        throw new RangeError("cannot take a sample larger than the population when replace is false");
    // For sampling without replacement with large n and size <= n/2, R remembers drawn values and redraws duplicates
    if (!replace && n > 1e7 && sizeGiven && k <= n / 2) {
        const seen = new Set();
        const out = [];
        while (out.length < k) {
            const v = unifIndex(n);
            if (seen.has(v))
                continue;
            seen.add(v);
            out.push(v + 1);
        }
        return out;
    }
    const out = new Array(k);
    if (replace || k < 2) {
        for (let i = 0; i < k; i++)
            out[i] = unifIndex(n) + 1;
        return out;
    }
    const x = new Int32Array(n);
    for (let i = 0; i < n; i++)
        x[i] = i;
    let m = n;
    for (let i = 0; i < k; i++) {
        const j = unifIndex(m);
        out[i] = x[j] + 1;
        x[j] = x[--m];
    }
    return out;
}
/**
 * Random sample of the elements of an array. Equivalent to R's `sample()`.
 *
 * Always samples from the elements of `x`. R's special case where a single number `x`
 * means `1:x` is not supported; use {@link sampleInt} for that. Uses the same random
 * numbers as R, so results match R for the same seed.
 *
 * @param x Candidates.
 * @param options See {@link SampleOptions}.
 * @returns The drawn elements of `x`.
 *
 * @example
 * ```ts
 * setSeed(42);
 * sample(["a", "b", "c", "d", "e"]); // ["a", "e", "d", "c", "b"]
 * sample([1, 2, 3], { size: 5, replace: true, prob: [0.5, 0.3, 0.2] });
 * ```
 */
export function sample(x, options = {}) {
    return sampleInt1(x.length, options).map((i) => x[i - 1]);
}
/** Validate the weights and normalise them to sum to 1 */
function fixupProb(prob, k, replace) {
    let sum = 0;
    let npos = 0;
    for (const v of prob) {
        if (!Number.isFinite(v))
            throw new RangeError("prob contains NaN or infinite values");
        if (v < 0)
            throw new RangeError("prob contains negative values");
        if (v > 0) {
            npos++;
            sum += v;
        }
    }
    if (npos === 0 || (!replace && k > npos))
        throw new RangeError("too few positive probabilities");
    return Float64Array.from(prob, (v) => v / sum);
}
/** Sort a in decreasing order, permuting ib alongside (heapsort; ties end up in the same order as R) */
function revsort(a, ib) {
    const n = a.length;
    if (n <= 1)
        return;
    // Written with 1-based indices
    const A = (i) => a[i - 1];
    let l = (n >> 1) + 1;
    let ir = n;
    let ra;
    let ii;
    for (;;) {
        if (l > 1) {
            l = l - 1;
            ra = A(l);
            ii = ib[l - 1];
        }
        else {
            ra = A(ir);
            ii = ib[ir - 1];
            a[ir - 1] = A(1);
            ib[ir - 1] = ib[0];
            if (--ir === 1) {
                a[0] = ra;
                ib[0] = ii;
                return;
            }
        }
        let i = l;
        let j = l << 1;
        while (j <= ir) {
            if (j < ir && A(j) > A(j + 1))
                ++j;
            if (ra > A(j)) {
                a[i - 1] = A(j);
                ib[i - 1] = ib[j - 1];
                i = j;
                j += j;
            }
            else {
                j = ir + 1;
            }
        }
        a[i - 1] = ra;
        ib[i - 1] = ii;
    }
}
function sortedByWeight(p) {
    const perm = new Int32Array(p.length);
    for (let i = 0; i < p.length; i++)
        perm[i] = i + 1;
    revsort(p, perm);
    return perm;
}
function probSampleReplace(prob, k) {
    const p = Float64Array.from(prob);
    const n = p.length;
    const perm = sortedByWeight(p);
    for (let i = 1; i < n; i++)
        p[i] += p[i - 1];
    const out = new Array(k);
    for (let i = 0; i < k; i++) {
        const rU = unifRand();
        let j = 0;
        for (; j < n - 1; j++)
            if (rU <= p[j])
                break;
        out[i] = perm[j];
    }
    return out;
}
function probSampleNoReplace(prob, k) {
    const p = Float64Array.from(prob);
    const n = p.length;
    const perm = sortedByWeight(p);
    const out = new Array(k);
    let totalMass = 1;
    for (let i = 0, n1 = n - 1; i < k; i++, n1--) {
        const rT = totalMass * unifRand();
        let mass = 0;
        let j = 0;
        for (; j < n1; j++) {
            mass += p[j];
            if (rT <= mass)
                break;
        }
        out[i] = perm[j];
        totalMass -= p[j];
        for (let t = j; t < n1; t++) {
            p[t] = p[t + 1];
            perm[t] = perm[t + 1];
        }
    }
    return out;
}
/** Sampling with replacement by Walker's alias method */
function walkerSample(p, k) {
    const n = p.length;
    const q = new Float64Array(n);
    const a = new Int32Array(n);
    // Put candidates with q < 1 in the first part [0, H] of HL and those with q >= 1 in the second part [L, n)
    const HL = new Int32Array(n);
    let H = -1;
    let L = n;
    for (let i = 0; i < n; i++) {
        q[i] = p[i] * n;
        if (q[i] < 1)
            HL[++H] = i;
        else
            HL[--L] = i;
    }
    if (H >= 0 && L < n) {
        for (let t = 0; t < n - 1; t++) {
            const i = HL[t];
            const j = HL[L];
            a[i] = j;
            q[j] += q[i] - 1;
            if (q[j] < 1)
                L++;
            if (L >= n)
                break;
        }
    }
    // Pick candidate t by uniform integer sampling, then use another uniform to choose t or its alias a[t]
    const out = new Array(k);
    for (let i = 0; i < k; i++) {
        const t = unifIndex(n);
        out[i] = unifRand() < q[t] ? t + 1 : a[t] + 1;
    }
    return out;
}
