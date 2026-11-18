# Ordinal regression: reference behaviour

Issue: #540  
Base: `35cb10c52cf9722e81a071119e740fd59a28b045` (main)  
Working branch: `work/regression` at `1ead80e7f3a3b178ed84b203619f2c5c5f158fd4`  
Reference: R 4.6.2, MASS 7.3-66  
Stage: 1 (behaviour specification and oracle only)

## Evidence and clean-room boundary

This specification is based on:

- the public MASS 7.3-66 help for ordered logistic or probit regression, including its documented arguments, returned quantities, link definitions, and references;
- McCullagh (1980), *Regression Models for Ordinal Data*;
- Agresti (2002), *Categorical Data Analysis*, 2nd ed.;
- Venables and Ripley (2002), *Modern Applied Statistics with S*, 4th ed.;
- the public-function outputs in `experiments/regression-polr.R` and `experiments/regression-polr.json` on the pinned work branch.

No MASS or R source was read, recalled, or used. No fit internals, function objects, or closures were inspected. The experiment uses documented/public functions and the documented `zeta` component only. The web search results unexpectedly displayed an excerpt of the GPL-licensed MASS implementation; it was not read for this specification, was not used as evidence, and is explicitly excluded from the source set.

MASS help is documentation, not implementation evidence. The reference manual identifies MASS 7.3-66 as GPL-2/GPL-3 and documents the model independently of its source.

## 1. Scope and notation

The model is a cumulative-link regression for an ordered response with $K\geq3$ observed or declared categories. The five reference links are:

- `logistic`: standard logistic cumulative distribution function;
- `probit`: standard normal cumulative distribution function;
- `cloglog`: complementary log-log link;
- `loglog`: log-log (negative log-log) link;
- `cauchit`: standard Cauchy cumulative distribution function.

Let $Y_i\in\{1,\ldots,K\}$, let $x_i$ be the predictor row, let $\beta$ be the slope vector, and let $o_i$ be an optional offset. There are $K-1$ ordered cut-points

$$
-\infty=\zeta_0<\zeta_1<\cdots<\zeta_{K-1}<\zeta_K=+\infty.
$$

The linear predictor has no separately estimated intercept:

$$
\eta_i=x_i^\mathsf T\beta+o_i.
$$

For the selected cumulative distribution function (F),

$$
P(Y_i\leq j\mid x_i)=F(\zeta_j-\eta_i),\qquad j=1,\ldots,K-1.
$$

Consequently the category probabilities are

$$
p_{i1}=F(\zeta_1-\eta_i),
$$

$$
p_{ij}=F(\zeta_j-\eta_i)-F(\zeta_{j-1}-\eta_i),
quad j=2,\ldots,K-1,
$$

$$
p_{iK}=1-F(\zeta_{K-1}-\eta_i).
$$

For case weights $w_i\geq0$, the log likelihood is

$$
\ell(\beta,\zeta)=\sum_i w_i\log p_{i,Y_i}.
$$

The fit maximizes this likelihood over the slopes and strictly ordered cut-points. The deviance is $-2\ell$, up to the likelihood's parameter-independent convention. A positive slope increases $\eta_i$, decreases the cumulative probabilities $P(Y_i\leq j)$, and shifts probability toward higher response categories. This sign convention is important: some software uses the opposite sign.

The link functions are monotone and map cumulative probabilities to the real line. For the extreme-value links,

$$
F^{-1}_{\mathrm{loglog}}(p)=-\log[-\log(p)],
\qquad
F^{-1}_{\mathrm{cloglog}}(p)=\log[-\log(1-p)].
$$

The cloglog model has the grouped-time proportional-hazards interpretation when categories are ordered by increasing event time. The cauchit model uses a Cauchy latent error distribution.

## 2. Parameters, likelihood, and covariance

The free parameter vector consists of all slope coefficients followed by all $K-1$ cut-points. The cut-points are not a conventional intercept: there is one threshold for every boundary between adjacent response categories.

The observed information is the negative Hessian of the log likelihood at the maximum-likelihood estimate. The asymptotic covariance matrix is its inverse,

$$
\widehat{\operatorname{Var}}(\widehat\theta)
=\left[-\frac{\partial^2\ell(\theta)}
{\partial\theta\,\partial\theta^\mathsf T}
\bigg|_{\widehat\theta}\right]^{-1},
\qquad
\theta=(\beta^\mathsf T,\zeta^\mathsf T)^\mathsf T.
$$

