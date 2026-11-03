# Issue #245 log: distSummary("gamma") ignores a rate that disagrees with the scale

GitHub Issue #245. Session 11, group A3 (distSummary).

## Plan

- Intent: `distSummary("gamma", { shape: 2, rate: 2, scale: 1 })` took the scale and silently ignored the rate, returning the summary of a different distribution. `dgamma`, `pgamma`, `qgamma` and `rgamma` resolve the pair through `gammaScale()` (`src/distributions/gamma.ts`), which throws a RangeError unless scale = 1 / rate (within 1e-15), as R does.
- Method: resolve the scale through the same `gammaScale()`, and turn its RangeError into the all-NaN summary, distSummary's documented convention for invalid parameters ("Invalid parameters give NaN throughout"). A rate alone, a scale alone, neither, or a consistent pair give the same scale as before (gammaScale returns the scale, or 1 / rate, or 1), so all valid calls keep their bits.
- Why NaN and not the RangeError: every other invalid parameter of distSummary gives NaN; an error here alone would break that contract.

## Check (main `1d4df1a`)

distSummary is not an R function; R's `dgamma(1, 2, rate = 2, scale = 1)` fails with "specify 'rate' or 'scale' but not both".

| call | before | after |
|---|---|---|
| `gamma(shape 2, rate 2, scale 1)` (the issue) | the summary of shape 2, scale 1 (mean 2) | NaN throughout |
| `gamma(shape 2, rate NaN, scale 1)` | mean 2 | NaN throughout |
| `gamma(shape 2, rate 2, scale 0.5)`, rate 2 alone, scale 0.5 alone | mean 1, variance 0.5, ... | unchanged |

## Fix

- `src/distributions/summary.ts`, `case "gamma"`: the scale from `gammaScale()`, NaN throughout where it throws (only the parameters that are present are passed, for `exactOptionalPropertyTypes`).

## Tests

- `test/issue245.test.ts`: the inconsistent pair and a NaN rate give NaN throughout (dgamma throws for the same pair); a consistent pair, a rate alone and a scale alone give the old values. With `src/` stashed, the first fails.
- Full `npx vitest run`: 339 files passed (2765 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #245, see git log --grep='#245'>: `distSummary("gamma")` now resolves `rate` and `scale` through the same `gammaScale()` as `dgamma`, `pgamma`, `qgamma` and `rgamma`. Where both are given and scale is not 1 / rate, it returns NaN throughout, distSummary's convention for invalid parameters (the d/p/q/r functions throw a RangeError for the same pair). `distSummary("gamma", { shape: 2, rate: 2, scale: 1 })` is now all NaN; a consistent pair, a rate alone or a scale alone give the same values as before.

Test: test/issue245.test.ts. (Not pushed yet.)
