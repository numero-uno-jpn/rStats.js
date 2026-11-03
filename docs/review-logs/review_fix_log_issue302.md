# Issue #302 log: lm with a positive infinite weight

GitHub Issue #302 (duplicate: #348). Session 12, group 7 (non-finite model inputs).

## Plan

- Intent: `lm` rejects negative weights and drops NaN weights, but a weight of Infinity passed. With columns the QR stopped on the weighted matrix ("the matrix contains NaN or infinite values"); with no columns nothing stopped it and the fit had residuals [NaN, 2, 3] and sigma NaN.
- Method: in `fitLmUnit` (shared by the matrix and formula interfaces), throw "non-finite weights not allowed" when a weight of the rows in the fit is not finite, after the checks of x and y. The message is glm's for the same input.
- Why an error and not R's value: R's `lm.wfit` returns the residuals y and sigma Inf for a model with no columns, and stops with "NA/NaN/Inf in 'x'" when there are columns. An infinite weight has no meaning as a weighted least-squares fit; the policy "meaningless input is an error" applies (triage: A). Recorded in the docs as a deliberate difference.

## Check (main `81ca8b1`)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `lm([[], [], []], [1, 2, 3], { intercept: false, weights: [Inf, 1, 1] })` | `lm.wfit`: residuals 1 2 3; `lm(y ~ 0)`: sigma Inf | residuals [NaN, 2, 3], sigma NaN | error "non-finite weights not allowed" |
| `lm("y ~ 0", { y: [1, 2, 3] }, { weights: [Inf, 1, 1] })` | the same | residuals [1, 2, 3] | the same error |
| `lm([1, 2, 4], [1, 2, 3], { weights: [Inf, 1, 1] })` | "NA/NaN/Inf in 'x'" | "the matrix contains NaN or infinite values" | the same error |

## Fix

- `src/models/lm.ts`, `fitLmUnit`: the finite check of the weights.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: Linear models, the infinite weight.

## Tests

- `test/issue302.test.ts`: both interfaces with and without columns, and a NaN weight still dropping its row. With `src/` stashed, the first two tests fail.
- `test/lm.test.ts`, `anovaLm`, `issue193`, `issue194`, `issue199`: pass. `npx tsc --noEmit -p .`: no errors.

## Duplicate #348

#348 reports the same call (matrix path, zero columns); fixed by this change.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #302, see git log --grep='#302'>: `lm` now throws "non-finite weights not allowed" (as `glm`) when a weight is Infinity, in the matrix and formula interfaces. With no columns (`lm([[], [], []], [1, 2, 3], { intercept: false, weights: [Infinity, 1, 1] })`) the fit had residuals [NaN, 2, 3] and sigma NaN; with columns the QR stopped with "the matrix contains NaN or infinite values". R stops with "NA/NaN/Inf in 'x'" when there are columns and returns the residuals y with sigma Inf when there are none; the error in both cases is recorded in docs/differences-from-r.md. NaN weights still drop their rows and finite weights are unchanged. #348 is the same report.

Test: test/issue302.test.ts. (Not pushed yet.)
