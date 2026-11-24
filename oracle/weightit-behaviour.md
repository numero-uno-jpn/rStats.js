# Inverse probability of treatment weighting: weightit, trim, weight summary, balance, svyglm, adjusted survival (draft, 1.13.0)

Reference basis: the documentation of WeightIt 2.1.0 (`weightit`, `method_glm`, `method_cbps`, `method_ipt`,
`method_ebal`, `trim`, `summary.weightit`), CBPS 0.24, cobalt 5.0.0 (`bal.tab`, `col_w_smd`), survey 4.5 (`svydesign`,
`svyglm`), sandwich 3.1.3 (`vcovHC`) and survival 3.8-12 (`coxph`, `survfit.coxph`); Imai & Ratkovic (2014), "Covariate
balancing propensity score", JRSS-B 76, 243-263; Graham, Pinto & Egel (2012), "Inverse probability tilting for moment
condition models with missing data", Review of Economic Studies 79, 1053-1079; Hainmueller (2012), "Entropy balancing
for causal effects", Political Analysis 20, 25-46; Li, Morgan & Zaslavsky (2018), "Balancing covariates via propensity
score weighting", JASA 113, 390-400. R 4.6.2 public-call results (x86_64) in `experiments/iptw113.R`, recorded on Issue
#563. No R or package source was consulted.

