# Grubbs outlier tests

Issue #549. Reference R 4.6.2 / outliers 0.15. Evidence: Grubbs (1950), Ann. Math. Stat. 21, 27–58; Pearson & Sekar (1936); David, Hartley & Pearson (1954); public R outputs and independent calculations in `experiments/multivariate19-stage1-grubbs.R`; complete public-call cases in `experiments/tests19-small.R`. No GPL source or source-derived table was used.

## Statistics

Let n be the number of finite observations, s² the unbiased sample variance, and x_(1)≤…≤x_(n) the order statistics.
- Type 10 selects high or low extreme x*: `G=|x*−xbar|/s`; after deleting x*, `U=(n−2)s²_(−*)/[(n−1)s²]`.
- Type 11 uses both extremes: `G=(x_(n)−x_(1))/s`; for the interior sample x_(2),…,x_(n−1), `U=(n−3)s²_mid/[(n−1)s²]`.
- Type 20 selects the two high or two low extremes and reports U: `U=(n−3)s²_rest/[(n−1)s²]`, where s²_rest is the variance after deleting the selected two.

The 12 `grubbs_x1_type{10,11,20}_opp{0,1}_two{0,1}` cases and corresponding x2/x3 cases compare statistics, p and alternative text. Type 10's independently calculated Pearson–Sekar t transform agrees with `pgrubbs` for n=3,4,5,7,10,20,30,50 at all seven q values; maximum absolute CDF difference 3.89e−15. x1 reference examples: type10 G=2.46876461121245, U=0.00493082357959803, p=1.50131933551734e−7; type11 G=2.91813985536907, U=0.00337251643826531, p=0.628552325970718; type20 U=0.00374504032103939, p=0.

## Tail options and p values

`opposite=FALSE` selects high extreme(s); TRUE selects low extreme(s) for types 10 and 20. Type 11 always uses both endpoints, so opposite does not change its statistic, p or alternative. For types 10 and 11, `two.sided=TRUE` doubles the one-tail probability in the observed direction, capped at 1. Type 20's two-sided behavior is twice its lower-tail table probability, capped at 1. The alternative string names the selected observation(s). The 12-per-sample cases cover all combinations.

Type 10's CDF is independently reproduced by the Pearson–Sekar approximation (t distribution, df n−2); all tested q/n pairs agree within 3.89e−15. Type 11 uses the David–Hartley–Pearson relation and numerical inversion; the public helper can fail at `pgrubbs_type11_n10` q=3 with a root-bracketing error. Preserve this failure rather than inventing a probability.

## Type 20 interpolation: unresolved native knots

The self-generated U=0.001 grid is only an approximation and is **not** evidence of the reference table's native probability knots. Public `qgrubbs(p,n,type=20)` was sampled at p=`0.001, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 0.999`; these are sampled probabilities, not a verified exhaustive native grid. Independently, `pgrubbs(u,n,20)` and `qgrubbs(u,n,20,rev=TRUE)` agree exactly on tested off-grid U values (maximum difference 0), confirming the reverse-quantile interpretation. Linear interpolation on the artificial 0.001 U grid has maximum off-grid error 2.06e−4 (n=11); sqrt(U), log(U), and logit-probability transforms did not give one uniformly best coordinate across n.

**The native table probability knots have not been identified by the completed experiment.** Do not relabel the artificial grid as the table. A follow-up must query public qgrubbs at candidate probability knots and verify each returned q against pgrubbs. No table values may be copied from source.

## Boundaries

Type 20 accepts 3≤n≤30; n=31 errors `n must be in range 3-30`. Type 11's q=3 inversion failure is recorded. Constant input gives undefined G/U but the reference reports p=0; treat this as a reference defect, not desired statistical behavior. Remaining cases: `grubbs_n2`, `grubbs_n3`, `grubbs_n3_type11`, `grubbs_n4_type20`, `grubbs_n30_type20`, `grubbs_n31_type20`, `grubbs_constant`, `grubbs_na`, `grubbs_large_n`, `grubbs_tie_extremes`, `grubbs_symmetric`, `grubbs_scale`, `grubbs_shift`.

## Decisions for the user

1. Export scalar pgrubbs/qgrubbs only if needed; recommendation: yes, to make the distribution independently testable.
2. Type 11: propagate a clear convergence/bracketing error where no root can be bracketed.
3. Type 20: defer exact table compatibility until native probability knots are identified, or explicitly approve a documented approximation tolerance.
4. Constant samples: return NaN p (or a validation error), not the reference's p=0 defect.

## rStats.js's choices

(empty — reserved for user decisions)
