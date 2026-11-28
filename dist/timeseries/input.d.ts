/**
 * The series as numbers. Throws a RangeError naming the function when a value is infinite, when a value is missing
 * (NaN) and `missing` is "fail", or when fewer than `minLength` values are observed.
 */
export declare function tsInput(x: readonly number[], what: string, options?: {
    missing?: "allow" | "fail";
    minLength?: number;
}): number[];
