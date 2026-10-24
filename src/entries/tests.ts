// Hypothesis tests (rStats.js/tests): R's htest results as plain objects

export { tTest, type TTestOptions, type TTestResult } from "../htest/tTest.js";
export { chisqTest, type ChisqTestOptions, type ChisqTestResult } from "../htest/chisqTest.js";
export { fisherTest, type FisherTestOptions, type FisherTestResult } from "../htest/fisherTest.js";
export { wilcoxTest, type WilcoxTestOptions, type WilcoxTestResult } from "../htest/wilcoxTest.js";
export { cor, corTest, type CorMethod, type CorOptions, type CorTestOptions, type CorTestResult } from "../htest/cor.js";
export { pAdjust, type PAdjustMethod, type PAdjustOptions } from "../htest/pAdjust.js";
export type { Alternative, Counts, HTest, Sample } from "../htest/types.js";
