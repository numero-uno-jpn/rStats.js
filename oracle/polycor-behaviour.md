# Polychoric and polyserial correlation (two-step): the behaviour to reproduce

What polycor 0.8-2 computes with its defaults (`ML = FALSE`, `std.err = FALSE`), in words. Fixtures `polycor` and
`pbvnorm` (`oracle/polycor.R`). The maximum-likelihood variants (`ML = TRUE`, `std.err`) are not in scope: R fits them
with Nelder-Mead on a likelihood whose last bits come from mvtnorm, so its answers cannot be reproduced; they will
come later against exact maximum-likelihood references. Where this file and a fixture seem to disagree, report it.

## API

`pbvnorm(lower, upper, rho)`: P(lower ≤ (X, Y) ≤ upper) for the standard bivariate normal with correlation rho
(bounds may be ±Inf). `polychor(x, y)` or `polychor(table)` and `polyserial(x, y)`: the correlation (a number, NaN
where R returns NA), with `warnings`, e.g. `{ rho, warnings }`.

## pbvnorm

Accurate to about 1e-15 absolute and to a relative 1e-12 where the probability is not tiny: for example as
differences of the bivariate distribution function `Φ2(h, k; ρ)` computed by the Drezner–Wesolowsky / Genz method
(A. Genz, "Numerical computation of rectangular bivariate and trivariate normal and t probabilities", Statistics and
Computing 14 (2004) 251–260), or by quadrature of Sheppard's formula `Φ2(h, k; ρ) = Φ(h)Φ(k) + (1/2π) ∫_0^{asin ρ}
exp(−(h² − 2hk sin θ + k²)/(2 cos² θ)) dθ`, taking care near |ρ| = 1 and of cancellation in small rectangles. A
rectangle's probability is never negative (clip at 0).

## polychor (two-step)

The contingency table of x and y (rows: the sorted distinct values of x; columns: of y), or the table given. Rows and
columns whose marginal is 0 are removed, with the warnings `k row(s) with zero marginal removed` (exactly: `1 row with
zero marginal removed`, `2 rows with zero marginals removed`; the same for columns). Fewer than 2 rows (columns)
left: warning `the table has fewer than 2 rows` (`columns`) and NaN.

Thresholds from the margins: with n the total, row thresholds `qnorm(cumsum(row sums)/n)` without the last (r − 1
values), column thresholds likewise. `rho` minimises `−Σ_ij n_ij log P_ij(ρ)` over ρ in [−0.9999, 0.9999] with this
library's `optimize` (R's `optimise` with its default tolerance), where `P_ij(ρ)` = pbvnorm of the cell (thresholds
extended by −Inf and +Inf). Values of |ρ| above 0.9999 inside the function are replaced by ±0.9999.

## polyserial (two-step)

Rows with a missing value dropped. `z` = standardised x (mean 0, sample sd 1); the table of y (sorted levels, s of
them); fewer than 2 levels: warning `y has fewer than 2 levels` and NaN; fewer than 2 with data: `y has fewer than 2
levels with data` and NaN; levels with no cases: warning `the following level(s) of y has (have) no cases: ...` as
R. Thresholds `qnorm(cumsum(table)/n)` without the last. With y coded 1..s: `rho = sqrt((n − 1)/n) × sd(y) ×
cor(x, y) / Σ dnorm(thresholds)`; if |rho| > 0.9999: warning `initial correlation inadmissible, <rho>, set to ±0.9999`
and rho = ±0.9999 (R's message with the number as R prints it).

## Accuracy

polychor and polyserial within a relative 1e-12 of R; pbvnorm within a relative 1e-12 or 1e-15 absolute. No
loosening; report a case that does not reach it.
