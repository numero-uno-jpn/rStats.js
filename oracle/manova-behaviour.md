# Multivariate analysis of variance

Issue #549. Reference R 4.6.2 stats::manova / summary.manova. Evidence: Pillai (1955); Wilks (1932); Hotelling (1951); Roy (1953); Rao (1951); public outputs and independent matrix/F calculations in `experiments/multivariate19-stage1-manova.R`; complete cases in `experiments/multivariate19.R`. No R source or fit internals were inspected.

## SSP matrices and roots

For a sequential model term, let H be its hypothesis SSP increment and E the residual SSP. Generalized roots are the nonzero eigenvalues of `E⁻¹H`, denoted λ₁,…,λ_s; p is the response dimension, q is the term rank (term df), v is residual df, and s=min(p,q). The four statistics are
`V=Σ λ/(1+λ)` (Pillai),
`Λ=Π 1/(1+λ)` (Wilks),
`U=Σ λ` (Hotelling–Lawley), and
`Θ=max λ` (Roy).

## F approximations

Let `m=(|p−q|−1)/2`, `n₀=(v−p−1)/2`.

Pillai:
`df1=s(2m+s+1)`, `df2=s(2n₀+s+1)`,
`F=[(2n₀+s+1)/(2m+s+1)]·V/(s−V)`.

Wilks (Rao):
`t=sqrt((p²q²−4)/(p²+q²−5))` (when p q>2; otherwise t=1),
`u=(pq−2)/4`,
`df1=pq`, `df2=[v−(p−q+1)/2]t−2u`,
`F=[(1−Λ^(1/t))/Λ^(1/t)]·df2/df1`.

Hotelling–Lawley:
`df1=s(2m+s+1)`, `df2=2(sn₀+1)`,
`F=[df2/(df1·s)]·U`.

Roy upper-bound approximation:
`df1=max(p,q)`, `df2=v−max(p,q)+q`,
`F=(df2/df1)·Θ`.
Use the upper-bound interpretation for Roy; it is not the exact omnibus distribution when multiple roots contribute.

## Numerical verification

The independent calculation constructs the sequential model matrix, residual SSP, each term's incremental H, generalized roots and four F/df/p rows, then compares to the public R summary. It also compares every SSP matrix and eigenvalue. Verified cases are `manova_iris`, `manova_iris_intercept`, `manova_two_factors`, `manova_two_factors_reversed`, `manova_interaction`, `manova_covariate`, `manova_two_responses_two_groups`, `manova_p_gt_df`, `manova_na`, `manova_tol`, `manova_scale`, and `manova_npk`; all reported term rows and all four test columns were compared. The experiment output records per-case maximum F/df/p discrepancies and matrix/eigenvalue discrepancies; the iris baseline has F max absolute error 4.24e−12, df error 0, p max absolute error 5.30e−64, SSP max absolute error 9.67e−13 and eigenvalue max absolute error 3.56e−14. The intercept row's F discrepancy is at most 9.94e−8 because the intercept SSP is very large; the Species row remains at 4.24e−12. Boundary cases `manova_one_response`, `manova_few_df`, and `manova_collinear` are verified as errors, preserving their R error text.

## R-observed contract and formula semantics

Terms are Type I sequential in formula order; reversing two factors changes the rows. `intercept=TRUE` adds an (Intercept) row. The output includes all four test tables, SSP matrices, eigenvalues and model coefficients. One response errors `need multiple responses`; insufficient residual rank and collinear response matrices error. NA rows follow model-frame omission. `tol` controls numerical rank.

## Decisions for the user

1. Implement all four statistics and the F approximations above, including Roy's upper bound; recommendation: yes, with Roy explicitly labelled as an upper-bound approximation.
2. Keep Type I sequential term ordering and optional intercept row.
3. Reject residual SSP rank below response dimension and expose `tol`.

## rStats.js's choices

(empty — reserved for user decisions)
