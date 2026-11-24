# Mediation, moderation and moderated mediation: mediate, simSlopes, johnsonNeyman, mvrnorm and ReactiveStat's procedures (draft, 1.16.0)

Reference basis: the documentation of mediation 4.5.1 (`mediate`), interactions 1.2.0 (`sim_slopes`,
`johnson_neyman`), MASS 7.3-66 (`mvrnorm`) and sandwich 3.1.3 (`vcovHC`); Imai, Keele and Tingley (2010),
"A general approach to causal mediation analysis", Psychological Methods 15, 309-334 (Algorithms 1 and 2); Bauer and
Curran (2005) for Johnson-Neyman. R 4.6.2 public-call results (x86_64) in `experiments/mediation116*.R`, every attempt
(the failed ones too) in `experiments/mediation116-log.md`, summaries on Issue #566. No R or package source was
consulted. LAPACK (modified BSD) is the reference for the eigendecomposition's signs.

The calls followed are ReactiveStat's (`scripts/多変量/媒介分析.php`, `調整分析.php`, `調整媒介分析.php`).

## Scope (decided 2026-11-25)

- `mediate(modelM, modelY, data, options)` (mediation's `mediate`): mediator and outcome models from `lm` or `glm`
  with a formula (gaussian, binomial with logit or probit); quasi-Bayesian (`boot: false`) and nonparametric bootstrap
  (`boot: true`, percentile and BCa); `treatValue` / `controlValue`, `covariates`, `robustSE`, `confLevel`, `sims`
- `simSlopes(fit, data, options)` and `johnsonNeyman(fit, data, options)` (interactions'): lm and binomial glm,
  `modxValues` "mean-plus-minus" or numbers, `robust` false or "HC3"
- `mvrnorm(n, mu, Sigma, options)` (MASS's), in `/distributions` with the other random numbers
- ReactiveStat's procedures outside R's functions, as functions (the user's decision 2026-11-25): `sobelTest`,
  `mediationMonteCarlo` (coefficients' Monte Carlo: `rnorm` for a, 2-dimensional `mvrnorm` for (b, c')),
  `moderatedMediation` (continuous W: Monte Carlo on all coefficients of both models; binary W or a binary mediator /
  outcome: `mediate` at the two values of W with the same seed; the index of moderated mediation)
- Random numbers: the same values as R under the same `setSeed`, except `mvrnorm` in 3 or more dimensions (the user's
  decision 2026-11-25, see below)
- Entry point `/causal` (mvrnorm: `/distributions`)

## Settled

### mvrnorm (log 1, 9-11)

- `mu + V diag(sqrt(pmax(lambda, 0))) Z'` with `eigen(Sigma, symmetric = TRUE)` (values decreasing) and Z an n x p
  matrix of normals filled **by column** (`rnorm(n * p)`). n = 1 gives a vector; names of mu become column names; a
  non positive definite Sigma ("'Sigma' is not positive definite") is an error.
- The values depend on the signs of LAPACK's (dsyevr's) eigenvectors. 2 x 2: dlaev2 on (S11, S21, S22), columns
  (cs, sn) for the larger eigenvalue and (-sn, cs) for the smaller (600 of 600 identical). 3 and more: dsyevr's MRRR
  path, no simple rule (96% for "largest component positive in the tridiagonal basis of dsytd2, uplo L").

### mediate, quasi-Bayesian (log 2-8, 12-14, 34-38)

- The parameter draws: the mediator model first, then the outcome model, each a sims x p matrix of normals filled
  **by row** times the **symmetric square root** V diag(sqrt(lambda)) V' of the covariance (`vcov`, or
  `vcovHC(type = "HC3")` with robustSE), plus the coefficients. The symmetric square root does not depend on the
  eigenvectors' signs.
- The mediator draws for all simulations at once: an lm (gaussian) mediator gets `rnorm(sims * n, 0, sigma)` (sigma
  = the residual standard error) as a sims x n matrix **by column**, the same errors for M(t1) and M(t0); a binomial
  mediator gets `rbinom(sims * n, 1, P(t1))` then `rbinom(sims * n, 1, P(t0))`, each by column, P the inverse link of
  the linear predictor. The predictions are on the data with the treatment set to t1 or t0 and the `covariates` set to
  their given values in every row.
- The outcome: mu(t, m) = inverse link of the outcome model's linear predictor (probabilities for glm). Per draw j:
  d0 = mean(mu(t0, M1) - mu(t0, M0)), d1 = mean(mu(t1, M1) - mu(t1, M0)), z0 = mean(mu(t1, M0) - mu(t0, M0)),
  z1 = mean(mu(t1, M1) - mu(t0, M1)), tau = mean(mu(t1, M1) - mu(t0, M0)); n0 = d0 / tau, n1 = d1 / tau; the averages
  (d0 + d1)/2, (z0 + z1)/2, (n0 + n1)/2.
- Estimates = the means of the draws, except n0 and n1 = the medians and n.avg = (n0 + n1) / 2 of those medians.
- Intervals = `quantile(type = 7)` at (1 -+ conf.level) / 2. p = 2 min(mean(v > 0), mean(v < 0)).
- Defaults: treat.value = 1, control.value = 0, sims = 1000, conf.level = 0.95.

### mediate, bootstrap (log 15-23)

- One `sample(n, n * sims, replace = TRUE)` laid out as a sims x n matrix by column; replicate j = row j.
- Then: one draw of the mediator on the original data with the original fits (its value unused), the replicates, and
  one more original-data draw that gives the point estimates. Each replicate refits both models on its resample and
  predicts the mediator (errors with that refit's sigma, or rbinom M(t1) then M(t0), n draws each) and the outcome on
  the **original** data.
- Percentile intervals: quantile type 7. BCa: z0 = qnorm(mean(v < mean(v))), a = sum(u^3) / (6 sum(u^2)^1.5) with
  u = mean(v) - v, levels pnorm(z0 + (z0 + zq) / (1 - a (z0 + zq))), quantile type 7 (40 of 40). p as above.
- sims = 1 is an error in R ("dim(X) must have a positive length").

### sim_slopes and Johnson-Neyman (log 29-33)

- Slope b_X + b_XW w; SE sqrt(V_XX + 2 w V_XW + w^2 V_WW); interval and p with t on df.residual for lm, **z for
  glm**; HC3 = `vcovHC(type = "HC3")`. "mean-plus-minus" = mean(W) +- sd(W) on the model's rows.
- Johnson-Neyman bounds = the roots of (b_X + b_XW w)^2 = crit^2 Var(w), crit = qt(1 - alpha/2, df.residual) **for
  glm too**. inside = (b_XW^2 - crit^2 V_WW < 0); no real root: bounds (-Inf, Inf) and failed; all_sig = no bound
  within the observed range of W (true when failed).

### ReactiveStat's procedures (from its scripts)

- Sobel: a = the treatment's coefficient in the mediator model, b = the mediator's in the outcome model, SE =
  sqrt(b^2 sa^2 + a^2 sb^2), z = ab / SE, p = 2 pnorm(-|z|).
- Coefficients' Monte Carlo (mediation): `set.seed(1234)`, NMC = 20000, `a_mc <- rnorm(NMC, a, sa)`, `bc <-
  mvrnorm(NMC, coef(out)[c(M, X)], vcov(out)[c(M, X), c(M, X)])`; indirect a_mc b_mc, direct c'_mc, total, proportion;
  type-7 quantiles.
- Moderated mediation, continuous path: `mvrnorm` of all coefficients of both models (mediator first), ACME(w) =
  dx (a1 + a3 w)(b1 + b3 w), ADE(w) = dx (c1 + c3 w), index = ACME(w_hi) - ACME(w_lo), point values from the fitted
  coefficients. Binary path: `mediate` at W = w_lo and w_hi (`covariates`), each after the same seed; index draws =
  the difference of the (d0 + d1)/2 draws.

## Choices of rStats.js

- The models are rStats.js formula fits of `lm` / `glm` with the data they were fitted on (as for `step`); the refits
  of the bootstrap use the fit's options. Other families and links are refused.
- `mvrnorm` in 3 or more dimensions: rStats.js's own symmetric eigendecomposition with a fixed sign rule; the values
  have R's distribution but not R's numbers (the user's decision 2026-11-25: matching every sign would mean porting
  LAPACK's dstemr). So `moderatedMediation` with a continuous path agrees with R statistically only.
- The draws are returned (as R's `*.sims`); printing is not offered.
- A linear outcome's effects are means of (row difference) x b, so a draw whose conditions agree gives exactly 0. R's
  differences of predictions leave residues of about 1e-17 of either sign (its BLAS products), and its p-value counts
  them: rStats.js's p may differ by 2 / sims per such draw (log 39).
- Rounding at p = 0.5: R's rbinom turns its computation around there, so a mediator probability of 0.5 +- 1e-16 (a
  probit or logit intercept that is 0 in theory) gives different draws from rStats.js's when the two round to
  different sides (log 40, 49): small binary data sets often have resamples with exactly half of a group at 1.
- A bootstrap refit with an inestimable coefficient (aliased, or a level the resample lost) predicts with it as 0,
  with R's warning 'prediction from rank-deficient fit; attr(*, "non-estim") has doubtful cases' (log 48).

## To check

- The fixture's tolerance: the symmetric square root through rStats.js's eigen (rounding only), rbinom with a
  probability per draw.
- Edge cases: scales, common values, perfect separation in a binomial mediator, ties at 0 in the p-value, all draws of
  one sign (p = 0), proportions with tau near 0, sims limits and speed, robustSE with leverage 1.
