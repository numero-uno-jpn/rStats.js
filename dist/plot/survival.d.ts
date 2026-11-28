import type { SurvfitResult } from "../models/survival.js";
import type { CumincResult } from "../models/competingRisks.js";
import type { RocResult } from "../htest/roc.js";
/**
 * Options for {@link survPlotData}.
 *
 * @category Plot data
 */
export interface SurvPlotDataOptions {
    /**
     * What to plot: `"surv"` (default) the survival S(t); `"event"` the cumulative incidence 1 - S(t); `"cumhaz"` the
     * fit's cumulative hazard (no band); `"cloglog"` log(-log S(t)) against log t (as R's `fun`).
     */
    fun?: "surv" | "event" | "cumhaz" | "cloglog";
    /** Times of the risk table. Default: R's `pretty()` of 0 and the last time. */
    riskTimes?: readonly number[];
}
/**
 * The rows of a survival curve: one per change point of the step function (draw them as steps after each point:
 * Observable Plot's `curve: "step-after"`, Plotly's `line.shape: "hv"`).
 *
 * @category Plot data
 */
export interface SurvStepRow {
    [key: string]: number | string;
    /** The time. */
    x: number;
    /** The curve's value from this time on. */
    y: number;
    /** The lower and upper confidence limits (NaN where there are none). */
    ymin: number;
    ymax: number;
    /** The stratum's label. */
    group: string;
}
/**
 * Plot data for Kaplan-Meier (or other) survival curves from {@link survfit} or {@link survfitCoxph}: the steps with
 * their confidence band, the censoring marks and a risk table. Each stratum starts at time 0 (or its first time if
 * that is negative) with S = 1, as R's `plot.survfit`.
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `steps` (`x`, `y`, `ymin`, `ymax`, `group`); `censor` (`x`, `y`, `group`, `n`: the number censored);
 * `riskTable` (`x`, `group`, `nRisk`).
 *
 * @example
 * ```ts
 * const fit = survfit([5, 8, 12, 12, 20], [1, 0, 1, 1, 0]);
 * const { layers } = survPlotData(fit);
 * layers.steps[0]; // { x: 0, y: 1, ymin: 1, ymax: 1, group: "all" }
 * ```
 *
 * @category Plot data
 */
export declare function survPlotData(fit: SurvfitResult, options?: SurvPlotDataOptions): {
    layers: {
        steps: SurvStepRow[];
        censor: Record<string, string | number>[];
        riskTable: Record<string, string | number>[];
    };
    meta: {
        xLabel: string;
        yLabel: string;
        groups: string[];
    };
};
/**
 * Plot data for cumulative incidence curves of competing risks from {@link cuminc}: one step function per group and
 * cause (as `plot.cuminc` of cmprsk), with the pointwise standard error.
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layer `steps`: `x` (time), `y` (the estimate), `se` (the square root of its variance), `group` (the curve's name),
 * `cause`, `stratum`.
 *
 * @example
 * ```ts
 * cumincPlotData(cuminc([1, 2, 3, 4], [1, 2, 1, 0])).layers.steps;
 * ```
 *
 * @category Plot data
 */
export declare function cumincPlotData(fit: CumincResult): {
    layers: {
        steps: {
            x: number;
            y: number;
            se: number;
            group: string;
            cause: string;
            stratum: string;
        }[];
    };
    meta: {
        xLabel: string;
        yLabel: string;
    };
};
/**
 * Plot data for an ROC curve from {@link roc}: the curve with false positive rate (1 - specificity) and sensitivity,
 * ordered for drawing as a line from (0, 0) to (1, 1), the chance diagonal, and the point of the largest Youden index
 * (sensitivity + specificity - 1; the first such point).
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `curve` (`x` = 1 - specificity, `y` = sensitivity, `specificity`, `threshold`); `diagonal`; `best`.
 * `meta.auc` is the area under the curve.
 *
 * @example
 * ```ts
 * const r = roc([0, 0, 1, 1, 0, 1], [0.1, 0.4, 0.35, 0.8, 0.2, 0.9]);
 * rocPlotData(r).meta.auc; // r.auc
 * ```
 *
 * @category Plot data
 */
export declare function rocPlotData(fit: RocResult): {
    layers: {
        curve: {
            x: number;
            y: number;
            specificity: number;
            threshold: number;
        }[];
        diagonal: {
            x: number;
            y: number;
        }[];
        best: {
            x: number;
            y: number;
            specificity: number;
            threshold: number;
            youden: number;
        }[];
    };
    meta: {
        xLabel: string;
        yLabel: string;
        auc: number;
        direction: import("../htest/roc.js").RocDirection;
    };
};
