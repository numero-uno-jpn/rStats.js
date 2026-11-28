import type { HclustFit } from "../multivariate/hclust.js";
import type { PrcompResult } from "../linalg/lu.js";
/**
 * Options for {@link dendrogramData}.
 *
 * @category Plot data
 */
export interface DendrogramDataOptions {
    /**
     * The fraction of the height range by which a leaf hangs below the merge that takes it in (R's `hang`). Default
     * `0.1`, as `plot.hclust`; a negative value puts every leaf at height 0.
     */
    hang?: number;
}
/**
 * Plot data for the dendrogram of a hierarchical clustering ({@link hclust}): the leaves at x = 1, ..., n in the
 * clustering's order, each merge at its height and centred over the two clusters it joins, as R's `plot.hclust`.
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `segments` (`x1`, `y1`, `x2`, `y2`: the vertical and horizontal lines of the tree, `merge`: the merge's
 * row, 1-based); `leaves` (`x`, `y`: the end of the leaf's line, `label`, `index`: the observation, 1-based);
 * `nodes` (`x`, `y`, `merge`).
 *
 * @example
 * ```ts
 * const hc = hclust(dist([[1], [2], [6], [7], [15]]));
 * dendrogramData(hc).layers.leaves.map((l) => l.x); // [1, 2, 3, 4, 5]
 * ```
 *
 * @category Plot data
 */
export declare function dendrogramData(fit: HclustFit, options?: DendrogramDataOptions): {
    layers: {
        segments: {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            merge: number;
        }[];
        leaves: {
            x: number;
            y: number;
            label: string;
            index: number;
        }[];
        nodes: {
            x: number;
            y: number;
            merge: number;
        }[];
    };
    meta: {
        yLabel: string;
        method: import("../multivariate/hclust.js").HclustMethod;
    };
};
/**
 * Options for {@link biplotData}.
 *
 * @category Plot data
 */
export interface BiplotDataOptions {
    /** The two components, 1-based. Default `[1, 2]`. */
    choices?: readonly [number, number];
    /** The variables are scaled by lambda^scale, the observations by lambda^(1 - scale). Default `1` (as R). */
    scale?: number;
    /** Gabriel's principal component biplot: lambda = 1, observations times sqrt(n), variables over sqrt(n). Default `false`. */
    pcBiplot?: boolean;
}
/**
 * Plot data for a biplot of principal components ({@link prcomp}), as R's `biplot.prcomp`: the observations' scores and
 * the variables' loadings (draw these as arrows from the origin, usually on axes of their own), with lambda the
 * components' singular values sdev * sqrt(n).
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `observations` (`x`, `y`, `index`, 1-based); `variables` (`x`, `y`, `variable`: 1-based or the name given).
 *
 * @example
 * ```ts
 * biplotData(prcomp([[1, 2], [2, 3.5], [3, 3], [4, 6]])).layers.variables.length; // 2
 * ```
 *
 * @throws RangeError for components out of range.
 * @category Plot data
 */
export declare function biplotData(fit: PrcompResult, options?: BiplotDataOptions & {
    variableNames?: readonly string[];
}): {
    layers: {
        observations: {
            x: number;
            y: number;
            index: number;
        }[];
        variables: {
            x: number;
            y: number;
            variable: string;
        }[];
    };
    meta: {
        xLabel: string;
        yLabel: string;
    };
};
