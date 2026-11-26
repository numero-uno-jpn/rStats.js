/**
 * The censoring weights of {@link timeROC}: marginal (Kaplan-Meier), Cox or Aalen.
 *
 * @category Survival analysis
 */
export type TimeROCWeighting = "marginal" | "cox" | "aalen";
/**
 * Options for {@link timeROC}.
 *
 * @category Survival analysis
 */
export interface TimeROCOptions {
    /** Evaluation times (required; used as given: R adds 0 to a single time). */
    times: readonly number[];
    /** The event of interest among the values of `delta`. Default 1. */
    cause?: number;
    /** Censoring weights: `"marginal"` (default, Kaplan-Meier), `"cox"` or `"aalen"` (models of the censoring with the
     * marker and `otherMarkers` as covariates). */
    weighting?: TimeROCWeighting;
    /** Further covariates of the censoring model (one row per subject), for `"cox"` and `"aalen"`. */
    otherMarkers?: readonly (readonly number[])[];
    /** Compute the iid representation and the standard errors (marginal weights only). Default false. */
    iid?: boolean;
    /** Return the TP and FP curves. Default true. */
    roc?: boolean;
}
/** Counts per evaluation time: cases (T < t, the cause), survivors (T > t), other events before t (competing risks
 * only) and the rest ("censored at t": censored by t, or with an event at t).
 *
 * @category Survival analysis
 */
export interface TimeROCStats {
    /** Subjects with the cause before t (T < t). */
    cases: number;
    /** Subjects still without an event after t (T > t). */
    survivors: number;
    /** Subjects with another event before t (competing risks only). */
    otherEvents?: number;
    /** The rest: censored by t, or with an event at exactly t. */
    censored: number;
}
/**
 * The weights of a {@link timeROC} fit, subjects in the order of the sorted times.
 *
 * @category Survival analysis
 */
export type TimeROCWeights = {
    /** Kaplan-Meier of the censoring. */
    method: "marginal";
    /** G(t), the censoring survival at each time. */
    ipcwTimes: number[];
    /** G(T_i−), at each subject's time (left limit). */
    ipcwSubjectTimes: number[];
} | {
    /** A Cox or an Aalen model of the censoring. */
    method: "cox" | "aalen";
    /** G(t | Z_i) per time and subject. */
    ipcwTimes: number[][];
    /** G(T_i− | Z_i) per subject. */
    ipcwSubjectTimes: number[];
};
interface TimeROCCommon {
    /** The evaluation times. */
    times: number[];
    /** Number of subjects. */
    n: number;
    /** Cumulative incidence of the cause at each time (the cases' weights over n). */
    cumulativeIncidence: number[];
    /** Probability of no event of any kind at each time: the survivors' weighted mass (with the marginal weights exactly
     * the Kaplan-Meier, as R). */
    survProb: number[];
    /** Counts per time. */
    stats: TimeROCStats[];
    /** The censoring weights. */
    weights: TimeROCWeights;
    /** True positive rates per time, one per distinct marker value from the largest ("marker > value") and a last 1. */
    tp?: number[][];
}
/**
 * Result of {@link timeROC} without competing risks.
 *
 * @category Survival analysis
 */
export interface TimeROCSingleResult extends TimeROCCommon {
    /** No event other than the cause in `delta`. */
    competingRisks: false;
    /** The cumulative/dynamic AUC at each time. */
    auc: number[];
    /** False positive rates per time (controls: T > t). */
    fp?: number[][];
    /** With `iid`: the iid representation (per time, subjects in the order of the sorted times) and the standard errors. */
    inference?: {
        /** The AUC's iid representation per time (its influence function at each subject). */
        iid: number[][];
        /** Standard error of the AUC per time: sd(iid) / √n. */
        sd: number[];
    };
}
/**
 * Result of {@link timeROC} with competing risks: definition (i) has the controls T > t, definition (ii) also the
 * subjects with another event before t.
 *
 * @category Survival analysis
 */
