# Power calculations and effect sizes: the behaviour to reproduce

This file describes, in words, what R 4.5.2 (stats), pwr 1.3-0 and effectsize 1.0.3 compute, for an implementation
that must give the same results without reading their source. The fixtures are made by `oracle/power.R`
(`powerStats`), `oracle/pwr.R` (`pwr`) and `oracle/effectsize.R` (`cohensD`, `etaSquared`); their header comments
describe the format (data frames and `xTypes` as in `oracle/_anova.R`). Where this file and a fixture seem to
disagree, report it: the fixture may be wrong.

## Easy to get wrong

1. **Solving a power equation reproduces R's call of `uniroot`**: the same function, interval, tolerance and
   `extendInt` as listed below, with this library's `uniroot` (`src/numerics/integrate.ts`, which follows R's rules).
   The answer is R's approximation (to about `tol` = eps^0.25 ≈ 1.2e-4), not the exact root, and must match R's
   value; the fixtures' `reference` (the root to full precision) only shows the size of R's tolerance.
2. stats `power.t.test` uses `nu = max(1e-7, n - 1) × (2 for two samples, 1 otherwise)` and, two-sided without
   `strict`, only the upper rejection region (at `sig.level/2`). pwr's `pwr.t.test` uses `nu = (n - 1) × ...`
   without the floor and always both regions for two-sided.
3. Two-sided tests replace the effect size given by its absolute value before anything else (`delta`, `d`, `h`,
   `r`), and that is what the result reports.
4. effectsize's confidence intervals solve for noncentrality parameters with a crude optimiser (about 1e-9 accurate).
   This library computes **the exact limits** (see "Intervals"); they are compared with the fixtures' `reference`.
5. One-sided intervals use the two-sided level `2 × ci − 1`, then replace the other end by `-Inf`/`Inf` (d and g)
   or `0`/`1` (eta, omega and epsilon squared). The default `alternative` is `"two.sided"` for d and g but
   **`"greater"` for the ANOVA effect sizes**.
6. The interval of an ANOVA effect size is always computed on the **eta-squared scale from the F value that the
   reported effect size implies**, also for omega and epsilon squared (see "ANOVA effect sizes").
7. A table with a single term (besides the residuals) reports the non-partial effect size even when `partial` is
   true, under the non-partial column name (`Eta2`, `Omega2`, `Epsilon2`).
8. Hedges' g multiplies d and both limits by `J(df) = Γ(df/2) / (sqrt(df/2) Γ((df − 1)/2))`.

## The functions

| Function | R |
|---|---|
| `powerTTest(options)` | `power.t.test` |
| `powerPropTest(options)` | `power.prop.test` |
| `powerAnovaTest(options)` | `power.anova.test` |
| `pwrTTest`, `pwrT2nTest`, `pwr2pTest`, `pwr2p2nTest`, `pwrPTest`, `pwrNormTest`, `pwrRTest`, `pwrChisqTest`, `pwrAnovaTest`, `pwrF2Test` | pwr's `pwr.t.test`, `pwr.t2n.test`, `pwr.2p.test`, `pwr.2p2n.test`, `pwr.p.test`, `pwr.norm.test`, `pwr.r.test`, `pwr.chisq.test`, `pwr.anova.test`, `pwr.f2.test` |
| `esH(p1, p2)`, `esW1(p0, p1)`, `esW2(p)`, `cohenES(test, size)` | pwr's `ES.h`, `ES.w1`, `ES.w2`, `cohen.ES` |
| `cohensD(x, y?, options?)`, `hedgesG(x, y?, options?)` | effectsize's `cohens_d`, `hedges_g` |
| `etaSquared(table, options?)`, `omegaSquared(table, options?)`, `epsilonSquared(table, options?)` | effectsize's `eta_squared`, `omega_squared`, `epsilon_squared` for an ANOVA table |

