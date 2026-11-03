# Issue #412 log: rmultinom's fractional size and n

GitHub Issue #412. Session 13, group A (input checks in random, as R).

## Plan

- Intent: R's `do_rmultinom` converts n and size with `asInteger` (truncation toward zero) and then rejects negative values. rStats.js rejected a fractional size and an n or size in (-1, 0). Make it R's: the same rule as issues 93 and 94 (truncate, then check).
- Method: reject only a non-finite size, size <= -1 or size >= 2^31 (the truncated value outside 0..2^31 - 1), then use trunc(size); n likewise rejects only n <= -1. No docs entry (the same as R).

## Check (main `33bc5bf`)

R 4.5.2, `set.seed(1)`, the number of uniforms drawn from the next `runif(1)`:

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `rmultinom(1, 2.5, c(0.5, 0.5))`, size 2.9 | (1, 1), 1 drawn (as size 2) | error | the same as R |
| `rmultinom(2.7, 3.7, c(0.2, 0.3, 0.5))` | (0, 1, 2), (1, 2, 0), 4 drawn | error | the same as R |
| `rmultinom(-0.5, 2, ...)` | no columns, 0 drawn | error | [], 0 drawn |
| `rmultinom(1, -0.5, ...)`, `rmultinom(2, -0.9, ...)` | zeros, 0 drawn | error | zeros, 0 drawn |
| `rmultinom(1, 2147483647.5, ...)` | sums to 2147483647 | error | sums to 2147483647 |
| size -1, NaN, 2^31; n -1, -1.5 | "invalid ... argument" | error | error |

## Fix

- `src/random/binomial.ts`, `rmultinom`: size checked as `size <= -1 || size >= 2147483648` and truncated (`Math.max(0, Math.trunc(size))`, so -0.5 gives +0); n checked as `n <= -1`. The error message keeps "up to 2147483647".

## Tests

- `test/issue412.test.ts`: the rows above. With `src/` stashed, all 3 tests fail.
- `test/random.test.ts`, `test/locationScaleExtremes.test.ts`, `test/review50.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #412, see git log --grep='#412'>: `rmultinom` now truncates `n` and `size` toward zero before checking them, as R's `asInteger`. `rmultinom(1, 2.5, [0.5, 0.5])` is a size-2 draw (`[[1, 1]]` after `setSeed(1)`, one uniform drawn, as R), an n or size in (-1, 0) gives no draws or zero counts without drawing, and size -1, NaN or 2^31 and n -1 are still errors, as in R.

Test: test/issue412.test.ts. (Not pushed yet.)
