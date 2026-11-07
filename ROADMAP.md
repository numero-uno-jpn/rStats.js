# Roadmap

English | [日本語](ROADMAP.ja.md)

## Goal

Cover the numerical core of R's `stats` package (and the related parts of `base`) in plain
TypeScript, with R's function names, defaults and numerical results: distributions, descriptive
statistics, hypothesis tests, linear models, special functions, numerical methods and the basics
of linear algebra. R is the oracle: every function is tested against R's output, and against
high-precision reference values where R itself is inaccurate (see [docs/accuracy.md](docs/accuracy.md)).

The point is to fill a gap. JavaScript has libraries for distributions and special functions
(such as [stdlib-js](https://github.com/stdlib-js/stdlib), which is accurate and broad) and for
descriptive statistics, and R itself can run in the browser through WebAssembly (webR), at the
cost of a download of tens of megabytes. What is missing is a light library whose results can
be trusted to match R, from the distributions up to the hypothesis tests, including R's
`set.seed()` random streams.

The priority is the analyses used in medical, biological and psychological research. Where R's
`stats` has no function for one of them, the reference is a widely used CRAN package (such as
`car`, `multcomp` or `survival`), installed in the oracle image from the same dated snapshot as
the other packages.

SciPy (`scipy.stats`, `scipy.special`, `scipy.linalg`) is a source of ported code and a guide
to what is useful, but not a target: functions that have no counterpart in R cannot be checked
against R and are not a priority.

## Done

| Area | Status |
|---|---|
| Special functions | `gamma`, `lgamma`, `beta`, `lbeta`, `choose`, `lchoose`, `factorial`, `lfactorial`, `digamma`, `trigamma`, `psigamma`, `besselI`, `besselK`, `besselJ`, `besselY`, and `erf`, `erfc`, `erfinv`, `erfcinv`, `gammainc`, `perm` (not in R), and the log1p-type functions of R's C API `log1pmx`, `lgamma1p`, `log1mexp`, `log1pexp` |
| Distributions | d/p/q with `lowerTail` and `logP` for all 20 distributions in R's `stats` (including the studentized range), the non-central chi-squared, t, F and beta, and inverse gamma, Kumaraswamy, Pareto, triangular, Laplace (extraDistr) and arcsine; `distSummary` for 23 of them (all but the Wilcoxon signed rank and rank sum distributions and the studentized range) |
| Random numbers | R's default Mersenne-Twister with `set.seed()`-compatible streams, and `RNGkind` with `"L'Ecuyer-CMRG"` (with `parallel`'s `nextRNGStream` and `nextRNGSubStream`) and `sample.kind = "Rounding"`; 26 `r*` functions including `rmultinom` (extraDistr's streams for the extra distributions), `sample`, `sampleInt`, `r2dtable` |
| Descriptive statistics | R's summaries (`mean`, `variance`, `quantile` with all nine types, `rank`, `cov`/`cor` matrices, `table`, `cut`, `hist`, `ecdf`, `scale`, ...) and e1071's and DescTools' (`skewness`, `kurtosis`, `geometricMean`, `modes`, `meanAD`, `cv`) |
| Hypothesis tests | R's `htest` functions: `tTest`, `chisqTest` (including simulated p-values and two factor vectors), `fisherTest` (including r × c and simulated p-values), `wilcoxTest`, `corTest`, `binomTest`, `poissonTest`, `propTest`, `mcnemarTest`, `varTest`, `bartlettTest`, `kruskalTest`, `friedmanTest`, `quadeTest`, `flignerTest`, `moodTest`, `onewayTest`, `shapiroTest`, `mantelhaenTest`, `ansariTest` (with its confidence interval), `ksTest`, the `pairwise*` helpers, `pAdjust`; `aov` (one way), `TukeyHSD`, `zTest` (BSDA), `brunnerMunzelTest` (lawstat) |
| Linear models | `lm` with a matrix interface and `summary.lm`'s quantities, `confint`, `predict`; `glm` with a matrix interface (every family and link of R's `stats`), `summary.glm`, the four kinds of residuals, `hatvalues`, `rstandard`, `cooks.distance`, `predict` with standard errors, profile likelihood `confint` (exact limits) and `anova` |
| Analysis of variance | `aov`, `lm` and `modelMatrix` from formulas (several factors, interactions, covariates, `Error()` strata), `anova` (sequential and model comparison), car's `Anova` (types II and III), afex's `aov_ez` as `aovEz` (repeated measures, Greenhouse-Geisser and Huynh-Feldt, generalized eta squared), `mauchly.test` |
| Effect sizes and power | effectsize's `cohens_d`, `hedges_g`, `eta_squared`, `omega_squared`, `epsilon_squared` (from `anova` and `Anova` tables, exact confidence limits); `power.t.test`, `power.prop.test`, `power.anova.test` and the power functions of `pwr` |
| More tests | `leveneTest` (car), `propTrendTest` (`prop.trend.test`), `jonckheereTest` (DescTools and clinfun), `cochranQTest` (DescTools), `adTest`, `lillieTest`, `cvmTest`, `sfTest`, `pearsonTest` (nortest) |
| Contingency tables and proportions | `binomCI`, `binomDiffCI`, `binomRatioCI` (DescTools' `BinomCI`, `BinomDiffCI`, `BinomRatioCI`), `oddsRatio` (epitools, and epiR's score interval), `fisherTest(x, { midp: true })` (exact2x2), `boschlooTest` (Exact), `gTest`, `stuartMaxwellTest`, `goodmanKruskalGamma` (DescTools), `lblTest` (coin), `chisqTest(x, { nMinus1: true })` (Campbell's 'N − 1' test) and Freeman-Tukey residuals, `tost` (equivalence), `binomDiffEquivalenceTest` (score TOST of two proportions) |
| Multiple comparisons | PMCMRplus's `dscfAllPairsTest` (Steel-Dwass), `kwAllPairsDunnTest`, `kwManyOneDunnTest`, `manyOneUTest` (Steel's many-one rank test), `dunnettTest`, `gamesHowellTest`, `tukeyTest`; `dunnTest` (dunn.test); `glhtDunnett` (multcomp); Dunnett-type probabilities computed exactly (R's are randomised) |
| Mixed models | lme4's `lmer` as `lmer` (REML and ML; correlated and uncorrelated random effects `(x \| g)`, `(x \|\| g)`, crossed and nested grouping factors `a/b`, `a:b`), with the quantities of `fixef`, `vcov`, `coef(summary())` (without p-values), `VarCorr`, `ranef`, `fitted`, `residuals`, `logLik`, `AIC`, `BIC`, `deviance`, `REMLcrit` and `isSingular`; lmerTest's Satterthwaite t- and F-tests (`summary`, `contest`, Type I/II/III `anova`) and lme4's `anova` of several fits; lme4's `glmer` as `glmer` (all glm families, Laplace approximation and adaptive Gauss-Hermite quadrature) with `summary`, `anova` and `predict` (`glmerSummary`, `glmerAnova`, `glmerPredict`) and `predict` of `lmer` (`lmerPredict`); implemented from Bates et al. (2015) with a sparse Cholesky factorisation; the estimates are the exact optimum of the criterion (lme4 stops close to it). In its own area `@numero-uno-jpn/rstats/mixed` (`dist/mixed.js`), not in the single-file bundle |
| Survival analysis | `survdiff` (log-rank and the G-rho family) and `survfit` (Kaplan-Meier with log, plain and log-log intervals and the median) and `coxph` (Cox regression: Efron and Breslow ties, weights, strata, the summary tests) of the `survival` package |
| Agreement and reliability | `kappa2`, `kappamFleiss`, `icc` (irr), `cronbachAlpha`, `partialR` (psych), `polychor`, `polyserial` (polycor, two-step and maximum likelihood), `pbvnorm`, `omega` (McDonald's ω, psych); effect sizes of repeated-measures designs (`Error()` strata and `aovEz`) |
| Optimisation | `factanal` (maximum likelihood, varimax and promax); `optim` with all six methods (Nelder-Mead, BFGS, CG, L-BFGS-B, SANN, Brent), following R's iterations (except CG, which tries the minimum of the parabola where R tries the midpoint, so its path differs), and `optimHess` |
| Data handling | `completeCases` (`complete.cases`), `naOmit` (`na.omit`), `subset`, `merge`, `rbind` and `cbind` of data frames, `tapply`, `split`, `aggregate`, `pivotLonger` and `pivotWider` (tidyr); formula forms of the tests (`tTest("y ~ g", data)`, `kruskalTest`, `friedmanTest("y ~ w \| b", data)`, `corTest("~ x + y", data)`, ...) |
| Linear algebra | the matrix functions of R's `base`, with `Matrix::lu`, `prcomp` (`stats`) and `MASS::ginv`: matrix arithmetic, `crossprod`, `norm`, `backsolve`, `chol`, `qr` (R's pivoting and LAPACK), `solve`, `det`, `rcond`, `kappa`, `svd`, `eigen` (symmetric and general), `lu`, `prcomp`, `ginv`, `schur` (`Matrix::Schur`) and `expm` (expm's Higham08, Padé and Taylor methods) |
| Numerical methods | `integrate`, `optimize`, `uniroot`, `approx`, `spline`/`splinefun`/`splinefunH`, Lagrange (pracma) and Hermite interpolation, fixed-step `ode` (deSolve), `grad`/`jacobian`/`hessian` (numDeriv) |
| jStat | every jStat function has a replacement ([docs/migrating-from-jstat.md](docs/migrating-from-jstat.md)), checked against jStat |

The full list is in the [README](README.md#what-is-included); known differences from R are in
[docs/differences-from-r.md](docs/differences-from-r.md).

## Remaining

The priority is that a medical or psychological study can use the right method: exact methods for small samples,
and effect measures with their confidence intervals, not only p-values. The list was drawn up against the methods of
a statistics web application for medical and psychological research (2026-11-06). In order of priority; the R
function or package that each item is checked against is given in brackets.

1. **Robust standard errors:** sandwich covariance matrices, HC0 to HC3 and clustered [sandwich `vcovHC`,
   `vcovCL`], and the tests of the coefficients with them [lmtest `coeftest`], so that modified Poisson regression
   (risk ratios), weighted regression after inverse probability weighting and difference-in-differences get correct
   intervals; the robust variance and `cluster` of Cox regression [survival `coxph`].
2. **Diagnostic accuracy and agreement of measurements:** ROC curves and the AUC with DeLong's interval and test
   [pROC]; Bland-Altman analysis [BlandAltmanLeh]; Deming and Passing-Bablok regression [mcr]; equivalence tests
   (two one-sided tests) [TOSTER]; the six forms of the intraclass correlation [psych `ICC`].
3. **Survival analysis, continued:** the Nelson-Aalen estimate [`survfit`'s cumulative hazard]; the restricted mean
   survival time [survRM2]; the test of proportional hazards [`cox.zph`]; time-dependent covariates in the (start,
   stop] form [`coxph`]; competing risks: cumulative incidence, Gray's test and Fine-Gray regression [cmprsk];
   accelerated failure time and Tobit models [`survreg`].
4. **Sample size and power for trial designs:** equivalence, non-inferiority and superiority for means and
   proportions, McNemar's test, survival (Schoenfeld, Freedman) and Simon's two-stage design [clinfun
   `ph2simon`]; the reference for each is chosen when the item is taken up.
5. **Meta-analysis:** fixed and random effects (DerSimonian-Laird, REML), Q and I², Egger's test [metafor].
6. **Mixed models, continued:** `confint` (profile likelihood) and `simulate` of `lmer` and `glmer` fits [lme4]. The
   `mixed` area stays out of the root export and the single-file bundle `dist/rstats.js` (decided 2026-11-05); adding
   it later would not break compatibility.
7. **Later, in no particular order:** ordinal logistic regression [MASS `polr`], nonlinear regression [`nls` and the
   self-starting models], robust and quantile regression [MASS `rlm`, quantreg], GEE [geepack]; MANOVA [`manova`],
   discriminant analysis [MASS `lda`], canonical correlation [`cancor`]; cluster analysis [`hclust`, `kmeans`];
   multidimensional scaling and correspondence analysis [`cmdscale`, MASS `isoMDS`, ca]; Tamhane's T2 and Page's
   test [PMCMRplus], Grubbs' test [outliers]; regularised regression [glmnet]; time series [`acf`, `arima`].

Speed: done for now. The incomplete beta function with both parameters large uses Temme's uniform asymptotic
expansion (constant time instead of a continued fraction of length √(a + b)), with one parameter large and the other
small DiDonato and Morris's expansion (`pt` and `pf` with large degrees of freedom, `pbeta(x, 1e6, 10)`, `pbinom`
with x near 0 or n: about the time of a typical `pbeta` instead of up to 30 times more), and the main d/p functions
leave out the double-double steps that an error bound shows to be unnecessary (see
[docs/performance.md](docs/performance.md)). Remaining: the continued fraction, which stays in double-double and is
still used where neither expansion applies (moderate parameters, such as a = 30 and b = 20, where it is short, and
the far tails).

Out of scope: the parts of SciPy with no counterpart in R (most of `scipy.special` and the
distributions that only `scipy.stats` has). Structural equation models (`lavaan`, including confirmatory factor
analysis and multilevel SEM) are out of scope too: they are the size of a library of their own; for the same reason
so are item response theory [mirt, ltm], latent class analysis [poLCA], multiple imputation [mice] and Gaussian
mixture models [mclust]. Also out of scope:
recycling distribution parameters as vectors (`rnorm(3, mean = c(0, 10, 100))`), since `map` does
the same with R's results and random stream (see
[docs/differences-from-r.md](docs/differences-from-r.md#general)). The other RNG kinds (Wichmann-Hill, Marsaglia-Multicarry, Super-Duper, Knuth-TAOCP) and normal kinds
(Kinderman-Ramberg, Ahrens-Dieter, Box-Muller) are out of scope too: they serve only to reproduce
old code.

## Size

Users of a bundler only get the functions they import (`pnorm` alone is 1.6 KB gzipped), so
adding functions costs them nothing. For CDN use there is one file per area
(`dist/distributions.js`, `dist/tests.js`, `dist/linalg.js`, `dist/descriptive.js`,
`dist/numerics.js`, `dist/special.js`, `dist/mixed.js`), built with esbuild's code splitting so that shared code is
not duplicated, and `dist/rstats.js` with everything except `mixed` (the mixed models are large, so they stay out
of the single-file bundle; decided 2026-11-05). The same areas are subpath exports of the
package (`@numero-uno-jpn/rstats/linalg`, ...). `npm run size` reports the sizes. After
publishing to npm, CDNs that bundle per export (such as esm.sh with `?exports=`) are a further
option.

## Sources for ported code

- Port only from permissively licensed sources: SciPy and xsf (BSD-3), Boost.Math (BSL-1.0),
  statsmodels (BSD-3), lifelines (MIT), the LAPACK reference implementation (modified BSD),
  public-domain code (LINPACK, EISPACK, Cephes as distributed with xsf), and published papers.
- R is the oracle that results are checked against. R's source may be read to find out how R
  behaves, but R's code and GPL packages are never copied or translated, so that rStats.js can stay
  MIT licensed.
- Each ported file names its source, and the source is listed in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See also [CONTRIBUTING.md](CONTRIBUTING.md).
