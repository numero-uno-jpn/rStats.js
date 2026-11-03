# Issue #425 log: rlaplace with an infinite mu or sigma

GitHub Issue #425. Session 13, group A (extraDistr's infinite parameters, the rule of issue 92).

## Plan

- Intent: `rlaplace` returned NaN without a draw for any infinite mu or sigma; extraDistr rejects only NaN and sigma <= 0, draws an exponential and a uniform (the sign) and returns s e sigma + mu.
- Method (the user's decision on issue 92: the random values follow the quantile function, and the uniforms extraDistr draws are drawn): reject only NaN mu or sigma and sigma <= 0 without a draw; otherwise draw both, and return NaN for sigma = Inf (as `qlaplace`, `dlaplace` and `plaplace`, which are NaN there) and mu + sigma s e otherwise (an infinite mu gives mu, as `qlaplace`). Finite parameters: the same code and bits.

## Check (main `e2ae1ac`)

extraDistr (R 4.5.2), `set.seed(1)`, uniforms drawn from the next `runif(1)`:

| call | extraDistr | qlaplace (rStats.js) | before | after |
|---|---|---|---|---|
| `rlaplace(1, Inf, 1)`, `(1, -Inf, 1)` | Inf, -Inf; 2 drawn | Inf, -Inf | NaN, 0 drawn | Inf, -Inf; 2 drawn |
| `rlaplace(2, 0, Inf)` | -Inf, Inf; 4 drawn | NaN (extraDistr's qlaplace -Inf, NaN, Inf) | NaN, 0 drawn | NaN, NaN; 4 drawn |
| `rlaplace(2, Inf, Inf)` | NaN, Inf; 4 drawn | NaN | NaN, 0 drawn | NaN, NaN; 4 drawn |
| `rlaplace(1, 0, NaN)`, `(1, 0, 0)` | NA, 0 drawn | | NaN, 0 drawn | the same |
| `rlaplace(2, 0, 1)` | -0.7551818, 0.1457067; 4 drawn | | the same | the same |

## Fix

- `src/random/extra.ts`, `rlaplace`: the checks and the sigma = Inf case as above.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: sigma = Inf is NaN (extraDistr -Inf or Inf), next to the issue 92 sentence.

## Tests

- `test/issue425.test.ts`: the rows above. With `src/` stashed, 2 of 3 tests fail.
- `test/random.test.ts` (extraDistr fixture), `test/locationScaleExtremes.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `dlaplace`, `plaplace` and `qlaplace` are NaN for sigma = Inf, while the policy for infinite scales (session 24) takes the limit where d and p have one; extraDistr gives `dlaplace(1, 0, Inf)` 0 and `plaplace(1, 0, Inf)` 0.5. Not changed here (the issue 92 rule ties the random values to q as it is).

## close comment

Fixed in <commit of #425, see git log --grep='#425'>: `rlaplace` now rejects only NaN parameters and sigma <= 0 without a draw, as extraDistr. For an infinite mu it draws the exponential and the sign uniform extraDistr draws and returns mu (`rlaplace(1, { mu: Infinity, sigma: 1 })` is Infinity, as extraDistr and `qlaplace`). For sigma = Inf it draws the same two numbers and returns NaN, as `dlaplace`, `plaplace` and `qlaplace` do here (extraDistr gives -Inf or Inf by the sign); this follows the rule adopted for issue 92 (the random values follow the quantile function, the stream follows extraDistr) and is recorded in docs/differences-from-r.md. Finite parameters are unchanged.

Test: test/issue425.test.ts. (Not pushed yet.)
