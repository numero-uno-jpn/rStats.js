# Generalized estimating equations: reference behaviour

Issue: #545  
Base: `d41e20295c6fed3031bc7eb59c0cc76be2f7160b` (`work/regression-1.8`)  
Reference: R 4.6.2, geepack 1.3.13  
Stage: 1 (behaviour specification and oracle only)

## Evidence and clean-room boundary

This specification is based on Liang and Zeger (1986), Prentice (1988), Halekoh, Højsgaard and Yan (2006), Pan (2001), the public geepack 1.3.13 reference manual, and the public-function outputs in `experiments/regression18-gee.R` and `.json`. No geepack or R source, implementation excerpt, function body, or fit closure was read or used. The current CRAN reference manual identifies geepack 1.3.13 and documents the supported correlation and variance options.

## 1. Marginal mean model and estimating equations

For cluster $i$ with $m_i$ observations, let $Y_i$ be the response vector and $X_i$ the model matrix. The marginal mean is

$$
\mu_i=E(Y_i\mid X_i),\qquad
g(\mu_{ij})=x_{ij}^{\mathsf T}\beta+o_{ij},
$$

where $g$ is the selected GLM link and $o_{ij}$ is an optional offset. The supported families are Gaussian, binomial, Poisson, and Gamma, with links already supported by the rStats.js GLM family layer.

The generalized estimating equation is

$$
\sum_i D_i^{\mathsf T}V_i^{-1}(Y_i-\mu_i)=0,
\qquad D_i=\frac{\partial\mu_i}{\partial\beta^{\mathsf T}},
$$

with working covariance

$$
V_i=\phi A_i^{1/2}R_i(\alpha)A_i^{1/2}.
$$

$A_i$ contains the marginal variance functions and $R_i(\alpha)$ is the chosen working correlation. The mean parameter estimate is consistent under the usual GEE conditions even if the working correlation is misspecified; efficiency can depend on that choice. The method is marginal, not a subject-specific random-effects model.

The default working correlation is independence. The reference supports independence, exchangeable, AR(1), unstructured, user-defined, and fixed structures. Exchangeable uses one common within-cluster correlation; AR(1) depends on wave distance; unstructured estimates pair-specific correlations; user-defined and fixed structures use the supplied correlation design vector `zcor`. `waves` labels within-cluster measurement order and is especially important for AR(1), gaps, and missing waves.

## 2. Cluster layout, scale, and convergence

The `id` vector identifies clusters and must have one entry per observation. The reference requires rows from each cluster to be contiguous; it warns when this is not satisfied and can interpret the clusters incorrectly. Observations should therefore be sorted by cluster and, where relevant, by wave. Singleton clusters are valid for ordinary structures but do not contribute pairwise entries to a supplied `zcor`. For fixed structures, the manual requires a correlation vector when cluster sizes are unequal and excludes singleton clusters from that vector.

The scale parameter $\phi$ is estimated unless `scale.fix = TRUE`, in which case `scale.value` is the fixed value. The reference default is `scale.fix = FALSE`, `scale.value = 1`. The default iteration control uses a maximum of 25 Fisher-scoring iterations and convergence tolerance $10^{-4}$; convergence is based on the absolute change in parameter estimates. This tolerance is comparatively coarse. The oracle therefore records a tight refit using a smaller tolerance and a larger iteration limit; the tighter estimate is the primary numerical comparison, while the ordinary fit characterizes reference defaults.

The public help states that geeglm operates on complete data. Missing rows must be removed explicitly before fitting (or rejected by the calling layer); silent partial-cluster deletion is not a safe default. The oracle records the reference behaviour for unsorted ids and missing values.

## 3. Variance estimators and summary

The default `std.err = "san.se"` is the robust empirical sandwich covariance. In schematic form, with bread $B=(\sum_iD_i^\mathsf TV_i^{-1}D_i)^{-1}$ and cluster score $U_i=D_i^\mathsf TV_i^{-1}(Y_i-\mu_i)$,

$$
\widehat{\operatorname{Var}}(\widehat\beta)
=B\left(\sum_iU_iU_i^\mathsf T\right)B.
$$

The other requested choices are cluster jackknife estimates:

- `jack`: approximate jackknife variance;
- `j1s`: one-step jackknife variance;
- `fij`: fully iterated jackknife variance.

All three delete one cluster at a time in their inferential target, but differ in how the deleted-cluster estimates are obtained: approximate linearized update, one-step update, or a full refit for each deletion. The manual names these three methods but does not give a complete algorithmic specification sufficient to reproduce every finite-sample detail. The oracle records their standard errors on the same fixed data.

The summary coefficient table contains the estimate, standard error, Wald statistic, and two-sided Wald p-value. The summary also reports working-correlation parameter estimates and their standard errors, and the scale estimate and its standard error. `vcov` returns the coefficient covariance matrix. The public oracle captures all rows and columns rather than selected coefficients.

## 4. Model comparison and QIC