export interface TimeROCCompetingResult extends TimeROCCommon {
    /** Other events than the cause occur in `delta`. */
    competingRisks: true;
    /** AUC with definition (i) of the controls at each time. */
    auc1: number[];
    /** AUC with definition (ii) of the controls at each time. */
    auc2: number[];
    /** False positive rates per time, definition (i). */
    fp1?: number[][];
    /** False positive rates per time, definition (ii). */
    fp2?: number[][];
    /** With `iid`: the iid representations and standard errors of both AUCs, as in {@link TimeROCSingleResult}. */
    inference?: {
        /** iid representation of AUC (i) per time. */
        iid1: number[][];
        /** Standard error of AUC (i) per time. */
        sd1: number[];
        /** iid representation of AUC (ii) per time. */
        iid2: number[][];
        /** Standard error of AUC (ii) per time. */
        sd2: number[];
    };
}
/**
 * Result of {@link timeROC}.
 *
 * @category Survival analysis
 */
export type TimeROCResult = TimeROCSingleResult | TimeROCCompetingResult;
/** @internal */
export interface Data {
    n: number;
    time: number[];
    delta: number[];
    marker: number[];
    /** Subjects in the order of the sorted times (ties in the data order). */
    order: number[];
    /** Distinct times, increasing. */
    u: number[];
    /** Each subject's index in u. */
    ti: number[];
    /** Censoring risk set at u: T > u, or censored at u (the events at u are left out). */
    R: number[];
    /** Number censored at u. */
    C: number[];
    /** Censoring KM after each u: G(u). */
    G: number[];
}
declare function prepare(time: readonly number[], delta: readonly number[], marker: readonly number[]): Data;
/** @internal */
export interface AtTime {
    t: number;
    /** Weight of each subject (0 for those with none). */
    w: number[];
    /** The weight is 1 / G(T_i-) (true) or 1 / G(t) (false); only meaningful where w > 0. */
    left: boolean[];
    /** Roles: 1 case, 2 control (T > t), 3 other event before t, 4 an event at exactly t, 0 none. */
    role: number[];
}
declare function weightsAt(data: Data, t: number, cause: number, gLeft: (i: number) => number, gAt: (i: number) => number): AtTime;
/** The marginal weights' left and at-t censoring probabilities. */
declare function marginalG(data: Data, t: number): {
    gLeft: (i: number) => number;
    gAt: (i: number) => number;
    Gt: number;
};
/** A weighted total and its influence (marginal weights): value sum w f / n and w_k f_k - W + Q_k. */
/** @internal */
export interface Total {
    value: number;
    inf: number[];
}
/**
 * The influence of W(f) = sum_i w_i f_i / n. `exact` takes the derivative of the weighted Kaplan-Meier itself
 * (1 / (R - C) in place of 1 / R; used by the tests' infinitesimal jackknife), the default the usual asymptotic form.
 */
declare function total(data: Data, at: AtTime, f: readonly number[], exact?: boolean): Total;
/** The AUC's influence: definition "i" (controls T > t) or "ii" (with the other events before t). @internal */
export declare function aucInfluence(data: Data, at: AtTime, definition: "i" | "ii", exact?: boolean): {
    auc: number;
    inf: number[];
};
/**
 * Time-dependent ROC curves and AUC for censored event times, with a single event or competing risks: the
 * cumulative/dynamic definition (cases T < t with the cause, controls T > t, and for competing risks definition (ii)
 * also the subjects with another event before t), inverse probability of censoring weights from the Kaplan-Meier of
 * the censoring (`"marginal"`), a Cox model (`"cox"`, Efron ties) or Aalen's additive model (`"aalen"`) with the marker
 * and `otherMarkers`; ties in the marker count 1/2. With `iid` (marginal weights), the iid representation of the AUC and
 * its standard error.
 *
 * Differences from R: the times are used as given (R adds 0 to a single time); the iid handles tied times correctly
 * (independent of the data order; equal to R's without ties) and definition (ii)'s is centred on the reported AUC_2;
 * the Cox weights use the maximum of the partial likelihood (R's cph stops about 5e-7 short); Aalen's increments take
 * tied censorings together (R breaks ties at random); a time with a single survivor works (R's competing-risks iid
 * fails there).
 *
 * Equivalent to `timeROC::timeROC()` in R.
 *
 * @param time observed times
 * @param delta 0 censored, otherwise the kind of event
 * @param marker the marker (larger values: the event sooner)
 * @param options `times` (required) and the options of timeROC
 * @category Survival analysis
 */
