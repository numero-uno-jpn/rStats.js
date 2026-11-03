# Issue #407 log: rsignrank with a huge finite n

GitHub Issue #407. Session 13, group B (user decision).

## Plan

- User decision (2026-11-03): accept n < 2^27 and throw a RangeError for n >= 2^27 before any uniform is drawn (the recommended option of the preparation).
- Intent: `rsignrank` draws one uniform per rank with no bound on n, so a finite n blocks the thread for hours (1e12) or forever (1e100: past 2^53, `i++` stops advancing). The session 12 policy bounds the work of each function at about 10 s on this PC and rejects larger requests before allocating (here: drawing).
- Why 2^27: it is the domain of `dsignrank`, `psignrank` and `qsignrank` (#37), the same count as the draw bound of the `chisqTest` simulation (#287), and 2^27 draws take about 4 s with Mersenne-Twister and 8 s with L'Ecuyer-CMRG. Below it the sum is exact in practice (its mean is about 2^52).
- The check sits inside the generator, as in `rwilcox`, so `rsignrank(0, n)` gives `[]` for any n.

## Check (main `9898651`)

Timings on this PC (`rsignrank(1, n)`, seed 1): about 30 ns per rank with Mersenne-Twister (1e8: 2.98 s), 60 ns with L'Ecuyer-CMRG (3e7: 1.84 s); extrapolated 1e12: 8.3 hours.

R 4.5.2: `set.seed(1); rsignrank(1, 1e8)` = 2499930287935997 (2.96 s), the same as rStats.js, and the same next `runif`. `rsignrank(1, 2^31)` and `rsignrank(1, 1e12)` give 0 without drawing (C's `(int) n` is out of range; not a meaningful value). `rsignrank(1, 2147483647.4)` did not finish in 60 s.

## Fix

- `src/random/rank.ts`, `rsignrank`: after the half-to-even rounding, `k >= 2^27` throws "n must be less than 2^27 (134217728)" before drawing. Smaller n keep their values and stream.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a row after the `rwilcox` row (R accepts up to 2147483647).

## Tests

- `test/issue407.test.ts`: 2^27 and 2^27 - 0.5 (rounds to 2^27) throw and leave the stream untouched; 2147483647, 1e12, 2^53 + 2, 1e100 and the largest double throw likewise; `rsignrank(0, 1e100)` is `[]`; seeded small values and the NaN cases are unchanged. With `src/` stashed, the 2^27 test fails (it returned a value after 4.5 s); the huge-n test was not run there (it would not end). n = 2^27 - 1 (accepted, about 4 s) is not tested.
- `test/random.test.ts` (fixture `rrank.json`, n at most 10), `test/locationScaleExtremes.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `rwilcox` allocates `new Int32Array(m + n)` up to m + n = 2147483647 (8 GB, above the 2^24 array bound of the session 12 policy) and initialises all of it per draw. A sparse Fisher-Yates (a Map holding the n swapped slots) would keep the values and the stream without the allocation. A separate issue.

## close comment

Fixed in <commit of #407, see git log --grep='#407'>: `rsignrank` now throws a RangeError "n must be less than 2^27 (134217728)" when n (after half-to-even rounding) is 2^27 or more, before any uniform is drawn, so `rsignrank(1, 1e12)` and `rsignrank(1, 1e100)` return at once instead of looping for hours or forever. The bound is the domain of `dsignrank`/`psignrank`/`qsignrank`; 2^27 draws take about 4 s (8 s with L'Ecuyer-CMRG) on the test machine. Smaller n keep their values and random stream. R 4.5.2 runs up to 2147483647 (about a minute) and returns 0 without drawing beyond its integer range, so the bound is recorded in docs/differences-from-r.md.

Test: test/issue407.test.ts. (Not pushed yet.)
