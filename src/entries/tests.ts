// Hypothesis tests (rStats.js/tests): R's htest results as plain objects

export { tTest, type TTestOptions, type TTestResult } from "../htest/tTest.js";
export { chisqTest, type ChisqTestOptions, type ChisqTestResult } from "../htest/chisqTest.js";
export { fisherTest, type FisherTestOptions, type FisherTestResult } from "../htest/fisherTest.js";
export { wilcoxTest, type WilcoxTestOptions, type WilcoxTestResult } from "../htest/wilcoxTest.js";
export { corTest, type CorMethod, type CorOptions, type CorTestOptions, type CorTestResult } from "../htest/cor.js";
export { pAdjust, type PAdjustMethod, type PAdjustOptions } from "../htest/pAdjust.js";
export type { Alternative, Counts, HTest, Sample } from "../htest/types.js";
export { binomTest, type BinomTestOptions, type BinomTestResult } from "../htest/binomTest.js";
export { poissonTest, type PoissonTestOptions, type PoissonTestResult } from "../htest/poissonTest.js";
export { propTest, type PropTestOptions, type PropTestResult } from "../htest/propTest.js";
export { mcnemarTest, type McnemarTestOptions, type McnemarTestResult } from "../htest/mcnemarTest.js";
export { varTest, bartlettTest, type VarTestOptions, type VarTestResult, type BartlettTestResult } from "../htest/varTest.js";
export {
  kruskalTest, friedmanTest, quadeTest, flignerTest, moodTest,
  type ChisqStatTestResult, type QuadeTestResult, type MoodTestOptions,
} from "../htest/rankTests.js";
export { onewayTest, shapiroTest, type OnewayTestOptions, type OnewayTestResult } from "../htest/onewayTest.js";
export { mantelhaenTest, type MantelhaenTestOptions, type MantelhaenTestResult } from "../htest/mantelhaenTest.js";
export { ansariTest, type AnsariTestOptions } from "../htest/ansariTest.js";
export { ksTest, type KsTestOptions, type KsTestResult } from "../htest/ksTest.js";
export {
  pairwiseTTest, pairwiseWilcoxTest, pairwisePropTest,
  type PairwiseResult, type PairwiseOptions, type PairwiseTTestOptions, type PairwiseWilcoxTestOptions, type PairwisePropTestOptions,
} from "../htest/pairwise.js";
export { aov, TukeyHSD, zTest, type AovResult, type TukeyHSDOptions, type TukeyHSDResult, type ZTestOptions } from "../htest/aov.js";
export type { GroupLabel } from "../htest/groups.js";
