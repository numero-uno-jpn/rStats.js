# ROC curves and diagnostic accuracy (rStats.js 1.4.0): the behaviour to reproduce

This file describes, in words and formulas, what the R functions below compute, for an implementation that must not
read their source. It was written by reading the R code of the packages (deparsed from the image
`rstats-oracle:4.6.2`, R 4.6.2, package snapshot of 2026-10-23) and checking each statement against their output.
pROC's placements are computed in C++ (`delongPlacementsCpp`), whose source is not in the image; what it computes was
checked against a direct computation (section 3). Where this file and a fixture seem to disagree, report it instead of
working around it.

| package | version | licence | functions |
|---|---|---|---|
| pROC | 1.19.1 | GPL (≥ 3) | `roc`, `auc`, `ci.auc`, `var`, `roc.test`, `coords`; described only: `smooth`, `ci.coords`, `ci.thresholds`, `ci.se`, `ci.sp`, `cov`, `power.roc.test` |
| epiR | 3.0.0 | GPL (≥ 2) | `epi.tests` |
| gmp 0.7.5.1, Rmpfr 1.1.3 | | | exact references |

Oracles and fixtures (`npm run oracle -- <name>`; together about 20 s, memory cap 1 GB each):

| oracle | fixtures |
|---|---|
| `oracle/roc.R` | `roc` (curves), `rocAuc` (partial AUC), `ciAuc` (DeLong interval and variance), `rocCoords` |
| `oracle/roctest.R` | `rocTest` (DeLong, paired and unpaired) |
| `oracle/rocboot.R` | `ciAucBoot`, `rocTestBoot` (bootstrap and Venkatraman, with `seed` and `next`) |
| `oracle/epitests.R` | `epiTests` |

Fixture conventions: the arguments are pROC's in camelCase (`controls`, `cases` or `response`, `predictor`,
`levels`, `naRm`, `direction`, `confLevel`, `partialAuc`, `partialAucFocus`, `partialAucCorrect`, `bestMethod`,
`bestWeights`, `bootN`, `bootStratified`); `responseIsString: true` marks a character response (all vectors are
written as strings). **A vector of length 1 is written as a scalar string** (`"cases": "2.5"`), longer ones as arrays.
The expected fields keep pROC's / epiR's names (`thresholds`, `sensitivities`, `lr_pos`, `pv.pos`, ...). Every case
has `warnings` (R's, each once) or `{"error": message}`. Where the package is inaccurate, the case has a `reference`
holding `refKind` and the exact values (rational arithmetic with gmp, rounded once with Rmpfr; or qbeta directly):
`ties`, `counts`, `cancellation` (sections 4 and 9). pROC's `message()`s ("Setting levels: control = 0, case = 1",
"Setting direction: controls < cases") are not warnings and are not recorded; the levels and direction it chose are
in the expected fields.

Notation: `m` cases (positive class, the second level), `n` controls. ψ(x, y) = 1 if x > y, ½ if x = y, 0 if
x < y (exact comparison of doubles). "Positive" means classified as a case.

## Easy to get wrong

1. **Direction "auto" compares medians, not AUCs.** `"<"` (cases have higher values; positive when predictor ≥
   threshold) is chosen when `median(controls) <= median(cases)`, otherwise `">"` (positive when predictor ≤
   threshold). The AUC can therefore be below 0.5 with "auto" (controls 1, 5, 9 and cases 0, 5, 6: equal medians,
   "<", AUC 0.389). Ties of the medians go to "<".
2. **The first level is the control.** `levels` defaults to the sorted levels of `factor(response)` (`0` before
   `1`, `"a"` before `"b"`, `"neg"` before `"pos"`); the second is the case. With more than two levels the first two
   are used with a warning and the other observations are dropped.
3. **The thresholds are midpoints between consecutive distinct values, with −Inf and +Inf at the ends**, not the
   data values. A curve with k distinct values has k + 1 points. Midpoints are computed as `(a + b)/2`, or as
   `a/2 + b/2` when that exceeds 1e100 in absolute value (no overflow at 1.7e308); when the midpoint rounds onto `a`
   or `b` (adjacent doubles, subnormals), the threshold becomes `b` for "<" and `a` for ">" (section 2).
4. **The stored order is by increasing specificity**: for "<" the thresholds increase (−Inf first), for ">" they
   decrease (+Inf first); sensitivity goes from 1 to 0 in both.
5. **`coords(..., "best")` compares floating-point criteria with `==`.** Thresholds whose Youden index or distance
   to the corner is mathematically equal to the best one are lost when the sums round differently (about 1% of random
   small integer data sets: controls 7, 10, 12, 6, 10, 6 and cases 5, 2, 3, 1, 12, 14, 12, 14, 3, 14, 8, 13 give
   only threshold 11 where 11 and 12.5 tie at se + sp = 4/3). Fixture `refKind: "ties"`.
6. **`coords` rebuilds the counts from the proportions**: `tp = se · m`, `tn = sp · n`, `fn = m − tp`,
   `fp = n − tn`, and every other column from these and from `1 − sp`. The counts are then not integers
   (14.000000000000002; 32/49 · 49 = 31.999999999999996) and `fpr = 1 − sp`, `lr_pos = se/(1 − sp)`, ... cancel when
   sp is near 1 (n = 10000 controls, one false positive: fpr 9.9999999999989e-05, lr_pos 10000.0000000011). Fixture
   `refKind: "counts"` / `"cancellation"`; compute from the integer counts.
7. **pROC's "youden" is se + sp (weighted), not se + sp − 1**, and "closest.topleft" is returned as the positive
   distance `(1 − se)² + r(1 − sp)²`, where r = (1 − prevalence)/(cost · prevalence) from `best.weights = c(cost,
   prevalence)`; with the default weights c(1, 0.5), r = 1.
8. **`ci.auc` returns three numbers, [lower, AUC, upper], clipped to [0, 1]**, and the middle one is θ from the
   placements, which can differ from `auc` in the last bits (18 of 64 fixture cases). With one case or one control
   it returns `NA NA NA` silently.
