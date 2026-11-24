// Clean-room check of the R scripts that .github/workflows/r-experiments.yml runs for an outside contributor:
//
//   node scripts/r-experiment-check.mjs experiments/a.R experiments/b.R
//
// The contributor may call the exported functions of the reference packages and read their documented return
// values, but must not see the packages' source (cmprsk is GPL, rStats.js is MIT). In R, a function's source is one
// step away (typing its name prints it), so a script is rejected when it
//   - names a function of a reference package without calling it (`cuminc`, `cmprsk::cuminc`, `print(cuminc)`),
//   - uses a function that shows or reaches code or namespaces (deparse, body, getAnywhere, :::, asNamespace, ...),
//   - calls compiled code directly (.Fortran, .C, .Call, ...), runs other programs or reads files and URLs,
//   - names a function through a string (get("cuminc"), do.call("cuminc", ...)),
//   - loads or uses (pkg::) a package outside ALLOWED_PACKAGES.
// The check is strict on purpose (a false positive is fixed by rewriting the script) and is not a proof: a person
// still reviews what the scripts do. Comments are ignored; string literals are checked separately.
// Exit status 1 with one line per violation ("file:line: message"), 0 when every script passes.
// Written for rStats.js (no ported code).

import { readFileSync } from "node:fs";

const ALLOWED_PACKAGES = new Set([
  "cmprsk", "survival", "epiR", "exact2x2", "clinfun", "powerSurvEpi", "metafor", "metadat", "lme4", "Matrix",
  "MASS", "quantreg", "SparseM", "MatrixModels", "geepack", "glmnet", "PMCMRplus", "outliers", "ca", "Matching", "cobalt",
  "tableone", "WeightIt", "CBPS", "survey", "sandwich", "nnet", "jsonlite", "stats", "utils", "base",
]);

