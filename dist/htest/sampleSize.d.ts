/** Options shared by the epiR parallel-trial sample-size and power functions.
 * @category Effect sizes and power
 */
export interface EpiOptions {
    /** Total sample size; null/omitted when solving for sample size. */
    n?: number | null;
    /** Target power; null/omitted when solving for power. */
    power?: number | null;
    /** Treatment/control allocation ratio. Default 1. */
    r?: number;
    /** Equivalence or equality. Default "equivalence". */
    type?: "equivalence" | "equality" | (string & {});
    /** Round each group size up separately. Default false. */
    nfractional?: boolean;
    /** Significance level. Default 0.05. */
    alpha?: number;
    /** Number of tails for superiority: 1 or 2. Default 1. */
    sidedTest?: 1 | 2;
}
/** Sample-size and power result for an epiR parallel-trial design.
 * @category Effect sizes and power
 */
export interface EpiResult {
    nTotal: number;
    nTreat: number;
    nControl: number;
    nTotalUnrounded: number;
    nTreatUnrounded: number;
    nControlUnrounded: number;
    power: number;
    delta?: number;
    warnings: string[];
}
/** Equivalence/equality sample size or power for two proportions. Equivalent to `epiR::epi.ssequb()` in R.
 * @param treat Expected treatment-group proportion.
 * @param control Expected control-group proportion.
 * @param delta Equivalence margin; pass null for equality.
 * @param options Sample-size, power and allocation options.
 * @returns The fractional and requested group sizes, and power. The sample-size formula follows epiR's expression and is not an exact inverse of the TOST power calculation.
 * @example
 * ```ts
 * epiSsequb(0.5, 0.45, 0.1, { n: 120 }).power;
 * ```
 * @category Effect sizes and power
 */
export declare function epiSsequb(treat: number, control: number, delta: number | null, options?: EpiOptions): EpiResult;
/** Equivalence/equality sample size or power for two means. Equivalent to `epiR::epi.ssequc()` in R.
 * @param treat Expected treatment-group mean.
 * @param control Expected control-group mean.
 * @param sigma Common standard deviation.
 * @param delta Equivalence margin; pass null for equality.
 * @param options Sample-size, power and allocation options.
 * @returns The fractional and requested group sizes, and power. The sample-size formula follows epiR's expression and is not an exact inverse of the TOST power calculation.
 * @example
 * ```ts
 * epiSsequc(20, 21, 10, 5, { n: 120 }).power;
 * ```
 * @category Effect sizes and power
 */
export declare function epiSsequc(treat: number, control: number, sigma: number, delta: number | null, options?: EpiOptions): EpiResult;
/** Non-inferiority sample size or power for two proportions. Equivalent to `epiR::epi.ssninfb()` in R.
 * @param treat Expected treatment-group proportion.
 * @param control Expected control-group proportion.
 * @param delta Non-inferiority margin.
 * @param options Sample-size, power and allocation options.
 * @returns The fractional and requested group sizes, and power.
 * @example
 * ```ts
 * epiSsninfb(0.85, 0.65, 0.1, { n: 120 }).power;
 * ```
 * @category Effect sizes and power
 */
export declare function epiSsninfb(treat: number, control: number, delta: number, options?: EpiOptions): EpiResult;
/** Non-inferiority sample size or power for two means. Equivalent to `epiR::epi.ssninfc()` in R.
 * @param treat Expected treatment-group mean.
 * @param control Expected control-group mean.
 * @param sigma Common standard deviation.
 * @param delta Non-inferiority margin.
 * @param options Sample-size, power and allocation options.
 * @returns The fractional and requested group sizes, and power.
 * @example
 * ```ts
 * epiSsninfc(0.22, 0.2, 0.1, 0.05, { n: 120 }).power;
 * ```
 * @category Effect sizes and power
 */
