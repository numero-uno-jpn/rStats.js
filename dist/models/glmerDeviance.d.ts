import type { GlmerStructure } from "./glmerStructure.js";
/** The Laplace deviance and the conditional mode at given parameters. */
export interface GlmerDeviance {
    /** The deviance ldL2 + ussq + aic (−2 times the Laplace approximation of the log-likelihood). */
    deviance: number;
    /** The fixed effects: the given ones (nAGQ = 1), those of the joint mode (nAGQ = 0). */
    beta: number[];
    /** The conditional mode ũ of the spherical random effects. */
    u: number[];
    /** The random effects b = Λ_θ ũ. */
    b: number[];
    /** The conditional means μ (one per row used). */
    mu: number[];
    /** The linear predictor η = o + Xβ + ZΛ_θ ũ at the mode (one per row used). */
    eta: number[];
    /** The sum of the deviance residuals at μ. */
    devResid: number;
    /** ‖ũ‖². */
    ussq: number;
    /** The penalised deviance devResid + ussq. */
    pdev: number;
    /** log det(Λ_θ' Z'WZ Λ_θ + I), W the working weights at the mode. */
    ldL2: number;
    /** The family's aic term at μ (−2 log-likelihood; the dispersion from the deviance for Gamma, inverse.gaussian, gaussian). */
    aic: number;
    /** The number of PIRLS iterations. */
    iterations: number;
    /** R's warnings of the evaluation (poisson's non-integer counts). */
    warnings: string[];
    /**
     * R_X'R_X = X'WX − X'WZΛ (Λ'Z'WZΛ + I)⁻¹ Λ'Z'WX with the working weights at the mode (array of rows), when asked
     * for (`{ rx: true }`).
     */
    rxtrx?: number[][];
    /**
     * The gradient of the deviance (src/models/glmerGradient.ts), when asked for (`{ gradient: true }`): with respect to
     * (θ, β) for nAGQ = 1 (and nAGQ > 1), θ for nAGQ = 0.
     */
    gradient?: number[];
}
/**
 * The Laplace deviance of a generalised linear mixed model at `theta` (and `beta` for nAGQ = 1), at the exact
 * conditional mode (oracle/glmer-behaviour.md, stage 2a). Internal: not exported from the package.
 *
 * @param structure The structure from {@link glmerStructure}.
 * @param theta The covariance parameters (finite, of the length of `structure.theta`; values below the lower bounds
 *   are accepted).
 * @param beta The fixed effects (one per column of X) for nAGQ = 1; ignored for nAGQ = 0.
 * @param nAGQ 1: the deviance is a function of (θ, β), the mode is found for u; 0: a function of θ, the mode is found
 *   for u and β jointly.
 * @param options `rx`: also return R_X'R_X at the mode (for the covariance of the fixed effects); `gradient`: also
 *   return the gradient of the deviance.
 */
export declare function glmerDeviance(structure: GlmerStructure, theta: readonly number[], beta: readonly number[] | undefined, nAGQ?: 0 | 1, options?: {
    rx?: boolean;
    gradient?: boolean;
}): GlmerDeviance;
/** A Gauss-Hermite rule for the standard normal density: nodes in increasing order and their weights (sum 1). */
export interface GaussHermiteRule {
    nodes: number[];
    weights: number[];
}
/**
 * The K-point Gauss-Hermite rule for the standard normal density (K = 1..100): the nodes are the zeros of the
 * probabilists' Hermite polynomial He_K, the weights 1 / Σ_(j<K) He_j(z)² / j!. The positive zeros are bracketed by a
 * scan of the sign of He_K (step 0.01, well below the smallest spacing of the zeros, about π / √(2K + 1) = 0.22 for
 * K = 100), narrowed by bisection and finished by Newton's method (He_K' = K He_(K−1)); the negative nodes are their
 * mirror images and the middle node of an odd rule is exactly 0, so the rule is symmetric as lme4's symmetrised table
 * is. Cached per K.
 */
export declare function gaussHermiteRule(k: number): GaussHermiteRule;
/** The AGQ deviance and the conditional mode at given parameters. */
export interface GlmerAgqDeviance extends GlmerDeviance {
    /**
     * The AGQ deviance devResid + ussq + ldL2 + quad (no aic term: lme4's likelihood relative to the saturated model,
     * with the dispersion held at 1).
     */
    deviance: number;
    /** −2 Σ_j log Σ_k w_k exp(z_k²/2 − Δ_jk/2), the quadrature's term. */
    quad: number;
    /** The conditional standard deviations σ_j = 1 / L_j of the levels. */
    condSd: number[];
}
/**
 * The adaptive Gauss-Hermite quadrature deviance D_K(θ, β) of a model with one scalar random-effects term, at the
 * exact conditional mode (that of nAGQ = 1, {@link glmerDeviance}) with the rule of {@link gaussHermiteRule}
 * (oracle/glmer-behaviour.md, "The deviance at given (θ, β)"). Internal: not exported from the package.
 *
 * @param structure The structure (one random-effects term with one column).
 * @param theta θ (one value).
 * @param beta The fixed effects.
 * @param nAGQ The number of points K (2 to 100).
 * @param options `rx`: also return R_X'R_X at the mode; `gradient`: also the gradient in (θ, β).
 */
export declare function glmerAgqDeviance(structure: GlmerStructure, theta: readonly number[], beta: readonly number[], nAGQ: number, options?: {
    rx?: boolean;
    gradient?: boolean;
}): GlmerAgqDeviance;
