// Descriptive statistics (rStats.js/descriptive): R's summaries of vectors and matrices, with naRm for missing values

export {
  sum, prod, mean, weightedMean, variance, sd, median, range, cumsum, cumprod, cummax, cummin, diff,
  type NaRmOptions, type MeanOptions, type DiffOptions,
} from "../descriptive/basic.js";
export { quantile, IQR, fivenum, mad, type QuantileOptions, type MadOptions } from "../descriptive/quantile.js";
export { rank, type RankOptions, type TiesMethod } from "../descriptive/rank.js";
export { cov, cor, type CovOptions, type CorUse } from "../descriptive/cov.js";
export { tabulate, table, unique, cut, findInterval, type TableOptions, type CutOptions, type FindIntervalOptions } from "../descriptive/table.js";
export { completeCases, naOmit, type MissingVector } from "../descriptive/missing.js";
export { hist, pretty, ecdf, type HistOptions, type HistResult, type PrettyOptions } from "../descriptive/hist.js";
export {
  skewness, kurtosis, geometricMean, modes, meanAD, cv, scale,
  type MomentOptions, type MeanADOptions, type CvOptions, type ScaleOptions,
} from "../descriptive/moments.js";
export {
  tapply, split, aggregate,
  type TapplyResult, type SplitOptions, type AggregateValue, type GroupingLabels, type GroupingLevel,
} from "../data/grouping.js";
export {
  merge, subset, fromRows, toRows,
  type MergeOptions, type SubsetOptions, type FromRowsOptions, type DataRow, type DataValue,
} from "../descriptive/dataFrames.js";
export {
  pivotLonger, pivotWider,
  type PivotLongerOptions, type PivotWiderOptions, type PivotResult, type PivotSummary,
} from "../descriptive/pivot.js";
