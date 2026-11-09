# Cox regression, continued (rStats.js 1.4.0): the test of proportional hazards and counting-process data

This file describes, in words and formulas, what survival's `cox.zph` and `coxph` with counting-process data
`Surv(start, stop, event)` compute, for an implementation that must not read their source. **It was written without
reading any R source** (clean room): from the help pages (`?cox.zph`, `?coxph`, `?Surv`, `?aeqSurv`,
`?coxph.control`, `?survfit.formula`), Grambsch and Therneau (1994), Therneau and Grambsch (2000), Andersen and Gill
(1982), and R's output. Every formula below was re-implemented independently in R from this text (scratch scripts, not
kept) and agrees with R to 1e-14 relative or better on the cases named; where a behaviour could not be determined that
way it is said so. Where this file and a fixture seem to disagree, report it instead of working around it.

| package | version | functions |
|---|---|---|
| survival | 3.8-12 (R 4.6.2, image `rstats-oracle:4.6.2` and its x86_64 build) | `cox.zph`, `coxph` with `Surv(start, stop, event)`, `survfit` and `survdiff` with such data, `aeqSurv` |

The fit itself (Newton-Raphson, Efron/Breslow, the generalised Cholesky, the tests and the summary) is
oracle/coxph-behaviour.md; the robust variance (score residuals, dfbeta, `rscore`) is section 5 of
oracle/robust-behaviour.md. This file only states what differs or is new.

Oracles and fixtures (`npm run oracle -- <name>`; each runs in about 15 to 20 s, far below 1 GB):

| oracle | fixture | cases | platform |
|---|---|---|---|
| `oracle/coxzph.R` | `coxZph` | 76 (7 errors) | x86_64, as `oracle/coxph.R` |
| `oracle/coxphcounting.R` | `coxphCounting` | 63 (5 errors) | x86_64 |
| `oracle/survfitcounting.R` | `survfitCounting` | 13 (1 error) | arm64, as `oracle/survival.R` |