export declare function epiSsninfc(treat: number, control: number, sigma: number, delta: number, options?: EpiOptions): EpiResult;
/** Superiority sample size or power for two proportions. Equivalent to `epiR::epi.sssupb()` in R.
 * @param treat Expected treatment-group proportion.
 * @param control Expected control-group proportion.
 * @param delta Superiority margin.
 * @param options Sample-size, power and allocation options.
 * @returns The fractional and requested group sizes, and power.
 * @example
 * ```ts
 * epiSssupb(0.5, 0.3, 0.05, { n: 101, r: 0.5, sidedTest: 1 }).power;
 * ```
 * @category Effect sizes and power
 */
export declare function epiSssupb(treat: number, control: number, delta: number, options?: EpiOptions): EpiResult;
/** Superiority sample size or power for two means. Equivalent to `epiR::epi.sssupc()` in R.
 * @param treat Expected treatment-group mean.
 * @param control Expected control-group mean.
 * @param sigma Common standard deviation.
 * @param delta Superiority margin.
 * @param options Sample-size, power and allocation options.
 * @returns The fractional and requested group sizes, and power.
 * @example
 * ```ts
 * epiSssupc(20, 20, 10, 5, { n: 120, r: 1.5, sidedTest: 1 }).power;
 * ```
 * @category Effect sizes and power
 */
export declare function epiSssupc(treat: number, control: number, sigma: number, delta: number, options?: EpiOptions): EpiResult;
/** Options for the exact paired McNemar power calculation.
 * @category Effect sizes and power
 */
export interface PowerPaired2x2Options {
    sigLevel?: number;
    alternative?: "two.sided" | "one.sided" | (string & {});
    strict?: boolean;
    nullOddsRatio?: number;
    /** Probability budget omitted from the extreme tails of the discordant-pair count. Default 1e-6; zero uses all counts. */
    errbound?: number;
    tsmethod?: "central" | "minlike" | "blaker" | (string & {});
}
/** Result of the exact paired McNemar power calculation.
 * @category Effect sizes and power
 */
export interface PowerPaired2x2Result {
    power: number;
    npairs: number;
    pb: number;
    pc: number;
    sigLevel: number;
    alternative: "two.sided" | "one.sided";
    nullOddsRatio: number;
    note: string;
    method: string;
    warnings: string[];
}
/** Exact power of McNemar's test for paired binary outcomes. Equivalent to `exact2x2::powerPaired2x2()` in R.
 * @param pb Probability of a discordant pair with control 0 and treatment 1.
 * @param pc Probability of a discordant pair with control 1 and treatment 0.
 * @param npairs Number of pairs.
 * @param options Test options. `errbound=0` evaluates the full sum; a positive value may omit extreme discordant-pair-count tails with total omitted probability no greater than `errbound`.
 * @returns The power and test settings.
 * @example
 * ```ts
 * powerPaired2x2(0.5, 0.3, 40).power;
 * ```
 * @category Effect sizes and power
 */
export declare function powerPaired2x2(pb: number, pc: number, npairs: number, options?: PowerPaired2x2Options): PowerPaired2x2Result;
/** Significance-level options for survival sample-size calculations.
 * @category Effect sizes and power
 */
export interface SurvivalOptions {
    alpha?: number;
}
/** Result of a Freedman clinical-trial sample-size calculation.
 * @category Effect sizes and power
 */
export interface SSizeCTResult {
    nE: number;
    nC: number;
}
/** Freedman clinical-trial power. Equivalent to `powerSurvEpi::powerCT.default()` in R.
 * @param nE Experimental-group sample size.
 * @param nC Control-group sample size.
 * @param pE Experimental-group event probability.
 * @param pC Control-group event probability.
 * @param RR Experimental/control hazard ratio.
 * @param options Significance level.
 * @returns The normal-approximation power.
 * @example
 * ```ts
 * powerCT(200, 200, 0.3707, 0.489, 0.7);
 * ```
 * @category Effect sizes and power
 */
