# Multinomial logistic regression: multinom and its methods (draft, 1.14.0)

Reference basis: the documentation of nnet 7.3-21 (`multinom`, `predict.multinom`, `summary.multinom`,
`confint.multinom`, `anova.multinom`) and of base R's `max.col`; Agresti (2013), "Categorical Data Analysis", 3rd ed.,
section 8.1 (baseline-category logits). R 4.6.2 public-call results (x86_64) in `experiments/multinom114.R` and
`experiments/multinom114-ties.R`, recorded on Issue #564. No R or package source was consulted.

The call followed is ReactiveStat's (`scripts/多変量/multivar/logisticRegression.js`): `multinom(y ~ ..., data,
trace = FALSE, Hess = TRUE)`, `summary(model, Wald = TRUE)`, `exp(coef(model))`, `exp(confint(model))`, the Wald p-values
`2 (1 - pnorm(|coef / se|))`, McFadden's and Nagelkerke's R² from `multinom(y ~ 1)`, `predict(model, type = "class")`.

Data of `multinom114`: n = 150, x1 continuous, x2 binary, f a 3-level factor, y with levels A, B, C from a multinomial
logit; case weights in (0.5, 2).

## Settled

- **The model.** Baseline-category logits with the first level of the response as the reference: `coef` is a
  (K − 1) × p matrix (rows the other levels, columns the model matrix with its intercept). A two-level response gives
  the binomial glm (1e-8, R's tolerance) and a coefficient vector.
- **R's stopping.** The default BFGS (`maxit = 100`, `abstol = 1e-4`, `reltol = 1e-8`) stops 6.2e-5 from the
  maximum; with `maxit = 10000, reltol = 1e-16, abstol = 1e-300` R comes within 5.5e-8 (its optimiser's limit). The
  maximised log-likelihood agrees to 17 digits. rStats.js solves the score equations exactly (Choices of the scope).
- `value` is the minimised objective: −log-likelihood plus the penalty; `deviance` = 2 `value`, `AIC` = deviance + 2 edf,
  `edf` = the number of coefficients (K − 1) p, `logLik` = −value with `df` = edf.
- **Hess = TRUE** stores the Hessian of −log-likelihood (analytic: Σ w_i (diag(π_i) − π_i π_i') ⊗ x_i x_i'), with
  row and column names `B:(Intercept)`, `B:x1`, ... (category-major). `vcov` is its inverse, the standard errors the
  square roots of its diagonal (2e-9), `Wald.ratios` = coef / se.
- **confint** is the Wald interval coef ± qnorm((1 + level)/2) se, as an array [coefficient, (lower, upper), category].
- **weights** multiply each unit's log-likelihood (non-integer weights accepted); the Hessian likewise.
- **decay** adds decay × the sum of squares of all coefficients, intercepts included, to the objective. `deviance` and
  `AIC` include the penalty (deviance = 2 value); the Hessian (and so the standard errors) is that of −log-likelihood
  alone, without the 2 decay on its diagonal.
- **anova(m1, m2, ...)** orders the models by their residual df (the call order does not matter): columns `Model` (the
  right-hand side of the formula, "1" for the null), `Resid. df` = n (K − 1) − edf, `Resid. Dev`, `Test` ("1 vs 2"),
  `   Df`, `LR stat.` (the difference of deviances) and `Pr(Chi)` (upper tail of chi-squared).
- **predict.** `type = "probs"` the fitted probabilities (one row per unit, one column per level; a vector for two
  levels); `type = "class"` the most probable level, ties broken as `max.col`: entries within 1e-5 of the row's
  largest entry (relative) are tied, and scanning the row, the k-th tied entry replaces the current choice when
  k u < 1 (u = runif(1), one draw per tie after the first). All 9 cases of `multinom114-ties` reproduced from the
  same seed.
- **Inputs.** A numeric response is made a factor; an unused level of a factor response is dropped with the warning
  "group ‘D’ is empty"; a single level is an error ("need two or more classes to fit a multinom model"); rows with
  missing values are dropped (n = 148 of 150).
- **Separation** (`separation`): R stops at `maxit` (`convergence = 1`) with coefficients near −20; the maximum does not
  exist.

## Open

1. The pseudo R² are not in nnet: computed as ReactiveStat does, from the null model `multinom(y ~ 1)`: McFadden
   1 − logLik/logLik0, Cox-Snell 1 − exp(2/n (logLik0 − logLik)), Nagelkerke Cox-Snell / (1 − exp(2/n logLik0)), n the
   number of rows (also with weights, as ReactiveStat's `nrow(data)`).
