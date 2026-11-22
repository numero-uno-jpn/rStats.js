# Linear discriminant analysis

Issue #549. Reference R 4.6.2 / MASS 7.3.66 public functions. Evidence: Fisher (1936); Rao (1948); Venables & Ripley, Modern Applied Statistics with S; public outputs and independent calculations in `experiments/multivariate19-stage1-lda-cancor.R`; complete public-call cases in `experiments/multivariate19.R`. No MASS/R source or fit internals were inspected.

## Weighted moment model

For classes j=1,…,g, means μ_j, counts n_j and normalized prior π_j, define `μ_π=Σπ_j μ_j` and `B_π=Σπ_j(μ_j−μ_π)(μ_j−μ_π)'`. Within-class SSP is `W=Σ_jΣ_{i∈j}(x_i−μ_j)(x_i−μ_j)'`; pooled within covariance is `S_W=W/(N−g)`. Discriminant directions solve the whitened between-class problem, with singular values `svd_r²=λ_r(N−g)/(g−1)`. Retained score directions satisfy `scaling' S_W scaling=I`.

The prior changes Bπ and μπ, so it can change scaling. Prediction with an override prior changes both posterior weights and the score origin μπ.

## Sign and rank qualification

The independent experiment used a whitened weighted class-mean SVD and matched R signs for full-rank cases `lda_iris`, `lda_iris_prior`, `lda_two_classes`, `lda_three_cyl`, `lda_class_of_one`, `lda_na`, and `lda_scale`. Maximum sign-aligned scaling difference ≤3.25e−14; svd difference ≤4.27e−14. Largest-centroid-positive fails (prior case and second direction of `lda_three_cyl`). This SVD convention is a tested way to match those examples, not a universal guarantee for repeated/degenerate roots. In `lda_collinear`, individual scaling coefficients differ by up to 0.0721766 while scores agree within 1.67e−14 and metric normalization is identity to floating-point precision. A singleton class is accepted. `lda_single_variable`: scaling=1.94254180516358 and svd=10.9208288231482; differences 2.22e−16 and 1.78e−15.

## Prediction and CV

For x, plug-in posterior probabilities are proportional to `π_j exp(−½(x−μ_j)'S_W⁻¹(x−μ_j))`; the common Gaussian normalization cancels. Prediction returns maximum-posterior class, posterior matrix and discriminant scores centered at μπ. Default `method="plug-in"` is in scope; predictive/debiased are not.

CV=TRUE is leave-one-out: remove one row, refit, then predict that row. Explicit leave-one-out refits with full-data prior fixed agree: class mismatch 0, posterior max absolute difference ≤7.2e−15.

## Numerical verification and R-observed cases

All fit outputs and prediction outputs were compared for `lda_iris`, `lda_iris_formula`, `lda_iris_prior`, `lda_two_classes`, `lda_three_cyl`, `lda_class_of_one`, `lda_na`, `lda_scale`, `lda_single_variable`; CV cases `lda_iris_cv`, `lda_iris_cv_prior`, `lda_cv_two_classes`; prediction cases `lda_iris_newdata`, `lda_iris_predict_prior`, `lda_iris_dimen1`. Full-rank classes match exactly, posterior max difference ≤9.5e−15, score x ≤3.0e−14. `lda_collinear` confirms score equivalence but not elementwise scaling equivalence. `lda_empty_level` warns and drops empty level; `lda_constant_within` errors; `lda_tol` errors at deliberately large tolerance. `lda_iris_predictive` and `lda_iris_debiased` are recorded but outside required scope.

## Decisions for the user

1. Implement moment fit, plug-in predict and leave-one-out CV using Bπ.
2. Normalize retained directions by scaling' S_W scaling=I; for rank-deficient inputs compare score subspaces, not unique coefficients.
3. Permit sign-equivalent columns when no unique orientation is determined; no centroid-sign convention is justified.
4. Preserve empty-level warning, collinearity warning/rank reduction, singleton support and constant-within-class error.

## rStats.js's choices

(empty — reserved for user decisions)
