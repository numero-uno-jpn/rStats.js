# 1.18.0 (control charts, paired comparisons): the record of the trial and error

The clean-room evidence for how R's behaviour was found: every attempt in order, the failed ones too, with what each
showed. Nobody read the source of R or of the GPL packages; each finding comes from the documentation (the help pages,
printed with `help()`) and from the output of exported functions compared with candidate formulas written for these
experiments (from the help pages and textbook definitions: Montgomery's *Introduction to Statistical Quality Control*,
the SAS/QC definitions named in `help(sd.xbar)`). All runs: R 4.6.2 x86_64 (`rstats-oracle-amd64:4.6.2`), qcc 2.7,
BradleyTerry2 1.1.4, qvcalc 1.0.4, scripts checked with `scripts/r-experiment-check.mjs`. Issue #568 has the summaries.

Some scripts were edited in place between runs (marked "replaced"); the attempt is described here and the final
script keeps the search that succeeded.

## Shewhart charts, first pass (2026-11-25)

1. `qccbt118-shewhart.R` (first version, replaced): **rejected by the checker** (`get` is not allowed: the two data
   matrices were looked up by name). Rewritten with a named list.
2. (final version): balanced groups (20 x 5) and unbalanced groups (NA; sizes 3, 4, 2 and **1**), each of xbar, R, S
   with every std.dev method, nsigmas = 2, confidence.level = 0.99, given center and std.dev, newdata; xbar.one; p, np,
   c, u, g. Findings:
   - `qcc.options("exp.R.unscaled")` is d2 (1.128, 1.693, 2.059, 2.326, ...; entry 1 is NA), `se.R.unscaled` is d3
     (0.8525033, 0.8883697, ...), `run.length` is 7.
   - Balanced groups: every candidate matched (to 1e-16): UWAVE-R `mean(R_i / d2)`, UWAVE-SD `mean(s_i / c4)`, MVLUE-R and
     MVLUE-SD (equal to UWAVE here), **RMSDF divided by c4(sum(n_i - 1) + 1)** (the raw root mean square did not).
     Default std.dev: xbar and R UWAVE-R, S UWAVE-SD. R allows only UWAVE-R and MVLUE-R, S only UWAVE-SD, MVLUE-SD and
     RMSDF (others: `'arg' should be one of ...`).
   - Center: xbar the mean of the group means, R the mean range, S the mean standard deviation (not d2 sigma or c4 sigma).
   - Limits (nsigmas k): xbar `center +- k sd / sqrt(n)`; R `center +- k d3 sd` with the lower clipped at 0 (with center
     10 and sd 2 given: [4.815487, 15.184513] = 10 +- 3 * 0.8640855 * 2); S `center +- k sd sqrt(1 - c4^2)`, clipped at 0.
     confidence.level: xbar `qnorm((1 + conf) / 2)` in place of k; **S is not normal**: [0.41467, 3.51355] =
     `sd sqrt(qchisq(c(0.005, 0.995), n - 1) / (n - 1))`; **R is not normal either** ([1.0111, 8.9022]; open).
   - **A group of size 1 is an error** when std.dev is estimated (`group sizes must be larger than one`), also for xbar;
     with center and std.dev given it runs, and the range of that group is 0, its S NA. Not yet tried: unbalanced groups
     without a group of size 1 (the per-method differences are untested).
   - The limits are a matrix with one row per group when the sizes differ, one row when equal; colnames LCL, UCL.
   - `violations` has `beyond.limits` and `violating.runs` (indices). With nsigmas = 2, beyond.limits was `7, 3`
     (group 7 above, group 3 below): **not sorted** (open: above first?). With NA statistics the indices contain NA.
     violating.runs with center 10 given (all ranges below): indices 7, 8, ..., 20, i.e. flagged from the 7th point of
     a run on one side. An NA statistic (S of the size-1 group) ends the run.
   - newdata: `newstats`, `newsizes`, `newdata`; center, std.dev and limits come from data only; the violations are over
     data and newdata together (index 26 of 20 + 10 in xbar.one).
   - xbar.one: MR `mean(|diff(x)|) / d2(2)`, k = 3 moving ranges of 3 points / d2(3), SD `sd(x) / c4(n)` (all to 1e-16);
     limits `center +- k sd`; conf uses qnorm.
   - p: statistics D / n, center sum(D) / sum(n), std.dev `sqrt(p (1 - p))`, limits `p +- k sd / sqrt(n)` clipped to
     [0, 1]. np: center n p and std.dev `sqrt(n p (1 - p))`; **with unequal sizes np runs** and center and std.dev become
     vectors. c: center mean, std.dev sqrt(center); **unequal sizes are an error** (`all sizes must be be equal for a c
     chart`). u: center sum(x) / sum(n), std.dev sqrt(u), limits `u +- k sqrt(u / n)`.
   - g: center mean(g); **std.dev is `sqrt(gbar (gbar - 1))`** (= sqrt(1 - p) / p with p = 1 / gbar; p = 1 / (gbar + 1)
     gave 16.659 against 15.6587), limits `gbar +- k sd` clipped at 0, a warning when conf is not a probability.
   - confidence.level on attribute charts gives integer-valued limits: p [1/47, 11/47], np [1, 11], c [0, 10], u
     [0.4, 6] (probably qbinom, qpois quantiles divided by n; open), g [0, 82] (open).
