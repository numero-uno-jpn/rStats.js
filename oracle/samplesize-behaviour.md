# Sample-size and power: reference behaviour

Issue: #527  
Base: `78d6e30683f2eb5e7dc79b310245812835637004`  
Stage: 1 only (behaviour specification and R fixture generators)

## Evidence and clean-room boundary

The reference environment is R 4.6.2. The pinned reference packages are epiR 3.0.0, exact2x2 1.7.0, powerSurvEpi 0.1.5, and clinfun 1.1.6.

This document is based only on:
- calls to the packages' public functions and the resulting values, warnings, and errors;
- public package help/reference manuals and vignettes;
- the cited statistical papers.

No source code from epiR, exact2x2, clinfun, or powerSurvEpi was read or used. The numerical examples below are observations, not a claim that every observed package result is mathematically correct. In particular, anomalous results are recorded as compatibility questions, not recommended behaviour.

## Easy to get wrong

- In the epiR parallel-trial functions, `n` is total $n_t+n_c$, and `r` is $n_t/n_c$; it is not the per-arm size.
- `nfractional=FALSE` ceilings each arm separately, then adds the two integer sizes.
- `powerPaired2x2` is an exact McNemar **power** calculation, not a sample-size solver. `strict=FALSE` excludes rejection in the wrong direction; `errbound` changes the numerical result.
- `powerSurvEpi` contains two distinct model families: Freedman's clinical-trial approximation and the Schoenfeld/Latouche epidemiological Cox model. In the latter, `rho2=0` does not make the competing-risk subdistribution hazard interpretation identical to Schoenfeld's cause-specific hazard.
- `ph2simon` returns a matrix of candidate designs. Minimax, optimal, and admissible designs are selected/displayed by the public print method; the printed table is not the full returned matrix.
- R's observed negative power and internal errors are defects to document, not acceptable probability/API semantics.
## API

The existing rStats.js power API uses an options object and a single unknown quantity. A consistent JS API should use `null` for the unknown quantity rather than R's `NA`, and should return named structured values. Suggested names if retaining R-derived naming:

| Reference function | Candidate JS name |
|---|---|
| `epi.ssequb` / `epi.ssequc` | `epiSsequb` / `epiSsequc` |
| `epi.ssninfb` / `epi.ssninfc` | `epiSsninfb` / `epiSsninfc` |
| `epi.sssupb` / `epi.sssupc` | `epiSssupb` / `epiSssupc` |
| `powerPaired2x2` | `powerPaired2x2` |
| `powerCT.default` / `ssizeCT.default` | `powerCT` / `ssizeCT` |
| `powerEpi.default` / `ssizeEpi.default` / `numDEpi.default` | `powerEpi` / `ssizeEpi` / `numDEpi` |
| `ph2simon` | `ph2Simon` |

The pilot-data wrappers should not silently overload the summary-parameter methods; if later accepted, use explicitly named pilot/data variants or a clearly discriminated input type.

## 1. epiR: parallel equivalence/equality, non-inferiority, and superiority

### Public functions and shared interface

| Design | Binary outcome | Continuous outcome |
|---|---|---|
| Equivalence / equality | `epi.ssequb` | `epi.ssequc` |
| Non-inferiority | `epi.ssninfb` | `epi.ssninfc` |
| Superiority | `epi.sssupb` | `epi.sssupc` |

For all six functions:
- `n` is the **total** number of participants, not the per-group size.
- `r = n.treat / n.control`.
- Supply `n = NA` and a target `power` to solve for sample size; supply `power = NA` and `n` to solve for power.
- `alpha` defaults to 0.05.
- `nfractional` defaults to `FALSE`; `TRUE` retains fractional group sizes. When `FALSE`, each group size is rounded up separately and `n.total` is their sum.
- The result is a list containing `n.total`, `n.treat`, `n.control`, and `power`; `delta` is also present for the margin-based designs.
- `epi.ssequb/c` use `type = "equivalence"` by default. `type = "equality"` ignores `delta`.
- `epi.sssupb/c` require `sided.test` (1 or 2). Non-inferiority is one-sided.

