# Issue #402 log: barylag where a product of node differences underflows

GitHub Issue #402. Session 13, group 5a (interpolation fallbacks).

## Plan

- Intent: `barylag` keeps each product prod (x_j - x_k) as m 2^e, but renormalises only after the multiplication, so a product can round to 0 first (nodes 0, 2^-250, 2^-249, 2^-600: 2^-499 times -2^-600). The weight is then 1/0.
- Method (fallback only): where the product of p and the next factor is not a normal number (0, subnormal or infinite) while both are finite and nonzero, both factors are taken as m 2^f and multiplied in that form. Elsewhere the same operations as before (the same bits).
- With the weight fixed, the evaluation still gave Inf / Inf: the weight of node 0 (about 1 after the common shift) divided by the difference 2^-1074 overflows. Where the plain quotient is not finite for finite data, the terms are formed from the products m 2^e and the differences m 2^f and divided by the power of 2 of the largest term (the barycentric quotient does not change). Both parts are needed for a finite value; the issue asks for it ("should return a finite value close to 1").

## Check (main after #398, pracma under R 4.5.2)

| call | pracma | before | after |
|---|---|---|---|
| `barylag([0, 2^-250, 2^-249, 2^-600], [1, 0, 0, 0], [2^-1074])` | NaN | NaN | 1 |
| `barylag([0, 1, 2], [1, 3, 7], [0.5, 1.5])` | | 1.7500000000000002, 4.75 | the same |

The Lagrange basis of node 0 at 2^-1074 is (1 - 2^-824)(1 - 2^-825)(1 - 2^-474), 1 in doubles.

## Fix

- `src/numerics/interp.ts` `barylag`: the product fallback in the weights and the scaled quotient in the evaluation.
- docs (en, ja): a row next to the earlier barylag rows (pracma gives NaN).

## Tests

- `test/issue402.test.ts`: the call above; ordinary values and a 2^-660 scaling of them. With `src/` stashed the first test fails.
- `issue14`, `issue215`, `numerics`, `jstat-replacement`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- With the same nodes and y = x (the identity), `barylag` at 2^-300 is Infinity and at 2^-650 2.14e-196 (2^-650 = 2.2e-196): the terms of nodes 0 and 2^-600 are about ±2^300 times the denominator and cancel. This is the cancellation of the second barycentric form with such nodes, not a range problem; not changed.
- The `@example` of `barylag` says `[1.75, 4.75]`; the value is `[1.7500000000000002, 4.75]` before and after this change. Not changed.

## close comment

Fixed in <commit of #402, see git log --grep='#402'>: where the product of node differences would leave the normal range (it underflowed to 0 before the renormalisation check), both factors are now taken as m 2^f and multiplied in that form, and where the barycentric quotient is not finite for finite data its terms are formed with separate exponents and scaled by the power of 2 of the largest one. `barylag([0, 2 ** -250, 2 ** -249, 2 ** -600], [1, 0, 0, 0], [Number.MIN_VALUE])` is 1 (was NaN, pracma NaN too; recorded in docs/differences-from-r.md). Values whose products stay in range are unchanged. Test: test/issue402.test.ts. (Not pushed yet.)