3. `qccbt118-shewhart2.R`: the open questions of 2.
   - Unbalanced groups (sizes 2 to 6, none of size 1), every method against the candidates: UWAVE-R, MVLUE-R
     (`f = d2^2 / d3^2`), UWAVE-SD, MVLUE-SD (`h = c4^2 / (1 - c4^2)`) and RMSDF (with c4(sum(n_i - 1) + 1)) all equal
     to 1e-16, through `sd.xbar`, `sd.R`, `sd.S` and through `qcc`.
   - Centers with unequal sizes: xbar the **size-weighted** grand mean `sum(n_i xbar_i) / sum(n_i)` (2.99611, the mean
     of means 3.00349 did not); **R and S are size-weighted too**: `sum(n_i R_i) / sum(n_i)` (1.24941; mean 1.15483,
     and d2 sd per group, did not), `sum(n_i s_i) / sum(n_i)` (0.48116; the mean 0.45597 and the (n - 1) weighting
     0.48712 did not).
   - Limits with unequal sizes: R `center +- k d3(n_i) sd` around the **single** weighted center (not d2(n_i) sd);
     S `center +- k sd sqrt(1 - c4(n_i)^2)` (not c4(n_i) sd); both clipped at 0.
   - Probability limits: **R = `qtukey(c((1 - conf) / 2, (1 + conf) / 2), n_i, Inf) * sd`** (the studentized range with
     df = Inf, i.e. the range of n normal values; equal to 1e-16, sizes 2 to 25), S = `sd sqrt(qchisq(., n_i - 1) /
     (n_i - 1))` (not c4 times that), xbar qnorm. They do not depend on the center.
   - `limits.R` with nsigmas and a size above 50: error `group size must be less than 51 when giving nsigmas`; d2 and d3
     tables have 25 entries (sizes 26 to 50 open).
   - Attribute probability limits, all equal to the candidates: p `qbinom(., n_i, p) / n_i`, np `qbinom(., n, p)`,
     c `qpois(., c)`, u `qpois(., u n_i) / n_i`, g **`qgeom(., 1 / gbar)`** ([0, 82]; with 1 / (gbar + 1) [0, 88]),
     quantiles at (1 - conf) / 2 and (1 + conf) / 2. p with nsigmas clips the upper limit at 1.
   - beyond.limits: **the indices above the UCL first, then those below the LCL** (`2, 6, 4, 7` for 4 and 5 above,
     -4 and -5 below), each in order; a value equal to a limit is not beyond (3 with UCL 3; 3.0000001 is).
     (The NA indices seen in 2 fit `index[stat > UCL]` with an NA comparison: with an NA limit or statistic. Open.)
   - violating.runs: a point is flagged when it is the run.length-th or later point of a run strictly on one side of
     the center (7 ones: 7; 8 ones: 7, 8; 12 ones: 7 to 12; 6 then 7 on the other side: only 13; alternating: none).
     **A point equal to the center ends the run** (1, 1, 1, 0, 1, 1, 1, 1: none). With `run.length = 4` the 4th point on.
     The runs continue from data into newdata (5 + 4 ones: 7, 8, 9).

## cusum, ewma, ewmaSmooth (2026-11-25)

