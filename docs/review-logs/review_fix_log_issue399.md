# Issue #399 log: the third derivative of splinefunH where h^2 overflows

GitHub Issue #399. Session 13, group 5b (evalHermite).

## Plan

- Intent: the third-derivative branch of `evalHermite` divides by `h * h`. For h = 1e200 the square is Infinity and the result 0, for h = 2^-600 it is 0 and the result Infinity, although the quotient is in range.
- Method (fallback only): where h^2 is not a normal number, `num / h / h`. Where it is, the same expression as before (the same bits). If num / h overflows the exact quotient (num / h^2 with h < 1) overflows too, and with h > 1, num / h is smaller than num.

## Check (main after #402, R 4.5.2)

| call | R | before | after | exact |
|---|---|---|---|---|
| `splinefunH([0, 1e200], [0, 0], [1e200, 1e200])(5e199, 3)` | 12 | 0 | 1.2e-199 | 1.2e-199 (nearest double) |
| `splinefunH([0, 2^-600], [0, 0], [2^-1000, 2^-1000])(2^-601, 3)` | 4.6e-120 | Infinity | 12 2^200 | 12 2^200 |
| `splinefunH([0, 2], [0, 1], [1, 3])(1, 3)` | 9 | 4.5 | the same | 4.5 |
| `splinefunH([0, 3], [1, 2], [0.5, 0.25])(1, 3)` | 1/6 | 1/18 | the same | 1/18 |

R divides the third derivative by h once (already recorded in docs; the values agree only for h = 1), so R is not a reference here. The exact values are the derivatives of the Hermite cubic of the given doubles, computed in BigInt rationals (scratch script); the values for h = 2 and 3 confirm that the JS third derivative is right for h other than 1.

## Fix

- `src/numerics/interp.ts` `evalHermite`, deriv 3.
- docs (en, ja): a row in the overflow table.

## Tests

- `test/issue399.test.ts`: the first three rows above. With `src/` stashed the first test fails.
- `issue125`, `issue380`, `numerics`, `jstat-replacement`: pass. `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #399, see git log --grep='#399'>: where h^2 is not a normal number, the third derivative in `evalHermite` (splinefunH, monoH.FC) now divides by h twice. `splinefunH([0, 1e200], [0, 0], [1e200, 1e200])([5e199], 3)` is 1.2e-199 (was 0; R gives 12 because it divides the third derivative by h only once, recorded in docs/differences-from-r.md). Where h^2 is in range the values are unchanged. Test: test/issue399.test.ts. (Not pushed yet.)