Let $D = \mu_t - \mu_c$, with $\mu$ denoting a proportion for binary outcomes or a mean for continuous outcomes. For binary outcomes, $V_t = p_t(1-p_t)$ and $V_c = p_c(1-p_c)$; for continuous outcomes, $V_t = V_c = \sigma^2$. With $r=n_t/n_c$,

$$
SE = \sqrt{V_t/n_t + V_c/n_c}.
$$

The sample-size expressions documented in the supplied brief can be written as

$$
n_c = \frac{$z_A+z_B$^2$V_t/r+V_c$}{E^2}, \qquad
n_t = r n_c, \qquad n_{total}=n_t+n_c.
$$

| Design | $E$ | $z_A$ | $z_B$ |
|---|---:|---:|---:|
| Non-inferiority | $D+\delta$ | $z_{1-\alpha}$ | $z_{power}$ |
| Superiority | $D-\delta$ | $z_{1-\alpha/s}$, $s=1$ or 2 | (z_{power}) |
| Equivalence | $\delta-|D|$ | $z_{1-\alpha}$ | $z_{1-(1-power)/2}$ |
| Equality | $D$ | $z_{1-\alpha/2}$ | (z_{power}) |

For a fixed total (n), the allocation is (n_t=nr/(1+r)) and (n_c=n/(1+r)).

The normal-approximation power expressions supplied for the margin-based tests include:

$$
Power_{NI}=\Phi\left$\frac{D+\delta}{SE}-z_{1-\alpha}\right$
$$

and, for the continuous superiority case,

$$
Power_{Sup}=\Phi\left$\frac{D-\delta}{SE}-z_{1-\alpha/s}\right$
+\Phi\left$-\frac{D-\delta}{SE}-z_{1-\alpha/s}\right$.
$$

The equivalence power expression in the brief is not safe to adopt without correction: it can return a negative value. The probability of rejecting both one-sided null hypotheses must be non-negative; this needs a mathematically reviewed specification rather than literal reproduction of the observed expression.

### Observed results and discrepancies

The following calls ran in the pinned R environment without warnings:

| Probe | Observed result |
|---|---|
| Binary equivalence, fractional, $r=1.5$ | $n=3546.860111$, $n_t=2128.116067$, $n_c=1418.744044$ |
| Same, integer | $n=3548$, $n_t=2129$, $n_c=1419$ |
| Binary equivalence power, $n=120$, $r=1.5$ | power = **-0.41113653** |
| Binary equality size, $r=1$ | $n_t=n_c=384.595107$ |
| Binary equality size, $r=2$ | $n_t=384.595107$, $n_c=192.297553$ |
| Binary equality power, $n=120$, $r=2$ | power = 0.18191075 |
| Continuous equivalence, fractional, $r=1.5$ | $n=223.016858$, $n_t=133.810115$, $n_c=89.206743$ |
| Same, integer | $n=225$, $n_t=135$, $n_c=90$ |
| Continuous equivalence power, $n=120$, $r=1.5$ | power = 0.38432158 |
| Continuous equality size, $r=1$ | $n_t=n_c=22.604774$ |
| Continuous equality size, $r=2$ | $n_t=33.907160$, $n_c=16.953580$ |
| Continuous equality power | error: `object 'n.treat' not found` |
| Binary non-inferiority size, $r=2$ | $n=60.022326$, $n_t=40.014884$, $n_c=20.007442$ |
| Binary non-inferiority power, $n=120$, $r=2$ | power = 0.96932044 |
| Continuous non-inferiority size, $r=2$ | $n=56.778587$, $n_t=37.852392$, $n_c=18.926196$ |
| Continuous non-inferiority power, $n=120$, $r=2$ | power = 0.97557685 |
| Binary superiority size, one-sided, $r=1$ | $n=195.094028$ |
| Binary superiority size, two-sided, $r=1$ | $n=247.675761$ |
| Binary superiority power, $n=120$, $r=1.5$ | power = 0.49587551 |
| Continuous superiority size, one-sided, $r=1$ | $n=98.920916$ |
| Continuous superiority size, two-sided, $r=1$ | $n=125.582076$ |
| Continuous superiority power, $n=120$, $r=1.5$ | power = 0.76525932 |

Important anomalies / boundaries:

1. **Binary equality size and allocation ratio.** With `type="equality"`, changing (r) from 1 to 2 leaves `n.treat` unchanged and only divides `n.control` by two. This is inconsistent with the general unequal-allocation variance expression. Do not copy this behaviour without an explicit compatibility decision.
2. **Continuous equality power.** The power path errors instead of returning a value.
3. **Equivalence power can be negative.** A negative power is not a probability. The binary example above is a reproducible counterexample. The continuous formula in the brief also has a negative-output counterexample.
4. **Binary superiority with unequal allocation.** The supplied brief records a mismatch for `epi.sssupb` at $r=0.5$: R returned 0.3023368 where the stated normal formula gives 0.4279172. The equal-allocation case matched. This remains unresolved; do not generalize the equal-allocation formula to unequal allocation without an independent derivation.
5. **Unreachable / boundary inputs.** A non-inferiority case with the assumed effect on the wrong side of the margin errors with “Target power is not reachable”. Continuous non-inferiority power at `power=0` or `power=1` errors with `object 'rval' not found`. Binary non-inferiority with both proportions zero returns a zero sample size. Continuous superiority with zero effect margin $E=0$ returns `Inf`.
6. The observed calls emitted no warnings. This is not an exhaustive statement about all invalid inputs.

**Recommendation:** implement the intended statistical definitions, not these defects. Keep each defect as a regression fixture / explicit compatibility note; do not encode a negative power, a ratio-insensitive sample size, or an internal R error as desired API behaviour.

## 2. exact2x2: exact McNemar power

### Function and inputs

`powerPaired2x2(pb, pc, npairs, sig.level=0.05, alternative=c("two.sided","one.sided"), strict=FALSE, nullOddsRatio=1, errbound=10^-6, ...)`

- `pb`: probability of a discordant pair with control=0 and test=1.
- `pc`: probability of a discordant pair with control=1 and test=0.
- $1-p_b-p_c$ is the probability of a concordant (non-informative) pair.
- `npairs` is the number of pairs.
- `nullOddsRatio` is the null odds ratio (and the boundary for a one-sided test).
- `...` is passed to the public `exact2x2` test; this includes the two-sided method option `tsmethod`.
- The return value is a `power.htest` object with `power`, `npairs`, `pb`, `pc`, `sig.level`, `alternative`, `nullOddsRatio`, `note`, and `method`.

The power is the probability, under the specified discordant-pair probabilities, of rejecting the exact McNemar null test. The public help documents that the exact test is evaluated over possible paired outcomes and that `errbound` can omit extreme tails to speed the calculation.

- `alternative="one.sided"` automatically selects the direction with greater power; swapping $p_b$ and $p_c$ produced the same power in the probe.
- With `alternative="two.sided"` and `strict=FALSE` (the default), rejections in the wrong direction are not counted. The two-sided calculation is effectively the correct one-sided direction at `sig.level/2`.
- `strict=TRUE` includes rejection in the wrong direction.
- `errbound=0` requests the full calculation. For positive `errbound`, the help says extreme tails are omitted and power may be underestimated by at most `errbound`.
- There is **no** `ssPaired2x2` function. The separate `ss2x2` function is for independent binomial samples and is not a paired McNemar sample-size solver.

### Observed values

For $p_b=0.5$, $p_c=0.3$, $n=40$, $alpha=0.05$:

| Setting | Power |
|---|---:|
| Default | 0.226697528108813 |
| `strict=TRUE` | 0.226862069302937 |
| `alternative="one.sided"` | 0.351100897593317 |
| Reversed one-sided probabilities | 0.351100897593316 |
| `errbound=0` | 0.226696901160739 |
| `errbound=1e-8` | 0.226697537804026 |
| `errbound=0.01` | 0.225074949686046 |
| `nullOddsRatio=2` | 0.00420514402365869 |

Additional boundaries: `sig.level=0` and `npairs=0` returned power 0; `pb=pc=0` also returned 0. With `sig.level=1`, the default non-strict two-sided calculation returned 0.8826434, not 1, consistent with its internal half-alpha one-sided calculation. A probability sum `pb + pc > 1` errors (“probabilities must be finite, non-negative and not all 0”). At $pb=pc=0.5$, the calculation is accepted with note “no non-informative pairs” and power 0.0192386444095977. At $n=1000$, $pb=.5,pc=.3$, power was 0.999998690656616.

