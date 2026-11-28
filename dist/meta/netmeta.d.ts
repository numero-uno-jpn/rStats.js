/**
 * A matrix with treatment names.
 *
 * @category Meta-analysis
 */
export interface TreatmentMatrix {
    rows: string[];
    cols: string[];
    values: number[][];
}
/**
 * The result of {@link netmeta} (R's element names).
 *
 * @category Meta-analysis
 */
export interface NetmetaResult {
    trts: string[];
    studlab: string[];
    treat1: string[];
    treat2: string[];
    TE: number[];
    seTE: number[];
    k: number;
    n: number;
    m: number;
    "TE.common": TreatmentMatrix;
    "seTE.common": TreatmentMatrix;
    "lower.common": TreatmentMatrix;
    "upper.common": TreatmentMatrix;
    "TE.random": TreatmentMatrix;
    "seTE.random": TreatmentMatrix;
    "lower.random": TreatmentMatrix;
    "upper.random": TreatmentMatrix;
    "lower.predict": TreatmentMatrix;
    "upper.predict": TreatmentMatrix;
    "TE.direct.common": TreatmentMatrix;
    "seTE.direct.common": TreatmentMatrix;
    "TE.direct.random": TreatmentMatrix;
    "seTE.direct.random": TreatmentMatrix;
    Q: number;
    "df.Q": number;
    "pval.Q": number;
    tau2: number;
    I2: number;
    "lower.I2": number;
    "upper.I2": number;
    "Q.heterogeneity": number;
    "df.Q.heterogeneity": number;
    "Q.inconsistency": number;
    "df.Q.inconsistency": number;
    "w.common": number[];
    "w.random": number[];
    referenceGroup: string | null;
    level: number;
}
/**
 * Frequentist network meta-analysis (netmeta's `netmeta()`): contrasts TE (treat1 versus treat2) with standard errors
 * seTE from studies studlab; the common effects by weighted least squares on the network graph (Ruecker 2012; multi-arm
 * studies by the effective resistances of their comparisons), Q on sum(arms - 1) - (n - 1) df, tau2 by the DL
 * generalisation of Jackson, White and Riley (2012), the random effects with seTE^2 + tau2, the direct estimates, the
 * prediction interval (t on df.Q), and Q split into heterogeneity (within designs) and inconsistency (between).
 * Equivalent to `netmeta::netmeta()` in R.
 *
 * @category Meta-analysis
 */
export declare function netmeta(TE: readonly number[], seTE: readonly number[], treat1: readonly string[], treat2: readonly string[], studlab: readonly string[], options?: {
    referenceGroup?: string;
    level?: number;
    levelMa?: number;
    levelPredict?: number;
    tau2?: number;
}): NetmetaResult;
/**
 * P-scores (netmeta's `netrank()`, Ruecker and Schwarzer 2015): for each treatment the mean over the others of the
 * probability that it is better, pnorm((TE_j - TE_i) / se_ij) when small values are desirable (default) or
 * pnorm((TE_i - TE_j) / se_ij) when undesirable.
 * Equivalent to `netmeta::netrank()` in R.
 *
 * @category Meta-analysis
 */
export declare function netrank(fit: NetmetaResult, options?: {
    random?: boolean;
    smallValues?: "desirable" | "undesirable";
}): Record<string, number>;
/**
 * One column of {@link netsplit}.
 *
 * @category Meta-analysis
 */
export interface NetsplitPart {
    comparison: string[];
    TE: number[];
    seTE: number[];
    lower: number[];
    upper: number[];
    z: number[];
    p: number[];
}
/**
 * Direct and indirect evidence for each comparison (netmeta's `netsplit()`, back-calculation): the direct estimate (the
 * inverse-variance pooling of the comparison's contrasts), the indirect one from the network estimate and the direct
 * one, their difference, and the direct evidence proportion v_network / v_direct.
 * Equivalent to `netmeta::netsplit()` in R.
 *
 * @category Meta-analysis
 */
export declare function netsplit(fit: NetmetaResult): Record<"direct.random" | "indirect.random" | "compare.random" | "direct.common" | "indirect.common" | "compare.common", NetsplitPart> & {
    "prop.random": number[];
    "prop.common": number[];
};
/**
 * The connected components of a network (netmeta's `netconnection()`): the number of subnets, the numbers of
 * studies k, treatments n and comparisons, and the distance matrix (shortest path lengths; Infinity between subnets).
 * Equivalent to `netmeta::netconnection()` in R.
 *
 * @category Meta-analysis
 */
export declare function netconnection(treat1: readonly string[], treat2: readonly string[], studlab?: readonly string[]): {
    "n.subnets": number;
    k: number;
    n: number;
    m: number;
    D: TreatmentMatrix;
    subnet: Record<string, number>;
};
/**
 * The result of {@link decompDesign}.
 *
 * @category Meta-analysis
 */
