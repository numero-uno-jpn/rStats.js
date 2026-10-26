# Survival analysis: the behaviour to reproduce

What survival 3.8-3 computes for `survdiff` and `survfit` (Kaplan-Meier), in words, for an implementation that must
not read its source. Fixture `survival` (`oracle/survival.R`; format in its header). Where this file and the fixture
seem to disagree, report it.

## Easy to get wrong

1. The log-rank weights for `rho ≠ 0` are the pooled Kaplan-Meier estimate **just before** each event time, to the
   power `rho`; the variance uses the **squared** weights.
2. At a time with ties, all events at that time count together, censorings at that time are still at risk (events
   first, then censorings).
3. The chi-squared statistic uses the first k − 1 groups (dropping the first) of the groups with a positive expected
   count, solved with the variance matrix (not a generalized inverse of the full matrix).
4. `std.err` in the summary is the standard error of the survival itself (S × the standard error of log S); the
   confidence intervals are built from the standard error of log S.
5. The median is the first time at which S drops below 0.5, except that **if S equals 0.5 (within sqrt(eps)) on a
   flat stretch, the median is the midpoint of that stretch** (the time it reached 0.5 and the next event time).

## API

- `survdiff(time, status, group, { rho })` (rho default 0) → `{ n, groups, obs, exp, var, chisq, pvalue }`: groups
  are the sorted labels (R's strata names `"group=a"` — return R's names), `n` their sizes, `obs` and `exp` per group,
  `var` the k × k matrix, `chisq`, `pvalue` = upper chi-squared tail on (number of groups with positive expected) − 1
  df.
- `survfit(time, status, { group, confType, confInt })` (confType `"log"` default, `"plain"`, `"log-log"`; confInt
  0.95) → the rows of `summary(fit, censored = TRUE)` (`strata`, `time`, `nRisk`, `nEvent`, `nCensor`, `surv`,
  `stdErr`, `lower`, `upper`) and the medians (`median`: one `[median, LCL, UCL]` per stratum, `medianRows` their
  names; `"all"` for a single curve's strata entries, as the fixture).

status: 1 event, 0 censored. Rows with a missing value dropped.

## Log-rank (survdiff)

For each distinct time t with at least one event (pooled over groups), with `n` at risk (time ≥ t), `d` events at
t, `n_g`, `d_g` per group, and weight `w = S(t−)^rho` (pooled Kaplan-Meier just before t; w = 1 for rho = 0):
`obs_g += w d_g`, `exp_g += w d n_g/n`, and if n > 1, `V_gh += w² d (n − d)/(n (n − 1)) × n_g (δ_gh − n_h/n)`.
`chisq = u' V_r^-1 u` with `u = (obs − exp)` restricted to the groups with exp > 0, dropping the first, and `V_r` the
matching submatrix; 0 if fewer than two groups have exp > 0.

## Kaplan-Meier (survfit)

Per stratum, at each distinct time (events and censorings): `n.risk` = number with time ≥ t, `n.event`,
`n.censor`; `S(t) = Π (1 − d/n)` over event times ≤ t; the standard error of log S, `σ(t) = sqrt(Σ d/(n (n − d)))`
(Greenwood; Inf once d = n); `std.err = S σ` (NaN where S = 0 and σ = Inf, as R). With `z = qnorm(1 − (1 −
confInt)/2)`:

- log: `S exp(∓ z σ)`, upper capped at 1; lower NaN where S = 0.
- plain: `S ∓ z σ S`, clipped to [0, 1].
- log-log: `exp(−exp(log(−log S) ∓ z σ / log S))` (NaN where S is 0 or 1).

Median and its limits: the rule of item 5 applied to S (median), to the lower curve (LCL) and to the upper curve
(UCL), each over the rows of the stratum; NA if the curve never goes below 0.5 + sqrt(eps).

## Accuracy

Within a relative 1e-12 of R value by value; NaN matches NaN. Known differences only within 1e-12 of an exact
reference (none in the fixture). No loosening.
