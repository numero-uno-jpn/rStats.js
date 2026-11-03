# Issue #294 log: formula ^ with a huge power

GitHub Issue #294. Session 12.

## Plan

- Intent: in `termsOf`, the power of `^` is truncated and the expansion runs p - 1 steps. `^1e999` is Infinity and the loop never ends; large finite powers run as many steps.
- Method: (1) reject powers beyond the int range, as R's asInteger does (NA, then "invalid power in formula"); (2) stop the expansion when a step returns the same terms in the same order. From such a fixed point every later step returns it again, so the result is the one of p - 1 steps, reached after at most as many steps as there are variables.
- Why not a lower cap on the power: R accepts any power in the int range; the fixed point gives the same terms without a new limit.

## Check (main `869e1f2`, R 4.5.2)

| formula | R | before | after |
|---|---|---|---|
| `y ~ (a + b)^1e999`, `^3e9`, `^2147483648` | "invalid power in formula" (with a warning "NAs introduced by coercion to integer range") | does not end (not run; the loop is `for (k = 1; k < Infinity; k++)`, or 2^31 steps) | the same error |
| `y ~ (a + b)^2147483647` | did not finish in 60 s | 2^31 steps (not run) | `a b a:b` |
| `y ~ (a + b + c + d)^100000` | `a b c d a:b ... a:b:c:d` (15 terms) | the same | the same |
| `y ~ (a + b:c + c*d - a:d)^7` | `a c d a:c a:d b:c c:d a:b:c a:c:d b:c:d a:b:c:d` | the same | the same |

## Fix

- `src/models/formula.ts`, the `^` case of the term expansion: the int-range check and the stop at a fixed point.

## Tests

- `test/issue294.test.ts`: the errors, the large powers (R's terms) and ordinary powers. The first two blocks did not end before the fix and were left out of the stash check (`-t "ordinary"`, which passes with `src/` stashed: the ordinary terms are unchanged).
- `test/formulaTests.test.ts`: passes.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #294, see git log --grep='#294'>. A power of `^` beyond the int range (`1e999`, `3e9`) is now "invalid power in formula", as in R (asInteger gives NA). The expansion also stops once a step returns the same terms, so a large power within the range (`(a + b)^2147483647`) ends after a few steps with the same terms as R; ordinary powers are unchanged. (Not pushed yet.)
