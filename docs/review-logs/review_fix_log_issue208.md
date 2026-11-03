# Issue #208 log: matMul's fallback loses the remainder after large products cancel

GitHub Issue #208. Session 11, group B1 (user decision: an exact inner product for #195 and #208).

## Plan

- Intent: where the plain sum of an entry is not finite, `matMul` (and since #206 `crossprod` and `tcrossprod`) takes the entry again with `rescaledDot`, which divides each vector by the power of 2 of its largest entry and sums in double. A product more than 2^1074 below the largest is lost in the division, so `matMul([[1e308, 1e308, 1e-308]], [[1e308], [-1e308], [1e308]])` gave 0: the two large products cancel exactly and the lost term is the whole result.
- Method (the user's decision, option (b) of the preparation): replace the body of `rescaledDot` (`src/linalg/dot.ts`) with an exact inner product. Each finite factor is split into an integer mantissa and a power of 2 (subnormals included), each product is an exact BigInt times a power of 2, the products are summed exactly in BigInt, and the sum is rounded once to the nearest double (ties to even, subnormal results, overflow to Infinity).
- Why this: it is still reached only where the plain sum is not finite, so every entry whose plain sum is finite keeps its bits. Inside the fallback the result is the correctly rounded exact value, so no term is lost however far below the largest it is, and the three callers (and `predict` for lm, #195) share it. BigInt is only used in this fallback (about 0.8 ms for a length of 1000 in the preparation).
- R gives NaN (`%*%` and `crossprod`, R 4.5.2), so the docs row of #206 is extended.

## Check (main `0353659`)

| call | R 4.5.2 | Before | After | True value (Rmpfr) |
|---|---|---|---|---|
| `matMul([[1e308, 1e308, 1e-308]], [[1e308], [-1e308], [1e308]])` (also `crossprod`, `tcrossprod` of the vectors) | NaN | 0 | 0.9999999999999999 (`0x1.fffffffffffffp-1`) | 0.99999999999999992030... = the double product 1e-308 * 1e308 (`0x1.fffffffffffffp-1`) |
| `matMul([[3e200, 1e200]], [[1e108], [-2.9e108]])` (review 49, LINALG-004) | NaN | 1.0000000000000016e307 | 1.0000000000000002e307 (the exact sum of the double products, rounded once) | |
| `matMul([[1e308, 1e308]], [[1e308], [-1e308]])`, `crossprod` of #206 | NaN | 0 | 0 (unchanged) | 0 |
| a sum that overflows itself, an infinite factor | Inf, NaN | Inf, NaN | Inf, NaN (unchanged) | |
| finite plain sums | | | the same bits (the fallback is not reached) | |

The issue's expected "1" is the decimal value; in doubles 1e-308 * 1e308 is just below 1, and that is the exact value of the dot product of the given doubles.

## Fix

- `src/linalg/dot.ts`: `rescaledDot(u, v, s)` keeps its arguments and its condition (with a factor that is not finite, s is returned as it is); its body is now the exact sum described above (`splitDouble`, rounding by shifting the BigInt sum to 53 bits or to the bit 2^-1074, `scaleExact` for the power of 2 in two steps so that no step underflows).

## Tests

- `test/issue208.test.ts`: the issue's product through `matMul`, `crossprod` and `tcrossprod`; rounding once (a tie at 2^-1075 to 0, 1.5 * 2^-1074 to 2^-1073, a subnormal remainder, `Number.MAX_VALUE`); the LINALG-004 example; overflow, infinite factors and finite sums as before. With `src/` stashed the first two tests fail.
- `test/review49.test.ts` (LINALG-004 uses `toBeCloseTo(0, 13)`) and `test/issue206.test.ts` pass unchanged.
- `npx vitest run`: 320 files passed (2713 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- Where the plain sum is finite, it keeps the rounding of left-to-right summation (as R); only the fallback is exact.

## close comment

Fixed in <commit of #208, see git log --grep='#208'>: the fallback that `matMul`, `crossprod` and `tcrossprod` use where the plain sum of an entry is not finite now forms the inner product exactly (each product as an integer times a power of 2, summed in BigInt) and rounds it once. `matMul([[1e308, 1e308, 1e-308]], [[1e308], [-1e308], [1e308]])` is now 0.9999999999999999 (it was 0; R gives NaN). That is the double product 1e-308 * 1e308, the exact value for these doubles (Rmpfr agrees to the bit), so the "1" in the issue is its decimal rounding. Entries whose plain sum is finite are unchanged, and a sum that overflows or an infinite factor gives Inf or NaN as before. Recorded in docs/differences-from-r.md.

Test: test/issue208.test.ts. (Not pushed yet.)
