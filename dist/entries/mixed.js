// Mixed models (rStats.js/mixed): linear mixed models fitted by REML or maximum likelihood, as lme4's lmer, lmerTest's
// Satterthwaite t- and F-tests and ANOVA tables of their fixed effects, and the likelihood-ratio comparison of fits
export { lmer } from "../models/lmer.js";
export { lmerContest, lmerSummary, } from "../models/lmerTest.js";
export { lmerAnova, } from "../models/lmerAnova.js";
// The handler of R's warnings that the tests, models and fits return (also exported from the root and /distributions)
export { setWarningHandler } from "../internal/warnings.js";
