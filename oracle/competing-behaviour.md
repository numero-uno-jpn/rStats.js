# Competing risks (cmprsk): the behaviour to reproduce

What cmprsk 2.2-12 (R 4.6.2, survival 3.8-12 loaded as its dependency) computes in `cuminc`, `timepoints`, `crr`,
`summary.crr` and `predict.crr`, written for an implementation that must not read their source. **Clean room:** every
statement below comes from the help pages, the papers (Gray 1988, Fine and Gray 1999, Aalen 1978 through Gray's
paper, the SAS/STAT LIFETEST documentation of the same estimators) and from experiments with R's output; no source of
R or of any package was read. Where a behaviour could not be determined that way, this file says so.

| oracle | fixture | cases | platform |
|---|---|---|---|
| `oracle/cuminc.R` | `cuminc` | 44 (4 errors) | x86_64 (`# oracle-platform: amd64`) |
| `oracle/crr.R` | `crr` | 46 (5 errors) | x86_64 |

Each runs in about 10 s and far below 1 GB. Formats in the headers of the oracles. The fixtures keep R's names
(`ftime`, `fstatus`, `cov1`, `cov2`, `tf`, `cengroup`, `failcode`, `cencode`, `gtol`, `maxiter`, `init`,
`variance`; outputs `coef`, `var`, `loglik`, `bfitj`, `uftime`, `res`, `stat`, `pv`, ...) because the API is not
decided (see "Decisions for the user"). In `crr` the time functions `tf` are given by name (`"t"`, `"logt"`, `"t,t2"`,
`"t,logt"`, defined in the oracle's header).

How the formulas were confirmed: each was re-implemented independently in R from the text below and compared with
cmprsk on random data (hundreds of data sets for the curves, tens for the tests and the regression): the cumulative
incidence to 2e-15, its variance to 3e-13 (relative; R uses a different order of operations), Gray's statistic on
data **without tied event times** to 1e-14 for 2 and 3 groups, strata, ρ ∈ {−1, 0.5, 1, 2} and up to 3 causes, and
`crr`'s log pseudo-likelihood, score, information, sandwich variance, `bfitj`, `res`, `predict` and the iterations to
1e-14 (also with ties and with `cov2`). Two parts are **not** fully determined: Gray's variance at tied event times
(section 2.4) and `crr`'s variance with `cengroup` (section 3.6).

## Easy to get wrong

1. **The variance of the cumulative incidence is not the delta-method or the textbook "Aalen" formula.** Without ties
   it equals the Aalen-type formula of SAS's `ERROR=AALEN` (section 1.2), but at a time with several events of
   different causes the coefficient of the squared difference term is `[d(Y − d) + 2 d_k (d − d_k)] / ((Y − 1)(Y − d)²)`,
   and at `Y = 1` the second term is `S² d_k` (not 0/0). The delta-method formula is 5 to 30% lower.
2. **The curves are step functions given by all their corners:** they start at `(0, 0, 0)` **even when times are
   negative**, have two points per event time of that cause (before and after the jump) and end with a point at the
   **largest time of the group** (any status), which duplicates the last point when that time is an event of the cause.
3. **Gray's test does not truncate at τ_k.** The paper sets `R_k(t) = 0` after the last event of group k; cmprsk does
   not: a group with subjects still at risk after its last event keeps contributing (`h_r = Y_r / S_r(t−)`). With the
   truncation the statistic differs (e.g. 0.29 instead of 0.69).
4. **The variance of Gray's score is not the paper's (2.10) evaluated naively.** Three choices matter (each found by
   experiment, section 2.3): `d_kr(t) = L(t) h_k(t) [I(k = r) − h_r/h.]` (the paper's `K_k/G⁰` is replaced by
   `L h_k`), the increments `dΓ⁰(u) = dF⁰(u)/G⁰(u−)` inside `c_kr` (not `dN/R.`), and `G⁰(t)/S_r(t)` in `b` taken
   **after** the jumps at t, while the weight `L(t) = G⁰(t−)^ρ` is taken before.
5. **Gray's p-value is `1 − pchisq(stat, df)`:** it has only absolute precision (relative error 3e-4 at p = 1e-13, 0
   below about 1e-16). A singular variance gives `stat = −1`, `pv = 1` and still `df = K − 1`.
