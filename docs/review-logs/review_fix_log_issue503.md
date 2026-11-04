# Issue #503 log: optimHess's difference quotient overflowed

GitHub Issue #503. Session 15, group A2. Fixed: `optimHess` (`hessianOf` in `src/optim/optim.ts`) formed fnscale (g+ − g−) / (2 step ps_i ps_j) directly; the denominator product or the difference of the scaled gradients overflows where the Hessian is representable.

## Plan

- Intent: return the representable Hessian when only an intermediate of the quotient overflows (or the denominator underflows).
- Method: keep the direct quotient when the numerator, the denominator and the quotient are finite (K3, same bits); otherwise form it from the factors (g+/2 − g−/2, fnscale, step, ps_i, ps_j), each scaled to [1, 2) by a power of 2, with the exponents added back at the end (`ldexpWide`). A factor of 0 or not finite keeps the direct value.
- Why: the scaled form has no intermediate overflow or underflow; the condition only fires where the direct value is 0/Inf/NaN from an overflowed intermediate. R is wrong in the same way (K2), so the difference is documented. This is next to #498 (`Scaled.g`), which is a different step.

## Reproduction (main `53ee5d7`, R 4.5.2)

| call | R `optimHess` | rStats.js before | after |
|---|---|---|---|
| A: 0.5e-200 x², gr 1e-200 x, parscale 1e200, ndeps 1e200 | 0 | [[0]] | 1e-200 |
| B: 0.5e8 x², gr 1e8 x, parscale 1e200, ndeps 1e100 | Inf | [[Inf]] | 1e8 |
| 1e-200 x0 x1, parscale 1e200, ndeps 1e200 (off-diagonal) | 0 | 0 | 1e-200 |

## Fix

- `src/optim/optim.ts`: `hessianOf` uses `scaledQuotient` only when the direct numerator, denominator or quotient is not finite. docs (en, ja): a row next to #498.

## Tests

- `test/issue503.test.ts`: A, B and the off-diagonal case, relative error < 1e-15. With `src/` stashed all three fail.
- `test/optim.test.ts`, `test/optim/`, `issue248`, `issue354`, `issue355`, `issue498` pass (ordinary bits unchanged).

## Out of scope (recorded)

- Without `gr`, case B throws "non-finite finite-difference value [1]" from the numerical gradient (f(±1e100) = 5e207 is finite, but the scaled difference overflows). That is the numerical gradient in `Scaled.g`, not this quotient; not changed here.

## close comment

Fixed in <commit of #503, see git log --grep='#503'>. optimHess now forms the central-difference quotient from factors scaled by powers of 2 when the direct form overflows: the issue's case A gives 1e-200 (before 0) and case B 1e8 (before Inf). R 4.5.2's optimHess gives 0 and Inf as well; the difference is documented in differences-from-r. Ordinary inputs keep their bits. A test was added: test/issue503.test.ts. (Not pushed yet.)
