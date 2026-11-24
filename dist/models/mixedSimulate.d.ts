import { type LmerResult } from "./lmer.js";
import { type GlmerResult } from "./glmer.js";
/** Options of {@link simulateLmer} and {@link simulateGlmer}.
 *
 * @category Mixed models
 */
export interface MixedSimulateOptions {
    /** Number of simulated response vectors. Default 1. */
    nsim?: number;
    /** Set the shared R-compatible random stream before simulation. Null or omitted uses its current state. */
    seed?: number | null;
    /** Condition on all fitted random effects, or generate new effects. Cannot be combined with reForm. */
    useU?: boolean | number;
    /** Random-effects terms to condition on: null (all), "NA" or "~0" (none), or a formula selecting whole terms. */
    reForm?: string | null;
}
/** Simulations from a mixed-model fit: one response vector per simulation, with R's simulation column names.
 *
 * @category Mixed models
 */
export interface MixedSimulations extends Array<number[] | [number, number][]> {
    /** Names of the simulation columns, "sim_1", ... */
    names: string[];
}
/**
 * Simulations from a linear mixed-model fit. Equivalent to R's `lme4::simulate.merMod()`.
 *
 * @category Mixed models
 */
export declare function simulateLmer(fit: LmerResult, options?: MixedSimulateOptions): MixedSimulations;
/**
 * Simulations from a generalized linear mixed-model fit. Equivalent to R's `lme4::simulate.merMod()`.
 *
 * @category Mixed models
 */
export declare function simulateGlmer(fit: GlmerResult, options?: MixedSimulateOptions): MixedSimulations;
