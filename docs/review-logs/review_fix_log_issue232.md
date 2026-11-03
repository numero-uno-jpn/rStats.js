# Issue #232 log: the exact tests of mantelhaenTest and fisherTest allocate the whole support without a size check

GitHub Issue #232. Session 11, group B6 (user decision: RangeError beyond a support of 2^24 values, mantelhaenTest pointing to `exact: false`; fisherTest's 2 x 2 test included in the same commit).

## Plan

- Intent: `mantelhaenTest(..., { exact: true })` builds a `Float64Array` over each stratum's whole hypergeometric support and convolves them; `fisherTest` on a 2 x 2 table builds one over the support of the (1, 1) cell. Counts of 1e9 ask for 16 GB per array (the issue), which can end the process before any error reaches the caller.
- Method (the user's choice among: RangeError at 2^24, RangeError at 2^27, NaN, a windowed support): before anything is allocated, count the support exactly from the cells and throw a RangeError when it has more than 2^24 values.
  - One 2 x 2 table [[a, b], [c, d]]: lo = max(0, a - d), hi = a + min(b, c), so hi - lo + 1 = min(a, d) + min(b, c) + 1. This form needs no difference of large margins.
  - mantelhaenTest: the support of S has 1 + sum over the strata of (min(a, d) + min(b, c)) values; each stratum's support and every partial convolution is no longer, so the one check covers all the arrays. The message ends "use exact: false".
  - fisherTest: the check sits in `fisher2x2` after the option checks, before `OddsRatioDistribution` is built.
- Why 2^24: about 0.4 GB and seconds (fisherTest) to a minute (one large stratum of mantelhaenTest) per call, safe in a browser tab; more than 50 times the largest support in the fixtures (fisherTest about 3e5, mantelhaenTest 2026), so no fixture changes.
- R computes these tables when it has the memory, so the error is a deliberate difference, recorded in docs/differences-from-r.md and docs/ja.

## Check (main `81640f1`)

| call | R 4.5.2 | Before | After |
|---|---|---|---|
| `mantelhaenTest([t, t], { exact: true })`, t = [[1e9, 1e9], [1e9, 1e9]] (the issue) | not run (16 GB per stratum) | allocates 2e9 + 1 doubles per stratum (not run) | RangeError "the exact distribution of S has 4000000001 values, more than 2^24: use exact: false" |
| `fisherTest([[1e9, 1e9], [1e9, 1e9]])` | not run | allocates 2e9 + 1 doubles (not run) | RangeError "... 2 x 2 table has 2000000001 values, more than 2^24" |
| `fisher.test(matrix(1e7, 2, 2))` (2e7 + 1 values) | p 1, estimate 1, interval [0.9987642, 1.0012374], 45 s | computed | RangeError |
| `mantelhaen.test` exact, strata [[9e6, 9e6], [9e6, 9e6]] and [[3, 1], [1, 3]] (1.8e7 + 3 values) | p 0.999734, estimate 1, 81 s | computed | RangeError |
| the bound itself: supports of exactly 2^24 values (fisherTest [[2^24 - 1, 0], [0, 2^24 - 1]]; mantelhaenTest strata [[2^23, 0], [0, 2^23]] and [[2^23 - 1, 0], [0, 2^23 - 1]]) | | allocated | allocated as before (checked by stubbing the allocation) |

Timings of the exact mantelhaenTest in rStats.js (tables [[n, n], [n, n]], no change from this fix): two strata n = 2e4: 0.6 s; 5e4: 2.0 s; 1e5: 4.8 s; one stratum n = 4e6 (support 1.6e7 + 3) with a small one: 37 s, 238 MB.

## Fix

- `src/htest/mantelhaenTest.ts`: `MAX_SUPPORT = 2^24` and the check at the top of `exact2x2xK`.
- `src/htest/fisherTest.ts`: `MAX_SUPPORT = 2^24` and the check in `fisher2x2` before the distribution is built.
- docs/differences-from-r.md and docs/ja/differences-from-r.md: a bullet under the deliberate differences of the hypothesis tests.

## Tests

- `test/issue232.test.ts`: `Float64Array` replaced (as in #219) by a proxy that throws for more than a million entries, so the original calls fail fast instead of allocating 16 GB. The issue's call and fisherTest's analogue throw the RangeError; supports of 2^24 + 1 values throw it; supports of exactly 2^24 pass the check and reach the (stubbed) allocation. The asymptotic test on the issue's strata still gives p 1. With `src/` stashed both tests fail (the stub's error instead of the RangeError).
- `npx vitest run`: 332 files passed (2747 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- Time within the bound: the convolution of mantelhaenTest costs about (nonzero entries of the partial density) x (length of the next stratum's support), so several large strata under 2^24 values can take long (extrapolating from n = 1e5, two strata of n = 4e6 would take about 20 minutes, against 37 s for one). The bound is on memory as decided; a windowed support (option (c) of the preparation) would also bound the time.

## close comment

Fixed in <commit of #232, see git log --grep='#232'>: the exact test of `mantelhaenTest` (2 x 2 x K) now counts the support of S before allocating anything (1 + the sum over the strata of min(a, d) + min(b, c), exact from the cells) and throws a RangeError when it has more than 2^24 values, pointing to `exact: false`. The issue's call now throws "the exact distribution of S has 4000000001 values, more than 2^24: use exact: false" at once. `fisherTest` on a 2 x 2 table had the same shape (a `Float64Array` over min(a, d) + min(b, c) + 1 values) and gets the same check. R allocates the whole support at any size (`fisher.test(matrix(1e7, 2, 2))` takes 45 s), so this is recorded in docs/differences-from-r.md. The bound is over 50 times the largest support in the fixtures; no values change.

Test: test/issue232.test.ts. (Not pushed yet.)
