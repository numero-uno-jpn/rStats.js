# Contingency tables and proportions (rStats.js 1.2.0): the behaviour to reproduce

This file describes, in words and formulas, what the R functions below compute, for an implementation that must not
read their source. It was written by reading the R code of the packages (deparsed from the image
`rstats-oracle:4.6.2`, R 4.6.2, package snapshot of 2026-10-23) and checking each statement against their output.
Where this file and a fixture seem to disagree, report it instead of working around it.

| package | version | functions |
|---|---|---|
| DescTools | 0.99.60 | `BinomCI`, `BinomDiffCI`, `BinomRatioCI`, `GTest`, `StuartMaxwellTest`, `GoodmanKruskalGamma` |
| epitools | 0.5.10.1 | `oddsratio` (`oddsratio.wald`, `oddsratio.midp`, `oddsratio.fisher`, `or.midp`, `tab2by2.test`) |
| epiR | 3.0.0 | `epi.2by2` (`method = "cohort.count"`) |
| exact2x2 | 1.7.0 (exactci 1.4.5) | `fisher.exact`, `exact2x2`, `boschloo`, `uncondExact2x2` |
| Exact | 3.3 | `exact.test(method = "boschloo")` |
| coin | 1.4.6 (libcoin 1.0.13) | `lbl_test` |
| equivalence | 0.8.2 | `tost` |

Oracles and fixtures (`npm run oracle -- <name>`; all run in under 75 s and well under 1.5 GB):

| oracle | fixtures |
|---|---|
| `oracle/binomci.R` | `binomCI` |
| `oracle/twobytwo.R` | `binomDiffCI`, `binomRatioCI`, `oddsRatio`, `epi2by2` |
| `oracle/exact2x2.R` | `fisherExact` |
| `oracle/boschloo.R` | `boschloo` |
| `oracle/ordinaltable.R` | `gTest`, `stuartMaxwellTest`, `goodmanKruskalGamma`, `lblTest`, `chisqTestN1`, `freemanTukey` |
| `oracle/equivalence.R` | `tost` |

The fixtures keep the packages' own field names (`est`, `lwr.ci`, `upr.ci`, `midp.exact`, `RR.strata.score`, ...);
the arguments are in camelCase as in the other fixtures. Every case records the package's warnings (`warnings`) or
its error (`{"error": message}`). Where a package solves an equation inexactly, the case also has a `reference`: the
root of the same equation solved to (nearly) full double precision, which is what rStats.js should return (design
rule 2). Where the package fails with an error, no reference was written (the shared writer skips them); what
rStats.js returns there is a decision (below).

Notation: a 2×2 table of two groups is written as successes and trials `x1/n1`, `x2/n2`, `p1 = x1/n1`,
`p2 = x2/n2`, `N = n1 + n2`. `z = qnorm(1 - α/2)` for a two-sided level `1 - α`. "Two-sided limits at level c" means
the lower limit at one-sided level `1 - (1 - c)/2` and the upper likewise.

## Easy to get wrong

1. **Many package intervals are roots found with `uniroot()`'s default tolerance** (`.Machine$double.eps^0.25` ≈
   1.22e-4, absolute, on whatever scale the root is searched): `BinomCI(method = "midp")`, `BinomRatioCI(method =
   "koopman")`, `BinomDiffCI(method = "mee")`, epitools' mid-p odds ratio and its median-unbiased estimate, and
   exact2x2's mid-p limits. Their values are off by 1e-6 to 1e-4 in ordinary cases and are grossly wrong for small
   or large values: `BinomCI(5, 1e7, method = "midp")` gives `[0, 1.168e-4]` instead of `[1.832e-7, 1.108e-6]`;
   exact2x2 gives the upper mid-p limit of `[[100, 1], [1, 100]]` as `4.5036e15` (= 1/eps) instead of `198848`. The
   fixtures give the true roots as `reference`; implement the roots, not the packages' searches.
2. **Bisections with loose stopping rules**: `BinomDiffCI(method = "mn")` and epiR's attributable-risk score
   interval stop when the step is below 1e-7 or the statistic within 1e-6 of the bound (about 1e-7 relative error),
   and use `3.141592654` for π. epiR's score limits for the risk ratio at x = n step by factors of 1.0001, its odds
   ratio score limits by 1.001 — and start at 1.1 times (or 1/1.1 times) the estimate, so that **for large tables the
   epiR odds-ratio score interval is exactly `[est/1.1, est·1.1]`** (`[[1000, 2000], [3000, 4000]]`: `[0.60606,
   0.73333]`, true `[0.60962, 0.72905]`).
3. **Different "score" intervals have different names.** DescTools' `"score"` for a difference is Newcombe's hybrid
   (Wilson limits combined; method 10), not a score interval of the difference; `"mn"` is Miettinen-Nurminen (with
   the factor N/(N − 1)); `"mee"` and epiR's attributable-risk "score" are Farrington-Manning / Mee (without it).
   epiR's risk-ratio "score" is Koopman's interval (= DescTools `"koopman"`); epiR's `RR.strata.koopman` is
   Koopman's interval of the **transposed** table (a bug: `zRRkoopman` reads the cells in the other order) and must
   not be used. epiR's odds-ratio "score" is the score interval of Miettinen-Nurminen without N/(N − 1) (Cornfield's
   uncorrected χ²), which no other package in scope gives.
4. **`sides` is "left" / "right", not "less" / "greater"**, and means which limit is kept: `"left"` gives
   `[lower, 1]` (a lower one-sided bound), `"right"` gives `[0, upper]` (`[-1, upper]` for a difference). The one-sided
   level c is obtained by computing the two-sided interval at `1 - 2(1 - c)`. `BinomRatioCI` changes the level but
   then **does not replace either limit** (it returns the two-sided interval at `2c − 1` for both sides; a bug).
5. **epiR reports the attributable risk per 100** (`units = 100`): `ARisk.strata.*` are 100 × the risk difference.
6. **The epitools odds ratio for `method = "midp"` is the median-unbiased estimate**, not the conditional MLE and not
   the sample odds ratio; `"fisher"` gives the conditional MLE; `"wald"` the sample odds ratio. All three share the
   same three p-values (`midp.exact`, `fisher.exact`, `chi.square` without continuity correction).
7. **exact2x2's mid-p test is central only.** `fisher.exact(x, midp = TRUE)` uses `tsmethod = "central"` (its
   own default `"minlike"` is not passed on, because `fisher.exact` forwards only the arguments given);
   `tsmethod = "minlike"` with `midp = TRUE` and two-sided is an error. The estimate is fisher.test's conditional MLE.
8. **Boschloo p-values are suprema over a nuisance parameter**, and neither package computes the supremum: exact2x2
   takes the maximum over 98 grid points (1e-6 to 2e-4 too small), Exact refines a 100-point grid with `optimise`
   and rounds to 12 significant digits (about 1e-9 relative), and Exact's two-sided "square" test can put tables into
   the rejection region that do not belong there (see section 4).
9. **`GTest` of a table computes its p-value as `1 - pchisq(G, df)`** (0 below about 1.1e-16); the goodness-of-fit
   test uses the upper tail. Its Yates correction moves every cell by 0.5 even when that overshoots, and **away from
   independence when ad = bc** (`[[5, 5], [5, 5]]` gets G = 0.2003 instead of 0).
10. **`StuartMaxwellTest` keeps df = (original number of categories) − 1** after dropping categories whose row and
    column are empty off the diagonal.
11. **coin's linear-by-linear Z changes sign for a factor with two levels** (coin treats it as unordered and codes
    it by an indicator), and a 2×2 table is an error. For both factors with more than two levels
    `Z = sqrt(N − 1) r`, r the Pearson correlation of the level indices.
