import { type LmResult } from "../models/lm.js";
import type { AcfResult } from "../timeseries/acf.js";
import type { ForecastResult } from "../timeseries/forecastArima.js";
import type { MatrixInput } from "../linalg/matrix.js";
import type { Sample } from "../htest/types.js";
/**
 * Options for {@link lmDiagnosticsData}.
 *
 * @category Plot data
 */
export interface LmDiagnosticsDataOptions {
    /** How many of the most extreme points each panel flags (R's `id.n`). Default `3`. */
    idN?: number;
    /** The levels of Cook's distance contours. Default `[0.5, 1]`. */
    cookLevels?: readonly number[];
    /** The span of the lowess smooths (panel.smooth's). Default `2/3`. */
    span?: number;
}
/**
 * Plot data for the four default diagnostic plots of a linear model ({@link lm}), as R's `plot.lm` (`which = c(1, 2,
 * 3, 5)`), for the rows of non-zero weight (the residuals weighted as in R).
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers (`index` is the row of the fit, `extreme` flags the `idN` most extreme points as R labels them):
 * `residualsFitted` (`x` = fitted, `y` = residual) and its `residualsFittedSmooth`; `qq` (`x` = theoretical
 * quantile, `y` = standardized residual); `scaleLocation` (`x` = fitted, `y` = sqrt |standardized residual|) and
 * `scaleLocationSmooth`; `leverage` (`x` = leverage, `y` = standardized residual, `cooks`) and `leverageSmooth`;
 * `cookContours` (`level`, `side` +1 or -1, `x`, `y`: the curves where Cook's distance equals each level). Rows of
 * leverage 1 are left out of the panels that need standardized residuals (R does the same, with a warning).
 *
 * @example
 * ```ts
 * const d = lmDiagnosticsData(lm([1, 2, 3, 4, 10], [1.1, 1.9, 3.2, 3.9, 7]));
 * d.layers.leverage.length; // 5
 * ```
 *
 * @category Plot data
 */
export declare function lmDiagnosticsData(fit: LmResult, options?: LmDiagnosticsDataOptions): {
    layers: {
        residualsFitted: {
            x: number;
            y: number;
            index: number;
            extreme: boolean;
        }[];
        residualsFittedSmooth: {
            x: number;
            y: number;
        }[];
        qq: {
            x: number;
            y: number;
            index: number;
            extreme: boolean;
        }[];
        scaleLocation: {
            x: number;
            y: number;
            index: number;
            extreme: boolean;
        }[];
        scaleLocationSmooth: {
            x: number;
            y: number;
        }[];
        leverage: {
            x: number;
            y: number;
            cooks: number;
            index: number;
            extreme: boolean;
        }[];
        leverageSmooth: {
            x: number;
            y: number;
        }[];
        cookContours: {
            level: number;
            side: number;
            x: number;
            y: number;
        }[];
    };
    meta: {
        titles: string[];
        rank: number;
    };
};
/**
 * Plot data for a coefficient plot of a linear model: each coefficient with its confidence interval ({@link confint}).
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layer `coefficients`: `term`, `estimate`, `lower`, `upper`, `y` (from the top: the number of coefficients down to 1).
 *
 * @example
 * ```ts
 * coefPlotData(lm([1, 2, 3, 4, 10], [1.1, 1.9, 3.2, 3.9, 7])).layers.coefficients[1].term; // "x1"
 * ```
 *
 * @category Plot data
 */
export declare function coefPlotData(fit: LmResult & {
    coefNames?: readonly string[];
}, options?: {
    level?: number;
    intercept?: boolean;
}): {
    layers: {
        coefficients: {
            term: string;
            estimate: number;
            lower: number;
            upper: number;
            y: number;
        }[];
    };
    meta: {
        xLabel: string;
    };
};
/**
 * Plot data for the fitted line of a linear model with its confidence band (for the mean) and prediction band (for a
 * new observation), from {@link predict}, over the given new predictor values.
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layer `band`: `x` (the first predictor's value), `fit`, `confLower`, `confUpper`, `predLower`, `predUpper`.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5], [1.1, 1.9, 3.2, 3.9, 5.1]);
 * predictionBandData(fit, [1, 2, 3, 4, 5]).layers.band.length; // 5
 * ```
 *
 * @category Plot data
 */
export declare function predictionBandData(fit: LmResult, newdata: MatrixInput | Sample, options?: {
    level?: number;
}): {
    layers: {
        band: {
            x: number;
            fit: number;
            confLower: number;
            confUpper: number;
            predLower: number;
            predUpper: number;
        }[];
    };
    meta: {
        level: number;
    };
};
/**
 * Plot data for an autocorrelation plot from {@link acf} (or {@link pacf}, {@link ccf}): the bars and the band
 * +- qnorm((1 + ci) / 2) / sqrt(n.used) of R's `plot.acf` (white noise).
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `bars` (`lag`, `acf`); `band` (`lag`, `lower`, `upper`, over the lags). `meta.clim` is the band's half-width.
 *
 * @example
 * ```ts
 * acfPlotData(acf([1, 3, 2, 5, 4, 6, 5, 8, 7, 9])).meta.clim;
 * ```
 *
 * @category Plot data
 */
export declare function acfPlotData(a: AcfResult): {
    layers: {
        bars: {
            lag: number;
            acf: number;
        }[];
        band: {
            lag: number;
            lower: number;
            upper: number;
        }[];
    };
    meta: {
        xLabel: string;
        yLabel: string;
        clim: number;
    };
};
/**
 * Options for {@link forecastPlotData}.
 *
 * @category Plot data
 */
export interface ForecastPlotDataOptions {
    /** The time of the first observation. Default `1`. */
    start?: number;
    /** Observations per unit of time (12 for monthly data with yearly time). Default `1`. */
    frequency?: number;
}
/**
 * Plot data for a forecast fan, as forecast's `plot.forecast`: the observed series, the point forecasts and their
 * prediction intervals (one band per level, widest first), from a forecast of rStats.js ({@link forecast},
 * {@link forecastArima}, {@link forecastEts}, ...).
 * Not an R function. R's plots draw these values without returning them.
 *
 * Layers: `history` (`x` = time, `y`); `mean` (`x`, `y`); `intervals` (`x`, `level`, `lower`, `upper`).
 *
 * @example
 * ```ts
 * const y = [1, 3, 2, 5, 4, 6, 5, 8, 7, 9];
 * const d = forecastPlotData(y, forecast(arima(y, { order: [1, 0, 0] }), { h: 3 }), { start: 2000 });
 * d.layers.mean.map((r) => r.x); // [2010, 2011, 2012]
 * ```
 *
 * @category Plot data
 */
export declare function forecastPlotData(history: Sample, fc: ForecastResult, options?: ForecastPlotDataOptions): {
    layers: {
        history: {
            x: number;
            y: number;
        }[];
        mean: {
            x: number;
            y: number;
        }[];
        intervals: {
            x: number;
            level: number;
            lower: number;
            upper: number;
        }[];
    };
    meta: {
        title: string;
        levels: number[];
    };
};
