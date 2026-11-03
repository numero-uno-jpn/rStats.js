# Issue #270 log: bartlettTest loses a group's variance to underflow on the common scale

GitHub Issue #270. Session 11, group A6 of the second triage (overflow in tests and descriptive statistics).

## Plan

- Intent: `bartlettTest` takes the variances from `groupMoments`, which divides all groups by one power of 2 (the largest absolute value to [1, 2)). A group whose spread is tiny against the largest value of another group then has a variance below 2^-1022 on that scale, subnormal or 0, and log 0 makes the statistic Infinity (p 0), although the statistic depends only on the logs of the variances and is finite (`[[1e200, 1.000000000000001e200], [0, 1e-100]]`: 874.08).
- Method: the old computation stays as it is. Only where some variance on the common scale is below 2^-1022, each group's variance is computed on its own scale with `groupMoments([g])` (w_i at 2^-e_i), log v_i = log w_i + 2 (e_i - E) log 2 relative to the largest exponent E (the E terms cancel exactly in N log(pooled) - sum n_i log v_i, as sum n_i = N), and log(pooled) by log-sum-exp of log n_i + log v_i, minus log N.
- Why this: it changes nothing where the common scale works (every variance normal), and keeps the logs relative to the largest scale so that equal variances still cancel to rounding of the logs. A truly constant group still has w_i = 0 and gives Infinity (and all constant groups NaN), as before and as R.
- R gives NaN for all these cases (its variances overflow or underflow), so they are recorded in docs.

## Check (main `e3f6efa`, R 4.5.2, Rmpfr from the double data)

| Call | R | Before | After |
|---|---|---|---|
| `bartlettTest([[1e200, 1.000000000000001e200], [0, 1e-100]])` (the issue) | NaN | Infinity, p 0 | 874.0842614543457 (Rmpfr 874.08426145434560992), p 4.2235946759947455e-192 |
| `bartlettTest([[1e200, 2e200, 4e200], [1, 2, 4]])` | NaN | Infinity | 1471.4363885383973 (Rmpfr 1471.4363885383974127), p 6.3e-322 |
| `bartlettTest([[1e300, 2e300], [1e100, 1e100 + 1e85]])` | NaN | Infinity | 659.1889763312466 (Rmpfr 659.18897633124663058), p 2.2423906094229277e-145 |
| `bartlettTest([[1e200, 2e200, 4e200], [1e-200, 2e-200, 4e-200]])` | NaN | Infinity | 2945.0908480545863 (Rmpfr 2945.0908480545866505) |
| `bartlettTest([[1e200, 2e200, 4e200], [1, 1 + 2^-40, 1 + 2^-39]])` | not run | Infinity | 1561.5149042266899 (Rmpfr 1561.5149042266899381) |
| `bartlettTest([[1, 2, 3, 5], [2, 4, 4, 9], [1, 1, 2, 3]])` | 3.055541389783424, p 0.21701892985496132 | 3.055541389783424, p 0.21701892985496135 | unchanged |
| `bartlettTest([[1, 2, 3], [5, 5, 5]])`; `[[5, 5], [5, 5]]` | Inf, p 0; NaN | the same | unchanged |

## Fix

- `src/htest/varTest.ts`: the fallback in `bartlettTest` as above (a module constant `MIN_NORMAL = 2^-1022`).
- docs/differences-from-r.md and docs/ja/differences-from-r.md: a row in "Where R fails and rStats.js returns a value" (the existing row on data around 1e-200 or 1e155 covers one common scale only).

## Tests

- `test/issue270.test.ts`: the five cases above match Rmpfr (relative 1e-15, p-values 1e-12); the ordinary and constant-group cases keep the values from before the fix. With `src/` stashed the first test fails.
- `npx vitest run`: 355 files passed (2812 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- Other tests that take several group variances from one common scale (`onewayTest` with unequal variances, `flignerTest`, Games-Howell) may lose a tiny group's variance the same way; not checked here.

## close comment

Fixed in <commit of #270, see git log --grep='#270'>: where a group's variance falls below the normal range on the common power-of-2 scale of all groups, `bartlettTest` now computes each variance on its own group's scale and forms the logs of the variances and of the pooled variance (by log-sum-exp) relative to the largest scale, so the statistic stays finite. `bartlettTest([[1e200, 1.000000000000001e200], [0, 1e-100]])` now gives 874.0842614543457 (Rmpfr 874.084261454345610) with p 4.22e-192 instead of Infinity and 0, and `[[1e200, 2e200, 4e200], [1e-200, 2e-200, 4e-200]]` gives 2945.0908480545863 instead of Infinity. R gives NaN for these, so this is recorded in docs/differences-from-r.md. Groups whose variances are all normal on the common scale are unchanged to the bit; a constant group still gives Infinity as in R. (Not pushed yet.)
