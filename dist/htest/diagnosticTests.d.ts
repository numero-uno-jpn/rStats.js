/**
 * Options for {@link diagnosticTests}.
 *
 * @category Hypothesis tests
 */
export interface DiagnosticTestsOptions {
    /**
     * The interval of the proportions: `"exact"` (default; Clopper-Pearson), `"wilson"` or `"jeffreys"`;
     * abbreviations are accepted.
     */
    method?: "exact" | "wilson" | "jeffreys" | (string & {});
    /** Confidence level, in (0, 1). Default `0.95`. */
    confLevel?: number;
    /** A prevalence in (0, 1) at which to give the predictive values as well (`ppvAtPrevalence`, `npvAtPrevalence`). */
    prevalence?: number;
}
/**
 * An estimate with its confidence interval.
 *
 * @category Hypothesis tests
 */
export interface DiagnosticMeasure {
    /** The estimate. */
    estimate: number;
    /** The interval `[lower, upper]`. */
    confInt: [number, number];
}
/**
 * Result of {@link diagnosticTests}.
 *
 * @category Hypothesis tests
 */
export interface DiagnosticTestsResult {
    /** Sensitivity a/(a + c). */
    sensitivity: DiagnosticMeasure;
    /** Specificity d/(b + d). */
    specificity: DiagnosticMeasure;
    /** Positive predictive value a/(a + b). */
    ppv: DiagnosticMeasure;
    /** Negative predictive value d/(c + d). */
    npv: DiagnosticMeasure;
    /** Positive likelihood ratio se/(1 − sp), with the log interval. */
    lrPos: DiagnosticMeasure;
    /** Negative likelihood ratio (1 − se)/sp, with the log interval. */
    lrNeg: DiagnosticMeasure;
    /** Diagnostic accuracy (a + d)/total. */
    accuracy: DiagnosticMeasure;
    /** Diagnostic odds ratio ad/(bc), with Woolf's interval. */
    diagnosticOR: DiagnosticMeasure;
    /** True prevalence (a + c)/total (epiR's "tp"). */
    prevalence: DiagnosticMeasure;
    /** Apparent prevalence (a + b)/total (epiR's "ap"). */
    apparentPrevalence: DiagnosticMeasure;
    /** The positive predictive value at the prevalence given in the options (absent without it). */
    ppvAtPrevalence?: number;
    /** The negative predictive value at the prevalence given in the options (absent without it). */
    npvAtPrevalence?: number;
    /** The method of the proportions' intervals, in full. */
    method: "exact" | "wilson" | "jeffreys";
    /** The confidence level. */
    confLevel: number;
    /** R's warnings, each once, in R's order (an empty array when there are none). */
    warnings: string[];
}
/**
 * Sensitivity, specificity, predictive values, likelihood ratios, accuracy, the diagnostic odds ratio and the true and
 * apparent prevalence of a binary test, each with a confidence interval, from its 2 × 2 table. Equivalent to
 * `epiR::epi.tests()` in R.
 *
 * The table is epiR's: rows test positive and negative, columns disease present and absent, `[[a, b], [c, d]]` with
 * a the true positives, b the false positives, c the false negatives and d the true negatives. The proportions'
 * intervals are those of {@link binomCI}: `"exact"` is Clopper-Pearson's, computed directly (epiR computes it as 1 −
 * qbeta(...), which loses digits for small limits); `"jeffreys"` gives 0 and 1 at the ends, as binomCI (epiR the
 * beta quantiles). The likelihood ratios have the log interval (Simel, Samsa and Matchar 1991) and the odds ratio
 * Woolf's. Zero cells give infinite ratios and NaN limits, as epiR; a zero row or column total is an error.
 *
 * @param table The 2 × 2 table of counts (an array of two rows).
 * @param options See {@link DiagnosticTestsOptions}.
 *
 * @example
 * ```ts
 * const r = diagnosticTests([[670, 202], [74, 640]]);
 * r.sensitivity.estimate; // 0.9005376344086021
 * r.sensitivity.confInt;  // [0.8767461767957109, 0.9210922995836943]
 * r.lrPos.estimate;       // 3.7537261790695196
 * diagnosticTests([[670, 202], [74, 640]], { prevalence: 0.1 }).ppvAtPrevalence; // 0.2943238804381625
 * ```
 *
 * @category Hypothesis tests
 */
export declare function diagnosticTests(table: readonly (readonly number[])[], options?: DiagnosticTestsOptions): DiagnosticTestsResult;
