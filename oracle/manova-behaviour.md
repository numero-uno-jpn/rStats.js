# Multivariate analysis of variance

Issue #549. Reference: R 4.6.2 \`stats::manova\` / \`summary.manova\`. Evidence: Pillai (1955); Wilks (1932); Hotelling (1951); Roy (1953); Rao (1951); public R outputs and independent SSP/eigenvalue calculations. No R source was inspected.

## SSP decomposition and roots

For response matrix \(Y\) and sequential formula terms, each term has hypothesis SSP \(H\), formed by the incremental model-space projection for that term, and residual error SSP \(E\). The nonzero generalized roots satisfy

\[
Hv_i=\lambda_i Ev_i,\qquad s\le\min(p,q),
\]

where \(p\) is response dimension and \(q\) is the hypothesis rank increment. The four statistics are

\[
V=\sum_i\frac{\lambda_i}{1+\lambda_i},\quad
\Lambda=\prod_i\frac1{1+\lambda_i},\quad
U=\sum_i\lambda_i,\quad
\Theta=\max_i\lambda_i.
\]

They are Pillai, Wilks, Hotelling–Lawley, and Roy.

## F approximations

Let \(v\) be residual df, \(s=\min(p,q)\), \(m=(|p-q|-1)/2\), and \(n_0=(v-p-1)/2\).

**Pillai**

\[
df_1=s(2m+s+1),\quad df_2=s(2n_0+s+1),\quad
F=\frac{2n_0+s+1}{2m+s+1}\frac{V}{s-V}.
\]

**Wilks (Rao's F)**

\[
t=\sqrt{\frac{p^2q^2-4}{p^2+q^2-5}},\quad
u=\frac{pq-2}{4},\quad df_1=pq,
\]
\[
df_2=\left(v-\frac{p-q+1}{2}\right)t-2u,\quad
F=\frac{1-\Lambda^{1/t}}{\Lambda^{1/t}}\frac{df_2}{df_1}.
\]

For \(pq=2\), the continuous limiting value is \(t=1\).

**Hotelling–Lawley**

\[
df_1=s(2m+s+1),\quad df_2=2(sn_0+1),\quad
F=\frac{df_2}{s\,df_1}U.
\]

**Roy (upper-bound approximation)**

\[
df_1=\max(p,q),\quad df_2=v-\max(p,q)+q,\quad
F=\frac{df_2}{df_1}\Theta.
\]

All p-values are upper-tail F probabilities.

## R-observed contract and numerical checks

- Formula terms are Type I sequential in formula order. Reversing terms changes SSP and test rows. \`intercept=TRUE\` adds the intercept row; default omits it. \`tol\` controls numerical rank.
- All 15 cases in \`multivariate19.json\` were checked: \`manova_iris\`, \`manova_iris_intercept\`, \`manova_two_factors\`, \`manova_two_factors_reversed\`, \`manova_interaction\`, \`manova_covariate\`, \`manova_two_responses_two_groups\`, \`manova_p_gt_df\`, \`manova_one_response\`, \`manova_few_df\`, \`manova_collinear\`, \`manova_na\`, \`manova_tol\`, \`manova_scale\`, and \`manova_npk\`.
- The 12 estimable cases agree for every term and all four F tests: df difference 0; maximum relative F difference \(1.91\cdot10^{-11}\), p difference \(1.37\cdot10^{-9}\). SSP matrices and positive generalized roots agree to maximum relative difference \(4.56\cdot10^{-15}\).
- Error cases match: one response gives \`need multiple responses\`; few residual df gives \`residuals have rank 5 < 6\`; collinear responses give \`residuals have rank 2 < 3\`.
- The user-provided \`experiments/multivariate19-stage1-check-local.json\` independently confirms the iris Pillai statistic from H/E.

## Decisions for the user

1. Implement Type I sequential terms only, in formula order; document that this is not Type II/III.
2. Expose \`intercept\` and \`tol\`; reject residual SSP rank below response dimension.
3. Implement all four statistic-specific F approximations above; do not substitute chi-square approximations.
4. Use scale-normalized SSP/eigen calculations to avoid avoidable overflow.

## rStats.js's choices

(empty — reserved for user decisions)