export declare function timeROC(time: readonly number[], delta: readonly number[], marker: readonly number[], options: TimeROCOptions): TimeROCResult;
/**
 * Options for {@link timeROCConfint}.
 *
 * @category Survival analysis
 */
export interface TimeROCConfintOptions {
    /** Confidence level. Default 0.95. */
    level?: number;
    /** Number of simulations of the simultaneous band. Default 2000. */
    nSim?: number;
}
/**
 * Pointwise intervals and the simultaneous band of one AUC, in percent.
 *
 * @category Survival analysis
 */
export interface TimeROCInterval {
    /** Lower and upper pointwise limits per time (percent, not rounded). */
    ci: [number, number][];
    /** Lower and upper limits of the simultaneous band per time (percent). */
    band: [number, number][];
    /** The band's multiplier (the `level` quantile of the maximum standardized deviation). */
    cAlpha: number;
}
/**
 * Result of {@link timeROCConfint}: `auc` without competing risks, `auc1` and `auc2` with them.
 *
 * @category Survival analysis
 */
export interface TimeROCConfintResult {
    /** The evaluation times. */
    times: number[];
    /** The confidence level. */
    level: number;
    /** Without competing risks: the AUC's intervals. */
    auc?: TimeROCInterval;
    /** With competing risks: AUC (i)'s intervals. */
    auc1?: TimeROCInterval;
    /** With competing risks: AUC (ii)'s intervals (the same draws as AUC (i)'s band, as R). */
    auc2?: TimeROCInterval;
}
/**
 * Pointwise confidence intervals of the time-dependent AUC and a simultaneous confidence band over the times, from the
 * iid representation: the band's multiplier is the `level` quantile of the maximum over the times of the
 * standardized multiplier-bootstrap process (`nSim` draws of n standard normals, from rStats.js's generator: set it
 * with `setSeed`; the same seed as R's `set.seed` gives R's band). Percent, not rounded (R rounds to 2 decimals).
 *
 * Equivalent to `timeROC::confint.ipcwsurvivalROC()` in R.
 *
 * @param fit a result of {@link timeROC} with `iid: true`
 * @param options `level` and `nSim`
 * @category Survival analysis
 */
export declare function timeROCConfint(fit: TimeROCResult, options?: TimeROCConfintOptions): TimeROCConfintResult;
/**
 * Options for {@link timeROCCompare}.
 *
 * @category Survival analysis
 */
export interface TimeROCCompareOptions {
    /** Also the p-values adjusted for the several times (the maximum of the correlated statistics). Default false. */
    adjusted?: boolean;
}
/**
 * The comparison of one AUC definition.
 *
 * @category Survival analysis
 */
export interface TimeROCComparison {
    /** p-values per time. */
    pValues: number[];
    /** With `adjusted`: the p-values adjusted for the several times. */
    adjusted?: number[];
    /** With `adjusted`: the correlation of the statistics across the times. */
    cor?: number[][];
}
/**
 * Result of {@link timeROCCompare}.
 *
 * @category Survival analysis
 */
