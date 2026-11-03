# Issue #254 log: survfit's median confidence limit takes a midpoint with a NaN point

GitHub Issue #254. Session 11, group B6 of the second preparation (user decision: the same rule as survival's `minmin`).

## Plan

- Intent: `curveMedian` (the median of the survival curve and of its lower and upper limits) treats a curve within sqrt(eps) of 0.5 as an exact 0.5 plateau and returns the midpoint between that time and the next event time. In the issue the lower plain limit is 0.50000001 at times 1 and 2 and NaN at time 3, and the midpoint (1 + 3) / 2 = 2 is returned: no convention gives 2.
- Method (the user's choice among: survival's minmin, no tolerance at all, unchanged): follow survival 3.8.3's `survmean` / `minmin` exactly. Keep the points that are not NaN and lie below 0.5 + sqrt(eps); take the first of them; if it is within sqrt(eps) of 0.5 and a later kept point is lower, return the midpoint with the time of the first lower point, otherwise its own time; NaN if no point is kept.
- Why this: `survfit` documents its medians and limits as those of `summary(fit)$table`, which uses `minmin`; the change is local to `curveMedian`. The sqrt(eps) tolerance stays (it is survival's convention; removing it would be a separate decision). The midpoint now goes toward the first lower point instead of the next event: the same on the survival curve itself (it drops at every event before 0), and as R on the limits, which can stay level or rise at an event or become NaN.
- R gives the new values, so there is no docs entry.

## Check (main `8291e73`)

| call | R 4.5.2, survival 3.8.3 (`summary(fit)$table`) | Before | After |
|---|---|---|---|
| `survfit([1, 2, 3], [1, 0, 1], { confType: "plain", confInt: 0.45970860108863704 })` (the issue; lower `0x1.00000055e63b9p-1` at 1 and 2, NaN at 3; Rmpfr 0.50000001000000008902 at 1) | median 3, LCL 1, UCL NA | [3, 2, NaN] | [3, 1, NaN] |
| `survfit([1, 2, 3, 4], [1, 1, 1, 1], { confType: "plain", confInt: 2 pnorm(2 / sqrt(3)) - 1 })` (lower 0.5, 0.211, 0, NaN; upper 1, 0.789, 0.5, NaN) | 2.5, 1.5, 3 | [2.5, 1.5, 3.5] | [2.5, 1.5, 3] |
| `survfit([1, 2, 3, 4], [1, 1, 1, 1])` | 2.5, 1, NA | [2.5, 1, NaN] | the same |
| `survfit([1, 2, 3, 4, 5, 6], [1, 0, 1, 1, 0, 1])` | 4, 3, NA | [4, 3, NaN] | the same |

`quantile(fit, 0.5)` in R gives NA for the issue's lower limit (it has no tolerance); `survfit` follows the table, as documented.

## Fix

- `src/models/survival.ts`: `curveMedian(time, curve)` rewritten as `minmin` (the `nEvent` argument is no longer needed).

## Tests

- `test/issue254.test.ts`: the issue's call and the plain-interval case where the upper limit is 0.5 before a NaN (R's table values), and two default fits whose medians do not change. With `src/` stashed both tests fail.
- `npx vitest run`: 334 files passed (2751 tests passed, 38 skipped; the survfit fixtures unchanged). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None found.

## close comment

Fixed in <commit of #254, see git log --grep='#254'>: the median of `survfit` and its confidence limits now follow survival's `survmean` (`minmin`), which `summary(fit)$table` uses: points that are NaN are dropped, and a curve within sqrt(eps) of 0.5 gives the midpoint only when a later point is lower (with the time of the first lower point), otherwise its own time. The issue's call now gives the limits [1, NaN] for the median 3, as R's table (it gave the midpoint 2 with the NaN point at time 3). A plain interval whose upper limit is 0.5 just before a NaN now gives 3 instead of 3.5, also as R. The sqrt(eps) tolerance is survival's convention and is kept; the survfit fixtures are unchanged.

Test: test/issue254.test.ts. (Not pushed yet.)
