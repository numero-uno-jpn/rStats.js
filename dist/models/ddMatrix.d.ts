import { type DD } from "../special/dd.js";
export type DDMatrix = DD[][];
export declare const ddOf: (m: readonly (readonly number[])[]) => DDMatrix;
export declare const ddHi: (m: DDMatrix) => number[][];
export declare function ddTranspose(a: DDMatrix): DDMatrix;
export declare function ddMatMul(a: DDMatrix, b: DDMatrix): DDMatrix;
export declare function ddTrace(a: DDMatrix): DD;
export declare function ddDet(m: DDMatrix): DD;
/** Inverse of a non-singular matrix */
export declare function ddInverse(m: DDMatrix): DDMatrix;
