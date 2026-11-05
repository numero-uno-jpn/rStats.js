import type { MixedModelStructure } from "./mixedStructure.js";
/** The penalised least-squares solution and the profiled deviance at a given θ. */
export interface ProfiledDeviance {
    /** The REML criterion (`reml` true) or the ML deviance −2 log L (`reml` false), profiled over β and σ. */
    deviance: number;
    /** The fixed effects β̂ that minimise the penalised residual sum of squares (one per column of X). */
    beta: number[];
    /** The spherical random effects û (one per column of Z). */
    u: number[];
    /** The random effects b = Λ_θ û. */
    b: number[];
    /** The residual sum of squares ‖y − Xβ̂ − ZΛ_θ û‖². */
    rss: number;
    /** The penalty ‖û‖². */
    ussq: number;
    /** The penalised residual sum of squares rss + ussq. */
    prss: number;
    /** log det(Λ_θ' Z'Z Λ_θ + I): twice the log determinant of its Cholesky factor L_θ. */
    logDetL: number;
    /** log det(X'X − X'ZΛ_θ (Λ_θ'Z'ZΛ_θ + I)⁻¹ Λ_θ'Z'X): twice the log determinant of R_X. */
    logDetRX: number;
    /** The derivative of `deviance` with respect to each element of θ (with `options.gradient`). */
    gradient?: number[];
    /** (R_X' R_X)⁻¹, p × p, array of rows (with `options.rxInverse`): the covariance of β̂ divided by σ². */
    rxInverse?: number[][];
}
/** What {@link profiledDeviance} computes beyond the deviance and the penalised least-squares solution. */
export interface ProfiledDevianceOptions {
    /** Also the gradient of the criterion with respect to θ (from the selected inverse of A). */
    gradient?: boolean;
    /** Also (R_X' R_X)⁻¹. */
    rxInverse?: boolean;
}
/** What does not depend on θ: the cross-products, Z by rows, the groups of columns and the pattern of the factor */
export interface SparseSystem {
    n: number;
    p: number;
    q: number;
    /** Number of groups of columns (one per level of each term) */
    nGroups: number;
    /** First column of each group, and q at the end (nGroups + 1) */
    groupStart: Int32Array;
    /** The term of each group */
    groupTerm: Int32Array;
    /** For each term: nc, and the index into θ of each element of T_k (nc × nc, column-major; −1 above the diagonal) */
    termNc: number[];
    termTheta: Int32Array[];
    /**
     * Z'Z by blocks, lower part: the blocks of column group h are blockStart[h] .. blockStart[h + 1] − 1, the diagonal
     * block first, then the row groups blockRow[b] > h increasing; block b is nc(row group) × nc(h), column-major, at
     * zz[blockValueStart[b]] (the diagonal block in full)
     */
    blockStart: Int32Array;
    blockRow: Int32Array;
    blockValueStart: Int32Array;
    zz: Float64Array;
    /** Z'X, q × p, column-major */
    zx: Float64Array;
    /** Z'y */
    zy: Float64Array;
    /** X'y */
    xy: Float64Array;
    /** The nonzero entries of Z by rows: the columns and the values of row i are at rowStart[i] .. rowStart[i + 1] − 1 */
    rowStart: Int32Array;
    rowCols: Int32Array;
    rowValues: Float64Array;
    /** The pattern of L by columns: the rows of column j at colStart[j] .. colStart[j + 1] − 1, the diagonal first */
    colStart: Int32Array;
    colRows: Int32Array;
    /** The entries L[j, k], k < j, of row j: their columns k (increasing) and positions in colRows, at rowListStart[j] .. */
    rowListStart: Int32Array;
    rowListCol: Int32Array;
    rowListPos: Int32Array;
    /**
     * For each block b of Z'Z off the diagonal (row group g, column group h): the number of rows of L's column groups
     * before g in the pattern of h, so that the entry (row r of g, column c of h) of L (and of the selected inverse) is
     * at colStart[column] + (rows of the diagonal block from the column) + blockPatternOffset[b] + r (0 on the diagonal)
     */
    blockPatternOffset: Int32Array;
}
/** Λ_θ w (q-vector) */
export declare function lambdaTimes(sys: SparseSystem, t: Float64Array[], w: Float64Array): Float64Array;
/** Λ_θ' M for a q × ncol column-major M */
export declare function lambdaTransposeTimes(sys: SparseSystem, t: Float64Array[], m: Float64Array, ncol?: number): Float64Array;
/** Solves L x = v in place (v of length q, at an offset) */
export declare function solveL(sys: SparseSystem, l: Float64Array, v: Float64Array, offset?: number): void;
/** Solves L' x = v in place */
export declare function solveLt(sys: SparseSystem, l: Float64Array, v: Float64Array, offset?: number): void;
/** The full symmetric inverse of R'R from an upper-triangular factor R (column-major, k × k; R is not changed) */
export declare function inverseFromFactor(r: Float64Array, k: number): Float64Array;
/**
 * The profiled deviance of a linear mixed model at `theta`, with the penalised least-squares solution
 * (oracle/lmer-behaviour.md, stage 1b; computed sparsely). Internal: not exported from the package.
 *
 * @param structure The structure from {@link mixedModelStructure}.
 * @param theta The covariance parameters (finite, of the length of `structure.theta`; values below the lower bounds
 *   are accepted).
 * @param reml Whether to return the REML criterion (true) or the ML deviance (false).
 * @param options What to compute besides: the gradient with respect to θ, (R_X' R_X)⁻¹.
 */
