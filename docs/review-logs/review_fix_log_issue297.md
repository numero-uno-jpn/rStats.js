# Issue #297 log: lmer with an infinite response

GitHub Issue #297. Session 12, group 7 (non-finite model inputs).

## Plan

- Intent: `lmerWithCriterion` did not check the response for finite values. With no fixed columns, yc = y and the exact-fit test `ycMax <= EXACT_FIT * maxAbs(y)` was Infinity <= Infinity, so an infinite response gave the exact-fit error ("the response is fitted exactly by the fixed effects"). With an intercept the QR of the fixed part failed with a TypeError ("Cannot read properties of undefined (reading '0')").
- Method: right after the model structure, throw "NA/NaN/Inf in 'y'" (R's message) when a response value is not finite.
- Why: R (lme4) stops with the same message; finite responses do not reach the throw (the same bits).

## Check (main `c2085e4`)

| call | R 4.5.2 (lme4) | before | after |
|---|---|---|---|
| `lmer("y ~ 0 + (1 \| g)", ...)`, y = (Inf, 1, ..., 7), g = 4 groups of 2 (the issue's data) | "NA/NaN/Inf in 'y'" | exact-fit error | "NA/NaN/Inf in 'y'" |
| `lmer("y ~ 1 + (1 \| g)", ...)`, the same data | "NA/NaN/Inf in 'y'" | TypeError "Cannot read properties of undefined (reading '0')" | "NA/NaN/Inf in 'y'" |
| `lmer("y ~ x + (1 \| g)", ...)` with an infinite x | "NA/NaN/Inf in foreign function call (arg 1)" | "the matrix contains NaN or infinite values" | unchanged |

## Fix

- `src/models/lmer.ts`, `lmerWithCriterion`: the finite check of the response.

## Tests

- `test/issue297.test.ts`: the issue's call, and an intercept with Infinity and -Infinity. With `src/` stashed, both tests fail.
- `test/lmer.test.ts`, `lmerSparse`, `lmerTerms`, `lmerCompare`, `lmerDeviance`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- None. (An infinite variable on the left of a random-effects term is #298.)

## close comment

Fixed in <commit of #297, see git log --grep='#297'>: `lmer` now throws "NA/NaN/Inf in 'y'" for a non-finite response, as lme4 does. The issue's call (`lmer("y ~ 0 + (1 | g)", ...)` with an Infinity in y) gave the exact-fit error because Infinity <= Infinity passed the test, and with an intercept the fit failed with a TypeError inside the QR. Finite responses are unchanged.

Test: test/issue297.test.ts. (Not pushed yet.)
