# Issue #298 log: lmer with an infinite variable only in a random-effects term

GitHub Issue #298. Session 12, group 7 (non-finite model inputs).

## Plan

- Intent: a numeric variable on the left of a random-effects term only (`(x | g)`) is not in the fixed-effects matrix, so the QR's finite check never sees it; `mixedModelStructure` put an infinite value into Z, and the fit failed inside the factorisation ("the penalised least-squares matrix is not positive definite", or a TypeError for `(0 + x | g)`).
- Method: in `mixedModelStructure`, after the existing checks of the terms (no columns, levels, numbers of effects) and before Z is built, throw `NA/NaN/Inf in the random-effects term (<label>)` when a column of a term is not finite. The model frame already drops NaN rows, so this is for ±Infinity.
- Why: R (lme4) stops too ("objective in x0 returns NA"), so an error is R's behaviour; the message names the term instead of the optimiser. Finite columns do not reach the throw (the same bits).
- The issue's example (6 rows) stops earlier, in R as here, with "number of observations (=6) <= number of random effects (=6) for term (x | g) ..."; the triage reproduced the bug with 12 rows (3 groups of 4).

## Check (main `5b984b1`)

y = (1, 3, 2, 5, 4, 7, 6, 9, 8, 11, 10, 12), x = (1, 2, Inf, 4, ..., 12), g = 3 groups of 4.

| call | R 4.5.2 (lme4) | before | after |
|---|---|---|---|
| `lmer("y ~ 1 + (x \| g)", ...)` | "objective in x0 returns NA" | "the penalised least-squares matrix is not positive definite" | "NA/NaN/Inf in the random-effects term (x \| g)" |
| `lmer("y ~ 1 + (0 + x \| g)", ...)` | "objective in x0 returns NA" | TypeError "Cannot read properties of undefined (reading '0')" | "NA/NaN/Inf in the random-effects term (0 + x \| g)" |
| the issue's 6 rows | "number of observations (=6) <= number of random effects (=6) ..." | the same | unchanged |

## Fix

- `src/models/mixedStructure.ts`, `mixedModelStructure`: the finite check of the random-effects columns.

## Tests

- `test/issue298.test.ts`: both terms above, and the issue's 6 rows keeping the earlier error. With `src/` stashed, the first two tests fail.
- `test/lmer.test.ts`, `lmerSparse`, `lmerTerms`, `lmerCompare`, `lmerDeviance`, `lmerHypotheses`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #298, see git log --grep='#298'>: `lmer` now throws "NA/NaN/Inf in the random-effects term (x | g)" when a column of a random-effects term is not finite. A variable used only there is not in the fixed-effects matrix, so its Infinity reached the factorisation: with 12 rows (3 groups of 4) and x = (1, 2, Infinity, 4, ..., 12), `lmer("y ~ 1 + (x | g)", ...)` failed with "the penalised least-squares matrix is not positive definite", and `(0 + x | g)` with a TypeError (lme4: "objective in x0 returns NA"). The issue's 6-row example stops earlier with "number of observations (=6) <= number of random effects (=6) ...", in R as well. Finite data are unchanged.

Test: test/issue298.test.ts. (Not pushed yet.)
