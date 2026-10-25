import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
import type { LocationScaleParams } from "./logistic.js";
export declare function dcauchy1(x: number, location: number, scale: number, log: boolean): number;
/**
 * P[X <= q] (lower) / P[X > q] (!lower). For |z| > 1 the smaller tail atan(1/|z|)/π is computed without forming z,
 * using 1/|z| = scale / |q - location| (so the log value survives even if z overflows)
 */
export declare function pcauchy1(q: number, location: number, scale: number, lowerTail: boolean, logP: boolean): number;
export declare function qcauchy1(p: number, location: number, scale: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the Cauchy distribution. Equivalent to R's `dcauchy(x, location = 0, scale = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 */
export declare function dcauchy<T extends Vectorizable>(x: T, options?: LocationScaleParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the Cauchy distribution. Equivalent to R's `pcauchy(q, location = 0, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 */
export declare function pcauchy<T extends Vectorizable>(q: T, options?: LocationScaleParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the Cauchy distribution. Equivalent to R's `qcauchy(p, location = 0, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export declare function qcauchy<T extends Vectorizable>(p: T, options?: LocationScaleParams & TailOptions): VectorResult<T>;
