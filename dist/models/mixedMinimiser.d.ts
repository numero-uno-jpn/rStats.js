/** The tolerances and steps of the minimiser (relative to max(1, max |x|) unless said otherwise). */
export interface MinimiserSettings {
    /** Step of the central differences that give the Hessian, relative to |x_j| ... */
    hessianStep: number;
    /** ... and at least this (relative to max(1, max |x|)), for elements at or near 0 */
    hessianStepFloor: number;
    /** Converged when the Newton step is below this ... */
    stepTolerance: number;
    /** ... or when the steps stop decreasing (rounding level) below this; steps this small are always accepted */
    stepFloor: number;
    /** The gradient on the free elements at convergence must be below this times max(1, |criterion|) */
    gradientTolerance: number;
    /** An element held at 0 is released when its derivative is above this times max(1, |criterion|) */
    releaseTolerance: number;
}
/** lmer's settings (an analytic gradient) */
export declare const LMER_SETTINGS: MinimiserSettings;
/**
 * A criterion to minimise (internal): its value and gradient at x, which elements are diagonal elements of θ (lower
 * bound 0, held at exactly 0 on the boundary), and the columns of the blocks T_k (lists of indices of x, the diagonal
 * element first) whose sign may change without changing the criterion. Elements that are neither (off-diagonal
 * elements of θ, fixed effects) are free.
 */
export interface MinimiserProblem {
    /** The criterion and its gradient at x (all elements) */
    evaluate: (x: readonly number[]) => {
        f: number;
        g: number[];
    };
    /**
     * The Hessian on the elements `set` at x (optional; default: central differences of `evaluate`'s gradient with
     * the settings' steps). `scale` is max(1, max |x|).
     */
    hessian?: (x: readonly number[], set: readonly number[], scale: number) => number[][];
    diagonal: readonly boolean[];
    columns: readonly (readonly number[])[];
    settings: MinimiserSettings;
    /**
     * What a non-finite criterion at a trial point means: false, an error (lmer, whose criterion is finite wherever
     * defined); true, a rejected step (glmer, whose evaluations can fail far from the optimum)
     */
    rejectNonFinite: boolean;
    /** The message of the Error thrown when the minimisation does not converge */
    failure: string;
    /**
     * glmer's safeguards (lmer's minimisation is unchanged without them): a boundary sub-problem of
     * {@link minimiseWithRestarts} that fails is left out of the comparison instead of failing the minimisation; a
     * gradient that fails at a point of the differences of the Hessian is replaced by the one-sided difference; and
     * steps rejected again and again at the smallest radius (the criterion cannot tell the trial from the point to
     * rounding) end the minimisation there, converged if the gradient is below the tolerance (see localMinimum)
     */
    robust?: boolean;
}
/** The result of a local minimisation: the point, its criterion and whether it converged */
export interface MinimiserResult {
    theta: number[];
    f: number;
    /** false only with `bestOnFailure`: the best point reached before the minimisation failed */
    converged: boolean;
}
/** Eigenvalues and eigenvectors of a small symmetric matrix by cyclic Jacobi rotations; vectors[k] is the k-th vector */
export declare function symmetricEigen(a0: readonly (readonly number[])[]): {
    values: number[];
    vectors: number[][];
};
/**
 * A local minimiser of the criterion, subject to the lower bounds of the diagonal elements (see src/models/lmer.ts),
 * started at `start`, with the elements in `held` kept at exactly 0 throughout (never free, never released); with its
 * criterion
 */
export declare function localMinimum(problem: MinimiserProblem, start: readonly number[], held?: ReadonlySet<number>): {
    theta: number[];
    f: number;
};
/**
 * The minimiser: the local minimum reached from `start`, then compared with the local minima reached from its
 * boundary points with one whole term removed (`blocks`: the indices of each term's block); a clearly better one is
 * the start of a new local minimisation, until none is (see src/models/lmer.ts). Returns the minimiser and its
 * criterion.
 */
export declare function minimiseWithRestarts(problem: MinimiserProblem, start: readonly number[], blocks: readonly (readonly number[])[], options?: {
    bestOnFailure?: boolean;
}): MinimiserResult;
