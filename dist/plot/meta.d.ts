import type { MetaResult } from "../meta/metagen.js";
import type { RmaResult } from "../models/metaAnalysis.js";
/**
 * Options for {@link forestPlotData}.
 *
 * @category Plot data
 */
export interface ForestPlotDataOptions {
    /** The study labels. Default `"Study 1"`, `"Study 2"`, ... */
    labels?: readonly string[];
    /** The level of the study intervals. Default `0.95` (the pooled intervals are the fit's). */
    level?: number;
    /** A transformation of the estimates and limits, such as `Math.exp` for log odds ratios. Default none. */
    transform?: (x: number) => number;
    /** Show the common effect estimate (meta's results only). Default `true`. */
    common?: boolean;
    /** Show the random effects estimate (meta's results only). Default `true`. */
    random?: boolean;
    /** Show the prediction interval (meta's results only). Default `false`. */
    prediction?: boolean;
}
/**
 * Plot data for a forest plot of a meta-analysis from {@link metagen} (and the other meta functions that return a
 * {@link MetaResult}) or of an intercept-only {@link rma} fit: one row per study (from the top: `y` = k, k - 1, ...,
 * 1), then the pooled estimates below 0.
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `studies` (`label`, `y`, `estimate`, `lower`, `upper`, `se`, `weight` in percent: the random effects
 * weights when the random effects estimate is shown, else the common effect ones; for rma 1 / (vi + tau2));
 * `pooled` (`label`, `y`, `estimate`, `lower`, `upper`, `type`: "common", "random", "prediction"); `diamonds`
 * (closed polygons `x`, `y`, `group`, one per pooled estimate). `meta` carries tau2, I2, Q and its p-value.
 *
 * @example
 * ```ts
 * const m = metagen([0.2, 0.5, -0.1], [0.1, 0.2, 0.15]);
 * forestPlotData(m, { labels: ["A", "B", "C"] }).layers.studies[0].label; // "A"
 * ```
 *
 * @throws RangeError for a meta-regression (rma with moderators) or a label count that differs from the studies.
 * @category Plot data
 */
export declare function forestPlotData(fit: MetaResult | RmaResult, options?: ForestPlotDataOptions): {
    layers: {
        studies: {
            label: string;
            y: number;
            estimate: number;
            lower: number;
            upper: number;
            se: number;
            weight: number;
        }[];
        pooled: {
            label: string;
            y: number;
            estimate: number;
            lower: number;
            upper: number;
            type: string;
        }[];
        diamonds: {
            x: number;
            y: number;
            group: string;
        }[];
    };
    meta: {
        tau2: number;
        I2: number;
        Q: number;
        pvalQ: number;
        xLabel: string;
    };
};
/**
 * Options for {@link funnelPlotData}.
 *
 * @category Plot data
 */
export interface FunnelPlotDataOptions {
    /** The level of the pseudo confidence region. Default `0.95`. */
    level?: number;
    /** The centre of the region: `"common"` (default, as meta's funnel), `"random"`, or a number. */
    reference?: "common" | "random" | number;
    /**
     * Levels of a contour-enhanced funnel plot (Peters et al. 2008), around `contourCentre`, such as `[0.9, 0.95,
     * 0.99]`. Default none.
     */
    contours?: readonly number[];
    /** The centre of the contours (the null effect). Default `0`. */
    contourCentre?: number;
    /** The number of standard errors of the region's outline. Default `50`. */
    n?: number;
}
/**
 * Plot data for a funnel plot from a {@link MetaResult} or an {@link rma} fit: the studies' estimates against their
 * standard errors (plot the y axis reversed, 0 at the top), the reference line and the pseudo confidence region
 * reference +- z se for se from 0 to the largest standard error.
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `studies` (`x` = estimate, `y` = standard error); `region` (`y`, `xmin`, `xmax`); `reference` (two points
 * of the vertical line); `contours` (`level`, `y`, `xmin`, `xmax`).
 *
 * @example
 * ```ts
 * funnelPlotData(metagen([0.2, 0.5, -0.1, 0.3], [0.1, 0.2, 0.15, 0.3])).layers.region.length; // 50
 * ```
 *
 * @category Plot data
 */
export declare function funnelPlotData(fit: MetaResult | RmaResult, options?: FunnelPlotDataOptions): {
    layers: {
        studies: {
            x: number;
            y: number;
        }[];
        region: {
            y: number;
            xmin: number;
            xmax: number;
        }[];
        reference: {
            x: number;
            y: number;
        }[];
        contours: {
            level: number;
            y: number;
            xmin: number;
            xmax: number;
        }[];
    };
    meta: {
        xLabel: string;
        yLabel: string;
        reference: number;
    };
};
/**
 * The comparisons netgraph needs from a {@link netmeta} fit.
 *
 * @category Plot data
 */
export interface NetgraphInput {
    trts: readonly string[];
    studlab: readonly string[];
    treat1: readonly string[];
    treat2: readonly string[];
}
/**
 * Plot data for the network graph of a network meta-analysis from {@link netmeta}: the treatments on a circle (in
 * the fit's order, starting at the top and going clockwise, netgraph's default circle layout) and one edge per pair of
 * treatments compared directly, with the number of studies that compare them (netgraph's default line width).
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `nodes` (`label`, `x`, `y`); `edges` (`from`, `to`, `x1`, `y1`, `x2`, `y2`, `studies`).
 *
 * @example
 * ```ts
 * const fit = netmeta([0.3, 0.5, 0.2, 0.4], [0.1, 0.2, 0.15, 0.2], ["A", "A", "B", "A"], ["B", "C", "C", "B"],
 *   ["s1", "s2", "s3", "s4"]);
 * netgraphData(fit).layers.edges.map((e) => e.studies); // [2, 1, 1]
 * ```
 *
 * @category Plot data
 */
export declare function netgraphData(fit: NetgraphInput): {
    layers: {
        nodes: {
            x: number;
            y: number;
            label: string;
        }[];
        edges: {
            from: string;
            to: string;
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            studies: number;
        }[];
    };
    meta: {
        treatments: number;
    };
};
