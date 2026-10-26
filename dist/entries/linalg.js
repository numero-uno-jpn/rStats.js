// Linear algebra (rStats.js/linalg): matrices are arrays of rows
export { crossprod, tcrossprod, backsolve, forwardsolve } from "../linalg/basic.js";
export { norm } from "../linalg/norm.js";
export { chol, chol2inv } from "../linalg/chol.js";
export { qr, qrQ, qrR, qrX, qrCoef, qrQy, qrQty, qrResid, qrFitted, qrSolve } from "../linalg/qr.js";
export { solve, det, determinant, rcond } from "../linalg/solve.js";
export { svd } from "../linalg/svd.js";
export { kappa, ginv } from "../linalg/kappa.js";
export { eigen } from "../linalg/eigen.js";
export { schur } from "../linalg/schur.js";
export { expm } from "../linalg/expm.js";
export { matMul, add, subtract, multiply, divide, outer, t, diag, cbind, rbind, matrix, kronecker, seq, } from "../linalg/ops.js";
export { lu, prcomp } from "../linalg/lu.js";
