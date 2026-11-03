# Issue #221 log: approx with an invalid method (the rule part awaits a decision)

GitHub Issue #221. Session 11, group A1 (input checks). Only the `method` part is fixed here. The `rule` part is awaiting the user's decision separately (group B5 of the session 11 triage, with #227 and #229) and the code for `rule` is not touched.

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

## The rule part (not changed; awaiting a decision)

The issue also says that rule values other than 1 and 2 are taken as rule 2. R 4.5.2 does the same: `approx(c(0, 1), c(0, 1), xout = c(-1, 2), rule = 3)$y` is `0 1`, not an error, so the issue's premise that R rejects it is wrong. Whether to make it an error (the policy "meaningless input is an error") or keep R's behaviour (as #47) is a question for the user, asked together with #227 (cut with empty breaks) and #229 (hist with infinite breaks).

## Fix

- `src/numerics/interp.ts`: `approxMethod` (pmatch over the two names), used at the start of `approx`; the option's doc comment says so.
- No docs change (the results are R's).

## Tests

- `test/issue221.test.ts`: the invalid methods throw R's message (also with one point); the full names and prefixes give R's values. With src stashed both tests fail.
- The test files that mention `approx`: 426 passed / 38 skipped. `npx tsc --noEmit -p .`: no errors.

## close comment

Not to be closed yet: the `rule` part awaits a decision. When it is closed, the method part reads:

Fixed in <commit of #221, see git log --grep='#221'>: `approx` now checks `method` as R's `pmatch(method, c("linear", "constant"))`: the full name or a unique prefix (`"lin"`, `"c"`) is accepted, and anything else, such as the issue's `"linera"`, throws R's error "invalid interpolation method". Before, every method other than `"linear"` gave the step function (also `"lin"`, which R takes as linear). On `rule`: R 4.5.2 also takes rule = 3 as rule 2 (`approx(c(0, 1), c(0, 1), xout = c(-1, 2), rule = 3)$y` is `0 1`), so it is not an error in R; whether to reject it is decided separately. Test: test/issue221.test.ts. (Not pushed yet.)
