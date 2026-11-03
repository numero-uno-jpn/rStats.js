# Issue #457 log: aov with an Error() term in parentheses

GitHub Issue #457. Session 13, group A4 (model formulas and lm).

## Plan

- Intent: `splitErrorTerms` found an `Error()` term only as a summand, not inside parentheses, so `y ~ treatment + (Error(subject))` was the error "Error() must be a term of the right-hand side".
- Method: strip `Error()` terms inside parentheses too, as `splitBarTerms` does for random-effects terms; R's `terms()` drops the parentheses before `aov` looks for the `Error` special.

## Check (main `0b59a35`, R 4.5.2; `y = 1 2 3 5 4 7`, treatment A A A B B B, subject s1 s2 s3 s1 s2 s3)

| formula | before | after | R `summary(aov(...))` |
|---|---|---|---|
| `y ~ treatment + (Error(subject))` | error | same as without parentheses: subject Residuals Df 2 SS 5.333; Within treatment F 25, p 0.0377 | same as without parentheses |
| `y ~ treatment + ((Error(subject)))` | error | same | same |
| `y ~ (treatment + Error(subject))` | error | same | same |
| `y ~ (Error(subject)) + treatment - 1` | error | subject stratum treatment SS 80.67, F 30.25, p 0.0315; Within F 25 | same |

## Fix

- `src/models/formula.ts`, `splitErrorTerms`: a parenthesised node is searched for `Error()` terms and kept (with what remains) if anything remains.

## Tests

- `test/issue457.test.ts`: the forms above against the form without parentheses, and F 25 and 30.25. With `src/` stashed, both tests fail.
- `test/aovStrata.test.ts`, `test/aovEz.test.ts`, `test/formulaTests.test.ts`, `test/errors.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #457, see git log --grep='#457'>. aov now finds an `Error()` term inside parentheses, as R's `terms()`: `y ~ treatment + (Error(subject))`, `((Error(subject)))` and `y ~ (treatment + Error(subject))` give the same strata as `y ~ treatment + Error(subject)` (R 4.5.2: the same tables) instead of "Error() must be a term of the right-hand side". A test has been added. (Not pushed yet.)
