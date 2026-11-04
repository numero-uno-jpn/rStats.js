// Matrix arithmetic and construction: R's %*% (matMul), element-wise +, -, *, / with R's recycling (add, subtract,
// multiply, divide), outer, t, diag, cbind, rbind (also of data frames: src/descriptive/dataFrames.ts), matrix,
// kronecker and seq.
//
// Written for rStats.js (no ported code). Matrices are arrays of rows, as everywhere in rStats.js; a plain array is a
// vector, which R treats as a row or a column as the operation needs. Element-wise operations recycle a shorter
// vector over a matrix in column-major order (R's storage order), as R does.
import { cbindFrames, rbindFrames } from "../descriptive/dataFrames.js";
import { maxOf } from "../internal/extremes.js";
import { checkDot, checkedDot } from "./dot.js";
function isMatrix(x) {
    return typeof x !== "number" && x.length > 0 && Array.isArray(x[0]);
}
function asVector(x) {
    return typeof x === "number" ? [x] : Array.from(x);
}
function checkRows(x) {
    const nc = x[0].length;
    if (x.some((r) => r.length !== nc))
        throw new TypeError("all rows of the matrix must have the same length");
    return nc;
}
/**
 * Matrix product. Equivalent to R's `%*%`. A vector is taken as a row or a column so that the product is defined
 * (two vectors give their inner product as a 1 x 1 matrix).
 *
 * @example
 * ```ts
 * matMul([[1, 2], [3, 4]], [[5], [6]]); // [[17], [39]]
 * matMul([1, 2, 3], [4, 5, 6]);         // [[32]]
 * ```
 *
 * @category Linear algebra
 */
export function matMul(x, y) {
    let a;
    let b;
    if (isMatrix(x) && isMatrix(y)) {
        a = x.map((r) => [...r]);
        b = y.map((r) => [...r]);
    }
    else if (isMatrix(x)) {
        const v = asVector(y);
        const nc = checkRows(x);
        a = x.map((r) => [...r]);
        b = nc === v.length ? v.map((t) => [t]) : nc === 1 ? [v] : [];
    }
    else if (isMatrix(y)) {
        const v = asVector(x);
        b = y.map((r) => [...r]);
        a = y.length === v.length ? [v] : y.length === 1 ? v.map((t) => [t]) : [];
    }
    else {
        const u = asVector(x);
        const v = asVector(y);
        if (u.length === v.length) {
            a = [u];
            b = v.map((t) => [t]);
        }
        else if (u.length === 1) {
            a = [u];
            b = [v];
        }
        else if (v.length === 1) {
            a = u.map((t) => [t]);
            b = [v];
        }
        else
            throw new RangeError("non-conformable arguments");
    }
    const n = a[0]?.length ?? 0;
    if (a.length === 0 || b.length !== n)
        throw new RangeError("non-conformable arguments");
    checkRows(a);
    // an inner dimension of 0 (an n x 0 matrix times an empty vector) gives n x 1 zeros, as R (b[0] was read)
    const p = b.length > 0 ? checkRows(b) : 1;
    // the smallest nonzero |entry| of each column of b and row of a: tiny sums checked for underflow only (#395)
    const minB = new Array(p).fill(Infinity);
    for (const r of b)
        for (let j = 0; j < p; j++) {
            const v = Math.abs(r[j]);
            if (v !== 0 && v < minB[j])
                minB[j] = v;
        }
    return a.map((row) => {
        let minRow = Infinity;
        for (const t of row) {
            const v = Math.abs(t);
            if (v !== 0 && v < minRow)
                minRow = v;
        }
        const out = new Array(p).fill(0);
        for (let j = 0; j < p; j++) {
            let s = 0;
            for (let k = 0; k < n; k++)
                s += row[k] * b[k][j];
            out[j] = checkDot(s, minRow * minB[j]) ? checkedDot(row, b.map((r) => r[j]), s) : s;
        }
        return out;
    });
}
/** Element-wise operation with R's recycling */
function elementwise(x, y, f) {
    const mx = isMatrix(x);
    const my = isMatrix(y);
    if (mx && my) {
        const nc = checkRows(x);
        if (x.length !== y.length || nc !== checkRows(y))
            throw new RangeError("non-conformable arrays");
        return x.map((r, i) => r.map((v, j) => f(v, y[i][j])));
    }
    if (mx || my) {
        const m = (mx ? x : y);
        const v = asVector(mx ? y : x);
        const nr = m.length;
        const nc = checkRows(m);
        if (v.length === 0)
            return m.map((r) => r.map(() => NaN));
        if (v.length > nr * nc)
            throw new RangeError("dims [product " + nr * nc + "] do not match the length of object [" + v.length + "]");
        // element (i, j) is number i + j nr in column-major order
        return m.map((r, i) => r.map((t, j) => (mx ? f(t, v[(i + j * nr) % v.length]) : f(v[(i + j * nr) % v.length], t))));
    }
    const u = asVector(x);
    const v = asVector(y);
    if (u.length === 0 || v.length === 0)
        return [];
    const n = Math.max(u.length, v.length);
    return Array.from({ length: n }, (_, i) => f(u[i % u.length], v[i % v.length]));
}
/**
 * Element-wise sum with R's recycling (a shorter vector is recycled down the columns of a matrix). Equivalent to
 * R's `+`.
 *
 * @example
 * ```ts
 * add([[1, 2], [3, 4]], [10, 20]); // [[11, 12], [23, 24]]
 * add([1, 2, 3], 2);             // [3, 4, 5]
 * ```
 *
 * @category Linear algebra
 */
