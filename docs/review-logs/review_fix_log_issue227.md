# Issue #227 log: cut with fewer than 2 break points

GitHub Issue #227. Session 11, group B5 (arguments R accepts without meaning, with #229 and the rule part of #221). Decided by the user (option (a) of the B5 preparation: all three are errors; infinite breaks in `cut` stay accepted; the difference from R is documented).

## Plan

- Intent: `cut(x, [])` returned NaN for every value: with no interval there is no interval code, so the result has no meaning. The policy "meaningless input is an error" (reviews 33 and 38) applies.
- Method: after the explicit breaks are sorted and NaN is dropped (as before), fewer than 2 left is the error of one break, R's "invalid number of intervals" for `cut(x, 0.5)`. A single number (or a one-element array) is still the number of intervals, unchanged.
- Why after dropping NaN: the doc comment of `cut` already counted the breaks after dropping NaN ("fewer than 2 left give NaN codes"), and `[NaN, 2]` or `[NaN, NaN]` define no interval either, exactly as `[]`. Checking the length before dropping NaN would reject `[]` but still return NaN codes for `[NaN, NaN]`.
- Infinite breaks are a legitimate use of `cut` (`c(-Inf, 0.5, Inf)`) and stay accepted, as in R.
- Expected effect: only inputs with fewer than 2 non-NaN breaks change (from NaN codes to an error); every other result keeps its bits.

## Check (main `f145566`; R 4.5.2)

| call | R 4.5.2 | Before | After |
|---|---|---|---|
| cut(c(0, 1), numeric(0)) | NA NA (levels "(,]") | NaN NaN | RangeError "invalid number of intervals" |
| cut(c(0, 1), c(0, NaN)) | NA NA | NaN NaN | the same error |
| cut(c(0, 1), c(NaN, NaN, 1)) | NA NA | NaN NaN | the same error |
| cut(c(0, 1), 0.5) | invalid number of intervals | the same error | the same error |
| cut(c(0, 1), c(0, NaN, 1)) | NA 1 | NaN 1 | NaN 1 |
| cut(c(0, 1), c(-Inf, 0.5, Inf)) | 1 2 | 1 2 | 1 2 |
| cut(c(0, 1), c(-Inf, Inf)) | 1 1 | 1 1 | 1 1 |

The issue's premise that R rejects an empty break vector is wrong: R 4.5.2 returns a factor of NA.

## Fix

- `src/descriptive/table.ts`: the check after the NaN-free sort of the explicit breaks; the doc comment of `breaks` says so.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: added to the list "Input that has no meaning is an error".
- `test/descriptive.test.ts`: the R fixture of `cut` has two cases with fewer than 2 non-NaN breaks (`[NaN, 2]` and `[NaN, NaN]`, R: NA codes). They are recorded with a `substitute` (expected: the error), with the reason. The preparation had counted 0 fixture changes; it had not looked at the NaN cases.

## Tests

- `test/issue227.test.ts`: fewer than 2 breaks (empty, after dropping NaN, one) are the error; two or more breaks, infinite ones too, give R's codes. With src stashed the first test fails.
- `npx vitest run`: 312 files passed (2682 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #227, see git log --grep='#227'>: `cut` with explicit breaks now throws "invalid number of intervals" (the error of a single break) when fewer than 2 breaks are left after dropping NaN, for example `cut([0, 1], [])` or `cut([0, 1], [NaN, NaN])`. Before, it returned NaN codes. Note that R 4.5.2 does not reject this (`cut(c(0, 1), numeric(0))` is a factor of NA), so this is a deliberate difference from R, documented in docs/differences-from-r.md under "Input that has no meaning is an error". Infinite breaks such as `[-Infinity, 0.5, Infinity]` stay accepted, as in R. Test: test/issue227.test.ts. (Not pushed yet.)
