# Issue #323 log: poissonTest upper tail with x - 1 rounding beyond 2^53

GitHub Issue #323. Session 12.

## Plan

- Intent: the "greater" p-value is P[X >= x] = ppois(x - 1, m, upper). Beyond 2^53 the double x - 1 can round to x or to x - 2, which drops or adds a point mass.
- Method: a helper `atLeast(x, m)`: where x - (x - 1) === 1 the old call (same bits), otherwise P[X > x] + dpois(x) (the identity of the ppois exception in sessions 54 and 55). The two-sided p-value forms the same upper tail twice (P[X >= x] for x > m, P[X >= j] for the far side when x < m); both go through the helper as well, since they are the same computation.

## Check (main `495864b`)

The issue's x = 2^53 is not a reproduction: 2^53 - 1 is exact and the value 0.50000000140118 is right. True values from P[X >= m] = 1/2 + 1/(3 sqrt(2 pi m)) + O(1/m) at an integer mean m (1/sqrt(2 pi 2^53) = 4.2035e-9).

| call (`alternative: "greater"`, r = x) | R 4.5.2 | before | after | true |
|---|---|---|---|---|
| x = 2^53 | 0.50000000140118 | 0.50000000140118 | unchanged | 0.5000000014012 |
| x = 2^53 + 2 | 0.50000000980826 | 0.5000000056047199 | 0.50000000140118 | 0.5000000014012 |
| x = 2^54 + 4 | 0.499999998018432 | 0.4999999980184323 (P[X > x]) | 0.5000000009907839 | 0.5000000009908 |

The two-sided `poissonTest(2^53, { r: 2^53 * 1.0000001 })` moves from 2.296504159223979e-21 to 2.2965040431508227e-21 (the far tail starts at j beyond 2^53, where j - 1 rounded). R differs in the "greater" rows above, so a docs row is added.

## Fix

- `src/htest/poissonTest.ts`: `atLeast` for the "greater" p-value and both upper tails of `twoSidedP`.

## Tests

- `test/issue323.test.ts`: x = 2^53 + 2 and 2^54 + 4 against ppois(x, upper) + dpois(x) and the first-order true values; x = 2^53 and x = 137 unchanged. With `src/` stashed the first block fails.
- poissonTest tests and `npx tsc --noEmit -p .`: pass, no errors.
- Docs: `docs/differences-from-r.md`, `docs/ja/differences-from-r.md` (beyond 2^53 rows).

## Out of scope (recorded)

- R's own `ppois(2^53, 2^53, lower.tail = FALSE)` is P[X >= 2^53] (0.50000000140, true P[X > 2^53] 0.49999999720): its q + 1 rounds as well. rStats.js's ppois is right there. Not an rStats.js defect.

## close comment

Fixed in <commit of #323, see git log --grep='#323'>: poissonTest forms the upper tail P[X >= x] as P[X > x] + dpois(x) where x - 1 is not exact (beyond 2^53), for the "greater" p-value and both tails of the two-sided one. The issue's x = 2^53 was already right (2^53 - 1 is exact; 0.50000000140118); x = 2^53 + 2 gave 0.5000000056047 and now 0.50000000140118, x = 2^54 + 4 gave 0.4999999980184 and now 0.5000000009908 (true values 1/2 + 1/(3 sqrt(2 pi x)) to first order). R gives 0.50000000980826 and 0.499999998018432 there (recorded in docs/differences-from-r.md). Where x - 1 is exact nothing changes. Test: test/issue323.test.ts. (Not pushed yet.)