This is the observed-information approximation. MASS help explicitly cautions that the Hessian is a numerical approximation and that the model-matrix columns should be sensibly scaled, with ranges of order one, for reliable covariance estimates.

The R experiment confirms that `vcov` includes both slope coefficients and cut-points. The returned `summary` coefficient table likewise includes both sets of parameters, in slope-then-cut-point order. Its columns are `Value`, `Std. Error`, and `t value`; the last is estimate divided by its standard error. The observed table has no p-value column.

For the `housing` logistic fit (1,681 effective observations, six slopes, three response levels), the experiment reports eight estimated parameters and an $8\times8$ covariance matrix. The six slope rows are named `InflMedium`, `InflHigh`, `TypeApartment`, `TypeAtrium`, `TypeTerrace`, and `ContHigh`; the cut-points are `Low|Medium` and `Medium|High`.

The effective parameter count is $p+(K-1)$, where $p$ is the design-matrix rank after aliased columns are removed. The observed `edf` agrees with this count. The observed `n` and `nobs` are effective weighted sample sizes; a zero-weight row does not contribute. The residual degrees of freedom are based on the effective sample size less the effective parameter count.

## 3. Defaults and fitting controls

The public help documents the following defaults and controls:

- response: a factor, preferably ordered; its factor-level order defines the ordinal order;
- formula: response on the left, predictors on the right;
- intercept: required by the model; the cut-points supply the category-specific locations;
- weights: case weights, defaulting to one;
- start: optional initial values, ordered as all slopes followed by all cut-points;
- method: `"logistic"` by default; also `"probit"`, `"loglog"`, `"cloglog"`, and `"cauchit"`;
- offset: an optional additive term in the linear predictor;
- contrasts: optional factor contrasts;
- `Hess`: false by default; request the observed Hessian at fitting time when covariance/summary quantities are needed;
- `model`: true by default;
- additional fitting controls: passed through to the general-purpose optimizer.

The public experiment establishes that an ordinary factor response is accepted as well as an ordered factor, and that a two-level response is rejected with an error requiring at least three levels. A numeric response is rejected. An intercept-only model is supported. An offset is included in the reported linear predictor. Missing rows are omitted; zero-weight rows are excluded from the effective sample size.

The default housing fits for logistic, probit, loglog, and cloglog converge with optimizer convergence code zero. The five link functions are all in the requested scope. The housing cauchit fit fails with the default initialization, with warnings about the initial binomial fit not converging and fitted probabilities numerically equal to zero or one. Supplying an explicit start derived from the logistic fit allows that cauchit fit to converge. This is a reference-starting-value failure, not evidence that the cauchit likelihood is undefined.

The fit reports the optimizer convergence code and function/gradient evaluation counts. These are diagnostic outputs, not a promise that different optimizers or platforms will take the same path or number of evaluations.

## 4. Fitted values and prediction

For every retained observation, fitted values are the $K$ category probabilities

$$
(\widehat p_{i1},\ldots,\widehat p_{iK}),
\qquad \sum_{j=1}^{K}\widehat p_{ij}=1.
$$

The probability columns follow the response-level order. The linear predictor includes the offset. The R experiment records the full fitted-probability matrix, including row and column names.

The public prediction interface supports:

- `type = "probs"`: one probability per response category, in factor-level order;
- `type = "class"`: the predicted category, corresponding to the largest fitted category probability;
- `newdata`: predictors and any offset expression evaluated for new rows.

The pinned experiment verifies both prediction types on new data for the housing and mtcars examples. The predicted classes for the four selected housing profiles are `Low`, `Low`, `High`, and `High`; the full probability matrix is recorded in the JSON output.

Further experiments establish that an unseen factor level is an error naming that level, missing predictor values produce missing prediction rows, and a missing predictor column is an error naming the absent object. A one-row `newdata` call returns a category-named probability vector; the default prediction type is `"class"`. Offsets are evaluated from the new data when the formula contains an offset.

## 5. Confidence intervals

### Wald intervals

For a parameter $\theta_j$ with standard error $s_j$, the two-sided Wald interval at confidence level $1-\alpha$ is

$$
\widehat\theta_j\pm z_{1-\alpha/2}s_j.
$$

The R oracle calls `confint.default` to record these intervals. The observed output contains rows for the slope coefficients, not for the cut-points. This is distinct from `vcov` and `summary`, both of which include cut-points.

### Profile-likelihood intervals

