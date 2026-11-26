# 1.19.0 (time-dependent ROC: timeROC, survivalROC): the record of the trial and error

The clean-room evidence for how R's behaviour was found: every attempt in order, the failed ones too, with what each
showed. Nobody read the source of R or of the GPL packages; each finding comes from the documentation (the help pages,
printed with `help()`) and from the output of exported functions compared with candidate formulas written for these
experiments (from the help pages and the papers they cite: Heagerty, Lumley and Pepe 2000; Uno et al. 2007; Hung and
Chiang 2010; Blanche, Dartigues and Jacqmin-Gadda 2013; Blanche, Latouche and Viallon 2013). All runs: R 4.6.2 x86_64
(`rstats-oracle-amd64:4.6.2`), timeROC 0.4.1, survivalROC 1.0.3.1, timereg 2.0.7, pec 2025.6.24, scripts checked with
`scripts/r-experiment-check.mjs`. Issue #569 has the summaries.

Some scripts were edited in place between runs (marked "replaced"); the attempt is described here and the final
script keeps the search that succeeded.

## timeROC without competing risks, marginal weights (2026-11-26)

1. `tdroc119-basic.R`: 40 subjects with ties in the marker and in the times (also an event and a censoring at the same
   time), times 5, 10, 15. Structure: class `ipcwsurvivalROC`, fields TP, FP, AUC, times, CumulativeIncidence,
   survProb, n, Stats, weights, inference, computation_time, iid. TP and FP have **one row per distinct marker value
   plus one** (26 rows for 25 values): row k is "marker > the k-th largest value", the last row everyone positive
   (TP = FP = 1), the first row 0. Stats: columns Cases, survivor at t, Censored at t. inference: mat_iid_rep_1,
   mat_iid_rep_2, vect_sd_1, vect_sd_2 (NA without competing risks), vect_iid_comp_time. weights: class IPCW
   (pec), fields times, IPCW.times, IPCW.subjectTimes, fit, call, method ("marginal"). A single time t gives
   times = c(0, t) and AUC c(NA, AUC). survProb = the Kaplan-Meier survival at t (equal).
   Candidates (cases T <= t with delta = 1, weights 1 / G(T-) or 1 / G(T), controls T > t, the censoring KM with
   everyone at risk at their time): **no match** (AUC 0.8113 against 0.8339 at t = 5; FP equal, TP not). Stats had
   17 cases at t = 5 where "T <= t" gives 18, and one more censored.
2. `tdroc119-basic2.R`: cases **T < t** (strict) give Stats' counts (17, 20, 22). The weights still did not match
   (AUC 1.2e-3 off): IPCW.times (G(t)) is 0.5887 where the censoring KM gives 0.6306. IPCW.subjectTimes did not match
   G at the subjects' times in the data order (0.58 off) for any candidate.
