# Issue #428 log: rtriang with an infinite endpoint

GitHub Issue #428. Session 13, group A (extraDistr's infinite parameters, the rule of issue 92).

## Plan

- Intent: `rtriang` returned NaN without a draw for an infinite a or b; extraDistr rejects only NaN, a > c, c > b and a == b, draws two uniforms and evaluates its formula (Inf for `rtriang(1, 0, Inf, 1)`, NaN for the other infinite cases).
- Method (the user's decision on issue 92: the random values follow the quantile function, and the uniforms extraDistr draws are drawn): reject without a draw only what extraDistr rejects (`!(a < b && a <= c && c <= b)`, which includes NaN); with an infinite endpoint draw the two uniforms and return NaN, as `qtriang` (NaN for every infinite endpoint here). Finite endpoints: the same code and bits.

## Check (main `068bd35`)

extraDistr (R 4.5.2), `set.seed(1)`, uniforms drawn from the next `runif(1)`:

| call `rtriang(1, a, b, c)` | extraDistr | qtriang (rStats.js) | before | after |
|---|---|---|---|---|
| (0, Inf, 1) | Inf, 2 drawn | NaN (extraDistr's qtriang NaN) | NaN, 0 drawn | NaN, 2 drawn |
| (-Inf, 0, -1) | NaN, 2 drawn | NaN (extraDistr's -Inf) | NaN, 0 drawn | NaN, 2 drawn |
| (-Inf, Inf, 0), (0, Inf, Inf), (0, Inf) (c = Inf), (-Inf, 0, -Inf) | NaN, 2 drawn | NaN | NaN, 0 drawn | NaN, 2 drawn |
| (-Inf, Inf) (c NaN), (Inf, Inf, Inf), (0, 1, 2), (0, 1, NaN) | NA, 0 drawn | | NaN, 0 drawn | the same |
| `rtriang(2, 0, 2, 1)` | 0.6376326, 1.4810612; 4 drawn | | the same | the same |

## Fix

- `src/random/extra.ts`, `rtriang`: the finiteness check moved after the two uniforms.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: an infinite endpoint is NaN (extraDistr Inf for b = Inf with a finite c), next to the issue 92 sentence.

## Tests

- `test/issue428.test.ts`: the rows above. With `src/` stashed, 1 of 2 tests fails.
- `test/random.test.ts` (extraDistr fixture), `test/locationScaleExtremes.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- extraDistr's `qtriang(p, -Inf, 0, -1)` is -Inf (the limit), rStats.js's NaN; d, p and q are NaN for any infinite endpoint here. Not changed (the issue 92 rule ties the random values to q as it is).

## close comment

Fixed in <commit of #428, see git log --grep='#428'>: `rtriang` now rejects without a draw only what extraDistr rejects (NaN, a > c, c > b, a == b). With an infinite endpoint it draws the two uniforms extraDistr draws and returns NaN, as `dtriang`, `ptriang` and `qtriang` do here; extraDistr gives Inf for `rtriang(1, 0, Inf, 1)` and NaN for the other infinite cases. This follows the rule adopted for issue 92 (the random values follow the quantile function, the stream follows extraDistr) and is recorded in docs/differences-from-r.md. Finite endpoints are unchanged.

Test: test/issue428.test.ts. (Not pushed yet.)