For a slope coefficient $\beta_j$, let $\lambda$ denote all other free parameters, including the cut-points. Its profile log likelihood is

$$
\ell_{p,j}(b)=\max_{\lambda}\ell(\beta_j=b,\lambda).
$$

The likelihood-ratio confidence limits solve

$$
2\{\ell(\widehat\theta)-\ell_{p,j}(b)\}
=\chi^2_{1,1-\alpha}.
$$

Equivalently, the signed likelihood-root coordinate is

$$
r_j(b)=\operatorname{sign}(b-\widehat\beta_j)
\sqrt{2\{\ell(\widehat\theta)-\ell_{p,j}(b)\}},
$$

and the endpoints solve $r_j(b)=\pm z_{1-\alpha/2}$. This defines the statistical target; it does not prescribe MASS's profile grid, interpolation, or root-finding implementation.

For the pinned MASS output, `confint` returns profile-likelihood limits for the slope coefficients. The observed housing output has columns `2.5 %` and `97.5 %`; the 90% call has `5 %` and `95 %`. The call emits the message `Waiting for profiling to be done...`. The observed near-separation case also returns a finite profile interval for its slope.

The further experiments show that profile intervals are available for slope coefficients (including one-slope models and non-default confidence levels), but requesting a cut-point interval fails with `non-finite value supplied by optim`. An intercept-only model returns no slope intervals. The profile table is available for slope parameters. Wald intervals likewise cover slopes, not cut-points.

## 6. Likelihood-ratio model comparisons

For nested fits to the same response and observations, the likelihood-ratio statistic comparing a smaller model $M_0$ with a larger model $M_1$ is

$$
G^2=2\{\ell(M_1)-\ell(M_0)\}
=D(M_0)-D(M_1).
$$

Under the usual regularity conditions, the reference comparison uses a chi-squared distribution with degrees of freedom equal to the difference in effective parameter counts. The oracle records the sequential comparison table from `anova`, including model labels, residual degrees of freedom, residual deviances, the compared-model labels, degrees of freedom, likelihood-ratio statistics, and chi-squared p-values.

For the three nested housing models, the observed likelihood-ratio statistics are 64.266213134375 (4 df) and 22.5093471174891 (6 df), with p-values $3.67261776546002\times10^{-13}$ and 0.00097861794234444. The test is a likelihood-ratio comparison, not a Wald test of individual coefficients.

Further experiments show that the reference `anova` compares non-nested fits without rejecting them: the tested `Infl` versus `Type` comparison reports a negative likelihood-ratio statistic (-51.3869961994405) and p = 1. Reversing the order of a nested pair gives the expected positive statistic. Identical fits give zero degrees of freedom, statistic zero, and p = 1. Fits with different analysis-row counts or different response variables fail with `models were not all fitted to the same size of dataset`. Fits with different links can be compared. Equal residual degrees of freedom do not establish nesting: the `mpg` versus `wt` example reports zero df but a positive statistic and p = 0. The rStats.js choice is to reject non-nested fits rather than reproduce these questionable comparisons.

## 7. Warnings, errors, and boundaries

The pinned public-function experiment establishes the following behaviours:

- **Two response levels:** fitting fails with `response must have 3 or more levels`.
- **Numeric response:** fitting fails with `response must be a factor`.
- **Unordered factor response:** accepted; factor-level order is used.
- **Unused response level / empty category:** further experiments confirm that unused declared response levels and categories with zero total frequency are accepted by MASS. The returned cut-points can be nearly coincident for an empty middle category (for example, `3|3.5` and `3.5|4`), or very large for an empty top category (for example, `4|5` at about 25.45); zero-frequency middle and top categories also produce finite but non-identifiable threshold estimates. These are not valid finite MLEs for the declared full response support. rStats.js deliberately differs: any response level with no positive-weight observations is an error naming that level.
- **Complete separation:** the constructed perfectly ordered response fails during starting-value construction, with warnings that the preliminary binomial fit did not converge and fitted probabilities numerically equal zero or one.
- **Near separation:** the constructed case converges to finite estimates, with large standard errors; its slope profile interval is finite in the recorded run. This does not establish reliable inference arbitrarily close to separation.
- **Rank-deficient design:** aliased columns are dropped and a warning reports that the design is rank deficient. In the tested duplicate-column case, one slope remains.
- **Missing rows:** rows with missing predictor values are omitted.
- **Weights:** a zero-weight row is excluded from the effective sample size and likelihood. `NA` weights are omitted with their rows; fractional weights are accepted (with the warning `non-integer #successes in a binomial glm!`); doubling every weight doubles the deviance and effective sample size while leaving the fitted estimates nearly unchanged. A negative weight fails with `Value -inf out of range (0, 1)`, an infinite weight with `missing value where TRUE/FALSE needed`, all-zero weights with `object 'fit' not found` after warnings about no informative observations and non-convergence, and a wrong-length weight vector with `variable lengths differ (found for '(weights)')`. These reference errors are not adopted as API design.
- **Poor predictor scaling:** multiplying a predictor by $10^8$ in the tested example fails with `infinite or missing values in 'x'`. This is consistent with the documented warning that the numerical Hessian needs sensibly scaled model-matrix columns.
- **Cauchit initialization:** the default housing initialization fails as described above; a supplied start converges.
- **Invalid link:** an unsupported method is rejected with an error listing the five supported link names.

