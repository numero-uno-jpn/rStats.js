# Issue #424 log: noncentral rchisq with df = Inf

GitHub Issue #424. Session 13, group A (noncentral chi-squared with an infinite df, with issue 420).

## Plan

- Intent: `rnchisq1` rejected every non-finite df; R's rnchisq rejects only a NaN df, so df = Inf gives `rgamma(Inf, 2)` = Inf after the Poisson mixture's draws. Inf is the correct limit, so follow R in value and stream.
- Method: change the df check to `Number.isNaN(df)` (df = -Inf is still rejected by `df < 0`). `rgamma1(Inf, 2)` already returns Inf without a draw, as R's rgamma. Finite df: the same code and bits. The central `rchisq(n, Inf)` stays NaN (R's too).

## Check (main `03a3acf`)

R 4.5.2, `set.seed(1)`, uniforms drawn from the next `runif(1)`:

| call | R | before | after |
|---|---|---|---|
| `rchisq(1, Inf, ncp = 0)` | Inf, 0 drawn | NaN, 0 | Inf, 0 |
| `rchisq(1, Inf, ncp = 2)` | Inf, 1 drawn | NaN, 0 | Inf, 1 |
| `rchisq(3, Inf, ncp = 2)` | Inf x3, 5 drawn | NaN, 0 | Inf x3, 5 |
| `rchisq(2, Inf, ncp = 20)` | Inf x2, 9 drawn | NaN, 0 | Inf x2, 9 |
| `rchisq(1, Inf)`, `(1, Inf, ncp = Inf)`, `(1, -Inf, ncp = 2)` | NaN, 0 drawn | the same | the same |
| `rchisq(2, 5, ncp = 2)` | 3.130486816, 8.408511796; 7 drawn | the same | the same |

## Fix

- `src/random/gamma.ts`, `rnchisq1`: reject only a NaN df (and df < 0). No docs change (R's value).

## Tests

- `test/issue424.test.ts`: the rows above. With `src/` stashed, 1 of 2 tests fails.
- `test/random.test.ts`, `test/locationScaleExtremes.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `rf(n, Inf, df2, ncp)` does not use `rnchisq1` for df1 = Inf and draws fewer variates than R; fixed separately under issue 420.

## close comment

Fixed in <commit of #424, see git log --grep='#424'>: the noncentral `rchisq(n, Inf, ncp)` now returns Inf, as R's rnchisq, after drawing the same Poisson (and chi-squared) variates as R (`rchisq(1, Inf, ncp = 2)`: Inf, one uniform drawn). The central `rchisq(n, Inf)`, an infinite ncp and df = -Inf stay NaN without a draw, as in R. Finite df is unchanged.

Test: test/issue424.test.ts. (Not pushed yet.)
