// Mixed models (rStats.js/mixed): linear mixed models fitted by REML or maximum likelihood, as lme4's lmer, and
// lmerTest's Satterthwaite t- and F-tests of their fixed effects

export { lmer, type LmerOptions, type LmerResult, type LmerVarCorr, type LmerRanef } from "../models/lmer.js";
export {
  lmerContest,
  lmerSummary,
  type LmerContestF,
  type LmerContestOptions,
  type LmerContestT,
  type LmerSummary,
  type LmerSummaryOptions,
} from "../models/lmerTest.js";