4. `qccbt118-cusum-ewma.R`: candidates of the tabular CUSUM on standardized statistics and of the EWMA (header of
   the script). Grouped data (equal sizes 4, unequal sizes with NA), individual values, given center / std.dev,
   head.start, se.shift, decision.interval, newdata, lambda 0 / 0.5 / 1.
   - cusum: `pos` = C+ and **`neg` = -C-** (stored as non-positive values) with z_i = (x_i - center) / (sd / sqrt(n_i)),
     k = se.shift / 2, C+_0 = C-_0 = head.start: equal to 1e-15 in every case (also unequal sizes, xbar.one, newdata
     continued from data with center and sd from data only). Fields: statistics, sizes, center, std.dev, pos, neg,
     head.start, decision.interval, se.shift, violations = list(lower, upper) (indices; newdata: upper 25). std.dev
     methods are passed on (UWAVE-SD, SD for individual values). `head.start = 6` with h = 5: error
     `head.start must be non-negative and less than decision.interval`.
   - ewma: `y` with y_0 = center (equal to 1e-16), `x` the indices. `sigma`: **the closed form
     `sd / sqrt(n_i) * sqrt(lambda / (2 - lambda) * (1 - (1 - lambda)^(2 i)))` with each point's own n_i** (2.8e-17),
     not the exact variance of the weighted sum for unequal sizes (differs by 0.044). Limits `center +- nsigmas sigma`
     per point. lambda = 1: y equals the statistics; lambda = 0: y = center and sigma = 0 (no error). std.dev methods
     passed on. violations came back as an empty list here (no point outside; its form is open).
   - ewmaSmooth(x, y): orders by x, start = the first y in that order by default, z_1 = lambda y_1 + (1 - lambda) start
     (so z_1 = y_1 by default); returns x (sorted), y, lambda, start.

## oc.curves, process.capability, overdispersion, pareto.chart, qcc.groups (2026-11-25)

5. `qccbt118-misc.R` (first version, replaced): **rejected by the checker** (`unclass` is not allowed, used to read the
   pareto table). Rewritten with `as.vector` and `dim`.
