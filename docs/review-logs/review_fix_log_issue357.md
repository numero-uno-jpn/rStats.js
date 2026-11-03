# Issue #357 log: jacobian, hessian and simple grad with NaN callback values

GitHub Issue #357. Session 12, judging of the issues classified C. Verdict: not planned (the same as numDeriv). No code changed.

## Plan

- Intent: run the issue's calls on the current main through the public API and the same calls with numDeriv in R 4.5.2.
- Why: classified C (NaN propagated as in numDeriv); the verdict needs both checked.

## Check (main `7033ff3`, R 4.5.2, numDeriv)

| call | rStats.js | numDeriv |
|---|---|---|
| `jacobian(() => [NaN], [0])` | [[NaN]] | NaN |
| `hessian(() => NaN, [0])` | [[NaN]] | NaN |
| `grad(() => NaN, [0], { method: "simple" })` | [NaN] | NaN |
| `grad(() => NaN, [0])` (Richardson) | RangeError "func returned NaN at step 0.0001 from x" | error "function returns NA at 1e-04 distance from x." |

- The functions follow numDeriv in each case: a NaN from the callback becomes NaN in the result, not a plausible wrong value, and Richardson grad errors as numDeriv's does.

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: these follow numDeriv. jacobian(() => [NaN], [0]), hessian(() => NaN, [0]) and grad(() => NaN, [0], { method: "simple" }) return NaN, as numDeriv's jacobian, hessian and grad do, and the Richardson grad throws, as numDeriv's grad stops ("function returns NA"). A NaN from the callback is passed through as NaN, never as a finite derivative. (Not pushed yet.)