**Arguments of the power functions** are one options object with R's argument names in camelCase (`sig.level` →
`sigLevel`, `between.var` → `betweenVar`, `N` stays `N`). The quantity to solve for is the one given as `null`. An
argument without a default in R (`n`, `delta`, `power`, `d`, `h`, `r`, `w`, `f`, `f2`, `k`, `u`, `v`, `n1`, `n2`,
`groups`, `p1`, `p2`, `between.var`, `within.var`, `df`) counts as `null` when omitted; those with a default
(`sd = 1`, `sigLevel = 0.05`, `type`, `alternative`, `strict = false`, `tol`) take it when omitted. Exactly one must
be `null`, otherwise the error is R's (e.g. `exactly one of 'n', 'delta', 'sd', 'power', and 'sig.level' must be
NULL` for stats, `exactly one of n, d, power, and sig.level must be NULL` for pwr; each function's list as in R).
`type` and `alternative` accept R's values and unambiguous abbreviations.

**Results** of the power functions: the fields of R's result in camelCase, in R's order (`n`, `delta`, `sd`,
`sigLevel`, `power`, `alternative`, `note`, `method`, ...; `note` absent where R has none), with the solved quantity
filled in. Numbers that R returns as is (also the absolute values of rule 3) are returned as is.

Warnings that R's distribution functions give while the equation is solved (`full precision may not have been
achieved in 'pnt{final}'`) are not reproduced: this library's distribution functions give no warnings, and the tests
ignore these. Other errors and warnings are R's messages: `'sig.level' must be numeric in [0, 1]` (stats; pwr: `‘sig.level’ must be
numeric in [0, 1]` with curly quotes, as R's `sQuote` in a UTF-8 locale), the checks on `n`, `k`, `groups` and the
effect sizes listed below, and `uniroot`'s errors (`f() values at end points not of opposite sign`, ...) when the
root is not bracketed.

## stats

**power.t.test** (`n`, `delta`, `sd = 1`, `sigLevel = 0.05`, `power`, `type = "two.sample"` | `"one.sample"` |
`"paired"`, `alternative = "two.sided"` | `"one.sided"`, `strict = false`, `tol = eps^0.25`). `ts` = 2 for two
samples, 1 otherwise; `sides` = 2 for two-sided, 1 for one-sided; `nu = max(1e-7, n − 1) × ts`; `ncp = sqrt(n/ts) ×
delta/sd`; `q = qt(sigLevel/sides, nu, upper tail)`. Power = upper tail of the noncentral t at `q`; with `strict`
and two-sided, plus the lower tail at `−q`. Solving (`f(x)` = power − target):

| unknown | interval | extendInt |
|---|---|---|
| n | [2, 1e7] | upX |
| sd | delta × [1e-7, 1e7] | downX |
| delta | sd × [1e-7, 1e7] | upX |
| sigLevel | [1e-10, 1 − 1e-10] | yes |

Notes: `"n is number of *pairs*, sd is std.dev. of *differences* within pairs"` (paired), `"n is number in *each*
group"` (two samples), none for one sample. Methods `"Two-sample t test power calculation"`, `"One-sample ..."`,
`"Paired ..."`.

**power.prop.test** (`n`, `p1`, `p2`, `sigLevel`, `power`, `alternative`, `strict`, `tol`). With `z = qnorm(sigLevel
/ sides, upper tail)`: power = Φ((sqrt(n) |p1 − p2| − z sqrt((p1 + p2)(1 − (p1 + p2)/2))) / sqrt(p1(1 − p1) + p2(1 −
p2))); with `strict` and two-sided, with `pbar = (p1 + p2)/2`, `v1 = p1(1 − p1)`, `v2 = p2(1 − p2)`, `vbar = pbar(1 −
pbar)`, `d = |p1 − p2|`: Φ((sqrt(n) d − z sqrt(2 vbar)) / sqrt(v1 + v2)) + (upper tail of Φ at (sqrt(n) d + z sqrt(2
vbar)) / sqrt(v1 + v2)). Solving: n in [1, 1e7] upX; p1 in [0, p2] yes (warning `No p1 in [0, p2] can be found to
achieve the desired power` if the root is below 0); p2 in [p1, 1] yes (warning `No p2 in [p1, 1] can be found to
achieve the desired power` if above 1); sigLevel in [1e-10, 1 − 1e-10] upX (warning `No significance level [0, 1]
can be found to achieve the desired power` outside [0, 1]). Note `"n is number in *each* group"`, method
`"Two-sample comparison of proportions power calculation"`.

