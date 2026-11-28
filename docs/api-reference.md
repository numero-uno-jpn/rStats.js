# rStats.js API reference

rStats.js gives JavaScript the numerical core of R: probability distributions, random numbers that match R's
`set.seed()`, descriptive statistics, hypothesis tests, linear, generalized linear, ordinal, multinomial, robust and nonlinear regression, and (generalized) linear mixed models with
robust covariances, survival analysis, trial-design sample-size and power calculations, meta-analysis and meta-regression,
diagnostic accuracy and method comparison, linear algebra and numerical methods. Function names and results follow R, and the functions are tested
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
- [Plotting the results](https://numero-uno-jpn.github.io/rStats.js/docs/plotting.html): the plot data of `/plot`
  (survival curves, forest plots, Q-Q plots, model diagnostics, ...) with Observable Plot and Plotly.js.
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
import { polr, rlm, nls } from "@numero-uno-jpn/rstats/regression"; // regression: only from this area
import { rq, rqSummary, rqPredict, rqPredictInterval, rqAnova } from "@numero-uno-jpn/rstats/regression";
import { geeglm, geeSummary, geeVcov, geePredict, geeAnova, geeQIC } from "@numero-uno-jpn/rstats/regression";
import { glmnet, glmnetCoef, glmnetPredict, cvGlmnet } from "@numero-uno-jpn/rstats/regression";
```

The `/regression` area also provides quantile regression (`rq`), generalized estimating equations (`geeglm`) and
penalized regression (`glmnet`). For example, `rq("y ~ x", data, { tau: 0.5 })` fits a conditional median;
`geeglm("y ~ x", data, { id: "subject", corstr: "exchangeable" })` fits a marginal model; and
`glmnet(x, y, { family: "gaussian", alpha: 1 })` fits a lasso path. Use `rqSummary` / `rqPredictInterval`,
`geeSummary` / `geeVcov` / `geeQIC`, and `glmnetCoef` / `glmnetPredict` / `cvGlmnet` for their methods.

Without a bundler, `https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@1.17.0/dist/rstats.js` is one ES module with
every function except mixed models, regression, multivariate analysis, time series, causal inference and plot data,
which are in `dist/mixed.js`, `dist/regression.js`, `dist/multivariate.js`, `dist/timeseries.js`, `dist/causal.js` and
`dist/plot.js`. Keep a version in the URL (an exact one, or a
major version such as `@1` from 1.0.0 on): a URL without one follows every new release, breaking changes included.
Use either `dist/rstats.js` or the per-area bundles (`dist/tests.js`, `dist/mixed.js`, `dist/regression.js`, `dist/multivariate.js`, ...) on one page: mixing them
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
front: `glmSummary`, `glmPredict`, `lmerSummary`, `lmerAnova`, `glmerSummary`, `glmerPredict`, `coxZph`,
`survregPredict`, `survregResiduals`, `confintRma`, `predictRma`, `confintLmer`, `confintGlmer`, `simulateLmer` and
`simulateGlmer`. The exception is `predictCrr` (R's `predict.crr`). The methods without a prefix (`predict`, `confint`,
`anova`) are those of `lm`. `rma`'s methods are `confintRma` and `predictRma`.

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


## Stepwise model selection

`step`, `stepAIC`, `drop1`, `add1` and `extractAIC` take a formula fit of `lm` or `glm` (`glm` has a formula
interface since 1.15.0) and the data frame it was fitted on:

```ts
import { lm, glm, step, stepAIC, drop1, add1, extractAIC } from "@numero-uno-jpn/rstats";

const full = lm("y ~ x1 + x2 + x3 + f", data);
const s = step(lm("y ~ 1", data), data, { scope: { lower: "~ 1", upper: "~ x1 + x2 + x3 + f" } }); // "both"
s.fit;      // the selected lm fit
s.anova;    // the path, R's $anova: step, df, deviance, residDf, residDeviance, aic
s.visits;   // every model visited with the table examined from it (R's trace)
step(full, data, { direction: "backward", k: Math.log(full.nObs) }); // BIC
step(glm("y01 ~ x1 + x2 + f", data, { family: "binomial" }), data); // glm
drop1(full, data, { test: "F" }); // and add1(fit, data, { scope, test })
extractAIC(full); // [edf, AIC]
```

The search follows R: whole terms move respecting marginality, a move is taken when it lowers the criterion
strictly, aliased terms are removed first, and as in R a move that changes the rows used (missing values) stops the
search with an error. `stepAIC` is the same search; only its path's `df` differs (positive). For glm the tables'
AIC is R's (for Gamma and inverse.gaussian an approximation through the dispersion, which also guides the search).

## Multinomial logistic regression

`multinom` and its methods are in `/regression`, with a formula and a data frame like `polr`:

```ts
import { multinom, multinomSummary, multinomConfint, multinomPredict, multinomAnova } from "@numero-uno-jpn/rstats/regression";

const fit = multinom("smoke ~ sex + age + exercise", data, { levels: { smoke: ["Never", "Occas", "Regul", "Heavy"] } });
const s = multinomSummary(fit); // coefficients, standard errors, Wald z and p, odds ratios, pseudo R²
multinomConfint(fit, { level: 0.95 }); // Wald intervals
multinomPredict(fit, { type: "class" }); // ties broken as R's max.col (setSeed for R's classes)
multinomAnova(multinom("smoke ~ sex", data), fit); // likelihood-ratio test
```

`multinom` follows `nnet::multinom(y ~ ..., data, weights, decay, Hess = TRUE)`: baseline-category logits with the
first level of the response as the reference. The coefficients are the exact maximum (Newton's method); R's BFGS stops
about 1e-5 from it by default. The standard errors come from the Hessian of −log L. `weights` are case weights,
`decay` adds decay times the sum of squares of all coefficients (as nnet; deviance and AIC include it, the standard
errors do not). The pseudo R² (McFadden, Cox-Snell, Nagelkerke) use the intercept-only model on the same rows.

## Tobit, beta regression and log-linear models

`tobit`, `betareg`, `loglin` and `loglm` are in `/regression`:

```ts
import { tobit, tobitSummary, betareg, betaregSummary, betaregConfint, betaregPredict, betaregResiduals, loglin, loglm, loglmAnova } from "@numero-uno-jpn/rstats/regression";

const t = tobit("hours ~ age + kids", data, { left: 0 }); // AER::tobit: survreg on the response clipped to [left, right]
tobitSummary(t); // Wald table, scale, Wald test; t.loglik holds the null and the model log-likelihoods
const b = betareg("rate ~ x1 + x2 | z", data, { link: "logit", type: "BR" }); // precision modelled by z
betaregSummary(b); betaregConfint(b, { level: 0.95 });
betaregPredict(b, { newdata, type: "quantile", at: [0.1, 0.9] });
betaregResiduals(b, { type: "sweighted2" });
const table = { counts, dim: [4, 4, 2], names: ["Hair", "Eye", "Sex"] }; // counts in R's order (first index fastest)
loglin(table, [["Hair", "Eye"], ["Hair", "Sex"], ["Eye", "Sex"]]);
loglmAnova(loglm("~ Hair + Eye + Sex", table), loglm("~ (Hair + Eye + Sex)^2", table));
```

`tobit` follows `AER::tobit(formula, left, right, dist)`: a response at or below `left` is left censored there, at or
above `right` right censored there, and the model is `survreg`'s with any of its distributions. `betareg` follows
`betareg::betareg`: mean links logit, probit, cloglog, cauchit, log and loglog, precision links identity, log and sqrt,
and the estimators of Kosmidis and Firth (2010) (`type: "BC"` and `"BR"`); the likelihood is maximised to convergence,
so estimates agree with R's to about 1e-7. Responses of 0 or 1 are refused (R switches to its extended-support
distribution). `loglin` repeats R's iterative proportional fitting (with R's loose default `eps = 0.1`); `loglm` takes
a table or a data frame with the frequencies on the left of the formula. Gamma regression is `glm` with the Gamma
family.

## Control charts

The control charts of the qcc package are in `/descriptive` (values only; no plots):

```ts
import { qcc, cusum, ewma, ocCurves, processCapability, mqcc, qccGroups, medianChart } from "@numero-uno-jpn/rstats/descriptive";

const g = qccGroups(diameter, sample).groups;           // one row per subgroup, NaN to fill
const xbar = qcc(g, { type: "xbar" });                   // center, stdDev (UWAVE-R), limits, violations
qcc(g, { type: "R" });                                   // or "S"; stdDev: "UWAVE-SD", "MVLUE-R", "MVLUE-SD", "RMSDF"
qcc(g.slice(0, 25), { type: "xbar", newdata: g.slice(25), nsigmas: 2 });
qcc(defects, { type: "p", sizes, confidenceLevel: 0.99 }); // probability limits
qcc(x, { type: "xbar.one" });                            // individual values, sigma from moving ranges
cusum(g, { decisionInterval: 4, seShift: 1 }); ewma(x, { lambda: 0.2 });
ocCurves(xbar);                                          // beta over shifts c and sizes n
processCapability(xbar, [73.95, 74.05], { target: 74 }); // Cp, Cp_l, Cp_u, Cp_k, Cpm with limits
mqcc([X1, X2], { type: "T2", predLimits: true });        // Hotelling's T2 of subgroup means
medianChart(values, groups);                             // Me-R chart, JIS factors, sizes 2 to 10
```

`qcc` follows `qcc::qcc`: the centers are weighted by the group sizes, the R chart's limits are `center +- k d3(n)
sigma` and the S chart's `center +- k sigma sqrt(1 - c4(n)^2)`, probability limits come from the range distribution, chi-square,
binomial, Poisson and geometric models, and `violations` lists the points beyond the limits (above, then below) and
those of runs of 7 (`runLength`) on one side of the center. As qcc, groups larger than 25 switch the xbar default to
RMSDF; NA statistics are left out of the violations.

## Paired comparisons

Bradley-Terry models and quasi variances are in `/regression`:

```ts
import { btm, btAbilities, countsToBinomial, qvcalc, worstErrors } from "@numero-uno-jpn/rstats/regression";

const f = btm(contests, { outcome: ["win1", "win2"], player1: "player1", player2: "player2", refcat: "A" });
btAbilities(f);                       // ability and s.e. of each player (0 for the reference)
qvcalc(btAbilities(f));               // quasi standard errors, free of the reference
btm(contests, { outcome: ["win1", "win2"], player1: "home", player2: "away", formula: "~ .. + at.home",
  contestCovariates: { "at.home": ["home1", "home2"] } });
btm(contests, { outcome: "won", player1: "p1", player2: "p2", formula: "~ x[..] + (1 | ..)", predictors });
```

`btm` follows `BradleyTerry2::BTm`: without player covariates it is the binomial glm on the +1 / -1 design of the two
players; with player covariates and `(1 | ..)` the abilities are `x_j' beta + e_j` with random player effects, fitted
by PQL to the fixed point where sigma maximizes the REML likelihood of the working model (BTm stops at its tolerance,
about 1e-7 from it). `countsToBinomial` turns a table of wins (rows winners) into pairs.

## Time-dependent ROC

Time-dependent ROC curves for censored event times are in `/tests`, after the timeROC and survivalROC packages:

```ts
import { timeROC, timeROCConfint, timeROCCompare, seSpPPVNPV, survivalROC } from "@numero-uno-jpn/rstats/tests";
import { setSeed } from "@numero-uno-jpn/rstats/distributions";

const f = timeROC(time, status, marker, { times: [365, 730, 1095], iid: true }); // AUC, TP, FP and their s.e.
f.competingRisks ? f.auc1 : f.auc;              // with other events in status: definitions (i) and (ii)
setSeed(1); timeROCConfint(f);                  // pointwise intervals and the simultaneous band (percent)
timeROCCompare(f, timeROC(time, status, marker2, { times: [365, 730, 1095], iid: true }), { adjusted: true });
timeROC(time, status, marker, { times: [365], weighting: "cox", otherMarkers: covariates }); // or "aalen"
seSpPPVNPV(2.5, time, status, marker, { times: [365], iid: true }); // Se, Sp, PPV, NPV of marker > 2.5
survivalROC(time, status, marker, { predictTime: 365 });              // Heagerty's Kaplan-Meier estimator
```

`timeROC` follows `timeROC::timeROC`: the cases are T < t with the cause, the controls T > t (and, for competing risks
definition (ii), the subjects with another event before t); the weights are the inverse probability of censoring from
the Kaplan-Meier of the censoring (or a Cox or Aalen model of it); ties in the marker count 1/2. The iid representation
gives the standard errors, `confint`'s band (multiplier bootstrap, R's draws with the same seed) and `compare`'s tests.
With tied times the iid is the tie-correct form, which differs slightly from R's (see the differences from R).