The single-fit `anova` method reports sequential Wald chi-square tests for model terms. The multi-fit method compares fitted models and is intended for compatible nested mean models fitted to the same clustered observations. The reference experiment records a nested pair. Comparisons should not be treated as likelihood-ratio tests: GEE is based on estimating equations rather than a full likelihood.

The quasi-likelihood information criteria are defined for model selection in this non-likelihood setting. Pan (2001) motivates the QIC correction to the quasi-likelihood criterion. The geepack QIC method returns QIC, QICu, quasi-likelihood, CIC, the number of mean-effect parameters, and corrected QIC (QICC). Smaller values are preferred within the corresponding comparison purpose. QIC is useful for working-correlation selection; QICu is for comparing mean specifications with the same working correlation and quasi-likelihood form; CIC is proposed as a more robust alternative when comparing working correlations.

## 5. Prediction

Prediction uses the fitted marginal mean model. The default prediction scale is the linear predictor; `type = "response"` applies the inverse link and returns the marginal mean. For new observations, the new data must provide all model predictors and any offset expression. Predictions are marginal means and do not include cluster-specific random effects or conditional forecasts.

## 6. Observed warnings, errors, and boundaries

The pinned public-function output establishes:

- Independence, exchangeable, AR(1), and unstructured fits are recorded for Gaussian and binomial examples; Poisson with offset and Gamma examples are also recorded.
- Jackknife `jack`, `j1s`, and `fij` produce distinct standard errors in the recorded exchangeable binomial example.
- A fixed-scale call with `scale.fix = TRUE, scale.value = 4` returns the error `variable lengths differ (found for '(scale.value)')` in the pinned environment. This appears to be a reference defect, not a statistical requirement.
- The unsorted-id example emits the documented warning and does not represent the intended cluster ordering.
- The one-observation-per-cluster case is accepted for exchangeable correlation; the estimated working correlation is not informed by within-cluster pairs.
- The missing-response case is not accepted as an ordinary complete-data fit unless rows are removed before fitting.
- The constructed binomial separation case is included to expose convergence and finite-estimate boundaries.
- The `fixed` structure is exercised with an explicit correlation matrix converted to a `zcor` vector; a single-fit `anova` was omitted because it did not finish within the experiment time limit.
- The nested-model comparison and new-data prediction outputs are recorded.

Reference warnings and errors are observations, not normative API design. In particular, an implementation should not reproduce a software defect in fixed-scale handling.

## 7. Oracle coverage and unresolved behaviour

`oracle/gee.R` records all four standard working structures over Gaussian and binomial examples, Gamma and Poisson fits, offset and wave use, all three jackknife variants, fixed and user-defined correlations, scale fixing, weights, sequential and nested comparisons, QIC, prediction, unsorted ids, singleton clusters, missing data, and separation. Each ordinary fit is paired with a tighter-control refit for comparison.

Unresolved items:

1. The exact finite-sample formulas and computational shortcuts for `jack`, `j1s`, and `fij` are not fully specified by the manual. Confirm their observable differences and choose whether exact numerical parity is required.
2. The fixed-scale error is a reproducible reference defect in the pinned run. Determine whether it persists in a minimal example; do not encode it as desired API behaviour.
3. The complete definition and ordering of `zcor` for every combination of user-defined/fixed structures, unequal cluster sizes, and waves needs targeted examples.
4. The reference's multi-model `anova` assumptions and behaviour for incompatible clusters, weights, offsets, or non-nested models are not exhaustively mapped.
5. The exact correlation-parameter constraints, convergence diagnostics, and behaviour for singular working covariance matrices need further public-output experiments.
6. Missing-data policy and cluster sorting should be specified independently of the reference's limitations.

## Decisions for the user

1. **Jackknife compatibility.** (A) Implement the three reference variants with separate documented definitions and tests; (B) initially implement only the robust sandwich and defer jackknife variants. **Recommendation: A**, because all three are explicitly in scope; if the finite-sample details cannot be established from public documentation and output, mark any numerical differences rather than guessing.
2. **Fixed-scale reference error.** (A) Reproduce the observed error; (B) implement the documented fixed-scale estimating equations correctly and treat the reference error as a defect. **Recommendation: B.** A defect in one call path is not a statistical contract.
3. **Cluster row ordering.** (A) require contiguous sorted cluster rows and reject/warn on violations; (B) reorder internally while preserving the user's row order for returned values. **Recommendation: B**, provided the operation is stable and all model-frame vectors are permuted consistently; otherwise reject with a clear error. Do not silently fit incorrect clusters.
4. **Missing data.** (A) follow the package's complete-data requirement; (B) use the existing formula/model-frame NA policy and rebuild cluster membership after omission. **Recommendation: B** for consistency with the existing regression API, with explicit row mapping and no silent partial-cluster corruption.
5. **Fixed correlation helper exports.** (A) export equivalents of `genZcor` and `fixed2Zcor`; (B) accept a documented `zcor` vector only and defer helpers. **Recommendation: B** initially; helper utilities can be added after their shape and validation contract is settled.

## rStats.js's choices

