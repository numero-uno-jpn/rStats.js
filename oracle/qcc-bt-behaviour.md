# Control charts and paired comparisons: qcc, the median chart, BTm and qvcalc (1.18.0)

Reference basis: the documentation of qcc 2.7 (`qcc`, `stats.xbar` / `sd.xbar` / `limits.xbar` and the same for R,
S, xbar.one, p, np, c, u, g, `qcc.options`, `shewhart.rules`, `cusum`, `ewma`, `ewmaSmooth`, `oc.curves`,
`process.capability`, `mqcc`, `qcc.overdispersion.test`, `pareto.chart`, `qcc.groups`), BradleyTerry2 1.1.4 (`BTm`,
`BTabilities`, `countsToBinomial`, `residuals.BTm`, `glmmPQL`, `glmmPQL.control`), qvcalc 1.0.4 (`qvcalc`,
`worstErrors`), and the references they name (Montgomery, *Introduction to Statistical Quality Control*; SAS/QC for
the std.dev methods; Burr 1969; Chou et al. 1990; Bissell 1990; Boyles 1991; Kaminsky et al. 1992; Breslow and Clayton
1993; Firth 2003; Firth and de Menezes 2004). R 4.6.2 public-call results (x86_64) in `experiments/qccbt118-*.R`,
every attempt (the failed ones too) in `experiments/qccbt118-log.md` (cited below as "log n"), summaries on
Issue #568. No R or package source was consulted.

The calls followed are ReactiveStat's (`scripts/品質管理/管理図.php`, `計数値管理図.php`, `メディアン管理図.php`,
`scripts/実験計画法/一対比較.php`).

## Scope (decided 2026-11-25)

- Control charts, values only (no plots), in `/descriptive`: `qcc` (types xbar, R, S, xbar.one, p, np, c, u, g;
  std.dev methods; newdata; nsigmas and confidence.level; violations), `mqcc` (T2, T2.single), `cusum`, `ewma`,
  `ewmaSmooth`, `ocCurves`, `processCapability`, `paretoChart` (the table), `qccOverdispersionTest`, `qccGroups`,
  `shewhartRules`.
- The median chart (Me-R) as a procedure function, `medianChart`.
- Paired comparisons in `/regression`: `btm` (BTm with the reference object, links, contest-level covariates, player
  covariates **with random player effects by PQL**), `btAbilities`, `countsToBinomial`, `qvcalc`, `worstErrors`.
- Out: the plot-only functions (`cause.and.effect`, `ellipseChart`), the ties model `GenDavidson` (needs gnm).

## Constants (log 2, 17)

- d2(n) = `qcc.options("exp.R.unscaled")[n]` for n = 2..25 (1.128, 1.693, 2.059, 2.326, ...; 3-4 decimals as in the
  textbook tables); d3(n) = `se.R.unscaled[n]` for n = 2..50 (7 decimals). Both tables are copied into rStats.js as
  data (they are published table values, not code). d2 has no entry beyond 25.
- c4(n) = sqrt(2 / (n - 1)) Gamma(n / 2) / Gamma((n - 1) / 2) (computed, through lgamma).

## qcc: statistics, center, std.dev (log 2, 3, 16, 17)

Data: a vector (one value per group; types xbar.one, p, np, c, u, g) or a matrix (rows = groups, NA = missing; the
size of a group is its number of non-missing values). Notation: n_i group sizes, R_i ranges, s_i standard deviations.

| type | statistics | center | std.dev (the process sigma) |
| --- | --- | --- | --- |
| xbar | group means | sum(n_i xbar_i) / sum(n_i) | method (below), default UWAVE-R |
| R | ranges | sum(n_i R_i) / sum(n_i) | UWAVE-R (default) or MVLUE-R |
| S | standard deviations | sum(n_i s_i) / sum(n_i) | UWAVE-SD (default), MVLUE-SD or RMSDF |
| xbar.one | the values | mean | MR (default): mean of the moving ranges of k = 2 points / d2(k); SD: sd(x) / c4(N) |
| p | D_i / n_i | sum(D) / sum(n) | sqrt(p (1 - p)) |
| np | D_i | n p (a vector when sizes differ) | sqrt(n p (1 - p)) (a vector likewise) |
| c | counts | mean | sqrt(center); **unequal sizes: error** "all sizes must be be equal for a c chart" |
| u | x_i / n_i | sum(x) / sum(n) | sqrt(u) |
| g | the values | mean (gbar) | sqrt(gbar (gbar - 1)) (= sqrt(1 - p) / p, p = 1 / gbar) |