## Multivariate analysis

The functions in this area are imported from the separate `/multivariate` entry point, not the package root:

```ts
import { dist, asDist, hclust, cutree, kmeans, cmdscale, manova, manovaSummary, lda, ldaPredict, cancor, ca, caSummary, caCoord, mjca, sammon, isoMDS } from "@numero-uno-jpn/rstats/multivariate";

const distances = dist([[0, 0], [1, 0], [0, 2], [4, 3]], { method: "euclidean" });
const tree = hclust(distances, { method: "average" });
cutree(tree, { k: [2, 3] });
kmeans([[1, 1], [1.2, 0.8], [5, 5], [5.2, 4.8]], [[1, 1], [5, 5]]);
const dissimilarities = asDist([[0, 1, 1, Math.SQRT2], [1, 0, Math.SQRT2, 1], [1, Math.SQRT2, 0, 1], [Math.SQRT2, 1, 1, 0]]);
cmdscale(dissimilarities, { k: 2 });

const d = {
  group: ["A", "A", "A", "B", "B", "B", "C", "C", "C"],
  y1: [2.1, 2.4, 1.8, 4.2, 4.5, 3.9, 6.1, 6.4, 5.8],
  y2: [1.2, 1.5, 1.0, 2.8, 2.5, 3.0, 3.9, 4.2, 3.7],
};
const fit = manova("cbind(y1, y2) ~ group", d);
manovaSummary(fit); // Pillai, Wilks, Hotelling-Lawley, Roy, SSP, eigenvalues and coefficients

const discriminant = lda([[1, 2], [1.2, 1.8], [4, 3], [4.2, 2.8]], ["A", "A", "B", "B"]);
ldaPredict(discriminant, { newdata: [[2, 2], [4, 3]] }); // classes, posterior probabilities and scores

cancor([[1, 2], [2, 1], [3, 4], [4, 3]], [[2, 1], [1, 3], [4, 2], [3, 5]]);
```

