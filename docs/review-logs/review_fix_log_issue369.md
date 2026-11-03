# Issue #369 log: huge subdivisions reach the typed-array allocation (input check part)

GitHub Issue #369. Session 12, group A1 (input checks to R's errors). Fixed here: only the input check, `subdivisions` as R's `as.integer` (beyond the integer range is an error). A resource limit below 2147483647 (the allocation itself) is left to the next step (B4 / B1, allocation limits) and is not changed here.

## Plan

- Intent: `integrate` truncated any finite `subdivisions` and passed it to QUADPACK, which allocates typed arrays of length limit + 1; 2^32 or 1e300 failed in the allocation with V8's message.
- Choice: R's semantics: `limit <- as.integer(subdivisions)`, NA beyond the integer range, then an error. The boundary with the resource limit is clear (2147483647, R's integer range), so the input check is done here.

## Check (main `773a939`, R 4.5.2)

| subdivisions | R | rStats.js before |
|---|---|---|
| 2^32, 2147483648, -2^32, 4294967295, 1e300 | warning "NAs introduced by coercion to integer range", then error "missing value where TRUE/FALSE needed" | 1e300: RangeError "Invalid typed array length: 1e+300"; 2^32 and 2147483648: the allocation is attempted (not run); -2^32: "invalid parameter values" |

## Fix

- `src/numerics/integrate.ts`: `subdivisions` with abs(subdivisions) > 2147483647 (or NaN, as before) is RangeError "invalid parameter values" (rStats.js's message for invalid parameters; R's is the incidental "missing value where TRUE/FALSE needed"). Values in the integer range are truncated as before.
- No docs: R errors too.

## Tests

- `test/issue369.test.ts`: 1e300; 2147483648 and 2^32 (excluded from the stash run: they reach the allocation before the fix); 100.7 unchanged. With `src/` stashed, the 1e300 case fails.
- Test files using `integrate` pass; tsc no errors.

## Out of scope (recorded)

- Values from about 2^24 up to 2147483647 still allocate large typed arrays (up to about 68 GB at 2^31 - 1); a practical limit is B1's question.

## close comment

Partly fixed in <commit of #369, see git log --grep='#369'>: subdivisions is now taken as R's as.integer, so a value beyond the integer range (the issue's 2^32, or 1e300) is RangeError "invalid parameter values" before QUADPACK allocates anything (R 4.5.2 also stops: "NAs introduced by coercion to integer range", then "missing value where TRUE/FALSE needed"). Values in the integer range are unchanged. A practical limit below 2147483647 for the workspace is a separate decision and is not part of this change. A test was added: test/issue369.test.ts. (Not pushed yet.)