export interface DecompDesignResult {
    /** Total, within designs, between designs. */
    "Q.decomp": {
        Q: number[];
        df: number[];
        pval: number[];
    };
    "Q.het.design": {
        design: string[];
        Q: number[];
        df: number[];
        pval: number[];
    };
}
/**
 * Q decomposed by design (netmeta's `decomp.design()`): the Q of each design = that of the network fitted to its
 * studies alone, df (studies - 1)(arms - 1); within = their sum, between = total - within. Designs are listed by their
 * number of arms, then alphabetically.
 * Equivalent to `netmeta::decomp.design()` in R.
 *
 * @category Meta-analysis
 */
export declare function decompDesign(fit: NetmetaResult): DecompDesignResult;
/**
 * Network measures (netmeta's `netmeasures()`): the direct evidence proportion of each comparison, v_network / v_direct
 * (0 without direct evidence), for the random-effects model (default, as netmeta when the fit has one) or the
 * common-effect model. netmeta's mean path length and minimal parallelism are not provided (log 101: not reproduced).
 * Equivalent to `netmeta::netmeasures()` in R.
 *
 * @category Meta-analysis
 */
export declare function netmeasures(fit: NetmetaResult, options?: {
    random?: boolean;
}): {
    proportion: Record<string, number>;
};
/**
 * Contrasts from arm-level data (netmeta's `pairwise()`): every pair of arms of each study (treat1 the earlier arm).
 * Binary outcomes (`event`, `n`; sm "OR", "RR" or "RD"): all arms of a study get 0.5 when any arm has 0 or n events
 * (log 74); continuous (`mean`, `sd`, `n`; sm "MD").
 * Equivalent to `netmeta::pairwise()` in R.
 *
 * @category Meta-analysis
 */
export declare function pairwise(data: {
    treat: readonly string[];
    studlab: readonly string[];
    n: readonly number[];
    event?: readonly number[];
    mean?: readonly number[];
    sd?: readonly number[];
}, options?: {
    sm?: "OR" | "RR" | "RD" | "MD";
    incr?: number;
}): {
    TE: number[];
    seTE: number[];
    treat1: string[];
    treat2: string[];
    studlab: string[];
};
/**
 * The result of {@link netcomb} / {@link discomb}.
 *
 * @category Meta-analysis
 */
export interface NetcombResult {
    comps: string[];
    "Comp.common": number[];
    "seComp.common": number[];
    "Comp.random": number[];
    "seComp.random": number[];
    trts: string[];
    "Comb.common": number[];
    "seComb.common": number[];
    "Comb.random": number[];
    "seComb.random": number[];
    "Q.additive": number;
    "df.Q.additive": number;
    tau2: number;
}
/**
 * The additive component network meta-analysis (netmeta's `netcomb()` / `discomb()`, Ruecker et al. 2020; the network
 * may be disconnected): treatments are "+"-joined components; the components' effects by weighted least squares on
 * X = B C (C treatment by component, the `inactive` treatment left out), Q.additive the weighted residual sum of squares
 * on comparisons - rank(X) df, tau2 by the DL generalisation with the additive hat matrix (two-arm studies; log 77).
 * Equivalent to `netmeta::discomb()` in R.
 *
 * @category Meta-analysis
 */
export declare function discomb(TE: readonly number[], seTE: readonly number[], treat1: readonly string[], treat2: readonly string[], studlab: readonly string[], options?: {
    inactive?: string;
    sep?: string;
}): NetcombResult;
/**
 * {@link discomb} for a fitted network (netmeta's `netcomb()`). Equivalent to `netmeta::netcomb()` in R.
 *
 * @category Meta-analysis
 */
export declare function netcomb(fit: NetmetaResult, options?: {
    inactive?: string;
    sep?: string;
}): NetcombResult;
/**
 * The league table (netmeta's `netleague()`): the diagonal the treatments, the lower triangle [i][j] the network
 * estimate of the column treatment against the row treatment (TE[j][i]) with its interval, the upper triangle the direct
 * estimates (TE[i][j]; "." where there is none); "est (lower to upper)" with `digits` decimals, the bounds of a table
 * padded to a common width.
 * Equivalent to `netmeta::netleague()` in R.
 *
 * @category Meta-analysis
 */
export declare function netleague(fit: NetmetaResult, options?: {
    random?: boolean;
    digits?: number;
    bracket?: "(" | "[";
    separator?: string;
}): string[][];
/**
 * The partial order of treatments over several outcomes (netmeta's `netposet()`): P the treatments by outcomes matrix of
 * ranking scores; M0 the covering relation (Hasse diagram) of "i at least as good as j in every outcome and better in
 * one" (M0[i][j] = 1: i directly above j).
 * Equivalent to `netmeta::netposet()` in R.
 *
 * @category Meta-analysis
 */
export declare function netposet(P: readonly (readonly number[])[]): number[][];