**power.anova.test** (`groups`, `n`, `betweenVar`, `withinVar`, `sigLevel = 0.05`, `power`). `lambda = (groups − 1)
n betweenVar/withinVar`; power = upper tail of the noncentral F(groups − 1, (n − 1) groups, lambda) at the central
upper `sigLevel` quantile. Errors `number of groups must be at least 2`, `number of observations in each group must
be at least 2`. Solving with `uniroot`'s default tolerance and no extension: groups in [2, 100], n in [2, 1e5],
withinVar in betweenVar × [1e-7, 1e7], betweenVar in withinVar × [1e-7, 1e7], sigLevel in [1e-10, 1 − 1e-10]. Note
`"n is number in each group"`, method `"Balanced one-way analysis of variance power calculation"`.

## pwr

All solve with `uniroot`'s default tolerance and no extension. `alternative` is `"two.sided"`, `"less"` or
`"greater"`. A string effect size (`"small"`, `"medium"`, `"large"`) is replaced by `cohenES`'s value for the test.
The checks on `sigLevel` and `power` give `‘sig.level’ must be numeric in [0, 1]` and `‘power’ must be numeric in [0,
1]`.

- **pwr.t.test** (`n`, `d`, `sigLevel`, `power`, `type`, `alternative`): `nu = (n − 1) ts`, `ncp = sqrt(n/ts) d`.
  less: lower tail of the noncentral t at `qt(sigLevel, nu)` (lower quantile); greater: upper tail at the upper
  `sigLevel` quantile; two-sided: with `q` the upper `sigLevel/2` quantile, upper tail at `q` plus lower tail at
  `−q`. Solving: n in [2 + 1e-10, 1e9]; d in [1e-7, 10] (two-sided), [−10, 5] (less), [−5, 10] (greater); sigLevel
  in [1e-10, 1 − 1e-10]. Notes as stats (`"n is number of *pairs*"` for paired), methods as stats.
- **pwr.t2n.test** (`n1`, `n2`, `d`, ...): two samples, `nu = n1 + n2 − 2`, `ncp = d / sqrt(1/n1 + 1/n2)`; regions
  as pwr.t.test. Errors `number of observations in the first group must be at least 2` (and `second`). Solving n1
  or n2 in [2 + 1e-10, 1e9], d and sigLevel as pwr.t.test. Method `"t test power calculation"`, no note.
- **pwr.2p.test** (`h`, `n`, ...): `z` quantities of the normal distribution with shift `h sqrt(n/2)`: greater:
  upper tail at `z(1 − sigLevel) − h sqrt(n/2)`; less: lower tail at `z(sigLevel) − h sqrt(n/2)`; two-sided: the
  upper tail at `z(1 − sigLevel/2) − h sqrt(n/2)` plus the lower tail at `z(sigLevel/2) − h sqrt(n/2)`. Error
  `number of observations in each group must be at least 1`. Solving h in [1e-10, 10] / [−10, 5] / [−5, 10], n in [2 +
  1e-10, 1e9], sigLevel as above. Note `"same sample sizes"`.
- **pwr.2p2n.test** (`h`, `n1`, `n2`, ...): as pwr.2p.test with `sqrt(n1 n2/(n1 + n2))` in place of `sqrt(n/2)`;
  errors for `n1`, `n2` below 2 as pwr.t2n.test; note `"different sample sizes"`; method with a lower-case `d`.
- **pwr.p.test** (`h`, `n`, ...): as pwr.2p.test with `sqrt(n)`; no note.
- **pwr.norm.test** (`d`, `n`, ...): as pwr.p.test with `d`; d intervals [1e-10, 10] / [−10, 5] / [−5, 10]; n in [1
  + 1e-10, 1e9].