12. **Input checks are thin.** `BinomCI` accepts x > n, negative or non-integer x and returns NaN with a warning or
    a number; `BinomDiffCI` checks nothing (conf.level 1.5 gives NaN); `BinomRatioCI` only x ≤ n; epiR fails with
    internal errors (`object 'ceval.p' not found`) for many tables with a zero cell. The design rules (input without a
    defined result is an error) apply instead; the fixtures record the packages' behaviour for reference.

## 1. One proportion: `DescTools::BinomCI`

`BinomCI(x, n, conf.level = 0.95, sides = c("two.sided", "left", "right"), method = "wilson", ...)`. The
arguments are recycled (vectorised); the result is a matrix with columns `est`, `lwr.ci`, `upr.ci` (one row per
case, row names from the varying arguments). rStats.js needs the scalar case.

Checks, in order: length of x, n, conf.level 1 each ("'x' has to be of length 1 (number of successes)" etc.);
`conf.level < 0.5 | conf.level > 1` → error `'conf.level' has to be in [0.5, 1]` (NaN gives R's "missing value
where TRUE/FALSE needed"); `method` and `sides` by `match.arg` (partial matching: `"clopper"`, `"l"`, `"two"`
work; `"wil"` is ambiguous, error `'arg' should be one of “wilson”, “wald”, ...` listing all 16 methods). Nothing
else is checked.

Level: for `sides != "two.sided"`, `conf.level <- 1 - 2(1 - conf.level)` (so 0.5 one-sided becomes 0). Then
`α = 1 - conf.level`, `κ = qnorm(1 - α/2)`, `p̂ = x/n`, `q̂ = 1 - p̂`, `est = p̂` (all methods, with the default
`std_est = TRUE`).

