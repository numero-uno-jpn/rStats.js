import { type KernelDensityOptions } from "../descriptive/density.js";
import { type BoxplotStatsOptions } from "../descriptive/boxplotStats.js";
import { type HistOptions, type HistResult } from "../descriptive/hist.js";
import type { Sample } from "../htest/types.js";
/**
 * Plot data for a normal Q-Q plot: the points (theoretical quantile, value) of {@link qqnorm} and the line of
 * {@link qqline} through the quartiles, drawn across the range of the theoretical quantiles.
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `points` (`x`, `y`, `index`: the position in the data); `line` (two points). `meta.intercept` and
 * `meta.slope` give the line. Missing values are left out.
 *
 * @example
 * ```ts
 * qqPlotData([3.1, 1.2, 5.5, 1.2, 9.0]).layers.points.length; // 5
 * ```
 *
 * @category Plot data
 */
export declare function qqPlotData(y: Sample): {
    layers: {
        points: {
            x: number;
            y: number;
            index: number;
        }[];
        line: {
            x: number;
            y: number;
        }[];
    };
    meta: {
        xLabel: string;
        yLabel: string;
        intercept: number;
        slope: number;
    };
};
/**
 * Plot data for a kernel density curve from {@link density}, with a rug of the data.
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `curve` (`x`, `y`); `rug` (`x`: the finite values). `meta.bw` and `meta.n` as R's plot title shows them.
 *
 * @example
 * ```ts
 * densityPlotData([1.2, 2.3, 2.9, 3.1, 4.8]).layers.curve.length; // 512
 * ```
 *
 * @category Plot data
 */
export declare function densityPlotData(x: Sample, options?: KernelDensityOptions): {
    layers: {
        curve: {
            x: number;
            y: number;
        }[];
        rug: {
            x: number;
        }[];
    };
    meta: {
        xLabel: string;
        yLabel: string;
        bw: number;
        n: number;
        kernel: import("../descriptive/density.js").DensityKernel;
        warnings: string[];
    };
};
/**
 * Plot data for box plots of one or more groups, from {@link boxplotStats} (as R's `boxplot()`): a sample, or an
 * object of named samples (one box each, in the object's order).
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `boxes` (`group`, `lower` whisker, `q1`, `median`, `q3`, `upper` whisker, `n`, `notchLower`,
 * `notchUpper`); `outliers` (`group`, `y`).
 *
 * @example
 * ```ts
 * boxplotData({ a: [1, 2, 3, 4, 40], b: [2, 3, 3, 5] }).layers.outliers; // [{ group: "a", y: 40 }]
 * ```
 *
 * @category Plot data
 */
export declare function boxplotData(groups: Sample | Readonly<Record<string, Sample>>, options?: BoxplotStatsOptions): {
    layers: {
        boxes: {
            group: string;
            lower: number;
            q1: number;
            median: number;
            q3: number;
            upper: number;
            n: number;
            notchLower: number;
            notchUpper: number;
        }[];
        outliers: {
            group: string;
            y: number;
        }[];
    };
    meta: {};
};
/**
 * Plot data for the empirical distribution function of a sample (as R's `plot(ecdf(x))`): the steps at the distinct
 * values (draw them as steps after each point), each with the fraction of values at or below it.
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layer `steps`: `x`, `y`. Missing values are left out.
 *
 * @example
 * ```ts
 * ecdfPlotData([3, 1, 2, 2]).layers.steps; // [{ x: 1, y: 0.25 }, { x: 2, y: 0.75 }, { x: 3, y: 1 }]
 * ```
 *
 * @category Plot data
 */
export declare function ecdfPlotData(x: Sample): {
    layers: {
        steps: {
            x: number;
            y: number;
        }[];
    };
    meta: {
        xLabel: string;
        yLabel: string;
    };
};
/**
 * Plot data for a histogram: the bars of {@link hist} (from a sample, with hist's options, or from its result).
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layer `bars`: `x0`, `x1` (the cell's ends), `mid`, `count`, `density`.
 *
 * @example
 * ```ts
 * histPlotData([1, 2, 2, 3, 3, 3, 4]).layers.bars.length;
 * ```
 *
 * @category Plot data
 */
export declare function histPlotData(x: Sample | HistResult, options?: HistOptions): {
    layers: {
        bars: {
            x0: number;
            x1: number;
            mid: number;
            count: number;
            density: number;
        }[];
    };
    meta: {
        yLabel: string;
    };
};
