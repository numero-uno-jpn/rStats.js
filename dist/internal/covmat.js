// The check of a covariance (or correlation) matrix given as `covmat` (factanal, omega).
import { isSymmetric } from "../linalg/eigen.js";
import { toMat } from "../linalg/matrix.js";
/**
 * Throws unless the matrix is square, finite, symmetric (as R's isSymmetric: relative difference from its transpose at
 * most 100 ε) and has a positive diagonal. R's factanal takes any matrix: an asymmetric one gave a result
 */
export function checkCovmat(S) {
    const p = S.length;
    if (p === 0 || S.some((r) => r.length !== p))
        throw new RangeError("'covmat' must be a square matrix");
    if (S.some((r) => r.some((v) => !Number.isFinite(v))))
        throw new RangeError("'covmat' must be finite");
    if (S.some((r, i) => !(r[i] > 0)))
        throw new RangeError("the diagonal of 'covmat' must be positive");
    // in the matrix's own units, as R's isSymmetric (isSymmetric handles sums that overflow; the matrix scaled to its
    // largest entry first took [[1e308, 1e-10], [0, 1]] for a symmetric one, issue #99)
    if (!isSymmetric(toMat(S)))
        throw new RangeError("'covmat' must be symmetric");
}