/** Functions of the reference packages: they may only be called. */
const REFERENCE_FUNCTIONS = [
  "cuminc", "timepoints", "crr", "predict.crr", "summary.crr", "print.crr", "print.summary.crr", "print.cuminc",
  "plot.cuminc", "plot.predict.crr", "crstm", "cinc", "crrfsv", "crrf", "crrvv", "crrsr", "crrfit",
  // epiR, exact2x2, clinfun and powerSurvEpi (sample size and power, roadmap item 1): their exported functions
  "aucVardiTest", "bdrycross.prob", "binomMeld.test", "blaker.exact", "borrControl", "borrOrdering", "borrPreCalc",
  "borrPvals", "borrTest", "boschloo", "calcTall", "calogrank", "constrMLE.difference", "constrMLE.oddsratio",
  "constrMLE.ratio", "coxphCPE", "coxphERR", "coxphQuantile", "CPS.ssize", "createR", "deltaAUC", "epi.2by2",
  "epi.about", "epi.asc", "epi.betabuster", "epi.blcm.paras", "epi.bohning", "epi.ccc", "epi.conf", "epi.convgrid",
  "epi.cp", "epi.cpresids", "epi.descriptives", "epi.dgamma", "epi.directadj", "epi.dms", "epi.dsl", "epi.edr",
  "epi.empbayes", "epi.evalue", "epi.fpos", "epi.herdtest", "epi.indirectadj", "epi.insthaz", "epi.interaction",
  "epi.iref", "epi.iv", "epi.kappa", "epi.ltd", "epi.mbf", "epi.mh", "epi.nomogram", "epi.occc", "epi.offset",
  "epi.pooled", "epi.popsize", "epi.prcc", "epi.prev", "epi.psi", "epi.realrisk", "epi.RtoBUGS", "epi.smd", "epi.smr",
  "epi.sscc", "epi.ssclus1estb", "epi.ssclus1estc", "epi.ssclus2estb", "epi.ssclus2estc", "epi.sscohortc",
  "epi.sscohortt", "epi.sscompb", "epi.sscompc", "epi.sscomps", "epi.ssdetect", "epi.ssdxsesp", "epi.ssdxtest",
  "epi.ssequb", "epi.ssequc", "epi.ssninfb", "epi.ssninfc", "epi.sssimpleestb", "epi.sssimpleestc",
  "epi.ssstrataestb", "epi.ssstrataestc", "epi.sssupb", "epi.sssupc", "epi.ssxsectn", "epi.tests", "exact2x2",
  "exact2x2CI", "exact2x2Plot", "exact2x2Pvals", "fe.mdor", "fe.power", "fe.ssize", "fillsquare", "fisher.exact",
  "fisherCalcMidp", "futilbdry", "getColor", "getDeltaGrid", "getPDQD", "getPI", "getPrange", "gsdesign.binomial",
  "gsdesign.normal", "gsdesign.survival", "jonckheere.test", "mcnemar.exact", "mcnemar.exact.calc", "mcnemarExactDP",
  "mdrr", "numDEpi", "numDEpi.default", "oc.twostage.bdry", "or2pcase", "orderMat", "permlogrank", "ph2simon",
  "ph2single", "pickTstat", "plotRankMat", "plotT", "power.ladesign", "power.stratify", "power2grid",
  "power2gridDifference", "power2gridRatio", "power2x2", "Power2x2", "powerBorr", "powerConLogistic.bin",
  "powerConLogistic.con", "powerCT", "powerCT.default", "powerCT.default0", "powerEpi", "powerEpi.default",
  "powerEpiCont", "powerEpiCont.default", "powerEpiInt", "powerEpiInt.default0", "powerEpiInt.default1",
  "powerEpiInt2", "powerPaired2x2", "powerWelchT", "pselect", "roc.area.test", "roc.curve", "roc.perm.test",
  "rsu.adjrisk", "rsu.dxtest", "rsu.epinf", "rsu.pfree.equ", "rsu.pfree.rs", "rsu.pstar", "rsu.sep", "rsu.sep.cens",
  "rsu.sep.pass", "rsu.sep.rb", "rsu.sep.rb1rf", "rsu.sep.rb2rf", "rsu.sep.rb2st", "rsu.sep.rbvarse", "rsu.sep.rs",
  "rsu.sep.rs2st", "rsu.sep.rsfreecalc", "rsu.sep.rsmult", "rsu.sep.rspool", "rsu.sep.rsvarse", "rsu.spp.rs",
  "rsu.sspfree.rs", "rsu.sssep.rb2st1rf", "rsu.sssep.rb2st2rf", "rsu.sssep.rbmrg", "rsu.sssep.rbsrg", "rsu.sssep.rs",
  "rsu.sssep.rs2st", "rsu.sssep.rsfreecalc", "rsu.sssep.rspool", "ss2x2", "SS2x2", "ssize.stratify", "ssizeCT",
  "ssizeCT.default", "ssizeEpi", "ssizeEpi.default", "ssizeEpiCont", "ssizeEpiCont.default", "ssizeEpiInt",
  "ssizeEpiInt.default0", "ssizeEpiInt.default1", "ssizeEpiInt2", "ssizeWelchT", "toxbdry", "twostage.admissible",
  "twostage.inference", "ucControl", "uncondExact2x2", "uncondExact2x2Pvals", "uncondPower2x2", "unirootGrid",
  // metafor (meta-analysis): its exported functions (S3 methods with other characters left out)
  "addpoly", "addpoly.default", "addpoly.predict.rma", "addpoly.rma", "aggregate.escalc", "AIC.matreg", "AIC.rma",
  "anova.rma", "as.data.frame.anova.rma", "as.data.frame.confint.rma", "as.data.frame.list.anova.rma",
  "as.data.frame.list.confint.rma", "as.data.frame.list.rma", "as.data.frame.vif.rma", "as.matrix.list.rma", "baujat",
  "baujat.rma", "BIC.matreg", "BIC.rma", "bldiag", "blsplit", "blup", "blup.rma.uni", "cbind.escalc", "cmicalc",
  "coef.deltamethod", "coef.matreg", "coef.permutest.rma.uni", "coef.rma", "coef.summary.rma", "confint.matreg",
  "confint.rma.glmm", "confint.rma.ls", "confint.rma.mh", "confint.rma.mv", "confint.rma.peto", "confint.rma.uni",
  "confint.rma.uni.selmodel", "contrmat", "conv.2x2", "conv.delta", "conv.fivenum", "conv.wald",
  "cooks.distance.rma.mv", "cooks.distance.rma.uni", "cumul", "cumul.rma.mh", "cumul.rma.peto", "cumul.rma.uni",
  "deltamethod", "deviance.rma", "df.residual.rma", "dfbetas.rma.mv", "dfbetas.rma.uni", "dfround", "emmprep",
  "escalc", "fitstats", "fitstats.rma", "fitted.rma", "fmtp", "fmtp2", "fmtt", "fmtx", "forest", "forest.cumul.rma",
  "forest.default", "forest.rma", "formula.rma", "fsn", "funnel", "funnel.default", "funnel.rma", "getmfopt", "gosh",
  "gosh.rma", "hatvalues.rma.mv", "hatvalues.rma.uni", "hc", "hc.rma.uni", "head.list.rma", "hettest",
  "influence.rma.uni", "labbe", "labbe.rma", "leave1out", "leave1out.rma.mh", "leave1out.rma.peto",
  "leave1out.rma.uni", "llplot", "logLik.matreg", "logLik.rma", "matreg", "metafor.news", "model.matrix.rma",
  "nobs.rma", "pairmat", "permutest", "permutest.rma.ls", "permutest.rma.uni", "plot.cumul.rma", "plot.gosh.rma",
  "plot.infl.rma.uni", "plot.permutest.rma.uni", "plot.profile.rma", "plot.rma.glmm", "plot.rma.mh", "plot.rma.mv",
  "plot.rma.peto", "plot.rma.uni", "plot.rma.uni.selmodel", "plot.vif.rma", "points.regplot", "predict.matreg",
  "predict.rma", "predict.rma.ls", "print.anova.rma", "print.confint.matreg", "print.confint.rma",
  "print.deltamethod", "print.escalc", "print.fsn", "print.gosh.rma", "print.hc.rma.uni", "print.hettest",
  "print.infl.rma.uni", "print.list.anova.rma", "print.list.confint.rma", "print.list.rma", "print.matreg",
  "print.permutest.rma.uni", "print.profile.rma", "print.ranktest", "print.regtest", "print.rma.glmm", "print.rma.mh",
  "print.rma.mv", "print.rma.peto", "print.rma.uni", "print.summary.matreg", "print.summary.rma", "print.tes",
  "print.vcovmat", "print.vif.rma", "profile.rma.ls", "profile.rma.mv", "profile.rma.uni", "profile.rma.uni.selmodel",
  "qqnorm.rma.glmm", "qqnorm.rma.mh", "qqnorm.rma.mv", "qqnorm.rma.peto", "qqnorm.rma.uni", "radial", "radial.rma",
  "ranef", "ranef.rma.mv", "ranef.rma.uni", "ranktest", "rbind.escalc", "rcalc", "regplot", "regplot.rma", "regtest",
  "replmiss", "reporter", "reporter.rma.uni", "residuals.rma", "rma", "rma.glmm", "rma.mh", "rma.mv", "rma.peto",
  "rma.uni", "robust", "robust.rma.mv", "robust.rma.uni", "rstandard.rma.mh", "rstandard.rma.mv",
  "rstandard.rma.peto", "rstandard.rma.uni", "rstudent.rma.mh", "rstudent.rma.mv", "rstudent.rma.peto",
  "rstudent.rma.uni", "se", "se.default", "se.rma", "selmodel", "selmodel.rma.uni", "setmfopt", "sigma.matreg",
  "simulate.rma", "summary.escalc", "summary.matreg", "summary.rma", "tail.list.rma", "tes", "to.long", "to.table",
  "to.wide", "transf.abt", "transf.ahw", "transf.arcsin", "transf.clestod", "transf.dtobesd", "transf.dtocles",
  "transf.dtocles.int", "transf.dtocliffd", "transf.dtolnor.logis", "transf.dtolnor.norm", "transf.dtomd",
  "transf.dtoovl", "transf.dtorbis", "transf.dtorpb", "transf.dtou1", "transf.dtou2", "transf.dtou3",
  "transf.exp.int", "transf.exp.mode", "transf.iabt", "transf.iabt.int", "transf.iabt.mode", "transf.iahw",
  "transf.iahw.int", "transf.iahw.mode", "transf.iarcsin", "transf.iarcsin.int", "transf.iarcsin.mode",
  "transf.iirft", "transf.ilogit", "transf.ilogit.int", "transf.ilogit.mode", "transf.ipft", "transf.ipft.hm",
  "transf.iprobit", "transf.iprobit.int", "transf.iprobit.mode", "transf.irft", "transf.isqrt",
  "transf.lnortod.logis", "transf.lnortod.norm", "transf.lnortord", "transf.lnortorr", "transf.lnortortet.digby",
  "transf.lnortortet.pearson", "transf.logit", "transf.pft", "transf.probit", "transf.r2toz", "transf.rpbtod",
  "transf.rpbtorbis", "transf.rtod", "transf.rtorpb", "transf.rtoz", "transf.ztor", "transf.ztor.int",
  "transf.ztor.mode", "transf.ztor2", "trimfill", "trimfill.rma.uni", "update.rma", "vcalc", "vcov.deltamethod",
  "vcov.matreg", "vcov.rma", "vec2mat", "vif", "vif.rma", "weights.rma.glmm", "weights.rma.mh", "weights.rma.mv",
  "weights.rma.peto", "weights.rma.uni",
  // lme4 and Matrix (mixed models, roadmap item 1, 1.6.0): their exported functions whose names are not also base R's
  // (S3 methods and generics with other characters left out; the deviance-function builders are in FORBIDDEN_NAMES)
  "allFit", "anyStructured", "bootMer", "checkConv", "confint.merMod", "cov2sdcor", "Cv_to_Sv", "Cv_to_Vv", "devcomp",
  "dotplot.ranef.mer", "dummy", "expandDoubleVerts", "factorize", "findbars", "fixef", "forceNewMerMod", "formatVC",
  "fortify.merMod", "getData", "getDoublevertDefault", "getL", "getLambda", "getLambdat.dp", "getLambdat.i",
  "getLower", "getME", "getPar", "getParLength", "getParNames", "getProfLower", "getProfPar", "getProfUpper",
  "getReCovs", "getSingTol", "getTheta", "getThetaIndex", "getThetaIndexLength", "getThetaLength", "getThetaNames",
  "getUpper", "getVC", "getVCNames", "GHrule", "glFormula", "glmer", "glmer.nb", "glmerControl", "glmFamily",
  "glmResp", "golden", "GQdk", "GQN", "isGLMM", "isLMM", "isNested", "isNewMerMod", "isNLMM", "isREML", "isSingular",
  "lFormula", "llikAIC", "lme4_testlevel", "lmer", "lmerControl", "lmerResp", "lmList", "lmResp", "logProf",
  "merPredD", "methTitle", "mkDataTemplate", "mkMerMod", "mkNewReTrms", "mkParsTemplate", "mkRespMod", "mkReTrms",
  "mkVarCorr", "mlist2vec", "namedList", "negative.binomial", "Nelder_Mead", "NelderMead", "ngrps", "nlformula",
  "nlmer", "nlmerControl", "nlminbwrap", "nloptwrap", "nlsResp", "nobars", "optimizeGlmer", "optimizeLmer", "ranef",
  "refit", "refitML", "REMLcrit", "reOnly", "rePCA", "rePos", "sdcor2cov", "setPar", "setProfPar", "setTheta", "setVC",
  "simulate.formula", "subbars", "Sv_to_Cv", "VarCorr", "varianceProf", "vcov.merMod", "vec2mlist", "vec2STlist",
  "Vv_to_Cv",
  "abIseq", "abIseq1", "aggregateT", "anyDuplicatedT", "asPerm", "asUniqueT", "band", "bandSparse", "bdiag",
  "BunchKaufman", "c.sparseVector", "cBind", "Cholesky", "colScale", "condest", "diagN2U", "Diagonal", "diagU2N",
  "dimScale", "dmperm", "drop0", "expand", "expand1", "expand2", "expm", "fac2sparse", "fac2Sparse", "facmul",
  "forceSymmetric", "formatSparseM", "formatSpMatrix", "graph2T", "Hilbert", "invertPerm", "invPerm", "is.null.DN",
  "isDiagonal", "isLDL", "isPerm", "isTriangular", "isUniqueT", "KhatriRao", "lu", "mat2triplet", "Matrix",
  "Matrix.Version", "MatrixClass", "nearPD", "nnzero", "onenormest", "pack", "printSpMatrix", "printSpMatrix2",
  "qr2rankMatrix", "qrR", "rankMatrix", "rBind", "readHB", "readMM", "rep2abI", "rowScale", "rsparsematrix", "Schur",
  "signPerm", "skewpart", "sparse.model.matrix", "sparseMatrix", "sparseVector", "spMatrix", "symmpart", "T2graph",
  "tril", "triu", "uniqTsparse", "unpack", "updown", "writeMM",
  // MASS (regression, 1.7.0): its exported functions whose names are not also base R's. The psi functions may also be
  // passed to rlm as `psi = psi.huber` (see PSI_ARGUMENT)
  "addterm", "area", "as.fractions", "bandwidth.nrd", "bcv", "boxcox", "con2tr", "contr.sdif", "corresp", "cov.mcd",
  "cov.mve", "cov.rob", "cov.trob", "denumerate", "dose.p", "dropterm", "enlist", "eqscplot", "fbeta", "fitdistr",
  "fractions", "frequency.polygon", "gamma.dispersion", "gamma.shape", "ginv", "glm.convert", "glm.nb", "glmmPQL",
  "hist.FD", "hist.scott", "huber", "hubers", "is.fractions", "isoMDS", "kde2d", "lda", "ldahist", "lm.gls",
  "lm.ridge", "lmsreg", "loglm", "loglm1", "logtrans", "lqs", "lqs.formula", "ltsreg", "mca", "mvrnorm",
  "nclass.freq", "neg.bin", "negexp.SSival", "Null", "parcoord", "polr", "psi.bisquare", "psi.hampel",
  "psi.huber", "qda", "rational", "renumerate", "rlm", "rms.curv", "rnegbin", "sammon", "select", "Shepard",
  "stdres", "stepAIC", "studres", "theta.md", "theta.ml", "theta.mm", "truehist", "ucv", "width.SJ", "write.matrix",
  // stats' nonlinear least squares and self-starting models (regression, 1.7.0): R's own code, GPL like the packages
  "nls", "nls.control", "selfStart", "getInitial", "numericDeriv", "sortedXyData", "NLSstClosestX",
  "NLSstRtReplicate", "NLSstLfAsymptote", "NLSstAsymptotic", "SSasymp", "SSasympOff", "SSasympOrig", "SSbiexp",
  "SSfol", "SSfpl", "SSgompertz", "SSlogis", "SSmicmen", "SSweibull",
  // stats' stepwise model selection (step, 1.15.0): R's own code, GPL like the packages
  "step", "add1", "drop1", "extractAIC", "add.scope", "drop.scope", "factor.scope",
  // quantreg, geepack and glmnet (regression, 1.8.0): their exported functions (geepack's re-exported %>% is left out)
  "AIC.nlrq", "AIC.rq", "AIC.rqs", "AIC.rqss", "akj", "anova.rq", "anova.rqlist", "anova.rqs", "bandwidth.rq",
  "boot.crq", "boot.rq", "boot.rq.mcmb", "boot.rq.pwxy", "boot.rq.pwy", "boot.rq.pxy", "boot.rq.spwy", "boot.rq.wxy",
  "boot.rq.xy", "ChangeLog", "coef.crq", "coef.nlrq", "combos", "critval", "crq", "crq.fit.pen", "crq.fit.por",
  "crq.fit.por2", "crq.fit.pow", "Curv", "deviance.nlrq", "dither", "dynrq", "end.dynrq", "extractAIC.nlrq",
  "extractAIC.rq", "FAQ", "fitted.nlrq", "fitted.rqss", "formula.nlrq", "formula.rq", "Hill", "Hill.fit",
  "index.dynrq", "KhmaladzeTest", "kselect", "kuantile", "kunique", "LassoLambdaHat", "latex", "latex.summary.rqs",
  "latex.table", "latex.table.rq", "lm.fit.recursive", "logLik.nlrq", "logLik.rq", "logLik.rqs", "logLik.rqss",
  "lprq", "Munge", "nlrq", "nlrq.control", "nlrqModel", "ParetoTest", "Pickands", "Pickands.fit", "plot.qss1",
  "plot.qss2", "plot.rq.process", "plot.rqs", "plot.rqss", "plot.summary.crqs", "plot.summary.rqs",
  "plot.summary.rqss", "plot.table.rq", "predict.crq", "predict.crqs", "predict.nlrq", "predict.qss1", "predict.qss2",
  "predict.rq", "predict.rq.process", "predict.rqs", "predict.rqss", "print.anova.rq", "print.crq", "print.dynrq",
  "print.dynrqs", "print.Hill", "print.nlrq", "print.Pickands", "print.rq", "print.rqs", "print.rqss",
  "print.summary.crq", "print.summary.crqs", "print.summary.dynrq", "print.summary.dynrqs", "print.summary.Hill",
  "print.summary.nlrq", "print.summary.Pickands", "print.summary.rq", "print.summary.rqs", "print.summary.rqss",
  "q489", "qrisk", "qss", "qss1", "qss2", "QTECox", "qts1", "ranks", "rearrange", "resid.rqss", "residuals.nlrq",
  "rq", "rq.fit", "rq.fit.br", "rq.fit.conquer", "rq.fit.fnb", "rq.fit.fnc", "rq.fit.hogg", "rq.fit.lasso",
  "rq.fit.pfn", "rq.fit.pfnb", "rq.fit.ppro", "rq.fit.qfnb", "rq.fit.scad", "rq.fit.sfn", "rq.fit.sfnc",
  "rq.test.anowar", "rq.test.rank", "rq.wfit", "rqProcess", "rqs.fit", "rqss", "rqss.fit", "sfn.control",
  "sfnMessage", "srisk", "start.dynrq", "summary.crq", "summary.crqs", "summary.dynrqs", "summary.Hill",
  "summary.nlrq", "summary.Pickands", "summary.rq", "summary.rqs", "summary.rqss", "table.rq", "tau.nlrq",
  "triogram.fidelity", "triogram.penalty", "untangle.specials",
  "compCoef", "fixed2Zcor", "geeglm", "geese", "geese.control", "geese.fit", "genZcor", "ordgee", "QIC", "relRisk",
  "tidy",
  "assess.glmnet", "bigGlm", "buildPredmat", "Cindex", "coef.glmnet", "coef.relaxed", "confusion.glmnet", "coxgrad",
  "coxnet.deviance", "cv.glmnet", "glmnet", "glmnet.control", "glmnet.measures", "makeX", "na_sparse_fix",
  "na.replace", "predict.glmnet", "predict.relaxed", "prepareX", "print.cv.glmnet", "relax.glmnet", "rmult",
  "roc.glmnet", "stratifySurv",
  // PMCMRplus and outliers (tests, 1.9.0): their exported functions and S3 methods (PMCMRplus also exports pgrubbs
  // and qgrubbs, listed once)
  "adAllPairsTest", "adAllPairsTest.default", "adAllPairsTest.formula", "adKSampleTest", "adKSampleTest.default",
  "adKSampleTest.formula", "adManyOneTest", "adManyOneTest.default", "adManyOneTest.formula", "barPlot",
  "bwsAllPairsTest", "bwsAllPairsTest.default", "bwsAllPairsTest.formula", "bwsKSampleTest",
  "bwsKSampleTest.default", "bwsKSampleTest.formula", "bwsManyOneTest", "bwsManyOneTest.default",
  "bwsManyOneTest.formula", "bwsTrendTest", "bwsTrendTest.default", "bwsTrendTest.formula",
  "chaAllPairsNashimotoTest", "chaAllPairsNashimotoTest.default", "chaAllPairsNashimotoTest.formula", "chackoTest",
  "chackoTest.default", "chackoTest.formula", "chenJanTest", "chenJanTest.default", "chenTest", "chenTest.default",
  "chenTest.formula", "cochranTest", "cochranTest.default", "cochranTest.formula", "cuzickTest",
  "cuzickTest.default", "cuzickTest.formula", "doubleGrubbsTest", "dscfAllPairsTest", "dscfAllPairsTest.default",
  "dscfAllPairsTest.formula", "duncanTest", "duncanTest.aov", "duncanTest.default", "duncanTest.formula",
  "dunnettT3Test", "dunnettT3Test.aov", "dunnettT3Test.default", "dunnettT3Test.formula", "dunnettTest",
  "dunnettTest.aov", "dunnettTest.default", "dunnettTest.formula", "durbinAllPairsTest",
  "durbinAllPairsTest.default", "durbinTest", "durbinTest.default", "flignerWolfeTest", "flignerWolfeTest.default",
  "flignerWolfeTest.formula", "frdAllPairsConoverTest", "frdAllPairsConoverTest.default", "frdAllPairsExactTest",
  "frdAllPairsExactTest.default", "frdAllPairsMillerTest", "frdAllPairsMillerTest.default",
  "frdAllPairsNemenyiTest", "frdAllPairsNemenyiTest.default", "frdAllPairsNemenyiTest.formula",
  "frdAllPairsSiegelTest", "frdAllPairsSiegelTest.default", "frdHouseTest", "frdHouseTest.default",
  "frdManyOneDemsarTest", "frdManyOneDemsarTest.default", "frdManyOneExactTest", "frdManyOneExactTest.default",
  "frdManyOneNemenyiTest", "frdManyOneNemenyiTest.default", "friedmanTest", "friedmanTest.default",
  "gamesHowellTest", "gamesHowellTest.aov", "gamesHowellTest.default", "gamesHowellTest.formula", "gesdTest",
  "goreTest", "grubbsTest", "GSTTest", "GSTTest.default", "GSTTest.formula", "hartleyTest", "hartleyTest.default",
  "hartleyTest.formula", "hayterStoneTest", "hayterStoneTest.default", "hayterStoneTest.formula", "hsAllPairsTest",
  "hsAllPairsTest.default", "hsAllPairsTest.formula", "johnsonTest", "johnsonTest.default", "johnsonTest.formula",
  "jonckheereTest", "jonckheereTest.default", "jonckheereTest.formula", "kruskalTest", "kruskalTest.default",
  "kruskalTest.formula", "kwAllPairsConoverTest", "kwAllPairsConoverTest.default", "kwAllPairsConoverTest.formula",
  "kwAllPairsDunnTest", "kwAllPairsDunnTest.default", "kwAllPairsDunnTest.formula", "kwAllPairsNemenyiTest",
  "kwAllPairsNemenyiTest.default", "kwAllPairsNemenyiTest.formula", "kwManyOneConoverTest",
  "kwManyOneConoverTest.default", "kwManyOneConoverTest.formula", "kwManyOneDunnTest", "kwManyOneDunnTest.default",
  "kwManyOneDunnTest.formula", "kwManyOneNdwTest", "kwManyOneNdwTest.default", "kwManyOneNdwTest.formula", "leTest",
  "leTest.default", "leTest.formula", "lsdTest", "lsdTest.aov", "lsdTest.default", "lsdTest.formula",
  "mackWolfeTest", "mackWolfeTest.default", "mackWolfeTest.formula", "mandelhTest", "mandelhTest.default",
  "mandelhTest.formula", "mandelkTest", "mandelkTest.default", "mandelkTest.formula", "manyOneUTest",
  "manyOneUTest.default", "manyOneUTest.formula", "medianAllPairsTest", "medianAllPairsTest.default",
  "medianAllPairsTest.formula", "medianTest", "medianTest.default", "medianTest.formula", "mrrTest",
  "mrrTest.default", "mrrTest.formula", "MTest", "MTest.aov", "MTest.default", "MTest.formula",
  "normalScoresAllPairsTest", "normalScoresAllPairsTest.default", "normalScoresAllPairsTest.formula",
  "normalScoresManyOneTest", "normalScoresManyOneTest.default", "normalScoresManyOneTest.formula",
  "normalScoresTest", "normalScoresTest.default", "normalScoresTest.formula", "NPMTest", "NPMTest.default",
  "NPMTest.formula", "osrtTest", "osrtTest.aov", "osrtTest.default", "osrtTest.formula", "pageTest",
  "pageTest.default", "pcochran", "pdgrubbs", "pDunnett", "pgrubbs", "plot.mandel", "plot.PMCMR", "pmandelh",
  "pmandelk", "power.dunnett.test", "power.tukey.test", "power.williams.test", "powerMCTests", "powerOneWayTests",
  "print.gesdTest", "print.mandel", "print.osrt", "print.PMCMR", "print.powerOneWayPMCMR", "print.powerPMCMR",
  "print.trendPMCMR", "qcochran", "qDunnett", "qgrubbs", "qmandelh", "qmandelk", "quadeAllPairsTest",
  "quadeAllPairsTest.default", "scheffeTest", "scheffeTest.aov", "scheffeTest.default", "scheffeTest.formula",
  "shanTest", "shanTest.default", "shanTest.formula", "shirleyWilliamsTest", "shirleyWilliamsTest.default",
  "shirleyWilliamsTest.formula", "siegelTukeyTest", "siegelTukeyTest.default", "siegelTukeyTest.formula",
  "skillingsMackTest", "skillingsMackTest.default", "snkTest", "snkTest.aov", "snkTest.default", "snkTest.formula",
  "spearmanTest", "spearmanTest.default", "spearmanTest.formula", "steelsKSampleTest", "steelsKSampleTest.default",
  "steelsKSampleTest.formula", "steelTest", "steelTest.default", "steelTest.formula", "stepDownTrendTest",
  "stepDownTrendTest.default", "stepDownTrendTest.formula", "summary.gesdTest", "summary.mandel", "summary.osrt",
  "summary.PMCMR", "summary.trendPMCMR", "summaryGroup", "tamhaneDunnettTest", "tamhaneDunnettTest.aov",
  "tamhaneDunnettTest.default", "tamhaneDunnettTest.formula", "tamhaneT2Test", "tamhaneT2Test.aov",
  "tamhaneT2Test.default", "tamhaneT2Test.formula", "toTidy", "tukeyTest", "tukeyTest.aov", "tukeyTest.default",
  "tukeyTest.formula", "uryWigginsHochbergTest", "uryWigginsHochbergTest.aov", "uryWigginsHochbergTest.default",
  "uryWigginsHochbergTest.formula", "vanWaerdenAllPairsTest", "vanWaerdenAllPairsTest.default",
  "vanWaerdenAllPairsTest.formula", "vanWaerdenManyOneTest", "vanWaerdenManyOneTest.default",
  "vanWaerdenManyOneTest.formula", "vanWaerdenTest", "vanWaerdenTest.default", "vanWaerdenTest.formula",
  "welchManyOneTTest", "welchManyOneTTest.aov", "welchManyOneTTest.default", "welchManyOneTTest.formula",
  "williamsTest", "williamsTest.aov", "williamsTest.default", "williamsTest.formula",
  "chisq.out.test", "cochran.test", "dixon.test", "grubbs.test", "outlier", "pdixon", "qdixon", "qtable",
  "rm.outlier", "scores",
  // stats multivariate analysis (1.9.0): R's own code, GPL like the packages (lda is MASS's, above)
  "manova", "summary.manova", "cancor",
  // stats cluster analysis and classical scaling (1.10.0): R's own code, GPL like the packages (isoMDS, sammon and
  // Shepard are MASS's, above)
  "dist", "as.dist", "hclust", "as.hclust", "cutree", "cophenetic", "rect.hclust", "identify.hclust", "as.dendrogram",
  "order.dendrogram", "kmeans", "fitted.kmeans", "cmdscale",
  // ca (correspondence analysis, 1.11.0): its exported functions and S3 methods
  "ca", "caconv", "cacoord", "iterate.mjca", "mjca", "multilines", "pchlist", "plot.ca", "plot.mjca", "plot3d.ca",
  "print.ca", "print.mjca", "print.summary.ca", "print.summary.mjca", "summary.ca", "summary.mjca", "ca.matrix",
  "ca.data.frame", "ca.formula", "ca.table", "ca.xtabs", "ca.default", "mjca.table", "mjca.array", "mjca.data.frame",
  "mjca.default",
  // stats autocorrelation (time series, 1.11.0): R's own code, GPL like the packages
  "acf", "pacf", "pacf.default", "ccf", "print.acf", "plot.acf",
  // Propensity score matching (1.12.0): the exported functions and S3 methods of Matching, cobalt and tableone,
  // and survival's clogit
  "balanceUV", "GenMatch", "ks.boot", "Match", "MatchBalance", "Matchby", "print.summary.ks.boot",
  "print.summary.Match", "print.summary.Matchby", "qqstats", "summary.balanceUV", "summary.ks.boot", "summary.Match",
  "summary.Matchby",
  "as.data.frame.bal.tab", "autoplot.bal.tab", "available.stats", "bal.compute", "bal.compute.bal.init",
  "bal.compute.default", "bal.init", "bal.plot", "bal.tab", "bal.tab.CBMSM", "bal.tab.CBPS", "bal.tab.cem.match",
  "bal.tab.data.frame", "bal.tab.data.frame.list", "bal.tab.default", "bal.tab.designmatch", "bal.tab.ebalance",
  "bal.tab.formula", "bal.tab.formula.list", "bal.tab.iptw", "bal.tab.Match", "bal.tab.matchit", "bal.tab.matrix",
  "bal.tab.mimids", "bal.tab.mnps", "bal.tab.optmatch", "bal.tab.ps", "bal.tab.ps.cont", "bal.tab.sbwcau",
  "bal.tab.weightit", "bal.tab.wimids", "col_w_corr", "col_w_cov", "col_w_dcorr", "col_w_dcov", "col_w_ks",
  "col_w_mean", "col_w_ovl", "col_w_sd", "col_w_smd", "col_w_vr", "f.build", "format.bal.tab", "get.cobalt.options",
  "get.w", "get.w.CBMSM", "get.w.CBPS", "get.w.cem.match", "get.w.designmatch", "get.w.ebalance", "get.w.iptw",
  "get.w.Match", "get.w.matchit", "get.w.mimids", "get.w.mnps", "get.w.optmatch", "get.w.ps", "get.w.ps.cont",
  "get.w.sbwcau", "get.w.weightit", "get.w.wimids", "love.plot", "plot.bal.tab", "print.bal.init", "print.bal.tab",
  "print.love.plot", "set.cobalt.options", "splitfactor", "unsplitfactor", "var.names",
  "CreateCatTable", "CreateContTable", "CreateTableOne", "ExtractSmd", "kableone", "print.CatTable",
  "print.ContTable", "print.svyCatTable", "print.svyContTable", "print.TableOne", "ShowRegTable", "summary.CatTable",
  "summary.ContTable", "summary.svyCatTable", "summary.svyContTable", "summary.TableOne", "svyCreateCatTable",
  "svyCreateContTable", "svyCreateTableOne",
  "clogit",
  // Inverse probability of treatment weighting (1.13.0): the exported functions and S3 methods of WeightIt, CBPS,
  // survey and sandwich whose names are not also base R's, and survival's coxph and survfit.
  // survey's cv and SE are left out: earlier experiments use them as variable names and strings
  ".cens", "anova.coxph_weightit", "anova.glm_weightit", "anova.multinom_weightit", "anova.ordinal_weightit",
  "as.weightit", "as.weightit.default", "as.weightit.weightit.fit", "as.weightitMSM", "as.weightitMSM.default",
  "bread.coxph_weightit", "bread.glm_weightit", "bread.multinom_weightit", "bread.ordinal_weightit", "calibrate",
  "calibrate.default", "calibrate.weightit", "confint.coxph_weightit", "confint.glm_weightit",
  "confint.multinom_weightit", "confint.ordinal_weightit", "coxph_weightit", "ESS", "estfun.coxph_weightit",
  "estfun.glm_weightit", "estfun.multinom_weightit", "estfun.ordinal_weightit", "get_w_from_ps",
  "glance.coxph_weightit", "glance.glm_weightit", "glance.multinom_weightit", "glance.ordinal_weightit", "glm_weightit",
  "lm_weightit", "make_full_rank", "model.matrix.multinom_weightit", "model.matrix.ordinal_weightit",
  "multinom_weightit", "nobs.coxph_weightit", "nobs.multinom_weightit", "nobs.ordinal_weightit", "nobs.weightit",
  "ordinal_weightit", "plot.summary.weightit", "plot.summary.weightitMSM", "plot.weightit", "predict.glm_weightit",
  "predict.multinom_weightit", "predict.ordinal_weightit", "print.coxph_weightit", "print.glm_weightit",
  "print.multinom_weightit", "print.ordinal_weightit", "print.summary.glm_weightit", "print.summary.weightit",
  "print.summary.weightit.sbps", "print.summary.weightitMSM", "print.weightit", "print.weightitMSM", "sbps",
  "summary.coxph_weightit", "summary.glm_weightit", "summary.multinom_weightit", "summary.ordinal_weightit",
  "summary.weightit", "summary.weightit.sbps", "summary.weightitMSM", "tidy.coxph_weightit", "tidy.glm_weightit",
  "tidy.multinom_weightit", "tidy.ordinal_weightit", "trim", "trim.default", "trim.weightit", "update.coxph_weightit",
  "update.glm_weightit", "update.multinom_weightit", "update.ordinal_weightit", "vcov.coxph_weightit",
  "vcov.glm_weightit", "vcov.multinom_weightit", "vcov.ordinal_weightit", "weightit", "weightit.fit", "weightitMSM",
  "AsyVar", "balance", "balance.CBMSM", "balance.CBPS", "balance.CBPSContinuous", "balance.npCBPS", "CBIV", "CBMSM",
  "CBPS", "CBPS.fit", "hdCBPS", "npCBPS", "plot.CBMSM", "plot.CBPS", "plot.CBPSContinuous", "plot.npCBPS", "print.CBPS",
  "summary.CBPS", "vcov_outcome", "vcov_outcome.CBPSContinuous", "vcov.CBPS",
  "AIC.svycoxph", "AIC.svyglm", "anova.svycoxph", "anova.svyglm", "anova.svyloglin", "as.data.frame.svrepstat",
  "as.data.frame.svystat", "as.matrix.repweights", "as.matrix.repweights_compressed", "as.matrix.svrepvar",
  "as.matrix.svyvar", "as.svrepdesign", "as.svrepdesign.default", "as.svrepdesign.svyimputationList", "as.svydesign2",
  "as.vector.repweights_compressed", "barplot.svrepstat", "barplot.svyby", "barplot.svystat", "BIC.svyglm",
  "biplot.svyprcomp", "bootweights", "brrweights", "cal_names", "cal_names.DBIsvydesign", "cal_names.survey.design",
  "calibrate.DBIsvydesign", "calibrate.multiphase", "calibrate.pps", "calibrate.survey.design2",
  "calibrate.svyrep.design", "calibrate.twophase", "calibrate.twophase2", "close.DBIsvydesign",
  "close.svyDBimputationList", "coef.dualframe_with_rewt", "coef.newsvyquantile", "coef.oldsvyquantile",
  "coef.svrepstat", "coef.svyby", "coef.svyciprop", "coef.svyglm", "coef.svyloglin", "coef.svymle", "coef.svynls",
  "coef.svyolr", "coef.svyratio", "coef.svystat", "compressWeights", "compressWeights.default",
  "compressWeights.repweights_compressed", "compressWeights.svyrep.design", "confint.newsvyquantile",
  "confint.oldsvyquantile", "confint.svrepstat", "confint.svyby", "confint.svyciprop", "confint.svyglm",
  "confint.svykm", "confint.svyratio", "confint.svystat", "confint.svyttest", "cv.default", "cv.svyratio", "deff",
  "deff.default", "deff.svyby", "degf", "degf.multiframe", "degf.multiphase", "degf.pps", "degf.survey.design2",
  "degf.svrepstat", "degf.svyloglin", "degf.svyrep.design", "degf.svystat", "degf.twophase", "degf.twophase2",
  "degf.xdesign", "deviance.coxph", "deviance.svycoxph", "deviance.svyloglin", "dim.DBIrepdesign", "dim.DBIsvydesign",
  "dim.multiphase", "dim.repweights_compressed", "dim.survey.design", "dim.svyimputationList", "dim.svyrep.design",
  "dim.twophase", "dim.twophase2", "dim.xdesign", "dimnames.DBIrepdesign", "dimnames.DBIsvydesign",
  "dimnames.multiframe", "dimnames.multiphase", "dimnames.repweights_compressed", "dimnames.survey.design",
  "dimnames.svyimputationList", "dimnames.svyrep.design", "dimnames.twophase", "dimnames.twophase2", "dimnames.xdesign",
  "dotchart.default", "dotchart.svrepstat", "dotchart.svyby", "dotchart.svystat", "estfuns.coxph", "estfuns.glm",
  "estfuns.lm", "estWeights", "estWeights.data.frame", "estWeights.twophase", "estWeights.twophase2",
  "extractAIC.svrepcoxph", "extractAIC.svrepglm", "extractAIC.svycoxph", "extractAIC.svyglm", "ftable.svrepstat",
  "ftable.svyby", "ftable.svystat", "grake", "hadamard", "HR", "image.pps", "image.svyrep.design", "influence.svystat",
  "is.hadamard", "jk1weights", "jknweights", "joinCells", "lines.svykm", "lines.svysmooth", "logLik.svrepglm",
  "logLik.svyglm", "make.calfun", "make.formula", "make.panel.svysmooth", "marginpred", "marginpred.svycoxph",
  "marginpred.svyglm", "marginpred.svykmlist", "Math.svystat", "model.frame.multiframe", "model.frame.survey.design",
  "model.frame.svycoxph", "model.frame.svyolr", "model.frame.svyrep.design", "model.frame.twophase",
  "model.frame.twophase2", "model.matrix.svyloglin", "mrbweights", "multiframe", "multiphase",
  "na.exclude.survey.design", "na.exclude.twophase", "na.fail.survey.design", "na.fail.twophase",
  "na.omit.survey.design", "na.omit.twophase", "neighbours", "nonresponse", "oldsvyquantile",
  "oldsvyquantile.DBIsvydesign", "oldsvyquantile.survey.design", "oldsvyquantile.svyrep.design", "open.DBIsvydesign",
  "open.svyDBimputationList", "Ops.svystat", "paley", "pchisqsum", "pFsum", "plot.dualframe_with_rewt",
  "plot.svrepstat", "plot.svyby", "plot.svycdf", "plot.svykm", "plot.svykmlist", "plot.svysmooth", "plot.svystat",
  "poisson_sampling", "postStratify", "postStratify.DBIsvydesign", "postStratify.pps", "postStratify.survey.design",
  "postStratify.svyrep.design", "postStratify.twophase", "postStratify.twophase2", "pps_design.character",
  "pps_design.HR", "pps_design.ppsdcheck", "pps_design.ppsdelta", "pps_design.ppsmat", "ppscov", "ppsmat",
  "predict.svrepglm", "predict.svycoxph", "predict.svyglm", "predict.svyolr", "predict.svyratio",
  "predict.svyratio_separate", "print.anova.svyloglin", "print.calfun", "print.DBIrepdesign", "print.DBIsvydesign",
  "print.dualframe", "print.multiframe", "print.multiphase", "print.nonresponse", "print.nonresponseSubset",
  "print.oldsvyquantile", "print.pps", "print.ppsdcheck", "print.ppsdelta", "print.ppsmat", "print.regTermTest",
  "print.regTermTestLRT", "print.regTermTestWW", "print.seqanova.svycoxph", "print.seqanova.svyglm",
  "print.summary.DBIsvydesign", "print.summary.multiframe", "print.summary.pps", "print.summary.survey.design",
  "print.summary.survey.design2", "print.summary.svyglm", "print.summary.svyloglin", "print.summary.svyolr",
  "print.summary.svyrep.design", "print.summary.svytable", "print.summary.twophase", "print.summary.twophase2",
  "print.survey.design", "print.survey.design2", "print.svrepstat", "print.svrepvar", "print.svycdf", "print.svyciprop",
  "print.svyDBimputationList", "print.svyglm", "print.svyimputationList", "print.svykm", "print.svykmlist",
  "print.svyloglin", "print.svymle", "print.svynls", "print.svyolr", "print.svyratio", "print.svyratio_separate",
  "print.svyrep.design", "print.svysmooth", "print.svystat", "print.svyvar", "print.twophase", "print.twophase2",
  "print.xdesign", "psrsq", "psrsq.glm", "psrsq.svyglm", "quantile.svykm", "rake", "regcalibrate.survey.design2",
  "regcalibrate.svyrep.design", "regTermTest", "residuals.svrepglm", "residuals.svyglm", "residuals.svysurvreg",
  "reweight", "reweight.dualframe", "reweight.multiframe", "SE.default", "SE.newsvyquantile", "SE.oldsvyquantile",
  "SE.svrepstat", "SE.svyby", "SE.svyratio", "SE.svystat", "sigma.svrepglm", "sigma.svyglm", "sparseCells",
  "stratsample", "subbootweights", "subset.DBIsvydesign", "subset.multiframe", "subset.multiphase",
  "subset.survey.design", "subset.svyDBimputationList", "subset.svyimputationList", "subset.svyrep.design",
  "subset.twophase", "subset.twophase2", "subset.xdesign", "summary.DBIrepdesign", "summary.DBIsvydesign",
  "summary.multiframe", "summary.pps", "summary.survey.design", "summary.survey.design2", "summary.svrepglm",
  "summary.svreptable", "summary.svycoxph", "summary.svyglm", "summary.svyivreg", "summary.svyloglin", "summary.svymle",
  "summary.svynls", "summary.svyolr", "summary.svyrep.design", "summary.svysae", "summary.svytable", "summary.twophase",
  "summary.twophase2", "survfit.svycoxph", "svrepdesign", "svrepdesign.character", "svrepdesign.default",
  "svrepdesign.imputationList", "svrVar", "svyboxplot", "svyboxplot.DBIsvydesign", "svyboxplot.default", "svyby",
  "svyby.DBIsvydesign", "svyby.default", "svyby.survey.design2", "svyby.xdesign", "svybys", "svycdf",
  "svycdf.DBIsvydesign", "svycdf.default", "svychisq", "svychisq.DBIsvydesign", "svychisq.multiframe",
  "svychisq.survey.design", "svychisq.svyrep.design", "svychisq.twophase", "svychisq.twophase2", "svyciprop",
  "svycontrast", "svycontrast.default", "svycontrast.svrepcoxph", "svycontrast.svrepglm", "svycontrast.svrepstat",
  "svycontrast.svyby", "svycontrast.svycoxph", "svycontrast.svyglm", "svycontrast.svyolr", "svycontrast.svystat",
  "svycontrast.svyvar", "svycoplot", "svycoplot.DBIsvydesign", "svycoplot.default", "svycoxph", "svycoxph.DBIsvydesign",
  "svycoxph.survey.design", "svycoxph.svyrep.design", "svyCprod", "svycralpha", "svydesign", "svydesign.character",
  "svydesign.DBimputationList", "svydesign.default", "svydesign.imputationList", "svyfactanal", "svyglm",
  "svyglm.DBIsvydesign", "svyglm.multiframe", "svyglm.multiphase", "svyglm.survey.design", "svyglm.svyrep.design",
  "svyglm.xdesign", "svygofchisq", "svyhist", "svyivreg", "svyivreg.survey.design", "svyivreg.svyrep.design",
  "svykappa", "svykappa.DBIsvydesign", "svykappa.default", "svykm", "svykm.DBIsvydesign", "svykm.survey.design",
  "svykm.svyrep.design", "svyloglin", "svyloglin.DBIsvydesign", "svyloglin.survey.design", "svyloglin.svyrep.design",
  "svylogrank", "svylogrank.DBIsvydesign", "svylogrank.survey.design2", "svylogrank.svyrep.design",
  "svylogrank.twophase", "svylogrank.twophase2", "svymean", "svymean.DBIsvydesign", "svymean.multiframe",
  "svymean.multiphase", "svymean.pps", "svymean.survey.design", "svymean.survey.design2", "svymean.svyrep.design",
  "svymean.twophase", "svymean.twophase2", "svymean.xdesign", "svymle", "svynls", "svynls.DBIsvydesign",
  "svynls.survey.design2", "svynls.svyrep.design", "svyolr", "svyolr.DBIsvydesign", "svyolr.survey.design2",
  "svyolr.svyrep.design", "svyplot", "svyplot.DBIsvydesign", "svyplot.default", "svyprcomp", "svypredmeans",
  "svyqqmath", "svyqqplot", "svyquantile", "svyquantile.DBIsvydesign", "svyquantile.survey.design",
  "svyquantile.svyrep.design", "svyranktest", "svyranktest.DBIsvydesign", "svyranktest.survey.design",
  "svyranktest.svyrep.design", "svyratio", "svyratio.DBIsvydesign", "svyratio.pps", "svyratio.survey.design",
  "svyratio.survey.design2", "svyratio.svyrep.design", "svyratio.twophase", "svyratio.twophase2", "svyrecvar",
  "svyscoretest", "svyscoretest.svyglm", "svysmooth", "svysmooth.DBIsvydesign", "svysmooth.default", "svysmoothArea",
  "svysmoothArea.default", "svysmoothArea.survey.design", "svysmoothUnit", "svysmoothUnit.default",
  "svysmoothUnit.survey.design", "svystandardize", "svysurvreg", "svysurvreg.survey.design", "svytable",
  "svytable.DBIsvydesign", "svytable.multiframe", "svytable.survey.design", "svytable.svyrep.design", "svytotal",
  "svytotal.DBIsvydesign", "svytotal.multiframe", "svytotal.multiphase", "svytotal.pps", "svytotal.survey.design",
  "svytotal.survey.design2", "svytotal.svyrep.design", "svytotal.twophase", "svytotal.twophase2", "svytotal.xdesign",
  "svyttest", "svyttest.default", "svyvar", "svyvar.DBIsvydesign", "svyvar.multiframe", "svyvar.multiphase",
  "svyvar.survey.design", "svyvar.svyrep.design", "svyxvar.xdesign", "terms.svyloglin", "transform.DBIsvydesign",
  "transform.survey.design", "transform.svyimputationList", "transform.svyrep.design", "transform.twophase",
  "transform.twophase2", "transform.xdesign", "trimWeights", "trimWeights.survey.design2", "trimWeights.svyrep.design",
  "twophase", "twophase2var", "twophasevar", "unwrap.default", "unwrap2.default", "unwrap2.newsvyquantile",
  "unwtd.count", "update.DBIsvydesign", "update.multiframe", "update.multiphase", "update.survey.design",
  "update.svyDBimputationList", "update.svyimputationList", "update.svyloglin", "update.svyrep.design",
  "update.twophase", "update.twophase2", "update.xdesign", "vcov.newsvyquantile", "vcov.oldsvyquantile",
  "vcov.svrepstat", "vcov.svyby", "vcov.svyciprop", "vcov.svyglm", "vcov.svyivreg", "vcov.svyloglin", "vcov.svymle",
  "vcov.svynls", "vcov.svyolr", "vcov.svyratio", "vcov.svyrep.design", "vcov.svystat", "weights.multiframe",
  "weights.multiphase", "weights.nonresponse", "weights.survey_fpc", "weights.survey.design", "weights.svyrep.design",
  "with.svyDBimputationList", "with.svyimputationList", "withCrossval", "withCrossval.svyrep.design",
  "withPV.survey.design", "withPV.svyrep.design", "withReplicates", "withReplicates.svrepstat",
  "withReplicates.svrepvar", "withReplicates.svyimputationList", "withReplicates.svyrep.design", "xdesign",
  "bread", "bread.clm", "bread.coxph", "bread.default", "bread.gam", "bread.glm", "bread.hurdle", "bread.lm",
  "bread.mlm", "bread.mlogit", "bread.nls", "bread.polr", "bread.rlm", "bread.survreg", "bread.zeroinfl", "bwAndrews",
  "bwNeweyWest", "estfun", "estfun.clm", "estfun.coxph", "estfun.glm", "estfun.hurdle", "estfun.lm", "estfun.mlm",
  "estfun.mlogit", "estfun.multinom", "estfun.nls", "estfun.polr", "estfun.rlm", "estfun.survreg", "estfun.zeroinfl",
  "isoacf", "kernHAC", "kweights", "lrvar", "meat", "meatCL", "meatHAC", "meatHC", "meatPC", "meatPL", "NeweyWest",
  "pava.blocks", "sandwich", "vcovBS", "vcovBS.default", "vcovBS.glm", "vcovBS.lm", "vcovCL", "vcovHAC",
  "vcovHAC.default", "vcovHC", "vcovHC.default", "vcovHC.mlm", "vcovJK", "vcovJK.default", "vcovOPG", "vcovPC",
  "vcovPL", "weave", "weightsAndrews", "weightsLumley",
  "coxph", "survfit", "survfit.coxph",
  // Multinomial logistic regression (1.14.0): nnet's exported functions and S3 methods
  "add1.multinom", "anova.multinom", "class.ind", "coef.multinom", "coef.nnet", "confint.multinom", "drop1.multinom",
  "extractAIC.multinom", "logLik.multinom", "model.frame.multinom", "multinom", "nnet", "nnet.default", "nnet.formula",
  "nnetHess", "predict.multinom", "predict.nnet", "print.multinom", "print.nnet", "print.summary.multinom",
  "print.summary.nnet", "summary.multinom", "summary.nnet", "vcov.multinom", "which.is.max",
];