export interface TimeROCCompareResult {
    /** The evaluation times. */
    times: number[];
    /** Without competing risks: the comparison of the AUCs. */
    auc?: TimeROCComparison;
    /** With competing risks: the comparison of AUC (i). */
    auc1?: TimeROCComparison;
    /** With competing risks: the comparison of AUC (ii). */
    auc2?: TimeROCComparison;
}
/**
 * Compares the time-dependent AUCs of two markers measured on the same subjects at each time, by the z statistic of
 * the difference with the standard error from the difference of the iid representations; with `adjusted`, also the
 * p-values adjusted for the several times, P(max_t |Z_t| >= |z_t|) for Z normal with the correlation of the
 * statistics (computed deterministically as a sum of positive terms, so that small p-values keep their relative
 * accuracy: to rounding up to three times, to about 1e-6 relative from four on; R integrates 1 − P at random with
 * mvtnorm's default absolute tolerance of 1e-3, so the two differ by up to about 1e-4).
 *
 * Equivalent to `timeROC::compare()` in R.
 *
 * @param x a result of {@link timeROC} with `iid: true`
 * @param y another, on the same subjects and times
 * @param options `adjusted`
 * @category Survival analysis
 */
export declare function timeROCCompare(x: TimeROCResult, y: TimeROCResult, options?: TimeROCCompareOptions): TimeROCCompareResult;
/**
 * P(max_j |Z_j| >= b) for Z ~ N(0, cor), computed directly (not as 1 − P(all |Z_j| < b), which loses the small values
 * to cancellation) by the first exceedance: Q = 2 Σ_i P(|Z_j| < b for j < i, Z_i >= b), a sum of positive terms (the
 * factor 2 by the symmetry Z → −Z). The i-th term is a probability of the leading i variables: pnorm for i = 1,
 * pbvnorm for i = 2, adaptive Gauss-Legendre over Z_3 >= b of the conditional bivariate probability (pbvnorm) for
 * i = 3, and Genz's separation of variables (Genz 1992) with a Richtmyer lattice for i >= 4 or a correlation within
 * 1e-9 of ±1 (a Richtmyer lattice periodized by the baker's transform, fixed shifts from a private generator: no use of
 * the user's random numbers; points doubled until two standard errors fall below 1e-6 of the term). Each term
 * keeps its relative accuracy, so small adjusted p-values do too.
 *
 * @internal
 */
export declare function pmaxAbsExceed(b: number, cor: readonly (readonly number[])[]): number;
/** P(all |Z_j| <= b) = 1 − {@link pmaxAbsExceed} (for moderate b; the tests). @internal */
export declare function pmvnormSymmetric(b: number, cor: readonly (readonly number[])[]): number;
/**
 * Options for {@link seSpPPVNPV}.
 *
 * @category Survival analysis
 */
export interface SeSpPPVNPVOptions extends Omit<TimeROCOptions, "roc"> {
}
/**
 * Standard errors of {@link seSpPPVNPV} (with `iid`), per time.
 *
 * @category Survival analysis
 */
export interface SeSpPPVNPVInference {
    /** Standard errors, sd(iid) / √n, per time. */
    se: {
        /** Of the sensitivity. */
        se: number[];
        /** Of the specificity with definition (i). */
        sp1: number[];
        /** Of the specificity with definition (ii). */
        sp2: number[];
        /** Of the positive predictive value. */
        ppv: number[];
        /** Of the negative predictive value (i). */
        npv1: number[];
        /** Of the negative predictive value (ii). */
        npv2: number[];
    };
    /** The iid representations, per time, subjects in the order of the sorted times. */
    iid: {
        /** Of the sensitivity. */
        se: number[][];
        /** Of the specificity with definition (i). */
        sp1: number[][];
        /** Of the specificity with definition (ii). */
        sp2: number[][];
        /** Of the positive predictive value. */
        ppv: number[][];
        /** Of the negative predictive value (i). */
        npv1: number[][];
        /** Of the negative predictive value (ii). */
        npv2: number[][];
    };
}
/**
 * Result of {@link seSpPPVNPV}: `fp` and `npv` without competing risks, `fp1`, `fp2`, `npv1` and `npv2` with them.
 *
 * @category Survival analysis
 */