9. **pROC's bootstrap of a class with one observation is wrong**: `sample(x, replace = TRUE)` with a single number
   x ≥ 1 samples from `1:x` (one case with value 5: the bootstrap "cases" are drawn from 1, ..., 5, and five of them).
   Only `ci.auc`/`ci.thresholds`/`ci.coords` with `boot.stratified = TRUE` are affected (section 5).
10. **The unpaired Venkatraman test mixes up a sample size**: the pooled case proportion is
    `(cases₁ + cases₂)/(2 · N₁)` instead of `/(N₁ + N₂)` (section 6.3).
11. **`roc.test` chooses the bootstrap silently** when `method` is not given and the two directions differ (or a
    partial AUC or smoothing is involved) — a random result. With `method = "delong"` given, different directions
    only warn.
12. **Paired detection**: `roc.test` treats two curves as paired when their responses are identical (after NA
    removal) or their original responses are, and then rebuilds both curves on the observations where neither
    predictor is NA.
13. **epiR's "tp" is the true prevalence**, not true positives; "ap" is the apparent prevalence. The
    table is test (rows) × disease (columns), a = test+ disease+.
14. **epiR's "exact" limits are computed as 1 − qbeta(...)**, which loses digits when the limit is small (se = 1e-7:
    lower limit off by 4e-9 relative, upper by 1e-11); `method = "agresti"` changes the **point estimates** to the
    adjusted proportion, does not clip, and feeds the adjusted se/sp into the LR intervals, which therefore depend on
    `method` (section 9).

## 1. Input: `roc()`

`roc(response, predictor, levels, percent = FALSE, na.rm = TRUE, direction = c("auto", "<", ">"), quiet = FALSE,
...)` or `roc(controls = , cases = , direction = )`. Checks, in order (the first that fails):

- `direction`: `match.arg` (error `'arg' should be one of “auto”, “<”, “>”`; abbreviations do not help since the
  choices are symbols).
- response/predictor form:
  - `levels` not given: the levels of `factor(response)` (sorted; NA is not a level). More than two: warning
    `'response' has more than two levels. Consider setting 'levels' explicitly or using 'multiclass.roc' instead`
    and the first two are kept. Fewer than two: error `'response' must have two levels`. `levels` given with a length
    other than 2: error `'levels' argument must have length 2`.
  - predictor not numeric: an ordered factor is converted (to its labels as numbers if they all parse, else to its
    codes with a warning); anything else: error `Predictor must be numeric or ordered.`
  - lengths differ: error `Response and predictor must be vectors of the same length.`
  - `na.rm = TRUE` (default): observations with NA (or NaN) in the response or the predictor are removed.
    `na.rm = FALSE` with any NA: `roc()` returns `NA` (not a curve, no warning).
  - controls = predictor values whose response equals `levels[1]`, cases = those equal to `levels[2]` (compared as
    strings); none: error `No control observation.` / `No case observation.`. Observations with other responses are
    dropped.
  - an infinite predictor value: warning `Infinite values(s) in predictor, cannot build a valid ROC curve. NaN
    returned instead.` and the result is `NaN` (not a curve).
- controls/cases form: NAs removed (with `na.rm`), empty → the same errors, infinite → the same warning and NaN. The
  levels are then `0`, `1`.

Then the direction (Easy to get wrong 1), and the curve.

## 2. The curve

Let u₁ < … < u_k be the distinct values of controls ∪ cases. Thresholds t₀ = −Inf, t_i = (u_i + u_{i+1})/2 for
i = 1, …, k − 1, t_k = +Inf, computed as u_i/2 + u_{i+1}/2 when |(u_i + u_{i+1})/2| > 1e100 (including when the sum
overflows). If some t_i (1 ≤ i ≤ k−1) equals a data value (it rounded onto u_i or u_{i+1}): for "<", t_i becomes
u_{i+1}; for ">", t_i becomes u_i. (So for "<" a case is positive when predictor ≥ t, for ">" when predictor ≤ t,
and each threshold separates exactly u_i from u_{i+1}.)

For each threshold: "<": se = #(cases ≥ t)/m, sp = #(controls < t)/n; ">": se = #(cases ≤ t)/m, sp =
#(controls > t)/n. The result is stored by increasing sp (ties: decreasing se): for "<" in the order t₀, …, t_k, for
">" in the order t_k, …, t₀ (thresholds Inf, …, −Inf). The first point is (se, sp) = (1, 0), the last (0, 1). se and
sp are the divisions `count/m`, `count/n` (one rounding).

`auc` = Σ over consecutive stored points of (sp_{j+1} − sp_j)(se_j + se_{j+1})/2, summed in order. This equals
U/(mn) with U = Σ_{cases x} Σ_{controls y} ψ(x, y) for "<" and Σ ψ(y, x) for ">" (the Mann-Whitney statistic: AUC =
W/(mn) of `wilcox.test(cases, controls)` for "<"); in the fixtures the trapezoid sum and U/(mn) agree to an ulp or
two. The AUC with ">" is 1 − (AUC with "<") mathematically.

Scaling: the curve depends only on the order of the values, the thresholds scale exactly by powers of 2 (fixture data
sets `small2^k`, k = −1070 … 1019, `subnormal`, `adjacent`, `huge`); R handles all of them correctly.

Result fields kept in the fixture: thresholds, sensitivities, specificities, auc, direction, levels, controls,
cases (in input order, after removals). pROC also stores `percent`, `original.predictor`, `original.response`,
`predictor`, `response`, `call`, `fun.sesp`.

`percent = TRUE` multiplies se, sp, AUC and the intervals by 100 (and partial-AUC limits are then given in percent).
Not worth supporting (decision 12).

## 3. AUC and DeLong's interval: `auc()`, `ci.auc()`, `var()`