For this parameter set, `tsmethod="central"`, `"minlike"`, and `"blaker"` all produced the same power (0.226862069302937) with `strict=TRUE`; the method name was reflected in the returned `method` string. The same three methods also produced the default power (0.226697528108813) with `strict=FALSE`.

**Unresolved numerical issue:** the `errbound=1e-8` result is about $6.37\times10^{-7}$ *above* the `errbound=0` result. The default `1e-6` result is also above it by about $6.27\times10^{-7}$. This does not match the documented direction (“may underestimate”) and the smaller bound does not bound this observed difference. The `errbound=0.01` result is below the exact result. The reason has not been established; do not promise the documented one-sided error guarantee without further experiments. The 100,000-pair probe reached its output only at the 120-second experiment limit, so large exact calculations are also a performance concern.

**Recommendation:** include the exact power function as a power calculation. Do not claim a paired sample-size solver exists. Decide separately whether rStats.js should add an integer search for the minimum pair count; that would be a new rStats.js contract, not a direct wrapper of exact2x2.

## 3. powerSurvEpi: survival / epidemiological sample size and power

This package exposes two different model families in the requested scope. They should not be conflated.

### Freedman clinical-trial approximation

Public functions:
- `ssizeCT.default(power, k, pE, pC, RR, alpha=0.05)`
- `powerCT.default(nE, nC, pE, pC, RR, alpha=0.05)`

Here $k=n_E/n_C$, $p_E,p_C$ are the probabilities of failure over the maximum follow-up period, and (RR) is the postulated experimental/control hazard ratio. The test is two-sided.

The sample-size calculation uses

$$
m=\frac{1}{k}\left$\frac{kRR+1}{RR-1}\right$^2
  $z_{1-\alpha/2}+z_{1-\beta}$^2,
\qquad
n_E=\frac{mk}{kp_E+p_C},
\qquad
n_C=\frac{m}{kp_E+p_C}.
$$

The returned group sizes are rounded up separately. The power calculation uses $m=n_Ep_E+n_Cp_C$ and

$$
Power=\Phi\left(
\frac{\sqrt{k m}\,|RR-1|}{kRR+1}-z_{1-\alpha/2}
\right).
$$

The formula assumes large samples / a central-limit approximation.

Observed default-method values:
- `powerCT.default(nE=200,nC=200,pE=.3707,pC=.4890,RR=.7)` = 0.638338942525040.
- The same calculation with $n_E=240,n_C=120$ = 0.574584549396927.
- At $RR=1$, the returned power is 0.025 (not 0.05).
- `ssizeCT.default(power=.8,k=1,pE=.3707,pC=.4890,RR=.7)` returns `c(294,294)`; with $k=2$, it returns `c(409,205)`.
- With $RR=1.000001$, the returned sample sizes are about $3.14\times10^{13}$ per group; this is finite but not practically usable.

### Schoenfeld / Latouche epidemiological Cox model

Public functions:
- `ssizeEpi.default(power, theta, p, psi, rho2, alpha=0.05)`
- `powerEpi.default(n, theta, p, psi, rho2, alpha=0.05)`
- `numDEpi.default(power, theta, p, rho2, alpha=0.05)`

Here `theta` is the hazard ratio, `p` is the prevalence of the binary covariate of interest, `psi` is the proportion of subjects experiencing the event of interest, and `rho2` is the **squared** correlation between the covariate of interest and another covariate.

$$
n=\frac{$z_{1-\alpha/2}+z_{1-\beta}$^2}
{[\log$\theta$]^2p(1-p)\psi$1-\rho^2$}.
$$

`ssizeEpi.default` returns the total number of subjects and rounds it up. `powerEpi.default` inverts the same expression for a supplied total (n). `numDEpi.default` returns the required number of events/deaths; its formula omits `psi`:

$$
D=\frac{$z_{1-\alpha/2}+z_{1-\beta}$^2}
{[\log$\theta$]^2p(1-p)$1-\rho^2$}.
$$

Observed default-method values:
- `powerEpi.default(n=139,theta=2,p=.39,psi=.505,rho2=.132^2)` = 0.801722164331304.
- `ssizeEpi.default(power=.8,theta=2,p=.39,psi=.505,rho2=.132^2)` = 139.
- `numDEpi.default(power=.8,theta=2,p=.39,rho2=.132^2)` = 70.
- With `rho2=0`, the same size calculation returns 94.
- `theta=1`, $p=0$, `rho2=1`, and power 0 or 1 each produced `Inf` in the tested size calculation.