Fixture conventions: the matrix interface of `oracle/coxph.R` (`x` one row per row of data, `"NA"` for a missing
value), R's argument names where the API is undecided (`iter.max`, `eps`, `robust`, `cluster`, `id`, `timefix`,
`transform`, `terms`, `global`) and R's output names (`naive.var`, `n.id`, `linear.predictors`, `n.risk`, ...). Every
case has `warnings` (R's, each once, the fit's and cox.zph's together) or `{"error": message}`. Where R is wrong the
case has a `reference` with `refKind` (section A.9); for cases where R fails the reference is inside the expected
value (`expected.reference`).

Notation: β̂ the fitted coefficients (k of them, NA ones removed), η_j = x_j'β̂, r_j = w_j exp(η_j) with w the case
weights; for an event time t (within a stratum) R(t) the risk set, D(t) the rows with an event at t, d = |D(t)|.
"Event rows" are the rows with status 1, one per event (not one per distinct time). n_e = the number of event rows
(unweighted; R's `fit$nevent`).

## Easy to get wrong

1. **cox.zph's test is a real score test (survival ≥ 3.0), not the old approximation** printed in many textbooks
   (Grambsch-Therneau's `(Σ g s*)² / (d V Σ g²)`): the model is augmented with k time-varying terms `θ_j x_j g(t)` and
   the score test of θ = 0 is taken at (β̂, θ = 0), with the information blocks recomputed at β̂ (A.3). The help's
   Note says this too.
2. **g is centred by its mean over the event rows (unweighted)**, `g̃ = g − mean(g over the n_e event rows)`, before
   the test. At an exact maximum this would not matter (U_β = 0), but R's β̂ is only converged to `eps` on the log
   likelihood, and with `iter.max = 1` the difference is large (0.515 against 0.444 in a checked case). Weighting the
   mean by the case weights or taking it over distinct times is wrong.
3. **The variance cox.zph reports (`var`) and uses for `y` is `n_e · I(β̂)⁻¹` recomputed at β̂**, not
   `n_e · fit$var`: they differ when the iterations ran out (R's right-censored `fit$var` is then the diagonal of
   oracle/coxph-behaviour.md rule 4) and for robust fits (the robust variance is never used; it equals
   `n_e · naive.var` there).
4. **The km transform is 1 − KM(t−)**: the left-continuous Kaplan-Meier estimate just **before** each event time, of
   the whole data **ignoring the case weights and the strata**, on the times after the tie merging; for counting data
   the product-limit estimate of the (start, stop] data. At the first event time g = 0.
5. **The rank transform is the rank of every row's (stop) time among all rows, censored ones included, ties
   averaged** (R's `rank`): with 26 rows the 8th event time can have rank 10. A transform function also receives the
   times of **all** rows (A.2).
6. **y within tied deaths:** right-censored fits list tied deaths in input order, **counting-process fits in reverse
   input order** (A.6). `x` and `time` are equal within a tie, so only `y` shows it.
7. **Counting-process risk set:** a row is at risk at t when `start < t ≤ stop`: a row starting exactly at an event
   time is not at risk there; a censored row ending at it is. Rows with `start ≥ stop` are dropped by `Surv` with a
   warning, not an error (B.1).
8. **The tie merging pools the distinct values of start and stop** (B.2): a start within sqrt(eps) of an event time
   becomes that event time (or the event time becomes the start, whichever is smaller), and a merge that leaves an
   interval of length 0 is an error. Data like `round(x, 1) + 0.1` against `round(y, 1)` hit this: without the merge
   the coefficients differ by 1e-3 relative in a checked case.
9. **`means` of a counting-process fit are unweighted** (`Σ x_j / n` over the rows), while those of a right-censored
   fit are weighted (`Σ w x / Σ w`); the linear predictors are centred by them (B.3).
10. **When the iterations run out, a counting-process fit reports `iter = iter.max` and the proper inverse of the
    information at the last accepted β** (with `iter.max ≥ 1`), where a right-censored fit reports `iter.max + 1` and
    the diagonal of rule 4 of oracle/coxph-behaviour.md (B.4). Even data with every start = 0 take the counting path.
11. **No "coefficient may be infinite" warning for counting-process fits**: the right-censored fit warns `Loglik
    converged before variable  2 ; coefficient may be infinite. ` on the same data, the counting fit is silent (B.4).
12. **`robust = TRUE` without `cluster` or `id` is an error for counting data** (`one of cluster or id is needed`),
    while non-integer weights switch the robust variance on silently with each row its own cluster (B.5).
13. **`rsq` uses n = the number of rows**, also with `id` (where `n.id` subjects are known): splitting a subject into
    rows changes R² (0.305 unsplit against 0.128 split in a checked case) while everything else is unchanged.

---

# Part A. `cox.zph(fit, transform = "km", terms = TRUE, singledf = FALSE, global = TRUE)`

Grambsch and Therneau (1994); Therneau and Grambsch (2000), section 6.2.

## A.1 What is needed from the fit
The data of the fit after its own processing (rows with missing values dropped, times merged as
oracle/coxph-behaviour.md step 1 / B.2 here), the case weights, the strata, the ties method, and β̂ (`fit$coefficients`,
also when the fit did not converge, also `init` with `iter.max = 0`). **Columns with an NA coefficient are dropped**
(from the table, y and var; a fit with x1, 2·x1, x2 gives rows x1, x2). Nothing else of the fit is used: not
`fit$var`, not the robust variance, not the fit's centring. (R recomputes from the model frame; `x = TRUE` only saves
time.)

## A.2 The transform g
`g` is computed for every row from the (merged) time of every row (the stop time for counting data), then taken at
the event rows:

| transform | g |
|---|---|
| `"km"` (default) | `1 − S(t−)`, S the unweighted, unstratified Kaplan-Meier estimate (survfit's, counting-process product-limit for (start, stop] data, risk sets as B.1); `S(t−)` = S at the largest distinct time `< t`, 1 before the first |
| `"rank"` | `rank(time)` over all rows, average ties |
| `"identity"` | `time` |
| `"log"` | `log(time)` (accepted although `?cox.zph` does not list it) |
| a function f | `f(time)` with the vector of all rows' times (R passes it with names `"1"`, `"2"`, ...); only the event rows' values are used |
| anything else | error `Unrecognized transform` |

R does not check the function's value: a vector of the wrong length is silently recycled/misaligned (a function
returning `t[-1]` gave a table of numbers), NaN or ±Inf give NaN in the table (A.8). Weights never enter g.

`x` in the result = g at the event rows (uncentred), `time` = their times; both in the order of A.6.

## A.3 The score test
Per stratum and distinct event time t (risk set: `time ≥ t`, or B.1), with the case weights:
`S0 = Σ_R r`, `S1 = Σ_R r x`, `S2 = Σ_R r x x'`; for the deaths `E0, E1, E2` the same sums over D, `dw = Σ_D w`.

- Breslow, or d = 1: `x̄ = S1/S0`, `V(t) = dw (S2/S0 − x̄ x̄')`, the Schoenfeld sum `s(t) = Σ_D w x − dw x̄`.
- Efron, d > 1: for m = 0..d−1, `f = m/d`, `x̄_m = (S1 − f E1)/(S0 − f E0)`,
  `V(t) = Σ_m (dw/d) ((S2 − f E2)/(S0 − f E0) − x̄_m x̄_m')`, `x̄ = mean_m x̄_m`, `s(t) = Σ_D w x − dw x̄`.

(V(t) summed over t is the information I(β̂) of oracle/coxph-behaviour.md step 3, and Σ s(t) the score U(β̂).) With g̃
the centred transform (rule 2; constant within t),

    U_θ = Σ_t g̃(t) s(t),   I_ββ = Σ_t V(t),   I_βθ = Σ_t g̃(t) V(t),   I_θθ = Σ_t g̃(t)² V(t),
    M = I_θθ − I_βθ' I_ββ⁻¹ I_βθ.

- The test of a term with column set T (a single column, or a multi-column term with `terms = TRUE`):
  `χ² = U_T' (M_TT)⁻¹ U_T` on |T| df, M_TT the T × T block of M (each term's θ tested alone, i.e. the augmented model
  holds β and θ_T only). For one column, `U_j² / M_jj`.
- GLOBAL: `U_θ' M⁻¹ U_θ` on k df (the last row; omitted with `global = FALSE`; **present also when k = 1**, equal to
  the single row).
- p = upper chi-squared tail. The df column holds the number of columns of the term (stored as a double).

Checked to 1e-14 against R for right-censored and counting data, both ties methods, integer and non-integer weights,
strata, robust and clustered fits, fits stopped after 1 or 2 iterations, `init` with `iter.max = 0`, and each
transform. (R solves with LAPACK's dgesv, see A.8 for its failures.)

## A.4 The scaled Schoenfeld residuals `y` and `var`
For each event row i (time t, stratum h), the unweighted Schoenfeld residual `s_i = x_i − x̄(t)` with x̄(t) as in A.3
(Efron: the mean over m of x̄_m, the same for every death of the tie), and

    var = n_e · I(β̂)⁻¹,   y_i = β̂ + n_e · s_i' I(β̂)⁻¹ = β̂ + s_i' var.

n_e unweighted also with case weights (51 events with Σ w status = 99 in a checked case: var = 51 · I⁻¹).
Column names of `y`: the coefficient names; row names: the times (rounded; not needed).

## A.5 `terms = TRUE` with multi-column terms, and `singledf`
In R a term is one formula term (a factor, a matrix term). With `terms = TRUE` (default):
- the table has one row per term (A.3, |T| df);
- `y` and `var` have **one column per term**: a multi-column term T is collapsed into the single covariate
  `z_T = x_T'β̂_T` with coefficient 1; with L the p × (number of terms) matrix mapping (identity column for a
  one-column term, `β̂_T` in the rows of T otherwise), `var = n_e (L' I(β̂) L)⁻¹` and `y_i = b + n_e (L's_i)' (L' I L)⁻¹`
  with b = β̂_j for a one-column term and 1 for a collapsed one. (Checked to 1e-15.)
- With `terms = FALSE` every column is its own term (rows named by the columns, as R's coefficient names).
- An NA coefficient inside a multi-column term with `terms = TRUE`: R fails with `length of 'dimnames' [1] not equal
  to array extent` (`terms = FALSE` works and drops the column).
- **`singledf = TRUE` could not be determined.** Its GLOBAL row is A.3's and one-column terms keep their A.3 value, but
  the 1-df value of a multi-column term matched none of: the test of θ for the contrast `x_T'β̂_T` in the full model
  (with g raw, centred over deaths, or over distinct times), the full test of the collapsed design of A.5, the
  approximate test on the collapsed scaled residuals, or cox.zph of a refit with the collapsed covariate (0.0015 in
  R against 0.0070, 0.0065, 0.0028 and others). Not in the fixtures; see the decisions.

## A.6 Order of the rows of `x`, `time`, `y` (and `strata`)
Sorted by stratum (the sorted labels), then by time; within tied event times: **input order for right-censored fits,
reverse input order for counting-process fits** (checked with deaths whose start times are not monotone: the order is
not by start). `strata` = the stratum label of each event row (a factor in R; the fixture writes the labels), absent
without strata.

## A.7 Fits it is given
Right-censored and counting-process coxph fits, any ties method (`exact` not covered), weights, strata, robust or
cluster (ignored), `iter.max` reached (the warning of the fit only), `init`. Strata do not enter the km or rank
transform. A time-dependent covariate enters through the row at risk (counting data).

## A.8 Boundaries, errors and NaN (verbatim, from R)
| input | R |
|---|---|
| no events | error `subscript out of bounds` |
| one event; all events at one time; a constant transform | error `Lapack routine dgesv: system is exactly singular: U[2,2] = 0` (the index is k + 1 for k columns, e.g. `U[3,3]` with two) — M = 0 |
| two events | a finite table |
| `log` with a time 0 (log = −Inf) | NaN in every cell, no warning |
| `log` with a negative time (any row, censored too) | NaN, warning `NaNs produced` (from `log`) |
| a transform giving Inf (`exp(1000 t)`) | NaN, no warning |
| `identity` with times × 2^600 | NaN (g² overflows); the test is invariant to scaling g, `reference` = the table at the unscaled times (`refKind = "scaled"`) |
| times × 2^-30 (all below the absolute tolerance sqrt(eps) of the tie merging: every time merged into one) | error `Lapack routine dgesv: ... U[3,3] = 0`; `expected.reference` = the unscaled table (the test is invariant to time scaling for km, rank and identity) |
| a covariate × 2^40 | error `system is computationally singular: reciprocal condition number = 2.1947e-26` (dgesv's condition check on unscaled matrices); `expected.reference` = the unscaled table (invariant) |
| integer-typed (R integer) weights | error `REAL() can only be applied to a 'numeric', not a 'integer'` (an R bug; JavaScript numbers are doubles, so not applicable) |

The fixture's error cases also record the fit's `coef` and `nevent`.

---

# Part B. `coxph` with counting-process data `Surv(start, stop, event)`

Andersen and Gill (1982); Therneau and Grambsch (2000), chapters 3 (time-dependent covariates, the (start, stop]
form) and 8 (multiple events). The partial likelihood, score, information, Newton-Raphson, step halving, convergence
test, generalised Cholesky, tests and summary are those of oracle/coxph-behaviour.md with the risk set of B.1;
differences are listed below.

## B.1 Data and the risk set
- `Surv(start, stop, event)`: `event` 0/1 (any other value: `Surv` warns `Invalid status value, converted to NA` and
  the row is dropped). A row with `stop ≤ start` (also equal): warning `Stop time must be > start time, NA created`,
  row dropped (n counts only the rows kept). No rows left: error `No (non-missing) observations`. Missing start, stop,
  covariate, weight, stratum, cluster or id: the row is dropped. Negative start times are allowed (the fit is invariant
  to shifting all times); `start = −Inf` and a censored `stop = Inf` are accepted.
- **At an event time t of stratum h the risk set is {rows j of h: start_j < t ≤ stop_j}.** The deaths are the rows with
  `stop = t` and event 1. A subject's rows need not be contiguous (gaps allowed); overlapping rows of one id are not
  checked (no error, also with `id`). Strata may change between a subject's rows.
- Everything per row: n = number of rows used (`fit$n`), nevent = number of event rows (unweighted), and, with `id`,
  `n.id` = number of distinct ids among the rows used.
- Checked: the log partial likelihood with this risk set (Breslow and Efron) equals R's `loglik` to 1e-14; split
  right-censored data give the coefficients, variance and tests of the unsplit fit to 1e-15 (fixture: `dsp` cases
  against the start-0 case, which equals oracle/coxph.R's fit of the same data).

## B.2 Tie merging (`timefix = TRUE`, aeqSurv)
The rule of oracle/coxph-behaviour.md step 1 applied to the **pooled distinct finite values of start and stop**:
`y` = sorted distinct finite values of `c(start, stop)` (all rows used), `tol = sqrt(2^-52)`; the gap after `y_k` is
a tie when `y_{k+1} − y_k ≤ tol` or `(y_{k+1} − y_k)/mean(|y|) ≤ tol` (mean over those distinct values, 0 included);
chains of ties merge to the first value; each start and stop is replaced by the largest cut point not above it.
- Checked: stops 10⁶ (×4) and 10⁶ + 0.012 with every start 0 are **not** merged (0.012/mean{0, 10⁶, 10⁶+0.012} =
  1.8e-8), while the same stops as right-censored times are merged (1.2e-8); 20 extra rows (0, 1] do not stop a merge
  that the distinct values allow (the mean is over distinct values, not rows).
- A start 2 + 1e-10 and an event at 2: the start becomes 2, the row is no longer at risk at 2. A start 2 − 1e-10 and
  an event at 2: the **event time** becomes 2 − 1e-10 (the smaller value); cox.zph's `time` and identity `x` then show
  1.9999999999.
- After merging, a row with start = stop: error `aeqSurv exception, an interval has effective length 0` (before any
  fit; not the `Surv` warning).
- `coxph.control(timefix = FALSE)` skips the merging (fixture case `timefix: false`).

## B.3 Means, centring, linear predictors
- `means` = **unweighted** column means over the rows used (`Σ_j x_j / n`), except for columns whose values all lie in
  `nocenter` (default {−1, 0, 1}): 0. With weights 1, 2, 1, 3, ... R gives 0.2385 (= mean(x)) where the right-censored
  fit of the same rows gives the weighted 0.1095.
- `linear.predictors_j = x_j'β̂ − Σ_i β̂_i means_i` (one per row, input order, NA coefficients counted as 0).
- How R scales the columns internally for the iterations is not visible; Newton's method is invariant under affine
  changes of the covariates, so the iterates agree to rounding: R itself is reproducible to 2e-15 relative under row
  permutations (checked on 200 rows), and scaling a covariate by 2^30 or the times by 2^-20 / 2^40 changes nothing
  (fixture cases; scaling by a power of 2 is exact in R). One flag of R's `info` vector is called `rescale` (0 in
  every case seen).

## B.4 Iterations, convergence, warnings
Newton-Raphson as oracle/coxph-behaviour.md step 5 (same start, step, halving, `|1 − best/new| ≤ eps` test), but:
- **Ran out** (`iter.max ≥ 1` steps without convergence): `iter = iter.max`; the coefficients are the last
  accepted β (not the pending step); `loglik[2]` = the log likelihood at that β; `var` = the proper inverse (generalised
  Cholesky) of the information **at that β** (checked to 2e-16 for iter.max = 1, 2, 3 against my own evaluation).
  Warning `Ran out of iterations and did not converge` only when `iter.max > 1` (as right-censored). The monotone-
  likelihood case does not warn `one or more coefficients may be infinite` (linear predictors up to 231; not
  determined whether the counting path ever issues it).
- **Converged:** as right-censored, but **no `Loglik converged before variable ...` warning** (two cases where the
  right-censored fit warns; fixture `eps: 0.01`).
- `iter.max = 0`: `iter = 0`, var = inverse information at init, no warning (as right-censored).
- New fields of counting fits (absent from right-censored ones): `first` = the score vector U at the final
  coefficients (written to the fixture), `info` = `c(rank, rescale, "step halving", convergence)` with convergence 1
  when the iterations ran out (fixture `converged`). Not needed for the API.
- No events: the zero-event result of the right-censored fit (NA coefficients, var 0, loglik `[0, 0]`, iter 0, means
  as B.3, linear predictors 0).

## B.5 Robust variance, cluster and id
The score residuals of robust-behaviour.md 5.2 with the risk set of B.1: for each event time t, every row in R(t)
(not only rows with `time ≥ t`) gets `−r_j (x_j − x̄) λ` (Efron: the per-m version for rows not in D), each death the
`x_j − x̄` part — checked to 3e-15 (unweighted residuals, R's `residuals(fit, "score")`). dfbeta, the cluster sums,
`var = Σ_c D_c' D_c`, `rscore` (at init, uncentred, summed by cluster) as 5.3 to 5.5 — checked to 2e-15.
- `robust` default: TRUE if a `cluster` is given, or some weight is not an integer (`?coxph` says "not 0 or 1", but
  weights 2 stay non-robust), or `id` is given **and some id has more than one event row**. Else FALSE.
- The clusters: `cluster` if given (it wins over `id`: a different variance), else `id`, else (non-integer weights
  only) each row its own cluster.
- `robust = TRUE` with neither cluster nor id: error `one of cluster or id is needed` (right-censored data: each row its
  own cluster, no error).
- `robust = FALSE` with `id` and multiple events: the naive fit, no warning. `cluster` with `robust = FALSE`: presumably the
  warning of robust-behaviour.md 5.1 (not checked for counting data).
- A single cluster: error `(subscript) logical subscript too long` (as right-censored). Zero weights: `Invalid weights,
  must be >0`.
- With the robust variance the summary is robust-behaviour.md 5.5 (`se` naive, `robust se`, z from the robust one,
  `robscore`).

## B.6 Summary
As oracle/coxph-behaviour.md step 7 with n = the number of rows (`rsq = 1 − exp(−logtest/n)`, `maxrsq = 1 −
exp(2 loglik[1]/n)`), also with `id` (Easy to get wrong 13). The print shows `n= 172, unique id= 103`.

---

# Part C. `survfit` and `survdiff` with (start, stop] data

- `survdiff(Surv(start, stop, event) ~ g)`: error `survdiff not defined for counting process data`.
- `survfit(Surv(start, stop, event) ~ g)` works (fixture `survfitCounting`, the fields of `oracle/survival.R` plus
  `cumhaz`): at each distinct stop time t of a stratum, `n.risk = #{start < t ≤ stop}` (unweighted here), `n.event` =
  events with stop = t, `n.censor` = censored rows with stop = t; `surv` = Π (1 − n.event/n.risk) (product-limit, left
  truncation handled by the risk set), `std.err` = surv · sqrt(Σ d/(n(n − d))) (Greenwood), the intervals and the
  median as for right-censored data; `cumhaz` = Σ d/n. A time with n.risk = n.event gives surv 0, std.err NaN, NA
  limits afterwards (as right-censored). Times at which nobody is at risk are simply not rows.
- **Without `id`**, each split point is a censoring (`n.censor` 31 at a cut time in the fixture; the summary gets a row
  there); **with `id`**, a row that ends where the same id's next row starts is not a censoring and not a row (the
  rows and n.censor equal the unsplit data's; surv, std.err identical to 1e-16 either way).
- The median and its interval: as `oracle/survival.R` (negative times fine).

---

## Where R is wrong or inaccurate (fixture `refKind`)

| function | issue | fixture |
|---|---|---|
| cox.zph | identity transform with huge times: g² overflows, NaN | `reference` (`scaled`) |
| cox.zph | times below sqrt(eps) all merged by the absolute tie tolerance: fails | `expected.reference` (`scaled`) |
| cox.zph | a covariate × 2^40: dgesv's condition check fails on unscaled blocks | `expected.reference` (`scaled`) |
| cox.zph | wrong-length transform values silently used; integer weights crash | not in fixtures |
| cox.zph | NA coefficient inside a multi-column term with `terms = TRUE`: dimnames error | not in fixtures (matrix interface) |
| coxph counting | rsq with n = rows (not invariant to splitting) | as R; decision 6 |
| coxph counting | no "coefficient may be infinite" warning | as R; decision 4 |
| coxph (both) | times × 2^-30: the absolute tolerance merges distinct times | coxZph cases above |

No numerical inaccuracy was found for ordinary data: R's cox.zph tables agree with an independent double-precision
evaluation of A.3 to 1e-14 relative, the counting fits to the convergence of their iterations (the true maximum is
within ~1e-8 relative of R's β̂ at `eps = 1e-9`; the tests are taken at R's β̂, so this does not matter for agreement).

## Accuracy against R
1e-12 relative per value should be reachable everywhere: coefficients, var, loglik, the tests and the table
(relative to `sqrt(V_ii V_jj)` for off-diagonal entries; for `y` relative to the largest |y| of its column, since a
residual can be near 0). The coxph fixtures come from x86_64 R like `oracle/coxph.R`.

---

## Decisions for the user

1. **API for counting-process data.** (a) An option `start?: readonly number[]` of `coxph(time, status, x, options)`,
   `time` being the stop time (R's `Surv(start, stop, event)` reads the same); (b) a separate function
   `coxphCounting(start, stop, status, x, options)`; (c) `time` as `[start, stop]` pairs. Recommendation (a): one
   result type, the right-censored path unchanged when `start` is absent. Plus `id?: readonly (GroupLabel | null)[]`
   (rows with a missing id dropped as missing strata) and `nId` in the result when given.
2. **Which path with `start`.** R uses the counting algorithm whenever the response has three columns, even with
   every start below every time; the visible differences are B.3 (means), B.4 (iter, var when the iterations ran out,
   the infinite warning). (a) As R: `start` given → counting behaviour, also all zeros (recommended; the fixtures test
   it); (b) treat start ≤ min(time) as right-censored.
3. **Rows with `start ≥ stop`.** (a) R: drop with R's warning `Stop time must be > start time, NA created`; (b)
   RangeError (design rule 1; the existing coxph throws for a status other than 0/1). Recommendation (b), message
   `stop time must be > start time`, documented. After the tie merging, start = stop: Error with R's text (`aeqSurv
   exception, an interval has effective length 0`).
4. **The missing "Loglik converged before variable" warning** for counting fits: (a) as R (none); (b) the
   right-censored warning also for counting data. Recommendation (a), as R (rule 10 asks for R's warnings), with a note
   in docs/differences-from-r.md only if (b) is chosen.
5. **`means` unweighted for counting data** (B.3): (a) as R (recommended; it changes only `means` and the constant in
   `linearPredictors`); (b) weighted as right-censored.
6. **`rsq` with n = rows** (B.6): (a) as R (recommended, documented in the TSDoc); (b) n = the number of subjects when
   `id` is given.
7. **Robust defaults with counting data.** As R: `id` with an id of more than one event → robust; `cluster` wins over
   `id`; `robust: true` without cluster or id → Error `one of cluster or id is needed`; non-integer weights without
   either → each row its own cluster. Recommendation: all as R (the last two are inconsistent but documented; an
   alternative is the same Error for the weights case — that would make non-integer-weighted counting fits without an
   id impossible, so not recommended).
8. **`coxZph` API.** Proposal `coxZph(fit, { transform, terms, global })` with `fit` a `CoxphResult`. The fit must carry
   what A.1 needs: (a) add internal data to `CoxphResult` (the rows used, merged times, start, status, weights,
   strata, x; additive, non-enumerable or documented as such), recommended; (b) `coxZph(time, status, x, options)`
   refitting with the coxph options (simpler, duplicates the fit). Result: `{ rowNames, chisq, df, p (alias pValue),
   x, time, strata?, y (rows), var, transform, warnings }`, the GLOBAL row last in the table arrays (or `global` as a
   separate `{ chisq, df, p }` and the per-term arrays without it — recommended for clarity).
9. **Transforms.** `"km"` (default), `"rank"`, `"identity"`, `"log"` and a function. The function: (a) as R, called
   once with the times of all rows used (merged; stop times), only the event rows' values used (recommended:
   compatible with R code); (b) called with the event times only. A value of the wrong length: RangeError (R misuses
   it silently). Non-finite values of g at event rows (log of times ≤ 0, overflow): (a) Error (design rule 1,
   recommended), (b) NaN as R. Large but finite g (identity at 2^600): scale g by a power of 2 before forming g²
   (the test is invariant), giving the `reference` (recommended, rule 10's last sentence).
10. **Terms.** The matrix interface has no formula terms. (a) Each column its own term only (= R's `terms = FALSE`),
    no option; (b) an option `terms?: readonly (readonly number[])[]` (0-based column groups, each a multi-df term,
    with A.5's collapsed y and var). Recommendation (b) if factor covariates are expected (a 3-level factor is two
    columns), else (a). An NA coefficient inside a group: drop that column from the group (R fails). `singledf`: not
    supported (could not be determined, A.5).
11. **Degenerate input** (A.8): no events, one event, all events at one time, a constant transform → Error (R errors
    with LAPACK messages); messages of our own, e.g. `the test needs events at two or more distinct times` and `the
    transform is constant at the event times`. Scaled-data failures (2^-30 times, 2^40 covariates): (a) R's errors;
    (b) compute the right value (`expected.reference`; covariates: scale columns internally; times: only if the tie
    merging is not what merges them — with the existing absolute tolerance the fit itself merges the times, so the
    2^-30 case stays an Error unless decision 12 changes). Recommendation (b) for the covariate case, (a) for the
    times.
12. **The absolute tie tolerance** (sqrt(eps), B.2): (a) keep R's rule (as the existing coxph, survfit, survdiff do;
    recommended); (b) a relative-only rule (scale invariant, differs from R for times below 1.5e-8). Also: expose
    `timefix` (R's `coxph.control(timefix)`) as `control.timefix`? Recommendation: yes, default true (the fixture has
    a `timefix: false` case), unless the existing survfit/coxph should stay without it.
13. **Order of `y` within tied deaths** (A.6): (a) as R (reverse input order for counting fits; recommended for
    testability); (b) input order always.
14. **survfit / survdiff with (start, stop] data** (part C). survfit: (a) accept an option `start` (and `id`, so that
    split points are not censorings) with the risk sets of B.1 and the existing fields (recommended: delayed entry is
    common in cohort studies and the fixture is ready); (b) not now. survdiff: R does not define it → no `start` option
    (recommended), or a RangeError if added later.
15. **Score/dfbeta residuals and `first`, `info`** for counting fits: internal only (as decided for right-censored
    fits); the fixture has `scoreResid` and `dfbeta` for debugging. Recommendation: keep internal.
16. **Tolerances.** 1e-12 relative (A/B accuracy above) against R, against `reference` where present and chosen.

## rStats.js's choices
Decided by the user on 2026-11-09. Binding. Every numbered decision above is taken as recommended in this document (the recommended option of each).
In particular: coxph gains the options start and id (nId in the result), counting behaviour whenever start is given;
rows with start >= stop are a RangeError; coxZph(fit) with the fit's data kept in CoxphResult; transforms km, rank,
identity, log and a function, computed scaled; terms option without singledf; degenerate cases are errors; survfit
accepts start and id, survdiff does not; score/dfbeta residuals stay internal; tolerance 1e-12.
