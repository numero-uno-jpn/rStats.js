# Issue #260 log: nonEstimableRows counts a row as estimable where the dot product and the norms overflow

GitHub Issue #260. Session 11, group P7 (user decision B4 of the third round: normalize by powers of 2).

## Plan

- Intent: `nonEstimableRows` (used by `predict` for lm and by `glmPredict` with new data) flags a row x when abs(x · v) > sqrt(eps) |x| |v| for a null-space vector v. With x of 1e308, the plain dot product and the product of the norms both overflow to Infinity, `Infinity > Infinity` is false, and a row that is not estimable counts as estimable (the warning is lost although the prediction itself is finite).
- Method (the user's decision, option (a) of the preparation): divide x and each basis vector by the power of 2 that brings its largest entry into [1, 2) (`scaleToUnit`) before the dot product and the norms.
- Why this: the test is dimensionless, so it can be made in normalized units (the common rule of HANDOFF). Multiplying by a power of 2 is exact, and `Math.hypot` scales with it, so wherever nothing overflowed or underflowed the comparison is the same; the other options (treating a non-finite comparison as not estimable) misjudge rows such as (1.5e308, -1.5e308, 0, 0) whose dot product is 0 and only the norm overflows.
- R agrees with the new result (warning and `non-estim` 1), so no entry in docs/differences-from-r.md.

## Check (main `12b8aea`)

Null space of the issue's `qr` spanned by (1, 1, 1, 1):

| row | Before | After | R 4.5.2 (lm of the same structure) | Correct |
|---|---|---|---|---|
| (1e308, 1e308, 1e308, 1e308) | [] (estimable) | [0] | non-estim 1 and the warning | not estimable |
| (1e200 x 4), (1 x 4), (1, 1, 1, 1e-300) | [0] | [0] | | not estimable |
| (1e308, -1e308, 0, 0), (1.5e308, -1.5e308, 0, 0) | [] | [] | estimable | estimable |
| a NaN or infinite entry | [] | [] | | |

`predict(lm(y ~ 0 + a + b + c + d))` with d = -(a + b + c) at newdata 1e308 x 4: the fit 1.0221800433839477e308 (R `0x1.232064ebc705dp+1023`, the same value) is unchanged; it now carries `nonEstimable: [0]` and R's warning.

A sweep of 300 random rank-deficient designs (6000 rows, half of them not estimable, scales 1e-150 to 1e150) gave the same judgements before and after.

## Fix

- `src/models/estimable.ts` (`nonEstimableRows`): each basis vector and each row scaled by `scaleToUnit` before the dot product and the norms.

## Tests

- `test/issue260.test.ts`: the issue's row, the lm prediction with its warning, and unchanged judgements (normal range, orthogonal rows whose norm overflows, NaN and Inf). With `src/` stashed the two tests of the new judgement fail and the unchanged ones pass.
- `npx vitest run`: 328 files passed (2736 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #260, see git log --grep='#260'>: `nonEstimableRows` now divides the row and each null-space vector by the power of 2 that brings its largest entry into [1, 2) before comparing abs(x · v) with sqrt(eps) |x| |v|. The test does not depend on the units, and the division is exact, so judgements where nothing overflowed are unchanged (a sweep of 6000 rows agreed). For the issue's example, `nonEstimableRows(q, 3, [[1e308, 1e308, 1e308, 1e308]])` is now [0] (it was []); `predict` for the corresponding lm fit now carries `nonEstimable: [0]` and the rank-deficiency warning, as R does. A row such as (1e308, -1e308, 0, 0), orthogonal to the null space, stays estimable (R too).

Test: test/issue260.test.ts. (Not pushed yet.)
