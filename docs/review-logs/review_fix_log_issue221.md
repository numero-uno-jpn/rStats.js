# Issue #221 log: approx with an invalid method or rule

GitHub Issue #221. Session 11, group A1 (input checks) for the `method` part, fixed first (f293c04). The `rule` part was decided by the user later (group B5, with #227 and #229) and is fixed in a second commit; see "The rule part" below.

## Plan

- Intent: `approx` compared `method` with `"linear"` only, so any other string (a typo such as `"linera"`, or `"lin"`) silently gave the step function.
- Method: resolve the method first, as R's `pmatch(method, c("linear", "constant"))`: the full name or a unique non-empty prefix; anything else (including a non-string) is R's error "invalid interpolation method". The check comes before the count of points, as in R.
- Why prefixes: R accepts them (`"lin"`, `"l"`, `"c"`, `"const"`), and the project's other method arguments (`cor`, `cov`, `p.adjust`, the alternatives) match unique prefixes the same way. Rejecting them would make R code that works fail; taking them as constant (the old behaviour) gave wrong values.
- Expected effect: `"linear"`, `"constant"` and the default keep their bits.

## Check (main `c2a515a` with #203 and #219; R 4.5.2)

At `approx(c(0, 1), c(0, 1), xout = 0.5, method = m)`:

| method | R 4.5.2 | Before | After |
|---|---|---|---|
| "linera" | invalid interpolation method | 0 | the same error |
| "", "Linear", "linear ", NA, 1 | invalid interpolation method | 0 | the same error |
| "lin", "l" | 0.5 | 0 | 0.5 |
| "c", "const", "constant" | 0 | 0 | 0 |
| "linear" | 0.5 | 0.5 | 0.5 |

`approx(1, 1, xout = 0.5, method = "linera")` is the method error in R (checked first); `approx(1, 1, xout = 1, method = "c")` is 1. The same after the fix.

## Fix

- `src/numerics/interp.ts`: `approxMethod` (pmatch over the two names), used at the start of `approx`; the option's doc comment says so.
- No docs change (the results are R's).

## Tests

- `test/issue221.test.ts`: the invalid methods throw R's message (also with one point); the full names and prefixes give R's values. With src stashed both tests fail.
- The test files that mention `approx`: 426 passed / 38 skipped. `npx tsc --noEmit -p .`: no errors.

## The rule part (decided: an error)

The issue also says that rule values other than 1 and 2 are taken as rule 2. R 4.5.2 does the same (`approx(c(0, 1), c(0, 1), xout = c(-1, 2), rule = 3)$y` is `0 1`, not an error), so the issue's premise that R rejects it is wrong. The user decided (group B5, option (a), with #227 and #229) to make it an error under the policy "meaningless input is an error", and to document the difference from R.

### Plan

- Intent: a rule that does not exist (3 meant as some other extrapolation, a typo such as 0 or 12) silently gave rule 2, so the mistake went unnoticed.
- Method: `approxRule`, checked right after the method as R's `stopifnot(is.numeric(rule), length 1 or 2)`: the rule is 1 or 2, given once (a number or a one-element array) or as a pair `[left, right]`; anything else (another number, NaN, Infinity, an empty array, more than two values, a non-number) is a RangeError "'rule' must be 1 or 2, or a pair of them".
- A one-element array is taken as the same rule on both sides, as R's `rule[c(1, 1)]`. Before, `[1]` left the right rule undefined and so took the last y on the right (rule 2); `[1]` now gives NaN on both sides, R's value.
- Expected effect: rules 1, 2, `[1, 2]`, `[2, 1]` and the default keep their bits; the fixture uses only 1, 2 and `[1, 2]`.

### Check (main `908df84`; R 4.5.2)

At `approx(c(0, 1), c(0, 1), xout = c(-1, 2), rule = r)$y`:

| rule | R 4.5.2 | Before | After |
|---|---|---|---|
| 1, 2, c(1, 2), c(2, 1), c(2, 2) | NA NA, 0 1, NA 1, 0 NA, 0 1 | the same | the same |
| c(1) | NA NA | NaN 1 | NaN NaN |
| 3, 0, 1.5, -1, Inf | 0 1 | 0 1 | RangeError "'rule' must be 1 or 2, or a pair of them" |
| c(1, 3) | NA 1 | NaN 1 | the same error |
| NA | error "missing value where TRUE/FALSE needed" | 0 1 | the same error |
| c(1, 2, 2) | error "lenR <= 2L is not TRUE" | NaN 1 | the same error |
| numeric(0) | error "(lenR <- length(rule)) >= 1L is not TRUE" | (not run before) | the same error |

`approx(1, 1, xout = 0.5, rule = 3)` is now the rule error (checked before the number of points, as R checks rule before the points).

### Fix

- `src/numerics/interp.ts`: `approxRule`, used after `approxMethod`; the option's doc comment says so.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: added to the list "Input that has no meaning is an error".

### Tests

- `test/issue221.test.ts`: two tests added. Rules other than 1 or 2 (also NaN, `[1, 3]`, three values, an empty array, null, a string) throw, also with one point; 1, 2 and the pairs give R's values, with `[1]` as R. With src stashed both new tests fail (the second on `[1]`).
- `npx vitest run`: 313 files passed (2686 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in f293c04 (method) and <commit of the rule part of #221, see git log --grep='#221'> (rule):

- `method`: `approx` now checks it as R's `pmatch(method, c("linear", "constant"))`: the full name or a unique prefix (`"lin"`, `"c"`) is accepted, and anything else, such as the issue's `"linera"`, throws R's error "invalid interpolation method". Before, every method other than `"linear"` gave the step function (also `"lin"`, which R takes as linear).
- `rule`: it must now be 1 or 2, given once or as a pair `[left, right]`; any other value (3, 0, 1.5, NaN, more than two values) throws "'rule' must be 1 or 2, or a pair of them". Before, every value other than 1 was taken as rule 2. Note that R 4.5.2 does the same (`approx(c(0, 1), c(0, 1), xout = c(-1, 2), rule = 3)$y` is `0 1`), so rejecting it is a deliberate difference from R, documented in docs/differences-from-r.md under "Input that has no meaning is an error". A one-element array such as `[1]` is now the same rule on both sides, as in R (it took rule 2 on the right).

Test: test/issue221.test.ts. (Not pushed yet.)
