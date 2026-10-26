# Agreement and reliability: the behaviour to reproduce

What irr 0.85 and psych 2.6.9 compute for Cohen's and Fleiss' kappa, the ICC, Cronbach's alpha and the partial
correlation, in words, for an implementation that must not read their source. Fixture `agreement`
(`oracle/agreement.R`; format in its header). Only the cases with `fn` = `kappa2`, `kappam.fleiss`, `icc`, `alpha`,
`partial.r` are in scope now (`omega`, `polychor` and `polyserial` come later, after `optim`). Where this file and the
fixture seem to disagree, report it.

## Easy to get wrong

1. kappa2's levels: the levels of both raters' ratings put together, **sorted as strings** when the ratings are
   numeric (so 10 sorts before 2), duplicates removed.
2. kappa2's p-value uses the variance **under the null hypothesis** (no `(1 − kappa)` factor). irr forms the
   p-values of both kappas as `2 (1 − Φ(|z|))`, losing small ones; compute `2 Φ(−|z|)` (the fixtures' `reference`,
   compared as a known difference where R differs).
3. ICC's mean squares come from sample variances: `MSr = var(row means) × k`, `MSc = var(column means) × n`, `MSw =
   mean of the row variances`, `MSe = (SStotal − MSr (n − 1) − MSc (k − 1)) / ((n − 1)(k − 1))` with `SStotal =
   var(all values)(nk − 1)`.
4. Alpha's G6 uses the squared multiple correlations `smc_i = 1 − 1/(R^-1)_ii` of the correlation matrix.

## API

`kappa2(ratings, { weight })` (`ratings`: n × 2 matrix, rows with a missing value dropped; weight `"unweighted"`
default, `"equal"`, `"squared"`), `kappamFleiss(ratings, { exact })`, `icc(ratings, { model, type, unit, r0,
confLevel })` (defaults `"oneway"`, `"consistency"`, `"single"`, 0, 0.95), `cronbachAlpha(x)` (psych's `alpha` with
its defaults; result `{ rawAlpha, stdAlpha, G6, averageR, alphaDrop }`), `partialR(x, i, j)` (0-based columns i and j,
partialled on all the others). Results with the fixture's fields in camelCase.

## kappa2

Table `T` (n subjects) over the levels L (rule 1), `c` levels. Weights `w_d` for a distance d between levels:
unweighted 1 at d = 0 and 0 otherwise; equal `1 − d/(c − 1)`; squared `1 − d²/(c − 1)²`; `W_rs = w_|r−s|`.
`p_o = Σ T W / n`; with the margins `a_r = Σ_s T_rs / n`, `b_s = Σ_r T_rs / n`: `p_e = Σ a_r b_s W_rs`; `κ = (p_o −
p_e)/(1 − p_e)`. With `u_r = Σ_s b_s W_rs` and `v_s = Σ_r a_r W_rs`: `var = (Σ_rs a_r b_s (W_rs − (u_r + v_s))² −
p_e²) / (n (1 − p_e)²)`; `statistic = κ/sqrt(var)`, `p.value = 2 (1 − Φ(|statistic|))`. Result `{ value, statistic,
pValue }`.

## kappam.fleiss

`n` subjects, `m` raters, levels = the sorted distinct values of all ratings; `t_ij` the number of raters giving
subject i level j. `P_o = Σ_i (Σ_j t_ij² − m) / (m(m − 1)) / n`; `p_j = Σ_i t_ij / (n m)`; `P_e = Σ p_j²`; with
`exact`: `P_e − Σ_j var_r(q_rj)(m − 1)/m / (m − 1)` where `q_rj` is the share of subjects that rater r put in level j
and `var_r` the sample variance over the raters. `κ = (P_o − P_e)/(1 − P_e)`. Without `exact`: `var = 2 / ((Σ p_j
q_j)² n m (m − 1)) × ((Σ p_j q_j)² − Σ p_j q_j (q_j − p_j))`, `q_j = 1 − p_j`, `statistic = κ/sqrt(var)`, `p.value = 2(1
− Φ(|statistic|))`; with `exact` no statistic and p-value (absent fields in the fixture).

## icc

With the mean squares of rule 3, `α = 1 − confLevel`, `n` subjects, `k` raters:

- oneway single: `(MSr − MSw)/(MSr + (k − 1)MSw)`; F = `MSr/MSw × (1 − r0)/(1 + (k − 1)r0)` on (n − 1, n(k − 1));
  `FL = (MSr/MSw)/qf(1 − α/2, n − 1, n(k − 1))`, `FU = (MSr/MSw) qf(1 − α/2, n(k − 1), n − 1)`; bounds `(F· − 1)/(F· + k −
  1)`.
- twoway consistency single: as oneway with MSe and df2 = (n − 1)(k − 1).
- twoway agreement single: `(MSr − MSe)/(MSr + (k − 1)MSe + (k/n)(MSc − MSe))`; with `a = k r0/(n(1 − r0))`, `b = 1 + k
  r0 (n − 1)/(n(1 − r0))`, `v = (a MSc + b MSe)² / ((a MSc)²/(k − 1) + (b MSe)²/((n − 1)(k − 1)))`: F = `MSr/(a MSc +
  b MSe)` on (n − 1, v); for the bounds the same a, b, v with the coefficient in place of r0, `FL = qf(1 − α/2, n − 1,
  v)`, `FU = qf(1 − α/2, v, n − 1)`, lower `n(MSr − FL MSe)/(FL (k MSc + (kn − k − n)MSe) + n MSr)`, upper `n(FU MSr −
  MSe)/(k MSc + (kn − k − n)MSe + n FU MSr)`.
- average: oneway `(MSr − MSw)/MSr`, F = `MSr/MSw (1 − r0)`, bounds `1 − 1/F·`; consistency the same with MSe;
  agreement `(MSr − MSe)/(MSr + (MSc − MSe)/n)`, `a = r0/(n(1 − r0))`, `b = 1 + r0(n − 1)/(n(1 − r0))`, F and v as
  above; bounds with `a = k c/(n(1 − c))`, `b = 1 + k c (n − 1)/(n(1 − c))` (c the coefficient), lower `n(MSr − FL MSe)/(FL
  (MSc − MSe) + n MSr)`, upper `n(FU MSr − MSe)/(MSc − MSe + n FU MSr)`.

p-value: the upper F tail. Result `{ value, Fvalue, df1, df2, pValue, lbound, ubound }`.

## Cronbach's alpha (psych::alpha)

C the covariance matrix and R the correlation matrix of the k items: `raw = (1 − tr C / ΣC) k/(k − 1)`, `std = (1 −
k/ΣR) k/(k − 1)`, `G6 = 1 − (k − Σ smc)/ΣR`, `averageR = (ΣR − k)/(k(k − 1))`. `alphaDrop[i]` = `raw` of the items
without item i (the fixture has at least 4 items, so at least 3 remain).

## partial.r

The correlation matrix R; with `a = {i, j}` and `b` the other columns, `P = R_aa − R_ab R_bb^-1 R_ba`; the result is
`P_ij / sqrt(P_ii P_jj)`.

## Accuracy

Relative 1e-12 to R value by value; no loosening; known differences only within 1e-12 of the fixture's reference
(the kappa p-values of rule 2), listed with reasons.
