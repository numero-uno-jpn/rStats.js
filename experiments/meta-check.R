# issue: 529
# Combined public-API probes for the meta-analysis specification; no source inspection.
suppressPackageStartupMessages(library(metafor))
suppressPackageStartupMessages(library(metadat))

dat <- dat.colditz1994
es <- escalc(measure="RR", ai=tpos, bi=tneg, ci=cpos, di=cneg, data=dat)
cat("PACKAGE VERSIONS\n")
cat("metafor", as.character(packageVersion("metafor")), "\n")
cat("metadat", as.character(packageVersion("metadat")), "\n")
cat("BCG RR yi/vi\n")
print(es[, c("yi","vi")], digits=17)

for (mth in c("EE","FE","DL","REML")) {
  cat("\nMODEL", mth, "\n")
  fit <- rma(yi, vi, data=es, method=mth)
  print(fit, digits=17)
  print(list(beta=fit$beta, stdError=fit$se, zval=fit$zval, pval=fit$pval,
             ci.lb=fit$ci.lb, ci.ub=fit$ci.ub, tau2=fit$tau2,
             se.tau2=fit$se.tau2, QE=fit$QE, QEp=fit$QEp,
             I2=fit$I2, H2=fit$H2, k=fit$k), digits=17)
}

fit <- rma(yi, vi, data=es, method="REML")
cat("\nCONFINT Q PROFILE\n")
print(confint(fit), digits=17)
cat("\nCONFINT PROFILE LIKELIHOOD\n")
print(confint(fit, type="PL"), digits=17)
cat("\nPREDICTION DEFAULT\n")
print(predict(fit), digits=17)
cat("\nPREDICTION RILEY\n")
print(predict(fit, predtype="riley"), digits=17)
cat("\nEGGER CLASSICAL LM\n")
print(regtest(es$yi, vi=es$vi, model="lm", predictor="sei"), digits=17)
cat("\nZERO-CELL RR\n")
print(escalc(measure="RR", ai=c(0,5), bi=c(20,15), ci=c(2,4), di=c(18,16)), digits=17)

probe <- function(label, value) {
  cat("\nCASE", label, "\n")
  withCallingHandlers(
    tryCatch(print(value, digits=17), error=function(e) cat("ERROR:", conditionMessage(e), "\n")),
    warning=function(w) {
      cat("WARNING:", conditionMessage(w), "\n")
      invokeRestart("muffleWarning")
    }
  )
}

probe("one study REML", rma(c(0.1), c(0.04), method="REML"))
probe("two studies REML", rma(c(0.1,0.2), c(0.04,0.05), method="REML"))
probe("identical effects DL", rma(rep(0.1,4), c(0.04,0.05,0.03,0.06), method="DL"))
probe("Q below df DL", rma(c(0.1,0.11,0.09,0.1), c(0.04,0.05,0.03,0.06), method="DL"))
probe("zero sampling variance", rma(c(0.1,0.2,0.3), c(0,-0.1,0.2), method="DL"))
probe("tiny sampling variances REML", rma(c(0.1,0.2,0.3), c(1e-300,1e-300,1e-300), method="REML"))
probe("huge sampling variances REML", rma(c(0.1,0.2,0.3), c(1e300,1e300,1e300), method="REML"))
probe("extreme effects DL", rma(c(1e150,-1e150,1e150), c(1e-300,1e-300,1e-300), method="DL"))
probe("REML one iteration", rma(c(0.1,0.2,0.3), c(0.04,0.05,0.06), method="REML", control=list(maxiter=1, threshold=1e-15)))
probe("Egger two studies", regtest(c(0.1,0.2), vi=c(0.04,0.05), model="lm", predictor="sei"))
probe("Egger constant SE", regtest(c(0.1,0.2,0.3,0.4), vi=rep(0.04,4), model="lm", predictor="sei"))