std.dev methods (SAS/QC definitions):
- UWAVE-R = mean(R_i / d2(n_i)); MVLUE-R = sum(f_i R_i / d2(n_i)) / sum(f_i), f_i = d2^2 / d3^2;
- UWAVE-SD = mean(s_i / c4(n_i)); MVLUE-SD = sum(h_i s_i / c4(n_i)) / sum(h_i), h_i = c4^2 / (1 - c4^2);
- RMSDF = sqrt(sum((n_i - 1) s_i^2) / sum(n_i - 1)) / c4(sum(n_i - 1) + 1).
- Allowed per type: xbar all five; R only UWAVE-R, MVLUE-R; S only UWAVE-SD, MVLUE-SD, RMSDF (others: "'arg' should be
  one of ..."). A number given as std.dev is used as is; so is a given center.
- **A group of size 1 is an error when std.dev is estimated** ("group sizes must be larger than one"), xbar too.
- **Groups larger than 25: the xbar default becomes RMSDF** (R does this without a message); UWAVE-R and MVLUE-R
  give NA (no d2) and so do the R chart's limits (Choice 2).
- newdata (and newsizes): `newstats`; center, std.dev and limits from data only.

## qcc: limits (log 2, 3)

k = nsigmas (default 3); with confidence.level `conf` the probability limits below replace k.

| type | nsigmas limits | probability limits (quantiles at (1 - conf) / 2 and (1 + conf) / 2) |
| --- | --- | --- |
| xbar | center +- k sd / sqrt(n_i) | qnorm in place of k |
| R | center +- k d3(n_i) sd, LCL >= 0 | **qtukey(., n_i, Inf) sd** (not around the center; R's qtukey is accurate to ~1e-8) |
| S | center +- k sd sqrt(1 - c4(n_i)^2), LCL >= 0 | sd sqrt(qchisq(., n_i - 1) / (n_i - 1)) |
| xbar.one | center +- k sd | qnorm |
| p | p +- k sd / sqrt(n_i), clipped to [0, 1] | qbinom(., n_i, p) / n_i |
| np | np +- k sd, LCL >= 0 | qbinom(., n, p) |
| c | c +- k sd, LCL >= 0 | qpois(., c) |
| u | u +- k sqrt(u / n_i), LCL >= 0 | qpois(., u n_i) / n_i |
| g | gbar +- k sd, LCL >= 0 (with a warning: "The Geometric distribution is quite skewed ...") | qgeom(., 1 / gbar) |

- The R chart's center does not depend on n_i: one weighted center, limits per size.
- `limits.R` with nsigmas and a size above 50: error "group size must be less than 51 when giving nsigmas".
- Limits: one row when all sizes are equal, else one row per group; **the p chart always has one row per group**;
  columns LCL, UCL. qcc fails (`dims [product 2] do not match ...`) for probability limits of a p chart with equal sizes;
  rStats.js gives them (log 19). A given `limits` pair is used
  as is (center and std.dev still estimated).

## Violations (shewhart.rules; log 2, 3, 16)

- `beyondLimits`: **the indices above UCL in order, then those below LCL** (not sorted overall); strict inequalities.
- `violatingRuns`: a point is flagged when it is the run.length-th (default 7) or later point of a run strictly on
  one side of the center; **a point equal to the center ends the run**; an NA statistic ends it too.
- Data and newdata together (indices continue into newdata; runs continue across).
- R puts NA into both index lists for an NA statistic or limit; rStats.js leaves them out (Choice 2).

## cusum (log 4, 6)

z_i = (stat_i - center) / (sd / sqrt(n_i)); k = seShift / 2 (default seShift 1); C+_0 = C-_0 = headStart (default 0).
C+_i = max(0, C+_{i-1} + z_i - k), C-_i = max(0, C-_{i-1} - z_i - k); `pos` = C+, **`neg` = -C-** (non-positive).
violations: `upper` = indices with pos > h, `lower` with -neg > h (strict), h = decisionInterval (default 5).
`headStart` must be in [0, h): error "head.start must be non-negative and less than decision.interval". Data:
grouped (stat = group means, std.dev methods as xbar) or individual (xbar.one, methods MR / SD). newdata continues the
sums with center and sd from data.

## ewma and ewmaSmooth (log 4, 6)

- y_i = lambda stat_i + (1 - lambda) y_{i-1}, y_0 = center (default lambda 0.2, nsigmas 3).
- sigma_i = sd / sqrt(n_i) sqrt(lambda / (2 - lambda) (1 - (1 - lambda)^(2 i))) **with each point's own n_i** (R's
  form; for unequal sizes it is not the exact variance of the weighted sum). limits center +- nsigmas sigma_i.
- violations: one index vector (points outside either limit). lambda = 0: y = center, sigma = 0, no error.
- ewmaSmooth(x, y, lambda, start): order by x; start defaults to the first y in that order; returns x sorted, the
  smoothed y (z_1 = lambda y_1 + (1 - lambda) start), lambda, start.

## ocCurves (log 6, 7, 9, 16, 17)

beta = probability of not signalling (type II error).
- xbar: beta(c, n) = pnorm(L - c sqrt(n)) - pnorm(-L - c sqrt(n)), L = nsigmas, or qnorm((1 + conf) / 2) for a chart
  with confidence.level. Default c = seq(0, 5, length 101) ("shift (std.dev)"), n = unique(c(chart size, 1, 5, 10,
  15, 20)); a matrix with dimnames like "n=5".
- R: for each n its own limits with sd 1: beta = ptukey((d2 + k d3) / c, n, Inf) - ptukey(max(0, d2 - k d3) / c, n,
  Inf); c = seq(1, 6, length 101) ("scale multiplier"), n = unique(c(size, 2, 5, 10, 15, 20)).
- S: likewise with pchisq((n - 1) (ucl / c)^2, n - 1), ucl = c4 + k sqrt(1 - c4^2), lcl = max(0, c4 - k sqrt(1 - c4^2)).
- p, np: a vector over p = seq(0, 1, length 101), pbinom(floor(n UCL), n, p) - pbinom(ceiling(n LCL) - 1, n, p)
  with the chart's limits (as proportions for p).
- c: over lambda = 0:ceiling(c + 10 sqrt(c)), ppois likewise. u: the c curve of the counts (limits times n) over
  0:ceiling(n u + 10 sqrt(u)); unequal sizes: error "Operating characteristic curves available only for equal
  sample sizes!". xbar.one and g: error "Operating characteristic curves not available for this type of chart.".
- p, np, c, u warn that some values are rounded (discreteness); rStats.js: the same warning (R's text).

## processCapability (log 6-9)

For an xbar or xbar.one chart (others: error `Process Capability Analysis only available for charts type "xbar" and
"xbar.one" charts`). center and sd from the chart (or given sd), k = nsigmas (default the chart's), n = all values,
target default mean(spec limits, NA removed), conf default 0.95, a = 1 - conf.

- Cp = (USL - LSL) / (2 k sd); CI Cp sqrt(qchisq(c(a/2, 1 - a/2), n - 1) / (n - 1)) (Chou).
- Cp_l = (center - LSL) / (k sd), Cp_u = (USL - center) / (k sd), Cp_k = min(Cp_l, Cp_u); CI (Bissell)
  `est (1 -+ z sqrt(1 / (9 n est^2) + 1 / (2 (n - 1))))` (= est -+ z sqrt(1 / (9 n) + est^2 / (2 (n - 1))) for est > 0; for
  a negative index, reversed specification limits, the lower limit is the larger number), **z = qnorm(1 - a) for the
  one-sided Cp_l and Cp_u**, qnorm(1 - a/2) for Cp_k (found by the fixture: log 18).
- Cpm = (USL - LSL) / (2 k sqrt(sd^2 + (center - target)^2)); CI Cpm sqrt(qchisq(c(a/2, 1 - a/2), nu) / nu),
  **nu = n (1 + d^2) / (1 + 2 d^2)**, d = (center - target) / sd.
- exp = (pnorm(LSL, center, sd), 1 - pnorm(USL, center, sd)), **values below 1e-4 reported as 0** (Choice 3); obs = the
  fractions of values below LSL / above USL.
- One spec limit NA: only Cp_l or Cp_u; **Cp, Cp_k and Cpm NA** (Choice 3). Reversed limits: negative indices and a
  warning "target value is not within specification limits...".
- indices: rows Cp, Cp_l, Cp_u, Cp_k, Cpm; columns Value and the two percent labels.

## mqcc (log 10)

- T2 (subgrouped, p variables, m groups of n): center = grand mean, cov = mean of the within-group covariance
  matrices, T2_i = n (xbar_i - center)' S^-1 (xbar_i - center); UCL = p (m - 1) (n - 1) / (m n - m - p + 1)
  qf(conf, p, m n - m - p + 1), prediction UCL with (m + 1).
- T2.single (m rows): center = colMeans, cov = cov(X), T2_i = (x_i - center)' S^-1 (x_i - center); UCL = (m - 1)^2 / m
  qbeta(conf, p / 2, (m - p - 1) / 2), prediction UCL = p (m + 1) (m - 1) / (m (m - p)) qf(conf, p, m - p).
- LCL 0; conf default (1 - 0.0027)^p. Given center / cov: used for the statistics, limits unchanged (still m's).
  newdata: statistics with the phase I center and cov. violations: beyondLimits, violatingRuns, beyondPredLimits.

## qccOverdispersionTest, paretoChart, qccGroups (log 7)

- Overdispersion: binomial ratio = var(x) / (mean(size) pbar (1 - pbar)), pbar = sum(x) / sum(size); poisson ratio =
  var(x) / mean(x); statistic = ratio (k - 1), p = 1 - pchisq(statistic, k - 1), **R rounds the p-value to 5
  significant digits** (rStats.js gives the full value; Choice 3 covers it). type default binomial when sizes are
  given.
- paretoChart: Frequency, Cum.Freq., Percentage, Cum.Percent., sorted decreasing, ties in the given order; unnamed
  data are named A, B, C, ...
- qccGroups(data, sample): one row per sorted distinct sample value, values in order of appearance, NA fill.

## medianChart (Me-R; log 11)

ReactiveStat's procedure: group medians and ranges (groups in order of first appearance), Me center = mean of the
medians, limits center +- A4 Rbar; R center = Rbar, limits D3 Rbar, D4 Rbar; JIS 3-sigma table for n = 2..10
(A4 1.880, 1.187, 0.796, 0.691, 0.549, 0.509, 0.432, 0.412, 0.363; D3 0 for n <= 6, then 0.076, 0.136, 0.184, 0.223;
D4 3.267, 2.574, 2.282, 2.114, 2.004, 1.924, 1.864, 1.816, 1.777). Out of control: stat > UCL or stat < LCL.
Unequal group sizes: an error (Choice 4).

## btm without random effects (log 12)

- The contests: win1, win2 per row (aggregated) or one row per contest with outcome 1 / 0; player1, player2 factors
  with common levels. X[k, j] = 1 if player1 of k is j, -1 if player2 is; the reference's column dropped (first
  level, or refcat); contest-level covariates (home advantage) add a column (value for player1 - value for player2).
- Fit = glm(binomial, link logit / probit / cauchit) without intercept on X (existing glm): coefficients, se,
  deviance, null deviance (df = contests), AIC, df, iterations as glm. Coefficient names `..B` (id + level);
  covariates by their names.
- btAbilities: one row per level, ability and s.e., (0, 0) for the reference; vcov with a zero row and column.
- countsToBinomial(table winner x loser): rows for pairs i < j (level order) with at least one contest, columns
  player1, player2, win1, win2.

## btm with player covariates and random effects: PQL (log 13-15)

Formula `~ x[..] + z[..] + (1 | ..)` (player covariates indexed by the player, a table of predictors per level).
eta_k = (x_i - x_j)' beta + (contest covariates) + e_i - e_j, e ~ N(0, sigma^2).
- Given sigma: beta, e by penalized IWLS (Henderson's equations) on z = eta + (y - mu) / mu.eta, w = n mu.eta^2 /
  (mu (1 - mu)).
- sigma maximizes the **REML** log-likelihood of the working LMM z = X beta + Z e + eps, eps ~ N(0, W^-1):
  -1/2 (log|V| + log|X'V^-1 X| + r'V^-1 r), V = W^-1 + sigma^2 ZZ'. Iterate to the fixed point.
- R stops at its tolerance (default 1e-6; 1.5e-7 from the fixed point in sigma); **rStats.js solves to the fixed
  point; fixtures from R at tol 1e-10 compared at about 1e-8** (as betareg in 1.17.0).
- varFix = (X'V^-1 X)^-1; varSigma = 1 / (4 sigma^2 I(sigma^2)), I(sigma^2) = tr(P ZZ' P ZZ') / 2,
  P = V^-1 - V^-1 X (X'V^-1 X)^-1 X'V^-1. Summary: fixed effects (z tests with sqrt(varFix)) and Std. Dev. (estimate,
  sqrt(varSigma), z, p). deviance and AIC: NA (R's).
- REML largest at sigma = 0: sigma = 0, the glm's coefficients, random effects 0, varSigma NA.
- A player with a missing covariate: a separate ability (a fixed +-1 indicator column, named `..p03`, first), its
  covariate 0 and its random column dropped; btAbilities marks it (`separate`).
- btAbilities for this model: x_j' beta (no random effects), s.e. sqrt(x_j' varFix x_j).
- `~ x[..]` without random effects: a glm with a warning "Ability modelled by predictors but no random effects";
  `~ (1 | ..)` alone: error "Predictor variables are not of the correct length --they probably need indexing in
  'formula'.".

## qvcalc and worstErrors (log 12, 16)

- From btAbilities (or any covariance matrix with estimates): quasi-variances q minimizing
  sum_{i<j} (log(q_i + q_j) - log v_ij)^2, v_ij = V_ii + V_jj - 2 V_ij; quasiSE = sqrt(q); relerrs (pairs "A,B", ...)
  = sqrt((q_i + q_j) / v_ij) - 1. R's optimizer is not exact: fixtures compared at about 1e-6.
- worstErrors = sqrt(range of the eigenvalues of (C'VC)^-1 C'QC)) - 1 over a basis C of the contrasts, Q = diag(q).

## API decisions (mine; the shape of qcc confirmed by the user as Choice 1)

- One `qcc(data, options)` with `type` (as R), options `sizes`, `center`, `stdDev` (number or method name),
  `limits`, `newdata`, `newsizes`, `labels`, `nsigmas`, `confidenceLevel`, `runLength`; result fields camelCase
  (`statistics`, `sizes`, `center`, `stdDev`, `limits` as `{ lcl, ucl }` arrays, `violations: { beyondLimits,
  violatingRuns }`, `newstats`). The other functions take the qcc result (`ocCurves(q)`, `processCapability(q, ...)`)
  or data like qcc (`cusum`, `ewma`).
- Matrices as arrays of rows (`number[][]`), missing values `NaN` or `null`.
- `btm(contests, options)`: contests a DataFrame; options `outcome` (one column, or two columns of wins),
  `player1`, `player2` (column names), `formula` (default `~ ..`), `predictors` (a DataFrame, one row per level),
  `contestCovariates` (name -> [column for player1, column for player2]), `refcat`, `link`.
- Indices 1-based as in R (as elsewhere in rStats.js).

## Choices (decided by the user, 2026-11-25; all as recommended)

1. API shape: one `qcc(data, { type })`, as R and ReactiveStat.
2. qcc's quirks: NA statistics are **left out** of the violation indices (R puts NA in them); groups above 25 switch
   the xbar default to RMSDF silently and give NA limits for the R chart, **as R** (with comments in the code).
3. processCapability / overdispersion: the one-sided z of Cp_l and Cp_u, NA Cp_k and Cpm with one spec limit, exp below 1e-4 as 0
   **as R** (with comments); the overdispersion p-value **not rounded** (R rounds to 5 significant digits).
4. medianChart with unequal group sizes: **an error** (ReactiveStat uses the first group's n).
5. btm `br = TRUE` (Firth): out (not in the scope of Issue #568).

## Edge cases (checked twice after the implementation; test/qccbt118Edge.test.ts)

- Scales 1e+-150 and 1e+-300 give the same statistics, sigma and limits relative to the scale (1e-13) for every
  std.dev method (RMSDF scales the group standard deviations by their largest first); a common value of 1e8 keeps
  sigma (a shift of 1e12 loses only what the input itself loses).
- Constant data: sigma 0 and LCL = UCL; p = 0 or 1 and c = 0 give zero-width limits; a g chart with mean below 1: NaN
  sigma with R's "NaNs produced".
- NA statistics: left out of the violations (Choice 2); xbar.one with a missing value: the moving ranges that contain
  it are skipped.
- mqcc with a singular covariance matrix (fewer groups than variables, collinear variables): an error ("the covariance
  matrix is singular"), where the Cholesky factor would give meaningless T2 of 1e14.
- btm: separation keeps glm's warning; players not connected to the reference and players without contests: NaN
  coefficients (R's NA) with aligned NaN standard errors, NaN ability for those players only; a covariate that does not
  vary between the players of any contest: an error ("not identifiable"); counts times 1e6 and covariates times
  1e+-6 give the same fit (1e-12); qvcalc with missing variances: an error.
