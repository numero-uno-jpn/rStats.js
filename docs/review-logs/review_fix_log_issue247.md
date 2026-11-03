# Issue #247 log: uniroot with an invalid extendInt

GitHub Issue #247. Session 11, group A1 (input checks).

## Plan

- Intent: `uniroot` compared `extendInt` with `"yes"`, `"downX"` and `"upX"` only, so any other value (a typo such as `"bogus"`, or a prefix such as `"u"`) silently meant `"no"`.
- Method: resolve the option first, as R's `match.arg(extendInt)` against `c("no", "yes", "downX", "upX")`: the full name or a unique non-empty prefix; anything else (including a non-string, `""` and `null`) is a RangeError, thrown before f is evaluated (R's match.arg is the first thing uniroot does). Same approach as `approxMethod` of #221.
- Why prefixes: R accepts them (`"u"`, `"y"`, `"n"`, `"d"`), as the project's other method arguments do. Rejecting them would make working R code fail.
- Expected effect: the four names and the default keep their bits.

## Check (main `7e72576`; R 4.5.2)

`f <- function(x) x^2 - 2`:

| call | R 4.5.2 | Before | After |
|---|---|---|---|
| `uniroot(f, c(0, 2), extendInt = "bogus")` | error `'arg' should be one of "no", "yes", "downX", "upX"` | root 1.414214 | RangeError (`'extendInt' should be one of ...`) |
| `""`, `"DOWNX"`, `NA` | the same error | root | the same RangeError |
| `1` | error `'arg' must be NULL or a character vector` | root | the RangeError |
| `"n"`, `"y"`, `"u"` on c(0, 2) | 0x1.6a09e256f2c19p+0 | the same | the same |
| `uniroot(f, c(2, 3), extendInt = "u")` | 1.414218 (extended upwards) | error (no sign change, taken as "no") | 1.414218, the same result as "upX" |
| `"d"` on c(0, 2) | no sign change found in 1000 iterations | root (taken as "no") | the same error as R |

The message names `'extendInt'` rather than R's `'arg'`.

## Fix

- `src/numerics/integrate.ts`: `extendIntArg` (match.arg over the four names), used at the start of `uniroot` before f is called; the option's doc comment says so.
- No docs change (the results are R's).

## Tests

- `test/issue247.test.ts`: invalid values throw without calling f; the names and prefixes give R's root, `"u"` gives the same result as `"upX"` and `"d"` the "no sign change" error. With src stashed both tests fail.
- Full `npx vitest run`: 294 files passed (2645 tests, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #247, see git log --grep='#247'>: `uniroot` now checks `extendInt` as R's `match.arg(extendInt)` against `c("no", "yes", "downX", "upX")`: the full name or a unique prefix (`"u"`, `"d"`, as R accepts) is used, and anything else, such as the issue's `"bogus"`, `""` or a non-string, throws a RangeError before the function is evaluated (R: `'arg' should be one of ...`). Before, every unknown value meant `"no"`, and a prefix such as `"u"` did not extend the interval. Test: test/issue247.test.ts. (Not pushed yet.)
