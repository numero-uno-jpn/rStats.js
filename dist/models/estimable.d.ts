import { type QR } from "../linalg/qr.js";
/** The warning R gives when some rows are not estimable */
export declare const NON_ESTIMABLE_WARNING = "prediction from rank-deficient fit; attr(*, \"non-estim\") has doubtful cases";
/**
 * 0-based indices of the rows of X (full rows, one value per coefficient) whose prediction is not estimable: |x · n|
 * above sqrt(eps) |x| |n| for a null-space vector n. Empty for a full-rank fit.
 */
export declare function nonEstimableRows(qr: QR | undefined, rank: number, X: readonly (readonly number[])[]): number[];
/**
 * Whether the columns of the model matrix `small` lie in the column space of `large` (the same rows): the smaller model
 * is then a special case of the larger one, and their comparison by an F or likelihood ratio test has its usual
 * meaning. Judged by the rank of [large, small] against that of large (LINPACK's tolerance 1e-7, relative to each
 * column's norm, so the units of the predictors do not matter)
 */
export declare function nestedColumns(small: readonly (readonly number[])[], large: readonly (readonly number[])[]): boolean;