`manova` fits sequential (Type I) terms. `lda` supports the moment method and leave-one-out cross-validation; `ldaPredict` uses the plug-in method. `cancor` returns the nonzero canonical pairs and the centers used. `ca` performs correspondence analysis; `caSummary` returns its eigenvalue and contribution tables, and `caCoord` constructs a map. `mjca` performs multiple correspondence analysis on categorical columns. `sammon` and `isoMDS` provide non-metric multidimensional scaling.

## Time series

Autocorrelation functions are imported from the separate `/timeseries` entry point:

```ts
import { acf, pacf, ccf } from "@numero-uno-jpn/rstats/timeseries";

const x = [4, 5, 7, 6, 9, 8, 11, 10, 12, 13];
const y = [3, 4, 5, 7, 6, 8, 9, 8, 10, 11];
acf(x, { lagMax: 5 });
pacf(x, { lagMax: 5 });
ccf(x, y, { lagMax: 3 });
```

`acf` returns autocorrelation by default; use `type: "covariance"` for autocovariance or `pacf` for partial autocorrelation. `ccf` returns cross-correlation (or cross-covariance) at lags from `-lagMax` through `lagMax`. Lags are integer observation offsets; calendar time units and R's `frequency` metadata are not represented. Missing values are rejected by default; `naAction: "pass"` omits incomplete pairs.