export function add(x, y) {
    return elementwise(x, y, (a, b) => a + b);
}
/**
 * Element-wise difference with R's recycling (a shorter vector is recycled down the columns of a matrix). Equivalent to
 * R's `-`.
 *
 * @example
 * ```ts
 * subtract([[1, 2], [3, 4]], [10, 20]); // [[-9, -8], [-17, -16]]
 * subtract([1, 2, 3], 2);             // [-1, 0, 1]
 * ```
 *
 * @category Linear algebra
 */
export function subtract(x, y) {
    return elementwise(x, y, (a, b) => a - b);
}
/**
 * Element-wise product with R's recycling (a shorter vector is recycled down the columns of a matrix). Equivalent to
 * R's `*`. The matrix product is {@link matMul}.
 *
 * @example
 * ```ts
 * multiply([[1, 2], [3, 4]], [10, 20]); // [[10, 20], [60, 80]]
 * multiply([1, 2, 3], 2);             // [2, 4, 6]
 * ```
 *
 * @category Linear algebra
 */
export function multiply(x, y) {
    return elementwise(x, y, (a, b) => a * b);
}
/**
 * Element-wise quotient with R's recycling (a shorter vector is recycled down the columns of a matrix). Equivalent to
 * R's `/`.
 *
 * @example
 * ```ts
 * divide([[1, 2], [3, 4]], [10, 20]); // [[0.1, 0.2], [0.15, 0.2]]
 * divide([1, 2, 3], 2);             // [0.5, 1, 1.5]
 * ```
 *
 * @category Linear algebra
 */
export function divide(x, y) {
    return elementwise(x, y, (a, b) => a / b);
}
const OUTER_OPS = {
    "*": (a, b) => a * b,
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "/": (a, b) => a / b,
    "^": (a, b) => a ** b,
};
/**
 * Outer product of two vectors: the matrix of `fun(x[i], y[j])`. Equivalent to R's `outer()`. `fun` is `"*"`
 * (default), `"+"`, `"-"`, `"/"`, `"^"` or a function of two numbers.
 *
 * @example
 * ```ts
 * outer([1, 2], [1, 2, 3]);      // [[1, 2, 3], [2, 4, 6]]
 * outer([1, 2], [1, 2, 3], "+"); // [[2, 3, 4], [3, 4, 5]]
 * ```
 *
 * @category Linear algebra
 */