An intercept-only fit is supported and has no slope coefficients; its parameters are the cut-points. The two-level case is not silently treated as binary logistic regression.

The further experiments establish that explicitly removing the formula intercept (`-1` or `0 +`) emits `an intercept is needed and assumed`. For a numeric predictor, the fitted coefficients, cut-points, and deviance match the intercept model. With factor predictors, the intercept is restored but the resulting design can be rank deficient and trigger the usual aliased-column warning. Prediction with an unseen factor level errors; missing values yield missing rows; a missing predictor column errors. Invalid weights produce the errors listed above. MASS accepts empty response categories, but rStats.js rejects them by choice. `vcov` and `summary` called after a fit made without a Hessian emit a `Re-fitting to get Hessian` message and return values close to, but not bit-identical to, those from a fit with `Hess = TRUE`.

## 8. Oracle coverage and unresolved reference behaviour

The two experiment batches cover all five links on the weighted `housing` example, including the default cauchit failure and a successful cauchit start; unweighted ordered-factor models on `mtcars`; intercept-only and offset models; user-supplied starts; class and probability prediction on training and new data; unseen and missing factor values and missing predictor columns; profile and Wald intervals at several confidence levels; slope and cut-point profile requests; the Hessian re-fit path; nested, reversed, identical, non-nested, different-link, different-row, and different-response model comparisons; two-level, unordered-factor, numeric-response, and unused-level cases; complete and near separation; rank deficiency; missing rows; several weight edge cases; zero-frequency categories; and badly scaled predictors.

Remaining limits of the current oracle coverage:

1. The exact numerical behaviour for extreme predictor scales, extremely large category counts, and other pathological designs has not been exhaustively mapped.
2. The failure modes for a slope profile that cannot reach its likelihood-ratio cutoff have not been characterized beyond the finite near-separation and outlier examples.
3. The precise policy for missing or non-finite predictor and offset values beyond ordinary row omission and prediction-row propagation has not been exhaustively probed.
4. `anova` behaviour for every possible mismatch in factor coding, weights, offsets, and model terms is not fully characterized; rStats.js will enforce the narrower nested/same-response/same-row contract recorded in the choices.

No additional experiments are required before writing the first oracle script. These remaining items are coverage limits, not blockers for the chosen rStats.js contract.

## Decisions for the user

