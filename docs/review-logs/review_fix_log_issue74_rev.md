# Revision of issue 74: uniroot with tol = 0

## Plan
- Intent: `uniroot` accepted `tol = 0` (`tol >= 0`), against criterion K1 (a meaningless tolerance is an error) and R
  ("invalid 'tol' value"). Also review 1 No.5.
- Decision: audit item A (session 14), no user decision needed (R and K1 agree).
- Form: the check `tol > 0` at the public entry only. The body moves to `unirootCore` (no check of tol > 0), which the
  internal callers use: the noncentrality roots of `src/htest/effectSize.ts` run with `tol: 0` (Brent's method to the
  precision of the doubles), and `src/internal/uniroot.ts` passes tolerances scaled by a standard error
  (`glmConfint`: 1e-14 se, 0 when se underflows). Their results do not change.

## Original decision
- Issue 74 (`review_fix_log_issue74.md`) made `optimize` reject `tol = 0` and recorded `uniroot` only ("maxiter always
  stops it").

## Gap with the current criteria
- K1: a non-positive tolerance is an error; R rejects it too.

## Reproduction (main 32299e9, R 4.5.2)
| call | R | rStats.js before | now |
|---|---|---|---|
| `uniroot(x^2 - 2, c(0, 2), tol = 0)` | "invalid 'tol' value" | 1.414213562373095 | RangeError "'tol' must be a positive finite number" |
| `tol = -1` | "invalid 'tol' value" | RangeError (non-negative) | RangeError (positive) |
| `tol = 5e-324` | 1.414214 | 1.414213562373095 | unchanged |

## Fix
- `src/numerics/integrate.ts`: `uniroot` checks `tol > 0` and calls `unirootCore` (the former body, which keeps its
  `tol >= 0` check).
- `src/htest/effectSize.ts`, `src/internal/uniroot.ts`: call `unirootCore`.
- No docs change (R gives the same error; the docs list of non-finite tolerances already names `uniroot`).

## Tests
- `test/issue74_rev.test.ts`: tol 0, -0, -1 throw; tol 5e-324 returns the root; a Cohen's d interval (tol 0 internally)
  is finite. The first test fails with src stashed.
- Related files (issue74, numerics, review26, fisher, glmConfint, powerStats, pwr, wilcox, effect-size tests) pass.

## Out of scope (recorded)
- None.
