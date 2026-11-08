/**
 * Throws unless the matrix is square, finite, symmetric (as R's isSymmetric: relative difference from its transpose at
 * most 100 ε) and has a positive diagonal. R's factanal takes any matrix: an asymmetric one gave a result
 */
export declare function checkCovmat(S: readonly (readonly number[])[]): void;