export interface SeSpPPVNPVResult {
    /** The threshold: positive means marker > cutpoint. */
    cutpoint: number;
    /** The evaluation times. */
    times: number[];
    /** Number of subjects (without NA). */
    n: number;
    /** Whether other events than the cause occur. */
    competingRisks: boolean;
    /** Sensitivity (true positive rate) per time. */
    tp: number[];
    /** Without competing risks: false positive rate per time. */
    fp?: number[];
    /** With competing risks: false positive rate, definition (i). */
    fp1?: number[];
    /** With competing risks: false positive rate, definition (ii). */
    fp2?: number[];
    /** Positive predictive value per time. */
    ppv: number[];
    /** Without competing risks: negative predictive value per time. */
    npv?: number[];
    /** With competing risks: negative predictive value (i). */
    npv1?: number[];
    /** With competing risks: negative predictive value (ii). */
    npv2?: number[];
    /** Counts per time, with the positives (marker > cutpoint) and negatives. */
    stats: (TimeROCStats & {
        /** Subjects with marker > cutpoint. */
        positive: number;
        /** Subjects with marker <= cutpoint. */
        negative: number;
    })[];
    /** The censoring weights. */
    weights: TimeROCWeights;
    /** With `iid`: standard errors and iid representations. */
    inference?: SeSpPPVNPVInference;
}
/**
 * Time-dependent sensitivity, specificity and predictive values of the rule "marker > cutpoint", with the weights of
 * {@link timeROC}: PPV = TP F / (TP F + FP S) and NPV = (1 − FP) S / ((1 − FP) S + (1 − TP) F) (F the cumulative
 * incidence, S its complement); with competing risks PPV and NPV_2 with definition (ii) and NPV_1 = (1 − FP_1) S_1 /
 * ((1 − FP_2) S_2 + (1 − TP) F). With `iid` (marginal weights), the iid representations and standard errors of Se,
 * Sp (both definitions), PPV and the NPVs.
 *
 * Differences from R: as {@link timeROC}; Sp2's denominator is the weighted mass of the definition (ii) controls (R's
 * 1 − F, the same unless events fall at t).
 *
 * Equivalent to `timeROC::SeSpPPVNPV()` in R.
 *
 * @param cutpoint the marker's threshold
 * @param time observed times
 * @param delta 0 censored, otherwise the kind of event
 * @param marker the marker
 * @param options `times` (required) and the options of timeROC
 * @category Survival analysis
 */
export declare function seSpPPVNPV(cutpoint: number, time: readonly number[], delta: readonly number[], marker: readonly number[], options: SeSpPPVNPVOptions): SeSpPPVNPVResult;
/**
 * Options for {@link timeROCAucCurve} and {@link timeROCAucDiff}.
 *
 * @category Survival analysis
 */
export interface TimeROCAucCurveOptions extends TimeROCConfintOptions {
    /** With competing risks, the definition of the controls: 1 (default) or 2. */
    fp?: 1 | 2;
}
/**
 * Result of {@link timeROCAucCurve}: the AUC per time with its pointwise interval and simultaneous band (as
 * proportions).
 *
 * @category Survival analysis
 */
export interface TimeROCAucCurveResult {
    /** The evaluation times. */
    times: number[];
    /** AUC per time. */
    auc: number[];
    /** Lower pointwise confidence limit per time. */
    lower: number[];
    /** Upper pointwise confidence limit per time. */
    upper: number[];
    /** Lower limit of the simultaneous band per time. */
    bandLower: number[];
    /** Upper limit of the simultaneous band per time. */
    bandUpper: number[];
}
/**
 * The values that R's `plotAUCcurve` draws: the AUC over the times with the pointwise confidence interval and the
 * simultaneous band of {@link timeROCConfint} (as proportions). No plot.
 *
 * Equivalent to `timeROC::plotAUCcurve()` in R.
 *
 * @param fit a result of {@link timeROC} with `iid: true`
 * @param options `level`, `nSim` and `fp`
 * @category Survival analysis
 */
