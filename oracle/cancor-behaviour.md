# Canonical correlation analysis

Issue #549. Reference R 4.6.2 stats::cancor. Evidence: Hotelling (1936); Mardia, Kent & Bibby, Multivariate Analysis; public outputs and independent calculations in `experiments/multivariate19-stage1-lda-cancor.R`; complete public-call cases in `experiments/multivariate19.R`. No R source or fit internals were inspected.

## Definition and normalization

For centered/user-centered Xc,Yc, define Sxx=Xc'Xc, Syy=Yc'Yc, Sxy=Xc'Yc. Canonical correlations are nonzero singular values of `Sxx^(−1/2) Sxy Syy^(−1/2)` on retained column spaces, equivalently square roots of nonzero eigenvalues of `Sxx⁻¹ Sxy Syy⁻¹ Syx`. Coefficients a_j,b_j satisfy `a_j'Sxx a_j=1`, `b_j'Syy b_j=1`; paired signs make the sample canonical correlation nonnegative. Each pair retains simultaneous sign indeterminacy: (a,b) and (−a,−b) represent the same canonical variates.

## Centers

TRUE subtracts column means; FALSE uses zero centers; numeric vectors specify explicit centers. Returned centers are those used. Vector inputs are one-column matrices.

## Numerical verification

All 10 cases compared: `cancor_lifecycle`, `cancor_lifecycle_nocenter`, `cancor_lifecycle_given_center`, `cancor_iris`, `cancor_one_x`, `cancor_more_x_than_y`, `cancor_collinear`, `cancor_n_small`, `cancor_scale`, `cancor_vectors`. Correlation max absolute difference ≤2.2e−15. After simultaneous pairwise sign alignment, all xcoef/ycoef entries differ by ≤1.53e−14 (ordinary cases ≤3.3e−15); both coefficient metric products are identity to floating-point precision. Centers were also compared. In n-small, sample correlations can equal 1; collinear columns reduce coefficient rows while centers retain original columns. `cancor_na` errors with `NA/NaN/Inf in foreign function call (arg 1)`.

## Decisions for the user

1. Default both centers TRUE; accept FALSE or finite vectors of matching dimensions.
2. Use rank-revealing decomposition; return only nonzero pairs while preserving original names and centers.
3. Normalize with unscaled cross-products, not covariance matrices divided by n−1; this convention matches R coefficient entries.
4. Treat signs as an equivalence class: a pair may differ by simultaneous sign reversal; do not promise a universal deterministic rule reproducing R internals.

## rStats.js's choices

(empty — reserved for user decisions)
