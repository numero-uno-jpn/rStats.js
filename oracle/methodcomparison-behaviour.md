# Measurement agreement and method comparison (rStats.js 1.4.0): the behaviour to reproduce

This file describes, in words and formulas, what the R functions below compute, for an implementation that must not
read their source. It was written by reading the packages' R code (deparsed from the image `rstats-oracle:4.6.2`,
R 4.6.2, package snapshot of 2026-10-23) and, for mcr, its C source (the CRAN tarball of the same version), and by
checking each statement against their output. Where this file and a fixture seem to disagree, report it instead of
working around it.

| package | version | functions |
|---|---|---|
| BlandAltmanLeh | 0.3.1 | `bland.altman.stats` |
| mcr | 1.3.3.1 (needs robslopes) | `mcreg` (`Deming`, `WDeming`, `PaBa`, `PaBaLarge`), `calcCUSUM` |
| psych | 2.6.9 (lme4 2.0.6) | `ICC` |
| TOSTER | 0.8.6 | `t_TOST` (and, described only, `tsum_TOST`, `log_TOST`, `wilcox_TOST`, `boot_t_TOST`) |
| irr | 0.85 | `icc` (already in rStats.js; compared in section 3) |
| equivalence | 0.8.2 | `tost` (already in rStats.js; compared in section 4) |

Oracles and fixtures (`npm run oracle -- <name>`; each runs in a few seconds and well under 1 GB):

| oracle | fixture | cases |
|---|---|---|
| `oracle/blandaltman.R` | `blandAltman` | 44 |
| `oracle/mcreg.R` | `mcreg` | 120 |
| `oracle/iccpsych.R` | `iccPsych` | 31 |
| `oracle/toster.R` | `tTOST` | 70 |

