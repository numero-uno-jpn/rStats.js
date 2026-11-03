# Issue #257 log: quantile accepts probabilities within 100 eps outside [0, 1]

GitHub Issue #257. Session 11, judging of the issues classified C. Verdict: not planned (the same as R; the issue's "R rejects them" is wrong). No code changed; a test added.

## Plan

- Intent: check R's `quantile` on the issue's probabilities and just beyond the tolerance.
- Method: `quantile(1:3, c(-1e-14, 1 + 1e-14))` for types 1 to 9, and at 1.01 times 100 eps outside, in R 4.5.2 and rStats.js.
- Why: the issue did not run R.

## Check (main `7a538a5`, R 4.5.2)

| Call | R 4.5.2 | rStats.js |
|---|---|---|
| `quantile(1:3, c(-1e-14, 1 + 1e-14))`, each of types 1 to 9 | 1 3 | [1, 3] |
| `quantile(1:3, -1.01 * 100 eps)` | error "'probs' outside [0,1]" | RangeError "'probs' outside [0,1]" |
| `quantile(1:3, 1 + 1.01 * 100 eps)` | the same error | the same |
| `quantile(1:3, -1e-13)` | the same error | the same |

R's quantile.default checks `probs < -eps | probs > 1 + eps` with `eps <- 100 * .Machine$double.eps` and then clamps the probabilities to [0, 1]; src/descriptive/quantile.ts does the same (`tol = 100 * Number.EPSILON`, then `Math.min(Math.max(p, 0), 1)`). The tolerance lets probabilities computed with rounding, such as `1 - k * 0.1` or `seq(0, 1, by = 0.1)`, through.

## Fix

- None (not planned): R's rule.

## Tests

- `test/issue257.test.ts`: the issue's probabilities give the ends for every type; 1.01 times 100 eps outside and -1e-13 are errors.

## close comment

Not planned: this is R's rule. R's quantile accepts probabilities within 100 * .Machine$double.eps outside [0, 1] and clamps them to the ends, and rejects anything beyond with "'probs' outside [0,1]". R 4.5.2's quantile(1:3, c(-1e-14, 1 + 1e-14)) gives 1 3 for every type, as quantile([1, 2, 3], [-1e-14, 1 + 1e-14]) does here; at 1.01 times the tolerance, or at -1e-13, both throw. The tolerance lets probabilities that carry rounding errors through. A test was added: test/issue257.test.ts. (Not pushed yet.)
