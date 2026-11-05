// Mixed models (rStats.js/mixed): linear mixed models fitted by REML or maximum likelihood, as lme4's lmer, lmerTest's
// Satterthwaite t- and F-tests and ANOVA tables of their fixed effects, the likelihood-ratio comparison of fits, and
// generalized linear mixed models, as lme4's glmer, and the predictions of both

export { lmer, type LmerContrastName, type LmerOptions, type LmerResult, type LmerVarCorr, type LmerRanef } from "../models/lmer.js";
export {
  lmerContest,
  lmerSummary,
  type LmerContestF,
  type LmerContestOptions,
  type LmerContestT,
  type LmerSummary,
  type LmerSummaryOptions,
} from "../models/lmerTest.js";
export {
  lmerAnova,
  type LmerAnovaOptions,
  type LmerAnovaTable,
  type LmerAnovaType,
  type LmerCompareOptions,
  type LmerCompareTable,
} from "../models/lmerAnova.js";
export { glmer, type GlmerOptions, type GlmerResult } from "../models/glmer.js";
export { glmerSummary, type GlmerSummary, type GlmerSummaryOptions } from "../models/glmerSummary.js";
export { glmerAnova, type GlmerAnovaOptions, type GlmerAnovaTable } from "../models/glmerAnova.js";
export {
  glmerPredict,
  lmerPredict,
  type GlmerPredictOptions,
  type LmerPredictOptions,
  type MixedPrediction,
} from "../models/mixedPredict.js";
export type { GlmerFamilyName } from "../models/glmerFamily.js";
// Types used by the functions above, also exported from the root and the other subpaths
export type { DataFrame } from "../models/modelFrame.js";
export type { ContrastName } from "../models/modelMatrix.js";
export type { GlmLinkName } from "../models/glmFamily.js";
// The handler of R's warnings that the tests, models and fits return (also exported from the root and /distributions)
export { setWarningHandler, type WarningHandler } from "../internal/warnings.js";
