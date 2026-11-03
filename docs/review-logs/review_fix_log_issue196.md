# Issue #196 log: predict(lm) overflows the transformed predictor before multiplying by a small residual standard error

GitHub Issue #196. Session 11, group A7 (lm).

## Plan

- Intent: the standard error in `predict` for lm is ||z|| sigma with z = R^-T x by forward substitution. z can overflow (or fall below the normal range) while ||z|| sigma is in range: with the column (1e-200, 2e-200, 3e-200) and sigma 4.2e-201, z at x = 1e200 is about 1e400, so the se was Infinity although it is 1.13e199.
- Method: only where ||z|| is not finite, below the normal range or 0 while x is finite and not all 0, solve again with x divided by 2^e (e the binary exponent of the largest |x_j|; by 2^600 more if that still overflows) and form ||z'|| sigma 2^e from the mantissas and exponents, so that no step overflows or underflows. z is linear in x and division by a power of 2 is exact, so this is the same quantity.
- Why this: rows whose ||z|| was a normal finite number keep their bits (the fallback is not entered); a NaN or infinite entry of x, or x = 0, keeps the value it gave. The triage's "rescale x by a power of 2" is used; the underflow side (z below the normal range, where the se was 0 or lost bits) is included because it is the same computation in the other direction.

## Check (main `90840cf`)

| call | R 4.5.2 | Before | After | Rmpfr |
|---|---|---|---|---|
| `lm([1e-200, 2e-200, 3e-200], [1e-200, 2e-200, 4e-200], { intercept: false })` sigma | 0 (underflows) | 4.225771273642581e-201 | (unchanged) | 4.2257712736425828e-201 |
| `predict(fit, [1e200]).seFit` | NaN | Infinity | 1.1293848786315636e199 (`0x1.2e2c22af56119p+661`) | 1.12938487863156401e199 (`0x1.2e2c22af5611bp+661`) |
| `predict(fit, [1]).seFit` | NaN | 0.11293848786315636 | (unchanged) | `0x1.ce98967d4faa8p-4` (rStats.js 4 ulp below, as before) |
| `predict(lm([1e200, 2e200, 3e200], [1e100, 2e100, 4e100], { intercept: false }), [1e-200]).seFit` | 0 | 0 | 1.129384878631563e-301 | |
| the same fit at x = 1 | 0 | 1.129384878631563e-101 | (unchanged) | |
| x = 0, NaN, Infinity | | 0, NaN, Infinity | (unchanged) | |

The new values are 2 ulp from Rmpfr, the accuracy of the unchanged value at x = 1 (the solve at 1e200 is the solve at x divided by 2^664, exactly). The prediction intervals at 1e200 are finite. R differs (its residual variance underflows, and its se is formed from XRinv^2 sigma^2, which underflows), recorded in docs/differences-from-r.md and docs/ja.

## Fix

- `src/models/lm.ts` (`predict`): the forward substitution as a function `forward`; the fallback above; `scaledProduct(a, b, s)` forms a b 2^s from the mantissas and exponents.

## Tests

- `test/issue196.test.ts`: the issue's prediction (also with a prediction interval), the underflow case, and unchanged values at x = 1, 0, NaN and Infinity. With `src/` stashed two of the three tests fail.
- `npx vitest run`: 325 files passed (2728 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #196, see git log --grep='#196'>: where R^-T x overflows (or falls below the normal range) although x is finite, `predict` for lm now solves again with x divided by a power of 2 (z is linear in x; the division is exact) and multiplies ||z|| by sigma and the power of 2 in exponent form. For the issue's fit, `predict(fit, [1e200]).seFit` is now 1.1293848786315636e199 (it was Infinity; R gives NaN, its residual standard error underflowing to 0), 2 ulp from the Rmpfr value 1.12938487863156401e199, and the intervals are finite. The opposite case, a fit on a column of 1e200 predicted at 1e-200, gives 1.129384878631563e-301 instead of 0. Rows whose transformed predictor was in range keep their bits. Recorded in docs/differences-from-r.md.

Test: test/issue196.test.ts. (Not pushed yet.)
