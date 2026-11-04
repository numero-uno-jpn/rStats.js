# Issue #487 log: lbfgsb's checks of negative dimensions come after its allocations

GitHub Issue #487. Session 14, judging of the issues classified C. Verdict: not planned (the function is internal and its only caller never passes a negative dimension). No code changed.

## Plan

- Intent: check whether the issue's negative `n` and `m` can reach `lbfgsb` through the public API, on the current main and in R 4.5.2.
- Why: classified C (`lbfgsb` is not exported; `optim` gives it `n = par.length` and `lmm` rounded to `max(trunc(lmm), 0)`, #362).

## Check (main `10323ab`, R 4.5.2)

- `lbfgsb` is exported neither from `src/index.ts` nor from `src/entries/`; its only caller is `optim` (`src/optim/optim.ts`). There, `n = par.length >= 0`, `n = 0` returns "NOTHING TO DO" before the call, and `lmm` is `max(trunc(lmm), 0)` (NA, beyond the integer range, is 0). So `lbfgsb` never sees `n <= 0` or `m < 0`; `m = 0` allocates arrays of length 1 and returns "ERROR: M .LE. 0".
- `optim([], fn, {method: "L-BFGS-B"})`: par [], convergence 0, "NOTHING TO DO". R: `optim(numeric(0), fn, method = "L-BFGS-B")` the same.
- `optim([1, 2], fn, {method: "L-BFGS-B", control: {lmm: -5}})` and `lmm: -1e9`, `lmm: 0`: par [1, 2], value 0, convergence 52, "ERROR: M .LE. 0". R (`lmm = -5`, `lmm = 0`): the same.

## Fix

- None. The order of the allocations matters only for a direct call of the internal function with invalid arguments.

## Tests

- `test/issue487.test.ts`: `lbfgsb` is not exported; empty `par` and `lmm` −5 and −1e9 give R's messages.

## Out of scope

- None.

## close comment

Not planned: `lbfgsb` is an internal function (not exported), and its only caller, `optim(method = "L-BFGS-B")`, passes `n = par.length` (an empty `par` returns "NOTHING TO DO" before the call) and `lmm` rounded to `max(trunc(lmm), 0)` (#362), so a negative dimension never reaches the allocations. Through the public API, `optim([], fn, {method: "L-BFGS-B"})` gives "NOTHING TO DO" and `lmm` −5 or −1e9 gives convergence 52 with "ERROR: M .LE. 0", as R 4.5.2. Added test/issue487.test.ts. (Not pushed yet.)
