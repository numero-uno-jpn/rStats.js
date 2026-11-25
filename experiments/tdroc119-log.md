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
