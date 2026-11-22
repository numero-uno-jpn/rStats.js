# Tamhane T2 and T2' pairwise comparisons

Issue #549. Reference R 4.6.2 / PMCMRplus 1.9.12. Evidence: Tamhane (1979), JASA 74, 768–771; public R outputs and independent calculations in `experiments/multivariate19-stage1-tamhane-page.R`, with complete public-call cases in `experiments/tests19-small.R`. No GPL source or source-derived code/table was used.

## Equations

For groups i,j, let n_i,n_j be sample sizes, xbar_i,xbar_j means, and s_i²,s_j² unbiased sample variances. Put a=s_i²/n_i, b=s_j²/n_j and m=k(k−1)/2.

Both variants use
`t_ij=(xbar_j−xbar_i)/sqrt(a+b)`
and two-sided unadjusted probability
`p_ij=2 Pr(T_df >= |t_ij|)`.
The reported pairwise probability is Šidák:
`p_adj=1−(1−p_ij)^m`.
The method label is Tamhane's T2-test for unequal variances (T2) or Tamhane's T2'-test for unequal variances (T2').

For T2 (`welch=TRUE`), the df is Welch–Satterthwaite:
`df=(a+b)^2 / [a²/(n_i−1)+b²/(n_j−1)]`.
For T2' (`welch=FALSE`), the df is pooled:
`df=n_i+n_j−2`.
This second df is confirmed directly; it is not the Welch df. Both use the same t and Šidák family adjustment.

## Numerical verification

Independent pairwise reconstruction compared all t, df, raw p and adjusted p for:
- `PlantGrowth_T2`, `PlantGrowth_T2prime`
- `InsectSprays_T2`, `InsectSprays_T2prime`
- `chickwts_T2`, `chickwts_T2prime`

The experiment reports maximum absolute difference 0 for every pair and every compared quantity in all six cases (R output at 17 significant digits). In `PlantGrowth_T2`, ctrl–trt1: t=−1.1912603818487, df=16.5235850568593, raw p=0.250382508587548, adjusted p=0.578770154093608. In `PlantGrowth_T2prime`, the same t has df=18, raw p=0.249023165973005, adjusted p=0.576474444686735.

Additional public-output cases: `t2_formula_na`, `t2_list`, `t2_aov`, `t2_alternative_greater`, `t2_p_adjust_holm`, `t2_group_of_one`, `t2_zero_variance`, `t2_all_equal`, `t2_large_scale`, `t2_shift`. Passing `alternative="greater"` or `p.adjust.method="holm"` leaves the result unchanged. Plain character groups error; factor groups work.

## Boundary behavior

A pair containing a group of size one has NA statistic and p. Zero variance in one group is permitted if the combined standard error is positive. When both groups are constant at the same value, t and p are NaN. At scale 1e100, t remains finite but T2 p-values become NaN: direct evaluation of the Welch df numerator and denominator overflows to Inf, producing Inf/Inf. This is a numerical artifact, not a statistical property; use a scale-normalized df computation so the finite mathematical df is retained. T2' uses its finite integer df and does not need that calculation. Adding 1e8 causes ordinary floating-point cancellation in group means; do not claim exact translation invariance beyond floating-point precision.

## R-observed contract

The output is a lower-triangular pairwise matrix with group labels, `dist="t"`, `alternative="two.sided"`, and `p.adjust.method="T2 (Sidak)"`. Formula, list-of-groups and aov inputs are present in the experiment. The supplied experiment also records errors, warnings and messages for every case.

## Decisions for the user

1. Implement both T2 and T2' with the df formulas above; recommendation: yes, because all six data-set/variant comparisons agree exactly at the recorded precision.
2. Use a scaled evaluation of Welch df to avoid the R overflow artifact at `t2_large_scale`; report this deliberate numerical improvement.
3. Reject non-factor character group labels with a clear validation error, or normalize them to a factor before analysis. Recommendation: normalize while preserving first-seen level order.

## rStats.js's choices

(empty — reserved for user decisions)
