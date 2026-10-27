// Descriptive statistics (rStats.js/descriptive): R's summaries of vectors and matrices, with naRm for missing values
export { sum, prod, mean, weightedMean, variance, sd, median, range, cumsum, cumprod, cummax, cummin, diff, } from "../descriptive/basic.js";
export { quantile, IQR, fivenum, mad } from "../descriptive/quantile.js";
export { rank } from "../descriptive/rank.js";
export { cov, cor } from "../descriptive/cov.js";
export { tabulate, table, unique, cut, findInterval } from "../descriptive/table.js";
export { completeCases, naOmit } from "../descriptive/missing.js";
export { hist, pretty, ecdf } from "../descriptive/hist.js";
export { skewness, kurtosis, geometricMean, modes, meanAD, cv, scale, } from "../descriptive/moments.js";
export { tapply, split, aggregate, } from "../data/grouping.js";
export { merge, subset, fromRows, toRows, } from "../descriptive/dataFrames.js";
export { pivotLonger, pivotWider, } from "../descriptive/pivot.js";
