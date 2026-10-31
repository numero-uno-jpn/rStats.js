// The check of a covariance (or correlation) matrix given as `covmat` (factanal, omega).

import { isSymmetric } from "../linalg/eigen.js";
import { toMat } from "../linalg/matrix.js";
import { scaleToUnit } from "./summary.js";

/**
 * Throws unless the matrix is square, finite, symmetric (as R's isSymmetric: relative difference from its transpose at
 * most 100 ε) and has a positive diagonal. R's factanal takes any matrix: an asymmetric one gave a result
 */
export function checkCovmat(S: readonly (readonly number[])[]): void {
  const p = S.length;
  if (p === 0 || S.some((r) => r.length !== p)) throw new RangeError("'covmat' must be a square matrix");
  if (S.some((r) => r.some((v) => !Number.isFinite(v)))) throw new RangeError("'covmat' must be finite");
  if (S.some((r, i) => !(r[i]! > 0))) throw new RangeError("the diagonal of 'covmat' must be positive");
  // scaled by a power of 2 first, so that the sums of the test do not overflow
  if (!isSymmetric(toMat(scaleToUnit(S).groups))) throw new RangeError("'covmat' must be symmetric");
}
