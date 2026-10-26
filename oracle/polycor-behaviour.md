# Polychoric and polyserial correlation: the behaviour to reproduce

What polycor 0.8-2 computes, in words. Fixtures `polycor` and `pbvnorm` (`oracle/polycor.R`) for the defaults
(`ML = FALSE`, `std.err = FALSE`), and `polycorML` (`oracle/polycorml.R`) for the maximum-likelihood estimates and
the standard errors (section "Maximum likelihood and standard errors"). Where this file and a fixture seem to
disagree, report it.

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

## Maximum likelihood and standard errors

Options `{ ML, stdErr }` (both default false) for `polychor` and `polyserial`. R maximises the likelihood with
Nelder-Mead (`ML = TRUE`) or BFGS (`std.err = TRUE` alone) and takes the Hessian by finite differences, so its results
are within about 1e-4 of the maximum only, and depend on the last bits of mvtnorm. This library returns the maximum
itself: the fixture's `reference` gives it (computed in 160-bit arithmetic), and R's values are known differences
from it (reason: R's optimiser stops early). In two cases (strong association, two-step with `std.err`) R's BFGS
runs past ρ = 1 and R reports `0.9999` with the warning `inadmissible correlation set to 0.9999` and an infinite
variance; the maximum is inside, and this library returns it without that warning.

The table, zero margins, warnings and the two-step thresholds as above.

- **polychor**, log-likelihood `ℓ = Σ_ij n_ij log P_ij` with P_ij the rectangle probabilities (thresholds extended by
  ±Inf). ML: maximise over θ = (ρ, the r − 1 row thresholds, the c − 1 column thresholds); `stdErr` alone: over ρ
  with the thresholds fixed at the two-step values. With `F(h, k)` = Φ2(h, k; ρ), `s = sqrt(1 − ρ²)` and φ2 the
  bivariate normal density, the derivatives needed (standard results): `∂F/∂ρ = φ2(h, k; ρ)`; `∂F/∂h = φ(h) Φ((k −
  ρh)/s)`; `∂²F/∂h² = −h φ(h) Φ(u) − (ρ/s) φ(h) φ(u)` with `u = (k − ρh)/s`; `∂²F/∂h∂k = φ2`; `∂²F/∂ρ∂h = −φ2 (h − ρk)/s²`;
  `∂²F/∂ρ² = φ2 (ρ/s² + (hk s² − ρ(h² − 2ρhk + k²))/s⁴)`. Terms with an infinite bound vanish (`∂F/∂h` at k = +Inf is
  φ(h)). Any method that reaches the maximum to about 1e-15 is fine (for example Newton's method from the two-step
  values, with the step halved while ℓ does not increase).
- **polyserial**, `ℓ = Σ_i [log φ(z_i) + log(Φ(τ_i,hi) − Φ(τ_i,lo))]`, `τ = (c − ρ z_i)/s` for the thresholds c below
  and above the category of observation i (±Inf at the ends), z the standardised x as above. ML: over (ρ, the s − 1
  thresholds); `stdErr` alone: over ρ with the thresholds fixed. Derivatives: `∂τ/∂ρ = (ρc − z)/s³`, `∂τ/∂c = 1/s`.
- If the likelihood increases all the way to |ρ| = 0.9999, return ±0.9999 with R's warning `inadmissible correlation
  set to 0.9999` (`-0.9999`).

Results with `stdErr`: `rho`, `var` (the inverse of the negative Hessian of ℓ at the maximum, in the order of θ; 1 × 1
for the two-step), `chisq`, `df`, `n`, and the thresholds (`rowCuts`, `colCuts` for polychor; `cuts` for polyserial;
the two-step ones when only ρ is estimated). Without `stdErr`, ML gives `rho` alone (as R).

- polychor: `chisq = 2 (−ℓ_max + Σ n_ij log((n_ij + 1e-6)/n))`, `df = r c − r − c`.
- polyserial (R's own binned statistic, reproduce it): with ρ_c and thresholds c_c = the ML estimates (ML), or the
  two-step closed-form ρ (before any maximisation) and the two-step thresholds (`stdErr` alone): standardise the
  category codes 1..s (mean 0, sample sd 1) and cut them at c_c into s classes (intervals closed on the right);
  standardise z again and cut it at `qnorm(1/4, 2/4, 3/4)` into 4 classes; T = the s × 4 table of the two;
  P = the rectangle probabilities with row thresholds c_c and column thresholds `qnorm(1:3/4)` at ρ_c;
  `chisq = 2 Σ T log((T + 1e-6)/(P n))` (cells with T = 0 contribute 0), `df = 4s − s − 1`.

## Accuracy

The two-step values within a relative 1e-12 of R; pbvnorm within a relative 1e-12 or 1e-15 absolute. The ML
estimates and the standard-error results within a relative 1e-12 of the fixture's `reference` (R's values are known
differences, listed with the reason above); `df`, `n` and the warnings exactly as R, except the `inadmissible` warning of
the two cases above. No loosening; report a case that does not reach it.
