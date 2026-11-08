# rStats.js API reference

rStats.js gives JavaScript the numerical core of R: probability distributions, random numbers that match R's
`set.seed()`, descriptive statistics, hypothesis tests, linear, generalized linear and (generalized) linear mixed models with
robust covariances, survival analysis, diagnostic accuracy and method comparison, linear algebra and numerical
methods. Function names and results follow R, and the functions are tested
against R (to a relative 1e-14 for distributions and 1e-12 for tests and models; see
[accuracy](https://numero-uno-jpn.github.io/rStats.js/docs/accuracy.html)) or against high-precision references
(where R itself is inaccurate, or has no such function).

This reference lists every function with its options, results and an example (the examples are run by the tests).
The functions are grouped by subject in the menu.

## Start here

- [R functions in rStats.js](https://numero-uno-jpn.github.io/rStats.js/docs/r-functions.html): find the function
  for an R function (`t.test` → `tTest`), with a one-line description of each.
- [Guide for JavaScript developers](https://numero-uno-jpn.github.io/rStats.js/docs/guide-for-js-developers.html):
  data frames, missing values, factors, formulas and a worked analysis, for readers new to R's way of writing one.
- [Demo](https://numero-uno-jpn.github.io/rStats.js/demo/): every function in the browser, compared with R.
- [Differences from R](https://numero-uno-jpn.github.io/rStats.js/docs/differences-from-r.html) and
  [accuracy](https://numero-uno-jpn.github.io/rStats.js/docs/accuracy.html).

## Using it

```sh
npm install @numero-uno-jpn/rstats
```

```ts
import { pnorm, tTest, lm } from "@numero-uno-jpn/rstats";        // everything (tree-shaken by a bundler)
import { qbeta } from "@numero-uno-jpn/rstats/distributions";       // or one area: distributions, tests,
                                                                     // descriptive, linalg, numerics, special
import { lmer, glmer } from "@numero-uno-jpn/rstats/mixed";        // mixed models: only from this area
```

Without a bundler, `https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@1.3.0/dist/rstats.js` is one ES module with
every function except the mixed models, which are in `dist/mixed.js`. Keep a version in the URL (an exact one, or a
major version such as `@1` from 1.0.0 on): a URL without one follows every new release, breaking changes included.
Use either `dist/rstats.js` or the per-area bundles (`dist/tests.js`, `dist/mixed.js`, ...) on one page: mixing them
loads the common code twice, with two random number states.

## Conventions

### Names

R's names, with a dot becoming camelCase: `t.test` → `tTest`, `p.adjust` → `pAdjust`. Functions of other packages
keep their names: `car::Anova` → `Anova`, `tidyr::pivot_longer` → `pivotLonger`, `TOSTER::t_TOST` → `tTOST`. psych's
`ICC` and irr's `icc` are two functions.

Where R's name is a reserved word of JavaScript or too general to export, the name says what the function computes:

| rStats.js | R |
| --- | --- |
| `variance` | `var` |
| `cronbachAlpha` | psych's `alpha` |
| `modes` | DescTools' `Mode` |
| `geometricMean` | DescTools' `Gmean` |
| `cv` | DescTools' `CoefVar` |
| `pbvnorm` | mvtnorm's `pmvnorm` in two dimensions |
| `glhtDunnett` | multcomp's `glht` with Dunnett's contrasts |
| `blandAltman` | BlandAltmanLeh's `bland.altman.stats` |
| `diagnosticTests` | epiR's `epi.tests` |

The methods of the models other than `lm` (R's `summary`, `predict`, `anova`, ... of a fit) carry the model's name in
front: `glmSummary`, `glmPredict`, `lmerSummary`, `lmerAnova`, `glmerSummary`, `glmerPredict`. The methods without a
prefix (`predict`, `confint`, `anova`) are those of `lm`.

### Arguments

- The required arguments are positional.
- The optional ones go in one options object, with R's names in camelCase:
  `pt(q, df, lower.tail = FALSE)` → `pt(q, df, { lowerTail: false })`.
- The optional arguments that R's usage passes by position are taken both ways: `glmResiduals`' type, `cohenES`'
  size, `outer`'s fun, `tabulate`'s nbins, `propTrendTest`'s score, and the deriv of the functions `splinefun` and
  `splinefunH` return. `glmResiduals(fit, "pearson")` and `glmResiduals(fit, { type: "pearson" })` are the same;
  giving one both ways is a RangeError.
- The exception is `optimHess(par, fn, gr, control)`, which takes `gr` and `control` by position only, as R:
  `control` is itself a plain object, which an options object after `gr` could not be told from.
- A key the function does not know is a RangeError, also in a nested object with fixed keys (`optim`'s `control`,
  `glm`'s `family` given as an object). `pnorm(1, { lowertail: false })` throws "unknown option 'lowertail' for pnorm
  (known: mean, sd, lowerTail, logP)" instead of ignoring the misspelt key. Objects whose keys are your data (data
  frames, `contrasts`, `levels`) are not checked.

### Results

- Results are plain objects.
- Tests return R's `htest` fields in camelCase (`statistic`, `parameter`, `pValue`, `confInt`, `estimate`, `method`,
  ...), with R's names of the values in separate fields (`statisticName`, ...).
- The functions that take a fit of `lmer` or `glmer` (`lmerSummary`, `lmerAnova`, `lmerContest`, `glmerSummary`,
  `glmerPredict`, ...) need the object `lmer` or `glmer` returned itself. A copy of it (`structuredClone`,
  `{ ...fit }`, JSON or `postMessage`) loses internal values, and passing one is a TypeError.

### Data

- A sample is an array of numbers (or a `Float64Array`).
- A matrix is an array of rows.
- A data frame is an object of equal-length columns.
- A missing value is `NaN` in a number array and `null` in a data frame column.
- Formulas are strings: `lm("y ~ x + g", data)`, `tTest("score ~ arm", data)`.
- Indices that functions return are 0-based.

### Errors

| Error | When |
| --- | --- |
| `TypeError` | an argument of the wrong type or shape (a formula of the wrong form for the function included) |
| `RangeError` | a value out of range (a column that does not exist, an empty selection, an unknown choice) |
| `Error` | a numerical failure, or input whose result is not defined (such as too few observations) |
| `SyntaxError` | a formula that cannot be parsed |

- Input for which the result is not defined throws, also where R returns NaN. The distribution functions (d/p/q/r)
  return NaN for invalid parameters, as R.
- A computation that would allocate more than 2^24 values in one array or run for more than about 10 seconds throws a
  RangeError before it starts ([limits](https://numero-uno-jpn.github.io/rStats.js/docs/performance.html#limits)).

### Warnings

- Every test, model and fit returns R's warnings in its result's `warnings`: R's text, each distinct warning once in
  R's order, `[]` when there are none. Not included: the warnings of R's distribution functions about their own
  precision, and those about R's argument types.
- Nothing is printed by default. `setWarningHandler(handler)` sets a function that receives each warning of a call
  once, with the name of the function called, after the result is computed:
  - `(message, source) => console.warn(source + ": " + message)` prints them as R does.
  - A handler that throws plays the part of R's `options(warn = 2)`.
- A function that calls another passes the warnings once, under its own name. A fit's warnings are passed when it is
  fitted, not again by `anova(fit)` or `glmSummary(fit)`.

### Random numbers

After `setSeed(42)`, `rnorm`, `runif`, `sample` and the others give R's numbers after `set.seed(42)`.
