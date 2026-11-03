# Issue #327 log: pgeom upper tail with x + 1 rounding beyond 2^53

GitHub Issue #327. Session 12.

## Plan

- Intent: `upper()` forms P[X > x] = q^(x + 1) as `qPow(x + 1)`. Beyond 2^53, x + 1 rounds to x or x + 2, so the tail is off by a factor q. In the issue's log example (p = 0.5, x = 2^53) the difference, log 2, is below one ulp of the log (6.2e15), so it is not visible there; it is visible in the linear value when q is near 1 (relative abs(log q)).
- Method: where (x + 1) - x !== 1, q^x times q (linear: the double-double q; log: plus log q, the same log q as `qPow`'s large-n branch). Elsewhere the old call (same bits). The lower tail goes through `upper` and follows. This is the exception for ppois and pbinom in sessions 54 and 55.

## Check (main `6419733`)

References: Rmpfr at 300 bits, exp((x + 1) log1p(-p)) with the exact binary64 p.

| call | R 4.5.2 | before | after | reference |
|---|---|---|---|---|
| `pgeom(2^54, 1e-14, { lowerTail: false })` | 0x1.13bd80f2f26d7p-260 | 5.813816568706364e-79 (49 ulps) | 0x1.13bd80f2f26d2p-260 | 0x1.13bd80f2f26d1p-260 |
| same, log | -0x1.6849b86a12bbbp+7 | same | same | same |
| `pgeom(2^54, 1e-16, { lowerTail: false })` | 0x1.520b879cbb6c7p-3 | 0x1.520b879cbb6c6p-3 | 0x1.520b879cbb6c5p-3 | 0x1.520b879cbb6c6p-3 |
| `pgeom(2^53, 0.5, { lowerTail: false, logP: true })` | | -6243314768165359 | -6243314768165360 | -(2^53 + 1) log 2 = -6243314768165359.7 |
| `pgeom(2^53 - 2, 1e-14, upper)`, `pgeom(5, 0.3, upper)` | | | unchanged | |

For p = 1e-16 the factor q is below an ulp and the product moves by one ulp in the other direction (within 1 ulp both ways). The 1e-14 row differs from R (R also rounds x + 1), so a docs row is added.

## Fix

- `src/distributions/geometric.ts`, `upper`.

## Tests

- `test/issue327.test.ts`: p = 1e-14 at x = 2^54 (upper, lower log, upper log), the issue's call, and exact x + 1 unchanged. With `src/` stashed the first block fails.
- pgeom and geometric tests and `npx tsc --noEmit -p .`: pass, no errors.
- Docs: `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #327, see git log --grep='#327'>: where x + 1 is not exact (beyond 2^53), pgeom forms the upper tail as q^x q instead of q^(x + 1) with the rounded exponent; the lower tail follows. The issue's log example differs by log 2, below one ulp of -6.2e15 (now -6243314768165360, was ...359); the error shows when q is near 1: `pgeom(2^54, 1e-14, { lowerTail: false })` was 49 ulps high and is now within 1 ulp of the Rmpfr value (R is 6 ulps high, recorded in docs/differences-from-r.md). Where x + 1 is exact nothing changes. Test: test/issue327.test.ts. (Not pushed yet.)
