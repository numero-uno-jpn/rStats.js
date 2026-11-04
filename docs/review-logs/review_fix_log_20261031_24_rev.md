# Revision of review 24: the Laplace distribution with sigma = Inf

## Plan
- Intent: `dlaplace`, `plaplace`, `qlaplace` and `rlaplace` gave NaN for sigma = Inf, while extraDistr returns the
  limits (density 0, probability 1/2, the random values -Inf and Inf), and the normal, logistic and Cauchy distributions
  of the library take an infinite scale as the limit (review 24 policy). Criteria K6 (an infinite scale is the limit
  where d and p give the limit) and K5 (r follows q).
- Decision: D10 (session 14, `prep/misc.md` question 1, recommended option (a)). Pareto's b = Inf and invgamma's
  beta = Inf stay NaN (issue 92).
- Form: an early sigma = Inf branch in each function; finite sigma unchanged. `qlaplace` goes through the existing
  `locationScale` (mu at p = 1/2, ±Inf elsewhere). x = ±Inf and mu = ±Inf stay NaN with sigma = Inf.

## Original decision
- Review 24 (no user decision on this item): "LAPLACE-INF-SCALE-01: NaN for d, p and q, consistent, no change".
- Issue 425 (session 13): `rlaplace` with sigma = Inf made NaN as `qlaplace`, drawing what extraDistr draws; the gap with
  the review 24 policy was recorded as out of scope.

## Gap with the current criteria
- K6: extraDistr's d and p return the limits, so q (and r) should too.

## Reproduction (extraDistr 1.10, R 4.5.2)
| call | extraDistr | rStats.js before | now |
|---|---|---|---|
| `dlaplace(c(-1, 0, 1), 0, Inf)`, log at 1 | 0 0 0, -Inf | NaN | 0 0 0, -Inf |
| `dlaplace(c(Inf, -Inf), 0, Inf)` | NaN NaN | NaN | NaN NaN |
| `plaplace(c(-1, 0, 1), 0, Inf)`, upper log at 1 | 0.5 0.5 0.5, -0.6931472 | NaN | same as extraDistr |
| `qlaplace(c(0, .3, .5, .7, 1), 0, Inf)` | -Inf -Inf NaN Inf Inf | NaN | -Inf -Inf 0 Inf Inf |
| `qlaplace(.5, 3, Inf)` | NaN | NaN | 3 (the limit, as qnorm and qlogis) |
| `dlaplace(1, Inf, Inf)`, `plaplace(1, -Inf, Inf)`, `qlaplace(.3, Inf, Inf)` | NaN | NaN | NaN |
| `set.seed(1); rlaplace(2, 0, Inf); runif(1)` | -Inf Inf; 0.2016819 | NaN NaN; same draws | -Inf Inf; same draws |
| `set.seed(1); rlaplace(2, Inf, Inf)` | NaN Inf | NaN NaN | NaN NaN (unchanged, as qlaplace) |

## Fix
- `src/distributions/laplace.ts`: `valid` accepts sigma = Inf; branches in `dlaplace1`, `plaplace1`, `qlaplace1`.
- `src/random/extra.ts`: `rlaplace` returns mu + sigma s e for sigma = Inf with a finite mu (extraDistr's arithmetic).
- `test/issue425.test.ts`: the sigma = Inf expectation (NaN NaN to -Inf Inf) and the header comment.
- Docs (en, ja): the rlaplace sentence of "Distributions outside base R" rewritten; `qlaplace(0.5, 3, Inf)` added to the
  row of medians with an infinite scale.

## Tests
- `test/rev24.test.ts`: the values above and the draws. Fails with src stashed.
- distributionProperties, extradist, extremeAccuracy, issue110, issue338, issue425, jstat-replacement,
  locationScaleExtremes, review45, thresholds pass (the Laplace fixtures have no sigma = Inf).

## Out of scope (recorded)
- `rlaplace(n, Inf, Inf)`: extraDistr gives NaN or Inf by the sign (Inf - Inf); here NaN as before, as `qlaplace`.