6. (final version): candidates in the header of the script. Findings:
   - ewma `violations`: a plain integer vector of indices (17 to 25 above). cusum: `upper` holds the points with
     **pos > h strictly** (pos 2.5 at index 5 with h = 2; pos = 2 is not), `lower` likewise for -neg (neg = -2 not).
   - oc.curves for xbar: the candidate `pnorm(L - c sqrt(n)) - pnorm(-L - c sqrt(n))` equal to 1e-16 (also nsigmas 2;
     with confidence.level, L = qnorm((1 + conf) / 2)). Default grid c = seq(0, 5, length = 101) ("shift (std.dev)")
     and **n = unique(c(object's size, 1, 5, 10, 15, 20))** (columns "n=5", "n=1", "n=10", "n=15", "n=20"); R and S:
     c = seq(1, 6, length = 101) ("scale multiplier"), n = unique(c(size, 2, 5, 10, 15, 20)). p and np: a vector over
     p = seq(0, 1, length = 101) (names "0", "0.01", ...); c: over lambda 0, 1, ... (25 values for center 3.9); u runs
     as c; xbar.one: error `Operating characteristic curves not available for this type of chart.`. p and c warn about
     rounding due to discreteness.
   - process.capability: fields nobs, center, std.dev, target, spec.limits, indices (rows Cp, Cp_l, Cp_u, Cp_k, Cpm;
     columns Value, 2.5%, 97.5%), exp, obs. Center and std.dev are the chart's; nobs counts all values. Cp =
     (USL - LSL) / (2 k sd), Cp_l = (center - LSL) / (k sd), Cp_u, Cp_k = min, Cpm = (USL - LSL) / (2 k sqrt(sd^2 +
     (center - target)^2)) with k = nsigmas (all equal; std.dev = 1.2, nsigmas = 2 gives Cp = 1.25). Default target
     = the middle of the limits. **With one limit NA, Cp_k and Cpm are NA too** (only Cp_l or Cp_u is given). R chart:
     error `... only available for charts type "xbar" and "xbar.one" charts`.
7. `qccbt118-misc2.R`: the confidence limits and the OC curves of R, S, p, c.
   - Cp: `Cp sqrt(qchisq(c(a/2, 1 - a/2), n - 1) / (n - 1))` equal. Cp_u and Cp_k: Bissell `est +- z sqrt(1 / (9 n) +
     est^2 / (2 (n - 1)))` with z = qnorm(1 - a/2) equal. **Cp_l: the same form with z = qnorm(1 - a)** (one-sided z:
     95% gives +-0.1113 = 1.645 * 0.06766 where qnorm(0.975) gives 0.1326; with conf 0.9, z = 1.2816 matched; n = 25
     too). Cpm with nu = n (1 + d^2)^2 / (1 + 2 d^2): close but not equal (0.74300 against 0.74238).
   - exp: `pnorm(LSL, center, sd)` and `1 - pnorm(USL, ...)` equal, except that a lower fraction of 2.86e-6 came back 0.
     obs: the fractions of values below LSL / above USL. Reversed spec limits: negative indices with a warning
     `target value is not within specification limits...`.
   - OC R: **not the object's limits**: for each n of the grid, the limits of that size with sd = 1,
     `ptukey((d2 + k d3) / c, n, Inf) - ptukey(max(0, d2 - k d3) / c, n, Inf)` (equal; the object's limits matched only
     at its own n). OC S likewise with `pchisq((n - 1) (ucl / c)^2, n - 1)`, ucl = c4 + k sqrt(1 - c4^2) (equal).
     OC p: `pbinom(floor(n UCL), n, p) - pbinom(ceiling(n LCL) - 1, n, p)` (equal, max difference 0); OC c likewise
     with ppois (equal).
   - Overdispersion with unequal sizes: the ratio is **`var(x) / (mean(size) pbar (1 - pbar))`**, pbar = sum(x) /
     sum(size) (equal; ratios using x / size gave 0.91). The statistic is ratio * (k - 1), the p-value
     `1 - pchisq(D, k - 1)` **rounded to 5 significant digits** (0.81311, 0.048579). Row name "binomial data" /
     "poisson data", columns `Obs.Var/Theor.Var`, `Statistic`, `p-value`.
   - pareto.chart: a table with columns Frequency, Cum.Freq., Percentage, Cum.Percent., sorted decreasing with ties in
     the given order (b before f); unnamed data get names A, B, C. qcc.groups: one row per sorted sample value (row
     names the values), the data in order of appearance, NA to fill.
8. `qccbt118-misc3.R`: solving for nu from R's Cpm limits: pc12 (d = 0) gives nu = n = 25; the others **fit
   `nu = n (1 + d^2) / (1 + 2 d^2)`** (pc6: 25 * 1.29867 / 1.59734 = 20.3255 = solved 20.3255; pc2 123.555; pc10
   87.946), not the squared (1 + d^2). conf 0.8 gives the same nu. The exp below LSL: 3.41e-4 kept, 2.86e-6 and
   6.9e-9 gave 0. c chart OC grid ends: 8, 14, 23, 40, 69, 121 for centers 0.5, 1.55, 3.5, 9.35, 21.7, 50.05.
9. `qccbt118-misc4.R`: **exp values below 1e-4 are reported as 0** (1.000000000000002e-4 kept, 0.99999...e-4 gave 0;
   the kept values are not rounded), both tails. The OC grid of the c chart is **0:ceiling(center + 10 sqrt(center))**
   (all 8 centers: 0.05 -> 3, 100 -> 200, 1.55 -> 14 since 13.9999); the qpois candidates did not fit.

## mqcc (2026-11-25)

10. `qccbt118-mqcc.R`: T2 (20 groups of 4, 3 variables, correlated, group 5 shifted) and T2.single (30 rows), with
    pred.limits, confidence.level, given center and cov, newdata, given limits. Every candidate of the header matched:
    center (grand mean / colMeans), cov (**the mean of the within-group covariance matrices** for T2, cov(X) for
    T2.single), statistics (to 4e-15), the default confidence.level `(1 - 0.0027)^p` (0.99192), phase I UCL
    `p (m - 1) (n - 1) / (m n - m - p + 1) qf(conf, p, m n - m - p + 1)` (12.7491) and prediction UCL with (m + 1)
    (14.0911) for T2; `(m - 1)^2 / m qbeta(conf, p / 2, (m - p - 1) / 2)` (10.0860) and `p (m + 1) (m - 1) /
    (m (m - p)) qf(conf, p, m - p)` (16.0863) for T2.single. LCL is 0. Fields: call, data.name, var.names, data, type,
    confidence.level, statistics, means, center, cov, limits, (pred.limits), violations = beyond.limits,
    violating.runs (empty here), beyond.pred.limits. **With center and cov given the limits stay those of m** (the
    same as when estimated from the same 20 rows). newdata: T2 of the new rows with the phase I center and cov; the
    violations index data and newdata together (28 = new row 8). A list of one-column matrices works as T2.single.

## The median chart (Me-R) (2026-11-25)

11. No R experiment: the Me-R chart is not in qcc. Its procedure is the one of ReactiveStat
    (`scripts/品質管理/メディアン管理図.php`, the user's own code, base R only): group medians and ranges in the order
    groups first appear, n = the size of the first group, Me center = mean of the medians, limits `center +- A4 Rbar`,
    R center = Rbar, limits `D3 Rbar` and `D4 Rbar`, with the 3-sigma JIS table for n = 2 to 10:
    A4 = 1.880, 1.187, 0.796, 0.691, 0.549, 0.509, 0.432, 0.412, 0.363; D3 = 0 (n <= 6), 0.076, 0.136, 0.184, 0.223;
    D4 = 3.267, 2.574, 2.282, 2.114, 2.004, 1.924, 1.864, 1.816, 1.777. Out of control: `stat > UCL | stat < LCL`.
    (ReactiveStat's qcc uses, for reference: `qcc.groups(value, grp)`, xbar with std.dev and nsigmas 2 or 3, R or S,
    newdata for a calibration split, xbar.one with the moving range chart as `qcc(cbind(x[-n], x[-1]), type = "R")`,
    `process.capability(q, spec.limits, target, nsigmas = 3)`, p / np / c / u with labels and newdata.)

## BTm, BTabilities, countsToBinomial, qvcalc (2026-11-25)

12. `qccbt118-bt.R`: five players (one pair not played), aggregated wins. Candidates in the header.
    - BTm = **glm(binomial) without intercept on X** (`X[k, j] = 1` for player1, -1 for player2, the reference's column
      dropped): coefficients, se, deviance, null.deviance (df 9), AIC, df.residual, iter all equal (difference 0).
      Coefficient names `..B`, `..C`, ... (the id `..` pasted to the level). class `c("BTm", "glm", "lm")` with the glm
      fields plus id, player1, player2, term.labels. summary prints as a glm. refcat = "C": the same deviance, the
      coefficients shifted. probit: equal to the candidate glm. cauchit runs. `br = TRUE` runs (Firth; not compared).
    - Home advantage (`player1 = data.frame(team, at.home)`, `formula = ~ team + at.home`, id = "team"): one more column
      `at.home1 - at.home2`, equal to the candidate (coef and se).
    - BTabilities: rows the levels, columns `ability`, `s.e.`, the reference (0, 0); class `c("BTabilities", "matrix")`,
      attr vcov (5 x 5 with a zero row and column for the reference), factorname `..`. Residuals of type grouped are
      ~1e-6 (weighted means of working residuals, weights = the binomial totals per player).
    - countsToBinomial(table winner x loser): one row per pair i < j in the level order, columns player1, player2, win1,
      win2, factors with the table's levels; **a pair with no contests is dropped**.
    - qvcalc(BTabilities): class qv with covmat, qvframe (estimate, SE, quasiSE, quasiVar; rows the levels), dispersion,
      relerrs (names "A,B", ...), factorname, coef.indices, modelcall. The candidate **least squares on
      log(q_i + q_j) - log var(b_i - b_j)** (BFGS) agreed to 3e-7 (quasiVar) and 1e-6 (relerrs), i.e. to the
      optimizer's precision; relerrs = sqrt((q_i + q_j) / v_ij) - 1 agreed. `worstErrors` gave (-0.1661, 0.1799) (over
      all contrasts, not only the simple ones: open).
13. `qccbt118-bt-pql.R`: 12 players with covariates x, z, 40 contests, `~ x[..] + (1 | ..)`.
    - class `c("BTm", "BTglmmPQL", "glm", "lm")`; fields of glm plus sigma, sigma.fixed, varFix, varSigma, random (the
      40 x 12 design of the random effects, +1 / -1); deviance, aic and null.deviance are **NA**; the random effects in
      `attr(coef, "random")`. `~ x[..]` without `(1 | ..)` warns `Ability modelled by predictors but no random effects`
      and fits a plain glm.
    - Candidates (header): **the REML fixed point matched** R at tol 1e-10: sigma 0.538627867323 against 0.538627867134,
      beta 0.931588048439 against 0.931588048407, random effects to 2e-10. The ML fixed point did not (sigma 0.4949).
      At the default tol 1e-6 R stopped after 11 iterations (sigma 0.53862772, 1.5e-7 off).
    - summary: Fixed Effects table and a Random Effects table for `Std. Dev.` (estimate, se sqrt(varSigma), z, p).
    - BTabilities of this model: **x_j beta without the random effects**, s.e. |x_j| se(beta) (0.30355 = x * 0.93159,
      0.07372).
14. `qccbt118-bt-pql2.R` (first version, replaced): **rejected by the checker** (`inherits(f, "BTm")`: the string
    names a function). Rewritten with a helper that looks for the error / warning fields. (second version, replaced):
    **failed to parse** (`if ... ` at top level with `else` on the next line); the if-else wrapped in parentheses.
    (final version):
    - varFix = **(X' V^-1 X)^-1** with V = W^-1 + sigma^2 Z Z' at the final working weights (2.7e-13; equal to the fixed
      block of the inverse of Henderson's matrix).
    - varSigma = **1 / (4 sigma^2 I_REML(sigma^2))**, I_REML(sigma^2) = tr(P ZZ' P ZZ') / 2 (equal to 1e-17; the ML
      information gave 0.03264 against 0.03504): the variance of sigma by the delta method from the REML information.
    - A player with a missing covariate (x[3] = NA): coefficients `..p03` (first) and `x[..]`; BTabilities gives p03 its
      own coefficient and se, the others x_j beta; attr `separate` = "p03"; the random design has 11 columns.
    - `~ (1 | ..)` alone: error `Predictor variables are not of the correct length --they probably need indexing in
      'formula'.`
    - Data with no extra variation (abilities exactly 0.9 x, 20 times the contests): sigma = 0, the coefficients equal
      the glm's (1e-13), iter NULL, varSigma NULL, random effects 0, no warning or message.
15. `qccbt118-bt-pql3.R`: the REML fixed point as a general function of X, Z and the link: home advantage
    (`~ x[..] + home + (1 | ..)`, X gains home1 - home2): coef and sigma equal to 1e-8; probit: equal to 5e-10; the
    missing covariate: X = (+-1 indicator of p03, x with 0 for p03): equal to 4e-10 with or without p03's random
    column (the two are the same fit: the indicator is in the fixed design, so REML projects that direction out).
    No extra variation: the REML profile is largest at sigma = 0 (34.32716 at 0, 34.31256 at 0.01, decreasing) and
    the REML score for sigma^2 at 0 is negative (-144.7): **sigma = 0 at the boundary, the fit is the glm**.

## Remaining points of qcc and qvcalc (2026-11-25)

16. `qccbt118-rest.R`: candidates in the header.
    - Groups of 30: `sd.xbar` (UWAVE-R) gave NA, the R chart's limits NA, but `qcc(type = "xbar")` gave 1.00206
      (UWAVE-SD 0.99919; d2 by numerical integration of the expected range, 4.0855 for n = 30, did not explain it).
      `limits.R` with sizes 26, 30, 50 and center given works (d3 = 0.7050004, 0.692677, 0.6521506).
    - An NA statistic puts **NA into both index lists** of beyond.limits (`NA, 3, NA, 4` for 1, NA, 4, -4, 2 with limits
      +-3), as `index[stat > UCL]` would with an NA comparison; violating.runs unaffected here.
    - `limits = c(0, 5)` given: used as is, center and std.dev still estimated; `labels` become the names of the
      statistics (no labels field); data.name is the deparsed argument.
    - The u chart OC curve equals the c chart's for the counts (u n), on a grid of counts; with unequal sizes: error
      `Operating characteristic curves available only for equal sample sizes!`.
    - worstErrors: **`sqrt(range of the generalized eigenvalues of (C'QC, C'VC)) - 1`** over a basis C of the
      contrasts, Q = diag(quasiVar) (equal to 1e-16).
17. `qccbt118-rest2.R`: `exp.R.unscaled` has 25 entries, **`se.R.unscaled` 50** (d3 for 26 to 50 recorded in the
    JSON). For group sizes above 25 the default std.dev of the xbar chart is **RMSDF** (equal to 1e-16 for 26 and 30;
    for 25 UWAVE-R), silently; UWAVE-R and MVLUE-R give NA and the R chart's limits are NA; S works. The u chart OC
    grid is **0:ceiling(n u + 10 sqrt(u))** (sizes 1, 2, 3, 5, 0.5: all equal; with sqrt(n u) or u alone not), the
    probabilities those of the c chart with limits times n.
