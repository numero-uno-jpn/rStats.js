# Issue #498 log: optimHess with an analytic gradient whose scaling overflows

GitHub Issue #498. Session 14, group A2. Fixed: the analytic gradient is divided by `fnscale` first where its product with `parscale` overflows.

## Plan

- Intent: `Scaled.g()` scales `gr` as `(v * parscale) / fnscale`; the product can overflow while the scaled gradient is finite, and `optimHess` then takes Inf - Inf.
- Method: keep `(v * parscale) / fnscale` where the product is finite, and use `(v / fnscale) * parscale` only where it is not.
- Why: a fallback that acts only on a non-finite product keeps every value computed before to the bit (K3). R gives NaN here as well, so the difference is recorded in the docs.

## Reproduction (main `72faf79`, R 4.5.2)

| Call | R | rStats.js before |
|---|---|---|
| `optimHess(0, function(x) 1e200 * x, function(x) 1e200, control = list(parscale = 1e200, fnscale = 1e300))` | [[NaN]] | [[NaN]] |

The true Hessian is 0 (a constant gradient). R's `fmingr` scales in the same order (`df[i] * parscale[i] / fnscale`), so R is wrong in the same range.

## Fix

- `src/optim/optim.ts`, `Scaled.g()` (analytic gradient): `w = v * parscale`; if `w` is finite, `w / fnscale` as before, otherwise `(v / fnscale) * parscale`. The issue's call gives [[0]]. `optim`'s BFGS, CG and L-BFGS-B use the same path.
- Docs: a row in "Where R fails and rStats.js returns a value" (en, ja).

## Tests

- `test/issue498.test.ts`: the issue's call gives [[0]]; a two-parameter Hessian with `parscale` (2, 3) and `fnscale` 5 keeps its values (those of the code before the fix). With `src/` stashed, the first test fails.
- `test/optim.test.ts`, `test/optim/`, `test/issue248.test.ts`, `test/issue355.test.ts` pass.

## Out of scope (recorded)

- The product `v * parscale` can also underflow to 0 or a subnormal while the scaled gradient is normal (v = 1e-200, parscale = 1e-200, fnscale = 1e-300). Not changed: the fallback acts only on a non-finite product, as planned.
- The numerical gradient divides `fn` by `fnscale` after evaluating it and is not concerned.

## close comment

Fixed in <commit of #498, see git log --grep='#498'>. The analytic gradient was scaled as (gr · parscale) / fnscale, whose product overflows in the issue's call although the scaled gradient (1e100) is finite. Where that product is not finite, the gradient is now divided by fnscale first: the issue's call gives [[0]]. Where the product is finite the order is unchanged, so ordinary results keep their bits. R 4.5.2's optimHess also returns NaN here (its fmingr uses the same order), so this is recorded in docs/differences-from-r.md. A test was added: test/issue498.test.ts. (Not pushed yet.)
