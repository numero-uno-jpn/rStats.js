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

## Second part: the work arrays grow with the subintervals used (session 12, group B4)

## Plan

- User decision (2026-11-03, item 4): remove the allocation instead of a limit: QUADPACK's work arrays grow with the subintervals actually used, so subdivisions up to 2147483647 (R's integer range, the first part's check) is accepted without allocating 36 (subdivisions + 1) bytes up front. Values unchanged.
- Choice: the five arrays (alist, blist, rlist, elist, iord) start at min(limit + 1, 128) entries and are doubled (at most to limit + 1) before iteration L when fewer than L + 2 exist. Iteration L touches indices up to L (dqpsrt's iord indices stay below `last`), and the final sum reads rlist[0..L]; entries not yet written are 0 as in a full-length typed array. dqpsrt still uses `limit` in its bounds, so the ordering is the same.

## Check

- Before (code reading, not run with a huge value): `integrate(x => x, 0, 1, { subdivisions: 2147483647 })` allocated four Float64Array and one Int32Array of 2^31 entries (about 77 GB) before the first rule evaluation. With 1e6 (run), a Float64Array of 1000001 entries was created for an integral that needs 1 subinterval.
- After: the same call returns 0.5 with arrays of 128 entries. R allocates its iwork and work of the requested size (about 77 GB here; not run).
- Values: sin(1/x) on (0, 1) (176 subintervals) and abs(sin 50x) exp(-x) on (0, Inf) (340 subintervals) give the same value, abs.error, subdivisions and ier as before (the arrays grow past 128 there). Existing integrate tests and fixtures pass.

## Fix

- `src/integrate/quadpack.ts` (`adaptive`): growing work arrays as above.
- No docs: R accepts the same subdivisions and gives the same values.

## Tests

- `test/issue369.test.ts`: subdivisions 1e6 creates no Float64Array of 1000 entries or more (a Proxy on Float64Array; fails with src stashed: 1000001); subdivisions 2147483647 returns 0.5 (excluded from the stash run); the two integrals above with the values of the implementation before this change.
- Test files using `integrate` pass; tsc no errors.

## Out of scope (recorded)

- Time: with a huge subdivisions an integrand that never converges can run for long (21 or 30 evaluations per subinterval); R is the same.

## close comment

Fixed in <commit of #369, see git log --grep='#369'>, in two parts. First, subdivisions is taken as R's as.integer, so a value beyond the integer range (the issue's 2^32, or 1e300) is RangeError "invalid parameter values" before QUADPACK runs (R 4.5.2 also stops: "NAs introduced by coercion to integer range", then "missing value where TRUE/FALSE needed"). Second, QUADPACK's work arrays now start small and grow with the subintervals actually used, so subdivisions up to 2147483647 no longer allocates 36 (subdivisions + 1) bytes up front (R allocates its workspace of that size): integrate(x => x, 0, 1, { subdivisions: 2147483647 }) returns 0.5. Values are unchanged (the same value, abs.error, subdivisions and ier). Tests: test/issue369.test.ts. (Not pushed yet.)
