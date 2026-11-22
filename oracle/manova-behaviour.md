# Multivariate analysis of variance

Issue #549. Reference R 4.6.2 stats::manova / summary.manova. Evidence: Pillai (1955); Wilks (1932); Hotelling (1951); Roy (1953); Rao (1951); public outputs and independent matrix/F calculations in `experiments/multivariate19-stage1-manova.R`; complete cases in `experiments/multivariate19.R`. No R source or fit internals were inspected.

## SSP matrices and roots

For each sequential term, H is its hypothesis SSP increment and E is residual SSP. Generalized roots are the nonzero eigenvalues of `E⁻¹H`, λ₁,…,λ_s; p is response dimension, q is term rank (term df), v is residual df and s=min(p,q). Statistics:
`V=Σ λ/(1+λ)` (Pillai);
`Λ=Π 1/(1+λ)` (Wilks);
`U=Σ λ` (Hotelling–Lawley);
`Θ=max λ` (Roy).

## F approximations

Let `m=(|p−q|−1)/2`, `n₀=(v−p−1)/2`.
Pillai: `df1=s(2m+s+1)`, `df2=s(2n₀+s+1)`, `F=[(2n₀+s+1)/(2m+s+1)]·V/(s−V)`.
Wilks (Rao): `t=sqrt((p²q²−4)/(p²+q²−5))` (when pq>2; otherwise t=1), `u=(pq−2)/4), `df1=pq`, `df2=[v−(p−q+1)/2]t−2u`, `F=[(1−Λ^(1/t))/Λ^(1/t)]·df2/df1`.
Hotelling–Lawley: `df1=s(2m+s+1)`, `df2=2(sn₀+1)`, `F=[df2/(df1·s)]·U`.
Roy upper bound: `df1=max(p,q)`, `df2=v−max(p,q)+q`, `F=(df2/df1)·Θ`. Roy is an upper-bound approximation, not the exact omnibus distribution when multiple roots contribute.

## Numerical verification

The independent calculation builds the sequential model matrix, residual SSP, term-increment H, generalized roots and all four F/df/p rows; it also compares every SSP matrix and eigenvalue. Verified cases: `manova_iris`, `manova_iris_intercept`, `manova_two_factors`, `manova_two_factors_reversed`, `manova_interaction`, `manova_covariate`, `manova_two_responses_two_groups`, `manova_p_gt_df`, `manova_na`, `manova_tol`, `manova_scale`, `manova_npk`. All reported term rows and all four test columns were compared. Iris baseline: F max abs error 4.24e−12, df error 0, p max abs error 5.30e−64, SSP max abs error 9.67e−13, eigenvalue max abs error 3.56e−14. With intercept, intercept-row F error ≤9.94e−8 (large SSP); Species row ≤4.24e−12. `manova_one_response`, `manova_few_df`, and `manova_collinear` preserve the observed errors.

## R-observed contract

Terms are Type I sequential in formula order; reversing terms changes rows. `intercept=TRUE` adds an (Intercept) row. Output includes four test tables, SSP matrices, eigenvalues and coefficients. One response errors `need multiple responses`; insufficient residual rank and collinear responses error. NA rows follow model-frame omission; `tol` controls numerical rank.

## Decisions for the user

1. Implement all four statistics and F approximations above, including Roy upper bound; label Roy accordingly.
2. Keep Type I sequential ordering and optional intercept row.
3. Reject residual SSP rank below response dimension and expose tol.

## rStats.js's choices

(empty — reserved for user decisions)
