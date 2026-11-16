# issue: 529
# Public-API experiments only: no package or R source inspection.
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
  cat("FIELDS\n")
  print(list(beta=fit$beta, se=fit$se, zval=fit$zval, pval=fit$pval,
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
cat("\nEGGER RANDOM META-REGRESSION\n")
print(regtest(fit, model="rma", predictor="sei"), digits=17)

cat("\nZERO-CELL RR\n")
print(escalc(measure="RR", ai=c(0,5), bi=c(20,15), ci=c(2,4), di=c(18,16)), digits=17)