| method | lower, upper (before clipping) |
|---|---|
| `wald` | `p̂ ∓ κ sqrt(p̂ q̂ / n)` |
| `wilson` | `(x + κ²/2)/(n + κ²) ∓ κ sqrt(n)/(n + κ²) · sqrt(p̂ q̂ + κ²/(4n))` |
| `wilsoncc` | `[2x + κ² − 1 − κ sqrt(κ² − 2 − 1/n + 4 p̂ (n q̂ + 1))] / (2(n + κ²))` and `[2x + κ² + 1 + κ sqrt(κ² + 2 − 1/n + 4 p̂ (n q̂ − 1))] / (2(n + κ²))`; lower 0 when p̂ = 0, upper 1 when p̂ = 1 (Newcombe's method 4) |
| `agresti-coull` | with `ñ = n + κ²`, `p̃ = (x + κ²/2)/ñ`: `p̃ ∓ κ sqrt(p̃(1 − p̃)/ñ)`; est stays p̂ |
| `jeffreys` | `qbeta(α/2, x + ½, n − x + ½)`, `qbeta(1 − α/2, x + ½, n − x + ½)`; lower 0 when x = 0, upper 1 when x = n (no level adjustment at the ends) |
| `clopper-pearson` | `qbeta(α/2, x, n − x + 1)`, `qbeta(1 − α/2, x + 1, n − x)` (qbeta with a shape 0 gives 0 or 1) |
| `midp` | lower: the p in (0, p̂) with `½ dbinom(x; n, p) + P(X > x; n, p) = α/2` (0 when x = 0); upper: the p in (p̂, 1) with `½ dbinom(x; n, p) + P(X < x; n, p) = α/2` (1 when x = n) |

Then `lwr.ci = max(0, lower)`, `upr.ci = min(1, upper)` (with R's `max`/`min`, which propagate NaN), and finally
`"left"` sets `upr.ci = 1`, `"right"` sets `lwr.ci = 0`.

Mid-p: DescTools uses `uniroot(f, interval = c(0, p̂))` and `c(p̂, 1)` with the default tolerance (absolute
1.22e-4): see "Easy to get wrong" 1. The equations' left sides are monotone in p over all of (0, 1), so the true
roots are unique; at x = n the lower limit is `α^(1/n)` and at x = 0 the upper is `1 − α^(1/n)`. The fixture's
`reference` has the roots to a relative 1e-13 (log scale of p). With one-sided conf.level 0.5 (α/2 = 0.5) the root
is not inside DescTools' bracket and it fails with `f() values at end points not of opposite sign` (the reference
gives the root; at x = 0 the upper limit is then 0). The midp method uses `dbinom`, so non-integer x warns
`non-integer x = 2.500000` and gives a number; x > n, x < 0 or n = Inf fail in uniroot.

Boundaries and rounding (fixture):
- `wald` at x = 0 or n is `[0, 0]` / `[1, 1]`.
- `wilson` at x = 0 gives lower exactly 0 in the cases tried; at x = n with conf.level 0.5 the upper is
  `0.99999999999999989`, not 1 (cancellation in `term1 + term2`; the correct value is 1).
- `conf.level = 1`: κ = Inf; `wilson`, `wilsoncc`, `agresti-coull` give NaN limits (no warning), `wald`,
  `clopper-pearson`, `jeffreys`, `midp` give `[0, 1]`.
- x > n or x < 0: NaN limits with the warning `NaNs produced` for most methods, a number for some
  (`agresti-coull` with x = 11, n = 10 gives `[0.8022, 1]`); x = 0, n = 0 gives est NaN and `[0, 1]` or NaN (`NA`
  for wilsoncc); non-integer x is used as is (except the beta/binomial methods' own handling). All of these are
  errors under the design rules.

## 2. Two proportions

### 2.1 Risk difference: `DescTools::BinomDiffCI`

`BinomDiffCI(x1, n1, x2, n2, conf.level = 0.95, sides = c("two.sided", "left", "right"), method = c("ac", "wald",
"waldcc", "score", "scorecc", "mn", "mee", "blj", "ha", "hal", "jp"))`. **Default method `"ac"`** (Agresti-Caffo).
Same level rule as BinomCI (`sides` → `1 − 2(1 − c)`), est = `p1 − p2`. No argument checks besides `match.arg`
(`"m"` is ambiguous between mn and mee; conf.level outside [0, 1] gives NaN with a warning).

- `wald`: `est ∓ κ sqrt(p1 q1/n1 + p2 q2/n2)`, clipped to [−1, 1]. At p1, p2 ∈ {0, 1} the interval is a point.
- `ac`: the Wald interval after adding one success and one failure to each group (`x + 1`, `n + 2`), centred at the
  adjusted difference; est stays `p1 − p2`; clipped to [−1, 1].
- `score` (Newcombe 1998, method 10): with Wilson limits `(l1, u1)` of x1/n1 and `(l2, u2)` of x2/n2 at the same
  (adjusted) level, `lower = est − κ sqrt(l1(1 − l1)/n1 + u2(1 − u2)/n2)`, `upper = est + κ sqrt(u1(1 − u1)/n1 +
  l2(1 − l2)/n2)`. Equivalent to Newcombe's `est − sqrt((p1 − l1)² + (u2 − p2)²)` because Wilson limits satisfy
  `(p − l)² = κ² l(1 − l)/n`. No clipping (not needed). At conf.level 1 the Wilson limits are NaN and so is this.
- `mn` (Miettinen-Nurminen 1985): the interval `{δ : T(δ) ≤ qchisq(c, 1)}` where
  `T(δ) = (p1 − p2 − δ)² / [ (p̃1(1 − p̃1)/n1 + p̃2(1 − p̃2)/n2) · N/(N − 1) ]` and `(p̃1, p̃2)` is the maximum
  likelihood estimate under `p1 − p2 = δ` (T = 0 when `p1 − p2 = δ`). The restricted MLE has the closed form of
  Farrington and Manning (1990): with `t = n2/n1`, `a = 1 + t`, `b = −(1 + t + p1 + t p2 + δ(t + 2))`,
  `c = δ² + δ(2 p1 + t + 1) + p1 + t p2`, `d = −p1 δ(1 + δ)`, `v = (b/(3a))³ − bc/(6a²) + d/(2a)`,
  `u = sign(v) sqrt((b/(3a))² − c/(3a))`, `w = (π + acos(v/u³))/3`: `p̃1 = 2u cos(w) − b/(3a)`, `p̃2 = p̃1 − δ`.
  DescTools finds each limit by a bisection: lower limit from `p̂ = est`, `dp = 1 + est`, upper from `dp = 1 − est`;
  each step halves dp, tries `y = p̂ ∓ dp`, moves p̂ to y when `T(y) < bound`, and stops when `dp < 1e-7` or
  `|bound − T(y)| < 1e-6` (at most 50 steps), returning the last y; π is `3.141592654`. Errors about 1e-7
  relative (fixture: up to 7e-8 in ordinary cases). Clipped to [−1, 1]. At est = 0 with symmetric data the limits are
  symmetric. **Reference**: the roots of T(δ) = bound in mpfr (128 bits). The variance can be 0 at the boundary
  (p̃ ∈ {0, 1}): T is then +Inf (treat as "outside").
- `mee` (Farrington-Manning / Mee 1984): the same without the factor N/(N − 1), but DescTools solves
  `2 min(Φ(z), 1 − Φ(z)) = α` with `z = (est − δ)/sqrt(var)` by `uniroot` on `(−1 + 1e-6, est − 1e-6)` and
  `(est + 1e-6, 1 − 1e-6)` with the default tolerance (errors up to 1e-5 absolute, 8% relative for tiny
  differences); it also sets `v = 0` when `|v| < eps`. Reference: the exact roots (as for mn). Included because it
  is epiR's attributable-risk score interval.
- Finally `lwr.ci = min(lower, upper)`, `upr.ci = max(lower, upper)`; `"left"` sets `upr.ci = 1`, `"right"` sets
  `lwr.ci = −1`.

Boundaries: x1 = 0 and x2 = 0 gives est 0 and a symmetric interval (`score`: ±0.2775 = the Wilson upper limit for
0/10; `mn`: ±0.2879); `[0/10, 10/10]` gives est −1 with lower −1. x > n is not checked (NaN or numbers).

### 2.2 Risk ratio: `DescTools::BinomRatioCI`

`BinomRatioCI(x1, n1, x2, n2, conf.level = 0.95, sides, method = c("katz.log", "adj.log", "bailey", "koopman",
"noether", "sinh-1", "boot"), tol = .Machine$double.eps^0.25, R = 1000)`. Default `"katz.log"`. Ratio
`p1/p2 = (x1/n1)/(x2/n2)`. Check: `x1 > n1 or x2 > n2` → error `Use correct parameterization for x1, x2, n1, and n2`.
The level: `conf <- 1 − 2(1 − conf)` for one-sided `sides`, `z = qnorm(1 − (1 − conf)/2)`, `χ² = qchisq(conf, 1)`;
**the result is not modified for `sides`** (Easy to get wrong 4). Result columns `est`, `lwr.ci`, `upr.ci` (no
clipping).

`katz.log` (Katz et al. 1978), with `V = 1/x1 − 1/n1 + 1/x2 − 1/n2`:
- general: `est · exp(∓ z sqrt(V))`;
- x1 = 0, x2 > 0: est 0, lower 0, upper from the formula with x1 replaced by 0.5 (`(0.5/n1)/(x2/n2) · exp(z
  sqrt(V))`, V with 1/0.5);
- x1 > 0, x2 = 0: est Inf, upper Inf, lower with x2 replaced by 0.5;
- x1 = x2 = 0: est 0 (sic), `[0, Inf]`;
- x1 = n1 and x2 = n2: est 1, both limits with x1 → n1 − 0.5 and x2 → n2 − 0.5 (V would be 0 otherwise).

`koopman` (Koopman 1984): the interval `{φ : U(φ) ≤ χ²}` where U is Pearson's statistic at the MLE under `p1 = φ p2`:
`U(φ) = (x1 − n1 p̃1)²/(n1 p̃1(1 − p̃1)) + (x2 − n2 p̃2)²/(n2 p̃2(1 − p̃2))`, `p̃2 = p̃1/φ`, and p̃1 is the smaller root
of `(n1 + n2) p² − (φ(n1 + x2) + x1 + n2) p + φ(x1 + x2) = 0`, **capped at min(1, φ)** (the cap matters at
x1 = n1 or x2 = n2: then one term is 0/0 and counts as 0). Nam (1995) solves the limits in closed form (a cubic);
the trigonometric solution is what DescTools uses for some boundary cases and what epiR uses throughout.
DescTools' algorithm:
- x1 = x2 = 0: est 0, `[0, Inf]`;
- general (0 < x1 < n1, 0 < x2 < n2): `uniroot(U − χ², c(La, Lb), tol)` and `c(Ha, Hb)` with
  `La = est e^{−z√V}/4`, `Lb = Ha = est`, `Hb = 4 est e^{z√V}` (V as in katz.log) and `tol = 1.22e-4` absolute: errors
  up to about 1e-4 relative;
- x1 = 0 (x2 < n2): lower 0, upper by uniroot (V and the starting ratio with x1 + 0.5);
- x2 = 0: upper Inf; lower by uniroot, or the closed form when x1 = n1;
- x1 = n1, x2 = n2: est 1; the limits are the roots of `n1(1 − φ)/φ = χ²` (φ ≤ 1) and `n2(φ − 1) = χ²` (φ > 1),
  i.e. `n1/(n1 + χ²)` and `1 + χ²/n2`, found by uniroot (epiR uses the closed forms);
- x1 = n1, x2 < n2: upper by the closed form, lower by stepping `φ ← 1.0001 φ` from `1.1 p2/p1` until a signed score
  statistic falls below −z, then `1/φ` (relative error about 1e-4);
- x2 = n2, x1 < n1: both limits by stepping by 1.0001 (lower: from `0.95 est` downwards).
The fixture's `reference` has the roots of U = χ² in mpfr (they agree with the closed forms to 1e-14 and with
DescTools to its tolerance). Degenerate exception: `1/1` vs `0/1` gives DescTools lower 2 (its closed form at
x1 = n1, x2 = 0) where the root of U is 0.5206.

### 2.3 Odds ratio: `epitools::oddsratio`

`oddsratio(x, method = c("midp", "fisher", "wald", "small"), conf.level = 0.95, rev = "neither", correction =
FALSE)`. **Default `"midp"`.** x is a table with **rows = exposure (row 1 the reference) and columns = outcome
(column 1 = no disease)**; for a 2×2 table the odds ratio is `x11 x22 / (x12 x21)` (symmetric in the orientation).
The result is a list: `measure` (rows per exposure level; row 2 has `estimate`, `lower`, `upper`), `p.value`
(row 2: `midp.exact`, `fisher.exact`, `chi.square`), `correction`, and `attr(, "method")`. The fixture has row 2
and the method string.

- `wald` ("Unconditional MLE & normal approximation (Wald) CI"): `est = x11 x22/(x12 x21)`,
  `exp(log(est) ∓ z sqrt(1/x11 + 1/x12 + 1/x21 + 1/x22))`. **No zero-cell correction**: a zero cell gives est 0 or
  Inf and NaN limits (`[0, 0, NaN]`, `[Inf, NaN, Inf]`; 0/0 gives NaN throughout).
- `fisher` ("Conditional MLE & exact CI from 'fisher.test'"): `fisher.test(x, conf.level)`'s estimate and interval
  (rStats.js `fisherTest`).
- `midp` ("median-unbiased estimate & mid-p exact CI"), with X the (1,1) cell of Fisher's noncentral
  hypergeometric distribution given the margins and observed value a:
  - estimate: the ψ with `P(X ≤ a; ψ) − P(X ≥ a; ψ) = 0` (the median-unbiased estimate);
  - lower: ψ with `P(X > a; ψ) + ½ P(X = a; ψ) = α/2`; upper: ψ with `P(X < a; ψ) + ½ P(X = a; ψ) = α/2`.
  epitools solves the estimate and lower limit by `uniroot` on `[0, 1000]` and the upper as `1/root` of the
  reciprocal on `[0, 1000]`, tolerance 1.22e-4 absolute (so the upper limit is very inaccurate above about 1e3, and
  any root outside `[0.001, 1000]` is an error), calling `fisher.test` for every tail. **Zero cells (estimate 0 or
  Inf) and odds ratios beyond 1000 are errors** (`f() values at end points not of opposite sign`, e.g.
  `[[100, 1], [1, 100]]`). Reference: the roots on the log scale (relative 1e-14), with 0 / Inf at the ends of the
  support.
- p-values (`tab2by2.test`, the same for all methods): `fisher.exact` = fisher.test's two-sided p; `chi.square` =
  `chisq.test(correct = FALSE)` (warns "Chi-squared approximation may be incorrect" for small expected counts; the
  warning is in the fixture); `midp.exact` = `2 min(m, 1 − m)` with `m = P(X < a) + ½ P(X = a)` at ψ = 1 (doubled
  one-sided mid-p). `correction = TRUE` uses Yates for chi.square only.
- `rev` reverses rows / columns before everything (for 2×2: the OR becomes its reciprocal). Negative entries: error
  `all entries of 'x' must be nonnegative and finite` (from fisher.test); non-integer cells are rounded by
  fisher.test with its warning (wald uses them as is).

### 2.4 `epiR::epi.2by2(dat, method = "cohort.count", conf.level = 0.95, units = 100, outcome = "as.columns")`

Table layout: **row 1 exposed, row 2 unexposed; column 1 outcome +, column 2 outcome −**; cells `a = [1,1]`,
`b = [1,2]`, `c = [2,1]`, `d = [2,2]`, `N1 = a + b`, `N0 = c + d`. Check: `conf.level <= 0 | >= 1` → error
`Argument 'conf.level' for this function must be greater than 0 and less than 1.` The result's `massoc.detail`
(for one stratum, the "crude" values, without the NaN replacement that the stratum-wise code applies) has data
frames `est`, `lower`, `upper`; the fixture records:

| field | method | same as |
|---|---|---|
| `RR.strata.wald` | `(a/N1)/(c/N0)`, `exp(log RR ∓ z sqrt(1/a − 1/N1 + 1/c − 1/N0))`, no zero correction | DescTools `katz.log` where all of a, c > 0 and not (a = N1 and c = N0); differs at zeros |
| `RR.strata.score` | Koopman's interval via Nam's closed-form cubic (`zRRscore`); at a = N1 or c = N0 one limit is found by stepping by 1.0001 | Koopman (DescTools `koopman`): the closed-form limits agree with the true roots to 1e-14; DescTools' uniroot limits to 1e-4 |
| `OR.strata.wald` | `ad/(bc)`, `exp(log OR ∓ z sqrt(1/a + 1/b + 1/c + 1/d))` | epitools `wald` |
| `OR.strata.score` | score interval of the odds ratio (below) | none in scope (extra method) |
| `OR.strata.mle` | `fisher.test` estimate and interval | epitools `fisher` |
| `ARisk.strata.wald` | `100 (a/N1 − c/N0) ∓ 100 z sqrt(a(N1 − a)/N1³ + c(N0 − c)/N0³)`, no clipping | DescTools `wald` × 100 (DescTools clips to [−1, 1]) |
| `ARisk.strata.score` | Farrington-Manning / Mee interval by the bisection of DescTools' mn (1e-7), times 100 | DescTools `mee` (whose uniroot is less accurate); **not** `mn` |

The odds-ratio score interval (`zORscore`/`zlimit`, as in PropCIs::orscoreci): for a candidate odds ratio θ,
the restricted MLE has `p̃2` = the root `(−B + sqrt(B² − 4AC))/(2A)` of `A p² + B p + C = 0` with
`A = n2(θ − 1)`, `B = n1 θ + n2 − (x1 + x2)(θ − 1)`, `C = −(x1 + x2)` (`p̃2 = (x1 + x2)/N` when |θ − 1| < 1e-10), and
`p̃1 = p̃2 θ/(1 + p̃2(θ − 1))`; the statistic is `(n1(p1 − p̃1))² (1/(n1 p̃1(1 − p̃1)) + 1/(n2 p̃2(1 − p̃2)))` (no
N/(N − 1)), compared with `qchisq(c, 1)`. epiR steps θ by factors 1.001 from `est·1.1` upwards (upper) or `est/1.1`
downwards (lower) and returns the first θ where the statistic exceeds the bound: 0.1% resolution, and wrong when the
true limit lies within the starting factor 1.1 (Easy to get wrong 2). Zero cells: x1 = 0 or x2 = n2: lower 0, upper
stepping from `0.01/n2`; x1 = n1 or x2 = 0: upper Inf, lower stepping down from `100 n1`; both zero (or both full):
`[0, Inf]`. Reference: the roots in mpfr.

Failures: epi.2by2 stops with internal errors for tables with a zero cell in several positions (`a = 0`:
`object 'ceval.p' not found`; a zero column: `missing value where TRUE/FALSE needed`); `[[10, 0], [5, 5]]` works.
It also computes Cornfield limits, IRRs etc. (not in scope); `conf.level = 0.5` works.

**Same implementation, checked against both**: risk-ratio Wald (epiR = DescTools katz.log away from zeros), risk-ratio
score (= Koopman, references identical), odds-ratio Wald (= epitools wald), odds-ratio MLE (= fisherTest),
attributable-risk Wald (= wald × units, without clipping). **Extra needed** for epiR: the Farrington-Manning (mee)
difference interval and the odds-ratio score interval.

## 3. Fisher's exact test, mid-p (exact2x2 `fisher.exact`)

`fisher.exact(x, or = 1, alternative = "two.sided", tsmethod = "minlike", conf.int = TRUE, conf.level = 0.95,
tol = 1e-05, midp = FALSE)` calls `exact2x2(...)` with **only the arguments given**. In exact2x2: `tsmethod`
NULL becomes `"central"` if `midp` (or `paired`), else `"minlike"`; `char.expand` matches abbreviations of
alternative (`"g"` works; no match → error `no match`); `midp & two.sided & tsmethod in (minlike, blaker)` → error
`midp option not supported for tsmethod='minlike' or 'blaker' ` (trailing space); a table that is not 2×2 → `table
must be 2 by 2`; negative / NaN cells → `all entries of 'x' must be nonnegative and finite`; non-integer cells are
rounded with the warning `'x' has been rounded to integer: Mean relative difference: …` (fisher.test's text).
`or < 0` → fisher.test's error `'or' must be a single number between 0 and Inf`.

Mid-p (the fixture's main part). X the (1,1) cell, support `lo..hi`, observed a; at odds ratio ψ:
`pless(ψ) = P(X ≤ a) − ½ P(X = a)`, `pgreater(ψ) = P(X ≥ a) − ½ P(X = a)`; at ψ = 1 from phyper/dhyper, ψ = 0 and
Inf as point masses at lo and hi (`pless = [a ≥ lo] − ½[a = lo]` etc.); otherwise the density
`dhyper(support) ψ^support`, normalised (computed as `exp(d − max d)`).
- p-value: less → `pless(or)`, greater → `pgreater(or)`, two-sided → `min(1, 2 min(pless, pgreater))`.
- interval at α = 1 − conf.level (two-sided: α/2 for each limit; less: `[0, U(α)]`; greater: `[L(α), Inf]`):
  - `U(α)`: Inf if a = hi; 0 if a = lo and α ≥ ½; else the ψ with `pless(ψ) = α` (1 exactly if `pless(1) = α`);
  - `L(α)`: 0 if a = lo; Inf if a = hi and α ≥ ½; else the ψ with `pgreater(ψ) = α`.
  exact2x2 solves on ψ ∈ (0, 1) or on 1/ψ ∈ (eps, 1) with uniroot's default tolerance (Easy to get wrong 1; the
  upper limit of `[[3, 1], [1, 3]]` is 311.44 instead of 308.56). Reference: the roots on the log scale.
  `conf.level = 1` is an error (`f() values at end points not of opposite sign`); `conf.level = 0` gives a point
  interval at the mid-p median.
- estimate, null value, `alternative`: from `fisher.test(x, or, alternative, conf.int = FALSE)` (conditional MLE;
  `estimate` name "odds ratio"). `method`: `"Central Fisher's Exact Test (mid-p version)"` (two-sided) or
  `"One-sided Fisher's Exact Test (mid-p version)"`. `conf.int = FALSE` → no interval.
- `or = 0` or `Inf`: p-value 0 unless a is at that end of the support.

Without mid-p (in the fixture for comparison; a decision whether to offer them):
- `tsmethod = "central"`: p = `min(1, 2 min(P(X ≤ a), P(X ≥ a)))`, interval = fisher.test's (the central one),
  method `"Central Fisher's Exact Test"`.
- `tsmethod = "minlike"` (fisher.exact's default): p = fisher.test's, **interval = `exact2x2CI`, the matching
  interval** of the minimum-likelihood test (the set of ψ whose minlike p-value exceeds α; Fay 2010), found by a grid
  refinement to an absolute tolerance `tol = 1e-5` on ψ in `[1e-10, 1e10]` and then **rounded to
  `floor(−log10(tol)) − 1` = 4 decimals** (`[[3, 1], [1, 3]]`: `[0.3136, 306.2368]`). method `"Two-sided Fisher's
  Exact Test (usual method using minimum likelihood)"`. One-sided without mid-p: fisher.test's p and interval,
  method `"One-sided Fisher's Exact Test"`.

## 4. Boschloo's test (2×2, rows fixed)

Model: X1 ~ Bin(n1, π1), X2 ~ Bin(n2, π2) independent; H0 π1 = π2 = π (π unknown). Statistic: Fisher's conditional
p-value T(x1, x2) of each table (one-sided, or two-sided). Boschloo's p-value is
`sup over π ∈ (0, 1) of Σ_{tables with T ≤ T(observed)} P(X1 = i) P(X2 = j)`.

### Exact::exact.test(data, method = "boschloo", alternative, tsmethod = c("square", "central"), npNumbers = 100, ...)

- `data` is a 2×2 matrix; with `cond.row = TRUE` (default) the **rows** are the groups, successes in column 1.
  Checks: `Input 2x2 table`, `Data cannot have negative entries`, `Data must only contain integers`, and a zero row
  `Can't have a sample size of 0 for one of the groups`.
- `alternative = "less"` means π1 < π2. The groups are swapped when `alternative = "greater"` or (two-sided and
  `p1 − p2 > 0`), so the computation is always "less".
- Statistic: `T = phyper(x1, n1, n2, x1 + x2)` (one-sided), or for two-sided `"square"` Fisher's two-sided p-value
  (probabilities at most `(1 + 1e-7)` times the observed one). **T is rounded with `signif(T, 12)`** and the region
  is `signif(T, 12) ≤ signif(T0, 12)`.
- The rejection region is not evaluated table by table: Exact assumes Barnard's convexity: all tables with
  `X1 ≤ x1, X2 ≥ x2` are in it, and in each row it stops evaluating when a monotonicity shortcut says the rest of
  the row is in (or the rest of the column is out). For the one-sided statistic this is exact; **for the two-sided
  "square" statistic it can be wrong**: for `20/60` vs `9/25` it puts the tables (6, 2) and (54, 23), whose Fisher
  p-value is 1, into the region, and its p-value 0.785623 exceeds the true 0.785614. For two-sided the region is then
  mirrored, (i, j) → (n1 − i, n2 − j).
- `"central"`: the one-sided test in the direction of the data (after the swap), p doubled (`(1 + doublePvalue)`),
  capped at 1. This equals `2 min(p_less, p_greater)` except when the smaller one-sided p is not in the direction of
  the observed difference.
- Nuisance parameter: `int = seq(1e-5, 0.99999, length = npNumbers)` (100 points), the probability of the region at
  each, `signif((1 + double) prob + beta, 12)`, capped at 1, maximum over the grid; then with `ref.pvalue = TRUE`
  (default) `optimise()` (default tolerance 1.22e-4 on π) on `[np − 1/100, np + 1/100]` around every grid maximum,
  and the p-value is the larger, again `signif(, 12)`. With `np.interval = TRUE` (Berger-Boos, off by default) the
  grid is restricted to a `1 − beta` interval and beta added.
- Result (htest): `statistic` = T0 (named "test statistic"), `parameter` = the two sample sizes, `p.value`,
  `estimate` = `p1 − p2` ("difference in proportion"), `null.value` 0, `np` (nuisance parameter(s) at the maximum),
  `method = "Boschloo's Exact Test"`, `tsmethod`. Intervals: `conf.int = TRUE` is an error for two-sided square.

### exact2x2::boschloo(x1, n1, x2, n2, alternative, or = NULL, conf.int = FALSE, midp = FALSE, tsmethod = c("central", "minlike"))

- Parametrised by the odds ratio of **group 2 to group 1** (`p2(1 − p1)/(p1(1 − p2))`): `alternative = "less"` means
  π2 < π1, the opposite of Exact. **Default two-sided method `"central"`** (Exact's default is "square").
- Statistic: exact2x2's Fisher p-value of the matrix `[[x2, x1], [n2 − x2, n1 − x1]]` (one-sided; `"minlike"` uses
  fisher.test's two-sided p); midp = TRUE uses the mid-p statistic and counts ties with weight ½.
- Region: `T < T0` plus `T == T0` with **exact floating-point equality** (no tolerance; tables with mathematically
  equal p-values may be split).
- Nuisance parameter: `PI1 = seq(0, 1, length = nPgrid = 100)` minus the points where the odds ratio is undefined
  (0 and 1): **98 points k/99, maximum over them, no refinement** (1e-6 to 2e-4 relative below the supremum in the
  fixture). The tables (0, 0) and (n1, n2) are left out of the sums (no information about the odds ratio); x1 + x2 =
  0 or = n1 + n2 gives p = 1.
- central two-sided: `min(1, 2 p_less, 2 p_greater)` of the two one-sided runs. Method strings `"Boschloo's test"`.

### Reproducibility, reference and cost

- Both are deterministic: exact2x2's grid maximum can be reproduced exactly (same 98 points, same equality rule for
  ties); Exact's needs R's `optimise` (Brent's fmin with its tolerance) and the 12-digit rounding reproduced, and its
  region shortcut for two-sided square.
- The supremum itself: the fixture's `reference` uses the full region (`T ≤ (1 + 1e-7) T0`), a 999-point grid and
  Brent's method (tolerance 1e-13) around every grid local maximum within 1e-3 of the largest. It agrees with Exact to
  about 1e-11 relative for small n and 6e-9 for n = 200 (one-sided and central), except the "square" region bug.
- Cost (R in the container): Exact one-sided 200 vs 200: 0.4 s, two-sided square 1.1 s; exact2x2 one-sided 200 vs
  200: 8.4 s; the reference 0.1 s / 0.2 s with matrix products. For an implementation: (n1 + 1)(n2 + 1) Fisher
  p-values (one-sided: one phyper each; two-sided: one hypergeometric distribution per value of x1 + x2, about
  N² / 2 work), then each evaluation of the region probability is `b1ᵀ R b2` (O(n1 n2) = 40 401 for 200 × 200);
  1000 grid points plus refinement is about 4e7 operations — well under a second in JavaScript, also for n of
  several hundred. The region probability is a polynomial of degree N in π and can have several local maxima, so a
  grid much finer than 100 points plus refinement of every candidate is needed for the true supremum.

## 5. Other tests of r×c tables

### 5.1 G-test: `DescTools::GTest(x, y = NULL, correct = c("none", "williams", "yates"), p = rep(1/length(x), length(x)), rescale.p = FALSE)`

Checks: negative or NA entries → `all entries of x must be nonnegative and finite`; sum 0 → `at least one entry of x
must be positive`; `correct` by match.arg. A matrix with one row or column is treated as a vector.

Table (independence): `E = rowsum ⊗ colsum / n`, `G = 2 Σ_{x_ij ≠ 0} x_ij log(x_ij / E_ij) / q`,
df `(r − 1)(c − 1)` (**counting empty rows and columns**; a table with a zero row gives G = 0, df 2 for 2×3),
**p-value `1 − pchisq(G, df)`**.
- `williams`: `q = 1 + (n Σ_i 1/R_i − 1)(n Σ_j 1/C_j − 1) / (6 n (r − 1)(c − 1))` (a zero margin gives Inf).
- `yates` (2×2 only, else error `Yates' correction requires a 2 x 2 matrix`): if `x11 x22 − x12 x21 > 0`, the
  off-diagonal cells + 0.5 and the diagonal − 0.5; **otherwise** (also when equal) the off-diagonal − 0.5 and the
  diagonal + 0.5. No capping: `[[0, 1], [0, 1]]` becomes `[[0.5, 0.5], [−0.5, 1.5]]` and G is NaN with the warning
  `NaNs produced`. `observed` in the result is the corrected table.

Vector (goodness of fit): checks `x must at least have 2 elements`, `'x' and 'p' must have the same number of
elements`, `probabilities must be non-negative.`, `probabilities must sum to 1.` (tolerance sqrt(eps); with
`rescale.p` p is rescaled instead). `E = n p`, G as above, df `k − 1`, p-value `pchisq(G, df, lower.tail = FALSE)`.
`williams`: `q = 1 + (k + 1)/(6n)`. `yates` (k = 2 only, else `Yates' correction requires 2 data values`): if
`x1 − E1 > 0.25`, x1 − 0.5 and x2 + 0.5; if `E1 − x1 > 0.25` the opposite; else nothing.

Result: `statistic` "G", `parameter` named **"X-squared df"**, `p.value`, `method` one of "Log likelihood ratio
(G-test) test of independence without correction" / "with Williams' correction" / "with Yates' correction", "Log
likelihood ratio (G-test) goodness of fit test"; `observed`, `expected`. Reference: the upper-tail p-value of the
table cases.

### 5.2 Stuart-Maxwell test: `DescTools::StuartMaxwellTest(x, y = NULL)`

Checks: `'x' must be square with at least two rows and columns`, `all entries of 'x' must be nonnegative and
finite`. Categories i with `x_ii == rowsum_i == colsum_i` (no off-diagonal counts) are removed; fewer than 2 left →
error `Too many equal marginals, cannot compute`. With K the remaining categories, `d = (rowsums − colsums)[1..K−1]`,
`S_ii = r_i + c_i − 2 x_ii`, `S_ij = −(x_ij + x_ji)`; statistic `dᵀ S⁻¹ d` (R's `solve`; a singular S would be an
error), **df = r − 1 with r the original size**, p upper tail. Names: "chi-squared", "df", method "Stuart-Maxwell
test", plus `N` (the total of the reduced table). For 2×2 it equals McNemar's test without correction (to the last
bit or so).

### 5.3 Goodman and Kruskal's gamma: `DescTools::GoodmanKruskalGamma(x, y = NULL, conf.level = NA)`

For cell (i, j): `Πc_ij` = sum of the cells strictly above-left plus strictly below-right, `Πd_ij` = above-right
plus below-left; `C = Σ x Πc / 2`, `D = Σ x Πd / 2` (concordant and discordant pairs). `γ = (C − D)/(C + D)`.
ASE: `ψ_ij = 2(D Πc_ij − C Πd_ij)/(C + D)²`, `σ² = Σ x ψ² − (Σ x ψ)²` (the second sum is 0 mathematically; this is
the non-null ASE1 of Agresti / SAS). With `conf.level` (not NA): `[max(−1, γ − z σ), min(1, γ + z σ)]` and the
named vector `gamma, lwr.ci, upr.ci`; otherwise γ alone. C + D = 0 gives NaN (no warning). No checks on the table
(a one-row table gives NaN); conf.level 1 gives [−1, 1].

### 5.4 Linear-by-linear association: `coin::lbl_test(table)` (asymptotic, default scores)

Factors with more than two levels become ordered with scores 1..k (the level index, **empty levels included**);
factors with two levels stay unordered. Both two-level (2×2): error `‘object’ does not represent a problem with
ordered data`. The statistic is the standardised linear statistic with the permutation (conditional) variance:
for both factors ordered, `Z = sqrt(N − 1) r` with r the Pearson correlation of the row and column scores over the N
observations. A two-level factor is coded by an indicator of its first level, which **reverses the sign** relative to
scores (1, 2) (fixture: `[[10, 5, 2], [3, 8, 6]]` gives Z = −0.52505). p-values: two-sided `2 Φ(−|Z|)`, `less`
`Φ(Z)`, `greater` `1 − Φ(Z)`. Method "Linear-by-Linear Association Test".

### 5.5 The 'N − 1' chi-squared test

No R package in the image offers it. Campbell (2007, Statistics in Medicine 26:3661-3675) recommends for 2×2 tables
Pearson's statistic times `(N − 1)/N`, referred to χ²(1) (and the Fisher-Irwin test when an expected count is below
1). For a 2×2 table it equals the Mantel-Haenszel statistic of one stratum without correction
(`mantelhaen.test(array(x, c(2, 2, 1)), correct = FALSE)`) and the linear-by-linear statistic Z² (any scores); the
fixture `chisqTestN1` gives `chisq.test(x, correct = FALSE)$statistic × (N − 1)/N`, df and upper-tail p for 2×2 and
r×c tables (the generalisation to r×c is a decision), and the mantelhaen values for 2×2 as the check.

### 5.6 Freeman-Tukey residuals

No package in the image. The usual definition (Freeman and Tukey 1950; Bishop, Fienberg and Holland 1975, section
14.7) is the Freeman-Tukey deviate `√O + √(O + 1) − √(4E + 1)`, approximately N(0, 1) under the model; their sum of
squares is the Freeman-Tukey statistic. A variant (`2(√O − √E)`, whose squares sum to the Cressie-Read λ = −1/2
statistic) is also in use. The fixture `freemanTukey` has both, with E = `chisq.test(correct = FALSE)$expected`. Which
one the compared application shows is not known here (a decision).

## 6. Equivalence of two proportions

### equivalence::tost(x, y, epsilon = 1, paired = FALSE, var.equal = FALSE, conf.level = 0.95, alpha = NULL)

On 0/1 data (the compared application): Welch's two one-sided t tests. `d = mean(x) − mean(y) = p1 − p2`,
`se² = s1²/n1 + s2²/n2` with `s² = n p(1 − p)/(n − 1)`, so `se² = p1(1 − p1)/(n1 − 1) + p2(1 − p2)/(n2 − 1)`; Welch
df `se⁴ / (s1⁴/(n1²(n1 − 1)) + s2⁴/(n2²(n2 − 1)))` (with var.equal the pooled t). `tost.p.value =
pt((ε − |d|)/se, df, lower.tail = FALSE)` (the larger of the two one-sided p-values); `tost.interval = d ∓
qt(conf.level, df) se` — **a 1 − 2(1 − conf.level) interval (90% for the default)**; `result` "rejected" (equivalence
shown) when the interval lies inside (−ε, ε), else "not rejected". `alpha` overrides `conf.level` (`1 − alpha`).
Errors: `data are essentially constant` (se < 10 eps max|mean|, e.g. both groups all 0 or all 1), `not enough 'x'
observations` (n < 2), `'conf.level' must be a single number between 0 and 1`. Fields: `parameter` (df),
`tost.p.value`, `result`, `tost.interval` (attribute conf.level), `estimate` (both means), `null.value`, `method`
"Welch Two Sample TOST", `epsilon`, `se.diff`.

On binary data this is a t approximation with a variance that is 0 when a group has all 0s or all 1s (then the df is
that of the other group, and it fails when both do) — not what a statistician would use for proportions.

### What a statistician would recommend

Equivalence of p1 − p2 within (−ε, ε) at level α: reject both `H01: p1 − p2 ≤ −ε` and `H02: p1 − p2 ≥ ε` at α;
equivalently, the 1 − 2α interval of the difference lies inside (−ε, ε).
- **Wald TOST**: `z1 = (d + ε)/se_W`, `z2 = (d − ε)/se_W`, `se_W = sqrt(p1q1/n1 + p2q2/n2)`; p = max(1 − Φ(z1),
  Φ(z2)). Dual to BinomDiffCI `wald` at 1 − 2α. Simple; poor near 0 or 1 and for small n.
- **Score TOST, Farrington and Manning (1990)**: for each bound δ0 = ∓ε, `z = (d − δ0)/sqrt(p̃1q̃1/n1 + p̃2q̃2/n2)`
  with the restricted MLE under p1 − p2 = δ0 (the cubic of 2.1); Miettinen-Nurminen multiplies the variance by
  N/(N − 1). The standard for non-inferiority and equivalence of proportions (also in regulatory guidance); dual to
  BinomDiffCI `mee` / `mn` at 1 − 2α, so the same code serves both.
- **Exact unconditional** tests (Chan 1998, the FM statistic maximised over the nuisance parameter) for small samples.

R implementations (not all in the image): DescTools `BinomDiffCI` (intervals only: mn, mee, wald, score;
in the image); `Exact::exact.test(delta = …, method = "z-pooled")` (exact unconditional with the FM statistic, one
bound at a time; in the image); `exact2x2::uncondExact2x2(nullparm = …, method = "score")` (in the image);
`gsDesign::testBinomial` (FM and MN statistics with `delta0`), `TOSTER::twoprop_test` (z-based TOST of proportions),
`PropCIs::diffscoreci`, `ratesci::scoreci` (MN with skewness correction) — not installed, not checked here.

Recommendation: keep `tost` (equivalence::tost) as the comparison with the application (it is a general t-test TOST,
useful for numeric data too), and offer for proportions a test on counts with the score statistic (Miettinen-Nurminen
by default, Farrington-Manning and Wald as options) returning both one-sided p-values, the larger as the p-value, and
the 1 − 2α interval from binomDiffCI with the same method. The fixture `binomDiffCI` already checks those intervals;
the p-values need only the statistic at δ0 = ±ε (no root search).

## 7. Accuracy notes (where the packages are wrong or inaccurate)

| function | issue | fixture |
|---|---|---|
| BinomCI midp | uniroot tol 1.22e-4 absolute; limits < 1e-4 wrong (0 or far too wide) | `reference` |
| BinomCI wilson | `0.99999999999999989` instead of 1 at x = n, conf 0.5 | — |
| BinomDiffCI mn | bisection to 1e-7, π = 3.141592654 | `reference` |
| BinomDiffCI mee | uniroot tol (up to 8% for tiny differences) | `reference` |
| BinomRatioCI koopman | uniroot tol, stepping by 1.0001 at the boundaries; `1/1 vs 0/1` lower 2 instead of 0.5206 | `reference` |
| BinomRatioCI sides | one-sided limits not applied | — |
| epitools midp | uniroot tol on [0, 1000]; errors for zero cells and OR > 1000 | `reference` |
| epiR OR score | 1.001 steps, wrong start for large tables | `reference` |
| epiR AR score, RR score at boundaries | bisection 1e-7; stepping 1.0001 | `reference` |
| epiR RR koopman | transposed table | not recorded |
| exact2x2 midp CI | uniroot tol on ψ and 1/ψ; 1/eps for large ψ | `reference` |
| exact2x2 minlike CI | precision 1e-5, rounded to 4 decimals | — |
| Boschloo | grid maxima; Exact's two-sided square region | `reference` |
| GTest | `1 − pchisq` for tables; Yates direction at ad = bc | `reference` (p) |
| StuartMaxwellTest | df not reduced with the categories | — |

Rational or mpfr checks were cheap here only for the score roots (mpfr, 128 bits; agreeing with the double
closed forms to 1e-14) and the Boschloo sums; the mid-p roots were solved in double on the log scale, whose tail
sums are accurate to a few ulps for these sizes.

## Decisions for the user

1. **Public API names and shapes.** Proposal (camelCase of R's names):
   `binomCI(x, n, { method, confLevel, sides })`, `binomDiffCI(x1, n1, x2, n2, { method, confLevel, sides })`,
   `binomRatioCI(x1, n1, x2, n2, { method, confLevel, sides })`, each returning
   `{ estimate, confInt: [lower, upper], confLevel, method, sides, warnings }` for one case (a) — or arrays for
   vectorised input as DescTools (b). Recommendation: (a), scalar only; vectorising is a map.
   Odds ratio: `oddsRatio(table, { method: "midp" | "fisher" | "wald", confLevel })` returning `{ estimate, confInt,
   method, pValue: { midp, fisher, chiSquare } }` as epitools (a), or the three p-values left out (b).
   Recommendation (a), with the table in epitools' orientation documented. epiR: no `epi2by2` clone; its numbers are
   reachable through the functions above plus the two extra methods (decision 3).
2. **Mid-p Fisher**: an option `midp: true` of `fisherTest` (2×2 only; two-sided always central; estimate stays the
   conditional MLE) (a), or a new function `fisherExact` mirroring exact2x2 with `tsmethod` (b). Recommendation (a),
   plus `tsmethod: "central"` without mid-p if wanted; not the matching "minlike" interval (its 4-decimal rounding
   makes it a poor oracle; would need its own description).
3. **Extra methods**: `mee` (Farrington-Manning) in binomDiffCI (needed for epiR's attributable risk, the
   equivalence test, cheap given mn) — recommend yes; `ac` (DescTools' default) — recommend yes, so that the default
   matches DescTools; epiR's odds-ratio score interval — recommend yes as `oddsRatio` method `"score"` (only if epiR
   comparability matters; otherwise skip). BinomCI's other nine methods: no.
4. **Defaults**: binomCI `wilson`, binomDiffCI `ac` (DescTools) or `mn`/`score` (recommended in the literature);
   binomRatioCI `katz.log`; oddsRatio `midp` (epitools). Recommendation: keep the packages' defaults.
5. **Where the packages' root searches are inaccurate** (section 7): return the true roots (design rule 2) and record
   the differences in differences-from-r. Recommendation: yes; the tests compare with `reference` where present.
6. **`sides` of binomRatioCI**: reproduce DescTools (the one-sided level but both limits kept) or apply the side as
   in BinomCI/BinomDiffCI. Recommendation: apply it, as a documented difference.
7. **Zero cells**: epitools' Wald OR gives NaN limits, midp fails; epiR fails. Proposal: Wald gives `[0, NaN]`-style
   results as epitools (a) or an Error (b); midp gives the conventions 0 / Inf of exact2x2 (estimate 0 or Inf, limit
   0 or Inf) (recommended).
8. **Boschloo**: function `boschlooTest(x1, n1, x2, n2, { alternative, tsmethod })` or on a table; the reference
   value: the supremum (recommended), tested against Exact with a relative tolerance of 1e-8 and the square-region
   cases listed as known differences; exact2x2's grid maximum not reproduced. Default two-sided method: Exact's
   `"square"` (Boschloo's original) or exact2x2's `"central"`. Orientation of `alternative`: Exact's (π1 < π2 for
   "less"), recommended. mid-p Boschloo: not now.
9. **Equivalence test**: (a) `tost(x, y, { epsilon, … })` as equivalence::tost only; (b) also a proportions test on
   counts with score (MN default; FM, Wald) statistics; (c) only (b). Recommendation (b) (section 6).
10. **G-test**: p-value from the upper tail (recommended, rule 2); Yates as DescTools (including the ad = bc
    direction and negative cells) or capped as chisq.test does. Recommendation: reproduce DescTools except the
    p-value; document. Function name `gTest(x, { correct, p, rescaleP })`.
11. **Stuart-Maxwell df**: DescTools' (original size − 1) or the reduced size − 1. Recommendation: DescTools', with a
    note (it is what users compare with); or rule 2 if you regard it as wrong.
12. **N − 1 chi-squared**: an option of `chisqTest` (e.g. `nMinus1: true`, 2×2 only as Campbell, or r×c) or its
    own function. Recommendation: an option, 2×2 and r×c (the statistic is well defined), `correct` ignored.
13. **Freeman-Tukey residuals**: which definition (BFH deviate recommended) and where (a field `ftResiduals` of
    chisqTest and gTest results, or a function `freemanTukeyResiduals(table)`).
14. **Linear-by-linear**: reproduce coin's sign flip and 2×2 error, or use scores 1..k for every factor
    (`Z = sqrt(N − 1) r`, also for 2×2). Recommendation: scores for all, as a documented difference (the 2×2 case is
    the N − 1 test and is useful); `lblTest(table, { alternative, rowScores, colScores })`.
15. **Gamma**: `goodmanKruskalGamma(table, { confLevel })` returning `{ estimate, confInt, ase }` (adding the ASE and
    perhaps the test of γ = 0 with the null ASE0, which DescTools does not give). Recommendation: estimate, interval
    and ase1; no test unless wanted.
16. **Input checks**: x > n, negative or non-integer counts, n = 0, conf.level outside (0, 1) — errors (design
    rule 1) where the packages give NaN or numbers; BinomCI's conf.level must stay in [0.5, 1]? Recommendation: accept
    (0, 1) for two-sided and use the same formulas; for `sides`, require the adjusted level ≥ 0.

## rStats.js's choices


Decided by the user on 2026-11-07 (the numbers are those of "Decisions for the user"):

1. **API:** one case per call, no vectorised input. `binomCI(x, n, { method, confLevel, sides })`,
   `binomDiffCI(x1, n1, x2, n2, { method, confLevel, sides })`, `binomRatioCI(x1, n1, x2, n2, { method, confLevel,
   sides })`, each returning `{ estimate, confInt: [lower, upper], confLevel, method, sides, warnings }`.
   `oddsRatio(table, { method, confLevel })` returning the estimate, the interval and epitools' three p-values
   (`pValue: { midp, fisher, chiSquare }`), the table in epitools' orientation (documented). No `epi2by2`; epiR's
   numbers are reached through these functions.
2. **Mid-p Fisher:** an option `midp: true` of `fisherTest`, 2 × 2 only; two-sided is always central; the estimate
   stays the conditional MLE.
3. **Extra methods:** `mee` (Farrington-Manning) and `ac` (Agresti-Caffo) in `binomDiffCI`; `"score"` in
   `oddsRatio` (epiR's odds-ratio score interval, with the true roots, not epiR's 0.1% steps).
4. **Defaults:** the packages': `binomCI` `wilson`, `binomDiffCI` `ac`, `binomRatioCI` `katz.log`, `oddsRatio`
   `midp`.
5. **Inaccurate root searches** (section 7): return the true roots; tests compare with `reference` where present;
   the differences go into docs/differences-from-r.md.
6. **`sides` of `binomRatioCI`:** applied as in `binomCI` and `binomDiffCI` (the other limit is 0 or Inf); a
   documented difference from DescTools.
7. **Zero cells (odds ratio):** mid-p and fisher follow exact2x2's conventions (estimate 0 or Inf, limit 0 or Inf);
   Wald as epitools (NaN where undefined).
8. **Boschloo:** `boschlooTest(table, { alternative, tsmethod })` on a 2 × 2 table (rows are the groups, column 1 the
   event), an HTest result. The p-value is the true supremum over the nuisance parameter (fine grid plus refinement
   of every candidate maximum), checked against Exact with relative tolerance 1e-8; the square-region cases where
   Exact is wrong are known differences checked against `reference`. exact2x2's 98-point grid maximum is not
   reproduced. Default two-sided method `"square"` (Exact's default, Boschloo 1970); `"central"` as an option.
   `alternative` in Exact's orientation (`"less"`: π1 < π2). No mid-p Boschloo.
9. **Equivalence:** both. `tost(x, y, { epsilon, … })` as equivalence::tost (numeric data too), and a test of
   equivalence of two proportions on counts with the score statistic (Miettinen-Nurminen by default;
   Farrington-Manning and Wald as options), returning both one-sided p-values, the larger as the p-value, and the
   1 − 2α interval of `binomDiffCI` with the same method.
10. **G-test:** `gTest(x, { correct, p, rescaleP })`. The p-value is the upper tail (correct where DescTools'
    `1 − pchisq` underflows to 0); Yates' correction as DescTools (including the ad = bc direction), documented.
11. **Stuart-Maxwell:** df = K − 1 with K the categories left after removing those without off-diagonal counts
    (DescTools keeps the original size − 1); a documented difference.
12. **N − 1 chi-squared:** an option of `chisqTest` (`nMinus1: true`), for 2 × 2 and r × c tables.
13. **Freeman-Tukey residuals:** the Bishop-Fienberg-Holland deviate `√O + √(O + 1) − √(4E + 1)` (as the compared
    application), as a field `ftResiduals` of the results of `chisqTest` and `gTest`.
14. **Linear-by-linear:** scores 1..k for every factor, two-level ones included (no sign flip, and 2 × 2 tables are
    computed: Z² is the N − 1 statistic); `lblTest(table, { alternative, rowScores, colScores })`; the differences
    from coin are documented.
15. **Gamma:** `goodmanKruskalGamma(table, { confLevel })` returning `{ estimate, confInt, ase }` (ASE1); no test of
    γ = 0.
16. **Input checks:** meaningless input is an error (design rule 1): x > n, negative or non-integer counts, n = 0,
    a confidence level outside (0, 1); with `sides`, the adjusted level 1 − 2(1 − confLevel) must be ≥ 0.
