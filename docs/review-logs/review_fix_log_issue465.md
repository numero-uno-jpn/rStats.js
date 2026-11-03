# Issue #465 log: inner products whose products round up to 2^-1022

GitHub Issue #465. Session 13, group A (#463, #465, #466).

## Plan

- Intent: the fallback of #395 (the exact inner product where |s| < 2^-969 and a product of nonzero factors fell below 2^-1022) tested the rounded products. A product whose exact value is just below 2^-1022 rounds up to 2^-1022 and was not counted, so the plain sum stood.
- Within the user decision of #395 (2026-11-03): its condition is that a product "fell below 2^-1022", which this exact product does. No new decision.
- Method: `checkDot` compares the bound with `<=` (it only lets `checkedDot` scan; a rounded bound of 2^-1022 may come from an exact one below). `checkedDot` decides by the rounded product except where it is 2^-1022 itself, and there compares the exact product (BigInt mantissas, `splitDouble`). A product just above 2^-1022 that rounds down to it is not counted, so the plain sums in the normal range keep their bits.

## Check (main `15b01bd`, R 4.5.2)

| call | R | before | after | exact (rounded once) |
|---|---|---|---|---|
| `crossprod(rep(2^-511, 100), rep(2^-511 (1 - 2^-53), 100))` (also `tcrossprod`, `matMul`) | 0x1.9p-1016 | 0x1.9p-1016 | 0x1.8ffffffffffffp-1016 | 0x1.8ffffffffffffp-1016 |
| `crossprod(rep(2^-511 + 2^-563, 100), rep(2^-511 - 2^-564, 100))` | 0x1.9p-1016 | 0x1.9p-1016 | 0x1.9p-1016 (unchanged) | 0x1.9000000000001p-1016 |
| `crossprod(rep(2^-511, 100))` (products exactly 2^-1022) | | 0x1.9p-1016 | 0x1.9p-1016 (unchanged) | 0x1.9p-1016 |

## Fix

- `src/linalg/dot.ts`: `checkDot` with `<=`; `checkedDot` through the new `productBelowMinNormal` (exact comparison only for a rounded product of 2^-1022).
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a sentence in the #395 row.

## Tests

- `test/issue465.test.ts`: the issue's case for crossprod, tcrossprod and matMul (fails with `src/` stashed) and the two unchanged rows.
- The 11 test files that use `crossprod` or `matMul` (708 tests, `test/issue395.test.ts` included) and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- The paired case, the second row of the table: each exact product is 2^-1022 + 2^-1075 - 2^-1127, a normal number rounded down to 2^-1022, and the 100 rounding errors add up to 0.78 ulp of the sum, so the plain sum is 1 ulp from the exact one (R gives the plain sum too). This is the rounding of normal products, outside the design of #395 (sums of normal products keep the bits of the plain sum). Not changed; a reviewer may raise it next.

## close comment

Fixed in <commit of #465, see git log --grep='#465'>. The check of #395 now uses the exact product where the rounded one is 2^-1022: `crossprod(rep(2^-511, 100), rep(2^-511 * (1 - 2^-53), 100))` (also tcrossprod and matMul) gives 0x1.8ffffffffffffp-1016, the exact inner product rounded once, instead of 0x1.9p-1016 (R 4.5.2 also gives 0x1.9p-1016; recorded in docs/differences-from-r.md). Products of exactly 2^-1022, or just above it, keep the plain sum, so sums of normal products keep their bits. A test has been added. (Not pushed yet.)
