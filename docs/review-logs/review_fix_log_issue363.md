# Issue #363 log: a cross-classification beyond the array-length limit

GitHub Issue #363. Session 12, group A1 (input checks to R's errors). Fixed: 2^31 cells or more is R's tapply error "total number of levels >= 2^31", checked before the per-cell arrays are allocated.

## Plan

- Intent: `groupingOf` (`src/data/grouping.ts`) multiplies the level counts, and `rowsByCell` allocates one array per cell. The issue's 65536 x 65536 (2^32 cells) fails with V8's "Invalid array length"; from 2^31 to 2^32 - 1 the allocation is attempted.
- Choice: R's limit and message, in `groupingOf` (shared by tapply, split and aggregate), so no caller reaches the allocation.

## Check (main `f90c4c0`, R 4.5.2)

| call | R | rStats.js before |
|---|---|---|
| `tapply(rep(1, 65536), list(a, b), length)`, 65536 levels each | error "total number of levels >= 2^31" | RangeError "Invalid array length" (V8) |
| the same with 46341 levels each (46341^2 = 2147488281 cells) | the same error | attempts 2^31 arrays (not run) |
| `aggregate(x ~ a + b, ...)`, 65536 levels each | 65536 rows (R keeps only observed combinations) | the V8 error |

## Fix

- `src/data/grouping.ts`, `groupingOf`: `size >= 2 ** 31` throws `RangeError("total number of levels >= 2^31")`. Smaller cross-classifications are unchanged. No docs for tapply (R's behaviour).

## Tests

- `test/issue363.test.ts`: the issue's 65536 x 65536; 46341 x 46341 (excluded from the stash run: it allocates before the fix); a small table unchanged. With `src/` stashed, the issue's case fails.
- Test files using tapply, split and aggregate (13 files) pass; tsc no errors.

## Out of scope (recorded)

- `aggregate` (and `split` with drop) in R build only the observed combinations, so R's aggregate returns 65536 rows for the issue's data, while rStats.js's `aggregateRows` goes through the full cross-classification and now throws R's tapply message. Making aggregate sparse is a separate change.
- Below 2^31 cells, a sparse cross-classification can still allocate up to 2^31 arrays (B1, allocation limits).

## close comment

Fixed in <commit of #363, see git log --grep='#363'>. A cross-classification of 2^31 cells or more is now R's tapply error "total number of levels >= 2^31" (R 4.5.2 gives it for the issue's 65536 x 65536 levels), checked in the shared grouping before any per-cell array is allocated; before, the issue's example failed with V8's "Invalid array length", and 2^31 to 2^32 - 1 cells attempted the allocation. Smaller tables are unchanged. Recorded, not changed: R's aggregate keeps only the observed combinations and succeeds on such data, where rStats.js's aggregate (which uses the full cross-classification) now gives this error. A test was added: test/issue363.test.ts. (Not pushed yet.)