The fixtures keep the packages' own field names (`CI.lines`, `para`, `B0jack`, `lower bound` as the 6th/7th entry,
`effsize`, `smd`, ...) because the API is undecided; the arguments are in camelCase. Every case records the
package's warnings (`warnings`), and where the package talks through `message()` (psych, lme4, TOSTER) also
`messages`; an error is `{"error": message}`. Where the package is inaccurate or wrong, the case has a `reference`
with a `refKind` saying how it was computed (each oracle's header lists the kinds). The header of each oracle gives
the exact layout of its fixture.

Notation: `n` pairs (or subjects), `x` the first method (mcr: the reference method, R's `x`), `y` the second;
`d_i` differences, `d̄` their mean, `s` their standard deviation (denominator n − 1). `qt(p, df)`, `qnorm(p)`,
`qf(p, df1, df2)` are R's quantile functions; "quantile" without qualification is R's `quantile` type 7.

## Easy to get wrong

1. **BlandAltmanLeh's interval of a limit of agreement uses `sqrt(3 s²/n)` as its standard error, whatever `two`
   is.** `3/n` is Bland and Altman's (1986) approximation of `1/n + z²/(2(n − 1))` for z = 1.96 and large n; it
   is not the exact interval (Carkeet 2015, noncentral t), which is wider for small n (fixture: 3% wider at n = 17,
   6% at n = 10, twice as wide at n = 2). Its intervals are two-sided only; there is no one-sided option
   (`conf.int` is a level, not a side). `mode = 1` gives `x − y`, `mode = 2` gives `y − x`.
2. **mcr's `error.ratio` is σ²(x)/σ²(y)** — the error variance of the *reference* method (x) over that of the test
   method (y) — the reciprocal of the δ = σ²(y)/σ²(x) of most Deming formulas (Linnet 1990 calls it λ as mcr
   does). With error.ratio → 0 (x without error) the slope tends to the least-squares slope of y on x.
3. **mcr's default for `mcreg` is Passing-Bablok with a bootstrap interval** (`method.reg = "PaBa"`, `method.ci =
   "bootstrap"`, `method.bootstrap.ci = "quantile"`, `nsamples = 999`): random unless `rng.seed` is given.
   Analytical Deming intervals need `method.ci = "analytical"` explicitly; WDeming has no analytical interval (an
   error), so it needs jackknife or bootstrap.
4. **mcr's Passing-Bablok works on angles, not slopes.** Every pairwise slope is stored as `atan(dy/dx)`; with the
   default `slope.measure = "radian"` the median of an even number of slopes is `tan` of the **mean of the two
   middle angles**, not the mean of the two middle slopes (that is `slope.measure = "tangent"`, the textbook
   rule). Odd positions are `tan(atan(dy/dx))`, which is dy/dx only to a few ulp (a slope of exactly 1 comes out
   as 0.99999999999999989).
5. **Differences below a relative 1e-12 are zero in mcr's Passing-Bablok** (C function `diff`, R's `calcDiff`):
   `x_k − x_j` is set to 0 when `|x_k − x_j| < 1e-12 (|x_k| + |x_j|)/2`; a pair with x "equal" and y different is a
   vertical slope (+π/2 for a positive Kendall correlation, −π/2 otherwise), a pair with both equal is dropped. The
   same rule is applied to the residuals `y − b x` whose median is the intercept. (x = 1 and 1 + 1e-13 are tied, 1
   and 1 + 1e-11 are not: fixture cases `near` and `near2`.)
6. **When the Passing-Bablok interval of the slope is undefined on either side** (too few points: always for
   n ≤ 4), mcr returns **both** slope limits and **both** intercept limits as −Inf and Inf (the C code signals NA,
   R replaces NA by ∓Inf).
7. **psych's `ICC` uses `lmer = TRUE` by default**: the mean squares are rebuilt from lme4's REML variance
   components (`MSB = k σ²_subject + σ²_e`, `MSJ = n σ²_rater + σ²_e`, `MSE = σ²_e`, `MSW = σ²_e + σ²_rater`). With
   complete data and both components inside their range this is mathematically the ANOVA result, but lme4's
   optimiser stops early: **the default results are only about 1e-5 to 1e-4 (relative) accurate** (fixture
   `reference`, refKind `anova`). Where an ANOVA component would be negative, REML puts it at 0 and the results
   differ from the ANOVA ones (the ICC becomes 0 instead of negative, F becomes 1, ...).
8. **psych's ICC2k interval is not irr's** "twoway agreement average" interval: psych transforms the bounds of
   ICC2 by Spearman-Brown, irr uses McGraw and Wong's formula with k; all other numbers of the six forms agree with
   irr to rounding (section 3.3).
9. **TOSTER's `t_TOST` intervals are 1 − 2α intervals** (90% for the default α = 0.05), for the raw difference and
   for the standardised mean difference alike; `eqb` of length 1 means `(−|eqb|, |eqb|)`, of length 2 `(min, max)`.
   The **standardised effect size is Hedges' g with the average-variance denominator `sqrt((s1² + s2²)/2)` (g(av))
   for Welch** and the pooled SD for `var.equal = TRUE`; paired tests standardise by the SD of the differences
   (g(z)); the degrees of freedom of J and of the noncentral t are different in each case (section 4.3).
10. **TOSTER's noncentral-t limits are found by an optimiser** (about 1e-9 relative error, up to 7e-9 in the
    fixture); the fixture gives the roots as `reference` (refKind `nct`).
11. **Scale**: BlandAltmanLeh's `sd` and mcr's sums of squares and cross-products overflow for data near 2^500
    and above and underflow near 2^−500 and below (mcr then fails its own check `sd(x) > 0`); psych's `aov` gives
    NaN at 2^±520. All the formulas are homogeneous in the data, so scaling by a power of 2 first (design rules)
    gives the right values (fixtures' refKind `scaled`).

## 1. Bland-Altman analysis: `BlandAltmanLeh::bland.altman.stats`

`bland.altman.stats(group1, group2, two = 1.96, mode = 1, conf.int = 0.95)`.

Checks, in order (each `stop()` with this exact text):
- `length(group1) != length(group2)`: `Error in bland.altman.stats: groups differ in length.`
- non-numeric group1 / group2: `Error in bland.altman.stats: group1 is not numeric.` (group2 likewise).
- `two <= 0`: `Error in bland.altman.stats: inproper value of two.` (sic).
- mode not 1 or 2: `Error in bland.altman.stats: mode must be either 1 oder 2.` (sic).
- `conf.int` is not checked (outside [0, 1] gives NaN limits with R's warning `NaNs produced`).

Then the pairs with a missing value in either group are dropped (`na.omit` on the data frame; NaN counts as
missing). `based.on` = number of complete pairs. If `based.on < 2`: the warning `Warning in
bland.altman.stats:less than 2 data pairs after deleting NAs.` (no space after the colon), and the computation
continues (sd of one value is NA, so the limits are NA; qt with df 0 adds `NaNs produced`).

Formulas (with `d = group1 − group2` for mode 1, `group2 − group1` for mode 2):
- `means = (group1 + group2)/2` per pair, `diffs = d`;
- `mean.diffs = d̄`, `critical.diff = two × s`, `lower.limit = d̄ − two s`, `upper.limit = d̄ + two s`;
- `t1 = qt((1 − conf.int)/2, n − 1)`, `t2 = qt((conf.int + 1)/2, n − 1)`;
- `mean.diff.ci.lower/upper = d̄ + t1 s/√n`, `d̄ + t2 s/√n`;
- `lower.limit.ci.lower/upper = lower.limit + t1 sqrt(3 s²/n)`, `lower.limit + t2 sqrt(3 s²/n)`; the same for
  the upper limit. (So conf.int = 0 gives intervals of width 0; conf.int = 1 gives ±Inf.)

Result fields: `means`, `diffs`, `groups` (the complete pairs), `based.on`, `lower.limit`, `mean.diffs`,
`upper.limit`, `lines` (the three as a named vector), `CI.lines` (six, in the order lower.limit.ci.lower,
lower.limit.ci.upper, mean.diff.ci.lower, mean.diff.ci.upper, upper.limit.ci.lower, upper.limit.ci.upper),
`two`, `critical.diff`.

Boundaries: identical methods (s = 0) give every limit and interval equal to d̄; one pair gives NA.

Accuracy: `sd()` squares the deviations, so data of order 2^1000 overflow (`CI.lines` `-Inf`, `NaN`, ...) and
subnormal data lose digits; the fixture's refKind `scaled` gives the unscaled results times the power of 2.
`(g1 + g2)/2` also overflows above about 2^1023 (compute `g1/2 + g2/2` or scale first).

### 1.1 Exact interval of a limit of agreement (not in BlandAltmanLeh)

`d̄ + z s` estimates `μ + zσ`, and `√n (μ + zσ − d̄)/s` has the noncentral t distribution with n − 1 degrees of
freedom and noncentrality `z√n`. Hence the exact `c` interval of the upper limit is `[d̄ + s q_lo/√n, d̄ + s
q_hi/√n]` with `q_lo = qt((1 − c)/2, n − 1, ncp = z√n)`, `q_hi = qt((1 + c)/2, n − 1, ncp = z√n)`, and that of
the lower limit is `[d̄ − s q_hi/√n, d̄ − s q_lo/√n]` (Carkeet 2015; the same as a two-sided tolerance-factor
construction). Every non-error case of the fixture has these four numbers under `exact` (computed with R's
`qt(..., ncp)`, which is accurate to about 1e-12 in this range). Bland and Altman (1999) give the intermediate
approximation `SE = s sqrt(1/n + z²/(2(n − 1)))` with t quantiles.

### 1.2 Variants (no reference implementation in the image)

- **Regression-based limits** (Bland and Altman 1999, section 3.2): regress `d` on the means `m` (`d = b0 + b1 m`),
  then regress the absolute residuals on `m` (`|r| = c0 + c1 m`); the limits are `b0 + b1 m ± two × sqrt(π/2) (c0
  + c1 m)`. No interval for these limits in the paper.
- **Repeated measurements** (Bland and Altman 2007; Zou 2013 for intervals; also linear mixed models with the
  between- and within-subject variances): limits `d̄ ± z sqrt(σ²_between + σ²_within)` with the variances from a
  one-way ANOVA of the differences by subject (unequal numbers of replicates handled by the 2007 formulas); Zou's
  MOVER interval for the limits.
- R implementations: SimplyAgree (`agree_test`, `agree_reps`, `agree_nest`, `loa_lme`), MethComp, blandr — none
  installed in the image (SimplyAgree would be the natural reference: it has the exact and MOVER intervals and
  the replicate designs). Decision 3.

## 2. Method comparison regression: `mcr::mcreg`

`mcreg(x, y = NULL, error.ratio = 1, alpha = 0.05, mref.name = NULL, mtest.name = NULL, sample.names = NULL,
method.reg = c("PaBa", "LinReg", "WLinReg", "Deming", "WDeming", "PaBaLarge", "PBequi", "TS"), method.ci =
c("bootstrap", "jackknife", "analytical", "nestedbootstrap"), method.bootstrap.ci = c("quantile", "Student", "BCa",
"tBoot"), nsamples = 999, nnested = 25, rng.seed = NULL, rng.kind = "Mersenne-Twister", iter.max = 30, threshold =
1e-06, na.rm = FALSE, NBins = 1e+06, slope.measure = c("radian", "tangent"), methodlarge = TRUE)`.

The roadmap's "PaBaAlt" does not exist in this version (`method.reg = "PaBaAlt"` is the error `'arg' should be one
of “PaBa”, “LinReg”, “WLinReg”, “Deming”, “WDeming”, “PaBaLarge”, “PBequi”, “TS”`). The nearest are `PBequi`
(the equivariant Passing-Bablok of Bablok et al. 1988 / Dufey 2020, computed by robslopes' fast algorithm) and
`TS` (Theil-Sen); both are out of the proposed scope (decision 6) and are not described further.

The result is an S4 object; the numbers are in `@para`, a 2 × 4 matrix with rows `Intercept`, `Slope` and columns
`EST`, `SE`, `LCI`, `UCI` (`SE` is NA where the method has none). Also `@xmean`, `@weight`, `@B0jack`, `@B1jack`,
`@B0`, `@B1`, `@sigmaB0`, `@sigmaB1`, `@glob.sigma`, `@nsamples` depending on the method (fixture header).

### 2.1 Checks and data handling (in order)

`match.arg` for the four choice arguments (partial matching: `"Dem"`, `"ana"` work). Deming/WDeming:
`stopifnot(error.ratio >= 0)` etc. (messages are R's `stopifnot` texts, e.g. `error.ratio >= 0 is not TRUE`);
WDeming also `iter.max` a positive integer, `threshold >= 0`. Bootstrap: `nsamples > 0` (and nnested). `alpha > 0 &
alpha < 1 is not TRUE`. Data: `is.numeric(x) & is.numeric(y)`, `length(x) == length(y) is not TRUE`, `length(x) > 2
is not TRUE`, not all NA. With `na.rm = TRUE` incomplete pairs are dropped (and a note printed with `cat`); then
`!any(is.na(data)) is not TRUE` if any remain, and `(sd(data[, "x"]) > 0) & (sd(data[, "y"]) > 0) is not TRUE`
for constant x or y (this check underflows for tiny data: fixture scaled cases). Then:
- PaBa/PaBaLarge: error.ratio is set to 1; any value < 0 → `Passing-Bablok regression for negative values is not
  available.` (0 is allowed).
- WDeming: `min(data) <= 0` → `Weighted Deming regression for non-positive values is not available.`
- WDeming or PaBa with `method.ci = "bootstrap"` and `method.bootstrap.ci = "tBoot"`: `The analytical estimation of
  coefficients' SE for <PaBa|WDeming> is not available. \nFor tBoot please choose nested bootstrap.`
- `method.ci = "analytical"` with WDeming: `The analytical estimation of confidence intervals for WDeming is not
  available.`
- error.ratio = 0 reaches the Deming code and fails there: `error.ratio > 0 is not TRUE`; error.ratio = Inf:
  `NA/NaN/Inf in foreign function call (arg 4)`.
- `mref.name == mtest.name` only prints a note. Names and sample names do not affect the numbers.

### 2.2 Deming (`method.reg = "Deming"`)

With `x̄, ȳ` the means, `u = Σ(x − x̄)²`, `q = Σ(y − ȳ)²`, `p = Σ(x − x̄)(y − ȳ)`, `λ = error.ratio`:
- slope `b1 = (λq − u + sqrt((u − λq)² + 4λp²)) / (2λp)`, intercept `b0 = ȳ − b1 x̄`; `xmean = x̄`.
- analytical SE (Strike 1991): `r² = p²/(u q)`; `se(b1) = sqrt(b1² (1 − r²)/r² / (n − 2))`; `se(b0) = sqrt(se(b1)²
  Σx²/n)` (Σx² about 0, not centred). `1 − r²` is computed with the 1e-12 relative-zero rule of item 5 (so a
  nearly perfect fit gives SE exactly 0). λ enters only through b1.
- analytical interval: `b ± qt(1 − α/2, n − 2) se(b)`.
- p = 0 gives NaN for everything (0/0), no warning. Perfect linear data give SE 0 and a zero-width interval.

Accuracy (refKind `mpfr`, every analytical Deming case): the slope formula cancels when `λq − u < 0` and `λp²` is
small against `(u − λq)²`: error.ratio = 1e-300 gives slope 0 (true 0.96786), 1e-12 a relative error of 7e-4;
error.ratio = 1e300 gives Inf. Use `b1 = 2p / (sqrt((u − λq)² + 4λp²) − (λq − u))` when `λq − u < 0` (the same
root, without cancellation). `1 − r²` loses digits for r near 1 (the SE is off by up to 6e-12 in the fixture).
The sums over- and underflow (scale first).

### 2.3 Weighted Deming (`"WDeming"`, constant CV; Linnet 1990)

Start from the unweighted Deming estimates (b0, b1). Iteration i = 0, 1, ...: for each point `d = y − (b0 + b1 x)`,
`x̂ = x + λ b1 d/(1 + λ b1²)`, `ŷ = y − d/(1 + λ b1²)`, weight `w = 1/((x̂ + λŷ)/(1 + λ))²`; weighted means `x_w,
y_w`; `U, Q, P` the weighted sums of squares and cross-products about them; `B1` by the Deming formula with U, Q,
P; `B0 = y_w − B1 x_w`. If `|b1 − B1| < threshold` and `|b0 − B0| < threshold` (absolute), set `(b0, b1) = (B0,
B1)` and stop; otherwise set them and continue, at most `iter.max` iterations. The count reported is i + 1, and
the warning `no konvergence after <iter.max> iterations` (sic) is given when the count is ≥ iter.max — also when
the last allowed iteration converged. `xmean` = the last `x_w`, `weight` = the last weights. In jackknife and
bootstrap every refit iterates the same way and may warn (each distinct warning once in the fixture).

Accuracy (refKind `converged`): with the default threshold 1e-6 the coefficients are 1e-10 to 5e-9 (relative) from
the fixed point; with iter.max = 2, 2e-6. The reference iterates with threshold 0 and iter.max 1000. Decision 10.

### 2.4 Passing-Bablok (`"PaBa"`; Passing and Bablok 1983), mcr's algorithm

1. `posCor = cor(x, y, method = "kendall") >= 0` (Kendall's τ_b; τ = 0 counts as positive).
2. For every pair j < k (in index order), with differences by the 1e-12 rule: `dx ≠ 0` → angle `θ = atan(dy/dx)`;
   `dx = 0, dy ≠ 0` → `θ = +π/2` if posCor else `−π/2`; both 0 → the pair is dropped. `M` = number of angles.
3. Counts: with posCor, `E` = number of θ exactly `−π/4` (slope −1), `K` = number of θ < −π/4 (including −π/2);
   offset `O = 2K + E`. Without posCor, with `+π/4` and θ > π/4 instead, `O = −(2K + E)`. This is the textbook
   rule (slopes of −1 excluded, the median shifted by K), expressed on the full sorted list.
4. Slope: sort the angles. Let `m = M + O`. If m is odd, `θ*` = the angle at position `(m + 1)/2` (1-based) and `b1
   = tan(θ*)`. If m is even, with `θ_L, θ_R` the angles at positions m/2 and m/2 + 1: `b1 = tan((θ_L + θ_R)/2)`
   (radian) or `(tan θ_L + tan θ_R)/2` (tangent).
5. Interval of the slope: `C = round(qnorm(1 − α/2) sqrt(N(N − 1)(2N + 5)/18))` with N the number of points
   (C's `round`, halves away from zero). Lower: `m_L = M − C + O`, `j = floor((m_L + 1)/2)` (C integer division;
   for negative m_L it truncates toward 0). It is defined only if `j ≥ 2E + 1` (E as in step 3 for the side of
   posCor); then, if m_L is even, the radian mean (or tangent mean) of positions j and j + 1, else position j.
   Upper: `m_U = M + C + O`, `j = floor((m_U + 1)/2)`, defined only if `j ≤ M`; the same rule. (If m_U is even and
   j = M, mcr reads one element past the end of the sorted list — undefined behaviour in C; treat as undefined.)
   If either side is undefined, both slope limits are −Inf, Inf and so are both intercept limits (item 6).
6. Intercept: `b0 = median(y − b1 x)`, with each residual set to 0 by the 1e-12 rule when `|y − b1 x| < 1e-12 (|y| +
   |b1 x|)/2`. Interval: lower `median(y − b1_U x)`, upper `median(y − b1_L x)` (the same rule).
7. `SE` is NA, `xmean` NA, weights 1.

Arithmetic: the angles and `tan` are in double; `tan(atan(s))` differs from s by a few ulp. The fixture has no
reference for these; compare with a relative tolerance of about 1e-14 (JavaScript's Math.atan/Math.tan do not
promise glibc's bits either). Decision 9 asks whether to compute odd-position slopes as dy/dx directly.

Fixture boundary cases: n = 3, 4 (interval undefined → ±Inf), ties in x (vertical pairs), duplicated points
(dropped pairs), slopes of exactly 1 and −1, negative correlation, the 1e-12 rule, x containing 0.

### 2.5 Passing-Bablok for large data (`"PaBaLarge"`, binned; C function `PaBaLargeData`)

Instead of sorting the M angles, counts them in `NBins + 1` bins: an angle θ goes to bin `floor(0.5 + NBins (θ +
π/2)/π)`; a vertical pair goes to bin NBins (posCor) or bin 0. The counts E, K are as in 2.4. `IndexOf(m)` = the
smallest bin j whose cumulative count is ≥ m (0 if m ≤ 0). A bin j stands for the angle `j π/NBins − π/2`, and
`Tan` of an angle within the 1e-12 rule of ±π/2 is the sentinel ±1020304.050607 (converted to ±Inf by R for the
limits only). Slope: odd m → `Tan(angle(IndexOf((m + 1)/2)))`; even m → the radian (or tangent) mean of the angles
of `IndexOf(m/2)` and `IndexOf(m/2 + 1)`. Limits: as in 2.4 with IndexOf in place of positions; the lower limit
requires only `j ≥ 0` (not 2E + 1), so it is never undefined but becomes −Inf (bin 0) for small n; the upper
requires `j ≤ M`. The intercept and its limits are computed in R: `median(calcDiff(y, b·x))` with the same 1e-12
rule; a slope limit of ∓Inf gives an intercept limit of ∓Inf. `NBins > 1e8` is an error (`The maximum number of
bins is '1e+08' and may not be exceeded!`). The result is an approximation of 2.4 to about π/NBins in angle
(1e-6 relative for the default).

### 2.6 Interval methods

- **analytical**: Deming 2.2; PaBa/PaBaLarge their rank intervals (2.4, 2.5).
- **jackknife** (Linnet 1993): the global estimate θ̂ and the n leave-one-out estimates θ̂_(i) (same method, same
  options); pseudo-values `n θ̂ − (n − 1) θ̂_(i)`; `se = sd(pseudo)/√n`; interval `θ̂ ± qt(1 − α/2, n − 2) se`;
  EST = θ̂ (not the jackknife mean). Prints a note with `cat`.
- **bootstrap**: with `rng.seed`, mcr calls `set.seed(rng.seed, kind = "Mersenne-Twister")` first (and restores
  the previous `.Random.seed` afterwards if there was one), so the resamples follow R's stream from that seed
  (sample.kind "Rejection", the default). Order of the random draws: for b = 1..nsamples, `index = sample(1:n, n,
  replace = TRUE)` (n draws of R's `R_unif_index(n)`), the fit on `x[index], y[index]`; for "nestedbootstrap",
  right after that and before resample b + 1, nnested inner resamples `index[sample(1:n, n, replace = TRUE)]`. The
  jackknife for BCa uses no random numbers. Per resample: PaBa recomputes posCor from Kendall's τ of the resample;
  if `sd(x[index])` or `sd(y[index])` is 0, PaBa gives NA coefficients with the warning `Resampling PaBa
  regression: x or y coordinates of all data points in subsample identical - regression coefficients
  undetermined!`; for Deming and WDeming the warning (`Resampling Deming regression: all x coordinates in
  subsample identical - regression coefficients undetermined!`) is given but the NA result is discarded (a bug)
  and the fit runs on. Resamples with NA coefficients are dropped; more than 5% → `There were too many resamples
  with undetermined regression coefficients!`; for BCa an NA leave-one-out estimate → `Too many identical data
  points!`. `nsamples` in the result = resamples kept. `sigmaB0/1` per resample: nested → sd of the nnested inner
  estimates (na.rm); otherwise the analytical SE of the resample for Deming, the global jackknife SE for WDeming
  (only when a jackknife was run, i.e. BCa; else NA), NA for PaBa. `MX` (mean of x per resample) is used only by
  plots and response intervals.
  - `quantile`: EST = global estimate; interval `quantile(B, c(α/2, 1 − α/2))`; SE NA.
  - `Student`: `se = sd(B)`; `θ̂ ± qt(1 − α/2, n − 2) se`.
  - `BCa`: `p = #(B < θ̂)` (0 → 0.5, B → B − 0.5, all B equal to θ̂ → B/2), `z0 = qnorm(p/B)`; acceleration `a =
    Σ(θ̄ − θ_(i))³ / (6 (Σ(θ̄ − θ_(i))²)^1.5)` over the jackknife estimates (0 if the sum of squares is 0); with `zL =
    qnorm(α/2)`, `zU = qnorm(1 − α/2)`: `IU = pnorm(z0 − (zL − z0)/(1 + a(zL − z0)))`, `IL = pnorm(z0 − (zU −
    z0)/(1 + a(zU − z0)))` (the textbook BCa levels written differently), interval `quantile(B, c(IL, IU))`; SE NA.
  - `tBoot`: `t*_b = (B_b − θ̂)/sigmaB_b`; `ŝ` = the global analytical SE (Deming), or `sd(B)` if NA; interval
    `[θ̂ − quantile(t*, 1 − α/2) ŝ, θ̂ − quantile(t*, α/2) ŝ]`; SE = ŝ.
- Cost: 999 PaBa resamples of 108 points take 0.7 s in R.

### 2.7 Linearity: `calcCUSUM` (Passing and Bablok 1983)

From a fitted object: residuals `r_i = y_i − b0 − b1 x_i` (no tolerance); `l = #(r > 0)`, `L = #(r < 0)`; scores
`+sqrt(L/l)` for r > 0, `−sqrt(l/L)` for r < 0, 0 for r = 0; `D_i = (y_i + x_i/b1 − b0)/sqrt(1 + 1/b1²)`; the
scores ordered by D (stable: ties keep the data order) are cumulated; result `nPos = l`, `nNeg = L`, `cusum`, and
`max.cusum = max |cusum|`. mcr gives no test decision or p-value. Passing and Bablok compare the maximum with the
Kolmogorov-Smirnov critical value `h_γ sqrt(·)` (h = 1.36 at 5%); the count under the root should be checked
against the paper before it is implemented (decision 12). The fixture has `cusum` for every analytical PaBa and
PaBaLarge case.

## 3. Intraclass correlations: `psych::ICC`

`ICC(x, missing = TRUE, alpha = 0.05, lmer = TRUE, check.keys = FALSE)`; x is n subjects (rows) × k raters
(columns).

### 3.1 Mean squares

ANOVA path (`lmer = FALSE`): `aov(values ~ subs + ind)` on the stacked data (subjects first): `MSB` (subjects),
`MSJ` (raters), `MSE` (residual) from the sequential table, `MSW = (SSJ + SSE)/(dfJ + dfE)`; df `n − 1`, `k − 1`,
`(n − 1)(k − 1)`. With complete data these are the balanced two-way formulas (grand mean, row and column means:
`SSB = kΣ(row mean − ḡ)²`, `SSJ = nΣ(column mean − ḡ)²`, `SSE = SST − SSB − SSJ`). A missing value with `missing =
TRUE` is the error `missing data were found for <m> cases \n Try again with na.omit  or set missing= FALSE and
proceed at your own risk, or try the lmer=TRUE option` (preceded by R printing `Error in na.fail.default(x) :
missing values in object` from a `try`); with `missing = FALSE` aov drops the missing cells and the sequential
(unbalanced) sums of squares are used with the balanced degrees of freedom of the formulas below — not a
meaningful analysis.

lmer path (default): `lmer(values ~ 1 + (1 | id) + (1 | items), na.action = na.omit)` (REML), variance
components `σ²_s` (id), `σ²_r` (items), `σ²_e`; then `MSB = k σ²_s + σ²_e`, `MSJ = n σ²_r + σ²_e`, `MSE = σ²_e`,
`MSW = σ²_e + σ²_r`, and the same df as above **with n = number of rows of x including rows with missing values**.
`stats` (the table) then has SumSq = MS × df, F for subjects and raters and p from `-expm1(pf(F, df1, df2, log.p =
TRUE))`; `lme` = the three variances, their total and the percentages. With complete data and `MSB ≥ MSE`, `MSJ ≥
MSE`, REML equals the ANOVA estimates exactly, so the results equal the ANOVA path's; lme4's optimiser makes them
1e-5 to 1e-4 off (item 7). Where `MSB < MSE` or `MSJ < MSE`, REML puts that component (or both) at 0: the
maximum is then the REML estimate of the balanced one-way model without that component, a closed form (fixture
refKind `reml`), e.g. with σ²_r = 0: `σ²_e = (SSJ + SSE)/(n(k − 1))`, `σ²_s = (MSB − σ²_e)/k`. lme4 says `boundary
(singular) fit: see help('isSingular')` (a message). With missing ratings REML has no closed form; R's values are
then only as accurate as lme4's optimiser (compare with a tolerance of about 1e-4) and the fixture has no reference.

### 3.2 The six forms (Shrout and Fleiss 1979)

| type | row name | ICC | F, df1, df2 | bounds (with FL, FU) |
|---|---|---|---|---|
| ICC1 | Single_raters_absolute | `(MSB − MSW)/(MSB + (k − 1)MSW)` | `MSB/MSW`, n − 1, n(k − 1) | `(FL − 1)/(FL + k − 1)`, `(FU − 1)/(FU + k − 1)` with `FL = F/qf(1 − α/2, n − 1, n(k − 1))`, `FU = F qf(1 − α/2, n(k − 1), n − 1)` |
| ICC2 | Single_random_raters | `(MSB − MSE)/(MSB + (k − 1)MSE + k(MSJ − MSE)/n)` | `MSB/MSE`, n − 1, (n − 1)(k − 1) | see below |
| ICC3 | Single_fixed_raters | `(MSB − MSE)/(MSB + (k − 1)MSE)` | as ICC2 | as ICC1 with MSE's F and df |
| ICC1k | Average_raters_absolute | `(MSB − MSW)/MSB` | as ICC1 | `1 − 1/FL`, `1 − 1/FU` (ICC1's FL, FU) |
| ICC2k | Average_random_raters | `(MSB − MSE)/(MSB + (MSJ − MSE)/n)` | as ICC2 | `L k/(1 + L(k − 1))`, `U k/(1 + U(k − 1))` with ICC2's L, U |
| ICC3k | Average_fixed_raters | `(MSB − MSE)/MSB` | as ICC2 | `1 − 1/FL`, `1 − 1/FU` (ICC3's) |

p-values `-expm1(pf(F, df1, df2, log.p = TRUE))` (the upper tail, accurate). ICC2's bounds: with `Fj = MSJ/MSE`,
`v = (k − 1)(n − 1)(k ICC2 Fj + n(1 + (k − 1)ICC2) − k ICC2)² / ((n − 1)k² ICC2² Fj² + (n(1 + (k − 1)ICC2) − k
ICC2)²)`, `G1 = qf(1 − α/2, n − 1, v)`, `G2 = qf(1 − α/2, v, n − 1)`: lower `n(MSB − G1 MSE)/(G1(k MSJ + (kn − k
− n)MSE) + n MSB)`, upper `n(G2 MSB − MSE)/(k MSJ + (kn − k − n)MSE + n G2 MSB)`. (psych calls these F3U and F3L;
the names are swapped but the formulas are the standard ones.) The confidence level is `1 − alpha` (default 95%).

Other fields: `stats`, `MSW`, `lme` (lmer only), `n.obs`, `n.judge`, `summary` (the aov or lmer object). With
`check.keys = TRUE` psych reverses items with negative loadings on the first principal component — out of scope.

Boundaries (fixture): `MSB < MSE` gives negative coefficients on the ANOVA path (ICC1k = −1000 for the `neg` data)
and ICC = 0, F = 1 on the lmer path; all ratings equal → aov's `essentially perfect fit for ‘1’:
summary may be unreliable` warning and rounding noise (ICC ≈ −8e-16, F = 1); perfectly consistent ratings (MSE =
0) → the same warning and F ≈ 4e31 (true: Inf, p 0, coefficients and bounds 1); k = 1 or n = 1 → `contrasts can
be applied only to factors with 2 or more levels`; data times 2^−540 or 2^520 → NaN everywhere (aov) — the
refKind `anova` reference gives the exact values. Data with a large common offset (sf + 1e6) lose 3e-10 on the
ANOVA path.

### 3.3 Relation to rStats.js `icc` (irr::icc)

psych ICC1 = irr oneway (single); ICC2 = twoway agreement single; ICC3 = twoway consistency single; ICC1k, ICC3k
= the corresponding `average`. All values and bounds agree with irr to about 1e-15 (`r0 = 0`), **except the
bounds of ICC2k**: irr uses McGraw and Wong's formula with `a = k c/(n(1 − c))`, `b = 1 + k c(n − 1)/(n(1 − c))`
for the average (see oracle/agreement-behaviour.md), psych the Spearman-Brown transform of ICC2's bounds (example:
6 × 4 Shrout-Fleiss data, irr [0.0394, 0.9286], psych [0.0711, 0.9272]). irr has `r0` (the null value) and
returns one form per call; psych returns all six, uses REML by default and handles missing ratings (lmer path).

## 4. Equivalence tests for means: `TOSTER::t_TOST`

`t_TOST(x, y = NULL, hypothesis = c("EQU", "MET"), paired = FALSE, var.equal = FALSE, eqb, low_eqbound,
high_eqbound, eqbound_type = c("raw", "SMD"), alpha = 0.05, mu = 0, bias_correction = TRUE, rm_correction =
FALSE, glass = NULL, smd_ci = c("nct", "goulet", "t", "z"))` (default method; the formula method splits a
two-level factor).

### 4.1 Checks, in order

`match.arg` for hypothesis (`'arg' should be one of “EQU”, “MET”`; "M" matches MET), eqbound_type, smd_ci. Bounds:
neither `eqb` nor both of low/high → `Equivalence bounds missing and must be enterered` (sic). `alpha` not in (0,
1) → `The alpha must be a numeric value between 0 and 1`. Then `t.test(x, y, paired, var.equal, mu, conf.level = 1
− 2α)` — so t.test's own errors come next: α > 0.5 → `'conf.level' must be a single number between 0 and 1`
(α = 0.5 is accepted: conf.level 0), `not enough 'x' observations`, `data are essentially constant`, `not all
arguments have the same length` (paired with unequal lengths). `eqb` not numeric or longer than 2 → `eqb must be
a numeric of a length of 1 or 2` (after the t-test). Messages (not warnings): `Equivalence interval does not
include zero.` when 0 is not in `[low, high]` (a bound equal to 0 counts as including it), `Warning:
setting bound type to SMD produces biased results!`, and for MET with an interval containing 0 and p_TOST ≤ the
t-test's p `MET test may have higher error rates than a nil two-tailed test. Consider wider equivalence bounds.`
Missing values: x and y separately for two samples (`na.omit`), complete pairs for paired (t.test does the same).

### 4.2 Tests

Bounds: `eqb` of length 1 → `(−|eqb|, |eqb|)`; length 2 → `(min, max)`; else `low_eqbound`, `high_eqbound`
as given. With `eqbound_type = "SMD"` the bounds are in SMD units and are multiplied by the SMD's denominator
(`d_denom`, 4.3) to give raw bounds; otherwise the SMD bounds are the raw ones divided by `d_denom`.

Three t tests with the same `paired`/`var.equal`: the two-sided test of `mu` (`t-test` row; its 1 − 2α interval
is the Raw row's interval), the test of `low_eqbound` with alternative "greater" (EQU) or "less" (MET) (`TOST
Lower`), the test of `high_eqbound` with alternative "less" (EQU) or "greater" (MET) (`TOST Upper`). Note: the two
bound tests do not subtract `mu` (the bounds are for the mean difference itself). Each row: `t`, `SE` (t.test's
`stderr`), `df`, `p.value`. EQU: `p_TOST = max` of the two bound p-values and the reported t is the one with the
smaller |t|; MET: `min` and larger |t|. Decision text: `significant` when `p < alpha`.

Effect sizes (`effsize`): row `Raw`: estimate = t × stderr of the two-sided test (= the mean difference minus mu),
SE = stderr, interval = that test's 1 − 2α `conf.int`, conf.level = 1 − 2α. **For one sample with mu ≠ 0 the
interval is that of the mean, not of mean − mu** (fixture: estimate 0.0125, interval [5.22, 5.80]); a TOSTER
bug. Row 2: the SMD (4.3).

`method` is t.test's (`"Welch Two Sample t-test"`, `" Two Sample t-test"` with R's leading space, `"Paired
t-test"`, `"One Sample t-test"`); `hypothesis` is `"Hypothesis Tested: Equivalence"` or `"Hypothesis Tested:
Minimal Effect"`.

### 4.3 Standardised mean difference (TOSTER's `d_est_ind`, `d_est_pair`, `d_est_one`)

`J(df) = exp(lgamma(df/2) − log(sqrt(df/2)) − lgamma((df − 1)/2))` when `bias_correction` (g), else 1 (d). Below,
`Δ = m1 − m2` (two samples: m2 = mean(y) − mu; paired: means of x and y, **mu ignored**; one sample: mean − mu);
the SMD is computed from |Δ| and its sign (and the interval's, mirrored) is restored at the end.

Two samples, `var.equal = TRUE`: `denom = sp` (pooled SD), `df = n1 + n2 − 2`, `hn = 1/n1 + 1/n2`, label
"Hedges's g" / "Cohen's d". `var.equal = FALSE`: `denom = sqrt((s1² + s2²)/2)`, `df = (n1 − 1)(n2 − 1)(s1² +
s2²)² / ((n2 − 1)s1⁴ + (n1 − 1)s2⁴)`, `hn = 2(n2 s1² + n1 s2²)/(n1 n2 (s1² + s2²))`, label "Hedges's g(av)" /
"Cohen's d(av)". `glass = "glass1"`/`"glass2"`: denom = s1 (df n1 − 1) / s2 (df n2 − 1), `hn = 1/n2 + 1/n1`
(sic: `1/n2 + s²/(n1 s²)` in both), label "Glass's delta(g)" / "(d)". Estimate `g = J |Δ|/denom`.
- `smd_ci = "nct"` (default): `t = |Δ|/SE1` with `SE1 = sp sqrt(1/n1 + 1/n2)` (pooled) or `sqrt(s1²/n1 +
  s2²/n2)` (Welch); for Glass `SE1 = denom sqrt(1/n_g + s_other²/(n_other denom²))` and **df reset to n1 + n2 −
  2**. Noncentrality limits `L, U`: `P(T(df, L) > t) = α`, `P(T(df, U) < t) = α` (the 1 − 2α interval; TOSTER
  minimises squared differences of `qt(·, ncp)` with optimize and nlm, about 1e-9 accurate: refKind `nct` gives
  the roots). Limits `L sqrt(hn) J`, `U sqrt(hn) J`. SE: pooled `sqrt(1/n1 + 1/n2 + (1 − (df − 2)/(df J²)) g²)`;
  Welch (Bonett) `sqrt(g²(s1⁴/(n1 − 1) + s2⁴/(n2 − 1))/(8 denom⁴) + (s1²/(n1 − 1) + s2²/(n2 − 1))/denom²)`; Glass
  `sqrt((s_other²/denom²)/(n_other − 1) + 1/(n_g − 1) + g²/(2(n_g − 1)))`. `d_lambda` reports hn.
- `"goulet"`: `λ = g sqrt(ñ/2)` with ñ the harmonic mean of n1, n2 (pooled: `g sqrt(n1 n2 (s1² + s2²)/(2(n2 s1² +
  n1 s2²)))`); `tlow = qt(α, df, ncp = λ)`, `thigh = qt(1 − α, df, ncp = λ)`; limits `tlow g/λ`, `thigh g/λ`
  (if Δ = 0: `t (n1 + n2)/(sqrt(df) sqrt(n1 n2))`); SE `sqrt(df/(df − 2) (2/ñ)(1 + g² ñ/2) − g²/J²)`.
- `"t"` / `"z"`: `g ∓ qt(1 − α, df) SE` / `g ∓ qnorm(1 − α) SE` with the SE of the nct case.

Paired (`d_est_pair`): `sdif = sqrt(s1² + s2² − 2 r s1 s2)` (r = cor(x, y); computed this way, not as sd(x − y),
which cancels for r near 1), denom: `sdif` (label "g(z)"/"d(z)"), with `rm_correction` `sdif/sqrt(2(1 − r))`
("g(rm)"), Glass s1 or s2. df = n − 1 for nct/t/z, `2n − 2` for goulet. g = J |Δ|/denom. SE: the goulet formula
`sqrt(df/(df − 2) (2(1 − r)/n)(1 + g² n/(2(1 − r))) − g²/J²)`, times `sqrt(2(1 − r))` for "z"; replaced for nct
(not rm) by `sqrt(1/n + (1 − (df − 2)/(df J²)) g²)`; Glass `sqrt(sdif²/(denom² (n − 1)) + g²/(2(n − 1)))`. nct: `t =
|Δ|/(denom/√n)` (rm: `|Δ|/(sdif/√n) sqrt(2(1 − r))`), limits `L sqrt(1/n) J`, `U sqrt(1/n) J`. goulet: `λ = g
sqrt(n/(2(1 − r)))`, as above (Δ = 0: `t·2n/(sqrt(df) sqrt(2n))`).

One sample (`d_est_one`): denom = s, df = n − 1, g = J |Δ|/s; nct: t = |Δ|/(s/√n), limits `L/√n J`, `U/√n J`; SE
`sqrt(1/n + g²/(2n))` (non-goulet), goulet `sqrt(df/(df − 2)(1/n)(1 + g² n) − g²/J²)`. **For "t" and "z" the
one-sample limits use `qt(1 − α/2)` / `qnorm(1 − α/2)`** (a 1 − α interval), unlike the other designs (1 − 2α) —
an inconsistency in TOSTER (fixture cases record it).

### 4.4 Other TOSTER functions for means (not in the fixtures)

- `tsum_TOST(m1, sd1, n1, m2, sd2, n2, r12, ...)`: the same from summary statistics (paired needs r12), through
  TOSTER's own `tsum_test`, whose one-sided p-values are `1 − pt(t, df)` (small upper-tail p-values are lost; use
  the upper tail) and which, for paired data with n1 ≠ n2, warns `Unequal number of pairs; using smallest n`.
- `log_TOST(x, y, paired, var.equal, eqb = 1.25, null = 1)`: the t-TOST of log(x) − log(y) (ratio of geometric
  means), bounds `(1/eqb, eqb)`; negative values are an error; no one-sample version.
- `wilcox_TOST`: TOST with two Wilcoxon tests (location shift), with rank-biserial effect sizes; `boot_t_TOST`:
  bootstrap TOST (random); `power_t_TOST`: power and sample size.

### 4.5 Relation to rStats.js `tost` (equivalence::tost)

`tost(x, y, { epsilon, paired, varEqual, confLevel/alpha })` = two samples or paired, symmetric margin, EQU only;
its p-value `pt((ε − |d|)/se, df, lower.tail = FALSE)` equals t_TOST's p_TOST for `eqb = ε`, and its interval is
the Raw row's (t_TOST's `alpha` = tost's `1 − confLevel`). New in t_TOST: one sample; asymmetric bounds; `mu`; MET
(minimal-effect) tests; the three test rows (t, SE, df, p); bounds in SMD units; the SMD with its interval. tost
has `result` ("rejected"/"not rejected") where TOSTER has decision sentences.

## 5. Accuracy notes (where the packages are wrong or inaccurate)

| function | problem | fixture |
|---|---|---|
| bland.altman.stats | sd() over/underflows (2^±500 and beyond) | `reference` (`scaled`) |
| bland.altman.stats | the 3 s²/n approximation for the limits' SE (by design) | `exact` (decision 2) |
| mcreg Deming | slope formula cancels for small error.ratio (1e-300 → slope 0); 1 − r² cancels; sums over/underflow; `sd > 0` check underflows | `reference` (`mpfr`, `scaled`) |
| mcreg WDeming | iteration stopped at an absolute 1e-6 (1e-10 to 2e-6 from the fixed point) | `reference` (`converged`) |
| mcreg PaBa | tan(atan(s)) ≠ s (few ulp); 1e-12 rule overflows near the largest doubles (`(|x| + |y|)/2` = Inf zeroes every difference: intercept wrong at 2^1020) | tolerance; `scaled` |
| mcreg PaBa | reads past the sorted angles when the upper index is even and equal to M (C undefined behaviour) | none (rare) |
| psych ICC (lmer) | lme4 optimiser: 1e-5 to 1e-4 relative error | `reference` (`anova`, `reml`) |
| psych ICC (aov) | NaN for data scaled by 2^±520; 3e-10 with an offset of 1e6; MSE = 0 gives F ≈ 1e31 | `reference` (`anova`) |
| t_TOST | nct limits from an optimiser (to 7e-9) | `reference` (`nct`) |
| t_TOST | one-sample Raw interval ignores mu; one-sample t/z SMD limits at 1 − α | none (decision 20) |

References were computed with gmp (exact rational ANOVA sums of squares), Rmpfr (256 bits: Deming), R's own
functions at tight tolerances (uniroot to 1e-15 for the noncentral t; mcr itself with threshold 0 for WDeming),
and closed-form REML on the boundary.

## 6. Sources implementers may port from (permissive or papers)

- Bland JM, Altman DG (1986) Lancet i:307–310 (limits, the `3s²/n` approximation); (1999) Stat Methods Med Res
  8:135–160 (SE `s²(1/n + z²/(2(n − 1)))`, regression-based limits, replicates); (2007) J Biopharm Stat 17:571–582
  (repeated measurements). Carkeet A (2015) Optom Vis Sci 92:e71–e80 (exact limits by the noncentral t). Zou GY
  (2013) Stat Methods Med Res 22:630–642 (MOVER intervals with replicates).
- Linnet K (1990) Stat Med 9:1463–1473 (Deming and weighted Deming, λ as in mcr); Linnet K (1993) Clin Chem
  39:424–432 (jackknife intervals); Strike PW (1991) Statistical Methods in Laboratory Medicine (the analytical SE).
  Cornbleet PJ, Gochman N (1979) Clin Chem 25:432–438 (Deming).
- Passing H, Bablok W (1983) J Clin Chem Clin Biochem 21:709–720 (slope, K shift, rank interval with C, CUSUM test);
  Bablok W et al. (1988) J Clin Chem Clin Biochem 26:783–790 (general case/equivariant); Dufey F (2020) Int J
  Biostat (equivariant PB, as in PBequi).
- Efron B, Tibshirani R (1993) An Introduction to the Bootstrap (BCa: z0 and the jackknife acceleration).
- Shrout PE, Fleiss JL (1979) Psychol Bull 86:420–428 (the six forms and their intervals, incl. ICC2's v);
  McGraw KO, Wong SP (1996) Psychol Methods 1:30–46 (irr's forms, r0, the average-agreement interval).
- Schuirmann DJ (1987) J Pharmacokin Biopharm 15:657–680 (TOST); Lakens D (2017) Soc Psychol Personal Sci
  8:355–362; Steiger JH, Fouladi RT (1997) (noncentrality intervals); Hedges LV (1981) J Educ Stat 6:107–128 (J);
  Bonett DG (2008) Psychol Methods 13:99–109 (SE of d_av); Goulet-Pelletier JC, Cousineau D (2018) Quant Methods
  Psychol 14:242–265 (the "goulet" interval).
- Code under BSD-3: statsmodels `ttost_ind`, `ttost_paired`, `TOSTOneSample`-style functions (Welch/pooled TOST
  p-values, equal to TOSTER's for symmetric bounds); SciPy `theilslopes` (Theil-Sen, not PB). The existing
  rStats.js `cohensD`/`hedgesG` (`src/htest/effectSize.ts`) already compute exact noncentral-t limits and J. Not
  permissive (do not port): pingouin (GPL-3), the R `deming` package (LGPL), mcr, psych, TOSTER, BlandAltmanLeh
  (GPL).

## Decisions for the user

1. **Bland-Altman API.** Proposal `blandAltman(x, y, { two, mode, confLevel, ciMethod })` returning `{ means,
   diffs, n, meanDiff, lowerLimit, upperLimit, criticalDiff, meanDiffConfInt, lowerLimitConfInt,
   upperLimitConfInt, confLevel, two, warnings }` (camelCase of BlandAltmanLeh's fields, `basedOn` → `n`).
   Alternatively mirror the package's names (`lines`, `CI.lines`). Recommendation: the first; `mode` kept (or a
   boolean `reverse`). Missing pairs dropped as the package (with its warning text when fewer than 2 remain?
   Recommendation: fewer than 2 pairs is an Error, design rule 1).
2. **The interval of the limits.** (a) BlandAltmanLeh's `3s²/n` only; (b) also `ciMethod: "exact"` (Carkeet,
   noncentral t; fixture field `exact`) and perhaps `"approx"` (Bland-Altman 1999); (c) exact as default.
   Recommendation (b), default as the package.
3. **Regression-based and repeated-measures limits**: no reference implementation in the image. (a) Leave out;
   (b) add SimplyAgree to the image and specify them later. Recommendation (a) now, (b) when wanted.
4. **One-sided Bland-Altman limits**: the package has none. Recommendation: none.
5. **mcreg API.** (a) one function `mcreg(x, y, { methodReg, methodCi, methodBootstrapCi, errorRatio, alpha,
   slopeMeasure, nsamples, nnested, rngSeed, iterMax, threshold, naRm, nBins })` returning `{ intercept: {
   estimate, se, confInt }, slope: {...}, xmean, weights?, jackknife?: { intercept[], slope[] }, bootstrap?: {
   intercept[], slope[], ... }, warnings }`; (b) separate `demingRegression` and `passingBablok` functions; (c)
   both. Recommendation (a), with `alpha` (mcr's) rather than confLevel, or confLevel = 1 − alpha for consistency
   with the rest of rStats.js (your choice).
6. **Scope of regression methods**: Deming, WDeming, PaBa (exact; limit n by the 2^24 values rule: n(n − 1)/2 ≤
   2^24, n ≤ 5793), PaBaLarge (cheap, deterministic, but an approximation that exists for speed). LinReg/WLinReg
   (ordinary and 1/x² weighted least squares), PBequi, TS: out (PBequi needs robslopes' algorithm).
   Recommendation: Deming, WDeming, PaBa; PaBaLarge only if users compare with mcr's large-data output.
7. **Interval methods and the default**: analytical, jackknife, bootstrap (quantile, Student, BCa, tBoot) and
   nested bootstrap. mcr's default (bootstrap quantile, 999, random) or analytical as rStats.js's default.
   Recommendation: all methods; default `methodCi: "analytical"` for Deming and PaBa (deterministic), documented as
   a difference from mcr's default; WDeming then needs an explicit methodCi (or default jackknife for WDeming).
8. **Bootstrap reproducibility**: follow R's stream (`sample(1:n, n, TRUE)` per resample, nested draws
   interleaved; `rngSeed` = R's `set.seed(seed, kind = "Mersenne-Twister")`) — the fixture has the resampled
   coefficients `B0`, `B1` to check the stream. Recommendation: yes (design rule 5); `rngSeed` as an option and the
   global stream otherwise. Note: the fixtures were made on arm64 R (sample() uses only unif_rand, so x86_64 should
   give the same; regenerate on the amd64 image once it has mcr if you want certainty).
9. **PaBa arithmetic**: reproduce `tan(atan(dy/dx))` for odd positions (R's bits where libm agrees) or return dy/dx
   (exact; differs from R by a few ulp, e.g. 1 instead of 0.99999999999999989). Recommendation: dy/dx for odd
   positions, `tan((θL + θR)/2)` for the radian mean; tests with relative tolerance 1e-14; note in
   differences-from-r. Keep the 1e-12 tie rule (it is part of the method as mcr defines it), but apply it to scaled
   data so that it does not overflow.
10. **WDeming convergence**: (a) reproduce mcr's stopping rule (absolute threshold, iterMax, the warning text);
    (b) iterate to the fixed point (reference `converged`). Recommendation (a) with mcr's defaults (they are
    arguments the user sees), tests against R with tolerance ~1e-12 and against `reference` loosely; or (b) if you
    prefer rule 2 (then threshold/iterMax only as safety limits).
11. **Undefined PaBa interval** (small n): ±Inf for all four limits as mcr (a), or NaN with a warning, or an Error.
    Recommendation (a) plus a warning saying the interval is undefined (mcr gives none).
12. **Linearity (CUSUM) test**: (a) as mcr (statistic only); (b) also the Kolmogorov-Smirnov decision/p-value of
    Passing and Bablok (needs the exact form from the 1983 paper). Recommendation (a) now, as a field `cusum: {
    nPos, nNeg, maxCusum }` of PaBa results.
13. **mcr's input restrictions**: PaBa refuses negative values, WDeming non-positive values (the latter is needed
    by the weights; the former is mcr's choice). Recommendation: keep both errors (comparability), with rStats.js's
    own messages; and `length(x) > 2`, constant x or y → Error.
14. **psych ICC: new function or an extension of `icc`.** (a) new `ICC(x, { alpha | confLevel, lmer })` returning
    the six rows `{ type, ICC, F, df1, df2, pValue, lower, upper }` plus `{ MSB, MSJ, MSE, MSW, n, k }`; (b) an option
    of `icc` (`all: true`); (c) a differently named function (`iccShroutFleiss`). R's name `ICC` next to `icc`
    differs only in case (allowed in JavaScript, but confusing; file names are not affected). Recommendation (a)
    with name `ICC` as psych, or (c) if you dislike the case pair.
15. **ICC estimation path**: psych's default lmer = TRUE means REML (negative components truncated at 0); lmer =
    FALSE means ANOVA (negative coefficients possible). Recommendation: complete data only; option `lmer` with
    psych's default true; compute both exactly (ANOVA formulas; on the boundary the closed-form REML of the reduced
    one-way model — fixture refKind `reml`), so results differ from R's by its optimiser error (record in
    differences-from-r). Missing ratings: Error for now (REML with missing cells would need the `mixed` area's lmer,
    which stays out of the root export).
16. **ICC2k interval**: reproduce psych in the new function (yes, recommended) and keep irr's in `icc`; document the
    difference.
17. **ICC degenerate data**: all ratings equal → Error; MSE = 0 (perfect consistency) → F = Inf, p = 0, coefficients
    1, bounds 1 (where defined)? Recommendation as stated; n < 2 or k < 2 → Error.
18. **t_TOST: new function or extension of `tost`.** (a) new `tTOST(x, y?, { eqb, lowEqbound, highEqbound,
    hypothesis, paired, varEqual, alpha, mu, eqboundType, biasCorrection, rmCorrection, glass, smdCi })` returning
    `{ tTest: {t, se, df, pValue}, lower: {...}, upper: {...}, pValue (p_TOST), bounds: { raw, smd }, raw: {
    estimate, se, confInt }, smd: { label, estimate, se, confInt, df, J }, confLevel, method, hypothesis, warnings
    }`, `tost` unchanged; (b) extend `tost` with these options. Recommendation (a): tost stays the equivalence-package
    clone.
19. **SMD scope**: nct (exact roots, as cohensD), t, z, goulet; Glass; rm; bias correction. Recommendation: all (each
    is a few lines given cohensD's machinery); nct limits as true roots (rule 2, reference `nct`).
20. **TOSTER's inconsistencies**: one-sample Raw interval with mu ≠ 0 (interval of the mean), one-sample t/z SMD
    limits at 1 − α, paired SMD ignoring mu. Recommendation: fix the first two (interval of mean − mu; 1 − 2α) as
    documented differences; keep the third (the SMD of the raw difference) and document it.
21. **TOSTER's messages**: rStats.js has warnings only. Recommendation: the SMD-bounds note and the MET note as
    warnings (they warn about the result); "Equivalence interval does not include zero." as a warning too, or
    dropped. Decision sentences: not reproduced.
22. **Other TOSTER functions**: `tsum_TOST` (summary statistics) — recommended (cheap); `log_TOST` — optional;
    `wilcox_TOST`, `boot_t_TOST`, power functions — later (power belongs to ROADMAP item 4).
23. **alpha range of tTOST**: TOSTER accepts α = 0.5 (a zero-width interval) and fails for α > 0.5 with t.test's
    message. Recommendation: α in (0, 0.5) as `tost`, RangeError otherwise.

## rStats.js's choices
Decided by the user on 2026-11-09. Binding; they override the recommendations above where they differ.

- Decisions 1–4: `blandAltman(x, y, { two, mode, confLevel, ciMethod })` with the camelCase fields of decision 1;
  fewer than 2 pairs is an Error; `ciMethod` "package" (default, BlandAltmanLeh's 3s²/n) and "exact" (Carkeet);
  regression-based and repeated-measures limits left out for now; no one-sided limits.
- Decisions 5–13: one function `mcreg(x, y, options)` as decision 5 (option names camelCase; `confLevel` = 1 − alpha
  for consistency with rStats.js); methods Deming, WDeming, PaBa (n(n − 1)/2 ≤ 2^24), no PaBaLarge, LinReg, PBequi;
  all interval methods; default `methodCi: "analytical"` for Deming and PaBa and "jackknife" for WDeming
  (documented difference from mcr's random default); bootstrap reproduces R's stream with an `rngSeed` option and the
  global stream otherwise; PaBa odd positions as dy/dx and the even mean as tan((θL + θR)/2), 1e-12 tie rule on
  scaled data (documented); WDeming with mcr's stopping rule and defaults; undefined PaBa interval ±Inf plus a
  warning; CUSUM statistic only as `cusum: { nPos, nNeg, maxCusum }`; mcr's input restrictions kept with rStats.js's
  own messages, n ≤ 2 or constant x or y an Error.
- Decisions 14–17: a new function `ICC(x, options)` (psych's name, next to the irr-based `icc`) returning the six
  rows and the mean squares; complete data only (missing ratings an Error); option `lmer` with psych's default true,
  both paths computed exactly (ANOVA formulas; REML closed form on the boundary), differences from R's optimiser
  documented; psych's ICC2k interval in `ICC`, irr's kept in `icc`, documented; degenerate data as decision 17.
- Decisions 18–23: new `tTOST` and `tsumTOST` (summary statistics); `tost` unchanged; all SMD interval methods with
  nct limits as true roots; fix TOSTER's first two inconsistencies (one-sample raw interval of mean − mu; one-sample
  t/z SMD limits at 1 − 2α) and keep and document the third; TOSTER's notes become warnings ("Equivalence interval
  does not include zero." included), decision sentences not reproduced; no log_TOST, wilcox_TOST, boot_t_TOST or
  power functions now; α in (0, 0.5), RangeError otherwise.
