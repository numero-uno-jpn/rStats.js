# Grubbs outlier tests

Issue #549. Reference R 4.6.2 / outliers 0.15. Evidence: Grubbs (1950), Annals of Mathematical Statistics 21, 27–58; Pearson & Sekar (1936); David, Hartley & Pearson (1954); public outputs in experiments/tests19-small.R and .json. No package/R source or source-derived table was used.

## Statistics and unresolved laws

For n finite observations, mean xbar and sample sd s, the one-outlier statistic is G=max(abs(x_i-xbar))/s. Reference type 10 returns G and U; type 11 returns G and U for opposite extremes; type 20 returns U for the two largest or two smallest values. Exact U transformations and p-value laws are not yet independently reconstructed and checked; do not implement them by guessing.

The public distribution helpers pgrubbs(q,n,type) and qgrubbs(p,n,type,rev) are scalar-valued in the observed run. Public help describes type 10 as inversion of the Pearson-Sekar approximation, type 11 as the David-Hartley-Pearson relation solved numerically, and type 20 as a tabulated distribution. Type-20 values must be collected only from R qgrubbs output, never from source.

## R-observed contract

- type values: 10, 11, 20; options include opposite and two.sided.
- Result includes method, statistic name(s), p-value, and descriptive alternative naming selected observation(s).
- Type 20 requires 3<=n<=30; n=31 errors "n must be in range 3-30". n=2 errors; n=3 accepted.
- Constant data return NaN statistics and p=0 in the observed output.
- Ties at extremes, symmetric data, large n, scale 1e100 and shift 1e8 are covered in the supplied experiment and require explicit policy.

## Numeric checks

grubbs_x1_type10_opp0_two0: G=2.46876461121245, U=0.00493082357959803, p=1.50131933551734e-7.
grubbs_x1_type11_opp0_two0: G=2.91813985536907, U=0.00337251643826531, p=0.628552325970718.
grubbs_x1_type20_opp0_two0: U=0.00374504032103939, p=0; alternative names the two largest observations.
grubbs_n31_type20: expected reference error.
Exact type 10/11 transformations, type-20 interpolation, and opposite/two-sided tails remain unverified.

## Decisions for the user

1. Distribution helpers: recommendation is to export pgrubbs and qgrubbs, initially scalar-only.
2. Type-20 table: generate any numeric grid only from R qgrubbs outputs and document interpolation.
3. Implementation gate: do not implement Grubbs until all U/p laws and boundaries have independent numerical checks.

## rStats.js's choices

(empty — reserved for user decisions)