- **pwr.r.test** (`n`, `r`, ...): `t = qt(α, n − 2)` upper quantile (α = sigLevel, two-sided sigLevel/2), `rc =
  sqrt(t²/(t² + n − 2))`, `zr = atanh(r) + r/(2(n − 1))`, `zrc = atanh(rc)`; greater: Φ((zr − zrc) sqrt(n − 3));
  two-sided: that plus Φ((−zr − zrc) sqrt(n − 3)); less: as greater with `r` replaced by `−r`. Error `number of
  observations must be at least 4`. Solving n in [4 + 1e-10, 1e9]; r in [1e-10, 1 − 1e-10] (two-sided) or [−1 +
  1e-10, 1 − 1e-10]; sigLevel as above. **When the power is computed (not solved) with `"less"`, the result's `r` is
  the negated value** (pwr changes `r` in place); when `n` or `sigLevel` is solved, `r` is reported as given.
- **pwr.chisq.test** (`w`, `N`, `df`, ...): power = upper tail of the noncentral chi-squared(df, N w²) at the upper
  `sigLevel` quantile. Errors `w must be positive` (w < 0), `number of observations must be at least 1`. Solving w
  in [1e-10, 1e9], N in [1 + 1e-10, 1e9]. Note `"N is the number of observations"`.
- **pwr.anova.test** (`k`, `n`, `f`, ...): `lambda = k n f²`, noncentral F(k − 1, (n − 1)k). Errors `f must be
  positive`, `number of groups must be at least 2`, `number of observations in each group must be at least 2`.
  Solving k in [2 + 1e-10, 100], n in [2 + 1e-10, 1e9], f in [1e-7, 1e7].
- **pwr.f2.test** (`u`, `v`, `f2`, ...): `lambda = f2 (u + v + 1)`, noncentral F(u, v). Errors `f2 must be
  positive`, `degree of freedom u for numerator must be at least 1` (and `v for denominator`). Solving u in [1 +
  1e-10, 100], v in [1 + 1e-10, 1e9], f2 in [1e-7, 1e7]. Method `"Multiple regression power calculation"`.
- `esH(p1, p2) = 2 asin(sqrt(p1)) − 2 asin(sqrt(p2))`; `esW1(p0, p1) = sqrt(Σ (p1 − p0)²/p0)`; `esW2(p)` for a matrix
  of cell probabilities: with the row sums `r` and column sums `c`, `p0 = r c'`, `sqrt(Σ (p − p0)²/p0)`;
  `cohenES(test, size)` returns `{ test, size, effectSize, method: "Conventional effect size from Cohen (1982)" }`
  with Cohen's values: p, t: 0.2, 0.5, 0.8; r, chisq: 0.1, 0.3, 0.5; anov: 0.1, 0.25, 0.4; f2: 0.02, 0.15, 0.35.

## cohensD and hedgesG

