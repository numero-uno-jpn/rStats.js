/**
 * Names of the families of R's stats.
 *
 * @category Generalized linear models
 */
export type GlmFamilyName = "gaussian" | "binomial" | "quasibinomial" | "poisson" | "quasipoisson" | "Gamma" | "inverse.gaussian" | "quasi";
/**
 * Names of the links of R's stats (`make.link`).
 *
 * @category Generalized linear models
 */
export type GlmLinkName = "identity" | "log" | "inverse" | "logit" | "probit" | "cauchit" | "cloglog" | "sqrt" | "1/mu^2";
/**
 * A link: one of R's named links or a power link `mu^power` (R's `power(lambda)`; `power <= 0` is the log link).
 *
 * @category Generalized linear models
 */
export type GlmLink = GlmLinkName | {
    /** The exponent lambda of the power link (R's `power(lambda)`). */
    power: number;
};
/**
 * Variance functions of the `quasi` family.
 *
 * @category Generalized linear models
 */
export type QuasiVariance = "constant" | "mu(1-mu)" | "mu" | "mu^2" | "mu^3";
/**
 * A family with its link (and, for `quasi`, its variance function), as R's family objects such as `quasi(link = "log", variance = "mu^2")`.
 *
 * @category Generalized linear models
 */
export interface GlmFamilySpec {
    /** The family's name, such as `"binomial"`. */
    family: GlmFamilyName;
    /** The link: any named link (for `quasi`, one of its own list). Default: the family's default link. */
    link?: GlmLink;
    /** Variance function of `quasi`. Default `"constant"`. */
    variance?: QuasiVariance;
}
/** A link resolved to its functions. */
export interface LinkFunctions {
    name: string;
    /** eta = g(mu) */
    link(mu: number): number;
    /** mu = g^-1(eta) */
    linkinv(eta: number): number;
    /** d mu / d eta */
    muEta(eta: number): number;
    /** Whether a linear predictor is in the domain of the inverse link */
    etaOk(eta: number): boolean;
}
/** A family resolved to its functions (the counterpart of R's family object). */
export interface Family extends LinkFunctions {
    family: GlmFamilyName;
    /** For quasi: the variance function's name */
    varianceName: QuasiVariance | undefined;
    variance(mu: number): number;
    muOk(mu: number): boolean;
    /** Deviance contribution of one observation with prior weight w */
    devContribution(y: number, mu: number, w: number): number;
    /** Whether the dispersion is fixed at 1 (binomial and poisson) */
    fixedDispersion: boolean;
}
/** Collects warnings in order of first appearance, each once (as the fixtures list R's warnings) */
export declare class Warnings {
    readonly list: string[];
    add(message: string): void;
}
export declare function withWarnings<T>(sink: Warnings, f: () => T): T;
/** Resolves a family name or specification (and a link given separately) to its functions */
export declare function makeFamily(family: GlmFamilyName | GlmFamilySpec, link?: GlmLink): Family;
/** The response after the family has read it, with the prior weights, the starting means and the binomial sizes */
export interface PreparedResponse {
    y: number[];
    weights: number[];
    mustart: number[];
    /** Binomial sizes (s + f for a two-column response, 1 otherwise); undefined for the other families */
    size: number[] | undefined;
}
/**
 * Checks the response and computes the starting means (R's family initialize). `y` is a vector or, for the binomial
 * families, rows (successes, failures). `hasStart`: starting values were given, so the gaussian check of the
 * starting means is skipped.
 */
export declare function prepareResponse(fam: Family, y: number[] | number[][], prior: number[], hasStart: boolean, warnings: Warnings): PreparedResponse;
/** The family's AIC before the 2 rank term (R's family$aic); NaN for the quasi families */
export declare function familyAic(fam: Family, y: number[], mu: number[], w: number[], size: number[] | undefined, dev: number, warnings: Warnings): number;