6. **Fine-Gray weights use `G(t−)/G(T_j−)`** (the censoring Kaplan-Meier just before each time; censorings at t are
   not yet counted), ties of the cause of interest are handled as Breslow's (one denominator per time).
7. **`crr`'s convergence test is `max_j |U_j| · max(|β_j|, 1) < gtol · max(|ℓ|, 1)`** at the current β (ℓ the log
   pseudo-likelihood); the iterations are plain Newton-Raphson without step halving; a converged β is returned
   **without** taking the last step; after `maxiter` steps the test is applied once more at the final β (so
   `maxiter = 3` can return `converged = TRUE`).
8. **`crr` with `cengroup`: a subject of a censoring group whose last time (any status) is before t gets weight 0 at
   t** (the group's censoring curve is treated as 0 beyond its follow-up).
9. `crr` names the coefficients by deparsing its arguments: `crr(ft, fs, cov)` gives `cov1`, `cov2` for an unnamed
   matrix `cov`, `x1` for `x` with one column, the column names when there are any; `cov2` terms get `*<tf column
   name>` or `*tf<j>`. `summary.crr` **rounds the p-value** to `max(getOption("digits") − 5, 2)` = 2 significant digits.
10. **`crr` is not scale invariant at tiny times:** with times multiplied by 2^-19 (times of order 1e-6) the results
    change in the 5th digit, at 2^-25 in the 2nd, and from about 2^-28 (times below ~1e-8) it fails with `missing value
    where TRUE/FALSE needed` (fixture: the case with times × 2^-40; the right answer is that of the unscaled case,
    which is the case before it). Times × 2^40 are fine. `cuminc` is scale invariant.

## 1. `cuminc(ftime, fstatus, group, strata, rho = 0, cencode = 0, subset, na.action = na.omit)`

### 1.1 Input

- Rows with a missing `ftime`, `fstatus`, `group`, `strata` or `subset` are dropped; R **prints** (to standard output,
  with `cat`, not a warning or message) `<k> cases omitted due to missing values`. `na.action = na.fail` gives the
  error `missing values in object`. `subset` selects rows (an NA in it drops the row).
- A non-finite time: error `NA/NaN/Inf in foreign function call (arg 1)`. No event of any cause (all `fstatus ==
  cencode`): error `NAs in foreign function call (arg 3)`. `rho = NA` with two groups: `NA/NaN/Inf in foreign
  function call (arg 6)` (with one group there is no test and no error). Arguments of different lengths: `arguments
  imply differing number of rows: 29, 30`.
- Negative times are accepted (the curve still starts at `(0, 0, 0)`, section 1.3). Time 0 events are fine.
- Every value of `fstatus` other than `cencode` is a cause (if `cencode` does not occur, all values are causes).
  `fstatus` may be numbers, strings or a factor (the levels' labels are used).
- Groups: the distinct values of `group` sorted as R sorts the vector (numbers numerically, strings as strings,
  logicals FALSE < TRUE; a factor's level order, unused levels dropped). Without `group`, one group named `1`.
  Causes: the distinct non-censoring codes sorted likewise.

### 1.2 Estimate and variance (per group, per cause k)

At the distinct event times `t_l` (events of any cause) of the group: `Y_l` = number with time ≥ t_l (censored at
t_l included), `d_l` = events of all causes at t_l, `d_kl` = events of cause k, `S_{l−1}` = Kaplan-Meier of all causes
just before t_l (`Π_{j<l} (1 − d_j/Y_j)`, 1 for the first). Then (Kalbfleisch and Prentice 1980; Aalen 1978)

    F_k(t) = Σ_{t_l ≤ t} S_{l−1} d_kl / Y_l

    Var F_k(t) = Σ_{t_l ≤ t} { D_l² a_l + S_{l−1}² b_l − 2 D_l S_{l−1} c_l },   D_l = F_k(t) − F_k(t_l)

    a_l = [d_l (Y_l − d_l) + 2 d_kl (d_l − d_kl)] / ((Y_l − 1)(Y_l − d_l)²)     (0 when Y_l = d_l)
    b_l = d_kl (Y_l − d_kl) / (Y_l² (Y_l − 1))                                  (d_kl when Y_l = 1)
    c_l = d_kl (Y_l − d_kl) / (Y_l (Y_l − d_l)(Y_l − 1))                        (0 when Y_l = d_l or Y_l = 1)

Without ties (`d_l = 1`) `a_l = 1/(Y_l − 1)²` and the formula is SAS's Aalen estimator (`d/((Y − 1)(Y − d))` is the
same for d = 1). The tie form of `a_l` was found by solving R's output for the coefficient at constructed two-time
data sets (e.g. `Y = 7`, one event of cause 1 and one of cause 2 at the first time: `a = 2/25`, not `2/30`); it
holds for 3 or more causes with "other" = all causes other than k combined. The cases `Y = 1` and `Y = d` were
checked against R (one observation: variance 1 = `S² d_k`; `(1:5, all cause 1)`: last variance 0.04). Only the times
with `d_kl > 0` change the variance in practice (at other event times every term of that time is 0).

Accuracy: R's values differ from this sum by up to 3e-13 relative (R evaluates it in another order; the running-sum
expansion `F² Σa − 2F ΣF_l a + ΣF_l² a + ...` is no closer). Where the exact variance is 0 (every remaining subject
fails of cause k, F = 1) R returns ±1e-17 or ±1e-18 rounding remnants. R's estimate also drifts in the last bit
(`1:5`, all cause 1: `est` 0.60000000000000009, ..., 1.0000000000000002 instead of 0.6, ..., 1). The cases with
`refExact` carry the exact variance (gmp rationals of the formula above) as `reference`.

### 1.3 The curves (`time`, `est`, `var`)

One curve per group and cause, named `"<group> <cause>"` (one space), in the order cause-major: for the first
cause all groups, then the next cause (`"1 1" "2 1" "3 1" "1 2" ...`). Each curve: `(0, 0, 0)`; then for each event
time t of cause k in the group, in increasing order, `(t, F(t−), V(t−))` and `(t, F(t), V(t))`; then `(t_max, F, V)`
of the last point, with `t_max` the largest time of the group (any status, after dropping missing rows). A cause with
no event in the group: `(0, 0, 0), (t_max, 0, 0)`. Ties of the cause give one pair. A negative time gives a first
corner `(0, 0, 0)` followed by `(−3, 0, 0)`, i.e. a non-monotone time axis (R; see decision 3).

### 1.4 `timepoints(w, times)`

`times`: NA dropped, the rest sorted and made unique (`c(6, 3, 3, NA, 2)` gives columns `2, 3, 6`; the column names
are R's `format` of the times). For each curve and time u: the `est`/`var` of the **last corner with time ≤ u**
(so a jump at u is included); NA when u is beyond the last corner (`t_max` of the group) and when u < 0 (before the
first corner). Result: matrices `est` and `var`, one row per curve (row names the curve names), one column per time.

### 1.5 Gray's test (`Tests`; only with two or more groups)

For each cause c (rows named by the cause codes): `stat`, `pv`, `df`. Notation within one stratum, at the distinct
event times t (any cause) of the stratum, for each group r (all K groups of the data, a group absent from the stratum
has `Y_r = 0`): `Y_r(t)` at risk, `N1_r(t)` events of cause c, `N2_r(t)` events of the other causes;
`S_r(t−)`, `S_r(t)` the Kaplan-Meier of all causes in the group just before and after t (`S_r(t−)` is taken as 0 when
`Y_r(t) = 0`, and then also `S_r(t) = 0`); `F1_r(t−) = Σ_{u<t} S_r(u−) N1_r(u)/Y_r(u)`. Sums over r are written with
a dot; `d1 = N1.`.

    h_r(t) = Y_r(t) / S_r(t−)            R_r(t) = Y_r(t) (1 − F1_r(t−)) / S_r(t−)      (both 0 when Y_r(t) = 0)
    dF⁰(t) = d1(t) / h.(t)               F⁰(t) = Σ_{u ≤ t} dF⁰(u),   G⁰ = 1 − F⁰        (dF⁰ = 0 when h. = 0)
    dΓ⁰(t) = dF⁰(t) / G⁰(t−)             L(t) = G⁰(t−)^ρ

**Score** (Gray 1988, (2.6) with `K_k = L R_k`): `z_k = Σ_t L(t) [N1_k(t) − R_k(t) d1(t)/R.(t)]`. This is
`R_k (dΓ̂_1k − dΓ̂⁰)` of the paper with `dΓ̂⁰ = dN1./R.`; `Σ_k z_k = 0`. **No truncation at τ_k** ("Easy to get wrong" 3).

**Variance** (the paper's (2.10) in the following discrete form, confirmed to 1e-14 without ties):

    d_kr(t)  = L(t) h_k(t) [I(k = r) − h_r(t)/h.(t)]                                   (0 when h. = 0)
    rest_kr(t) = Σ_{u > t} d_kr(u) dΓ⁰(u)                                               (strictly later times)
    q_r(t)   = G⁰(t) / S_r(t)                                                           (0 when S_r(t) = 0)
    a_kr(t)  = d_kr(t) + (1 − q_r(t)) rest_kr(t)          b_kr(t) = −q_r(t) rest_kr(t)
    dF2_r(t) = S_r(t−) N2_r(t) / Y_r(t)
    σ_kk'    = Σ_r Σ_{t: h_r(t) > 0} [ a_kr a_k'r dF⁰(t) + b_kr b_k'r dF2_r(t) ] / h_r(t)

How these were found: with ρ varied, `stat(ρ) = z(ρ)²/V(ρ)` gives `V` as a quadratic form in the weights `L(t_j)`;
fitting its coefficients on small data sets (with z from the formula above, which fits with a residual of 1e-15, so z
and `L = G⁰(t−)^ρ` are right) and comparing them term by term with the candidates fixed each choice: e.g. for event
times (group 1, group 1, group 2), `V = (2/9) L1² + 2 (1/81) L1 L2 + (37/162) L2²`.

**Strata:** z and σ are summed over strata. **Statistic:** with K groups, `stat = z' Σ⁻¹ z` over the first K − 1
components, `df = K − 1`, `pv = 1 − pchisq(stat, df)` (absolute precision only; "Easy to get wrong" 5). When the
(K − 1) × (K − 1) matrix is singular (a group with no subject at risk at any event time, e.g. all censored before the
first event, whether it is the last group or not), `stat = −1`, `pv = 1`, `df = K − 1`. The tolerance R uses to call
the matrix singular was not determined (only exactly singular cases were seen). Identical groups: `stat = 0`, `pv = 1`.
A group without events of cause c, or with all its subjects censored, still counts in K (df stays K − 1).

### 1.6 Gray's variance at tied event times (not fully determined)

At a time with d1 ≥ 2 events of cause c, R's variance is smaller than the formula above. What the experiments show
(fixture cases with integer times; the quadratic-form fits of section 1.5):

- The score z is unchanged (the formula above, also with ties).
- At a tied time, the own term `Σ_r d_kr²/h_r dF⁰` (the part of σ quadratic in `L(t)` from that time alone) is
  multiplied by `(Y. − d1)/(Y. − 1)` (Y. the pooled number at risk) **when all groups have the same `S_r(t−)`** (for
  example before any event, or with censoring only): the hypergeometric correction.
- When the `S_r(t−)` differ it is not: in the two-group form `own = d1 [A − (d1 − 1)/(Y. − 1) B]` with `A = Σ_r p_r
  w_r²` (`p_r = h_r/h.`, `w_r = d_kr/h_r`), the factor B does not depend on d1 and equals A when the `S_r` are equal,
  but otherwise B/A = 27/28 (`Y = (2, 2)`, `h = (3, 2)`), 32/35 (`Y = (3, 2)`, `h = (4, 2)`), 16/15 (`Y = (2, 3)`,
  `h = (3, 3)`), 5/6 (`Y = (2, 2)`, `h = (5, 2)`), 108/91 (`Y = (2, 5)`, `h = (3, 5)`); none of the candidate forms
  tried (hypergeometric with weights p or Y_r/Y., per-group corrections, splitting the tie) reproduces these.
- The cross terms with earlier times (`b` parts) of a tied time also differ; whether the correction applies to them
  was not settled.

The fixture records R's statistics for tied data; until the user decides (decision 5) they can only be matched
without ties. The untied formula on tied data differs from R by 1 to 50% in the statistic.

## 2. `crr(ftime, fstatus, cov1, cov2, tf, cengroup, failcode = 1, cencode = 0, subset, na.action = na.omit, gtol = 1e-6, maxiter = 10, init, variance = TRUE)`

### 2.1 Model and estimating equation (Fine and Gray 1999, the weighted estimating equation)

Data after dropping missing rows (as cuminc, also for NA in `cov1`, `cov2`, `cengroup`; R prints `<k> cases omitted
due to missing values`; `n` = rows used, `n.missing` = rows dropped; rows removed by `subset` are not counted in
`n.missing`). Times `T_i`, codes `fstatus_i`; the cause of interest `failcode`, censoring `cencode`, all other codes
are competing events. `uft` = the sorted distinct times of the cause of interest.

Censoring distribution: `Ĝ` = Kaplan-Meier of the censoring times (`fstatus == cencode` is the "event"; at-risk =
`T ≥ t`, so failures at t are at risk for censoring at t). Weight of subject j at a failure time u:

    w_j(u) = 1                         if T_j ≥ u
           = Ĝ(u−) / Ĝ(T_j−)            if T_j < u and j had a competing event
           = 0                         otherwise (censored before u)

(`Ĝ(u−)` = the curve just before u. Other combinations of `u`/`u−` give different values with ties; with untied
data all agree.) With covariates `Z_i(u)` (section 2.4), `r_i = exp(β'Z_i(u))`, `S0 = Σ_j w_j r_j`, `S1 = Σ_j w_j r_j
Z_j`, `S2 = Σ_j w_j r_j Z_j Z_j'`, `e(u) = S1/S0`, and `D(u)` the set of failures of the cause at u (`d = |D|`):

    ℓ(β) = Σ_u [ Σ_{i ∈ D} β'Z_i(u) − d log S0(u) ]                 (loglik; loglik.null = ℓ(0))
    U(β) = Σ_u [ Σ_{i ∈ D} Z_i(u) − d e(u) ]                         (score)
    I(β) = Σ_u d [ S2/S0 − e e' ]                                    (inf; invinf = I⁻¹)
    bfitj(u) = d / S0(u)                                             (Breslow jumps of the baseline cumulative
                                                                       subdistribution hazard, at uft)
    res[u, ] = Σ_{i ∈ D} (Z_i(u) − e(u))                             (one row per uft, as Schoenfeld residuals)

All of these are evaluated at the returned β (score ≈ 0 when converged).

### 2.2 Variance (sandwich; Fine and Gray 1999, section 3)

`var = I⁻¹ Σ I⁻¹`, `Σ = Σ_i (η_i + ψ_i)(η_i + ψ_i)'` with, at the returned β,

    η_i = Σ_u (Z_i(u) − e(u)) [ I(i ∈ D(u)) − w_i(u) r_i bfitj(u) ]
    ψ_i = Σ_v q(v)/π(v) [ I(T_i = v, i censored) − I(T_i ≥ v) dΛc(v) ]          (v over all distinct times)
    q(v) = Σ_{j competing, T_j < v} Σ_{u ∈ uft, u ≥ v} (Z_j(u) − e(u)) w_j(u) r_j bfitj(u)
    π(v) = #{T ≥ v},   dΛc(v) = #{censored at v} / π(v)

(`q` is the negative of Fine and Gray's q̂ written with the compensator, so that the sign above is right.) The
choices `T_j < v` (strict) and `u ≥ v` matter with ties and were fixed by experiment. Without `variance` (`variance =
FALSE`): `var`, `inf`, `invinf` are NA matrices (the fixture writes NaN) and `res` is NULL; `summary` then runs
without an error on NA standard errors (the fixture leaves the summary out).

### 2.3 Iterations

Start at `init` (default 0; a vector of the wrong length is **recycled silently** by R with R-internal warnings, or
gives an error from `names<-` when too short with `maxiter = 0` — see decision 9). Then, with `k = 0`:

1. Evaluate ℓ, U, I at β. If `max_j |U_j| max(|β_j|, 1) < gtol · max(|ℓ|, 1)`: converged, stop (return this β).
2. If `k = maxiter`: stop, not converged.
3. `β ← β + I⁻¹U` (plain Newton step; no halving, no check that ℓ increased); `k ← k + 1`; go to 1.

So `maxiter = 0` evaluates at `init` (and reports `converged = TRUE` if `init` already satisfies the test). The test
was found by bisecting `gtol` at the transitions (thresholds `max|U| · max(|β|,1)/|ℓ|` exactly, e.g. 3.216803e-2 =
0.9819558/30.526 and, with |β| ≈ 10, 8.501253e-5; with |ℓ| = 0.693 the threshold was |U| = 0.35, i.e. divided by
`max(|ℓ|, 1)`). The comparison is strict `<` as far as could be seen. A monotone likelihood (a covariate equal to the
failure indicator) runs the 10 steps towards infinity without a warning: `converged = FALSE`, coefficient 12.4.
The Newton steps are R's last bits only on x86_64 (the oracle runs there, as coxph's).

### 2.4 Time-varying effects: `cov2` and `tf`

`tf(uft)` must return a matrix with one row per unique failure time and one column per column of `cov2`; at the
j-th failure time `Z_i(u_j) = (cov1_i, cov2_i ∘ tf(u_j))`, and every formula of 2.1 and 2.2 uses that. `tfs` is the
matrix `tf(uft)` (a 1 × 1 zero without `cov2`). Coefficient names: the `cov1` names, then `<cov2 name>*<column name of
tf's result>` or `*tf<j>` when it has none (`"cov11","cov12","cov21*u","cov22*tf2"`). `cov2` alone is allowed.

### 2.5 `summary.crr`, `print.crr`, `predict.crr`

- `se = sqrt(diag(var))`, `z = coef/se`, `p-value` = two-sided normal p **rounded with `signif(p, 2)`** (the fixture
  has R's rounded value `pSummary` and the unrounded `pValue = 2 pnorm(−|z|)`); `exp(coef)`, `exp(−coef)`, and the
  interval `exp(coef ∓ qnorm((1 + conf.int)/2) se)`; `logtest = c(2 (loglik − loglik.null), df = p)` (R prints it as
  "Pseudo likelihood ratio test", with no p-value; the help warns it is not chi-squared).
- `predict(object, cov1, cov2)`: one row per unique failure time: column 1 the time, then for each row of the new
  covariates `1 − exp(−Σ_{u' ≤ u} bfitj(u') exp(β'Z(u')))` with `Z(u')` built as in 2.4 (the time functions evaluated
  at each u'). Both `cov1` and `cov2` must be given when the fit had them (otherwise `argument "cov2" is missing, with
  no default`).

### 2.6 Censoring groups (`cengroup`)

The censoring curve is estimated separately in each group (the Kaplan-Meier of 2.1 within the group), and a competing
event's weight uses its own group's curve: `w_j(u) = Ĝ_g(u−)/Ĝ_g(T_j−)`, **except that `w_j(u) = 0` when u is after
the largest time (any status) of group g** (found on an 8-observation example where the weight at the last failure
time had to be 0; with this rule ℓ, U and the coefficients agree with R to 1e-14 on random data). **The variance with
`cengroup` was not determined:** a ψ term per group (q and π restricted to the group, its own censoring hazard) and
the seven other combinations of group/pooled q, π and hazard all differ from R by 0.05% to 50%; the variance is
invariant to relabelling and reordering, and equals the ungrouped one when there is one group.

### 2.7 Boundaries and errors

- No failure of `failcode` (or a `failcode` that does not occur), a constant covariate: error `Lapack routine dgesv:
  system is exactly singular: U[1,1] = 0` (the index varies; for a constant column `U[3,3] = 0`); exactly collinear
  columns give the same message or `system is computationally singular: reciprocal condition number = 6.13381e-34`.
- No covariates: `undefined columns selected`.
- No censoring (`fstatus` all `failcode`): the ordinary Cox partial likelihood with Breslow ties.
- Negative times, `cencode = 9`, string codes: accepted, same results.

## Where the packages are wrong or inaccurate

1. Gray's `pv = 1 − pchisq(stat, df)`: absolute precision only; the upper tail `pchisq(stat, df, lower = FALSE)` is
   the right value (e.g. 9.8999967723947101e-14 instead of R's 9.9031893796563963e-14).
2. `cuminc`'s variance where it is exactly 0, and the last bit of the estimate (1.0000000000000002); `reference` in the
   fixture for those cases.
3. `crr` at small time scales ("Easy to get wrong" 10): the fixture case with times × 2^-40 is R's error; the right
   result is the unscaled one.
4. The curves start at time 0 even with negative times (not a numeric error, but a non-monotone step function).
5. `summary.crr` rounds the p-values.
6. `crr` recycles a wrong-length `init` silently.

## Permissively licensed sources

None of lifelines (MIT) or statsmodels (BSD-3) implements Gray's test or Fine-Gray regression in a form that could
settle the open points (lifelines has an Aalen-Johansen fitter; its variance is not cmprsk's tie formula).
The formulas here come from the papers and the SAS documentation.

## Decisions for the user

1. **API of the curves.** Proposal: `cuminc(time, status, { group, strata, rho, cencode })` (rStats.js's names: `time`,
   `status`, options object) returning `{ curves: [{ name, group, cause, time, est, var }], tests: [{ cause, stat,
   df, pValue }] | undefined, warnings }`; keep R's corner representation (a), or (b) return the distinct jump times
   only (`time`, `est`, `var` without duplicated corners) plus a `timepoints`-like evaluator. Recommendation (a) for
   R compatibility plus (b) as a helper `timepoints(result, times)` with R's rules (≤ u, NA beyond the last corner).
2. **`subset` and `na.action`.** R prints the number of dropped rows to standard output. Proposal: rStats.js drops
   rows with a missing value and reports it in `warnings` as R's text (`<k> cases omitted due to missing values`), no
   `subset` option (filter beforehand), no `na.fail`. Recommendation: yes.
3. **Negative times.** (a) As R (curve from (0,0,0) then negative times); (b) an Error. Recommendation (b) (design
   rule 1: survival times are non-negative; R's curve is not a step function then).
4. **Gray's p-value.** (a) The upper tail (exact), a documented difference; (b) R's `1 − pchisq`. Recommendation (a)
   (design rule 2). Singular variance: (a) R's sentinel `stat = −1`, `pv = 1`; (b) NaN statistic and p-value for
   that cause (the other causes are still tested), documented. Recommendation (b); a tolerance for "singular" has to
   be chosen (R's is unknown).
5. **Gray's test with tied event times** (the variance not determined, section 1.6). Options: (a) do not ship Gray's
   test until it is resolved; (b) ship the untied formula plus the hypergeometric factor `(Y. − d1)/(Y. − 1)` on the
   own terms (exact when all groups have the same KM before the tie, close otherwise), as a documented difference
   with the fixture's tied cases marked `knownDifference`; (c) allow reading cmprsk's source for this one point (the
   user's clean-room rule forbids it now). Recommendation (b) if the user accepts approximate agreement on tied data,
   else (a).
6. **API of the regression.** Proposal: `crr(time, status, cov1, { cov2, tf, failcode, cencode, cengroup, gtol,
   maxiter, init, variance, confLevel })` with `cov1` a matrix (rows = observations) and coefficient names from an
   option `names` (R's deparsed names cannot be reproduced in JavaScript), result `{ coefficients, var, se, z,
   pValue, lower, upper, expCoef, loglik, loglikNull, logtest: { statistic, df }, score, inf, converged, n, nMissing,
   uftime, bfitj, res, warnings }` like coxph's result. `tf`: (a) a JavaScript function `(times) => number[][]` as R;
   (b) only predefined functions (`"t"`, `"log"`); (c) no time-varying effects. Recommendation (a), since it is just a
   callback, with a check of its shape (an Error otherwise).
7. **Rounded p-values of `summary.crr`.** Report the unrounded p (recommended; R's rounding is a display choice) and
   document it.
8. **`cengroup`.** The variance is not determined (section 2.6): (a) not supported (an Error); (b) coefficients and
   loglik only, variance NaN; recommendation (a) for now.
9. **Input checks** (design rule 1): a wrong-length `init` (R recycles), no failures of `failcode`, constant or
   collinear covariates (R's LAPACK messages), non-finite times or covariates, `maxiter < 0`, `gtol ≤ 0`. Proposal:
   Errors with rStats.js's own messages for all, documented; the no-failure and singular-information cases with
   `"singular information matrix"`-like text (R's text names LAPACK internals).
10. **Non-convergence.** R gives no warning; `converged = false` is in the result. Proposal: add the warning `crr did
    not converge in <maxiter> iterations`? Recommendation: keep R's behaviour (no warning, the flag) — design rule 10
    asks for R's warnings only.
11. **Tiny time scales in `crr`** (R wrong): compute scale-invariantly (rescale times internally by a power of 2, or
    simply never compare times with an absolute tolerance) and document the difference. Recommendation: yes.
12. **Scope.** `predict.crr` (recommended, cheap), `plot` methods (no), `print.cuminc`'s pretty() time grid (no).

## rStats.js's choices

Decided by the user on 2026-11-09. Binding. Every numbered decision above is taken as recommended in this document, with these answers:
- Gray's test with tied event times: use the hypergeometric factor (Y - d)/(Y - 1) on the term of each tied time
  (derived from the paper; equal to cmprsk when the groups' KM S_r(t-) are equal). Where cmprsk differs, this is a
  documented difference in docs/differences-from-r.md; tests against the fixture's tied cases use a tolerance stated
  and justified per case, or record the difference.
- crr's convergence rule (max|U_j| max(|beta_j|, 1) < gtol max(|loglik|, 1)) may be used as specified: it was found
  by experiment. (During the experiments R printed two fragments of crr's code in an error call and an internal
  warning; the two parts they showed were confirmed by separate experiments, and this document relies only on those.)
- cuminc in R's corner representation plus a timepoints helper; crr with matrix covariates, tf as a callback; Gray's
  p-value as the exact upper tail (a singular variance gives NaN for that cause); unrounded p-values; no cengroup for
  now; negative times are an error; rStats.js's own messages; non-convergence only through the converged flag; crr
  computed scale-invariantly; predict yes, plots no.