3. `tdroc119-basic3.R`: candidate E, **the censoring KM with the subjects who have an event at u left out of the risk
   set at u** (events before censorings: at risk at u = #(T > u) + #(T = u, censored)), **case weights 1 / G(T_i-)
   (left limit), control weight 1 / G(t)**: AUC equal to 1e-16, TP to 1e-16, FP equal, IPCW.times equal, and
   **IPCW.subjectTimes is G(T_i-) in the order of the sorted times** (difference 0). **CumulativeIncidence = sum of the
   case weights / n** (0.454, 0.57958, 0.67968 exactly; 1 - KM(t) is 0.4904). The AUC is the weighted proportion of
   case-control pairs with M_case > M_control, ties counted 1/2 (= the trapezoid over the TP / FP rows).

## The iid representation and the standard errors (2026-11-26)

4. `tdroc119-iid.R`: a candidate influence function of AUC = N / (F S) by the delta method, the censoring KM's part
   through the censoring martingale with the tie-corrected risk set of 3 (header of the script). mat_iid_rep_1 is
   n x (number of times), **its rows in the order of the sorted times**: the first row equal (0.36590692), the others
   from 0.07% to 100% off. vect_sd_1 close to sd / sqrt(n) of the candidate (0.077003 against 0.077049).
5. `tdroc119-iid2.R` (first version, replaced): variants (the discrete-jump factor 1 / (1 - dL); the cases' martingale
   term at T_i- or T_i; the row order within ties): **NaN** in the T_i variants (dL = 0 / 0 at the last time, which has
   only events). (second version, replaced): only the raw influence values written, the row orders tried outside R.
   (final version, dL = 0 where the risk set is empty): best "cases at T_i" (0.012 off). A censored subject at T = 1
   has influence exactly 0 in the candidate but 0.00024 in R, and R's values for cases in the same situation at the
   same time differ (0.365907, 0.366147): the position within tied times matters.
6. `tdroc119-iid3.R`: candidate P, the censoring martingale over the subjects sorted by time (ties in the data order)
   with the risk set n - p + 1 at position p: **every case and control row equal**; the censored subjects' rows not.
   **vect_sd_1 = sd(mat_iid_rep_1 column) / sqrt(n)** (sd with n - 1; equal to the last digit). The columns' means
   are not 0 (0.0019, 0.0021, 0.0028).
7. `tdroc119-iid4.R`: a censored subject's own compensator through or before its position, its jump with n - p or
   n - p + 1: no match (0.059 off). Of the censored rows, those first among their tied times matched, the others not.
8. `tdroc119-iid5.R`: the censoring part written out as (1 / (F n)) sum_i a_i (TP_i - AUC) q_k(i) and a grid over
   k's own jump (which cases count as after k: positions, times strictly after, times at or after), its denominator
   (n - p_k + 1, #(T >= T_k), the tie-corrected risk set) and the compensator (positional or by time). **Equal to
   1.2e-15 for one combination:** k's jump `n / #(T >= T_k) * sum of e_i over the cases with T_i >= T_k (i != k)`,
   e_i = a_i (TP_i - AUC); the compensator positional, `sum over positions p <= p_k of n dL(p) / (n - p + 1) * sum of
   e_i over the positions after p`, dL(p) = [p censored] / (n - p + 1). So R's iid representation mixes a by-time
   jump with a positional compensator and depends on the data order within tied times (kept as R, to be checked on
   data without ties in the fixture). Its full form, with a_i = [T_i < t, delta_i = 1] / G(T_i-), b_j = [T_j > t] /
   G(t), h_ij = [M_i > M_j] + [M_i = M_j] / 2, N = sum h a b / n^2, F = sum a / n, S = sum b / n:
   `IF_k = (sum_j h_kj a_k b_j / n + sum_i h_ik a_i b_k / n - 2 N - AUC (S (a_k - F) + F (b_k - S))) / (F S)
   + (jump_k - comp_k) / (F n)`.

## confint and compare (2026-11-26)

9. `tdroc119-confint.R`: two markers, set.seed(1) before confint. **CI_AUC = 100 (AUC -+ qnorm((1 + level) / 2)
   vect_sd_1) rounded to 2 decimals** (68.29, 98.49 against the unrounded 68.2866, 98.4891), rows "t=5", ...,
   columns "2.5%", "97.5%"; the upper limit is not clipped at 100 (101.1). Fields CI_AUC, CB_AUC, C.alpha.
   **compare: p = 2 (1 - pnorm(|z|)), z = (AUC1 - AUC2) / (sd(iid1 - iid2) / sqrt(n))** equal to the last digit
   (field p_values_AUC); with adjusted = TRUE p_values_AUC is a 2-row matrix (unadjusted, adjusted) and Cor the
   correlation of the differences' iid columns (equal). The adjusted p-values (0.0393, 0.1024, 0.1234) come from
   mvtnorm's randomized GenzBretz integration (abseps 1e-6), whose code is GPL (not read) and whose random values
   cannot be reproduced: to be computed to about 1e-7 and compared at that order (Choice). C.alpha (2.2643) did not
   match draws of N(0, correlation) by mvrnorm (2.4189), by the covariance (2.4426), or a multiplier form with a
   centred iid matrix (2.2957, 2.3176).
10. `tdroc119-confint2.R`: N(0, correlation) draws as rnorm(n.sim p) by row or by column times the symmetric or
    Cholesky root, quantile types 7, 1, 8, max |Z| or max Z: none (0.118 off at best). R's C.alpha moves much with the
    seed (2.264 with seed 1, 2.420 with seed 2): not a 3-dimensional normal maximum.
11. `tdroc119-confint3.R`: a multiplier bootstrap over the subjects: **C.alpha = quantile(max_t |Z_t|, level) (type 7),
    Z_t = sum_i xi_i iid_it / (sqrt(n) sd_t), xi = matrix(rnorm(n * n.sim), n, n.sim) (column by column: rnorm(n) per
    simulation), the iid columns not centred, sd_t with n - 1**: equal to 4e-16. CB_AUC = 100 (AUC -+ C.alpha sd),
    rounded as CI_AUC (to check in the fixture).

## Competing risks, marginal weights (2026-11-26)

12. `tdroc119-cr.R`: 50 subjects, delta in 0, 1, 2 (cause 1), integer times (events of both kinds and censorings at
    the evaluation times 4, 8, 12). Class `ipcwcompetingrisksROC`, fields TP, FP_1, AUC_1, FP_2, AUC_2, times,
    CumulativeIncidence, survProb, n, Stats (columns Cases, survivor at t, Other events at t, Censored at t),
    weights, inference (vect_sd_1, vect_sd_2, mat_iid_rep_1, mat_iid_rep_2), computation_time, iid. survProb = the KM
    of any event. Candidates (header): definition (i) (controls T > t) — **AUC_1, FP_1, mat_iid_rep_1 and vect_sd_1 all
    equal** (1.6e-15) with the single-cause form. Definition (ii): **AUC_2 and FP_2 equal with the other-event controls
    T_j < t (strict) weighted 1 / G(T_j-)** (T_j <= t: 4.9e-3 off); its iid 0.25 to 1.6 off.
13. `tdroc119-cr2.R`: the same on continuous times (no ties, no event at an evaluation time): definition (ii)'s rows
    equal up to the first censored subject, not after.
14. `tdroc119-cr3.R`: a grid over the other-event controls' censoring term (as the cases' A, at t B, none C) and the
    controls' total (S1: S = sum c / n with IF(S) = c_k - S + sum c q / n; S2: S = 1 - F with IF(S) = -IF(F)):
    **(A, S2) equal to 1.3e-15** on the continuous data.
15. `tdroc119-cr4.R`: (A, S2) on the tied data of 12: equal at t = 12, 0.228 and 0.0205 off at t = 4 and 8. (At first I
    misread which evaluation times have events at t: `at_t` is a matrix written by rows, i.e. cause-1 events at t,
    then other events, then censorings; t = 12 has none, t = 8 one cause-1 event, t = 4 four cause-1 events, one other
    event and three censorings.)
16. `tdroc119-cr5.R` and `tdroc119-cr6.R`: S = 1 - F' with F' counting the cause-1 events at t (and the four mixtures
    of F and F' between the denominator and IF(S)): none (0.157 to 1.7 off at t = 4, 8).
17. `tdroc119-cr7.R`: the iid's cases taken as T <= t (with R's AUC or with that of those cases): worse (1.4 to 1.8).
18. `tdroc119-cr8.R`: the remaining mixtures (S = sum c / n with IF(S) = -IF(F); 1 - F with the c-based IF): none.
19. `tdroc119-cr-fit.R` (an analysis of 16's output in R, no package call): **failed**: fromJSON simplified the nested
    lists to matrices and the rows were misaligned (even t = 12 gave a residual of 1.4). Redone outside R: the
    difference to (A, S2) is not linear in (a_k, c_k, 1) (residual 6e-3 at t = 8): another term differs. With the KM
    weights, sum a + sum c = n exactly when no event falls at t, so S = 1 - F there (which is why every S matched at
    t = 12).
20. `tdroc119-cr9.R`: hypothesis H: inside the iid, every uncensored non-case is a control (also the cause-1 events
    at exactly t), so that sum a + sum c = n: worse (1.3).
21. `tdroc119-cr10.R`: a grid over the role of the cause-1 events at t inside the iid (left out, case, control) and S1,
    S2, S6, S7: none better than (out, S2).
22. `tdroc119-cr11.R`: S8, **the influence function of N / (F (1 - F))**, i.e. (A, S2) with the AUC inside the formula
    taken as N / (F (1 - F)) instead of R's value N / (F S) (they differ when events fall at t): **equal to 1.7e-15
    at every time, and vect_sd_2 to the last digit.** So definition (ii)'s iid is centred on N / (F (1 - F)), not on
    the reported AUC_2 (kept as R).

## SeSpPPVNPV (2026-11-26)

23. `tdroc119-sespppv.R`: classes `ipcwsurvivalSeSpPPVNPV` (TP, FP, PPV, NPV, Stats, inference, computation_time, iid,
    n, times, weights, cutpoint) and `ipcwcompetingrisksSeSpPPVNPV` (TP, FP_1, FP_2, PPV, NPV_1, NPV_2, ...).
    inference: mat_iid_rep_Se, _Sp1, _Sp2, _PPV, _NPV1, _NPV2 and vect_se_ of each (also without competing risks).
    TP, FP equal to the weighted proportions above the cutpoint; **PPV and NPV equal to the Bayes forms**
    TP F / (TP F + FP S) and (1 - FP) S / ((1 - FP) S + (1 - TP) F) (the direct forms, sums over #(M > c), 0.13 off);
    with competing risks PPV and NPV_2 with definition (ii)'s FP_2 and S_2; NPV_1 neither form (0.03 to 0.12 off). No
    cutpoint was a marker value, so > and >= gave the same.
24. `tdroc119-sespppv2.R`: a cutpoint at a marker value: **positive is M > c** (>= 0.08 off), Stats' columns "Positive
    (X>c)", "Negative (X<=c)" (after Cases, survivor at t, [Other events at t,] Censored at t). **NPV_1 = (1 - FP_1) S_1
    / ((1 - FP_2) S_2 + (1 - TP) F)** (the denominator P(M <= c) estimated with definition (ii)), equal.
25. `tdroc119-sespppv-iid.R`: each quantity as a function of weighted totals W(f) = sum w f / n, the totals' influence
    with R's censoring term (tdroc119-iid5.R), the delta method by a numerical gradient: **Se, Sp1, PPV, NPV1, NPV2
    equal to 1e-10** (the gradient's error), single cause and competing risks; Sp2 as 1 - W(c2 P) / (1 - W(a)) or
    1 - W(c2 P) / W(c2): equal only where no event falls at t (0.2 to 0.5 off elsewhere).
26. `tdroc119-sespppv-iid2.R`: Sp2 as W(c2 neg) / (1 - W(a)) or W(c2 neg) / W(c2): none.
27. `tdroc119-sespppv-iid3.R`: Sp2 with the denominator 1 - W(a'), a' the cases of T <= t: none (0.22 off).
28. Looking at R's rows (single cause, t = 5): Sp2's rows are Sp1's times S_1 / (1 - F) on the controls and 0 elsewhere
    (no term from F's influence).
29. `tdroc119-sespppv-iid4.R`: **IF(Sp2)_k = -(IF_k(W(c2 P)) - FP_2 IF_k(W(c2))) / (1 - W(a))**: equal to 7e-16, single
    cause and competing risks, and every vect_se_ = sd(iid) / sqrt(n) to 1e-11 (the numerical gradient).

## survivalROC (2026-11-26)

30. `tdroc119-survivalroc.R` (first version, replaced): **broke the JSON**: survivalROC without span or lambda prints
    "method = NNE requires either lambda or span! " to stdout. (second version, replaced): capturing it failed: it
    then stops with an error whose message is "0". (final version, captured): the result has cut.values (**-Inf
    first, then the sorted distinct markers**), TP, FP, predict.time, Survival (the KM at predict.time, also for NNE),
    AUC. **KM: TP(c) = (P(M > c) - S(c, t)) / (1 - S(t)), FP(c) = S(c, t) / S(t), S(c, t) = KM_{M > c}(t) P(M > c)**,
    equal to 2e-16 (FP is not monotone and can exceed 1: 1.0043). **AUC = the trapezoid over the points in the order of
    cut.values with signed FP differences** (equal to the last digit; the sorted trapezoid 0.69508 against 0.69607).
    NNE with the neighbourhood |F_n(M_i) - F_n(M_j)| < span and S_i the neighbours' KM: NaN (0 / 0 where no
    neighbour is at risk); with those times skipped: 0.077 off.
31. `tdroc119-survivalroc2.R`: a grid (S(t) the mean of S_i or the KM; half-width span / 2, span, 2 span; < or <=;
    F_n by max or mean rank): none (0.057 at best).
32. `tdroc119-survivalroc3.R`: a continuous marker, also windows of +-k ranks: none (0.055 at best).
33. Recovering R's S(t) and S_i(t) from the single-subject TP / FP steps (dTP = (1 - S_i) / (n (1 - S)), dFP = S_i /
    (n S)): S(t) = 0.508503 at every step (neither the KM 0.450 nor the candidates' means), S_i simple fractions.
34. `tdroc119-survivalroc4.R`: neighbourhoods by the marker's value (|M_i - M_j| < span, <=, < span / 2): none (0.8).
35. `tdroc119-survivalroc5.R`: the smallest marker's neighbours: R's S_i = 3/4 where the neighbours' KM is 2/3; one
    neighbour is censored at T = 0 (my data rounded the times) and R seems to count it at risk.
36. `tdroc119-survivalroc6.R`: times without 0 (rounded, plus 0.1): the grid of 31 unchanged (0.055).
37. `tdroc119-survivalroc7.R`: continuous marker; for each subject, every window (a below, b above in the marker's
    order) whose KM equals R's S_i: many windows fit each subject, no rule could be read (b = 4 for many, a varying).
38. `tdroc119-survivalroc8.R`: the risk set not reduced by censoring (S_i = 1 - D / N): none (0.55).
    **The NNE estimator is not found after 9 attempts.** It is left as a Choice for the user (implement the published
    definition of Heagerty et al. 2000 and document the difference, leave NNE out, or keep looking).

## Cox and Aalen censoring weights (2026-11-26)

39. `tdroc119-cox.R`: weighting = "cox": the fit is **rms's cph** (class cph, rms, coxph; through pec's ipcw);
    weights fields times, IPCW.times (an n x times matrix), IPCW.subjectTimes, fit, call, method. Candidate G(s | Z)
    from survival's coxph of the censoring (Surv(T, delta == 0) ~ marker + other_markers, ties efron) predicted by
    survfit: **IPCW.subjectTimes = G(T_i- | Z_i) in the sorted order, 2.8e-7 off**; IPCW.times not matched in the data
    order. Breslow ties, or the marker only as covariate: 0.015 to 0.05 off. **iid = TRUE with cox: error "Weighting must
    be marginal for computing the iid representation"** (also for aalen, per the help). weighting = "aalen" runs (fit
    class aalen) and some of its IPCW.times are exactly 1 at t = 10 while below 1 at t = 15.
40. `tdroc119-cox2.R` (with coxph at eps 1e-14; coxph.control warned that its tolerance should be below eps): IPCW.times
    **in the sorted order**: 6.0e-7 off; cph's coefficients (-0.0171346839, 0.0814351598) are 5e-7 from coxph's exact
    maximum (-0.0171351877, 0.0814350771): **R's Cox weights are cph's (Efron ties) at its looser stopping**; with the
    exact maximum they agree to 6e-7 (to be compared at that order: a Choice).
41. `tdroc119-aalen.R`: candidate Aalen additive hazards of the censoring with the marker, least-squares increments
    dB(u) = (X'X)^-1 X' dN(u) over the subjects at risk at each censoring time, G = exp(-[1, z] B), truncated to [0, 1]
    or not; risk set T >= u or with events at u left out: the structure as R's (exactly 1 where exp of a negative
    cumulative hazard), the values 0.05 to 0.2 off on the tied data.
42. `tdroc119-aalen2.R`: continuous times: **equal to 1.1e-14 with the risk set T >= u (either variant) and the
    truncation to [0, 1]**; R's weights did not depend on the seed there.
43. `tdroc119-aalen3.R`: the tied data with each censoring taken on its own at its position (ties in the data order,
    events first, censorings first): none (0.055 at best).
44. timereg's help of aalen: "The program assumes that there are no ties, and if such are present random noise is added
    to break the ties."
45. `tdroc119-aalen4.R`: the tied data: the same seed gives the same weights; seeds 1 and 2 differ by 0.14 in
    IPCW.times; the AUC over 20 seeds ranges 0.821 to 0.832 at t = 5. **With tied times R's Aalen weights are random**
    and cannot be reproduced (a Choice: a deterministic treatment of ties).

## plotAUCcurve, plotAUCcurveDiff (2026-11-26)

46. `tdroc119-plotvalues.R`: both return NULL (drawn to a null device). The values behind plotAUCcurve are AUC and
    confint's CI_AUC / CB_AUC; behind plotAUCcurveDiff the difference of two AUCs with a pointwise interval from the
    difference's iid (as compare) and a simultaneous band whose simulation cannot be checked (nothing is returned): a
    Choice (offer the band with confint's multiplier scheme, or only the pointwise interval).

## The fixture (2026-11-26)

47. `oracle/timeroc.R` (fixture `test/fixtures/timeroc.json`): R's competing-risks iid **fails with "incorrect number
    of dimensions"** (`Mat_data_cont1[, c("T", "marker")]`) at a time with exactly one subject surviving past t (crSmooth,
    t = 12.7: Stats 14 cases, 1 survivor, 21 other events, 14 censored); the other times of the same data run. The
    confint / compare data for competing risks moved to times 2.1, 4.3, 6.7. rStats.js computes at such a time (a
    single control is a valid estimate; noted in the differences). Marginal IPCW.times is a vector, one per time.
    survivalROC's KM AUC at predict.time 30 is 1.0144 (above 1, as the spec's FP above 1 allows).
48. `tdroc119-survivalroc9.R` (after the fixture, where the given cut 1.5 with two markers above it gave TP = FP = 0;
    the data here are not exactly the fixture's, t2 was not drawn): **given cut.values are sorted** (c(-1, 0, 1.5, 0.5)
    as c(-1, 0, 0.5, 1.5)), −Inf prepended, and **the last cut's point is (0, 0)** whatever is above it (cut 1.0 with
    7 markers above: 0; with a further cut 3, the cut 1.5 is computed, 0.0486, and 3 gives 0).
49. (From the fixture, no new R run) confint with competing risks: C.alpha.1 equal with the first n x n.sim draws;
    C.alpha.2 not with the next draws (2.2996 vs 2.2556) nor with (ii) first; **equal (1e-15) with the same draws as
    (i)**: R uses one matrix of multipliers for both definitions.
50. (From the fixture) compare(adjusted = TRUE): my multivariate normal probability (three times: Gauss-Legendre
    over Z_1 of the conditional pbvnorm) agrees with an independent lattice computation to 1e-8; R's adjusted
    p-values are 3e-5 to 3e-6 from both, within mvtnorm's default GenzBretz absolute tolerance (1e-3). The tests
    compare with R at 1e-4.

## The edge pass (2026-11-26)

51. `tdroc119-edge.R` (rms's cph printed "X matrix deemed to be singular" to stdout before the JSON; the output is
    read from its last line): equal markers AUC 0.5 with sd 1.7e-17; times before the first time, at or beyond the
    last, all censored, an absent cause: NA (R adds the time 0 to a single time; with a single negative time it gives
    times (-5, 0)); no censoring as the uncensored AUC; **n = 2 fails ("incorrect number of dimensions")**; **an NA marker:
    the subject is dropped** (Stats over 39); cox with a constant or collinear other marker fails ("invalid formula
    "NULL": not a call"), cox without censoring fails ("missing value where TRUE/FALSE needed", after "Ran out of
    iterations"); **cox at times x 1e-300 gives another AUC** (0.8164 for 0.8082: rms's cph is not scale-free there);
    times + 1e8 and markers x 1e300 as the plain data. SeSpPPVNPV with a cutpoint above all markers: TP 0, FP 0, PPV NA,
    NPV 0.5282, se of Se 0 (warnings "no non-missing arguments to max"); below all: TP 1, FP 1, PPV 0.4718, NPV NA.
    compare of a fit with itself, adjusted: an error about NA AUC estimates. confint with a time before the first: that
    row left out, C.alpha over the other times. survivalROC: predict.time before the first time gives Survival 0.95 (see
    52); after the last, the KM there; all censored: AUC NA, Survival 1; a single cut 0 computed normally (TP 0.784);
    equal markers AUC 0.5; markers x 1e300 and times x 1e-300 as the plain data.
52. `tdroc119-edge2.R`: survivalROC: **with two or more given cuts the last point is (0, 0)** (c(0, 1): 1 gives 0; c(1, 3):
    3 gives 0 and 1 is computed, 0.273; even c(0, 0): the second 0 gives 0), **a single given cut is computed** (1.0: TP
    0.273, FP 0.0494; 1.5: TP 0.0936, FP 0: its subset has no one at risk at 6.3, KM 0); log 48's rule holds from two
    cuts on. Given cuts are sorted (c(0.5, 0) as c(0, 0.5)). predict.time 0.5 and 1 (before and at the first time 1,
    with two events at 1): Survival 0.95 both: **before the first time R reads the KM at the first time** (S(0.5) is 1);
    TP (1, 0, 0, 0) and FP above 1. timeROC's aalen weights on the data without ties: a collinear (2 x marker) or a
    constant other marker gives **exactly the unweighted AUC** (0.75175, 0.71795): R's Aalen fit fails silently and the
    weights are all 1; the marker alone 0.74990, 0.72063.
