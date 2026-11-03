# Issue #453 log: modelMatrix with a response that is not numeric

GitHub Issue #453. Session 13, group A4 (model formulas and lm).

## Plan

- Intent: `modelMatrix` used the shared `design`, which required a numeric response, so `modelMatrix("group ~ x", ...)` with a string or boolean `group` was the error "the response must be numeric". R's `model.matrix` builds the matrix from the right-hand side only; the response just drops its rows with NA.
- Method: a `design` option `anyResponse`, set by `modelMatrix` only: a response of any type is accepted (no `y` unless numeric). The fitting functions (lm, aov, lmer, ...) do not set it and keep the error at the same place.

## Check (main `3e72f16`, R 4.5.2)

| call | before | after | R `model.matrix` |
|---|---|---|---|
| `modelMatrix("group ~ x", { group: ["control", "case"], x: [1, 2] })` | "the response must be numeric" | `(Intercept)`, `x`: [1, 1], [1, 2] | the same |
| same, `group: [true, false]` | same error | the same matrix | the same |
| `modelMatrix("group ~ A", { group: ["u", null, "v", "u"], A: ["a", "b", "b", "a"] })` | same error | rows 1, 3, 4 (0-based 0, 2, 3); `Ab` 0 1 0 | rows 1 3 4, `Ab` 0 1 0 |
| `lm("group ~ x", { group: ["control", "case", "x"], x: [1, 2, 4] })` | "the response must be numeric" | unchanged | error ("NA/NaN/Inf in 'y'") |

## Fix

- `src/models/modelMatrix.ts`: `DesignOptions.anyResponse`; `design` keeps `y` for a numeric response and throws for another type unless `anyResponse`; `modelMatrix` sets it. The doc comment says the response may be of any type.

## Tests

- `test/issue453.test.ts`: string and boolean responses, a missing response with a factor predictor, and the error kept in lm. With `src/` stashed, the first two fail.
- `test/modelMatrix.test.ts`, `test/lm.test.ts`, `test/glm.test.ts`, `test/issue452.test.ts`, `test/issue454.test.ts`, `test/errors.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #453, see git log --grep='#453'>. modelMatrix now accepts a response of any type, as R's `model.matrix`: `modelMatrix("group ~ x", { group: ["control", "case"], x: [1, 2] })` (or a boolean `group`) gives the columns `(Intercept)`, `x` instead of "the response must be numeric", and a missing response still drops its row (R 4.5.2: the same matrices). lm, aov and the other fitting functions keep the check. A test has been added. (Not pushed yet.)
