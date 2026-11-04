# Revision of review 12 (and the out-of-scope note of issue 407): rwilcox without the array of m + n ranks

## Plan
- Intent: `rwilcox` drew n of the m + n ranks without replacement from an `Int32Array(m + n)` filled for each value
  (up to 2147483647 entries, 8 GB), and drew one uniform per rank of the second sample without a bound on n (3.4 s
  per value at n = 2^24 + 5). Criterion K4 (arrays of at most 2^24 entries; where the values and the stream can be
  kept without the allocation, remove it; about 10 s at most, a RangeError before).
- Decision: D7 (session 14, `prep/limits.md` question 1, recommended option (a)): beyond m + n = 2^24 a sparse
  Fisher-Yates with the same values and uniforms; n at most 2^24 (n: R's `n`, the size of the second sample, which is
  the number of ranks drawn).
- Form: m + n <= 2^24 keeps the array (the same code). Beyond, `sparseRankSum` keeps in a Map only the slots that hold
  another rank than their own (x[j] defaults to j), drops the slot that falls out of reach after each draw and updates
  nothing after the last draw, so the Map holds at most n - 1 < 2^24 entries (V8's limit for a Map). The same
  `unifIndex(k)` calls with the same k, in the same order, and the same sums. `n > 2^24` is a RangeError "n must be at
  most 2^24 (16777216)" before any uniform, as `rsignrank`'s bound (issue 407). The bound m + n <= 2147483647
  (R's integer range) stays.
- RangeError from a random generator: K4's time bound, as the prep recommends (as `rsignrank`).

## Original decisions
- Review 12 (RNG-13): m + n > 2147483647 made a RangeError (it was "Invalid typed array length"); the allocation below
  that was kept. Issue 407 recorded the 8 GB allocation as out of scope. No user decision.

## Gap with the current criteria
- K4: an array of up to 2^31 entries per value, and no bound on the time.

## Reproduction (main)
| call (after `setSeed`) | rStats.js before |
|---|---|
| seed 42, `rwilcox(3, 2^24, 1000)` | [8412425064, 8471281579, 8239284703], next uniform 0.42369130183942616, 89 ms |
| seed 3, `rwilcox(2, 3e7, 5e5)` | [7500131290734, 7505587576761], next 0.6375575580168515, 0.36 s |
| seed 5, `rwilcox(4, 2^24 - 10, 10)` (the array, unchanged) | [79794662, 105704251, 89347602, 89687622], next 0.9394364822655916 |
| seed 11, `rwilcox(2, 10, 2^24 + 5)` | [103541132, 75859129], 6.9 s |
| `rwilcox(1, m, 10)`, m = 1e7 | (prep: 34 ms, an Int32Array of m + n) |
R (prep): `rwilcox(1, 10, 1e7)` 4.8 s.

## Fix
- `src/random/rank.ts`: `MAX_RWILCOX_N` 2^24, `sparseRankSum`, the bound on n, the JSDoc `@throws`.
- Docs (en, ja): the `rwilcox` bullet of the deliberate differences.
- After the fix: `rwilcox(1, 2e9, 10)` under 1 ms; `rwilcox(1, 1e9, 2^24)` 12.8 s (a Map of up to 2^24 entries is
  slower than the array; this is the slowest accepted case), `rwilcox(1, 2^24 - 1e6, 1e6 + 1)` 0.49 s.

## Tests
- `test/rev12.test.ts`: the seeded values and the next uniform before the revision (two cases beyond 2^24 ranks, one
  within); the Map version against a copy of the array version in the test (m = 2^24 - 5000, n = 30000, slots
  swapped several times), with the next uniform; `rwilcox(5, 2e9, 10)` at once; n beyond 2^24 throws at once and draws
  nothing. With src stashed the first two pass; the other two are not run on the old code (8 GB allocations, seconds
  per value).
- random (fixture `rrank.json`), issue407, issue414, rank, locationScaleExtremes pass.

## Out of scope (recorded)
- The statistic can exceed 2^53 (n m up to 2^24 times 2^31) and the double sum of the ranks then rounds, in the array
  version as well (unchanged).
- The accepted n = 2^24 with a huge m takes about 13 s per value, a little more than K4's "about 10 s"; the bound is
  the decision's.