1. **Input and factor levels.** Recommendation: use the existing formula-string plus column-oriented data-frame API. Require the response column to be categorical; accept an optional `levels` option (consistent with the existing model-frame API) to set its order explicitly. Preserve all declared levels initially, but decide explicitly whether unused response levels are rejected or retained. Do not silently coerce numeric responses to categories.
2. **Two-level response.** Recommendation: keep `polr` as an ordinal model with at least three response levels, matching the observed MASS error. Binary logistic regression remains `glm`.
3. **Fit result.** Recommendation: return named `coefficients` and named `zeta` separately, plus `fittedValues`, `linearPredictors`, `deviance`, `logLik`, `aic`, `bic`, `edf`, `nobs`, `converged`, `convergence`, and `warnings`. Keep the slope and threshold parameter namespaces distinct; do not manufacture a conventional intercept coefficient.
4. **Hessian and covariance.** Recommendation: always compute and retain the observed information needed by `polrSummary` and `polrVcov`, rather than requiring callers to remember a separate `Hess: true` flag. Export `polrSummary` and `polrVcov` as explicit helpers. Return the complete covariance matrix in slope-then-cut-point order.
5. **Summary table.** Recommendation: reproduce the three observed columns (`Value`, `Std. Error`, `t value`) for slopes and cut-points. Do not add p-values unless a separate inferential convention is chosen; MASS's observed summary has no p-value column.
6. **Prediction.** Recommendation: export `polrPredict`, default to class predictions, and support `type: "class" | "probs"`. Return probabilities with category names and preserve response-level order. Define unseen-level and missing-value behaviour explicitly after the additional oracle probes.
7. **Confidence intervals.** Recommendation: export `polrConfint`; make profile likelihood the default and provide a separate Wald option. Initially return slope intervals only, matching the observed `confint` and `confint.default` outputs, while documenting that cut-points are estimated and included in `summary`/`vcov`. Preserve an unavailable endpoint as `NaN` with a warning rather than inventing a finite endpoint.
8. **Model comparisons.** Recommendation: export `polrAnova` for two or more nested fits with identical response coding and analysis rows. Return the complete comparison table and use the likelihood-ratio chi-squared test. Reject incomparable fits.
9. **Optimization controls.** Recommendation: expose a small typed options object (`method`, `weights`, `offset`, `start`, `contrasts`, `maxit`, `reltol` or equivalent) instead of an untyped optimizer argument bag. Choose deterministic, scale-aware initialization and convergence checks; do not reproduce MASS's preliminary starting-value path. The exact defaults and failure policy need a decision after the additional experiments.
10. **Warnings and rank deficiency.** Recommendation: retain distinct warnings in first-occurrence order. Drop aliased columns only if the retained design remains identifiable, and report which terms were dropped. Fail explicitly for complete separation or a non-finite/indefinite information matrix; do not return plausible-looking standard errors from an invalid Hessian.
11. **Names.** Recommendation: use R-compatible model-matrix column names for slopes and boundary labels such as `Low|Medium` for cut-points. Keep thresholds in a separate `zeta` object to avoid collisions with predictor names.

## rStats.js's choices

Decided by the user on 2026-11-19 (all eleven recommendations above, and one more point from the further experiments
in `experiments/regression-polr-2.R` and `.json` on `work/regression`):

1. **Input and factor levels:** the formula string and the data, as `glm`. The response must be categorical (strings
   or booleans in the data); a `levels` option gives its order, otherwise the order is that of the existing
   model-frame API. A numeric response is an error, as in R. **A response level with no observations, or with only
   zero weights, is an error that names the level** (a known difference from R: R fits and returns finite but
   meaningless cut-points and standard errors where no maximum-likelihood estimate exists, as in `empty_top_level`,
   `empty_middle_level` and `zero_frequency_middle_category` of the further experiments)
2. **Two-level response:** an error, as R (`response must have 3 or more levels`); binary responses belong to `glm`
3. **Fit result:** named `coefficients` and named `zeta` kept separate, with the fitted probabilities, the linear
   predictors, `deviance`, `logLik`, `aic`, `bic`, `edf`, `nobs`, the convergence and `warnings`. No intercept
   coefficient
4. **Hessian:** always computed and kept (there is no `Hess` option). `polrSummary` and `polrVcov` are exported; the
   covariance matrix is in slope-then-cut-point order
5. **Summary:** the three columns `Value`, `Std. Error` and `t value` for slopes and cut-points, no p-values
6. **Prediction:** `polrPredict`, `type: "class" | "probs"`, `"class"` by default as R. The behaviour for unseen
   levels and missing values follows the further experiments (R: an error naming the new level; a missing predictor
   gives a missing row)
7. **Intervals:** `polrConfint`, profile likelihood by default and Wald as an option, for the slopes only (as R). An
   endpoint that cannot be found is `NaN` with a warning
8. **Model comparison:** `polrAnova` for two or more nested fits to the same response and rows, likelihood-ratio
   chi-squared tests. Fits that are not nested are rejected (a known difference: R compares them and reports a
   negative statistic with p = 1, `anova_not_nested`)
9. **Optimisation:** a small typed set of options (`method`, `weights`, `offset`, `start`, `contrasts`, `maxit`,
   `reltol` or similar). The initial values are deterministic and robust to the scale; R's preliminary
   starting-value path is not reproduced, so rStats.js may fit where R's start fails (housing with `cauchit`)
10. **Warnings and rank deficiency:** distinct warnings in first-occurrence order; aliased columns dropped with a
    warning naming them; complete separation and a non-finite or indefinite information matrix are errors
11. **Names:** R's model-matrix names for the slopes and R's `Low|Medium` labels for the cut-points, in `zeta`
