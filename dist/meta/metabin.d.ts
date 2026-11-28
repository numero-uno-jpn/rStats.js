import { type MetaCommonOptions, type MetaResult } from "./metagen.js";
/**
 * Options of {@link metabin}.
 *
 * @category Meta-analysis
 */
export interface MetabinOptions extends MetaCommonOptions {
    /** "RR" (default), "OR" or "RD". */
    sm?: "RR" | "OR" | "RD";
    /** "MH" (default), "Inverse" or "Peto" (OR only). */
    method?: "MH" | "Inverse" | "Peto";
    /** The continuity correction (default 0.5). */
    incr?: number;
    /** Which studies get it: "only0" (studies with a zero cell, default), "all", "if0all" (all when any has a zero). */
    methodIncr?: "only0" | "all" | "if0all";
    /** Keep studies with no or all events in both groups (default false; RD keeps them anyway). */
    allstudies?: boolean;
    /** The MH estimate without any increment (default false). */
    MHexact?: boolean;
    /** With methodTau "DL", Q about the MH estimate (default true). */
    QCochrane?: boolean;
}
/**
 * Meta-analysis of binary outcomes (meta's `metabin()`): events e1 / e2 of totals n1 / n2. The common effect by
 * Mantel-Haenszel (OR with the Robins-Breslow-Greenland variance; RR and RD with Greenland and Robins'), Peto's
 * (O - E) / V or the inverse variance; the random effect and heterogeneity as {@link metagen} on the study values.
 * Studies with a zero cell get `incr` (0.5); studies with no or all events in both groups are left out for OR and RR.
 * Equivalent to `meta::metabin()` in R.
 *
 * @category Meta-analysis
 */
export declare function metabin(e1: readonly number[], n1: readonly number[], e2: readonly number[], n2: readonly number[], options?: MetabinOptions): MetaResult;