export declare function timeROCAucCurve(fit: TimeROCResult, options?: TimeROCAucCurveOptions): TimeROCAucCurveResult;
/**
 * Result of {@link timeROCAucDiff}.
 *
 * @category Survival analysis
 */
export interface TimeROCAucDiffResult {
    /** The evaluation times. */
    times: number[];
    /** AUC of x minus AUC of y. */
    diff: number[];
    /** Lower pointwise confidence limit of the difference. */
    lower: number[];
    /** Upper pointwise confidence limit of the difference. */
    upper: number[];
}
/**
 * The values behind R's `plotAUCcurveDiff`: the difference of two time-dependent AUCs over the times with the
 * pointwise confidence interval from the difference of the iid representations (as {@link timeROCCompare}). R also
 * draws a simultaneous band, whose simulation cannot be checked (R returns nothing); it is not offered. No plot.
 *
 * Not an R function.
 *
 * @param x a result of {@link timeROC} with `iid: true`
 * @param y another, on the same subjects and times
 * @param options `level` and `fp`
 * @category Survival analysis
 */
export declare function timeROCAucDiff(x: TimeROCResult, y: TimeROCResult, options?: Omit<TimeROCAucCurveOptions, "nSim">): TimeROCAucDiffResult;
/**
 * Options for {@link survivalROC}.
 *
 * @category Survival analysis
 */
export interface SurvivalROCOptions {
    /** The time of the prediction (required). */
    predictTime: number;
    /** Thresholds of the marker, sorted (R prepends −Inf; from two thresholds on, the last one's point is (0, 0), as R).
     * Default: the sorted distinct marker values. */
    cutValues?: readonly number[];
    /** The estimator: only `"KM"` (R's default, the nearest-neighbour estimator `"NNE"`, is not offered). Default "KM". */
    method?: "KM";
}
/**
 * Result of {@link survivalROC}.
 *
 * @category Survival analysis
 */
export interface SurvivalROCResult {
    /** −Inf, then the thresholds. */
    cutValues: number[];
    /** True positive rate at each threshold. */
    tp: number[];
    /** False positive rate at each threshold. */
    fp: number[];
    /** The prediction time. */
    predictTime: number;
    /** Kaplan-Meier survival at the prediction time. */
    survival: number;
    /** Trapezoid over the points in the order of the thresholds (not bounded by 1, as R). */
    auc: number;
}
/**
 * Time-dependent ROC curve at a prediction time by Heagerty, Lumley and Pepe's Kaplan-Meier estimator: S(c, t) =
 * KM_{marker > c}(t) P(marker > c), TP(c) = (P(marker > c) − S(c, t)) / (1 − S(t)), FP(c) = S(c, t) / S(t) (neither
 * is forced to be monotone or below 1, as R), and the AUC by the trapezoid over the thresholds in order.
 *
 * Differences from R: only the Kaplan-Meier estimator (`method = "KM"`); R's default, the nearest-neighbour estimator,
 * is not offered.
 *
 * Equivalent to `survivalROC::survivalROC()` in R.
 *
 * @param time observed times
 * @param status 1 event, 0 censored
 * @param marker the marker
 * @param options `predictTime` (required), `cutValues` and `method`
 * @category Survival analysis
 */
export declare function survivalROC(time: readonly number[], status: readonly number[], marker: readonly number[], options: SurvivalROCOptions): SurvivalROCResult;
/** The pieces used by the tests' infinitesimal jackknife. @internal */
export declare const timeROCInternals: {
    prepare: typeof prepare;
    weightsAt: typeof weightsAt;
    marginalG: typeof marginalG;
    total: typeof total;
    aucInfluence: typeof aucInfluence;
};
export {};