export declare function profiledDeviance(structure: MixedModelStructure, theta: readonly number[], reml: boolean, options?: ProfiledDevianceOptions): ProfiledDeviance;
/**
 * The state of the penalised least-squares solution at a given θ (internal): the system of the structure, the blocks
 * T_k, the sparse factor L of A, C_X = L⁻¹ Λ'Z'X, the Cholesky factor R_X (upper triangle, column-major, p × p) of
 * R_X'R_X = E'E + W'W, the columns of W = A⁻¹ Λ'Z'X and of E = X − ZΛW, the residual y − Xβ̂ − ZΛû, û, β̂, b = Λû,
 * and the solver of the normal equations of the penalised least squares. {@link profiledDeviance} is computed from
 * it, and src/models/mixedDerivatives.ts takes the second derivatives from it.
 */
export interface PlsState {
    sys: SparseSystem;
    t: Float64Array[];
    l: Float64Array;
    cx: Float64Array;
    rx: Float64Array;
    ws: Float64Array[];
    xResiduals: Float64Array[];
    res: Float64Array;
    uv: Float64Array;
    beta: Float64Array;
    b: Float64Array;
    /** Solves [A, Λ'Z'X; X'ZΛ, X'X] (u, β) = (gu, gβ) with the two factors, overwriting gu with u and gβ with β */
    solveNormal: (gu: Float64Array, gb: Float64Array) => void;
}
/** The penalised least-squares solution at θ and the factors it was computed with (see {@link PlsState}) */
export declare function plsState(structure: MixedModelStructure, theta: readonly number[]): PlsState;
/**
 * The selected inverse of A = L L': the entries of A⁻¹ on the pattern of L (lower part, the layout of L's values), by
 * the recurrences of Takahashi, Fagan and Chin (1973). Since L' A⁻¹ = L⁻¹ is lower triangular with diagonal 1 / L_jj,
 * row j of it gives, for i > j in the pattern of column j,
 *   A⁻¹[i, j] = −(1 / L_jj) Σ_k L[k, j] A⁻¹[k, i],   A⁻¹[j, j] = 1 / L_jj² − (1 / L_jj) Σ_k L[k, j] A⁻¹[k, j],
 * the sums over the rows k > j of column j. The rows of column j form a clique in the pattern of L (the closure of a
 * Cholesky pattern), so every A⁻¹[k, i] needed is on the pattern, in column min(k, i), already computed when the
 * columns are taken from the last to the first. The cost is that of the factorisation.
 */
export declare function selectedInverse(sys: SparseSystem, l: Float64Array): Float64Array;
/**
 * The derivative ∂L of the Cholesky factor L of A along a direction in which A changes by ∂A (`da`, the layout of the
 * blocks of A, both triangles of the diagonal blocks): {@link factorise} differentiated step by step (forward mode).
 * In column j, after the columns k < j are subtracted, the work vector holds L_jj L[r, j] (L_jj² at r = j), so with
 * ∂ of the same subtractions (∂L[r, k] L[j, k] + L[r, k] ∂L[j, k]),
 *   ∂L_jj = ∂work[j] / (2 L_jj),  ∂L[r, j] = (∂work[r] − L[r, j] ∂L_jj) / L_jj.
 * An entry L[j, k] that is 0 (a column of Λ_θ that is 0) is not skipped: its derivative need not be 0.
 */
export declare function factoriseSystemTangent(sys: SparseSystem, l: Float64Array, da: Float64Array): Float64Array;
/**
 * The derivative of the selected inverse `inv` of A = L L' given the derivative ∂L of L (`dl`): the recurrences of
 * {@link selectedInverse} differentiated step by step (forward mode). It is ∂(A⁻¹) = −A⁻¹ ∂A A⁻¹ on the pattern of L.
 */
export declare function selectedInverseTangent(sys: SparseSystem, l: Float64Array, dl: Float64Array, inv: Float64Array): Float64Array;
/**
 * S_k = Σ over the levels G of term k of (Y Λ' Z'Z) on G's columns (nc_k × nc_k, column-major), for Y = A⁻¹ given by
 * its selected inverse `inv` (the layout of L's values) and Λ by its blocks `t` (see {@link sparseGradient}). Linear
 * in `inv` and in `t`, so that the derivatives of the sums (src/models/mixedDerivatives.ts) come from the derivative
 * of the selected inverse and of the blocks.
 */
export declare function levelTraceSums(sys: SparseSystem, inv: Float64Array, t: Float64Array[]): Float64Array[];