export function outer(x, y, fun = "*") {
    const f = typeof fun === "function" ? fun : OUTER_OPS[fun];
    if (f === undefined)
        throw new RangeError(`invalid fun "${String(fun)}"`);
    const u = Array.from(x);
    const v = Array.from(y);
    return u.map((a) => v.map((b) => f(a, b)));
}
/**
 * Transpose. Equivalent to R's `t()`. A vector becomes a 1-row matrix.
 *
 * @example
 * ```ts
 * t([[1, 2, 3], [4, 5, 6]]); // [[1, 4], [2, 5], [3, 6]]
 * t([1, 2]);                 // [[1, 2]]
 * ```
 *
 * @category Linear algebra
 */
export function t(x) {
    if (!isMatrix(x))
        return [asVector(x)];
    const nc = checkRows(x);
    return Array.from({ length: nc }, (_, j) => x.map((r) => r[j]));
}
/**
 * Matrix diagonals, diagonal matrices and identity matrices. Equivalent to R's `diag()`. It has three meanings: the
 * diagonal of a matrix (as a vector); the diagonal matrix of a vector of length 2 or more (its values recycled along the diagonal of an `nrow` x `ncol` matrix when given); and for a single
 * number n, the n x n identity matrix (with `nrow`/`ncol`, a matrix with that number on the diagonal).
 *
 * @example
 * ```ts
 * diag([[1, 2], [3, 4]]); // [1, 4]
 * diag([2, 3]);           // [[2, 0], [0, 3]]
 * diag(3);                // [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
 * ```
 *
 * @category Linear algebra
 */
export function diag(x, options = {}) {
    if (isMatrix(x)) {
        const nc = checkRows(x);
        return Array.from({ length: Math.min(x.length, nc) }, (_, i) => x[i][i]);
    }
    const v = asVector(x);
    let values;
    let nrow;
    if (v.length === 1 && options.nrow === undefined && options.ncol === undefined) {
        nrow = Math.trunc(v[0]);
        if (!(nrow >= 0))
            throw new RangeError("invalid 'nrow' value (< 0)");
        values = [1];
    }
    else {
        values = v;
        nrow = dimArg(options.nrow, "nrow") ?? v.length;
    }
    const ncol = dimArg(options.ncol, "ncol") ?? nrow;
    // as R: no values for a diagonal of positive length (i % 0 put undefined on it)
    if (values.length === 0 && Math.min(nrow, ncol) > 0)
        throw new RangeError("'x' must have positive length");
    const out = Array.from({ length: nrow }, () => new Array(ncol).fill(0));
    for (let i = 0; i < Math.min(nrow, ncol); i++)
        out[i][i] = values[i % values.length];
    return nrow === 0 ? [] : out;
}
/** Columns of an operand for binding: a matrix's columns, or a vector (scalar) as one column of `n` values */
function bindParts(all, byColumn) {
    // as R, vectors of length 0 are left out when anything else is given (recycling them put undefined in the result)
    const given = (a) => isMatrix(a) || asVector(a).length > 0;
    const args = all.some(given) ? all.filter(given) : all;
    const parts = args.map((a) => (isMatrix(a) ? (byColumn ? t(a) : a.map((r) => [...r])) : [asVector(a)]));
    // the common length: the matrices' rows (cbind) or columns (rbind), else the longest vector
    const mats = args.filter(isMatrix);
    const len = mats.length > 0 ? (byColumn ? mats[0].length : checkRows(mats[0])) : maxOf(parts.map((p) => p[0].length));
    mats.forEach((m, k) => {
        const l = byColumn ? m.length : checkRows(m);
        if (l !== len) {
            throw new RangeError(`number of ${byColumn ? "rows" : "columns"} of matrices must match (see arg ${k + 2})`);
        }
    });
    return parts.flatMap((p) => p.map((v) => Array.from({ length: len }, (_, i) => v[i % v.length])));
}
/** A data frame (object of columns) rather than a number, vector or matrix */
function isDataFrame(x) {
    return typeof x === "object" && !Array.isArray(x) && !ArrayBuffer.isView(x);
}
/** The data frames, if all arguments are data frames (and there is at least one); a mix is an error */
function framesOf(args) {
    const frames = args.filter(isDataFrame);
    if (frames.length === 0)
        return undefined;
    if (frames.length < args.length)
        throw new TypeError("cannot combine data frames with vectors or matrices");
    return frames;
}
export function cbind(...args) {
    const frames = framesOf(args);
    return frames === undefined ? t(bindParts(args, true)) : cbindFrames(frames);
}
export function rbind(...args) {
    const frames = framesOf(args);
    return frames === undefined ? bindParts(args, false) : rbindFrames(frames);
}
/** A dimension argument truncated to an integer as R's as.integer does; a negative or non-finite one is an error */
function dimArg(d, name) {
    if (d === undefined)
        return undefined;
    if (!Number.isFinite(d) || d <= -1)
        throw new RangeError(`invalid '${name}' value`);
    return Math.trunc(d) + 0;
}
/**
 * Build a matrix from data, recycled to fill it. Equivalent to R's `matrix()`. Filled by columns unless `byrow`.
 *
 * @example
 * ```ts
 * matrix([1, 2, 3, 4, 5, 6], { nrow: 2 }); // [[1, 3, 5], [2, 4, 6]]
 * matrix(0, { nrow: 2, ncol: 3 });         // [[0, 0, 0], [0, 0, 0]]
 * ```
 *
 * @category Linear algebra
 */
