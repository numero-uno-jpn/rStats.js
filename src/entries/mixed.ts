// Mixed models (rStats.js/mixed): linear mixed models fitted by REML or maximum likelihood, as lme4's lmer, lmerTest's
// Satterthwaite t- and F-tests and ANOVA tables of their fixed effects, and the likelihood-ratio comparison of fits

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
