import { type GlmerFamily } from "./glmerFamily.js";
import type { GlmerStructure } from "./glmerStructure.js";
import { type SparseSystem } from "./mixedDeviance.js";
/** Whether the link is the family's canonical one (then Ŵ = W: s_i' = −W_i exactly) */
export declare function isCanonical(fam: GlmerFamily): boolean;
/**
 * The derivative of the family's aic term (src/models/glmFamily.ts familyAic) with respect to each μ_i, the
 * dispersion of Gamma, inverse.gaussian and gaussian (dev / Σ w or dev / n) differentiated through dev = Σ d_i, with
 * ∂d_i/∂μ_i = −2 w_i (y_i − μ_i) / V(μ_i). Rows of prior weight 0 are not in the aic term (0).
 */
export declare function aicDerivative(fam: GlmerFamily, y: readonly number[], mu: ArrayLike<number>, w: readonly number[], size: readonly number[] | undefined, dev: number): Float64Array;
/** The weights of the rows at η, μ: W, dW/dη, Ŵ and the score s */
export interface RowWeights {
    ww: Float64Array;
    dww: Float64Array;
    observed: Float64Array;
    score: Float64Array;
}
/** {@link RowWeights} at the mode (rows of prior weight 0: all 0) */
export declare function rowWeights(s: GlmerStructure, eta: ArrayLike<number>, mu: ArrayLike<number>): RowWeights;
/**
 * h_i = m_i' A⁻¹ m_i for every row (m_i = Λ_θ' z_i, the i-th row of ZΛ_θ), from the selected inverse `inv` of A (the
 * layout of L): the groups of a row are adjacent in A, so the blocks of A⁻¹ needed are on the pattern of L
 */
export declare function rowLeverages(s: GlmerStructure, sys: SparseSystem, t: Float64Array[], inv: Float64Array, rows: ArrayLike<number>): Float64Array;
/** What the Laplace gradient needs from the evaluation at the mode */
export interface LaplaceState {
    structure: GlmerStructure;
    sys: SparseSystem;
    /** The blocks T_k at θ */
    t: Float64Array[];
    /** The factor of A = Λ'Z'WZΛ + I at the mode */
    l: Float64Array;
    u: Float64Array;
    eta: Float64Array;
    mu: Float64Array;
    /** Σ d_i at the mode (the dev of the aic term) */
    devResid: number;
    /** nAGQ = 0: β from the joint mode (the gradient is in θ only) */
    joint: boolean;
}
/**
 * The gradient of the Laplace deviance (see the header): with respect to (θ, β) for nAGQ = 1, θ for nAGQ = 0. Throws
 * the Error of {@link factorise} if H is not positive definite (a non-canonical link far from a minimum of pdev).
 */
export declare function laplaceGradient(state: LaplaceState): number[];