**Placements** (DeLong, DeLong & Clarke-Pearson 1988): for "<", each case x_i has V₁₀(x_i) = (1/n) Σ_j ψ(x_i, y_j),
each control y_j has V₀₁(y_j) = (1/m) Σ_i ψ(x_i, y_j); θ = mean of the V₁₀ (= mean of the V₀₁ = AUC). For ">" the
same with ψ's arguments swapped (V's are 1 − the "<" ones). pROC computes them in O(N log N) from mid-ranks (Sun & Xu
2014: V₁₀(x_i) = (rank of x_i among all − rank of x_i among cases)/n, with mid-ranks for ties) and checks
`all.equal(θ, auc)` (tolerance 1.5e-8; error `pROC: error in calculating DeLong's theta ...` otherwise, never seen).

S₁₀ = Σ (V₁₀ − θ)²/(m − 1), S₀₁ = Σ (V₀₁ − θ)²/(n − 1), **S = S₁₀/m + S₀₁/n** (`var(roc)` returns S, computed as
`var(V₀₁)/n + var(V₁₀)/m` with R's two-pass var; same value up to rounding).

`ci.auc(roc, conf.level = 0.95, method = c("delong", "bootstrap"), boot.n = 2000, boot.stratified = TRUE,
reuse.auc = TRUE, ...)`:
- `conf.level > 1 | conf.level < 0`: error `conf.level must be within the interval [0,1].` (NaN: R's "missing value
  where TRUE/FALSE needed").
- perfect curve (max(se + sp) within 1.5e-8 of 2, i.e. AUC = 1 in either direction): warning `ci.auc() of a ROC
  curve with AUC == 1 is always 1-1 and can be misleading.` (`var()`: `var() of a ROC curve with AUC == 1 is always 0
  and can be misleading.`).
- `method` missing: "bootstrap" for a partial AUC or a smoothed curve, else "delong"; given: `match.arg` (error
  `'arg' should be one of “delong”, “bootstrap”`; "del" works); "delong" with a partial AUC: error `DeLong method is
  not supported for partial AUC. Use method="bootstrap" instead.` (only when the curve's stored AUC is partial: a
  `partial.auc` passed to `ci.auc` of a full-AUC curve is silently ignored because `reuse.auc = TRUE`).
- DeLong: m ≤ 1 or n ≤ 1 → `c(NA, NA, NA)` without a warning. Otherwise
  `qnorm(c(α/2, 0.5, 1 − α/2), mean = θ, sd = sqrt(S))` with α = 1 − conf.level, then values > 1 set to 1 and < 0 to
  0. conf.level 0 gives [θ, θ, θ], 1 gives [0, θ, 1]; S = 0 (perfect or all values equal) gives [θ, θ, θ].
- Result: the three numbers with attributes conf.level, method, boot.n, boot.stratified, auc.

Accuracy: the placements are exact multiples of 1/(2n) and 1/(2m) rounded once; θ and S are accurate to a few ulps
(checked with Rmpfr at m = 3000, n = 4000: S relative error 1.2e-16). No reference needed; compare with a relative
tolerance of about 1e-13 (AUC and θ may differ from R's by an ulp or two).

## 4. Coordinates: `coords()`

`coords(roc, x, input = "threshold", ret = c("threshold", "specificity", "sensitivity"), best.method =
c("youden", "closest.topleft"), best.weights = c(1, 0.5), transpose = FALSE, ...)`. The fixture uses `ret = "all"`
and keeps 15 columns: threshold, sensitivity, specificity, accuracy, tn, tp, fn, fp, npv, ppv, fpr, lr_pos, lr_neg,
youden, closest.topleft (pROC also has tpr = recall = se, tnr = sp, fnr, fdr, precision = ppv, and "1-x" columns).

`x`:
- missing or `"all"`: every point of the curve (stored order).
- `"best"` (partial matching: `"be"` works): r = (1 − w₂)/(w₁ w₂) with `best.weights = (w₁, w₂)`; error `'best.weights'
  must be a numeric vector of length 2` (length ≠ 2) and `prevalence ('best.weights[2]') must be in the interval
  ]0,1[.` (w₂ ≤ 0 or ≥ 1); w₁ is not checked (w₁ = 0 gives r = Inf, w₁ < 0 a negative r). `best.method` by
  `match.arg` among "youden", "closest.topleft", "topleft" (error `'arg' should be one of “youden”, “closest.topleft”,
  “topleft”`); criterion youden: se + r·sp; closest.topleft: −((1 − se)² + r(1 − sp)²). **All rows whose criterion
  `==` its maximum** are returned, in stored order (Easy to get wrong 5; the reference compares exact rationals).
- `"local maximas"`: described only (the points where the curve has a corner).
- numeric thresholds (input "threshold"): for each x the point with "<": se = #(cases ≥ x)/m, sp = #(controls < x)/n;
  ">": se = #(cases ≤ x)/m, sp = #(controls > x)/n — a value equal to a data value counts as positive. The threshold
  column is x itself. ±Inf are allowed; NaN fails with R's `missing value where TRUE/FALSE needed`; a numeric of
  length 0: error `Numeric 'x' has length 0`. Duplicate and unsorted x are fine (one row each, in the given order).
- numeric with `input = "sensitivity"` / `"specificity"` (described only): the point(s) with that value, else linear
  interpolation between the neighbouring points; out of range: error `Input sensitivity (1.2) not in range (0-1)`.

Columns (as pROC computes them; P = m, N = n): tp = se·P, fn = P − tp, tn = sp·N, fp = N − tn; npv = tn/(tn + fn),
ppv = tp/(tp + fp) (0/0 = NaN at the ends); accuracy = (tp + tn)/(P + N); fpr = 1 − sp; lr_pos = se/(1 − sp)
(Inf at sp = 1 with se > 0, NaN at se = 0 and sp = 1); lr_neg = (1 − se)/sp (NaN at sp = 0 and se = 1); youden =
se + r·sp; closest.topleft = (1 − se)² + r(1 − sp)². The `best` rows also carry a column named after the method
(youden: the criterion; closest.topleft: the positive distance), not kept in the fixture.

The **reference** (refKind `ties`, `counts`, `cancellation`) computes everything from integer counts with rational
arithmetic: se = tp/P, sp = tn/N, fpr = fp/N, lr_pos = (tp·N)/(P·fp), lr_neg = (fn·N)/(P·tn), youden = tp/P + r·tn/N,
closest.topleft = (fn/P)² + r(fp/N)² with r exact from the double weights, each rounded once. Where the reference is
absent, R agrees with it to 1e-13 relative and has the same rows.

`ci.coords`, `ci.thresholds`, `ci.se`, `ci.sp` (described only): the stratified bootstrap of section 5 (one
`sample()` of the controls, then of the cases, per replicate); `ci.thresholds` evaluates se and sp at fixed thresholds
(default the "local maximas") in each replicate; `ci.coords` recomputes the curve and its coords, and for `x = "best"`
with several best rows applies `best.policy` ("stop": error `More than one "best" threshold was found, aborting.
Change 'best.policy' to alter this behavior.`, "omit": NA, "random": one row by `sample()`); `ci.se`/`ci.sp` give se
at given sp (interpolated) and vice versa. Each reports the type-7 quantiles α/2, 0.5, 1 − α/2 with NAs removed.

## 5. The bootstrap (`ci.auc(method = "bootstrap")`, `roc.test(method = "bootstrap")`)

Reproducible with R's random stream: the draws are `sample()` only (R_unif_index, rejection sampling, on the
Mersenne-Twister stream), which rStats.js already reproduces (`src/random/sample.ts`). The fixtures call
`set.seed(seed)` right before the pROC call and record `next = runif(1)` afterwards.

`ci.auc`, stratified (default): for each of `boot.n` replicates, `controls* = sample(controls, replace = TRUE)` then
`cases* = sample(cases, replace = TRUE)` (each a vector of the class's size), the curve of section 2 with the
original direction, its AUC (partial AUC with the curve's settings, the McClish correction allowed below the
diagonal). Easy to get wrong 9: a class of one value x ≥ 1 is drawn as `sample.int(floor(x), floor(x), replace =
TRUE)` instead (wrong data and a different number of draws); a single value < 1 is returned as is. Non-stratified:
`idx = sample(1:N, replace = TRUE)` over all observations in their order (`c(controls, cases)` for the controls/cases
form, the input order otherwise), split by response; a replicate without cases gives NaN (dropped with the warning
`NA value(s) produced during bootstrap were ignored.`), **a replicate without controls stops the whole call** with R's
`missing value where TRUE/FALSE needed` (fixture). Result: `quantile(aucs, c(α/2, 0.5, 1 − α/2))` (type 7, NAs
removed); not clipped.

`roc.test(method = "bootstrap")`: per replicate, stratified paired: one index draw for the controls then one for the
cases (`sample(1:n, replace = TRUE)`, `sample(1:m, replace = TRUE)`), applied to both curves; stratified unpaired:
four draws, curve 1 controls, curve 1 cases, curve 2 controls, curve 2 cases; non-stratified: one `sample(1:N)` (paired)
or one per curve. The AUC of each resampled curve (original direction; a failing replicate gives NA, dropped with the
warning `<k> NA value(s) produced during bootstrap were ignored.`); D = (AUC₁ − AUC₂)/sd(AUC₁* − AUC₂*) (sd with
n − 1), 0 when every difference and the observed difference are 0. p-value from the normal distribution as DeLong's
paired test. Statistic name "D", parameter c(boot.n, boot.stratified) named "boot.n", "boot.stratified"; no interval.
Methods "sensitivity" / "specificity" (described only) test the difference of se at a given sp (or vice versa) the same
way.

Platform: these fixtures were made on arm64 (pROC is not in the amd64 image). `sample()` uses no normal deviates and
no compiled floating-point code that FMA contraction could change, and the AUC and quantile arithmetic is R-level, so
they should equal the x86_64 results; once pROC is in the amd64 image, add `# oracle-platform: amd64` to
`oracle/rocboot.R` and regenerate to confirm.

## 6. Comparing two curves: `roc.test()`

`roc.test(roc1, roc2, method = c("delong", "bootstrap", "venkatraman", "sensitivity", "specificity"), alternative =
c("two.sided", "less", "greater"), paired = NULL, boot.n = 2000, boot.stratified = TRUE, conf.level = 0.95, ...)`;
also `roc.test(response, predictor1, predictor2)` (builds both curves with the same arguments, NA in any of the three
removed first). Order of checks: `alternative` by `match.arg`; both perfect: warning `roc.test() of two ROC curves
with AUC == 1 has always p.value = 1 and can be misleading.`; pairing:
- `paired` NULL: paired if `are.paired` (identical levels and identical response vectors, or identical original
  responses — then both curves are rebuilt without the observations where either predictor or the response is NA);
- `paired = TRUE` and not pairable: error `The paired ROC test cannot be applied to unpaired curves.`;
- `paired = FALSE` but pairable: warning `The ROC curves seem to be paired. Consider performing a paired roc.test.`

Then the method (Easy to get wrong 11); with `method = "delong"` given: partial AUC → error `DeLong's test is not
supported for partial AUC. Use method="bootstrap" instead.`; different directions → warning `DeLong's test should not
be applied to ROC curves with a different direction.`; conf.level not in [0, 1] → error `conf.level must be between 0
and 1.` (only when `method` is given; with `method` missing a level of 1.5 gives NaN limits and the warning `NaNs
produced`).

Result (htest): `estimate` = (AUC of roc1, AUC of roc2) named "AUC of roc1", "AUC of roc2"; `null.value` 0 named
"difference in AUC"; `alternative`; `data.name`; plus the curves.

### 6.1 Paired DeLong

Both curves on the same m cases and n controls; V₁₀⁽ᵏ⁾, V₀₁⁽ᵏ⁾, θ_k for curve k = 1, 2 (each with its own direction).
S₁₀ = the 2 × 2 matrix Σ_i (V₁₀⁽ᵏ⁾(x_i) − θ_k)(V₁₀⁽ˡ⁾(x_i) − θ_l)/(m − 1), S₀₁ likewise over the controls with
n − 1, S = S₁₀/m + S₀₁/n; d = θ₁ − θ₂, σ = sqrt(S₁₁ + S₂₂ − 2S₁₂) (computed as sqrt(Lᵀ S L), L = (1, −1)).
Z = d/σ; if Z is NaN with d = 0 and σ = 0, Z = 0 (identical or both perfect curves: p = 1, one-sided 0.5, interval
[0, 0]). With m = 1 or n = 1, σ is NaN and the check `d == 0 && sigma == 0` itself fails: **R error `missing value
where TRUE/FALSE needed`** when d = 0 (fixture), NaN results otherwise. p-value: two-sided 2Φ(−|Z|), "greater"
Φ(−Z), "less" Φ(Z). Interval for the difference (not clipped): d ∓ z σ with z = qnorm(1 − (1 − conf.level)/2).
Statistic "Z", no parameter, method `DeLong's test for two correlated ROC curves`.

### 6.2 Unpaired DeLong

S_R, S_S as in section 3 for each curve (sizes m_R, n_R and m_S, n_S); D = (θ_R − θ_S)/sqrt(S_R + S_S); degrees of
freedom (pROC's own Welch-Satterthwaite form) df = (S_R + S_S)² / (S_R²/(N_R − 1) + S_S²/(N_S − 1)) with N = m + n
the total size of each curve. p-value from the t distribution: 2 pt(−|D|, df), "greater" pt(−D, df), "less" pt(D,
df). No interval. Statistic "D", parameter "df", method `DeLong's test for two ROC curves`. Both perfect: 0/0 = NaN
statistic, df, p-value (no special case, unlike the paired test); a curve with one case: NaN.

### 6.3 Venkatraman (described; fixture `rocTestBoot`)

Two-sided only (error `Only two-sided tests are available for Venkatraman.`); partial AUC and smoothing are errors.
Random (`runif`, `sample`), reproducible. Statistic "E", parameter boot.n, null value named "difference in at least
one ROC operating point", no estimate; p = #(E* ≥ E)/boot.n.
- Paired (Venkatraman & Begg 1996): R, S = ranks of the two predictors over all N observations (ties broken by
  order, "first"). For k = 1..N: fn_R(k) = #(cases with R ≤ k), fp_R(k) = #(controls with R > k), likewise for S;
  E = Σ_k |(fn_S + fp_S) − (fn_R + fp_R)|. Permutation: R′ = R + U₁ − ½, S′ = S + U₂ − ½ (U₁, U₂ = runif(N) each,
  in this order), q = 1 − round(runif(N)); R″ = q R′ + (1 − q) S, S″ = q S′ + (1 − q) R (the swapped values are the
  unjittered ranks); E* from the ranks ("first") of R″ and S″.
- Unpaired (Venkatraman 2000): ranks within each curve; mp = (#cases₁ + #cases₂)/(N₁ + N₁) (bug: should be N₁ + N₂);
  for each curve F(k) = #(cases with rank ≤ k)/m, G(k) = #(controls with rank ≤ k)/n for k = 1..N, p(k) =
  mp F + (1 − mp) G, e(k) = mp F + (1 − mp)(1 − G); E = trapezoidal integral over the sorted union of the p values
  of |e_R(p) − e_S(p)|, each e linearly interpolated (R's `approxfun` defaults: NA outside the range, dropped from the
  sum; duplicated p averaged). Permutation: R + runif(N₁) − ½, S + runif(N₂) − ½, then the jittered controls of both
  curves are shuffled together (`sample`), then the cases, and reassigned in order; E* as above.

## 7. Partial AUC (a decision for the user; fixture `rocAuc`)

`auc(roc, partial.auc = c(a, b), partial.auc.focus = c("specificity", "sensitivity"), partial.auc.correct = FALSE)`.
`partial.auc` must be FALSE or numeric of length 2 (error `partial.auc must be either FALSE or a numeric vector of
length 2`); it is sorted decreasing to (hi, lo); focus by `match.arg` ("se" works). With focus specificity, x = the
stored sp (increasing) and y = se; with focus sensitivity, x = the stored se reversed (increasing) and y = sp reversed.

Area: the trapezoids between the points with lo ≤ x ≤ hi (in stored order). If hi is not one of those x: take j = the
first point with x ≥ hi and i = j − 1; y_hi = y_j + (hi − x_j)/(x_i − x_j) · (y_i − y_j); add (hi − x_i)(y_i + y_hi)/2.
If lo is not one of them: j = (first point with x > lo) − 1, i = j + 1; y_lo = y_i + (x_i − lo)/(x_i − x_j)·(y_j −
y_i); add (x_i − lo)(y_i + y_lo)/2. If no point lies in [lo, hi]: interpolate y at both ends on the segment that spans
the interval and return (y_hi + y_lo)/2 · (hi − lo). Limits outside [0, 1] give NA silently (no point reaches hi).

`partial.auc.correct = TRUE` (McClish 1989): min = (1 − hi + 1 − lo)(hi − lo)/2 (the area under the diagonal),
max = hi − lo, corrected = (1 + (pAUC − min)/(max − min))/2; if pAUC < min: warning `Partial AUC correction not
defined for ROC curves below the diagonal.` and NA. (1, 0) corrected equals the full AUC.

Intervals and tests of a partial AUC exist only by bootstrap in pROC (and Obuchowski's variance for the specificity
focus, `var(method = "obuchowski")`, not described).

## 8. Smoothing (described only)

`smooth(roc, method = c("binormal", "density", "fitdistr", "logcondens", "logcondens.smooth"), n = 512)`. Binormal:
fit `lm(qnorm(sp) ~ qnorm(se))` over the curve's points with both finite (error `ROC curve not smoothable (not
enough points).` with fewer than two); the smoothed curve is se = pnorm(z), sp = pnorm(a + b z) for z = qnorm of
`seq(0, 1, 1/(n − 1))`, with the end points (se, sp) = (1, 0) and (0, 1) added; its AUC is pnorm(a/sqrt(1 + b²)) (a,
b intercept and slope). "density": kernel densities of each class (`density()`, bandwidth "nrd0", from min − 3bw to
max + 3bw, n points) cumulated into se and sp; "fitdistr" fits named distributions with MASS; "logcondens" uses the
logcondens package. Smoothed curves have no DeLong interval (bootstrap only).

## 9. Diagnostic 2 × 2 measures: `epiR::epi.tests` (fixture `epiTests`)

The standard R reference for sensitivity, specificity, predictive values and likelihood ratios with intervals.
`epi.tests(dat, method = "exact", digits = 2, conf.level = 0.95)`; `dat` a 2 × 2 table, **rows test +/−, columns
disease +/−**: a = test+ D+, b = test+ D−, c = test− D+, d = test− D− (a length-4 vector is read by rows). M1 = a + c
(diseased), M0 = b + d, N1 = a + b (test positive), N0 = c + d, total. `method` is compared with `==`: anything other
than "exact", "wilson", "agresti", "clopper-pearson", "jeffreys" fails with `object 'trval' not found` (no partial
matching); `digits` must be 2, 3 or 4 (error `Argument 'digits' for this function must take the value of 2, 3 or
4.`); conf.level is not checked (1.2 gives NaN limits with `NaNs produced`). Counts are not checked (2.5 is used).

Result `$detail`: rows (statistic, est, lower, upper), in this order, each a proportion interval of x/n by `method`
unless stated:

| statistic | meaning | x / n or formula |
|---|---|---|
| ap | apparent prevalence | N1 / total |
| tp | true prevalence | M1 / total |
| se | sensitivity | a / M1 |
| sp | specificity | d / M0 |
| diag.ac | diagnostic accuracy | (a + d) / total |
| diag.or | diagnostic odds ratio | ad/(bc); Woolf: exp(log OR ∓ z sqrt(1/a + 1/b + 1/c + 1/d)) |
| nndx | number needed to diagnose | 1/(se + sp − 1); limits 1/(se_l + sp_l − 1), 1/(se_u + sp_u − 1), the smaller first |
| youden | Youden's index | se + sp − 1; limits se_l + sp_l − 1 and se_u + sp_u − 1, the smaller first |
| pv.pos | positive predictive value | a / N1 |
| pv.neg | negative predictive value | d / N0 |
| lr.pos | positive likelihood ratio | (a/M1)/(1 − d/M0); exp(log LR ∓ z sqrt((1 − se)/(M1 se) + sp/(M0 (1 − sp)))) |
| lr.neg | negative likelihood ratio | (1 − a/M1)/(d/M0); exp(log LR ∓ z sqrt(se/(M1 (1 − se)) + (1 − sp)/(M0 sp))) |
| p.rout | proportion ruled out | (c + d) / total |
| p.rin | proportion ruled in | (a + b) / total |
| p.tpdn | false positive proportion of the disease-negative | b / M0 |
| p.tndp | false negative proportion of the disease-positive | c / M1 |
| p.dntp | false positive proportion of the test-positive | b / N1 |
| p.dptn | false negative proportion of the test-negative | c / N0 |

z = qnorm(1 − (1 − conf.level)/2). In the LR and nndx/youden rows, se and sp are the `est` of the se/sp rows (and
se_l, se_u their limits), i.e. the adjusted proportions under "agresti". (The LR interval is the log method of Simel,
Samsa & Matchar 1991: its variance equals 1/a − 1/M1 + 1/b − 1/M0. The nndx and youden "intervals" combine the
limits of se and sp and have no stated coverage.)

Proportion intervals (x of n, α = 1 − conf.level):
- "exact": est x/n; lower 1 − qbeta(1 − α/2, n − x + 1, x) (0 when x = 0), upper 1 − qbeta(α/2, n − x, x + 1) (1 when
  x = n): the Clopper-Pearson limits, computed through the complement, which cancels when the limit is small (Easy to
  get wrong 14). The fixture's `reference` (refKind `cancellation`) gives qbeta(α/2, x, n − x + 1) and qbeta(1 − α/2,
  x + 1, n − x) directly for the rows that differ by more than 1e-13.
- "clopper-pearson": est x/n; qbeta(α/2, x, n − x + 1), qbeta(1 − α/2, x + 1, n − x) directly (qbeta with a shape 0
  gives 0 or 1). Same as DescTools' and `binomCI(..., { method: "clopper-pearson" })`.
- "wilson": est x/n; centre (p + z²/(2n))/(1 + z²/n) ∓ z sqrt((p(1 − p) + z²/(4n))/n)/(1 + z²/n), not clipped — the
  same values as `binomCI`'s Wilson (which clips; Wilson never leaves [0, 1] beyond rounding).
- "agresti": est **p̃ = (x + z²/2)/(n + z²)**; p̃ ∓ z sqrt(p̃(1 − p̃)/(n + z²)); not clipped (limits below 0 or above
  1 occur at zero cells). DescTools/`binomCI` "agresti-coull" keeps est = x/n and clips.
- "jeffreys": est x/n; qbeta(α/2, x + ½, n − x + ½), qbeta(1 − α/2, x + ½, n − x + ½); no special ends (DescTools
  sets 0 at x = 0 and 1 at x = n).

Zero cells: se or sp = 1 makes lr.pos = Inf with lower NaN (log(Inf) − Inf) or lr.neg = 0 with upper NaN; diag.or =
Inf with lower NaN; no warnings. A column with no observations gives NaN estimates. No zero-cell correction is
applied (some software adds ½ to every cell for the LRs and the DOR).

## Where the packages are wrong or inaccurate

| function | problem | fixture |
|---|---|---|
| coords "best" | ties lost by `==` on rounded criteria | `reference` (`ties`) |
| coords | counts as se·m (non-integer); 1 − sp cancels (fpr, lr_pos, closest.topleft off by up to 1e-11 relative at n = 1e4) | `reference` (`counts`, `cancellation`) |
| ci.auc bootstrap | a class of one value x ≥ 1 resampled from 1:x | `ciAucBoot` (R's values, no reference) |
| ci.auc bootstrap, non-stratified | a replicate without controls stops the call | `ciAucBoot` (error) |
| roc.test paired DeLong | m = 1 or n = 1 with d = 0: internal error | `rocTest` (error) |
| roc.test unpaired Venkatraman | mp = (cases₁ + cases₂)/(2N₁) | `rocTestBoot` (R's values) |
| epi.tests exact | limits as 1 − qbeta: up to 4e-9 relative error for small limits | `reference` (`cancellation`) |
| epi.tests agresti | adjusted estimates; LR limits depend on the method | — |
| auc / ci.auc | trapezoid AUC and θ differ by an ulp | tolerance |

## Permissively licensed sources

- DeLong, DeLong & Clarke-Pearson (1988), *Biometrics* 44:837–845: placements, the variance S (section 3) and the
  paired test (6.1).
- Sun & Xu (2014), *IEEE Signal Processing Letters* 21:1389–1393: placements from mid-ranks in O(N log N).
- Hanley & McNeil (1982), *Radiology* 143:29–36: AUC = Mann-Whitney U/(mn); the existing `wilcoxTest` statistic W
  gives it (W/(mn) for "<").
- Robin et al. (2011), *BMC Bioinformatics* 12:77 (open access, CC BY): pROC's methods in words (bootstrap,
  Venkatraman, partial AUC); the paper text, not the package code.
- McClish (1989), *Medical Decision Making* 9:190–195: the partial-AUC standardisation (section 7).
- Youden (1950), *Cancer* 3:32–35; Perkins & Schisterman (2006), *Am J Epidemiol* 163:670–675: Youden index and the
  closest-to-(0, 1) criterion; the weighted forms with r = (1 − prevalence)/(cost · prevalence) as in Zweig &
  Campbell (1993), *Clin Chem* 39:561–577.
- Venkatraman & Begg (1996), *Biometrika* 83:835–848; Venkatraman (2000), *Biometrics* 56:1134–1138: the
  permutation tests (6.3; pROC's sample-size slip is not in the paper).
- Simel, Samsa & Matchar (1991), *J Clin Epidemiol* 44:763–770: the log interval of likelihood ratios; Woolf (1955)
  for the log odds ratio.
- Clopper & Pearson (1934), Wilson (1927), Agresti & Coull (1998), Brown, Cai & DasGupta (2001, Jeffreys): the
  proportion intervals; statsmodels (BSD-3) `proportion_confint` implements "beta" (Clopper-Pearson), "wilson",
  "agresti_coull" and "jeffreys" with these formulas (its Agresti-Coull clips and returns the interval only).
- scikit-learn (BSD-3) `roc_curve` / `roc_auc_score`: sorting and cumulative counts for the curve. Its thresholds
  are the data values (with +Inf first) and `drop_intermediate=True` drops collinear points, so its arrays differ
  from pROC's; the AUC agrees.
- R's `sample()` and `quantile(type = 7)`: already in rStats.js (`src/random/sample.ts`,
  `src/descriptive/quantile.ts`).

## Decisions for the user

1. **The curve function and its result.** Proposal: `roc(response, predictor, { levels, direction, naRm })` and
   `roc(formula, data, options)` like the other tests, returning `{ thresholds, sensitivities, specificities, auc,
   direction, levels, controls, cases, warnings }` with pROC's arrays and order. The response may be numbers,
   booleans or strings (the first sorted level is the control, as R's factor; booleans: false is the control). The
   controls/cases form cannot be a plain overload (`roc(controls, cases)` looks like `roc(response, predictor)`):
   (a) an object as the first argument, `roc({ controls, cases }, { direction })` (recommended); (b) only
   response/predictor.
2. **AUC interval API.** (a) `ciAuc(roc, { confLevel, method })` returning `{ estimate, confInt: [l, u], confLevel,
   method, variance, warnings }` (recommended; the middle value of pROC's triple is the estimate, and `variance` is
   `var(roc)`); (b) pROC's triple. Also `auc(roc, { partialAuc, ... })` or only the `auc` field? Recommendation: the
   field plus `auc()` only if partial AUC is supported.
3. **`rocTest`.** (a) `rocTest(roc1, roc2, { paired, method, alternative, confLevel })` with pairing as pROC
   (identical responses) and `paired` overriding; (b) `rocTest(response, predictor1, predictor2, options)` for paired
   data and `rocTest(roc1, roc2, options)` unpaired only. Result: HTest with `estimate` [AUC₁, AUC₂], estimateNames
   "AUC of roc1"/"AUC of roc2", nullValue 0 "difference in AUC", paired: Z and confInt; unpaired: D and df.
   Recommendation (a) plus the (response, predictor1, predictor2) overload; pairing by identical response arrays and
   the rebuild without NA as pROC.
4. **`coords`.** `coords(roc, x, { bestMethod, bestWeights, ret })`, `x` = "best" | "all" | number[]; result an array
   of row objects (`[{ threshold, sensitivity, specificity, ppv, npv, accuracy, tp, fp, tn, fn, lrPos, lrNeg, youden,
   closestTopleft }]`) (a) or an object of columns as pROC's data frame (b). Recommendation (b) — column arrays, like
   the curve — with camelCase names (`lrPos`, `closestTopleft`), all columns always (no `ret`). "local maximas" and
   input by sensitivity/specificity: not now unless wanted.
5. **Ties of "best" and the counts.** Compute from integer counts and compare criteria exactly (rationals or an
   exact comparison of integer cross-products), returning all tied rows (`reference`), as a documented difference;
   or reproduce pROC's `==`. Recommendation: exact (design rule 2).
6. **Youden's value.** pROC reports se + r·sp. (a) Keep pROC's (recommended, comparability), documented; (b) the
   usual J = se + sp − 1.
7. **Partial AUC.** (a) Not now; (b) `auc(roc, { partialAuc: [lo, hi], focus, correct })` without intervals; (c) with
   bootstrap intervals. Recommendation (b) if partial AUC is wanted at all; limits outside [0, 1] an error (pROC: NA).
8. **Bootstrap.** (a) None; (b) `ciAuc` method "bootstrap" (stratified and not) reproducing R's stream; (c) also
   `rocTest` "bootstrap". Recommendation (b) and (c) (the user's web application likely offers a bootstrap CI);
   pROC's one-value-class bug: (i) reproduce it, (ii) resample the single value correctly (a documented difference;
   the draws then differ from R only in that case) — recommend (ii) and make a stratified bootstrap with fewer than 2
   in a class an error anyway; a non-stratified replicate without controls: drop it with the same warning as one
   without cases (pROC stops) — recommend that, documented.
9. **Venkatraman.** Not now (recommended), or paired only (the unpaired one has pROC's sample-size slip: reproduce or
   fix).
10. **Degenerate input** (design rule 1): one case or one control (pROC: ci NA, paired test R error or NaN), Inf in
    the predictor (pROC: NaN with a warning), `na.rm = false` with NA (pROC: NA), an empty class, unpaired DeLong with
    both perfect (NaN). Proposal: Error for the undefined ones (S needs m, n ≥ 2), Inf allowed? (the order is defined;
    pROC refuses — recommend an Error as pROC, simpler) ; S = 0 is fine (interval [θ, θ], paired Z = 0 when d = 0 as
    pROC; unpaired 0/0 → also Z = 0, p = 1, a documented difference?).
11. **Direction "auto".** Keep pROC's median rule (recommended; report the direction in the result), or choose the
    direction with AUC ≥ 0.5.
12. **Options not to support**: `percent`, `smooth`, `algorithm`, `ci.coords`/`ci.thresholds`/`ci.se`/`ci.sp`, the
    "sensitivity"/"specificity" tests, `power.roc.test`, multiclass ROC. Recommendation: none of these now; confirm.
13. **Warnings.** Reproduce pROC's perfect-curve warnings (`ci.auc() of a ROC curve with AUC == 1 ...`, `roc.test()
    of two ROC curves with AUC == 1 ...`), the three-levels warning, the direction warning of `rocTest`, the paired
    hint (rule 10). Recommendation: yes, verbatim.
14. **Diagnostic 2 × 2 measures.** (a) A function `diagnosticTests(table, { method, confLevel })` mirroring
    epi.tests (table in epiR's orientation: rows test +/−, columns disease +/−) returning `{ sensitivity,
    specificity, ppv, npv, accuracy, prevalence, apparentPrevalence, lrPos, lrNeg, diagnosticOR, youden, nnd, ... }`,
    each `{ estimate, confInt }`; (b) only se, sp, ppv, npv, LR+, LR− (and accuracy, DOR). Methods: "exact"/
    "clopper-pearson" (identical up to epiR's cancellation; one name), "wilson", "jeffreys", "agresti" (with epiR's
    adjusted estimates, or DescTools' agresti-coull via binomCI?). Recommendation (b) plus prevalence and DOR, default
    "exact" (epiR's default) computed with qbeta directly (the reference), the proportion intervals by `binomCI`
    where the formulas agree (wilson, clopper-pearson; jeffreys and agresti differ at the ends, see section 9), LR by
    the log method; no nndx/youden intervals (no stated coverage). Zero cells: (i) as epiR (Inf, NaN limits), (ii)
    add ½ to all cells for LR and DOR when a cell is 0 (common in medical software), (iii) Error. Recommendation (i),
    documented, with (ii) as an option `zeroCorrection` only if wanted.
15. **Predictive values at a given prevalence** (ppv/npv from se, sp and an external prevalence, Bayes): not in
    epi.tests; add as an option `prevalence` of the 2 × 2 function? Recommendation: yes if (14) is taken up (the
    interval then from the se and sp intervals is not standard; estimate only, or the logit method of Mercaldo,
    Lau & Zhou 2007).
16. **Tolerances.** AUC, θ, S, Z, D, df, p: 1e-13 relative against R; coords and epiTests against `reference` where
    present, R otherwise; bootstrap fixtures exactly (same draws) up to 1e-13.

## rStats.js's choices

Decided by the user on 2026-11-09. Binding; they override the recommendations above where they differ.

- Decisions 1–6 and 9–13 and 16: as recommended above. In short: `roc(response, predictor, options)`,
  `roc(formula, data, options)` and `roc({ controls, cases }, options)`; `ciAuc(roc, { confLevel, method })` with
  `{ estimate, confInt, confLevel, method, variance, warnings }`; `rocTest(roc1, roc2, options)` plus the
  `(response, predictor1, predictor2, options)` overload, pairing as pROC; `coords(roc, x, { bestMethod,
  bestWeights })` returning column arrays with camelCase names, all columns; ties of "best" compared exactly from
  integer counts (documented difference, tests against `reference`); Youden as pROC's se + r·sp; no Venkatraman;
  degenerate inputs (a class with fewer than 2, an empty class, Inf in the predictor) are Errors, S = 0 handled as
  recommended in 10; "auto" direction by pROC's median rule; no `percent`, `smooth`, `algorithm`, `ci.coords`/
  `ci.thresholds`/`ci.se`/`ci.sp`, sensitivity/specificity tests, `power.roc.test`, multiclass; pROC's warnings
  verbatim; tolerances 1e-13 relative.
- Decision 7: partial AUC without intervals: `auc(roc, { partialAuc: [lo, hi], focus, correct })`; limits outside
  [0, 1] an Error.
- Decision 8: bootstrap in `ciAuc` (stratified and not) and in `rocTest`, reproducing R's random stream; DeLong stays
  the default. pROC's one-value-class bug fixed (resample the single value; documented); a stratified bootstrap with
  fewer than 2 in a class is an Error; a non-stratified replicate without controls is dropped with the same warning
  as one without cases (documented).
- Decisions 14–15: a 2 × 2 function (name `diagnosticTests`, epiR's orientation) with sensitivity, specificity, PPV,
  NPV, LR+, LR−, accuracy, diagnostic odds ratio, true and apparent prevalence, each with an interval; default method
  "exact" computed with qbeta directly (the `reference`), "wilson" and "jeffreys" via binomCI where the formulas
  agree, LR by the log method; zero cells as epiR (Inf/NaN limits, documented); an option `prevalence` giving
  PPV/NPV at an external prevalence (estimate only). No Youden/NND intervals.
