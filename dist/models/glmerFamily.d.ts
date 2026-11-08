import { type Family, type GlmFamilyName, type GlmFamilySpec, type GlmLink, type GlmLinkName } from "./glmFamily.js";
/**
 * The families that {@link glmer} fits (the glm families without the quasi ones).
 *
 * @category Mixed models
 */
export type GlmerFamilyName = "binomial" | "poisson" | "Gamma" | "inverse.gaussian" | "gaussian";
/** A family of glmer resolved to its functions. */
export interface GlmerFamily {
    family: GlmerFamilyName;
    /** The link's name. */
    link: GlmLinkName;
    /** eta = g(mu): R's link function (used for the starting linear predictor only). */
    linkfun(mu: number): number;
    /** mu = g^-1(eta), lme4's. */
    linkinv(eta: number): number;
    /** d mu / d eta, lme4's. */
    muEta(eta: number): number;
    /** The variance function, lme4's. */
    variance(mu: number): number;
    /**
     * d² mu / d eta², the derivative of {@link muEta} (0 where lme4 clamps muEta to a constant): for the analytic
     * gradient of the deviance (src/models/glmerGradient.ts).
     */
    muEta2(eta: number): number;
    /** dV / d mu, the derivative of {@link variance} (0 where lme4 clamps it). */
    varianceDerivative(mu: number): number;
    /** The deviance residual of one observation with prior weight w. */
    devResid(y: number, mu: number, w: number): number;
    /** R's family object (glm's), for the checks of the response, the starting means and the aic term. */
    glm: Family;
}
/**
 * The family of glmer from a family name or specification and a link given separately (glm's arguments): the quasi
 * families are an error (lme4's first check), and so is gaussian with the identity link, which R fits with lmer
 * (rStats.js's choice G3).
 */
export declare function glmerFamily(family: GlmFamilyName | GlmFamilySpec | undefined, link?: GlmLink): GlmerFamily;
/** The working weight w μ'² / V(μ) of a row of prior weight w > 0 (as w c² μ^(2a − p) where that overflows) */
export declare function workingWeight(fam: GlmerFamily, w: number, me: number, mu: number): number;
/** The score w (y − μ) μ' / V(μ) of a row (as w (y − μ) c μ^(a − p) where that overflows) */
export declare function workingScore(fam: GlmerFamily, w: number, y: number, me: number, mu: number): number;
/**
 * The weights of the gradient of a row of prior weight w > 0 (src/models/glmerGradient.ts rowWeights): W, dW/dη, the
 * score s and the observed weight Ŵ = W − w (y − μ)(μ''/V − (μ'/V)² V'), in R's form, or from the powers of μ
 * (dW/dη = w c³ (2a − p) μ^(3a − p − 1), Ŵ = W − w (y − μ) c² (a − p) μ^(2a − p − 1)) where that overflows
 */
export declare function gradientWeights(fam: GlmerFamily, w: number, y: number, eta: number, mu: number, canonical: boolean): {
    ww: number;
    dww: number;
    score: number;
    observed: number;
};
/** The Pearson residual √w (y − μ) / √V(μ) (as ((y − μ)/h) √w / h, h = μ^(p/4), where V is out of range) */
export declare function pearsonResidualOf(fam: GlmerFamily, w: number, y: number, mu: number): number;
/** The working residual (y − μ) / μ' (as ((y − μ)/c)/μ^(a/2)/μ^(a/2) where μ' is out of range) */
export declare function workingResidualOf(fam: GlmerFamily, y: number, eta: number, mu: number): number;
