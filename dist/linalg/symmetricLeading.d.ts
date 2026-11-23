export interface SymmetricLeading {
    /** All n eigenvalues, decreasing. */
    values: number[];
    /** The first k eigenvectors (unit length), vectors[j] for values[j]. */
    vectors: number[][];
}
/** a: the matrix as rows (only the lower triangle is read); k: how many leading eigenvectors */
export declare function symmetricLeading(a: readonly (readonly number[])[], k: number): SymmetricLeading;