/** Names that reach code, namespaces, compiled routines, other programs or files: not allowed at all. */
const FORBIDDEN_NAMES = [
  "deparse", "deparse1", "body", "formals", "args", "getAnywhere", "getS3method", "getFromNamespace",
  "asNamespace", "getNamespace", "loadNamespace", "requireNamespace", "attachNamespace", "getNamespaceExports",
  "getNamespaceInfo", "environment", "sys.function", "sys.call", "match.fun", "get", "get0", "mget", "exists",
  "ls", "objects", "apropos", "methods", "getMethod", "selectMethod", "showMethods", "eval", "evalq", "parse",
  "str2lang", "str2expression", "as.name", "as.symbol", "as.call", "substitute", "quote", "bquote", "trace",
  "untrace", "debug", "debugonce", "browser", "edit", "fix", "page", "View", "dump", "dput", "sink", "source",
  "sys.source", "system", "system2", "shell", "pipe", "file", "url", "gzcon", "readLines", "readRDS", "load",
  "scan", "download.file", "list.files", "file.show", "Sys.setenv", "setwd", "assignInNamespace",
  "fixInNamespace", "attach", "eapply", "as.list.environment", "lsf.str", "ls.str", "install.packages",
  "update.packages",
  // lme4: the deviance functions it builds are closures whose bodies print, and the reference-class objects in a
  // fit's resp and pp slots print their methods' code
  "devFunOnly", "mkLmerDevfun", "mkGlmerDevfun", "devfun2", "updateGlmerDevfun", "glmerLaplaceHandle",
  // printing a fit without its class prints the functions inside it (rlm's psi, nls's m)
  "unclass",
];

