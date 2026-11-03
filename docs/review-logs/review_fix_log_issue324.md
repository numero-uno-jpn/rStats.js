# Issue #324 log: binomTest upper tail beyond 2^53

GitHub Issue #324. Session 12.

## Plan

- Intent: the "greater" p-value is P[X >= x] = pbinom(x - 1, n, p, upper). Beyond 2^53 either x - 1 rounds, or (the issue's case) x - 1 is exact but pbinom's second shape n - (x - 1) rounds: for x = 2^53, n = 2^54 it is 2^53 + 1, rounded to 2^53, and the value is the symmetric 0.5.
- Method: a helper `atLeast(x, n, p)`: where x - 1 and n - (x - 1) are both exact (`twoSum`), the old call (same bits); otherwise P[X > x] + dbinom(x), as #323 for poissonTest. The two upper tails of the two-sided p-value use it too.

## Check (main `a6a05b2`)

| call (`p: 0.5, alternative: "greater"`) | R 4.5.2 | before | after |
|---|---|---|---|
| x = 2^53, n = 2^54 | 0.5 | 0.5 | 0.5000000029723516 |
| x = 2^53 + 2, n = 2^54 + 4 | 0.500000011889406 | 0.5000000089170549 | 0.5000000029723516 |
| x = 7, n = 20, p = 0.3; x = 0, n = 2^54 | | | unchanged |

True value at the mean: 1/2 + dbinom(n/2)/2 = 0.5 + 5.9447e-9 / 2. The two-sided `binomTest(2^53 + 2e9, 2^54)` moves from 3.645096573647377e-195 to 3.645097383930639e-195 (the point mass at x). R differs, so docs rows are added.

## Fix

- `src/htest/binomTest.ts`: `atLeast` for the "greater" p-value and both upper tails of `twoSidedP`.

## Tests

- `test/issue324.test.ts`: the two calls above against pbinom(x, upper) + dbinom(x) and the true value; ordinary inputs unchanged. With `src/` stashed the first block fails.
- binomTest tests and `npx tsc --noEmit -p .`: pass, no errors.
- Docs: `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`.

## Out of scope (recorded)

- `pbinom` itself: where x + 1 is exact but n - x rounds, it uses the rounded n - x without the NaN of the 2^53 policy: `pbinom(2^53 - 1, 2^54, 0.5, { lowerTail: false })` is 0.5 (true 0.5000000029724; R 0.5 too). The policy (round 55) only checks n - x on the path where x + 1 rounds. The "less" p-value and the lower tails of binomTest's two-sided p-value go through it. Not changed here.

## close comment

Fixed in <commit of #324, see git log --grep='#324'>: binomTest forms P[X >= x] as P[X > x] + dbinom(x) where x - 1 or n - (x - 1) is not exact (beyond 2^53), for the "greater" p-value and both tails of the two-sided one. The issue's call `binomTest(2^53, 2^54, { p: 0.5, alternative: "greater" })` gave 0.5 (x - 1 is exact there, but pbinom's n - (x - 1) = 2^53 + 1 rounded) and now 0.5000000029723516; x = 2^53 + 2, n = 2^54 + 4 gave 0.5000000089 and now the same 0.50000000297. R gives 0.5 and 0.500000011889 (recorded in docs/differences-from-r.md). Ordinary counts are unchanged. Test: test/issue324.test.ts. (Not pushed yet.)