Models and forecasts follow stats, forecast and tseries (1.20.0). A series is a plain array; its seasonal period is
the `frequency` option (R's `ts` attribute):

```ts
import { arima, predictArima, forecastArima, forecastFromArima, autoArima, ets, forecastEts, stl, mstl, holtWinters,
  ses, hw, thetaf, ndiffs, nsdiffs, boxTest, accuracy, adfTest, kpssTest, forecast } from "@numero-uno-jpn/rstats/timeseries";

const fit = arima(y, { order: [0, 1, 1], seasonal: { order: [0, 1, 1], period: 12 }, frequency: 12 });
predictArima(fit, 12);                                   // stats::predict: pred and se
const a = autoArima(y, { frequency: 12 });               // forecast::auto.arima
forecastFromArima(a, { h: 24 });                         // mean, lower and upper (80% and 95%)
forecastArima(y, { order: [1, 1, 0], includeDrift: true, lambda: "auto" }); // forecast::Arima
forecastEts(ets(y, { frequency: 12 }), { h: 24 });       // the model chosen by AICc among the ETS family
forecast(y, { frequency: 12, h: 24 });                   // forecast::forecast on a series or on any fit
stl(y, { frequency: 12, sWindow: "periodic" }); mstl(y, { frequency: 12 });
ndiffs(y); nsdiffs(y, { frequency: 12 }); boxTest(fit.residuals, { lag: 24, type: "Ljung-Box", fitdf: 2 });
adfTest(y); kpssTest(y);                                 // tseries' unit-root and stationarity tests
```

The fits are exact from 1e-300 to 2^1000 times a series (forecasts equivariant, statistics invariant), missing values
(NaN) are accepted where R accepts them (`arima`, `ets`, `naive`, `mstl`, `kpssTest`, ...) and infinite values are
errors. Short series follow R's rules (`ets` drops the seasonal component when the series is no longer than a period
and fits small models without a likelihood when there are few values; `autoArima` limits its orders). Where R stops
its optimiser early, rStats.js optimises further, so `ets` and `hw` can reach a higher likelihood than R (see the
differences from R).