/** rlm's argument `psi = psi.huber` passes the function without calling it, which is how rlm is used */
const PSI_ARGUMENT = /\bpsi\s*=\s*(?:MASS::)?psi\.(huber|hampel|bisquare)(?![A-Za-z0-9._])/g;

const COMPILED = /\.(Fortran|C|Call|External|External2|Internal|Primitive)\b/;

/** Splits a line into code (string contents blanked) and its string literals; drops the comment. */
function scan(line) {
  let code = "", quote = null, current = "";
  const strings = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === "\\") { current += line.slice(i, i + 2); i++; code += "  "; continue; }
      if (c === quote) { strings.push(current); current = ""; quote = null; code += c; continue; }
      current += c; code += " ";
      continue;
    }
    if (c === "#") break;
    if (c === '"' || c === "'" || c === "`") { quote = c; code += c; continue; }
    code += c;
  }
  if (quote) strings.push(current); // an unterminated string: R would refuse the script anyway
  return { code, strings };
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (name) => new RegExp(`(?<![A-Za-z0-9._$@])${escape(name)}(?![A-Za-z0-9._])`);

function check(file) {
  const problems = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const at = `${file}:${index + 1}`;
    const { code, strings } = scan(line);
    if (code.includes(":::")) problems.push(`${at}: ':::' reaches unexported objects`);
    for (const m of code.matchAll(/([A-Za-z][A-Za-z0-9.]*)\s*::(?!:)/g)) {
      if (!ALLOWED_PACKAGES.has(m[1])) problems.push(`${at}: package '${m[1]}' is not allowed`);
    }
    for (const m of line.matchAll(/\b(library|require)\s*\(\s*([^),\s]*)/g)) {
      const pkg = m[2].replace(/^["'`]|["'`]$/g, "");
      if (!ALLOWED_PACKAGES.has(pkg)) problems.push(`${at}: ${m[1]}(${m[2]}) is not allowed`);
    }
    // A package named like one of its functions (exact2x2): its name in library(), require() and pkg:: is not a
    // reference to the function
    const refCode = code
      .replace(/\b(library|require)\s*\(\s*[A-Za-z][A-Za-z0-9.]*\s*\)/g, (m) => m.replace(/\(.*\)/, "()"))
      .replace(/([A-Za-z][A-Za-z0-9.]*)\s*::(?!:)/g, (m, pkg) => (ALLOWED_PACKAGES.has(pkg) ? "" : m));
    if (/@\s*(resp|pp)\b/.test(code)) {
      problems.push(`${at}: a fit's resp and pp slots print their methods' code; use getME`);
    }
    // rlm keeps its psi function in the fit and nls its model's closures (the m element)
    if (/\$\s*`?(psi|m)\b`?(?![A-Za-z0-9._])/.test(code) || /\[\[\s*["'](psi|m)["']\s*\]\]/.test(line) ||
        /\$\s*`(psi|m)`/.test(line)) {
      problems.push(`${at}: rlm's psi and nls's m elements are functions whose code prints; use coef, summary, predict`);
    }
    if (COMPILED.test(code)) problems.push(`${at}: calling compiled code directly is not allowed`);
    for (const name of FORBIDDEN_NAMES) {
      if (word(name).test(code)) problems.push(`${at}: '${name}' is not allowed`);
    }
    const callCode = refCode.replace(PSI_ARGUMENT, "psi = ");
    for (const name of REFERENCE_FUNCTIONS) {
      // fit$cuminc-style element names and argument names (summary(fit, se = "nid")) are fine; a reference
      // package's function that is not called is not
      const re = new RegExp(
        `(?<![A-Za-z0-9._$@])(?:[A-Za-z][A-Za-z0-9.]*::)?${escape(name)}(?![A-Za-z0-9._])(?!\\s*\\()(?!\\s*=(?!=))`);
      if (re.test(callCode)) problems.push(`${at}: '${name}' must be called, not referred to (that would print its source)`);
    }
    for (const s of strings) {
      const t = s.trim();
      // An allowed package's name (library("epiR"), packageVersion("exact2x2")): reaching a function from a string
      // needs get, match.fun or eval, which are not allowed
      if (ALLOWED_PACKAGES.has(t)) continue;
      if (REFERENCE_FUNCTIONS.includes(t) || FORBIDDEN_NAMES.includes(t) || t.includes("::")) {
        problems.push(`${at}: the string "${t}" names a function; call functions directly`);
      }
    }
  });
  return problems;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/r-experiment-check.mjs <file.R> ...");
  process.exit(2);
}
const problems = files.flatMap(check);
for (const p of problems) console.log(p);
process.exit(problems.length === 0 ? 0 : 1);
