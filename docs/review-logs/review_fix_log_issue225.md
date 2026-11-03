# Issue #225 log: tabulate with Infinity (and values beyond the integer range)

GitHub Issue #225. Session 11, group A1 (input checks).

## Plan

- Intent: `tabulate` truncated the bins with `Math.trunc` only, so `Infinity` stayed and the default `nbins` (the largest bin) became Infinity: `tabulate([1, Infinity])` threw "Invalid array length".
- Method: convert the bins as R's `as.integer` does: truncate, and make the value NA (NaN here) when it is infinite or outside [-2147483647, 2147483647]. Such a value is then neither counted nor used for the default `nbins`.
- Why the integer range too, not only the infinite values: it is the same root (R's `as.integer` turns both into NA with the warning "NAs introduced by coercion to integer range"), and a large finite value was worse than Infinity: `tabulate([1, 3e9])` asked for an array of 3e9 entries and the process ran out of memory (R gives 1). Values inside the range are unchanged, so every result that was returned before keeps its bits.
- Expected effect: only inputs with infinite or out-of-range values change, to R's results.

## Check (main `c2a515a` with #203, #219, #221; R 4.5.2)

| call | R 4.5.2 (all with the warning) | Before | After |
|---|---|---|---|
| tabulate(c(1, Inf)) | 1 | RangeError: Invalid array length | 1 |
| tabulate(c(1, -Inf)) | 1 | 1 | 1 |
| tabulate(c(2, Inf, NaN)) | 0 1 | RangeError | 0 1 |
| tabulate(c(1, Inf), 3) | 1 0 0 | (not run before) | 1 0 0 |
| tabulate(Inf) | 0 | (not run before) | 0 |
| tabulate(c(1, 3e9)) | 1 | the process ran out of memory | 1 |
| tabulate(c(1, -3e9)), tabulate(c(1, 2147483648)) | 1, 1 | (not run before) | 1, 1 |

`as.integer` in R 4.5.2: -2147483648.5 and 2147483648 are NA, -2147483647.5 and 2147483647.5 are -2147483647 and 2147483647 (truncation first); the new check is the same.

## Fix

- `src/descriptive/table.ts`: the bins as `as.integer` (NaN outside the range); the doc comment says which values are not counted.
- No docs change (the results are R's; R's warning is not given, as elsewhere).

## Tests

- `test/issue225.test.ts`: the infinite values; the finite values beyond the integer range. With src stashed only the first test was run (the second would run out of memory): it fails.
- The test files that use `tabulate`: 79 passed. `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #225, see git log --grep='#225'>: `tabulate` now converts the bins as R's `as.integer` does: a value that is infinite or beyond the integer range (abs(trunc(v)) > 2147483647) is NA, so it is not counted and does not set the default `nbins`. `tabulate([1, Infinity])` is `[1]` (was "Invalid array length"), as R 4.5.2 (which also warns "NAs introduced by coercion to integer range"). The same change fixes `tabulate([1, 3e9])`, which ran out of memory, and is now `[1]` as in R. Values inside the range are unchanged. Test: test/issue225.test.ts. (Not pushed yet.)
