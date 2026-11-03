# Issue #320 log: brunnerMunzelTest with a sample of one value

GitHub Issue #320. Session 12.

## Plan

- Intent: `brunnerMunzelTest` required one value per sample, but S_i^2 divides by n_i - 1, so a sample of one value gave a NaN statistic, df, p-value and interval. The test has no meaning there (policy: input without meaning is an error).
- Method: raise the existing checks from n < 1 to n < 2, with the same messages ("not enough 'x' observations", 'y'). Samples of 2 or more take the old code (the same bits). The doc comment said a sample of one value gives NaN as in lawstat; it now says such a sample is an error.

## Check (main `c7c8433`, R 4.5.2, lawstat)

| call | lawstat's `brunner.munzel.test` | before |
|---|---|---|
| `brunnerMunzelTest([1], [2, 3])` (the issue's example), also `[1, NaN]` | statistic NaN, df NaN, p NA, interval NaN, estimate 1 | the same NaN |
| `brunnerMunzelTest([1, 4], [2, 3])` | statistic 0, df 1, p 1, estimate 0.5 | the same (unchanged) |

## Fix

- `src/htest/brunnerMunzelTest.ts`: at least 2 values in each sample; the doc comment.
- `docs/differences-from-r.md` and `docs/ja/`: the `brunnerMunzelTest` entry (lawstat returns NaN).

## Tests

- `test/issue320.test.ts`: the errors for a sample of one value (x, x with a NaN, y) and the values for two each. With `src/` stashed, the error test fails.
- `test/htest-basic.test.ts`: fixture case #167 (`x = 1`, `y = c(2, 3, 4)`, lawstat NaN) is recorded with `substitute` as the error. `test/errors.test.ts`: passes. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- For `[1, 4]` vs `[2, 3]` the lower end of the interval is -5.853102368087345 here and -5.853102368087347 (-0x1.76993aacc4d1ep+2) in lawstat, 2 ulps apart (the upper end agrees). Unchanged by this fix; the fixture tolerance is 1e-12.

## close comment

Fixed in <commit of #320, see git log --grep='#320'>. `brunnerMunzelTest` now needs at least 2 non-missing values in each sample and throws "not enough 'x' observations" (or 'y') otherwise. With one value the variance estimate divides by n - 1 = 0 and the statistic, df, p-value and interval were NaN (lawstat's `brunner.munzel.test` gives the same NaN). Samples of 2 or more give the same values as before. (Not pushed yet.)