## Meta-analysis (meta and netmeta)

The meta package's functions and network meta-analysis are in `/tests`, beside metafor's `rma` and `escalc`:

```ts
import { metagen, metabin, metacont, metaprop, metabias, trimfill, metareg, netmeta, netrank, netsplit, netleague }
  from "@numero-uno-jpn/rstats/tests";

const m = metagen(TE, seTE);                             // common and random effects (REML), tau2 with its interval
metabin(e1, n1, e2, n2, { sm: "OR", method: "MH" });     // also metacont, metainc, metacor, metamean, metarate, metaprop
metabias(m); trimfill(m); metareg(m, latitude.map((v) => [v]));
const n = netmeta(TE, seTE, treat1, treat2, studlab, { referenceGroup: "placebo" });
netrank(n);                                              // P-scores
netsplit(n); netleague(n, { digits: 2 });                // direct and indirect evidence, the league table
```

`metagen` and its relatives follow meta's defaults (REML, the Q-profile interval for tau2, H and I2 with Higgins and
Thompson's intervals); the estimates are exact at any scale of TE and seTE. `netmeta` is the frequentist graph-theoretical
model of Rücker (2012) with multi-arm studies; disconnected networks are refused (see `netconnection`).

## Plot data

The values R's plots draw, as arrays of rows for any plotting library, are in the separate `/plot` entry point; the
statistics behind them (`density`, `qqnorm`, `boxplotStats`, `lowess`, `lmHatvalues`, ...) are with the others:

```ts
import { survfit, metagen, lm } from "@numero-uno-jpn/rstats";
import { survPlotData, forestPlotData, lmDiagnosticsData } from "@numero-uno-jpn/rstats/plot";

survPlotData(survfit(time, status, { group })).layers.steps; // [{ x, y, ymin, ymax, group }, ...] from (0, 1)
forestPlotData(metagen(TE, seTE), { labels });               // studies, pooled estimates, diamonds
lmDiagnosticsData(lm(x, y));                                 // plot.lm's four panels with their smooths
```

Each function returns `{ layers, meta }`; `fromRows` turns a layer into columns for Plotly. See
[Plotting the results](https://numero-uno-jpn.github.io/rStats.js/docs/plotting.html).

## Causal inference

Propensity score matching and balance are imported from the separate `/causal` entry point; `clogit` (conditional
logistic regression for the matched sets) is with `coxph` in the main entry point:

```ts
import { clogit, setSeed } from "@numero-uno-jpn/rstats";
import { match, balTab, tableOneSmd } from "@numero-uno-jpn/rstats/causal";

// x = logit(PS) from a logistic model, as in R: ps <- fitted(glm(tr ~ age + male, family = binomial()))
setSeed(1234);
const m = match(tr, logitPs, { estimand: "ATT", M: 1, caliper: 0.2 });
balTab(tr, { age, male }, { match: m, binary: "std" }); // SMDs and variance ratios before and after
tableOneSmd(age, tr); // tableone's SMD
```

`match` follows `Matching::Match(Tr, X, estimand, M, caliper, ties = FALSE, replace = FALSE)`: without ties its pairs are R's; ties among three or more candidates are broken by a documented rule of its own (`tieSizes` reports them). The caliper is in standard deviations of `x` with divisor n. `balTab` takes the weights of the match (`matchWeights`) and uses the SD of the unmatched sample in the denominator (treated for ATT, controls for ATC, pooled for ATE). The matched pairs are analysed with `clogit` (exact or approximate), with `coxph` using the pairs as `strata` and `ties: "breslow"`, or with `mantelhaenTest` using the pairs as strata.

Inverse probability of treatment weighting is in `/causal` too; the weighted analyses (`svyglm`, `survfitCoxph`, and
`lm`, `coxph` and `survfit` with `weights`) are in the main entry point:

```ts
import { svyglm, coxph, survfit, survfitCoxph } from "@numero-uno-jpn/rstats";
import { weightit, trimWeights, weightSummary, balTab } from "@numero-uno-jpn/rstats/causal";

const cov = { age, smoker }; // a string column is a factor
const w = weightit(tr, cov, { method: "glm", link: "logit", estimand: "ATE" });
const t = trimWeights(w, { at: 0.99, lower: true }); // cap the top and bottom 1%
weightSummary(t); // range, coefficient of variation, effective sample size by group
balTab(tr, cov, { weightit: t, binary: "std" }); // SMDs and variance ratios before and after
svyglm(tr.map((v) => [v]), y, { weights: t.weights, family: "quasibinomial" }); // design-based standard errors
survfit(time, status, { group: tr, weights: t.weights }); // weighted Kaplan-Meier (robust variance by default)
survfitCoxph(time, status, tr.map((v, i) => [v, age[i]]), { weights: t.weights, robust: true, newdata: [[0, 50], [1, 50]] });
```

`weightit` follows `WeightIt::weightit(tr ~ ..., method, link, estimand, stabilize)` with the methods `glm` (`ps`;
logit, probit, cauchit, cloglog), `cbps` (logit, probit), `ipt` and `ebal`, and the estimands ATE, ATT, ATC and ATO
(overlap weights; not with ipt or ebal). `stabilize` multiplies the ATE weights of glm by the group's share. cbps, ipt
and ebal solve their balance conditions exactly, so their weights agree with R's to about 1e-8 (R stops its optimisers
earlier). `trimWeights` caps at R's type-3 quantile of the weights that the estimand does not fix. `balTab` with
`weightit` adds the `prop.score` row and splits a string covariate into its levels; for ATO the denominator is the SD of
the overlap-weighted sample. `svyglm` is `survey::svyglm` for `svydesign(ids = ~1, weights)`: the weighted glm with the
sandwich variance times n/(n − 1) and t tests on n − p degrees of freedom.

