# Issue #305 log: pearsonTest allocates a class array of nClasses entries

GitHub Issue #305. Session 12, group B4 (allocation limits, part R1: remove the allocation).

## Plan

- User decision (2026-11-03, item 4): remove the allocation instead of a limit; nClasses checked against R's integer range (up to 2147483647).
- Intent: `pearsonTest` created `new Array(k).fill(0)` for any integer `nClasses` leaving positive degrees of freedom; 2^31 with 8 observations attempted a 16 GB array.
- Choice: take the class numbers of the n observations, sort them, and sum the k terms `(count - e)^2 / e` over the classes 1..k in order, as `counts.reduce` did: the same terms in the same order, so the statistic is bit-identical; memory O(n), time O(k) (2147483647 classes: about 7 s here). Beyond 2147483647, R's error.

## Check (main `905e155`, R 4.5.2 with nortest)

| call | R | rStats.js before |
|---|---|---|
| `pearson.test(1:8, n.classes = 2^31)` | error "attempt to make a table with >= 2^31 elements" (tabulate) | allocates and fills a 2^31-entry array (code reading; not run) |
| `n.classes = 1e300` | warning "NAs introduced by coercion to integer range", then an error | RangeError "Invalid array length" |
| `n.classes = 1000` | statistic 0x1.f000000000061p+9 | the same (992.000000000011) |

## Fix

- `src/htest/normalityTests.ts` (`pearsonTest`): nClasses > 2147483647 is RangeError "attempt to make a table with >= 2^31 elements" (R's message); counts from the sorted class numbers, no k-entry array.
- No docs: R errors beyond the integer range and the values are unchanged.

## Tests

- `test/issue305.test.ts`: 1e300 and 2^31 (the latter excluded from the stash run) are the error; nClasses 1000 and 1e6 and two default/adjust cases give the values of the implementation before this change. With `src/` stashed, the 1e300 case fails ("Invalid array length").
- Test files using `pearsonTest` pass; tsc no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #305, see git log --grep='#305'>: pearsonTest no longer allocates an nClasses-entry count array. The counts are taken from the sorted class numbers of the observations and the statistic is summed over the classes in the same order as before, so the values are unchanged (bit for bit; nClasses 1000 on 1:8 gives R's 992.000000000011). nClasses beyond R's integer range (the issue's 2^31) is RangeError "attempt to make a table with >= 2^31 elements", R's error from tabulate. Up to 2147483647 classes are accepted as in R (memory O(n), time O(nClasses)). A test was added: test/issue305.test.ts. (Not pushed yet.)
