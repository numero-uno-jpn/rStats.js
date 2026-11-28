# 1.21.0 (plot data): the record of the trial and error

The clean-room evidence for how R's behaviour was found: every attempt in order, the failed ones too, with what each
showed. Nobody read the source of R or of the GPL packages; each finding comes from the documentation (the help pages)
and from the output of exported functions compared with candidate formulas written for these experiments (from the
help pages and the papers they cite). All runs: R 4.6.2 x86_64 (`rstats-oracle-amd64:4.6.2`), scripts checked with
`scripts/r-experiment-check.mjs` (which now also lists the plotting functions of stats, grDevices and graphics as
reference functions: they may only be called). Issue #571 has the summaries.

## Experiment 1: the statistics behind the plots (2026-11-28)

`plot121-basic.R` → `plot121-basic.json`; candidates in `plot121-basic-check.mjs` (run with node; uses the built
rStats.js 1.20.0 for qnorm, quantile, fivenum, sd, IQR, median). First run refused by the checker: `dist` (my column
name for cars' second column, also stats' `dist`) named without a call; renamed to `stop` / `cars[[2]]`, no other
change.

1. **ppoints** = (i − a) / (n + 1 − 2a), a = 3/8 for n ≤ 10 else 1/2 (help page): exact for n = 1, 2, 5, 10, 11, 50
   and a = 0, 1. With n = 1 and a = 1, R gives NaN (0 / 0).
2. **qqnorm**: x = qnorm(ppoints(n)) placed by the rank of y (ties in order of appearance), NA where y is NA and n
   counting the non-NA values: within 8e-16 on all samples.
3. **qqline** through the type-7 quartiles of y and of the normal: exact (computed in the script from the documented
   construction; the line itself is drawn, not returned).
4. **boxplot.stats**: stats = fivenum with the whiskers moved to the most extreme points within coef × (hinge
   spread) of the hinges, out = the points beyond, conf = median ± 1.58 × (hinge spread) / √n, n = the non-NA count;
   coef = 0 keeps the extremes and gives no out: exact for coef 1.5, 0, 3, with ties, n = 1, 2, constant, NA.
   `boxplot(count ~ spray, plot = FALSE)` gives the same per group (out 7 and 12 in groups 3 and 4).
5. **bw.nrd0** = 0.9 min(sd, IQR / 1.34) n^−1/5: exact. The help page says only "unless the quartiles coincide when a
   positive result will be guaranteed"; the candidate fall-back (sd, then |x[1]|, then 1) is exact for the constant
   sample (2.5 → 0.9 × 2.5 × 6^−1/5) and for ties. n = 1: an error "need at least 2 data points".
   **bw.nrd** = 1.06 min(sd, IQR / 1.34) n^−1/5: exact (0 for the constant sample).
6. **lowess** (Cleveland 1979; the algorithm of Cleveland 1981): sort by x; ns = max(2, min(n, floor(f n + 1e-5)))
   neighbours; tricube weights with the 0.001 h / 0.999 h cut-offs; the local line only when the weighted spread of x
   exceeds 0.001 × range; robustness by bisquare weights of the residuals over 6 × median |residual| with the
   0.001 / 0.999 cut-offs and a stop when 6 MAD < 1e-7 × mean |residual|; points within delta = 0.01 × range of the
   last fitted one are interpolated linearly, equal x reuses the fit. **floor: within 4e-14 on all 16 cases**
   (cars, faithful, small, unsorted; f 2/3, 0.3, 1; iter 3, 0, 5; delta 0). round(f n) instead: off by 2e-2 for two
   cases. The output x is sorted.
7. **density**, candidate A (the exact kernel sum at R's x): off by 1e-4 to 0.5 of the peak (0.5 for the rectangular
   kernel). Candidate B (the help page's description: linear binning of the weights on a regular grid, circular FFT
   convolution with the kernel sampled at the grid's lags, linear interpolation at the output x), with grid
   [from − k bw, to + k bw], 2m cells, m = max(n, 512) rounded up to a power of 2, the density on the first m points:
   **k = 4 within 3e-12 of the peak for all seven kernels** on nine samples (rectangular the largest, 2.6e-12; the
   others ≤ 1.3e-13), n = 100 and 1000, from / to, adjust, bw = 0.3, cut = 1, weights, bw = "SJ", NA removed;
   k = 3 off by 1e-4 to 0.4. The kernels with bw = their standard deviation as on the help page (a = bw √3, √6, √5,
   √7, bw / √(1/3 − 2/π²), bw / √(1 − 8/π²)). Negative values from FFT round-off are set to 0 (candidate; nothing
   showed otherwise).
8. bw.ucv, bw.bcv, bw.SJ ("ste", "dpi") values recorded in the JSON but not matched: they minimise / solve binned
   criteria (nb = 1000) with optimize / uniroot tolerances. Not pursued in this version (see the Choices).
9. lm's hatvalues, rstandard (also "predictive"), rstudent, cooks.distance, dffits, covratio, dfbetas recorded for
   cars, an mtcars fit with a factor and a weighted fit; matched in the tests of the implementation.