The calls followed are ReactiveStat's (`scripts/傾向スコア/逆確率重み付け.php` and the weighted regressions beside it):
`weightit(tr ~ covariates, data, method, link, estimand, stabilize)` (stabilize only for ps/glm with ATE),
`trim(w, at, lower = TRUE)` with at = 0.9, 0.95, 0.98, 0.99, `summary(w)`, Kish's ESS by group, `bal.tab(w, stats =
c("mean.diffs", "variance.ratios"), thresholds = c(m = 0.1, v = 2), un = TRUE, binary = "std", continuous = "std")`;
then `svyglm(y ~ ..., design = svydesign(ids = ~1, weights = w), family = binomial())`, `lm(..., weights = w)` +
`vcovHC(type = "HC3")`, `coxph(Surv(time, status) ~ ..., weights = w, robust = TRUE)` and
`survfit(coxph, newdata = <treatment 0 and 1, other covariates at their mean or mode>)`.

Data of `iptw113`: n = 80 (32 treated), x1 continuous, x2 binary, x3 a 3-level factor; treatment from a mild logistic
model (propensity scores within about 0.1-0.8). A first draft with a strong x1 effect (scores 0.0005-0.998) made CBPS
and ipt fail to converge and ebal degenerate in R; that kind of data is kept for the edge-case check.

## Settled

- **ps and glm.** `method = "ps"` is reported as `method = "glm"`; both give `ps` = `fitted(glm(tr ~ X, binomial(link)))`
  (to 1e-15) for logit, probit, cauchit and cloglog, and the weights are the textbook ones of that ps (ratio 1 to 12
  digits): ATE 1/p, 1/(1-p); ATT 1, p/(1-p); ATC (1-p)/p, 1; ATO 1-p, p. No normalisation.
- **stabilize.** Only with estimand ATE for ps/glm: the weights are multiplied by the group's share of the sample
  (n1/n for treated, n0/n for controls; 0.4 and 0.6 in `iptw113`). Any other estimand with ps/glm is an error
  ("`stabilize` can only be supplied when `estimand = "ATE"`"). With cbps, ipt and ebal stabilize is ignored with a
  warning.
- **cbps** (just-identified, the default): ps = linkinv(X beta) with beta solving the weighted balance of every column of
  the model matrix (intercept included) between the groups under the estimand's textbook weights: ATE and ATO make the
  two groups' weighted means equal (to each other, not to the sample's), ATT moves the controls to the treated means
  (treated weight 1), ATC the treated to the control means. With logit and ATO the solution is glm's own (the logit
  score equations are exactly the ATO balance; 3e-10). Weights = the textbook formula of cbps's ps (ratio 1).
- **ipt** (logit; ATE, ATT, ATC; ATO is an error): a separate tilting per weighted group. ATE: the treated weights
  1/p1(x) with p1 = plogis(X b1) such that the treated weighted means of X equal the full-sample means (sum of weights
  n), the controls 1/(1 - p0(x)) likewise; `ps` holds p1 for treated rows and p0 for control rows. ATT: controls weighted
  p/(1-p) to the treated means (sum n1), ATC the treated (1-p)/p to the control means.
- **ebal** (ATE, ATT, ATC; ATO is an error; no ps): the same balance targets as ipt with the entropy weights; each group's
  weights sum to its target size (ATE: n per group; ATT: controls sum to n1; ATC: treated sum to n0).
- **R's optimisers stop early.** ipt's control weights sum to 80.000000014 instead of 80 (relative 2e-10); cbps and ebal
  likewise satisfy the balance only to the optimiser's tolerance. An exact solution differs from R by about that much.
- **trim(w, at, lower).** at < 1: the cap is the type-3 quantile (`quantile(type = 3)`) at `at` of the weights of the
  units that are trimmed: all units for ATE and ATO, the non-focal group for ATT (controls) and ATC (treated) (message
  "Trimming weights where treat is not 1 ..."). Weights above the cap are set to it; with `lower = TRUE` weights below the
  type-3 quantile at 1 - at are raised to it. Nothing else changes (no renormalisation, stabilised weights trimmed as
  they are). at >= 1: the `at` largest (and with lower the `at` smallest) are set to the (at+1)-th largest (smallest).
  Every cap of the 52 trims in `iptw113` matched type 3 and, where they differ, not the other types. A numeric vector of
  weights is trimmed the same way over all of it.
- **summary(weightit)**, by group (Treated, Control): `weight.range` (min, max), `weight.top` (the 5 largest, shown in
  increasing order with row names; among equal weights the earliest rows, listed in reverse), `coef.of.var` = SD (n - 1)
  / mean, `scaled.mad` = mean(|w / mean(w) - 1|), `negative.entropy` = mean(r log r) with r = w / mean(w), `num.zeros`,
  `effective.sample.size` (Unweighted n, Weighted Kish (sum w)^2 / sum w^2); `weight.mean` (group means) only for
  stabilised weights. All reproduced to the last 1-2 digits.
- **bal.tab on a weightit** (ReactiveStat's call): rows `prop.score` (Distance; only when the method has a ps), then the
  covariates, a factor expanded to every level (`x3_a`, `x3_b`, `x3_c`, Binary). SMD denominators: ATE the root mean of
  the two groups' unweighted variances (binary p(1 - p)), ATT the treated SD, ATC the control SD (as `balTab` of 1.12.0),
  **ATO the SD of the full sample weighted by the ATO weights** (continuous: weighted variance with divisor
  sum w - sum w^2 / sum w; binary p(1 - p) of the weighted proportion), the same denominator for `Diff.Un` and
  `Diff.Adj`. `V.Ratio` only for continuous rows. `Observations` = n and Kish's ESS per group, the same as
  `summary`'s (stabilising does not change it). The default `binary` is the raw difference.
- **svyglm** with `svydesign(ids = ~1, weights)`: the coefficients are the weighted glm's; `vcov` = sandwich HC0 x n/(n-1)
  (80/79 to 12 digits, gaussian; the same for binomial); `df.residual` = n - p; `summary` uses t with that df.
  binomial and quasibinomial give the same table (binomial warns "non-integer #successes"); `dispersion` is printed but
  does not enter the binomial SEs.
- **survfit(coxph, newdata).** One curve per newdata row (a matrix `surv`, `std.err`, `lower`, `upper`, `cumhaz`, times =
  the distinct event and censoring times); `conf.type = "log"`, 0.95. The curves and their SEs are the same whether the
  coxph was fitted with `robust = TRUE` or not (exactly), so the SE is model-based. `summary(...)$table` has records,
  n.max and n.start (the sum of the weights), events, rmean, se(rmean), median and its limits.

## Open (for the fixture stage)

1. The exact SE formula of `survfit.coxph` with case weights (model-based, both the hazard and the coefficient parts) and
   of `rmean`/`se(rmean)`; to be matched against R in the fixture, from the literature (Kalbfleisch & Prentice).
2. `svyglm`'s printed `dispersion` (gaussian 1.0355 in `iptw113`): which weighted residual sum it is.
3. cbps with probit and every estimand, ipt and ebal: R's iterative answers vs an exact solve — the tolerance (Choices).
