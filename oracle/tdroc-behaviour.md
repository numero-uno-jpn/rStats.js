# Time-dependent ROC curves: timeROC, SeSpPPVNPV, confint, compare and survivalROC (1.19.0)

Reference basis: the documentation of timeROC 0.4.1 (`timeROC`, `confint.ipcwsurvivalROC`, `compare`, `SeSpPPVNPV`,
`plotAUCcurve`, `plotAUCcurveDiff`), pec 2025.6.24 (`ipcw`), timereg 2.0.7 (`aalen`), survivalROC 1.0.3.1
(`survivalROC`), and the papers they cite: Heagerty, Lumley and Pepe (2000); Uno et al. (2007); Hung and Chiang (2010);
Blanche, Dartigues and Jacqmin-Gadda (2013); Blanche, Latouche and Viallon (2013). R 4.6.2 public-call results
(x86_64) in `experiments/tdroc119-*.R`, every attempt (the failed ones too) in `experiments/tdroc119-log.md` (cited
as "log n"), summaries on Issue #569. No R or package source was consulted.

The calls followed are ReactiveStat's (`scripts/検査の正確度/時間依存性ROC.php`): `timeROC(T, delta, marker, cause = 1,
times, ROC = TRUE, iid = TRUE)`, `confint()$CI_AUC`, `compare()`, the Youden cutoff from TP − FP of the first time.

## Scope (decided by the user, 2026-11-26)

- timeROC broadly: `timeROC` (marginal, Cox and Aalen censoring weights; a single event and competing risks; iid
  standard errors), `confint`, `compare` (also `adjusted = TRUE`), `SeSpPPVNPV`, and the values behind `plotAUCcurve`
  and `plotAUCcurveDiff`. No plots.
- survivalROC's **KM estimator only** (Choice 1: NNE left out).
- Out: incident/dynamic ROC (risksetROC).
- Entry point `/tests`.

## Notation

n subjects with times T_i, event indicators δ_i (0 censored; 1, 2, ... event kinds), markers M_i; `cause` the event
of interest (default 1). Competing risks when some δ is neither 0 nor `cause`. For an evaluation time t:

- **Cases:** T_i < t and δ_i = cause (strict: an event at exactly t is not a case; log 2).
- **Controls (i):** T_j > t. **Controls (ii):** controls (i) and the subjects with another event before t
  (T_j < t, δ_j ∉ {0, cause}; log 12).
- **Censoring KM G (marginal weights):** at each distinct time u, R(u) = #(T > u) + #(T = u, δ = 0) (the subjects with
  an event at u are left out of the risk set at u) and C(u) = #(T = u, δ = 0); G(s) = Π_{u ≤ s} (1 − C(u) / R(u))
  (log 3). (A risk set of zero contributes no factor.)
- Weights: a case a_i = 1 / G(T_i−) (the left limit); a control (i) 1 / G(t); an other-event control 1 / G(T_j−).
- h_ij = [M_i > M_j] + [M_i = M_j] / 2.

## timeROC: estimates (log 1-3, 12, 39-45)

- AUC (no competing risks) and AUC_1 / AUC_2 (competing risks) = Σ_ij h_ij a_i c_j / (Σ a Σ c), c the control
  weights of the definition.
- TP and FP: one row per distinct marker value in decreasing order ("marker > the k-th largest value"), plus a last
  row with everyone positive (TP = FP = 1); the first row is "marker > max" (TP = FP = 0). TP the cases'
  weighted proportion, FP the controls'. The AUC equals the trapezoid over these rows.
- CumulativeIncidence = Σ a / n; survProb = the survivors' weighted mass #(T > t)-weights / n (with the marginal
  weights exactly the Kaplan-Meier of any event; with Cox or Aalen weights R reports the weighted mass too).
- Stats per time: Cases, survivor at t, [Other events at t,] Censored at t (counts of T < t & cause, T > t,
  [T < t & other,] the rest).
- `times`: R adds 0 when a single time is given (AUC NA there); rStats.js: the times as given (a single time is fine;
  noted in the differences).
- Weights (`weights`): `IPCW.times` (n × times) and `IPCW.subjectTimes` (G(T_i−)), rows in the order of the sorted
  times (as R).
- **Cox weights:** G(s | Z) from the Cox model of the censoring, Surv(T, δ = 0) ~ marker + other markers, Efron ties,
  the baseline of survfit's coxph (the existing `coxph` / `survfitCoxph`); subjects' weights 1 / G(T_i− | Z_i), times'
  1 / G(t | Z_j). R fits it with rms's cph, which stops 5e-7 short of the maximum: rStats.js uses the maximum
  (weights within about 6e-7 of R's; log 39, 40). The controls' weights then differ, so TP / FP / AUC are weighted
  in both arguments.
- **Aalen weights:** the additive hazards model of the censoring with the marker (and other markers): at each
  censoring time u, dB(u) = (X'X)^-1 X' dN(u) over the subjects at risk (the marginal weights' risk set: T > u or
  censored at u; without ties the same as T ≥ u), X = [1, Z]; G(s | Z_i) =
  exp(−Σ_{u ≤ s} [1, Z_i] dB(u)) truncated to [0, 1] (log 41, 42; equal to 1e-14 without ties). **Tied censoring times
  are taken together** (all censorings at u in dN(u)); R's timereg breaks ties with random noise (log 44, 45), so with
  ties rStats.js differs from R within R's random spread (Choice 2). A singular X'X (fewer subjects at risk than
  columns): that increment and the later ones are not estimable; G is then left at its last value. The covariates
  enter centred and scaled by powers of 2 (the same fitted G).
- iid = TRUE with Cox or Aalen weights: an error, as R ("Weighting must be marginal for computing the iid
  representation").

## timeROC: the iid representation and standard errors (log 4-8, 12-22; Choice 3)

Standard errors = sd(iid column) / √n (sd with n − 1). The iid representation of AUC (and of AUC_1) is the influence
function IF_k of AUC = N / (F S), N = Σ_ij h a c / n², F = Σ a / n, S = Σ c / n:

IF_k = (IF_k(N) − AUC (S IF_k(F) + F IF_k(S))) / (F S), with
IF_k(N) = Σ_j h_kj a_k c_j / n + Σ_i h_ik a_i c_k / n − 2 N + Σ_ij h_ij a_i c_j (q_k(i) + q_k(j)) / n²,
IF_k(F) = a_k − F + Σ a_i q_k(i) / n, IF_k(S) = c_k − S + Σ c_j q_k(j) / n,

where q_k(i) is the censoring martingale's term of subject i's weight. **rStats.js uses the tie-correct form
(Choice 3):** with dΛ(u) = C(u) / R(u) and k at risk at u when T_k > u or (T_k = u, censored),
q_k(i) = n Σ_{u < T_i} ([T_k = u, censored] − [k at risk at u] dΛ(u)) / R(u) for a weight 1 / G(T_i−), and the same
over u ≤ t for 1 / G(t). Without ties this equals R's value (log 6, 8, 13-14); with ties R mixes a by-time jump with a
positional compensator and depends on the data order within ties (log 8), which rStats.js does not follow.

- **Definition (ii):** R's iid is the influence of N / (F (1 − F)) (log 22), centred on a value that differs from the
  reported AUC_2 when events fall at t. rStats.js (Choice 3) centres on AUC_2 = N / (F S) with S = 1 − F − M, M = the
  weight mass of the subjects with an event at exactly t (Σ over T = t, δ ≠ 0 of 1 / G(t−) / n), and IF(S) = −IF(F) −
  IF(M): without events at t, M = 0 and this is R's form exactly.
- mat_iid_rep rows in the order of the sorted times (as R).
- The form's correctness is checked independently by the infinitesimal jackknife: with subject weights ω (all sums
  and the KM weighted), n dθ/dω_k at ω = 1 by finite differences equals the exact-derivative variant of the formula
  (the KM's term with 1 / (R(u) − C(u)) in place of 1 / R(u)); the reported form keeps the usual asymptotic 1 / R(u).

## confint (log 9-11; Choice 3)

- CI = AUC ∓ qnorm((1 + level) / 2) sd, **in percent (times 100) and not rounded** (R rounds to 2 decimals; Choice 3);
  rows per time ("t=..."), columns the percentages (e.g. "2.5%", "97.5%"); not clipped to [0, 100] (as R).
- Simultaneous band: CB = AUC ∓ C.alpha sd (percent), C.alpha = the type-7 `level` quantile of max_t |Z_t| over n.sim
  simulations (default 2000), Z_t = Σ_i ξ_i iid_it / (√n sd_t), ξ = the n × n.sim matrix of `rnorm(n * n.sim)` filled
  by column (iid not centred; sd with n − 1). With the same `setSeed`, equal to R's (log 11) wherever the iid is (no
  ties).
- Competing risks: CI_AUC_1, CB_AUC_1, C.alpha.1 and the same for definition (ii) (the simulation for (i) first, then
  for (ii)): **one set of draws for both definitions** (log 49).
- Requires marginal weights and iid (R's errors: to be recorded from the fixture).

## compare (log 9; Choice 4)

- z_t = (AUC_x − AUC_y) / (sd(iid_x − iid_y) / √n), p = 2 (1 − Φ(|z|)) (equal); `adjusted = TRUE` adds the adjusted
  p-values P(max_t |Z_t| ≥ |z_t|) for Z ~ N(0, Cor), Cor the correlation of the differences' iid columns (equal), and
  Cor. R integrates with mvtnorm's randomized GenzBretz (default absolute tolerance 1e-3; R's values were 3e-6 to 3e-5
  from the exact ones, log 50); rStats.js computes Q = P(max |Z| >= b) deterministically and directly (log 53): Q =
  2 Σ_i P(|Z_j| < b for j < i, Z_i >= b), each term by pnorm, pbvnorm, adaptive Gauss-Legendre over Z_3 >= b of the
  conditional pbvnorm, or (four times and more, or a correlation within 1e-9 of ±1) Genz's separation of variables with
  the exceedance first, a Richtmyer lattice and fixed shifts, to 1e-6 relative. Compared with R at 1e-4. Competing
  risks: for each definition, Cor one matrix per definition.

## SeSpPPVNPV (log 23-29)

- Positive: M > c (strict). TP = the cases' weighted proportion positive; FP (FP_1, FP_2) the controls'.
- PPV = TP F / (TP F + FP S); NPV = (1 − FP) S / ((1 − FP) S + (1 − TP) F); with competing risks PPV and NPV_2 with
  definition (ii)'s FP_2 and S_2, **NPV_1 = (1 − FP_1) S_1 / ((1 − FP_2) S_2 + (1 − TP) F)**.
- Stats add "Positive (X>c)" and "Negative (X<=c)".
- iid (mat_iid_rep_Se, _Sp1, _Sp2, _PPV, _NPV1, _NPV2) and their standard errors (vect_se_*): each quantity a function
  of the weighted totals W(f) = Σ w f / n, IF_k(W) = w_k f_k − W + Σ w_i f_i q_k(i) / n, the delta method; Sp2's with
  the denominator 1 − F (R's; log 29), generalized as definition (ii)'s AUC to 1 − F − M. Present also without
  competing risks (as R).

## The values behind plotAUCcurve and plotAUCcurveDiff (log 46)

Both return NULL in R. `timeROCAucCurve(fit)`: times, AUC and confint's pointwise interval (and band). `timeROCAucDiff
(x, y)`: times, AUC_x − AUC_y and the pointwise interval from sd(iid_x − iid_y) / √n (no band: R returns nothing to
check its simulation against).

## survivalROC, KM (log 30)

- cut.values: −Inf, then the sorted distinct markers, or the given cut.values sorted; **the last cut's point is (0, 0)**
  whatever lies above it (log 48). S(c, t) = KM_{M > c}(t) P(M > c), S(t)
  the KM at predict.time (`Survival`); TP(c) = (P(M > c) − S(c, t)) / (1 − S(t)), FP(c) = S(c, t) / S(t) (not monotone
  and possibly above 1, as R). AUC = the trapezoid over the points in the order of cut.values with signed FP steps.
- `method: "NNE"` (R's default): an error in rStats.js ("NNE is not offered"; Choice 1); `entry` (left truncation): not
  offered.

## R's failures (log 47)

- R's competing-risks iid fails ("incorrect number of dimensions") at a time with a single survivor; rStats.js computes.

## API decisions (mine)

- `timeROC(time, delta, marker, options)` with `times` (required), `cause` (default 1), `weighting`, `otherMarkers`
  (rows per subject), `iid` (default false), `roc` (default true). Result in camelCase: `auc` (or `auc1`, `auc2`),
  `tp`, `fp` (or `fp1`, `fp2`) as one array per time, `cumulativeIncidence`, `survProb`, `stats`, `n`, `weights`,
  `inference` (`iid`: rows per subject in sorted order, `sd`).
- `timeROCConfint(fit, { level, nSim })`, `timeROCCompare(x, y, { adjusted })`, `seSpPPVNPV(cutpoint, time, delta,
  marker, options)`, `timeROCAucCurve`, `timeROCAucDiff`, `survivalROC(time, status, marker, { predictTime, cutValues })`.

## Edge cases (the comprehensive pass, log 51, 52; `test/tdroc119Edge.test.ts`)

- Scales 1e±150 and 1e±300 of the marker and of the times, mixed scales and a common value 1e8: every function exactly
  invariant where only orders matter (marginal weights, survivalROC, confint, compare, the curves); Cox and Aalen to
  1e-12 (coefficients absorb the scale; Aalen's own scaling by powers of 2). The Cox fit runs with coxph's timefix off:
  aeqSurv's tolerance merged all times at 1e-150 and nearly equal times at 1e8 (R's cph is not scale-free at 1e-300
  either: 0.8164 for 0.8082). Cox weights come from one survfit curve raised to exp(β'(z − means)) (the relation of
  survfit's curves for a Cox fit), so that n = 5000 takes 45 ms.
- NA (NaN) in the time, delta, marker or other markers: the subject is dropped, as R; ±Infinity is an error.
- No case or no control at t, all censored, an absent cause, n = 1: NaN (R's NA). n = 2 works (R fails).
- Cox weights with a constant or collinear covariate, or without censoring: computed (R fails); all censored: NaN.
- Aalen weights: covariates dependent on the intercept and the earlier ones are left out (Gram-Schmidt, relative
  tolerance 1e-7); R's fit then fails silently and gives weights 1 (the unweighted AUC exactly, log 52).
- SeSpPPVNPV with the cutpoint beyond the markers: TP, FP 0 (or 1), PPV (or NPV) NaN, as R.
- confint: a NaN time's row is NaN and left out of the band's maximum (R leaves the row out).
- compare of a marker with itself: NaN p-values (R stops with an error about NA AUCs).
- survivalROC: from two given cuts on the last point is (0, 0), a single given cut is computed (log 52); predictTime
  before the first time: S = 1 and TP = 0 / 0 = NaN (R reads the KM at the first time, 0.95: R's error, not followed);
  all censored: S = 1, AUC NaN, as R.
- Large n (5000): iid 25 ms, Cox 45 ms, Aalen 24 ms, survivalROC 0.7 s, confint (2000 draws) 0.6 s; compare with
  adjusted p-values at four or more times takes seconds (Genz's lattice per time).
