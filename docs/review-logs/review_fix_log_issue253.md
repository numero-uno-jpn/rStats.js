# Issue #253 log: survfit's log-log interval at survival 1

GitHub Issue #253. Session 11, judging of the issues classified C. Verdict: not planned (the same as R's survival package, which the issue misreads). No code changed; a test added.

## Plan

- Intent: check what R's survfit returns for the log-log interval where the survival is 1 and the Greenwood standard error 0.
- Method: the issue's example `survfit([1, 2], [0, 0], { confType: "log-log" })` and the other interval types, in rStats.js and in survival 3.8.3 under R 4.5.2 (`survfit(Surv(c(1, 2), c(0, 0)) ~ 1, conf.type = ...)`).
- Why: the issue cites survival's source without running it.

## Check (main `4a95ab0`, R 4.5.2, survival 3.8.3)

| conf.type | survival 3.8.3: lower, upper | rStats.js: lower, upper |
|---|---|---|
| log-log (the issue) | NA NA, NA NA | NaN NaN, NaN NaN |
| log | 1 1, 1 1 | 1 1, 1 1 |
| plain | 1 1, 1 1 | 1 1, 1 1 |
| logit, arcsin | NaN | not offered (RangeError "invalid 'confType'") |

With an event later, `Surv(c(1, 2, 3), c(0, 1, 0))`, log-log: survival gives lower NA, 0.005983088, 0.005983088 and upper NA, 0.9104101, 0.9104101; rStats.js NaN, 0.005983087639145737, 0.005983087639145737 and NaN, 0.9104100848367374, 0.9104100848367374.

The installed survival returns NA for the log-log interval at survival 1, also with a standard error of 0; rStats.js returns NaN, its missing value. The issue's statement that `survfit_confint()` returns the estimate when se = 0 does not hold for survival 3.8.3. The log-log transform log(-log S) is undefined at S = 1, so a missing value is a defensible result; the log and plain intervals, which are defined there, give 1 in both.

## Fix

- None (not planned): R's survival package.

## Tests

- `test/issue253.test.ts`: log-log at survival 1 is NaN; log and plain are 1; the log-log interval after an event matches survival.

## Out of scope

- If a later survival release returns the estimate where se = 0 for log-log, rStats.js could follow it then (record only; the policy is to follow the installed R and to record future changes only).

## close comment

Not planned: this is what R's survival package does. survival 3.8.3 under R 4.5.2, survfit(Surv(c(1, 2), c(0, 0)) ~ 1, conf.type = "log-log"), gives lower and upper NA NA where the survival is 1 and the standard error 0; rStats.js gives NaN, its missing value. The log and plain intervals give 1 there, in both. log(-log S) is undefined at S = 1, so the interval is missing until the first event; after an event (Surv(c(1, 2, 3), c(0, 1, 0))) both give 0.005983088 and 0.9104101. A test was added: test/issue253.test.ts. (Not pushed yet.)
