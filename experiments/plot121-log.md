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

## Experiment 2: edge cases, errors and warnings (2026-11-28)

`plot121-edge.R` → `plot121-edge.json` (every case records the value or the condition's message and the warnings).

1. **density**: an automatic bandwidth needs 2 points ("need at least 2 points to select a bandwidth
   automatically"); one point with bw = 0.5 works. No values with bw given: "non-finite 'from'". NA without na.rm:
   "'x' contains missing values". **Inf counts in n but its mass is dropped**: density(c(1, Inf, 3, 4)) has n = 4,
   the bandwidth of the finite values and the peak 3/4 of density(c(1, 3, 4)). bw = 0, negative or adjust = 0:
   "'bw' is not positive."; bw NA: "non-finite 'bw'". n = 1 gives the point `from`; n = 513 and 5000 work (the grid
   rounded up to 1024 and 8192). from > to gives decreasing x. Weights: negative "'weights' must not be negative",
   NA "'weights' must all be finite", wrong length "'x' and 'weights' have unequal length"; weights summing to 5:
   the warnings "sum(weights) != 1  -- will not get true density" then "Selecting bandwidth *not* using 'weights'"
   (the second also for weights summing to 1 but unequal; not for equal weights). Kernel: a prefix ("epan") works,
   "foo" gives match.arg's message. bw = "NRD0" works (case ignored).
   Scales: 1e300 and 1e306 as at scale 1. **1e-300: R's bandwidth differs** (2.022e-300 instead of 2.093e-300;
   experiment 3 finds why). 1e15 + small values: the warning "collapsing to unique 'x' values" (approx's, the grid is
   finer than the values' precision).
2. bw.nrd0: c(1, 1) and c(0, 0, 0) use the fall-backs (sd 0, then |x[1]| = 1 or 0, then 1); an infinite value gives
   "missing value where TRUE/FALSE needed"; bw.nrd is 0 for quartiles that coincide with sd > 0? No: c(1, 2, 2, 2, 2,
   2, 9) has IQR 0, so bw.nrd = 1.06 × 0 = 0 while bw.nrd0 falls back to sd.
3. qqnorm: empty or all NA "y is empty or has only NAs"; one value x = 0; ±Inf ranked as the extremes; NaN like NA.
   ppoints: a vector gives its length; 0 → empty; 2.7 → 2 points with the denominator from 2.7; a = 2 and −1 are not
   checked.
4. boxplot.stats: empty / all NA give NA stats and conf, n = 0, no out; Inf and −Inf are outliers; coef < 0
   "'coef' must not be negative"; do.conf / do.out = FALSE give empty conf / out; 1e300 and 1e15 + small values
   exact.
5. lowess: n = 1, 2, 3 return y; equal x give the mean; NA or Inf in x "'delta' must be finite and > 0" (the default
   delta is NA / Inf), while delta = 0 is accepted despite the message; NA in y returns y unsmoothed; f ≤ 0 "'f'
   must be finite and > 0"; iter < 0 "'iter' must be finite and >= 0"; iter = 1.7 as 1; empty "invalid input";
   lengths "'x' and 'y' lengths differ". Scales: **R's smooth at 1e300 / 1e-300 is not the scaled smooth at 1, and
   near 1e15 it is 1e14 off** (experiment 3).
6. lm influence: leverage 1 gives NaN; with one residual degree of freedom rstudent is R's round-off (NaN or 0);
   a saturated model all NaN; zero weights and NA rows left out; 1e150, no intercept, rank deficiency fine.

## Experiment 3: density's weights after na.rm, the tiny bandwidth, lowess's scales (2026-11-28)

`plot121-weights.R` → `plot121-weights.json` (first run refused by the checker: my variables `ca`, `cb`, `cc`,
`ca` being the package ca's function; renamed `cA`, `cB`, `cC`).

1. Weights when na.rm drops values. Candidates (a) as they are, (b) rescaled to sum 1, (c) rescaled to their former
   total: weights summing to 1 (equal or not) → (b) and (c) exact, (a) off; weights summing to 2 → **(a) exact**,
   (b) and (c) off, with the "sum(weights) != 1" warning. So: rescaled to 1 when the weights summed to 1, else used
   as they are. (The first implementation, from experiment 2 alone, rescaled to the former total; corrected.)
2. At 1e-300, R's sd is 0 (var underflows: 0), so min(sd, IQR / 1.34) = 0 and bw.nrd0 falls back to |x[1]|:
   0.9 × 3.1 × 5^−1/5 = 2.022. An underflow in R; rStats.js keeps the scaled value (its sd does not underflow).
3. lowess: the smooth at 1e150 is the scaled one; at 1e300 not (values 3.53, 3.68, ... instead of 2.27, 3.19, ...);
   at 1e15 + values 1e14 off, and at 1e8 + values already 0.6 off at the first point. R loses the digits of the
   offset. rStats.js centres x and y at their midranges first (the smooth is shift-equivariant), and is the smooth
   at scale 1 shifted or scaled.
