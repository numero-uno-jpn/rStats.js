import { type Alternative, type HTest, type Sample } from "./types.js";
/** Options for {@link ansariTest}. */
export interface AnsariTestOptions {
    /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
    /** Exact p-value. Default: exact when both samples have fewer than 50 values and there are no ties. */
    exact?: boolean;
}
/**
 * Ansari-Bradley test that two samples differ in scale. Equivalent to R's `ansari.test()` (without `conf.int`).
 * `NaN` values are dropped.
 */
export declare function ansariTest(x: Sample, y: Sample, options?: AnsariTestOptions): HTest;
