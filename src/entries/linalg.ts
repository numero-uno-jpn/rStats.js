// Linear algebra (rStats.js/linalg): matrices are arrays of rows

export { crossprod, tcrossprod, backsolve, forwardsolve, type BacksolveOptions } from "../linalg/basic.js";
export { norm, type NormOptions, type NormType } from "../linalg/norm.js";
export { chol, chol2inv, type CholOptions, type CholPivotResult, type Chol2InvOptions } from "../linalg/chol.js";
export { qr, qrQ, qrR, qrX, qrCoef, qrQy, qrQty, qrResid, qrFitted, qrSolve, type QR, type QROptions, type QRQOptions } from "../linalg/qr.js";
export { solve, det, determinant, rcond, type SolveOptions, type Determinant, type RcondOptions } from "../linalg/solve.js";
export { svd, type SvdOptions, type SvdResult } from "../linalg/svd.js";
export { kappa, ginv, type KappaOptions } from "../linalg/kappa.js";
export { eigen, type EigenOptions, type EigenResult } from "../linalg/eigen.js";
export type { MatrixInput, VectorOrMatrix } from "../linalg/matrix.js";