Important interpretation: the package documentation notes that when `rho2=0` the expression has the same form as Schoenfeld's formula, but the hazard ratio in Latouche et al. refers to a **subdistribution hazard** for a particular competing-risk event, whereas Schoenfeld's formula concerns a cause-specific hazard. These are not interchangeable merely because `rho2=0`.

### Pilot-data wrappers

The package also provides:
- `ssizeCT` / `powerCT`, which take a `Surv(time,status) ~ group` formula and a data frame and estimate $p_E,p_C$ from pilot survival data. The returned object includes intermediate matrices as well as the sample size or power.
- `ssizeEpi` / `powerEpi` / `numDEpi`, which estimate $p,\rho^2,\psi$ (or $p,\rho^2$ for `numDEpi`) from pilot covariates and event indicators.

These are materially different interfaces from the `.default` functions and introduce data-frame, factor-level, censoring, and pilot-estimation semantics.

The documented `Oph` pilot-data example was also run. `ssizeCT` returned `ssize=c(294,294)`, with estimated `pC=0.4890109890` and `pE=0.3707227963`. `powerCT` returned power 0.6383559798, slightly different from `powerCT.default` because it uses the estimated pilot probabilities. The wrappers also return `mat.lambda` and `mat.event` intermediate matrices.

**Recommendation:** the first implementation should cover the six summary-parameter default functions above. Defer all pilot-data wrappers (including the specifically queried `ssizeCT`) to a separate decision, unless the user explicitly wants a formula/data-frame API now. Also defer the package's non-binary covariate, interaction, and stratified extensions.

## 4. clinfun: Simon's two-stage Phase II design

Public function: `ph2simon$pu, pa, ep1, ep2, nmax=100$`.

- `pu`: unacceptable response rate.
- `pa`: desirable response rate; documentation says it should exceed `pu`.
- `ep1`: maximum type-I error under `pu`.
- `ep2`: maximum type-II error under `pa`.
- `nmax`: maximum total sample size; at most 1000.

The returned list includes `pu`, `pa`, `alpha`, `beta`, `nmax`, and `out`. `out` is a matrix of best two-stage designs, with one row for each feasible total sample size (n). Its six columns are:

| Column | Meaning |
|---|---|
| `r1` | first-stage futility threshold |
| `n1` | first-stage sample size |
| `r` | final response threshold |
| `n` | maximum total sample size |
| `EN(pu)` | expected sample size under `pu` |
| `PET(pu)` | probability of early termination under `pu` |

The trial stops after stage 1 when responses are at or below `r1`; the treatment is declared desirable only when final responses exceed `r`. The public `print` method presents the minimax, optimal, and admissible designs and the `qLo/qHi` intervals.

Observed for `pu=.2, pa=.4, ep1=.05, ep2=.10, nmax=100`:
- 56 rows, one for each total $n=45,ldots,100$.
- Minimax: `r1=5, n1=24, r=13, n=45`, `EN=31.2262589`, `PET=0.6558924`.
- Admissible: `r1=4, n1=20, r=14, n=49`, `EN=30.7402003`, `PET=0.6296483`.
- Optimal: `r1=4, n1=19, r=15, n=54`, `EN=30.4349149`, `PET=0.6732881`.

Other observed behaviour:
- With `nmax=50`, the optimal design is at $n=49$ and `print` emits “Optimal sample size too close to nmax. Try increasing nmax”.
- With `nmax=1000`, 956 rows were returned (first total $n=45$, last $n=1000$); no warning was emitted in the captured print.
- `nmax=1` and a design with no feasible solution return “No feasible solution found”.
- `nmax=1001` errors with “nmax cannot exceed 1000”.
- `pa < pu` was not rejected by a dedicated argument check in the observed call; it ended as “No feasible solution found”.
- The documented edge case `pu=.8, pa=.95, ep1=.05, ep2=.20` has the same minimax and optimal design; `print` displays that design twice, with qLo=0 and qHi=1.
- With `pu=0`, many designs tie on `EN(pu)`; the printed optimal design is the first minimum. `pa=1` was accepted.

