import { type DataFrame } from "./modelFrame.js";
import { type ModelMatrixOptions } from "./modelMatrix.js";
/** A random-effects term of a mixed model, after the expansion of its grouping expression and of `||`. */
export interface RandomEffectsTerm {
    /** The term as R deparses it, such as `"1 | g"`, `"0 + x | b:a"`. */
    label: string;
    /** Index of the term's grouping factor in `groups`. */
    group: number;
    /** Names of the columns of the term's left-hand side model matrix, such as `"(Intercept)"`, `"x"`, `"flo"`. */
    columns: string[];
    /** The left-hand side model matrix (array of rows, the rows kept). */
    matrix: number[][];
    /** Number of levels of the grouping factor. */
    nLevels: number;
    /** First column of the term in Z (0-based). */
    zOffset: number;
    /** First parameter of the term in θ (0-based). */
    thetaOffset: number;
}
/** A grouping factor of a mixed model. */
export interface GroupingFactor {
    /** Its name: the variables joined by `:`, such as `"g"`, `"b:a"`. */
    name: string;
    /** The levels present in the rows kept, in level order. */
    levels: string[];
    /** The level index (0-based) of each row kept. */
    codes: number[];
}
/** A sparse column: the rows (0-based, increasing) of its nonzero entries and their values. */
export interface SparseColumn {
    rows: number[];
    values: number[];
}
/** An entry of Λ_θ (0-based row and column), which holds θ[theta]. */
export interface CovarianceFactorEntry {
    row: number;
    col: number;
    theta: number;
}
/** The structure of a linear mixed model (nothing fitted). */
export interface MixedModelStructure {
    /** 0-based indices of the rows of the data kept (rows with a missing value in a variable of the formula dropped). */
    rows: number[];
    /** The response (rows kept). */
    y: number[];
    /** Names of the columns of X (aliased columns dropped). */
    xColNames: string[];
    /** The fixed-effects model matrix X (array of rows). */
    x: number[][];
    /** The random-effects terms, in their final order. */
    terms: RandomEffectsTerm[];
    /** The distinct grouping factors, in order of first use by the terms. */
    groups: GroupingFactor[];
    /** Number of columns of Z. */
    q: number;
    /** Z (n × q) by columns, nonzero entries only. */
    z: SparseColumn[];
    /** The label of the level of each column of Z. */
    zColLevels: string[];
    /** The initial θ: 1 for the diagonal elements of the blocks, 0 for the others. */
    theta: number[];
    /** Lower bounds of θ: 0 for the diagonal elements, -Infinity for the others. */
    lower: number[];
    /** The entries of Λ_θ (lower triangular, q × q), by column then row. */
    lambda: CovarianceFactorEntry[];
    /** R's messages (rank deficiency of X). */
    messages: string[];
    /** R's warnings (predictors on very different scales). */
    warnings: string[];
}
/** Options of {@link mixedModelStructure}: those of the fixed-effects model matrix. */
export type MixedModelStructureOptions = ModelMatrixOptions;
/**
 * The structure of a linear mixed model `response ~ fixed part + (lhs | group) + ...`: the model frame, X, Z, the
 * layout of Λ_θ, the initial θ and its lower bounds, with lme4's checks, errors, messages and warnings
 * (oracle/lmer-behaviour.md, stage 1a). Internal: not exported from the package.
 *
 * @param formula A formula such as `"y ~ x + (x | g)"`, `"y ~ (1 | a/b)"` or `"y ~ (x || g)"`.
 * @param data The data frame: an object of columns.
 * @param options The contrasts (fixed-effects part only) and the level order of factors.
 */
export declare function mixedModelStructure(formula: string, data: DataFrame, options?: MixedModelStructureOptions): MixedModelStructure;
