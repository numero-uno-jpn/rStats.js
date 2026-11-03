# Issue #430 log: adTest and cvmTest with an infinite observation

GitHub Issue #430. Session 13, judging of the issues classified C. Verdict: completed (already fixed by 7815130 for issue 304). No code changed.

## Plan

- Intent: run the issue's calls on the current main through the public API.
- Why: classified C (already fixed); the verdict needs the behaviour confirmed.

## Check (main `cf2ee38`)

- `adTest([1, 2, 3, 4, 5, 6, 7, Infinity])`, the same with -Infinity, and `cvmTest` with both: RangeError "'x' must be finite". No statistic and no p-value are returned.
- 7815130 (issue 304) made an infinite observation an error in adTest, cvmTest, lillieTest, sfTest and pearsonTest (as shapiroTest). nortest's ad.test, cvm.test and lillie.test stop there as well (the issue notes this).

## Earlier decision

- `docs/differences-from-r.md`, the list of inputs without meaning that are errors: "an infinite observation in `adTest`, `cvmTest`, `lillieTest`, `sfTest` and `pearsonTest` ... issue #304".

## Fix

- None (fixed by 7815130).

## Tests

- None (test/issue304.test.ts).

## Out of scope

- None.

## close comment

Completed: this was fixed in 7815130 (#304). An infinite observation is now a RangeError ("'x' must be finite") in adTest and cvmTest (and lillieTest, sfTest, pearsonTest), so adTest([1, 2, 3, 4, 5, 6, 7, Infinity]) and cvmTest of the same sample, with +Infinity or -Infinity, no longer return the fixed tail p-values 3.7e-24 and 7.37e-10. (Not pushed yet.)
