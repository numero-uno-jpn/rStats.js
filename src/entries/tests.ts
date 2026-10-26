// Hypothesis tests and models (rStats.js/tests): R's htest results as plain objects

export { tTest, type TTestOptions, type TTestResult } from "../htest/tTest.js";
export {
  chisqTest,
  type ChisqTestOptions,
  type ChisqTestResult,
  type ChisqTestFactorsResult,
  type Factor,
} from "../htest/chisqTest.js";
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
  kruskalTest, friedmanTest, cochranQTest, quadeTest, flignerTest, moodTest,
  type ChisqStatTestResult, type QuadeTestResult, type MoodTestOptions,
} from "../htest/rankTests.js";
export { onewayTest, shapiroTest, type OnewayTestOptions, type OnewayTestResult } from "../htest/onewayTest.js";
export { mantelhaenTest, type MantelhaenTestOptions, type MantelhaenTestResult } from "../htest/mantelhaenTest.js";
export { ansariTest, type AnsariTestOptions } from "../htest/ansariTest.js";
export { brunnerMunzelTest, type BrunnerMunzelTestOptions } from "../htest/brunnerMunzelTest.js";
export { ksTest, type KsTestOptions, type KsTestResult } from "../htest/ksTest.js";
export {
  pairwiseTTest, pairwiseWilcoxTest, pairwisePropTest,
  type PairwiseResult, type PairwiseOptions, type PairwiseTTestOptions, type PairwiseWilcoxTestOptions, type PairwisePropTestOptions,
} from "../htest/pairwise.js";
export { aov, TukeyHSD, zTest, type AovResult, type TukeyHSDOptions, type TukeyHSDResult, type ZTestOptions } from "../htest/aov.js";
export type { GroupLabel } from "../htest/groups.js";
export { lm, confint, predict, type LmOptions, type LmResult, type ConfintOptions, type PredictOptions } from "../models/lm.js";
export {
  glm,
  glmSummary,
  glmResiduals,
  glmHatvalues,
  glmRstandard,
  glmCooksDistance,
  glmPredict,
  type GlmOptions,
  type GlmResult,
  type GlmModel,
  type GlmSummary,
  type GlmSummaryOptions,
  type GlmResidualType,
  type GlmPredictOptions,
  type GlmFamilyName,
  type GlmFamilySpec,
  type GlmLink,
  type GlmLinkName,
  type QuasiVariance,
} from "../models/glm.js";
export { glmConfint, type GlmConfintOptions } from "../models/glmConfint.js";
export { glmAnova, type GlmAnovaOptions, type GlmAnovaResult, type GlmAnovaTest } from "../models/glmAnova.js";
export {
  modelMatrix,
  type ModelMatrixOptions,
  type ModelMatrixResult,
  type ContrastName,
} from "../models/modelMatrix.js";
export type { DataFrame } from "../models/modelFrame.js";
export type { LmFormulaOptions, LmFormulaResult } from "../models/lm.js";
export { anova, aovSummary, type AnovaTable, type AovStrataSummary } from "../models/anovaSequential.js";
export type { AovStrataFit, AovStratum } from "../models/aovStrata.js";
export { Anova, type AnovaOptions } from "../models/carAnova.js";
export { mauchlyTest, type MauchlyTestOptions, type MauchlyTestResult } from "../models/mauchly.js";
export {
  powerTTest,
  powerPropTest,
  powerAnovaTest,
  type PowerTTestOptions,
  type PowerTTestResult,
  type PowerPropTestOptions,
  type PowerPropTestResult,
  type PowerAnovaTestOptions,
  type PowerAnovaTestResult,
} from "../htest/power.js";
export {
  pwrTTest,
  pwrT2nTest,
  pwr2pTest,
  pwr2p2nTest,
  pwrPTest,
  pwrNormTest,
  pwrRTest,
  pwrChisqTest,
  pwrAnovaTest,
  pwrF2Test,
  esH,
  esW1,
  esW2,
  cohenES,
  type EffectSize,
  type CohenTest,
  type CohenESResult,
  type PwrTTestOptions,
  type PwrTTestResult,
  type PwrT2nTestOptions,
  type PwrT2nTestResult,
  type Pwr2pTestOptions,
  type Pwr2pTestResult,
  type Pwr2p2nTestOptions,
  type Pwr2p2nTestResult,
  type PwrNormTestOptions,
  type PwrNormTestResult,
  type PwrRTestOptions,
  type PwrRTestResult,
  type PwrChisqTestOptions,
  type PwrChisqTestResult,
  type PwrAnovaTestOptions,
  type PwrAnovaTestResult,
  type PwrF2TestOptions,
  type PwrF2TestResult,
} from "../htest/pwr.js";
export {
  cohensD,
  hedgesG,
  etaSquared,
  omegaSquared,
  epsilonSquared,
  type CohensDOptions,
  type CohensDResult,
  type AnovaEffectSizeOptions,
  type EtaSquaredOptions,
  type AnovaEffectSizeTable,
  type AnovaEffectSizeModel,
} from "../htest/effectSize.js";
export { aovEz, type AovEzOptions, type AovEzResult, type AovEzTable, type AovEzEffectSize } from "../models/aovEz.js";
export {
  dscfAllPairsTest,
  kwAllPairsDunnTest,
  kwManyOneDunnTest,
  dunnettTest,
  gamesHowellTest,
  tukeyTest,
  steelTest,
  manyOneUTest,
  dunnTest,
  glhtDunnett,
  type PMCMRResult,
  type KwAllPairsDunnTestOptions,
  type ManyOneTestOptions,
  type KwManyOneDunnTestOptions,
  type ManyOneUTestOptions,
  type DunnTestMethod,
  type DunnTestOptions,
  type DunnTestResult,
  type GlhtDunnettOptions,
  type GlhtDunnettResult,
} from "../htest/multipleComparisons.js";
export {
  survdiff,
  survfit,
  type SurvdiffOptions,
  type SurvdiffResult,
  type SurvfitOptions,
  type SurvfitResult,
  type SurvfitConfType,
} from "../models/survival.js";
export {
  coxph,
  type CoxphOptions,
  type CoxphControl,
  type CoxphResult,
  type CoxphTest,
} from "../models/coxph.js";
export { leveneTest, type LeveneTestOptions, type LeveneTestResult } from "../htest/leveneTest.js";
export {
  propTrendTest,
  jonckheereTest,
  type PropTrendTestResult,
  type JonckheereAlternative,
  type JonckheereTestOptions,
  type JonckheereTestResult,
} from "../htest/trendTests.js";
export {
  adTest,
  cvmTest,
  lillieTest,
  sfTest,
  pearsonTest,
  type NormalityTestResult,
  type CvmTestResult,
  type PearsonTestOptions,
} from "../htest/normalityTests.js";
export {
  kappa2,
  kappamFleiss,
  icc,
  cronbachAlpha,
  partialR,
  type Kappa2Weight,
  type Kappa2Options,
  type KappaResult,
  type KappamFleissOptions,
  type IccOptions,
  type IccResult,
  type CronbachAlphaResult,
} from "../htest/agreement.js";
export { factanal, type FactanalOptions, type FactanalResult, type FactanalRotation, type FactanalScores } from "../descriptive/factanal.js";
export { omega, type OmegaOptions, type OmegaResult } from "../descriptive/omega.js";
export {
  polychor,
  polyserial,
  type PolycorResult,
  type PolycorOptions,
  type PolychorStdErrResult,
  type PolyserialStdErrResult,
} from "../htest/polycor.js";
