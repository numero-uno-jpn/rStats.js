import type { Mat } from "./matrix.js";
/**
 * Balancing (dgebal) with job "P" (permute only), "S" (scale only) or "B" (permute, then scale rows and columns
 * ilo..ihi); A is overwritten. Indices are 0-based: scale[i] holds the index of the row and column interchanged
 * with i for i < ilo and i > ihi, and the scaling factor for ilo <= i <= ihi
 */
export declare function gebal(job: "P" | "S" | "B", A: Mat): {
    ilo: number;
    ihi: number;
    scale: Float64Array;
};
/**
 * Back transformation of right eigenvectors (dgebak with job "B", side "R"): V holds the eigenvectors of the
 * balanced matrix as columns and is overwritten with those of the original matrix. Row i in ilo..ihi is multiplied
 * by its scaling factor, then the interchanges are undone in reverse order
 */
export declare function gebak(bal: {
    ilo: number;
    ihi: number;
    scale: Float64Array;
}, V: Mat): void;
