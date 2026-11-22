# Grubbs outlier tests

Issue #549. Reference R 4.6.2 / outliers 0.15. Evidence: Grubbs (1950), Ann. Math. Stat. 21, 27–58; Pearson & Sekar (1936); David, Hartley & Pearson (1954); public R outputs and independent calculations in `experiments/multivariate19-stage1-grubbs.R`; full public-call cases in `experiments/tests19-small.R`. No GPL source or source-derived table was used.

## Statistics

Let n be the number of finite observations, s² the unbiased sample variance, and x_(1)≤…≤x_(n) the order statistics.

- Type 10 selects the high or low extreme x*: `G=|x*−xbar|/s`. Let s²_(−*) be the sample variance after removing that one extreme. `U=(n−2)s²_(−*)/[(n−1)s²]`.
- Type 11 uses both extremes: `G=(x_(n)−x_(1))/s`. Let s²_mid be the sample variance of x_(2),…,x_(n−1). `U=(n−3)s²_mid/[(n−1)s²]`.
- Type 20 selects the two high or two low extremes and reports U (not G): `U=(n−3)s²_rest/[(n−1)s²]`, where s²_rest is the sample variance after removing the selected two extremes.

The 12 `grubbs_x1_type{10,11,20}_opp{0,1}_two{0,1}` cases and the corresponding x2/x3 cases compare G/U, p and alternative text. Type 10's independently calculated Pearson–Sekar t transform agrees with `pgrubbs` for n=3,4,5,7,10,20,30,50 at all seven tested q values; maximum absolute CDF difference is 3.89e−15. The three x1 reference examples are: type10 G=2.46876461121245, U=0.00493082357959803, p=1.50131933551734e−7; type11 G=2.91813985536907, U=0.00337251643826531, p=0.628552325970718; type20 U=0.00374504032103939, p=0.

## Tail options and p values

`opposite=FALSE` selects the high extreme(s); TRUE selects the low extreme(s) for types 10 and 20. Type 11 always considers both extremes, so opposite does not change its G, U, p, or alternative. For types 10 and 11, `two.sided=TRUE` doubles the one-tail probability in the direction opposite the observed statistic, capped at 1; type 20's two-sided behavior is likewise observed as twice its lower-tail table probability, capped at 1. The descriptive alternative names the selected high/low observation(s); type 11 names both endpoints. The supplied 12-per-sample cases cover all combinations.

Type 10's CDF is independently reproduced by the Pearson–Sekar approximation (t distribution, df n−2) and the experiment records all tested q/n pairs. Type 11 is based on the David–Hartley–Pearson relation and numerical inversion; the public helper can fail at `pgrubbs_type11_n10` q=3 with the reported root-bracketing error. Do not replace that failure with an invented probability. Type 20 is tabulated and interpolated; see the table-grid qualification below.

## Type 20 table-grid qualification

The experiment's self-generated U=0.001 grid is only a numerical approximation and is **not** evidence of the reference table's native probability knots. The public `qgrubbs(p,n,type=20)` calls in the recorded experiment use p values `0.001, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 0.999`; these are sampled probabilities, not a verified exhaustive native grid. Independently, `pgrubbs(u,n,20)` and `qgrubbs(u,n,20,rev=TRUE)` agree exactly on the tested off-grid U values (maximum difference 0), confirming the reverse-quantile interpretation. Linear interpolation on the artificial 0.001 U grid has maximum off-grid error 2.06e−4 (n=11); sqrt(U), log(U), and logit probability transformations did not give one uniformly best coordinate across n.

**Therefore the native table probability knots have not been identified by the completed experiment.** This is deliberately left unresolved rather than relabeling the artificial 0.001 grid as the table. The correct next experiment, if needed, is to query public qgrubbs at candidate probability knots and verify each returned q against pgrubbs; no table values may be copied from source.

## Boundary observations

Type 20 accepts 3≤n≤30; n=31 errors `n must be in range 3-30`. Type 11's q=3 inversion failure is retained as a documented error case. Constant input gives undefined G/U but the reference reports p=0; this is mathematically inconsistent with an ordinary finite statistic and is treated as a reference defect, not a target behavior. `grubbs_n2`, `grubbs_n3`, `grubbs_n3_type11`, `grubbs_n4_type20`, `grubbs_n30_type20`, `grubbs_n31_type20`, `grubbs_constant`, `grubbs_na`, `grubbs_large_n`, `grubbs_tie_extremes`, `grubbs_symmetric`, `grubbs_scale`, and `grubbs_shift` record the remaining boundaries.

## Decisions for the user

1. Export scalar `pgrubbs` and `qgrubbs` only if required; recommendation: keep them public to make the distribution law independently testable.
2. Type 11 numerical inversion: propagate a clear convergence/bracketing error where the defining root cannot be bracketed.
3. Type 20: do not claim exact R table compatibility until native probability knots are identified. Recommendation: defer type 20 implementation or explicitly approve a documented approximation tolerance.
4. Constant samples: return NaN statistic and NaN p (or a validation error), not the reference's p=0 defect.

## rStats.js's choices

(empty — reserved for user decisions)
