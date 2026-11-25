// Regression models (rStats.js/regression)
export { rlm, rlmSummary, rlmVcov, psiHuber, psiHampel, psiBisquare, } from "../models/rlm.js";
// Multinomial logistic regression (rStats.js/regression)
export { multinom, multinomSummary, multinomConfint, multinomPredict, multinomAnova, multinomVcov, } from "../models/multinom.js";
// Ordinal regression (rStats.js/regression)
export { polr, polrPredict, polrConfint, polrAnova, polrSummary, polrVcov, } from "../models/polr.js";
// Nonlinear regression (rStats.js/regression)
export { nls, nlsSummary, nlsVcov, nlsPredict, nlsConfint, nlsAnova, } from "../models/nls.js";
// Quantile regression (rStats.js/regression)
export { rq, rqPredict, rqSummary, rqPredictInterval, rqAnova, } from "../models/rq.js";
// Generalized estimating equations (rStats.js/regression)
export { geeglm, geeSummary, geeVcov, geePredict, geeAnova, geeQIC, } from "../models/gee.js";
// Penalized regression (rStats.js/regression)
export { glmnet, glmnetCoef, glmnetPredict, cvGlmnet, } from "../models/glmnet.js";
