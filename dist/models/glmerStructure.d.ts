import type { GlmFamilyName, GlmFamilySpec, GlmLink } from "./glmFamily.js";
import { type GlmerFamily } from "./glmerFamily.js";
import type { DataFrame } from "./modelFrame.js";
import { type MixedModelStructure, type MixedModelStructureOptions } from "./mixedStructure.js";
/** Options of {@link glmerStructure}. */
export interface GlmerStructureOptions extends MixedModelStructureOptions {
    /** The family: a name or an object with the link, as glm's (`"binomial"`, `{ family: "poisson", link: "sqrt" }`). */
    family?: GlmFamilyName | GlmFamilySpec;
    /** The link (overrides the family object's). */
    link?: GlmLink;
    /** Prior weights: one per row of `data` (`null` or NaN is missing), or the name of a numeric column. */
    weights?: readonly (number | null)[] | Float64Array | string;
    /** Offset: one per row of `data` (`null` or NaN is missing), or the name of a numeric column. */
    offset?: readonly (number | null)[] | Float64Array | string;
    /** The number of points of the adaptive Gauss-Hermite quadrature (0 to 100; default 1, the Laplace approximation). */
    nAGQ?: number;
}
/** The structure of a generalised linear mixed model (nothing fitted). */
export interface GlmerStructure extends MixedModelStructure {
    /** The family with lme4's links and variance functions. */
    family: GlmerFamily;
    /** The response as the family reads it (binomial: the proportions; rows kept). */
    y: number[];
    /** The prior weights after the family has read the response (binomial `cbind(s, f)`: times s + f). */
    weights: number[];
    /** The offset (0 without), rows kept. */
    offset: number[];
    /** The binomial sizes (s + f for `cbind(s, f)`, 1 otherwise); undefined for the other families. */
    size: number[] | undefined;
    /** The family's starting means (Gamma: their mean, lme4's). */
    mustart: number[];
    /** nAGQ (truncated to an integer). */
    nAGQ: number;
}
/**
 * The structure of a generalised linear mixed model `response ~ fixed part + (lhs | group) + ...` with lme4's checks,
 * errors and warnings (oracle/glmer-behaviour.md, stage 2a). The response may be `cbind(successes, failures)` (two
 * column names, binomial only) and, for binomial, strings (a factor: the first level is failure). Internal: not
 * exported from the package.
 *
 * @param formula A formula such as `"y ~ x + (1 | g)"` or `"cbind(s, f) ~ period + (1 | herd)"`.
 * @param data The data frame: an object of columns.
 * @param options The family and link, prior weights, offset, nAGQ, contrasts and level order of factors.
 */
export declare function glmerStructure(formula: string, data: DataFrame, options?: GlmerStructureOptions): GlmerStructure;
