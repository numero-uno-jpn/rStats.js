# Issue #203 log: TukeyHSD with a confidence level outside [0, 1]

GitHub Issue #203. Session 11, group A1 (input checks).

## Plan

- Intent: `TukeyHSD` passed `confLevel` straight to `qtukey`, so 1.2, -0.1, NaN or Infinity gave a result whose `lwr` and `upr` were NaN, with no sign that the input was invalid.
- Method: call the existing `checkConfLevel` (`src/htest/types.ts`: finite and in the closed [0, 1]) before the quantile.
- Why closed and not open (the issue proposes (0, 1)): R 4.5.2 gives meaningful limits at 0 (lwr = upr = diff) and 1 (-Inf, Inf), and rStats.js already gave the same. Only the levels where R returns NaN are rejected, under the policy "meaningless input is an error". This is the rule `tTest`, `brunnerMunzelTest` and the one-sample `poissonTest` use.
- Expected effect: valid levels keep their bits; invalid ones throw a RangeError.

## Check (main `c2a515a`; R 4.5.2)

Data: groups (1, 2, 3) and (2, 3, 4) (R: `aov(y ~ g)`).

| conf.level | R 4.5.2 | Before | After |
|---|---|---|---|
| 1.2 | lwr, upr NaN (warning "NaNs produced"), p adj 0.2878644 | lwr, upr NaN | RangeError |
| -0.1 | NaN (same warning) | NaN | RangeError |
| NaN | NaN | NaN | RangeError |
| Infinity | (not run) | NaN | RangeError |
| 0 | lwr = upr = 1 | 1, 1 | unchanged |
| 1 | -Inf, Inf | -Inf, Inf | unchanged |

The issue says the adjusted p-values were NaN too; they were not (p adj does not depend on the level), in R or here.

## Fix

- `src/htest/aov.ts`: `checkConfLevel(confLevel)` in `TukeyHSD`; the option's doc comment says [0, 1].
- Docs: `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`, added to the list of meaningless inputs that are errors.

## Tests

- `test/issue203.test.ts`: the invalid levels throw; 0, 1 and the default keep R's limits. With src stashed the first test fails.
- The test files that use `TukeyHSD`: 340 passed. `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #203, see git log --grep='#203'>: `TukeyHSD` now throws a RangeError for a `confLevel` that is not a number in [0, 1] (1.2, -0.1, NaN, Infinity), where it returned NaN limits (R 4.5.2 does the same, with a warning "NaNs produced" for 1.2). The levels 0 and 1 are still accepted, as in R and in `tTest`: they give lwr = upr = diff and (-Inf, Inf). The adjusted p-values were not NaN in the issue's example (they do not depend on the level). Recorded in docs/differences-from-r.md. Test: test/issue203.test.ts. (Not pushed yet.)
