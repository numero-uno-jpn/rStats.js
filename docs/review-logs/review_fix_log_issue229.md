# Issue #229 log: hist with infinite explicit breaks

GitHub Issue #229. Session 11, group B5 (arguments R accepts without meaning, with #227 and the rule part of #221). Decided by the user (option (a) of the B5 preparation: all three are errors; the difference from R is documented).

## Plan

- Intent: `hist(x, { breaks: [-Infinity, Infinity] })` counted the values in a cell of infinite width, so its density was 0 and its midpoint NaN (Infinity or -Infinity for a half-infinite cell). A histogram of such cells has no meaning; the policy "meaningless input is an error" (reviews 33 and 38) applies.
- Method: an explicit break vector (more than one value) with any value that is not finite is a RangeError "'breaks' are not finite", checked before the sort. NaN is included: it was already an error (R's "some 'x' not counted"; here "'breaks' are not strictly increasing"), now with the clearer message.
- A one-element array (or a number) is a number of cells and was already checked ("invalid number of 'breaks'" for Infinity); unchanged.
- Expected effect: only explicit breaks that are not finite change (from a result, or another error, to this error); every other result keeps its bits.

## Check (main `42e614e`; R 4.5.2)

At `hist(c(0, 1), breaks = b, plot = FALSE)`:

| b | R 4.5.2 (counts, density, mids) | Before | After |
|---|---|---|---|
| c(-Inf, Inf) | 2, 0, NaN | the same as R | RangeError "'breaks' are not finite" |
| c(0, Inf) | 2, 0, Inf | the same as R | the same error |
| c(-Inf, 0.5, Inf) | (1, 1), (0, 0), (-Inf, Inf) | the same as R | the same error |
| c(-Inf, 0, 1) | (1, 1), (0, 0.5), (-Inf, 0.5) | (not run before) | the same error |
| c(0, NaN, 1) | error "some 'x' not counted; maybe 'breaks' do not span range of 'x'" | error "'breaks' are not strictly increasing" | the same error |

The issue's premise that R rejects non-finite breaks ("'breaks' are not finite") is wrong: R 4.5.2 returns the values above. `hist(c(0, 1, 2.5), breaks = c(0, 1, 3))` (counts 2 1, density 2/3 1/6, mids 0.5 2) is unchanged.

## Fix

- `src/descriptive/hist.ts`: the finiteness check of the explicit breaks; the doc comment of `breaks` says so.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: added to the list "Input that has no meaning is an error".
- No fixture change: the R fixture of `hist` has no infinite explicit break.

## Tests

- `test/issue229.test.ts`: infinite and NaN explicit breaks are the error; finite breaks give R's values, and a single infinite value is still the error on the number of cells. With src stashed the first test fails.
- `npx vitest run`: 313 files passed (2684 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- With infinite breaks rejected, the infinite-end branches of `cellDensity` (`Number.isFinite(a) && Number.isFinite(b)`) are no longer reachable from explicit breaks. They are left as they are (harmless).

## close comment

Fixed in <commit of #229, see git log --grep='#229'>: `hist` now throws "'breaks' are not finite" when an explicit break vector contains an infinite or NaN value, for example `hist([0, 1], { breaks: [-Infinity, Infinity] })`, which returned a density of 0 and a NaN midpoint. Note that R 4.5.2 does not reject infinite breaks (it returns the same density 0 and NaN midpoint), so this is a deliberate difference from R, documented in docs/differences-from-r.md under "Input that has no meaning is an error". NaN breaks were already an error and now give this message. Finite breaks are unchanged. Test: test/issue229.test.ts. (Not pushed yet.)