export function matrix(data, options = {}) {
    const v = asVector(data);
    const len = v.length;
    let nrow = dimArg(options.nrow, "nrow");
    let ncol = dimArg(options.ncol, "ncol");
    if (nrow === undefined && ncol === undefined) {
        nrow = len;
        ncol = 1;
    }
    else if (nrow === undefined)
        nrow = Math.ceil(len / ncol);
    else if (ncol === undefined)
        ncol = Math.ceil(len / nrow);
    const byrow = options.byrow ?? false;
    return Array.from({ length: nrow }, (_, i) => Array.from({ length: ncol }, (_, j) => (len === 0 ? NaN : v[(byrow ? i * ncol + j : i + j * nrow) % len])));
}
/**
 * Kronecker product. Equivalent to R's `kronecker()`. Two vectors give a vector.
 *
 * @example
 * ```ts
 * kronecker([[1, 2], [3, 4]], [[1, 1]]); // [[1, 1, 2, 2], [3, 3, 4, 4]]
 * kronecker([1, 2], [1, 10]);           // [1, 10, 2, 20]
 * ```
 *
 * @category Linear algebra
 */
export function kronecker(x, y) {
    if (!isMatrix(x) && !isMatrix(y)) {
        const u = asVector(x);
        const v = asVector(y);
        return u.flatMap((a) => v.map((b) => a * b));
    }
    const a = isMatrix(x) ? x : asVector(x).map((v) => [v]);
    const b = isMatrix(y) ? y : asVector(y).map((v) => [v]);
    const out = [];
    for (const ra of a)
        for (const rb of b)
            out.push(ra.flatMap((va) => rb.map((vb) => va * vb)));
    return out;
}
/**
 * Regular sequences. Equivalent to R's `seq()`. `seq(from, to)` steps by ±1; `by` steps by the increment, up to
 * `to`; `lengthOut` gives that many values, both ends exact. `from` or `to` may be omitted (`undefined`) when the
 * other two are given; `seq(n)` alone is `1, 2, ..., n`.
 *
 * @example
 * ```ts
 * seq(0, 1, { by: 0.25 });     // [0, 0.25, 0.5, 0.75, 1]
 * seq(0, 1, { lengthOut: 3 }); // [0, 0.5, 1]
 * ```
 *
 * @category Linear algebra
 */
