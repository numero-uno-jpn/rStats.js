# Grubbs outlier tests

Issue #549. Reference R 4.6.2 / outliers 0.15. Evidence: Grubbs (1950), Ann. Math. Stat. 21, 27–58; Pearson & Sekar (1936); David, Hartley & Pearson (1954); public R outputs and independent calculations in `experiments/multivariate19-stage1-grubbs.R`; complete public-call cases in `experiments/tests19-small.R`. No GPL source or source-derived table was used.

## Statistics

Let n be the number of finite observations, s² the unbiased sample variance, and x_(1)≤…≤x_(n) the order statistics.
- Type 10 selects high or low extreme x*: `G=|x*−xbar|/s`; after deleting x*, `U=(n−2)s²_(−*)/[(n−1)s²]`.
- Type 11 uses both extremes: `G=(x_(n)−x_(1))/s`; for the interior sample x_(2),…,x_(n−1), `U=(n−3)s²_mid/[(n−1)s²]`.
- Type 20 selects the two high or two low extremes and reports U: `U=(n−3)s²_rest/[(n−1)s²]`, where s²_rest is the variance after deleting the selected two.

The 12 `grubbs_x1_type{10,11,20}_opp{0,1}_two{0,1}` cases and corresponding x2/x3 cases compare statistics, p and alternative text. Type 10's independently calculated Pearson–Sekar t transform agrees with `pgrubbs` for n=3,4,5,7,10,20,30,50 at all seven q values; maximum absolute CDF difference 3.89e−15. x1 reference examples: type10 G=2.46876461121245, U=0.00493082357959803, p=1.50131933551734e−7; type11 G=2.91813985536907, U=0.00337251643826531, p=0.628552325970718; type20 U=0.00374504032103939, p=0.

## Tail options and p values

`opposite=FALSE` selects high extreme(s); TRUE selects low extreme(s) for types 10 and 20. Type 11 always uses both endpoints, so opposite does not change its statistic, p or alternative. For type 10, the one-sided p is `1−F₁₀(G)` and the two-sided p is `2·min(F₁₀(G),1−F₁₀(G))`. For type 11, the one-sided p is `1−pgrubbs(G,n,11)` and the two-sided p is twice that upper-tail probability. For type 20, the one-sided p is `pgrubbs(U,n,20)` and the two-sided p is `2·min(pgrubbs(U,n,20),1−pgrubbs(U,n,20))`. These rules are capped to [0,1]. The alternative string names the selected observation(s). The 12-per-sample cases cover all combinations.

Type 10's Pearson–Sekar transform is `t=q·sqrt[n(n−2)/((n−1)²−nq²)]`, with `F₁₀(q)=1−n·Pr(T_(n−2)≤−t)`. The one-sided p is `1−F₁₀(G)`; the two-sided p is `2·min(F₁₀(G),1−F₁₀(G))`. All tested q/n pairs agree with public `pgrubbs` within 3.89e−15. Type 11 uses the David–Hartley–Pearson relation and numerical inversion, but the completed independent calculation did not reproduce its full probability equation. Record `pgrubbs(q,n,11)` as the reference probability function rather than inventing a closed form; it can fail at `pgrubbs_type11_n10` q=3 with a root-bracketing error, which must be preserved as an error case.

## Type 20 table grid and interpolation

The completed public-call experiment identifies the supported table-probability knots by calling `qgrubbs(p,n,type=20)` directly. For every tested n=4,6,8,9,11,15,16,25,29, numeric quantiles were returned at
`p = 0.001, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 0.9, 0.99, 0.999`.
Calls at p=0.01, 0.7 and 0.95 did not return numeric quantiles in these runs. The corresponding q values are the R outputs in `experiments/multivariate19-stage1-grubbs.R`; the oracle fixture now records qgrubbs at this probability grid and the paired pgrubbs evaluations. These are R-observed table knots, not values read from source.

Separately, `pgrubbs(u,n,20)` and `qgrubbs(u,n,20,rev=TRUE)` agree exactly at all tested on-grid and off-grid U values (maximum difference 0). This establishes the reverse-call identity for the public CDF calculation. It does **not** justify replacing the table by a self-generated U=0.001 grid. Linear interpolation on that artificial grid has maximum off-grid error 2.06e−4 (n=11); sqrt(U), log(U), and logit-probability transforms were also tested, with no single transformed coordinate uniformly best across n. The default `qgrubbs(p)` values and the `rev=TRUE` CDF path must not be conflated.

The native probability knots are now identified, but the completed experiments do not establish that a simple piecewise-linear interpolation between the default qgrubbs quantiles reproduces every pgrubbs value. That mismatch is not papered over: retain the public R knot outputs, use the independently verified reverse-CDF relation for comparisons, and leave the exact interpolation implementation as a decision rather than claiming unverified equivalence.

## Boundaries

Type 20 accepts 3≤n≤30; n=31 errors `n must be in range 3-30`. Type 11's q=3 inversion failure is recorded. Constant input gives undefined G/U but the reference reports p=0; treat this as a reference defect, not desired statistical behavior. Remaining cases: `grubbs_n2`, `grubbs_n3`, `grubbs_n3_type11`, `grubbs_n4_type20`, `grubbs_n30_type20`, `grubbs_n31_type20`, `grubbs_constant`, `grubbs_na`, `grubbs_large_n`, `grubbs_tie_extremes`, `grubbs_symmetric`, `grubbs_scale`, `grubbs_shift`.

## Decisions for the user

1. Export scalar pgrubbs/qgrubbs only if needed; recommendation: yes, to make the distribution independently testable.
2. Type 11: the full David–Hartley–Pearson probability equation was not independently reconstructed; either accept the public-helper numerical contract for implementation or defer type 11. Propagate a clear convergence/bracketing error where no root can be bracketed.
3. Type 20: defer exact table compatibility until native probability knots are identified, or explicitly approve a documented approximation tolerance.
4. Constant samples: return NaN p (or a validation error), not the reference's p=0 defect.

## rStats.js's choices

(empty — reserved for user decisions)