export declare function powerCT(nE: number, nC: number, pE: number, pC: number, RR: number, options?: SurvivalOptions): number;
/** Freedman clinical-trial sample size. Equivalent to `powerSurvEpi::ssizeCT.default()` in R.
 * @param power Target power.
 * @param k Experimental/control allocation ratio.
 * @param pE Experimental-group event probability.
 * @param pC Control-group event probability.
 * @param RR Experimental/control hazard ratio.
 * @param options Significance level.
 * @returns The integer sample sizes in the two groups.
 * @example
 * ```ts
 * ssizeCT(0.8, 1, 0.3707, 0.489, 0.7);
 * ```
 * @category Effect sizes and power
 */
export declare function ssizeCT(power: number, k: number, pE: number, pC: number, RR: number, options?: SurvivalOptions): SSizeCTResult;
/** Schoenfeld/Latouche Cox-model power. Equivalent to `powerSurvEpi::powerEpi.default()` in R.
 * @param n Total sample size.
 * @param theta Hazard ratio.
 * @param p Prevalence of the binary covariate.
 * @param psi Event proportion.
 * @param rho2 Squared correlation with another covariate.
 * @param options Significance level.
 * @returns The normal-approximation power.
 * @example
 * ```ts
 * powerEpi(139, 2, 0.39, 0.505, 0.132 ** 2);
 * ```
 * @category Effect sizes and power
 */
export declare function powerEpi(n: number, theta: number, p: number, psi: number, rho2: number, options?: SurvivalOptions): number;
/** Schoenfeld/Latouche total sample size. Equivalent to `powerSurvEpi::ssizeEpi.default()` in R.
 * @param power Target power.
 * @param theta Hazard ratio.
 * @param p Prevalence of the binary covariate.
 * @param psi Event proportion.
 * @param rho2 Squared correlation with another covariate.
 * @param options Significance level.
 * @returns The integer total sample size.
 * @example
 * ```ts
 * ssizeEpi(0.8, 2, 0.39, 0.505, 0.132 ** 2);
 * ```
 * @category Effect sizes and power
 */
export declare function ssizeEpi(power: number, theta: number, p: number, psi: number, rho2: number, options?: SurvivalOptions): number;
/** Schoenfeld/Latouche required event count. Equivalent to `powerSurvEpi::numDEpi.default()` in R.
 * @param power Target power.
 * @param theta Hazard ratio.
 * @param p Prevalence of the binary covariate.
 * @param rho2 Squared correlation with another covariate.
 * @param options Significance level.
 * @returns The integer number of events required.
 * @example
 * ```ts
 * numDEpi(0.8, 2, 0.39, 0.132 ** 2);
 * ```
 * @category Effect sizes and power
 */
export declare function numDEpi(power: number, theta: number, p: number, rho2: number, options?: SurvivalOptions): number;
/** A feasible two-stage Simon candidate.
 * @category Effect sizes and power
 */
export interface SimonRow {
    r1: number;
    n1: number;
    r: number;
    n: number;
    enP0: number;
    petP0: number;
}
/** A selected Simon design and its interval of q values.
 * @category Effect sizes and power
 */
export interface SimonDesign extends SimonRow {
    qLo: number;
    qHi: number;
}
/** Candidate designs and selected minimax, optimal and admissible Simon designs.
 * @category Effect sizes and power
 */
export interface SimonDesignResult {
    out: SimonRow[];
    minimax: SimonDesign;
    optimal: SimonDesign;
    admissible: SimonDesign[];
    pu: number;
    pa: number;
    alpha: number;
    beta: number;
    nmax: number;
    warnings: string[];
}
/** Enumerates Simon's two-stage Phase II designs. Equivalent to `clinfun::ph2simon()` in R.
 * @param pu Unacceptable response rate.
 * @param pa Desirable response rate.
 * @param ep1 Maximum type-I error at pu.
 * @param ep2 Maximum type-II error at pa.
 * @param options Maximum total sample size, at most 1000.
 * @returns Candidate rows and structured minimax, optimal and admissible designs.
 * @example
 * ```ts
 * ph2simon(0.2, 0.4, 0.05, 0.1).minimax.n;
 * ```
 * @category Effect sizes and power
 */
export declare function ph2simon(pu: number, pa: number, ep1: number, ep2: number, options?: {
    nmax?: number;
}): SimonDesignResult;
