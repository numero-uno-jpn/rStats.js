# Effect sizes of repeated measures, and more tests: the behaviour to reproduce

What effectsize 1.0.3, car 3.1-5, clinfun 1.1.6, DescTools 0.99.60, nortest 1.0-4 and R 4.5.2 compute, in words, for
an implementation that must not read their source. Fixtures: `etaSquaredStrata`, `etaSquaredEz`
(`oracle/effectsizerm.R`) and `moreTests` (`oracle/moretests.R`); formats in their header comments and
`oracle/_anova.R`. The rules of `oracle/effectsize-behaviour.md` ("ANOVA effect sizes", "Accuracy") apply unless
said otherwise. Where this file and a fixture seem to disagree, report it.

## Easy to get wrong

1. In the strata, each term is measured against **the residual of its own stratum**; the subject stratum (the one
   named by the Error() term's first variable, e.g. `id`; afex: the between-subjects part) also enters every partial
   omega squared.
2. The totals (non-partial effect sizes) add up **every stratum** (all terms and all residuals, intercept stratum left
   out).
3. Generalized eta squared adds **all residual sums of squares of all strata**.
4. Jonckheere's normal approximation ignores ties in the variance; exact p-values only without ties and n ≤ 100.
5. The two packages' two-sided Jonckheere p-values differ: clinfun `2 min(i, d, 0.5)`, DescTools `2 min(i, d, 1)`.
6. Levene's test is the one-way ANOVA of |y − centre of its group| (median by default); car names the residual row
   with a blank.

## Effect sizes of repeated measures

`etaSquared`, `omegaSquared`, `epsilonSquared` also accept the result of `aov(formula with Error(), data)` (or
its `aovSummary`) and of `aovEz`, with the same options.

Build a list of strata. For `aov` with `Error()`: the strata of `aovSummary` other than the intercept stratum, named by
the stratum (`id`, `id:W`, `Within`), each with its term rows (sum of squares `SS`, `df`) and its `Residuals` row
(`SSe_s`, `dfe_s`). For `aovEz` (afex's univariate tests, `univariate`, intercept row left out): a row whose name
contains no within-subject factor belongs to the subject stratum `Subject`; any other row to the stratum
`Subject:w`, where `w` is the within-subject term whose factors all occur in the row's name (as whole words), the one
with the most factors; each stratum's residual is the `Error SS` and `den Df` of its rows.

Then, with `MSe_s = SSe_s/dfe_s` for each stratum, `SStot` = the sum of all term and residual sums of squares of all
strata, and `subj` the subject stratum (`id` / `Subject`):

- eta: partial `SS/(SS + SSe_s)`; non-partial `SS/SStot`; generalized `SS/(SS + Σ_s SSe_s + O − o)` (observed terms
  as in the simple case).
- omega: partial `(SS − df MSe_s) / (SS + w SSe_s + SSe_subj + MSe_subj)` with `w` = 1 for a term outside the
  subject stratum and 0 inside it; non-partial `(SS − df MSe_s) / (SStot + MSe_subj)`; both at least 0.
- epsilon: partial `(SS − df MSe_s)/(SS + SSe_s)`; non-partial `(SS − df MSe_s)/SStot`; both at least 0.

There is no single-term rule here. Intervals as in the simple case, with the stratum's `dfe_s` as the error df.

Result: the table form; for `aov` with `Error()` also `groups` (the stratum of each row, in the order of the strata,
terms in their order within each); for `aovEz` the rows in the order of afex's terms (without the intercept), no
`groups`.

## Levene's test: `leveneTest(y, g, options)`

`center`: `"median"` (default) or `"mean"`. Rows with a missing value are dropped. With `c_g` the centre of group
`g`, the response `|y − c_g|`, the one-way ANOVA table of it on the groups: columns `Df`, `F value`, `Pr(>F)`, rows
`group` and `""` (the residuals; F and p empty). Group labels as in the other k-sample tests (sorted strings).

## Chi-squared test for trend in proportions: `propTrendTest(x, n, score?)`

`score` defaults to 1, 2, ..., k. With `p = Σx/Σn`, weights `w_i = n_i/(p(1 − p))`, `f_i = x_i/n_i`: the statistic is
the weighted regression sum of squares of `f` on the scores, `(Σ w (s − s̄)(f − f̄))² / Σ w (s − s̄)²` with weighted
means `s̄`, `f̄`; `statisticName` `"X-squared"`, `parameter` 1 (`"df"`), p-value the upper chi-squared tail, method
`"Chi-squared Test for Trend in Proportions"`.

## Jonckheere-Terpstra: `jonckheereTest(x, g, options)`

`g`: group labels in their order (numbers sorted as numbers, strings as ordered levels sorted by code point, or an
explicit `levels`), `alternative` `"two.sided"` (default), `"increasing"`, `"decreasing"`, `exact` (DescTools:
default true when there are no ties and n ≤ 100), `variant` `"DescTools"` (default) or `"clinfun"` (clinfun's
`jonckheere.test`: no `exact` option, exact under the same condition, and the two-sided cap below).

- Statistic `JT` = the sum over group pairs i < j (in order) of the Mann-Whitney counts #(x_i < x_j) + ½ #(ties).
- `mean = Σ_i n_i m_i / 2`, `var = Σ_i n_i m_i (n_i + m_i + 1)/12` with `m_i` the number of observations in the groups
  after group i (no tie correction).
- Exact: the distribution of JT is the convolution over i of the Mann-Whitney distributions of `n_i` against `m_i`
  observations (`dwilcox`); `d = P(JT ≤ jt)`, `i = P(JT ≥ jt)`.
- Normal: `z = (JT − mean)/sqrt(var)`, `d = Φ(z)`, `i = 1 − Φ(z)`.
- p-value: increasing `i`, decreasing `d`, two-sided `2 min(i, d, cap)` with cap 1 (DescTools) or 0.5 (clinfun).
- Warnings: without an explicit `exact`, when not exact: `Sample size > 100 or data with ties \n p-value based on
  normal approximation. Specify nperm for permutation p-value`; DescTools with `exact: true` and ties additionally
  switches to the normal approximation with `Sample data with ties \n p-value based on normal approximation. Specify
  nperm for permutation p-value.` (exact strings in the fixture).
- Result: `statistic`, `statisticName` `"JT"`, `pValue`, `alternative`, method `"Jonckheere-Terpstra test"`.

## Cochran's Q: `cochranQTest(y)`

`y`: a matrix of 0/1 (rows blocks, columns treatments). The result of this library's `friedmanTest(y)` with
`statisticName` `"Q"` and method `"Cochran's Q test"`.

## Normality tests (nortest): `adTest`, `lillieTest`, `cvmTest`, `sfTest`, `pearsonTest`

Missing values dropped; `m`, `s` the mean and standard deviation; `z = (x_(i) − m)/s` sorted; `p_i = Φ(z_i)`.

- **adTest** (n ≥ 8, else error `sample size must be greater than 7`): `A = −n − mean((2i − 1)(log p_i + log(1 −
  p_{n+1−i})))` (logs of the normal tails computed directly); `AA = (1 + 0.75/n + 2.25/n²) A`; p-value: `AA < 0.2`:
  `1 − exp(−13.436 + 101.14 AA − 223.73 AA²)`; `< 0.34`: `1 − exp(−8.318 + 42.796 AA − 59.938 AA²)`; `< 0.6`:
  `exp(0.9177 − 4.279 AA − 1.38 AA²)`; `< 10`: `exp(1.2937 − 5.709 AA + 0.0186 AA²)`; else `3.7e-24`. Name `A`,
  method `"Anderson-Darling normality test"`.
- **cvmTest** (n ≥ 8): `W = 1/(12n) + Σ (p_i − (2i − 1)/(2n))²`, `WW = (1 + 0.5/n) W`; p-value `< 0.0275`: `1 −
  exp(−13.953 + 775.5 WW − 12542.61 WW²)`; `< 0.051`: `1 − exp(−5.903 + 179.546 WW − 1515.29 WW²)`; `< 0.092`:
  `exp(0.886 − 31.62 WW + 10.897 WW²)`; `< 1.1`: `exp(1.111 − 34.242 WW + 12.832 WW²)`; else 7.37e-10 with the warning
  `p-value is smaller than 7.37e-10, cannot be computed more accurately`. Name `W`, method `"Cramer-von Mises
  normality test"`.
- **lillieTest** (n ≥ 5, else `sample size must be greater than 4`): `D = max(max(i/n − p_i), max(p_i − (i − 1)/n))`;
  for n ≤ 100 `Kd = D`, `nd = n`, else `Kd = D (n/100)^0.49`, `nd = 100`; p = `exp(−7.01256 Kd² (nd + 2.78019) +
  2.99587 Kd sqrt(nd + 2.78019) − 0.122119 + 0.974598/sqrt(nd) + 1.67997/nd)`; if p > 0.1, with `KK = (sqrt(n) − 0.01 +
  0.85/sqrt(n)) D`: `KK ≤ 0.302`: 1; `≤ 0.5`: `2.76773 − 19.828315 KK + 80.709644 KK² − 138.55152 KK³ + 81.218052
  KK⁴`; `≤ 0.9`: `−4.901232 + 40.662806 KK − 97.490286 KK² + 94.029866 KK³ − 32.355711 KK⁴`; `≤ 1.31`: `6.198765 −
  19.558097 KK + 23.186922 KK² − 12.234627 KK³ + 2.423045 KK⁴`; else 0. Name `D`, method `"Lilliefors
  (Kolmogorov-Smirnov) normality test"`.
- **sfTest** (5 ≤ n ≤ 5000, else `sample size must be between 5 and 5000`): `W` = the squared correlation of the
  sorted x with `qnorm(ppoints(n, a = 3/8))` (`(i − 3/8)/(n + 1/4)`), `u = log n`, `v = log u`, `mu = −1.2725 + 1.0521
  (v − u)`, `sig = 1.0308 − 0.26758 (v + 2/u)`, p = upper normal tail at `(log(1 − W) − mu)/sig`. Name `W`, method
  `"Shapiro-Francia normality test"`.
- **pearsonTest** (`nClasses` default `ceil(2 n^(2/5))`, `adjust` default true): class of each value `floor(1 +
  nClasses Φ((x − m)/s))`, counts by class, expected `n/nClasses` each, `P = Σ (count − e)²/e`, df = `nClasses − 1 −
  (adjust ? 2 : 0)`, p the upper chi-squared tail. Name `P`, method `"Pearson chi-square normality test"`, and the
  `parameter`/`parameterName` the fixture shows.

Results in the htest form (`statistic`, `statisticName`, `pValue`, `method`, `parameter` where R has one).

## Accuracy

As in `oracle/effectsize-behaviour.md`: values within a relative 1e-12 of R; the interval limits of the effect sizes
against the fixtures' `reference` (relative 1e-12, or 1e-12 absolute when 0). Known differences only within 1e-12 of
a reference, listed with reasons. No loosening.
