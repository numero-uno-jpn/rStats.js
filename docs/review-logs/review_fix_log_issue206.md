# Issue #206 log: crossprod and tcrossprod where products of finite entries overflow

GitHub Issue #206. Session 11, group A6 (linear algebra).

## Plan

- Intent: `crossprod` and `tcrossprod` sum the products `a[k] * b[k]` directly. For finite entries such as ±1e200 the products overflow and cancel (1e400 - 1e400), so the off-diagonal entries are NaN although the exact value 0 is representable. `matMul` already has a fallback for this (`rescaledDot`, review 49), so `crossprod(x)` and `matMul(t(x), x)` disagreed.
- Method: only where the plain sum is not finite, take the entry again with the fallback that `matMul` uses. The fallback is moved from `src/linalg/ops.ts` to a small shared module `src/linalg/dot.ts` and takes the two vectors instead of a row and a column index, so that `matMul`, `crossprod` and `tcrossprod` call the same function. (A later group is planned to replace its body with an exact inner product for #195 and #208; the three callers will follow.)
- Why this: the same receptacle as `matMul`, with no change where the plain sum is finite (the same bits). Infinite or NaN entries keep the plain sum, as in `matMul`.
- R gives NaN (checked with R 4.5.2), so the new value is recorded in docs/differences-from-r.md and docs/ja (the existing `%*%` row is extended).

## Check (main `236e9d8`)

| call | R 4.5.2 | Before | After |
|---|---|---|---|
| `crossprod(x)`, `x = [[1e200, 1e200], [1e200, -1e200]]` | [[Inf, NaN], [NaN, Inf]] | [[Inf, NaN], [NaN, Inf]] | [[Inf, 0], [0, Inf]] |
| `tcrossprod(x)`, `crossprod(x, x)`, `tcrossprod(x, x)` | the same NaN | the same NaN | 0 off the diagonal |
| `t(x) %*% x` / `matMul(t(x), x)` | NaN off the diagonal | 0 off the diagonal | (unchanged) 0, now equal to `crossprod(x)` |
| `crossprod(c(1e200, 1e200), c(1e200, -1e200))` | | NaN | 0 |
| a NaN or Inf entry in the columns | | NaN | NaN (unchanged) |
| finite sums (`crossprod([[1, 2], [3, 4]])`, a mix with 1e200) | | | the same bits |

## Fix

- `src/linalg/dot.ts` (new): `rescaledDot(u, v, s)`, moved from `src/linalg/ops.ts` unchanged except for its arguments.
- `src/linalg/ops.ts` (`matMul`): calls it with the row and the column of b.
- `src/linalg/basic.ts` (`crossprod`, `tcrossprod`): an entry whose plain sum is not finite goes through `rescaledDot` with the two columns (rows).

## Tests

- `test/issue206.test.ts`: the issue's matrices (0 off the diagonal, Inf on it), agreement with `matMul(t(x), x)` and `matMul(x, t(x))`, NaN and Inf entries unchanged, finite sums unchanged. With `src/linalg/basic.ts` and `ops.ts` stashed the first two tests fail.
- `npx vitest run` (with this fix and #191): 319 files passed (2710 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- The fallback divides by powers of 2 and sums in double, so cancellation between large products can still leave rounding noise or lose small terms (#195, #208). That is the planned exact inner product of the next group.

## close comment

Fixed in <commit of #206, see git log --grep='#206'>: `crossprod` and `tcrossprod` now take an entry whose plain sum is not finite again from the factors divided by powers of 2, with the same fallback as `matMul` (moved to a shared helper). `crossprod([[1e200, 1e200], [1e200, -1e200]])` and the same `tcrossprod` are now [[Inf, 0], [0, Inf]] (the off-diagonal entries were NaN, as in R), and they agree with `matMul(t(x), x)`. Entries whose plain sum is finite are unchanged, and NaN or infinite entries still give NaN.

Test: test/issue206.test.ts. (Not pushed yet.)
