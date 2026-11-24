// Shared linear algebra helpers: matrix input/output format and validation.
//
// Matrices in the public API are arrays of rows (number[][], as in chisqTest; rows may also be Float64Array).
// Internally, computation uses column-major Float64Array as in LAPACK (most traversals run along contiguous columns).
// An array of rows cannot express the column count of a 0-row matrix, so a 0-row matrix is treated as 0x0.
export function newMat(nrow, ncol) {
    return { nrow, ncol, data: new Float64Array(nrow * ncol) };
}
export function isMatrixInput(x) {
    return x.length > 0 && typeof x[0] !== "number";
}
/** Convert an array of rows to a column-major matrix. Error if the rows differ in length */
export function toMat(x) {
    const nrow = x.length;
    const ncol = nrow === 0 ? 0 : x[0].length;
    const m = newMat(nrow, ncol);
    for (let i = 0; i < nrow; i++) {
        const row = x[i];
        if (row.length !== ncol)
            throw new TypeError("all rows of the matrix must have the same length");
        for (let j = 0; j < ncol; j++)
            m.data[i + j * nrow] = row[j];
    }
    return m;
}
/** A vector becomes a one-column matrix (as R's as.matrix) */
export function toMatOrColumn(x) {
    if (isMatrixInput(x))
        return toMat(x);
    const v = x;
    return { nrow: v.length, ncol: 1, data: Float64Array.from(v) };
}
/** Convert a column-major matrix back to an array of rows */
export function fromMat(m) {
    const out = [];
    for (let i = 0; i < m.nrow; i++) {
        const row = new Array(m.ncol);
        for (let j = 0; j < m.ncol; j++)
            row[j] = m.data[i + j * m.nrow];
        out.push(row);
    }
    return out;
}
/** Return column j as an array */
export function column(m, j) {
    return Array.from(m.data.subarray(j * m.nrow, (j + 1) * m.nrow));
}
export function transpose(m) {
    const t = newMat(m.ncol, m.nrow);
    for (let j = 0; j < m.ncol; j++) {
        for (let i = 0; i < m.nrow; i++)
            t.data[j + i * m.ncol] = m.data[i + j * m.nrow];
    }
    return t;
}
export function hasNonFinite(m) {
    for (const v of m.data)
        if (!Number.isFinite(v))
            return true;
    return false;
}
export function requireSquare(m, what = "the matrix") {
    if (m.nrow !== m.ncol)
        throw new TypeError(`${what} must be square (got ${m.nrow} x ${m.ncol})`);
}
/**
 * 0 when the largest absolute value is within [2^-256, 2^256] (or all are 0); otherwise its binary exponent, the
 * power of 2 to divide by to bring the values near 1
 */
export function rangeExponent(data) {
    let mx = 0;
    for (let i = 0; i < data.length; i++)
        mx = Math.max(mx, Math.abs(data[i]));
    if (mx === 0 || (mx >= 2 ** -256 && mx <= 2 ** 256))
        return 0;
    return Math.floor(Math.log2(mx));
}
/**
 * The power of 2 to divide a matrix by before a decomposition (eigen, schur, svd, and the condition estimates of
 * rcond, solve and kappa): 0 within [2^-256, 2^256]; a smaller matrix is brought up near 1, a larger one only down to
 * [2^256, 2^257), the top of the range used as given (#127, #131, #132). Bringing it down to 1 put every entry below
 * 2 of a matrix near 1e308 into the subnormal range: svd(diag(1e308, 1e-15)) gave 8.9e-16 and ginv's 1/d overflowed.
 * Division by a power of 2 is exact, so a matrix whose result was finite and correct gives the same bits. eigen passes
 * top = 459, LAPACK's dgeev bound (see eigen)
 */
export function decompositionExponent(data, top = 256) {
    const k = rangeExponent(data);
    return k > 0 ? Math.max(0, k - top) : k;
}