export function seq(from, to, options = {}) {
    const { by, lengthOut } = options;
    if (to === undefined && by === undefined && lengthOut === undefined && from !== undefined) {
        if (!Number.isFinite(from))
            throw new RangeError("'from' must be a finite number");
        return colon(1, from);
    }
    if (from !== undefined && !Number.isFinite(from))
        throw new RangeError("'from' must be a finite number");
    if (to !== undefined && !Number.isFinite(to))
        throw new RangeError("'to' must be a finite number");
    if (lengthOut === undefined) {
        if (by === undefined)
            return colon(from ?? 1, to ?? 1);
        const a = from ?? 1;
        const b = to ?? 1;
        // Finite ends whose difference overflows: in half coordinates, doubled (exact scalings, so the values round as
        // they would without the overflow; seq(-1e308, 1e308, { by: 1e308 }) was an error, R gives -1e308, 0, 1e308)
        const half = !Number.isFinite(b - a);
        const f = half ? 0.5 : 1;
        const del = b * f - a * f;
        if (del === 0 && b === 0)
            return [b];
        const n = del / (by * f);
        if (!Number.isFinite(n)) {
            if (by === 0 && del === 0)
                return [a];
            throw new RangeError("invalid '(to - from)/by'");
        }
        // an infinite `by` makes n a signed zero, which passes n < 0: its direction is checked against `to - from` (#274)
        if (n < 0 || (!Number.isFinite(by) && del !== 0 && del > 0 !== by > 0)) {
            throw new RangeError("wrong sign in 'by' argument");
        }
        if (Math.abs(del) / Math.max(Math.abs(b * f), Math.abs(a * f)) < 100 * Number.EPSILON)
            return [a];
        const k = Math.trunc(n + 1e-10);
        const at = half ? (i) => 2 * (a / 2 + i * (by / 2)) : (i) => a + i * by;
        // the last value may overshoot `to` by rounding: hold it at `to`
        return Array.from({ length: k + 1 }, (_, i) => (i === 0 ? a : by > 0 ? Math.min(at(i), b) : Math.max(at(i), b)));
    }
    // rounded up first, as R: a length in (-1, 0) is 0 (#98)
    if (!Number.isFinite(lengthOut) || lengthOut <= -1)
        throw new RangeError("'length.out' must be a non-negative number");
    const len = Math.ceil(lengthOut);
    if (len === 0)
        return [];
    if (by === undefined) {
        const b = to ?? (from ?? 1) + (len - 1);
        const a = from ?? b - (len - 1);
        if (len <= 2)
            return [a, b].slice(0, len);
        if (a === b)
            return new Array(len).fill(a);
        if (!Number.isFinite(b - a)) {
            // finite ends whose difference overflows: in half coordinates, doubled (as seqLength in src/internal/seq.ts;
            // the interior values were NaN)
            const h = a / 2;
            const halfStep = (b / 2 - h) / (len - 1);
            return Array.from({ length: len }, (_, i) => (i === 0 ? a : i === len - 1 ? b : 2 * (h + i * halfStep)));
        }
        const step = (b - a) / (len - 1);
        return Array.from({ length: len }, (_, i) => (i === 0 ? a : i === len - 1 ? b : a + i * step));
    }
    if (to === undefined) {
        const a = from ?? 1;
        return Array.from({ length: len }, (_, i) => a + i * by);
    }
    if (from === undefined)
        return Array.from({ length: len }, (_, i) => to - (len - 1 - i) * by);
    throw new RangeError("too many arguments");
}
/** R's from:to */
function colon(from, to) {
    const n = Math.trunc(Math.abs(to - from) + 1 + 1.1920928955078125e-7);
    const s = from <= to ? 1 : -1;
    return Array.from({ length: n }, (_, i) => from + s * i);
}
