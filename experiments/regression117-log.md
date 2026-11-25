# 1.17.0 (Tobit, beta regression, log-linear models): the record of the trial and error

The clean-room evidence for how R's behaviour was found: every attempt in order, the failed ones too, with what each
showed. Nobody read the source of R or of the GPL packages; each finding comes from the documentation and from the
output of exported functions compared with candidate formulas written for these experiments. All runs: R 4.6.2 x86_64
(`rstats-oracle-amd64:4.6.2`), AER 1.2.17, betareg 3.2.6, Formula 1.2.6, survival 3.8.12, MASS 7.3.66, scripts checked
with `scripts/r-experiment-check.mjs`. Issue #567 has the summaries.

Some scripts were edited in place between runs (marked "replaced"); the attempt is described here and the final
script keeps the search that succeeded.

## tobit and survreg (2026-11-25)

1. `regression117-tobit.R` (first version, replaced): `tobit(..., dist = "t", df = 3)` outside a `tryCatch`.
   **Failed to run**: `unused argument (df = 3)` (from `survreg.control`): tobit's t takes its degrees of freedom as
   `parms`, not `df`. The call was moved into a `tryCatch` and the error recorded.
2. (second version, replaced): `summary(tobit)$coefficients` written with `unname`. **Failed to run**: it is a
   `coeftest` object, which jsonlite cannot write; written as a plain matrix.
3. (final version): six data cases (y already clipped at 0; raw y with values below 0; both limits -0.5 and 2 clipped
   and raw; right limit only; no limits) x dist gaussian, logistic, t. Candidates against tobit's coefficients, log
   scale, log-likelihoods and variance:
   - `survreg(Surv(pmax(y, left), y > left, type = "left"))` (left limit only): difference 0 in every case.
   - `survreg(Surv(pmin(y, right), y < right))` (right limit only): difference 0.
   - `Surv(lo, hi, type = "interval2")` with `lo = NA` where `y <= left` and `hi = NA` where `y >= right`, the other
     end being y itself: difference 0 when y was already clipped, **13-22 when it was not** (the censored end must be
     the limit, not the raw y).
   **Settled:** tobit fits survreg to y clipped to [left, right], with `y <= left` left censored at `left` and
   `y >= right` right censored at `right` (a value equal to a limit counts as censored). `icoef` is the intercept-only
   fit's (difference to `tobit(y ~ 1)` 1e-16) and `loglik[1]` its log-likelihood, so McFadden's R^2 of ReactiveStat
   is `1 - loglik[2] / loglik[1]`. Fields: those of survreg plus `formula`; summary has `wald`, and prints the counts
   Total / Left-censored / Uncensored / Right-censored. `dist = "t"` with `parms = 5` gives `parms` 5.

## The Wald statistic of summary(tobit) (2026-11-25)

4. `regression117-tobit-wald.R` (first version, replaced): the candidate helper called `solve` on a 0 x 0 matrix for
   the intercept-only model. **Failed to run**; the helper returns NA there.
5. (final version): candidate `b' V^-1 b` over the coefficients other than `(Intercept)` (without Log(scale)), df = their
   number. Equal to R's `wald` to the last digit for a model with an intercept (two regressors, one, a factor, weights,
   both limits). **Without an intercept** the statistic is the same quadratic form over all coefficients (62.789 for
   x1 and x2) but R prints and tests it **on 1 Df** (the number of coefficients minus 1; p-value 2.3e-15 is
   `pchisq(62.79, 1)`'s tail). The intercept-only model has no `wald` (NULL) and prints no Wald line. Weights: tobit
   equals survreg with the same weights (difference 0). The `y` field with both limits is `type = "interval"` with
   status 0 / 1 / 2 (right / exact / left); with the left limit only it is `type = "left"`. `logLik` df = coefficients
   + 1 (scale).
