# rStats.js for JavaScript developers

rStats.js follows R: the same function names, the same arguments and the same numbers as R, so that an analysis
written by a statistician in R can be moved to the browser or Node and give identical results. That makes a few
things look unusual to a JavaScript developer. This page explains them with one small example: a trial with a
drug arm and a placebo arm.

(The examples are run by `test/guide.test.ts`, so the values in the comments are what the library returns; they
are also R's values.)

## 1. Data frames: columns, not rows

JavaScript data usually comes as an array of row objects, the shape of JSON and of a parsed CSV file:

```js
import { fromRows, toRows } from "@numero-uno-jpn/rstats";

const rows = [
  { id: 1, arm: "drug", sex: "F", age: 34, score: 7.1, improved: "yes" },
  { id: 2, arm: "drug", sex: "M", age: 51, score: 6.4, improved: "yes" },
  { id: 3, arm: "drug", sex: "F", age: 17, score: 8.2, improved: "yes" },
  { id: 4, arm: "drug", sex: "M", age: 45, score: null, improved: "no" },
  { id: 5, arm: "drug", sex: "F", age: 29, score: 7.8, improved: "yes" },
  { id: 6, arm: "drug", sex: "M", age: 62, score: 6.9, improved: "no" },
  { id: 7, arm: "placebo", sex: "F", age: 38, score: 5.2, improved: "no" },
  { id: 8, arm: "placebo", sex: "M", age: 44, score: 6.0, improved: "yes" },
  { id: 9, arm: "placebo", sex: "F", age: 57, score: 4.9, improved: "no" },
  { id: 10, arm: "placebo", sex: "M", age: 23, score: 5.6, improved: "no" },
  { id: 11, arm: "placebo", sex: "F", age: 41, score: 6.3, improved: "yes" },
  { id: 12, arm: "placebo", sex: "M", age: 36, score: 5.1, improved: "no" },
];
```

Statistics works on columns (all the scores, all the arms), so R keeps a table as a *data frame*: one array per
column. In rStats.js a data frame is a plain object of equal-length arrays. `fromRows` converts, `toRows` converts
back:

```js
const d = fromRows(rows);
// d = { id: [1, 2, ...], arm: ["drug", "drug", ...], ..., score: [7.1, 6.4, 8.2, null, ...], ... }
d.score;          // the column, an ordinary array
toRows(d)[0];     // { id: 1, arm: "drug", sex: "F", age: 34, score: 7.1, improved: "yes" }
```

A key missing from a row becomes `null`. A CSV parser that returns row objects gives you `rows`; make sure that
numbers arrive as numbers (not strings) and empty cells as `null` or as a missing key.

## 2. Missing values: `null` (or `NaN`)

R marks a missing value with `NA`. Here a missing value is `null`, or `NaN` in a numeric column. Functions treat it
as R does: `naOmit` drops the rows that have one, `completeCases` says which rows are complete.

```js
import { completeCases, naOmit } from "@numero-uno-jpn/rstats";

completeCases(d);   // [true, true, true, false, true, ...]: row 4 has no score
naOmit(d);          // the data frame without row 4
```

## 3. Groups: string columns are factors

A column of strings is a *factor* in R's terms: a grouping variable whose distinct values are its *levels*. The
levels are sorted (strings by code point, numbers as numbers), and results come in that order: "drug" before
"placebo". The first level is the reference group (the one others are compared with), as in R.

## 4. Formulas: a small language for "what against what"

R describes an analysis with a formula, a string here:

| Formula | Read as | Used by |
|---|---|---|
| `"score ~ arm"` | score, compared between the groups of arm | `tTest`, `wilcoxTest`, `kruskalTest`, `aov`, `lm`, `aggregate` |
| `"score ~ 1"` | score alone (one sample) | `tTest`, `wilcoxTest` |
| `"Pair(before, after) ~ 1"` | paired measurements | `tTest`, `wilcoxTest` |
| `"score ~ arm + sex"` | by arm and by sex | `lm`, `aov`, `aggregate`, `onewayTest` |
| `"score ~ arm * sex"` | arm, sex and their interaction | `lm`, `aov` |
| `"y ~ week \| subject"` | week within each subject (blocks) | `friedmanTest`, `quadeTest` |
| `"y ~ week + Error(subject/week)"` | repeated measures | `aov` |
| `"~ age + score"` | two variables, no response | `corTest` |

The variables are column names of the data frame; computed terms such as `log(x)` are not supported: add the
column first.

## 5. The whole workflow

Missing values out, a subgroup, summaries by group, then a test:

```js
import { aggregate, mean, naOmit, sd, subset, tTest, wilcoxTest } from "@numero-uno-jpn/rstats";

const adults = naOmit(subset(d, (r) => r.age >= 18));   // ids 1, 2, 5, ..., 12

aggregate("score ~ arm", adults, mean);
// { arm: ["drug", "placebo"], score: [7.05, 5.516666666666667] }

aggregate("score ~ arm + sex", adults, (v) => ({ mean: mean(v), sd: sd(v) }));
// { arm: ["drug", "placebo", "drug", "placebo"], sex: ["F", "F", "M", "M"],
//   "score.mean": [7.45, 5.4667, 6.65, 5.5667], "score.sd": [0.495, 0.7371, 0.3536, 0.4509] }   (rounded)

const t = tTest("score ~ arm", adults);
t.method;        // "Welch Two Sample t-test"
t.statistic;     // 4.1818   (t)
t.parameter;     // 6.3048   (df)
t.pValue;        // 0.0052
t.confInt;       // [0.6465, 2.4201]   95% interval of the difference
t.estimate;      // [7.05, 5.5167]     ("mean in group drug", "mean in group placebo")

wilcoxTest("score ~ arm", adults).pValue;   // 0.0095 (exact)
```

The same in R: `t.test(score ~ arm, data = na.omit(subset(d, age >= 18)))`.

## 6. Reading a test result

Every test returns a plain object with R's fields in camelCase:

| Field | Meaning |
|---|---|
| `statistic`, `statisticName` | the test statistic and its name (`"t"`, `"W"`, `"X-squared"`, ...) |
| `parameter`, `parameterName` | degrees of freedom and the like |
| `pValue` | the p-value |
| `confInt`, `confLevel` | the confidence interval and its level |
| `estimate`, `estimateNames` | the estimated quantity (means, difference, correlation, ...) |
| `nullValue`, `alternative` | the hypothesised value and `"two.sided"`, `"less"` or `"greater"` |
| `method` | the test's name, as R prints it |

Options are one object with R's argument names in camelCase: `t.test(..., var.equal = TRUE, conf.level = 0.99)`
is `tTest(..., { varEqual: true, confLevel: 0.99 })`.

## 7. Which function for which question

| I want to ... | Function |
|---|---|
| compare two groups | `tTest("y ~ g", d)` (means), `wilcoxTest("y ~ g", d)` (ranks), `brunnerMunzelTest` |
| compare paired measurements | `tTest("Pair(before, after) ~ 1", d)`, `wilcoxTest(...)` |
| compare three or more groups | `aov("y ~ g", d)` with `aovSummary`, `kruskalTest("y ~ g", d)`, `onewayTest` (Welch) |
| find which groups differ | `TukeyHSD`, `pairwiseTTest`, `dunnTest`, `dscfAllPairsTest`, `dunnettTest`, `manyOneUTest` (Steel) |
| repeated measures | `aov("y ~ w + Error(id/w)", d)`, `aovEz`, `friedmanTest("y ~ w \| id", d)` |
| relate two categorical variables | `chisqTest(d.arm, d.improved)`, `fisherTest(table)` |
| correlate two measurements | `corTest("~ x + y", d)` (`method: "spearman"` or `"kendall"`) |
| fit a regression | `lm("y ~ x + g", d)`, `glm(x, y, { family: "binomial" })` |
| analyse survival times | `survfit`, `survdiff` (log-rank), `coxph` |
| measure agreement or reliability | `kappa2`, `kappamFleiss`, `icc`, `cronbachAlpha`, `omega` |
| plan a sample size | `powerTTest({ delta: 0.5, power: 0.8 })`, `pwrTTest`, ... |
| summarise by group | `aggregate`, `tapply`, `split` |
| combine tables | `merge(a, b, { by: "id" })`, `rbind`, `cbind` |

More tests on the same data:

```js
import { chisqTest, corTest, kruskalTest } from "@numero-uno-jpn/rstats";

const all = naOmit(d);
kruskalTest("score ~ sex", all).pValue;                               // 0.4652
chisqTest(all.arm, all.improved);                                     // X-squared 0.8831, p 0.3474
corTest("~ age + score", all, { method: "spearman" }).estimate;      // -0.3636 (rho), p 0.2732
```

## 8. Other habits from R

- **Indices are 0-based** where a function returns positions (as everywhere in JavaScript); R's are 1-based.
- **Random numbers** follow R's: after `setSeed(42)`, `rnorm(5)` gives what R gives after `set.seed(42)`.
- **Groups as a `Map`:** `split(d.score, d.arm)` returns a `Map` (`groups.get("drug")`), in R's order of the
  levels.
- The [README](../README.md#what-is-included) lists every function, and [differences-from-r.md](differences-from-r.md)
  where rStats.js deliberately differs from R.
