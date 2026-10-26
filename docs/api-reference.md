# rStats.js API reference

rStats.js gives JavaScript the numerical core of R: probability distributions, random numbers that match R's
`set.seed()`, descriptive statistics, hypothesis tests, linear and generalized linear models, survival analysis,
linear algebra and numerical methods. Function names and results follow R, and the functions are tested against R
(to a relative 1e-12) or against high-precision references (where R itself is inaccurate, or has no such function).

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
```

Without a bundler, `https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats/dist/rstats.js` is one ES module with every
function.

## Conventions

- **Names** are R's, with a dot becoming camelCase: `t.test` → `tTest`, `p.adjust` → `pAdjust`; functions of other
  packages keep their names (`car::Anova` → `Anova`, `tidyr::pivot_longer` → `pivotLonger`).
- **Arguments:** the required ones are positional; the optional ones go in one options object with R's names in
  camelCase: `pt(q, df, lower.tail = FALSE)` → `pt(q, df, { lowerTail: false })`.
- **Results** are plain objects. Tests return R's `htest` fields in camelCase (`statistic`, `parameter`, `pValue`,
  `confInt`, `estimate`, `method`, ...), with R's names of the values in separate fields (`statisticName`, ...).
- **Data:** a sample is an array of numbers (or a `Float64Array`), a matrix an array of rows, a data frame an object
  of equal-length columns. A missing value is `NaN` in a number array and `null` in a data frame column.
- **Formulas** are strings: `lm("y ~ x + g", data)`, `tTest("score ~ arm", data)`.
- **Indices** that functions return are 0-based.
- **Random numbers:** after `setSeed(42)`, `rnorm`, `runif`, `sample` and the others give R's numbers after
  `set.seed(42)`.
