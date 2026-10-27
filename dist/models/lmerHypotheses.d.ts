import type { DataFrame, FrameVariable } from "./modelFrame.js";
import { type DesignContrast } from "./modelMatrix.js";
/** A term of the fixed-effects formula. */
export interface FixedEffectsTerm {
    /** The term's label, such as `"A"`, `"x:f"`. */
    label: string;
    /** Its variables, in the order of the label. */
    variables: string[];
}
/**
 * The fixed-effects design of a mixed model, everything the hypothesis matrices depend on.
 */
export interface FixedEffectsDescription {
    /** The model matrix X (array of rows, the rows used), aliased columns dropped. */
    x: number[][];
    /** Names of the columns of X, such as `"(Intercept)"`, `"Aa2"`, `"x:flo"`. */
    colNames: string[];
    /** The term of each column of X: 0 for the intercept, k + 1 for `terms[k]`. */
    assign: number[];
    /** Whether the model has an intercept. */
    intercept: boolean;
    /** The terms of the fixed-effects formula, in the order of the formula's terms (sorted by order). */
    terms: FixedEffectsTerm[];
    /**
     * The variables of the terms, in the order of the formula (that of their first appearance), each with its
     * column of the model frame (rows used): numeric values, or a factor's levels and codes.
     */
    variables: {
        name: string;
        frame: FrameVariable;
    }[];
    /** The contrast of each factor among `variables` (`"contr.treatment"` unless another was given). */
    contrasts: Record<string, DesignContrast>;
}
/** Options of {@link fixedEffectsDescription}: those of lmer that shape X. */
export interface FixedEffectsDescriptionOptions {
    /** A contrast per factor of the fixed-effects part (default `"contr.treatment"`). */
    contrasts?: Record<string, DesignContrast>;
    /** The order of the levels of a factor. */
    levels?: Record<string, readonly string[]>;
}
/** The hypothesis matrix of one term. */
export interface TermHypothesis {
    /** The term's label. */
    term: string;
    /** The names of the rows (columns of X for Types I and II, of X with treatment contrasts for Type III). */
    rows: string[];
    /** The names of the columns: the columns of X. */
    columns: string[];
    /** The matrix (array of rows). */
    values: number[][];
}
/** The type of an ANOVA table. */
export type HypothesisType = "I" | "II" | "III";
/** Result of {@link lmerHypotheses}. */
export interface LmerHypotheses {
    /** One hypothesis per term with columns in X, in the order of the terms (a term with no rows included). */
    hypotheses: TermHypothesis[];
    /** R's messages (Type III: "Missing cells for: ..."). */
    messages: string[];
}
/**
 * The fixed-effects design of an lmer fit, from lmer's inputs: the formula's fixed part coded on the model frame of
 * the whole formula (rows with a missing value in any of its variables dropped, unused levels dropped), the
 * contrasts given, and the aliased columns of X (pivoted QR, tolerance 1e-7) dropped, as lmer's `fixefNames`.
 */
export declare function fixedEffectsDescription(formula: string, data: DataFrame, options?: FixedEffectsDescriptionOptions): FixedEffectsDescription;
/**
 * The Doolittle factorisation S = L U of a symmetric matrix without pivoting: L unit lower triangular, U upper
 * triangular; a column of L below a pivot |U_ii| < 1e-6 is 0, and entries below 1e-6 in absolute value are set to 0
 * at the end.
 */
export declare function doolittle(s: readonly (readonly number[])[]): {
    L: number[][];
    U: number[][];
};
/**
 * For each term, the indices of the terms that contain it: those whose variables include all of its own and at
 * least one more, with the same numeric variables (in the order of the terms).
 */
export declare function containingTerms(desc: FixedEffectsDescription): number[][];
/**
 * The full-dummy matrix rdX: an intercept column (with an intercept), then for each term the columns of its model
 * matrix with every level of each factor (the first variable varying fastest, numeric variables multiplying), and
 * the "Missing cells" message for its columns that are all 0.
 */
export declare function fullDummyMatrix(desc: FixedEffectsDescription): {
    x: number[][];
    colNames: string[];
    messages: string[];
};
/**
 * X remade from the same terms and model frame with treatment contrasts for every factor, restricted (if it is not
 * of full column rank) to the first r pivot columns of its pivoted QR decomposition (tolerance 1e-7), r its rank.
 */
export declare function treatmentModelMatrix(desc: FixedEffectsDescription): {
    x: number[][];
    colNames: string[];
    assign: number[];
};
/**
 * The hypothesis matrices of lmerTest's ANOVA table of the given type, one per term (oracle/lmertest-behaviour.md,
 * section 2). If X has at most one column or the formula at most one term, every type is built as Type I.
 */
export declare function lmerHypotheses(desc: FixedEffectsDescription, type?: HypothesisType): LmerHypotheses;
