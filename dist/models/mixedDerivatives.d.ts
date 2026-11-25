import type { MixedModelStructure } from "./mixedStructure.js";
/** The derivatives of {@link varparDerivatives} */
export interface VarparDerivatives {
    /** varpar = (θ, σ), σ = sqrt(r² / ν) */
    varpar: number[];
    /** The deviance d(θ, σ) at varpar */
    deviance: number;
    /** Its gradient in varpar (0 at the optimum) */
    gradient: number[];
    /** The derivatives of Φ (the log determinants) and of r² in θ, and r² */
    phiGradient: number[];
    prssGradient: number[];
    prss: number;
    /** Its Hessian in varpar (m × m, array of rows) */
    hessian: number[][];
    /** β̂ at θ */
    beta: number[];
    /** C = σ² S⁻¹ at varpar (p × p, array of rows) */
    vcov: number[][];
    /** J_k = ∂C/∂varpar_k, one p × p matrix (array of rows) per element of varpar */
    jacobian: number[][][];
}
/**
 * The deviance d(θ, σ) in the variance parameters, its gradient and Hessian, and the covariance of β̂ with its
 * Jacobians, at θ with σ = sqrt(r²(θ) / ν) (see the header). Internal.
 */
export declare function varparDerivatives(structure: MixedModelStructure, theta: readonly number[], reml: boolean): VarparDerivatives;