Options: `pooledSd` (default true), `mu` (0), `paired` (false), `ci` (0.95, or `null` for no interval), `alternative`
(`"two.sided"`, `"less"`, `"greater"`), and for `cohensD` `adjust` (false; true gives Hedges' g).

Missing values (NaN) are dropped, with the warning `Missing values detected. NAs dropped.`; paired samples drop the
pairs with a missing value.

- One sample (no `y`) or paired (`x − y`): `D` the mean of the values (differences), `s` their standard deviation,
  `n` their number; `se = s/sqrt(n)`, `h = 1/n`, `df = n − 1`.
- Two samples, pooled: `D = mean(x) − mean(y)`, `s` the pooled standard deviation (`sqrt(((n1 − 1) s1² + (n2 − 1)
  s2²)/(n1 + n2 − 2))`), `se = s sqrt(1/n1 + 1/n2)`, `h = 1/n1 + 1/n2`, `df = n1 + n2 − 2`.
- Two samples, not pooled: `s = sqrt((s1² + s2²)/2)`, `h = 2(n2 s1² + n1 s2²)/(n1 n2 (s1² + s2²))`, `se = sqrt(s1²/n1 +
  s2²/n2)`, `df` Welch's: `se⁴ / ((s1²/n1)²/(n1 − 1) + (s2²/n2)²/(n2 − 1))`.

The value is `(D − mu)/s`. Interval: `t = (D − mu)/se`; with `L = ci` (two-sided) or `2 ci − 1`, the
noncentrality limits are the `ncp` with `pt(t, df, ncp)` = (1 + L)/2 (lower limit) and = (1 − L)/2 (upper); the
limits of d are those times `sqrt(h)`; then `less` sets the lower limit to −Inf and `greater` the upper to Inf.
`hedgesG` multiplies the value and both limits by `J(df)`.

Result: `{ name: "Cohens_d" | "Hedges_g", value, ci, ciLow, ciHigh, warnings }` (`ci`, `ciLow`, `ciHigh` absent
without an interval).

## ANOVA effect sizes

Input: a table of this library's `anova(fit)` or `Anova(fit, { type })`, or a fit from `lm(formula, ...)` (its
`anova` table is used). Options: `partial` (default true), for `etaSquared` also `generalized` (false, true, or an
array of observed factor names), `ci` (0.95 or `null`), `alternative` (default `"greater"`).

From the table: drop the `(Intercept)` row; `dfe` and `SSe` the residual row's df and sum of squares, `MSe = SSe/dfe`;
`SStot` the sum of `Sum Sq` over the remaining rows (residuals included); `N = Σ df + 1` over the same rows. For each
term (`SS`, `df`):

- eta: partial `SS/(SS + SSe)`; non-partial `SS/SStot`; generalized `SS/(SS + SSe + O − o)` with `O` the sum of `SS`
  over the terms whose name contains an observed factor as a whole word and `o` the term's own `SS` if it is one
  (both 0 when `generalized` is true without names). An observed name found in no term: error `Observed variable not
  in data: Q`.
- omega: partial `(SS − df MSe)/(SS + (N − df) MSe)`; non-partial `(SS − df MSe)/(SStot + MSe)`; both at least 0.
- epsilon: partial `(SS − df MSe)/(SS + SSe)`; non-partial `(SS − df MSe)/SStot`; both at least 0.

Rule 7: with a single term, partial and generalized give the non-partial value under the non-partial name.

Columns: `Eta2_partial`, `Eta2`, `Eta2_generalized`, `Omega2_partial`, `Omega2`, `Epsilon2_partial`, `Epsilon2`, then
`CI`, `CI_low`, `CI_high`; rows named by the terms.

Interval: `E = max(0, effect size)`, `F = (E/df)/((1 − E)/dfe)`; `L = ci` or `2 ci − 1`. The noncentrality limits
are the `ncp ≥ 0` with `pf(F, df, dfe, ncp)` = (1 + L)/2 (lower) and (1 − L)/2 (upper), 0 where no positive one
exists; then the upper limit is 0 if `F` is at most the central F's (1 − L)/2 quantile and the lower limit is 0 if
`F` is at most its (1 + L)/2 quantile. The limits of the effect size are `ncp/(ncp + dfe)`; `less` sets the lower to
0, `greater` the upper to 1.

## Accuracy required, and how to test

As in `oracle/anova-behaviour.md`: a number passes within a relative 1e-12 of R's value; otherwise it may be listed
as a known difference only if it is within a relative 1e-12 of the fixture's `reference`. **The interval limits of
`cohensD`, `hedgesG` and the ANOVA effect sizes are compared with the reference** (R's are ~1e-9 accurate): a limit
passes within a relative 1e-12 of the reference, or within 1e-12 absolute when the reference is 0; they need not be
listed as known differences. The solved quantities of the power functions are compared with R's value (rule 1), not
with the reference. Strings (names, notes, methods, warnings, errors) must be equal. Relative errors are taken value
by value; no tolerance relative to the largest value of a case, and no loosening.