Mediation, moderation and moderated mediation are in `/causal` as well; `mvrnorm` is with the random numbers:

```ts
import { lm, glm, setSeed } from "@numero-uno-jpn/rstats";
import { mediate, simSlopes, sobelTest, mediationMonteCarlo, moderatedMediation } from "@numero-uno-jpn/rstats/causal";

const m = lm("M ~ X + C", data), y = lm("Y ~ X + M + C", data);
setSeed(1234);
const r = mediate(m, y, data, { treat: "X", mediator: "M", sims: 1000 }); // r.d0, r.z0, r.tau, r.n0 ...
setSeed(1234);
mediate(m, y, data, { treat: "X", mediator: "M", boot: true, bootCiType: "bca" }); // nonparametric bootstrap
simSlopes(lm("Y ~ X * W + C", data), data, { pred: "X", modx: "W", robust: "HC3" }); // slopes at mean ± SD and the Johnson-Neyman interval
sobelTest(m, y, { treat: "X", mediator: "M" });
setSeed(1234);
mediationMonteCarlo(m, y, { treat: "X", mediator: "M" }); // a ~ rnorm, (b, c') ~ mvrnorm, 20000 draws
moderatedMediation(lm("M ~ X * W", data), lm("Y ~ X * W + M * W", data), data, { treat: "X", mediator: "M", moderator: "W" });
```

`mediate` follows `mediation::mediate(model.m, model.y, treat, mediator, treat.value, control.value, covariates,
sims, boot, boot.ci.type, conf.level, robustSE)` for `lm` and binomial (logit, probit) `glm` formula fits, and takes the
data they were fitted on. With the same `setSeed` its draws, estimates, intervals and p-values are R's: the parameters
are drawn with the symmetric square root of their covariance, the mediator for every simulation and observation, and
the bootstrap resamples as one `sample(n, n * sims, replace = TRUE)`. `simSlopes` and `johnsonNeyman` follow
`interactions::sim_slopes` and `johnson_neyman` (t on the residual degrees of freedom for lm, z for glm slopes, t for
the Johnson-Neyman bounds of both, as interactions does). `sobelTest`, `mediationMonteCarlo` and `moderatedMediation`
are ReactiveStat's procedures around them. `mvrnorm` is `MASS::mvrnorm`: R's values in 1 and 2 dimensions, R's
distribution in 3 or more (where LAPACK's eigenvector signs are not reproduced).

From npm all the entry points share one random number generator. From the CDN, `dist/causal.js` shares the generator of
the per-area bundles: seed it with `setSeed` from `dist/distributions.js` (`dist/rstats.js` has a generator of its
own). Fits from `lm` and `glm` of any bundle are accepted.

