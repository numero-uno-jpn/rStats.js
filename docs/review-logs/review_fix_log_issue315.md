# Issue #315 log: TukeyHSD with fewer than 2 residual degrees of freedom

GitHub Issue #315. Session 12.

## Plan

- Intent: with one value per group the residual df N - k is 0, the MSE is 0 / 0 and every limit and p-value was NaN. There is no residual variance, so the comparison has no meaning (policy: input without meaning is an error; review 60 made a residual df of 0 an error in `tukeyTest`, `dunnettTest` and `glhtDunnett`).
- Method: `df === 0` throws "no residual degrees of freedom" (the message of `tukeyTest`). Other designs take the old code (the same bits).
- df = 1 (the issue's second example) is not changed: the studentized range is defined there, but `ptukey` and `qtukey` (R's too) return NaN for df < 2. That was decided later (the follow-up below).

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

## Follow-up: df = 1 (session 12, user decision 10)

### Plan

- Intent: with 1 residual degree of freedom `ptukey` and `qtukey` return NaN (R's too: the algorithm starts at df 2), so `TukeyHSD([[1, 2], [3]])` returned NaN limits and p-values, and `tukeyTest` NaN p-values. The studentized range with 1 df is defined, but not computed by these functions.
- User decision (2026-11-03): an error for df < 2 in `TukeyHSD`, and the same check in the other studentized-range tests. Extending `ptukey`/`qtukey` to df 1 is left as a later improvement.
- The tests using `ptukey`/`qtukey` are `TukeyHSD` (src/htest/aov.ts), `tukeyTest`, `dscfAllPairsTest` (df Infinity) and `gamesHowellTest` (src/htest/multipleComparisons.ts). There is no glht with Tukey contrasts (`glhtDunnett` uses the multivariate t). The check is added to `TukeyHSD` and `tukeyTest`, which have one residual df N - k. `dunnettTest` shares `pooled()` but uses the multivariate t, so the check is in `tukeyTest`, not in `pooled()`. `gamesHowellTest` is not changed (below).

### Check (main `1bcc3ed`, R 4.5.2, PMCMRplus)

| call | R | before | after |
|---|---|---|---|
| `TukeyHSD([[1, 2], [3]])` | diff 1.5, lwr, upr, p NaN | the same NaN | RangeError "the studentized range needs at least 2 residual degrees of freedom" |
| `tukeyTest([1, 2, 3], ["a", "a", "b"])` | statistic NA, p NA | statistic 2.449, p NaN | the same RangeError |
| `tukeyTest([1, 2, 3, 4], ["a", "a", "b", "c"])` | p NA | p NaN | the same RangeError |
| `TukeyHSD([[1, 2], [3, 5]])`, `tukeyTest([1, 2, 3, 5], ["a", "a", "b", "b"])` (df 2) | | p 0.15484574527148343 | unchanged |

### Fix

- `src/htest/aov.ts` (`TukeyHSD`) and `src/htest/multipleComparisons.ts` (`tukeyTest`): `df < 2` throws (after the df 0 check).
- docs (en, ja): the df 1 case next to the df 0 one.

### Tests

- `test/issue315.test.ts`: the errors for df 1 (both functions, samples and labels) and the df 2 value of `tukeyTest`. With `src/` stashed, the df 1 test fails.
- `anova`, `issue203`, `jstat-replacement`, `mcompPMCMR`, `numberLevels`, `review60`, `scaleInvariance`, `scaleInvarianceAll`, `errors`: pass.

### Pending decision (gamesHowellTest)

`gamesHowellTest` takes a Welch-Satterthwaite df for each pair, at least min(n_i, n_j) - 1, so with groups of 2 it is between 1 and 2 and `ptukey` gives NaN for that pair: `gamesHowellTest([1, 2, 3, 7, 5, 6], ["a", "a", "b", "b", "c", "c"])` has p NaN for b-a and c-b and 0.0539910002769191 for c-a (PMCMRplus: NaN, NaN, 0.053991). The df is fractional and per pair, so a whole-test error is a different rule from the one decided.

1. RangeError when any pair has df < 2. Pro: no silent NaN. Con: rejects the pairs that are computable (c-a above).
2. Keep NaN for those pairs, as PMCMRplus (now). Pro: the other pairs stay. Con: NaN without explanation.
3. Extend `ptukey` to df in [1, 2) (the later improvement above). Pro: correct values. Con: work, Rmpfr references.

Recommendation: 2 now (record), 3 with the later improvement.

## Out of scope (recorded)

- All constant groups (MSE 0 with df > 0) in `TukeyHSD` are not checked here; review 60 made that an error in `tukeyTest`, `dunnettTest` and `glhtDunnett` only (R's `TukeyHSD` gives p 0).

## close comment

Fixed in <commits of #315, see git log --grep='#315'>. `TukeyHSD` with one value per group (residual degrees of freedom 0) now throws "no residual degrees of freedom", as `tukeyTest` does; the MSE was 0 / 0 and the limits and p-values were NaN (R's `TukeyHSD` gives the same NaN with a warning). With 1 residual degree of freedom (`TukeyHSD([[1, 2], [3]])`) the limits and p-values were also NaN, because `ptukey`/`qtukey` (like R's) start at 2 df; `TukeyHSD` and `tukeyTest` now throw "the studentized range needs at least 2 residual degrees of freedom" (R returns NaN, PMCMRplus NA). Other designs give the same values as before. Recorded in docs/differences-from-r.md.

Test: test/issue315.test.ts. (Not pushed yet.)
