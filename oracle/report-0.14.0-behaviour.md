# Fixes from an external comparison of 0.14.0 with R

An external agent compared rStats.js 0.14.0 with R 4.6.0 (webR), lme4 2.0.6 and lmerTest 3.2.1. The differences below
were confirmed with the oracle image (R 4.5.2, lme4 2.0.6, lmerTest 3.2.1), which remains the reference. The new
fixture cases are at the end of their case lists. Behaviour is described here, not R's code: do not read R's sources
(or any GPL package's, lme4 and lmerTest included), and do not use R's internal identifiers.

Easy to get wrong (read first):

- **Section 1 changes where the fit ends, not how it gets there.** The local minimiser in `src/models/lmer.ts` stays
  as it is; the new step compares its result with boundary points and restarts from a better one. Every existing
  case of the fixtures lmer, lmerMore, lmerBoundary, lmerTest and lmerCompare must give the same results as today
  (their references were checked to be global minima).
- **lme4 itself stops at the local minimum in some of the new cases.** The tests compare the fit with the reference
  (the global minimum); where lme4's criterion is clearly higher than the reference's, lme4's and lmerTest's values
  (and their singular-fit message) are not the target. Decide this per case from the fixture's numbers (see 1.3), not
  from a list of case indices.
- **Option checks (section 3) come before everything else** (before the formula is read), and a key whose value is
  `undefined` still counts as given for the unknown-key check.
- **The glm warning (section 5) must come at the point where R evaluates the deviance,** so that it is listed before
  `step size truncated due to divergence`.

## 1. lmer: the global minimum over the boundary points of whole terms

The profiled criterion (REML criterion or ML deviance) can have several local minima. A typical case: crossed groups
without a fixed intercept (`y ~ 0 + x + (1 | g) + (1 | item)`) where the subjects' mean is far from 0 and the item
variance is small. Then the item term can take the place of the missing intercept (a large item variance, a small
subject variance), a local minimum, besides the global one where the item term is 0. Starting from θ = 1 the
minimiser goes to the local one in about 1 case in 5 of such data (lme4 does in some of them as well). The fit
`y ~ 0 + x + (1 | g)` then has a lower criterion than `y ~ 0 + x + (1 | g) + (1 | item)`, which is impossible for the
optimum of the larger model (the smaller model is its boundary point with the item block at 0).

### 1.1 The rule

Call "removing term k" setting every element of θ in the block of random-effects term k (its whole lower triangle,
diagonal and off-diagonal) to 0. Let `minimise(start, held)` be the existing local minimisation started at `start`,
with the elements in `held` kept at exactly 0 throughout (never free, never released; the elements not held behave
exactly as today, including the release of diagonal elements and the negative-curvature step).

1. θ* = minimise(the initial θ, none held); f* its criterion.
2. For each term k, in the order of the structure's terms, whose block is not entirely 0 in θ*: θ_k =
   minimise(θ* with term k removed, held = the elements of term k), f_k its criterion. (With a single term, θ_k is
   all zeros and needs only an evaluation.)
3. Let k be the term with the smallest f_k (the first one on ties). If f_k < f* − 1e-8 max(1, |f*|), set
   θ* = minimise(θ_k, none held) and f* its criterion, and go back to step 2. Otherwise θ* is the estimate.

Each restart lowers the criterion by more than the threshold, so the loop ends; stop with the existing "did not
converge" error after 50 rounds in any case. The final θ goes through the existing sign normalisation of the columns
(as minimise's result does today). Only whole terms are removed (not single columns of a term, and not two terms at
once): the result is never worse than the local minimum reached from any one-term-removed point.

### 1.2 Speed

Step 2 costs one more minimisation per term with a nonzero block (started next to its own minimum, usually much
cheaper than the first). Measure with `node scripts/lmer-timing.mjs` before and after and report the numbers; the
one-term models (`(x | s)`) should be essentially unchanged (removing their only term leaves nothing to minimise).

### 1.3 Fixtures and tests

- Fixture `lmer` (oracle/lmer.R), new cases at the end: `y ~ 0 + x + (1 | g) + (1 | item)` on two data sets (each by
  REML and ML; with seed 20261101 today's library stops at the local minimum in both fits and lme4 only in the ML fit,
  with seed 20261113 both stop at the local one). The references are the global minima: the oracle now starts its 128-bit
  Newton iterations from the lowest of several starting points (lme4's θ, the boundary points of every subset of the
  terms, random starts), see `global_start` in oracle/lmer.R.
- The new starting points were checked on every existing case of the fixtures lmer, lmerMore, lmerBoundary and
  lmerTest: none moves (lme4's θ is at the global minimum there), so their references are unchanged.
- Fixture `lmerTest` (oracle/lmertest.R): the same model (seed 20261101 by REML and ML, seed 20261113 by REML), with
  the same global references.
- test/lmer.test.ts already requires the fit's criterion to be no worse than lme4's and takes the singular message
  from the reference; it needs no exception.
- test/lmerTest.test.ts compares names, messages and warnings exactly with lmerTest's. For a case where lmerTest's
  criterion is higher than the reference's by more than 1e-6 relative (lme4 stopped at another local minimum), the
  messages are compared as in test/lmer.test.ts (lmerTest's without the singular-fit message, then that message if
  the reference is singular), and the numbers only against the reference (the comparison with lmerTest's values,
  `|library − expected| ≤ 2 |reference − expected| + 1e-8 |expected|`, holds trivially there and may stay). The
  criterion of lmerTest's fit is not in the fixture: compute it from lmerTest's θ (`expected.varpar` without its
  last element, σ) with the library's own criterion function (internal `profiledDeviance` of
  src/models/mixedDeviance.ts) and compare with the reference θ's value. Write the rule in the header comment.
- Also add unit tests on new seeded data (not in a fixture) that the fit's criterion is never above that of the
  model with any one term dropped (fitted separately), for crossed models with two and three terms and a model with
  `(x | g)` plus a crossed term.

## 2. The names of the fixed effects come from the formula without the random-effects terms

lme4 builds the fixed-effects model matrix from the formula with the random-effects terms removed (`response ~ the
rest`), exactly as lm would for that formula; the model frame (the rows kept after dropping missing values) still
uses every variable of the whole formula. So the order of the variables, which decides the names of interaction
columns, is their order of first appearance in that reduced formula: `y ~ (z | g) + x * z` has the fixed effects
`(Intercept)`, `x`, `z`, `x:z`, the same as lm's `y ~ x * z`. The library today orders the variables by their first
appearance in the whole formula, random-effects terms included, and names the interaction `z:x`.

- Change `src/models/mixedStructure.ts` so that the terms of the fixed part (their variable order, hence their labels
  and column names) are those of the reduced formula, and nothing else changes (rows, levels, contrasts, the
  random-effects matrices).
- lmerTest's ANOVA tables (`lmerAnova`) name their rows by the fixed part's terms (`f:x`, not `x:f`) and its
  hypothesis matrices name their columns by the fixed effects: both must follow.
- Fixtures: `lmer`, `y ~ (x | g) + f * x` (REML and ML; the numbers in the order `(Intercept)`, `flo`, `fmid`, `x`,
  `flo:x`, `fmid:x`; the fixture lmer has no names); `lmerTest`, the same model by REML (the names in its summary, and
  its ANOVA rows `f`, `x`, `f:x`). Add a unit test of the names (`fixefNames`) for this model and for
  `y ~ (z | g) + x * z`.

## 3. Option checks of lmer and of lmerTest's functions

Today every function accepts any object as options and ignores what it does not know (`lmer` fits without weights
when given `weights`, by REML when given `reml: false` or `REML: "no"`). Decided rules (the user's decision):

### 3.1 The keys

| Function | Keys accepted | Keys of R that are not supported |
| --- | --- | --- |
| `lmer` | `REML`, `contrasts`, `levels` | `weights`, `offset`, `subset`, `naAction`, `na.action`, `control`, `start`, `verbose`, `devFunOnly` |
| `lmerSummary` | `ddf` | (none) |
| `lmerContest` | `rhs`, `joint`, `confint`, `level` | `collect`, `checkEstimability`, `check_estimability`, `ddf` |
| `lmerAnova` with one fit | `type` | `ddf` |
| `lmerAnova` with an array of fits | `refit`, `names` | `modelNames`, `model.names` |

- `options` must be an object (not null, not an array) when given, else the TypeError `options must be an object`.
- The keys are examined in the object's own key order (`Object.keys`). If any key is in the "not supported" column,
  the first such key gives the Error `<function>: argument '<key>' is not supported` (for example
  `lmer: argument 'weights' is not supported`). Otherwise, the keys in neither column are unknown: one gives the
  TypeError `unused argument (<key>)`, several give `unused arguments (<key1>, <key2>, ...)` in key order (R writes
  the values too, `unused argument (reml = FALSE)`; the library writes the names only). A key whose value is
  `undefined` counts as given for these two checks.
- R's lmerTest methods ignore unknown arguments (`summary` warns "additional arguments ignored"); the library rejects
  them in all four functions (the user's decision; documented as a difference).

### 3.2 Logical values

`REML` (lmer), `joint` and `confint` (lmerContest) and `refit` (lmerAnova) take, as R's conditions do:

- `undefined`: the default;
- a boolean;
- a number that is not NaN: 0 is `false`, any other number (±Infinity included) `true`;
- `null`: the TypeError `argument is of length zero`;
- anything else (a string, NaN, an array, an object): the TypeError `argument is not interpretable as logical`. R
  also accepts the strings `"TRUE"`, `"true"`, `"T"`, `"True"`, `"FALSE"`, ... ; the library does not (documented).

The value is converted before use, so the result's `REML` is always a boolean (`lmer(..., { REML: 0 }).REML` is
`false`; today it is `0`), and the refits and tests that read the options see the boolean. The other options keep
their current checks (`ddf`, `type`, `level`, `rhs`, `names`, `contrasts`, `levels`).

### 3.3 Tests

Unit tests for every rule above (each function, each kind of key, the order of the checks, the logical values). The
fixture `lmer` has a case with `REML: 0` (Dyestuff by ML).

## 4. lmer: a response fitted exactly by the fixed effects is an error

When the response lies in the column space of the fixed-effects matrix (a constant response with an intercept, or
`y = 1 + 0.1 x` with `y ~ x + (...)`), the penalised residual sum of squares is 0 for every θ, the criterion is −∞
everywhere, and there is no estimate: lme4 returns σ of about 1e-16 (rounding residue), a log-likelihood near +∞ and a
θ that depends on where its optimiser stopped. The library today fails with
`lmer: the minimisation of the criterion over theta did not converge`. Decided: a clear error instead.

- After the model structure is built (so the formula's and the data's errors come first) and before the
  minimisation: compute the least-squares residuals r of y on the fixed-effects matrix X (the columns kept). If
  max |r_i| ≤ 1e-12 max |y_i| (this includes a response of all zeros), throw the Error
  `lmer: the response is fitted exactly by the fixed effects (a constant response, for example), so the residual variance is 0`.
- A response close to but not exactly in that space (`5 ± 1e-9`) is fitted as today.
- A response fitted exactly by the fixed and random effects together but not by the fixed effects alone (a response
  constant within groups with `y ~ 0 + x + (1 | g)`) is not covered: the criterion decreases without bound as the
  variance grows, and the existing "did not converge" error stays.
- As many fixed effects as observations (n = p after dropping aliased columns, for example `y ~ a + (1 | g)` with a
  factor `a` that has a level per row) is a case of this rule: today REML gives the "did not converge" error and ML
  fails with an internal TypeError (`Cannot read properties of undefined`); both must give the new error (lme4 fails
  too, with `objective in x0 returns NA`).
- Unit tests (no fixture: R returns no meaningful values).

## 5. glm: "NaNs produced" from the deviance residuals

R computes the deviance residuals of several families with a logarithm of y/μ in R code, and R's `log` of a negative
number gives NaN with the warning `NaNs produced`. When an iteration's step makes a mean negative (the inverse link
of the Poisson and Gamma families, for example), the deviance is NaN, R warns `NaNs produced` at that evaluation, and
then the existing rule follows (`step size truncated due to divergence` and step halving). The library computes the
same NaN without the warning.

- The warning `NaNs produced` is added (once, in order of first appearance, as the library's other warnings) whenever
  a deviance contribution takes the logarithm of a negative number (−∞ included; the logarithm of NaN does not warn),
  for these families and only these:
  - `poisson`, `quasipoisson`: log(y/μ) for the rows with y > 0;
  - `Gamma`: log(y/μ) for the rows with y ≠ 0 (log(1) otherwise);
  - `quasi` with variance `"mu"`: log(y/μ) for the rows with y ≠ 0;
  - `quasi` with variance `"mu^2"`: log(y/μ) for the rows with y ≠ 0 and log(1/μ) for the rows with y = 0.
  The binomial families and `quasi` with variance `"mu(1-mu)"` compute their deviance in compiled code (no warning),
  as do the others (no logarithm).
- This applies wherever the fit evaluates the deviance (every iteration, the step-halving loop, the null deviance),
  so the warning comes before `step size truncated due to divergence` when both occur.
- `quasi` with variance `"mu^2"`: the library uses log(1/μ) for every y ≤ 0; R uses log(y/μ) for every y ≠ 0 (and
  log(1/μ) only for y = 0). With a negative y the deviance is then NaN in R (and the fit fails); use R's rule.
- Fixture `glm` (oracle/glm.R), new cases at the end: the Poisson, quasi-Poisson and Gamma families with the inverse
  link and starting values (warnings `NaNs produced`, `step size truncated due to divergence`), and quasi(`"mu^2"`)
  with a negative response and starting values (the error `inner loop 1; cannot correct step size`).

## Not changed

- `lmerContest` with `joint: false` accepts a right-hand side per row of L, where lmerTest gives an error: kept as an
  extension (the user's decision), documented in docs/differences-from-r.md.
