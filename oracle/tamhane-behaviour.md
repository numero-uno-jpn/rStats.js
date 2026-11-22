# Tamhane T2 and T2' pairwise comparisons

Issue #549. Reference: R 4.6.2, PMCMRplus 1.9.12. Evidence: Tamhane (1979), *JASA* 74, 768–771, public R function outputs, and independent pairwise calculations. No package or R source was read or copied.

## Pairwise formulas

For groups \(i<j\), with sizes \(n_i,n_j\), means \(\bar{x}_i,\bar{x}_j\), and unbiased sample variances \(s_i^2,s_j^2\), define

\[
A_i=s_i^2/n_i,\quad A_j=s_j^2/n_j,\quad
SE_{ij}=\sqrt{A_i+A_j},\quad
t_{ji}=(\bar{x}_j-\bar{x}_i)/SE_{ij}.
\]

For T2 (Welch),

\[
\nu_{ij}=\frac{(A_i+A_j)^2}{A_i^2/(n_i-1)+A_j^2/(n_j-1)}.
\]

For T2', the statistic and standard error are unchanged, but

\[
\nu'_{ij}=n_i+n_j-2.
\]

Both use \(p_{ij}=2P(T_{\nu_{ij}}\ge |t_{ji}|)\), followed by Šidák adjustment over \(m=k(k-1)/2\) pairs:

\[
p^{\mathrm{adj}}_{ij}=1-(1-p_{ij})^m.
\]

The returned statistic and p-value matrices are lower triangular: row \(j\) corresponds to group \(j\), column \(i\) to group \(i\).

## R-observed contract and numerical checks

- \`welch=TRUE\` is T2; \`welch=FALSE\` is T2'. T2' does not use Welch df, \(N-k\), or \(N-2\): the pairwise df is exactly \(n_i+n_j-2\).
- PlantGrowth, InsectSprays, and chickwts: every pair in both modes agrees with the independent formula; maximum absolute difference in t and adjusted p is 0 at serialized precision. The user-provided \`experiments/multivariate19-stage1-check-local.json\` independently confirms PlantGrowth and chickwts.
- PlantGrowth first pair: \(t=-1.1912603818487\); adjusted T2 p \(=0.578770154093608\); adjusted T2' p \(=0.576474444686735\).
- \`t2_group_of_one\`: pairs involving the singleton group return NA. \`t2_zero_variance\`: a zero-variance group versus a variable group can give finite t/df/p. \`t2_all_equal\`: t, df and p are NaN.
- \`t2_large_scale\`: at scale \(10^{100}\), \(A_i,A_j\) are about \(10^{200}\); R's squared intermediates overflow to Inf and df becomes Inf/Inf = NaN. Rescaling \(A_i,A_j\) by \(\max(A_i,A_j)\) before squaring gives finite Welch df \(16.5235850568593\), matching the ordinary-scale calculation.
- Formula, list-of-samples, and aov inputs are recorded. A raw character grouping vector errors with \`all group levels must be finite\`; factor labels work. \`alternative="greater"\` and \`p.adjust.method="holm"\` do not change the two-sided Šidák result.
- Other oracle cases: \`t2_formula_na\`, \`t2_list\`, \`t2_aov\`, \`t2_two_groups\`, \`t2_alternative_greater\`, and \`t2_p_adjust_holm\`.

## Decisions for the user

1. Keep both T2 and T2' in scope; implement T2' with pair-specific df \(n_i+n_j-2\).
2. Compute Welch df with scale-normalized \(A_i,A_j\) to avoid intermediate overflow.
3. Preserve factor level order and reject unsupported raw character grouping with a clear message.
4. Return NA for pairs with \(n<2\), and NaN when the pairwise statistic is mathematically undefined.

## rStats.js's choices

(empty — reserved for user decisions)
