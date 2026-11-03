# Issue #315 log: TukeyHSD with fewer than 2 residual degrees of freedom

GitHub Issue #315. Session 12.

## Plan

- Intent: with one value per group the residual df N - k is 0, the MSE is 0 / 0 and every limit and p-value was NaN. There is no residual variance, so the comparison has no meaning (policy: input without meaning is an error; review 60 made a residual df of 0 an error in `tukeyTest`, `dunnettTest` and `glhtDunnett`).
- Method: `df === 0` throws "no residual degrees of freedom" (the message of `tukeyTest`). Other designs take the old code (the same bits).
- df = 1 (the issue's second example) is not changed: the studentized range is defined there, but `ptukey` and `qtukey` (R's too) return NaN for df < 2. That needs a decision (below).

## Check (main `c51b334`, R 4.5.2)

| call | R's `TukeyHSD(aov(y ~ g))` | before |
|---|---|---|
| `TukeyHSD([[1], [2]])` (df 0) | diff 1, lwr, upr, p NaN, warning "NaNs produced" | the same NaN |
| `TukeyHSD([[1, 2], [3]])` (df 1) | diff 1.5, lwr, upr, p NaN, warning "NaNs produced" | the same NaN (unchanged) |
| `TukeyHSD([[1, 2], [3, 5]])` (df 2) | diff 2.5, lwr -2.306375, p 0.1548045 | lwr -2.310511993647415, p 0.15484574527148343 (unchanged; R's qtukey has a tolerance of 1e-4) |

## Fix

- `src/htest/aov.ts`: the check of `df === 0`.
- `docs/differences-from-r.md` and `docs/ja/`: added to "Input that has no meaning is an error".

## Tests

- `test/issue315.test.ts`: the error for one value per group (samples, and labels) and the values for df 2 (before the fix). With `src/` stashed, the error test fails.
- `test/anova.test.ts`, `test/issue203.test.ts`, `test/review60.test.ts`, `test/numberLevels.test.ts`, `test/errors.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Pending decision (df = 1)

The studentized range distribution with 1 df is well defined (q = range / s with s^2 ~ chi^2_1; Harter's tables include it), but `ptukey` and `qtukey` return NaN for df < 2, as R's do (its algorithm starts at df 2). So `TukeyHSD([[1, 2], [3]])` returns NaN limits and p-values, and so do `tukeyTest` and the other studentized-range tests with df 1.

1. Error for df < 2 in `TukeyHSD` (the issue's request), e.g. "the studentized range needs at least 2 residual degrees of freedom". Pro: no silent NaN; small change. Con: rejects a test that is defined, and differs from `tukeyTest` (NaN at df 1) unless the same check is added there.
2. Keep NaN at df 1, as R (now). Pro: R's behaviour, no change. Con: a structurally successful result full of NaN.
3. Extend `ptukey` and `qtukey` to df = 1 (an accurate integral over the chi distribution with 1 df, heavy-tailed). Pro: the correct value (policy: correct values over R). Con: work and new reference values (Rmpfr); every studentized-range test would change at df 1.

Recommendation: 1 now (with the same check in the other studentized-range tests), and 3 recorded as a later improvement.

## Out of scope (recorded)

- All constant groups (MSE 0 with df > 0) in `TukeyHSD` are not checked here; review 60 made that an error in `tukeyTest`, `dunnettTest` and `glhtDunnett` only (R's `TukeyHSD` gives p 0).

## close comment

Fixed in <commit of #315, see git log --grep='#315'>. `TukeyHSD` with one value per group (residual degrees of freedom 0) now throws "no residual degrees of freedom", as `tukeyTest` does; the MSE was 0 / 0 and the limits and p-values were NaN (R's `TukeyHSD` gives the same NaN with a warning). With 1 residual degree of freedom the limits and p-values are still NaN, because `ptukey`/`qtukey` (like R's) need df >= 2; that case is pending a decision. Other designs give the same values as before. (Not pushed yet.)
