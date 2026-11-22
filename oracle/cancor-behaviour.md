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

The user's decisions of 2026-11-22 (Issue #549), written by Claude. They take precedence over every other section.

1. `xcenter` and `ycenter`: TRUE (column means, the default), FALSE (zero) or finite vectors of matching length; the
   centres used are returned.
2. A rank-revealing decomposition; only the pairs of nonzero rank are returned, with the original names and centres.
3. Coefficients normalised with the unscaled cross-products (a′ Sxx a = 1, not divided by n − 1), as R.
4. **Signs:** as lda's choice 3: a deterministic rule on each x coefficient column (largest absolute entry positive),
   with the y column taking the sign that makes the correlation positive. A pair may differ from R by a simultaneous
   sign change: a difference from R to document. Tests compare every entry after aligning each pair's sign with R's.
