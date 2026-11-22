# Tamhane T2 and T2' pairwise comparisons

Issue #549. Reference R 4.6.2 / PMCMRplus 1.9.12. Evidence: Tamhane (1979), JASA 74, 768–771, and public outputs in experiments/tests19-small.R and .json. No package or R source was read, recalled, or copied.

## Equations

For groups i,j with sizes n_i,n_j, means xbar_i,xbar_j, and unbiased variances s_i^2,s_j^2:

SE_ij = sqrt(s_i^2/n_i + s_j^2/n_j)
t_ij = (xbar_i - xbar_j)/SE_ij
nu_ij = (s_i^2/n_i + s_j^2/n_j)^2 /
        ((s_i^2/n_i)^2/(n_i-1) + (s_j^2/n_j)^2/(n_j-1))
p_ij = 2 P(T_nu >= |t_ij|)
p_adjusted = 1 - (1-p_ij)^m, m=k(k-1)/2.

This is the Welch-Satterthwaite T2 route. The PlantGrowth output confirms the displayed t values, but pair-by-pair independent reconstruction of df and adjusted p is not yet recorded. T2' has the same displayed statistic in the fixture but different p-values; its exact df/probability formula is not reconstructed. Do not guess that it is Welch or pooled t.

## R-observed contract

- welch defaults TRUE; FALSE selects T2'.
- Lower-triangular statistic and p-value matrices; group labels preserved.
- Both report a two-sided alternative, t distribution, and Sidak adjustment; passing alternative="greater" or p.adjust.method="holm" did not change output.
- Formula, list-of-groups, and aov inputs succeeded. Plain character group labels failed with "all group levels must be finite".
- A group of size one gives NA for affected pairs. All-equal groups give NaN. Zero-variance groups can still produce finite pairwise results.
- Multiplying data by 1e100 preserved t but made p-values NaN; adding 1e8 caused small floating-point changes.

## Numeric checks

t2_PlantGrowth_welch: first statistic -1.1912603818487, adjusted p 0.578770154093608.
t2_PlantGrowth_T2prime: same statistic, adjusted p 0.576474444686735.
t2_group_of_one, t2_zero_variance, t2_all_equal, t2_large_scale, t2_shift record boundary behavior.
Welch df and Sidak are not yet independently recomputed; T2' formula is unconfirmed.

## Decisions for the user

1. T2' support: recommendation is to keep it in scope but not implement until its df/p formula is independently pinned down; alternatively defer welch=FALSE.
2. Inputs: support sample+groups, list samples, formula and aov only where existing APIs represent them cleanly; require factor-like group labels.
3. Degeneracy: return NaN for undefined zero-variance comparisons and NA when a pair has n<2; do not copy scale-induced numerical artifacts.

## rStats.js's choices

(empty — reserved for user decisions)