**Recommendation:** expose this as a design-enumeration result, not as a scalar power/sample-size function. Return the candidate matrix and selected minimax/optimal/admissible designs as structured data; do not make the formatted console output the API contract. Keep `ph2single`, group-sequential designs, and post-design inference out of this initial scope.

## Where the packages are wrong or inaccurate

- **epiR:** the observed negative equivalence powers are not probabilities; binary equality sample size ignores the allocation ratio in the observed unequal-allocation case; continuous equality power errors; binary superiority power with unequal allocation does not match the supplied normal approximation. These need independent statistical definitions rather than literal emulation.
- **exact2x2:** for the tested McNemar case, positive `errbound` values returned a power slightly above the `errbound=0` result. In particular, `errbound=1e-8` differed by about $6.37\times10^{-7}$, exceeding the requested bound and in the opposite direction to the documented “underestimate” description. The reason is unknown.
- **powerSurvEpi:** the documented one-tail normal approximation in `powerCT.default` returns 0.025 at $RR=1$ with $\alpha=0.05$, rather than the nominal two-sided 0.05. This is an observed boundary consequence of the approximation and should be stated explicitly if compatibility is desired.
## References

- epiR 3.0.0 reference manual: help for `epi.ssequb`, `epi.ssequc`, `epi.ssninfb`, `epi.ssninfc`, `epi.sssupb`, and `epi.sssupc`. The help cites Chow, Shao & Wang (2008), Julious (2004), Machin et al. (2009, 2018), Pocock (1983), and Wang et al. (2017).
- exact2x2 1.7.0 reference manual: “Power for exact McNemar's test” and the `exact2x2` help for two-sided methods.
- Freedman LS (1982). Tables of the number of patients required in clinical trials using the log-rank test. *Statistics in Medicine* 1:121–129.
- Schoenfeld DA (1983). Sample-size formula for the proportional-hazards regression model. *Biometrics* 39:499–503.
- Latouche A, Porcher R, Chevret S (2004). Sample size formula for proportional hazards modelling of competing risks. *Statistics in Medicine* 23:3263–3274.
- Simon R (1989). Optimal Two-Stage Designs for Phase II Clinical Trials. *Controlled Clinical Trials* 10:1–10.
- Jung SH, Carey M, Kim KM (2001). Graphical Search for Two-Stage Designs for Phase II Clinical Trials. *Controlled Clinical Trials* 22:367–372.
- Jung SH, Lee T, Kim K, George SL (2004). Admissible two-stage designs for phase II cancer clinical trials. *Statistics in Medicine* 23(4):561–569.
## Decisions for the user

Recommended defaults are in **bold**.

1. **epiR scope:** include the six listed parallel-trial methods (equivalence/equality, non-inferiority, superiority; binary and continuous). Defer the other epiR sample-size families (`epi.sscompb/c`, cohort/case-control, cross-sectional, diagnostic, and surveillance designs).
2. **Mathematical correctness vs package compatibility:** **implement the mathematically valid probability and allocation formulas; do not reproduce the negative-power, ratio-insensitive, or internal-error behaviours above.** Confirm this is the intended policy for this roadmap.
3. **Integer handling:** **retain the fractional calculation and expose the integer required group sizes separately (ceil each group independently)**, or instead make the epiR-compatible integer result the default?
4. **Exact McNemar:** include `powerPaired2x2`-style power only, or add a new integer sample-size search for the minimum pair count? `exact2x2` itself has no paired sample-size function.
5. **Exact-test methods:** should `strict`, `nullOddsRatio`, `errbound`, and `tsmethod` all be public options, or should the initial API expose only the default test?
6. **Survival pilot wrappers:** **defer `ssizeCT`/`powerCT` formula/data wrappers and `ssizeEpi`/`powerEpi`/`numDEpi` pilot-data wrappers**; include only the default summary-parameter functions. Or include `ssizeCT` pilot-data estimation in this first roadmap item?
7. **Simon designs:** include `ph2simon` enumeration with structured minimax/optimal/admissible results; defer `ph2single`, group-sequential designs, and inference after the design.
8. **Names:** accept the candidate JS names above, or prefer domain-oriented names (e.g. `sampleSizeEquivalenceBinary`)?

## rStats.js's choices
