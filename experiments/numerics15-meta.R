# issue: 531
# Public metafor calls only; no metafor/metadat or R implementation source is inspected.
suppressPackageStartupMessages(library(metafor))
suppressPackageStartupMessages(library(metadat))

emit <- function(label, value) {
  cat(label, ": ")
  if (is.numeric(value)) cat(paste(sprintf("%.17g", as.numeric(value)), collapse=","))
  else if (is.list(value)) cat(paste(capture.output(str(value, max.level=2)), collapse=" "))
  else cat(paste(capture.output(print(value)), collapse=" "))
  cat("\n")
}
probe <- function(label, call) {
  ans <- tryCatch(call(), error=function(e) structure(list(message=conditionMessage(e)), class="probe_error"))
  if (inherits(ans, "probe_error")) emit(paste0(label, " ERROR"), ans$message) else emit(label, ans)
}
fields <- function(x) c(x$yi, x$vi)

# escalc: ratios near zero/one, Hedges correction at large n, and correlations near +/-1.
probe("escalc_RR_near_one", function() fields(escalc(measure="RR",
  ai=c(1e12,1e12), bi=c(1,1), ci=c(1e12+1,1e12-1), di=c(1,1))))
probe("escalc_OR_near_one", function() fields(escalc(measure="OR",
  ai=c(1e12,1e12), bi=c(1,1), ci=c(1e12+1,1e12-1), di=c(1,1))))
probe("escalc_RD_near_zero", function() fields(escalc(measure="RD",
  ai=c(1,1), bi=c(1e16,1e16), ci=c(2,1), di=c(1e16,1e16))))
probe("escalc_RR_rare", function() fields(escalc(measure="RR",
  ai=c(1,2), bi=c(1e16,1e16), ci=c(2,1), di=c(1e16,1e16))))
probe("escalc_SMD_n_1e6", function() fields(escalc(measure="SMD",
  m1i=1, sd1i=1, n1i=1e6, m2i=0, sd2i=1, n2i=1e6)))
probe("escalc_SMD_n_1e9", function() fields(escalc(measure="SMD",
  m1i=1, sd1i=1, n1i=1e9, m2i=0, sd2i=1, n2i=1e9)))
probe("escalc_ZCOR_extreme", function() fields(escalc(measure="ZCOR",
  ri=c(1-1e-12,-1+1e-12), ni=c(30,30))))

# Fixed/random-effects fits at extreme effect/variance scales and subnormal variances.
probe("rma_REML_vi_1e-300", function() {
  x <- rma(c(-1e150,0,1e150), c(1e-300,1e-300,1e-300), method="REML")
  c(x$beta, x$se, x$zval, x$pval, x$tau2, x$QE, x$I2, x$H2)
})
probe("rma_REML_vi_1e-308", function() {
  x <- rma(c(-1e150,0,1e150), c(1e-308,1e-308,1e-308), method="REML")
  c(x$beta, x$se, x$zval, x$pval, x$tau2, x$QE, x$I2, x$H2)
})
probe("rma_REML_vi_subnormal", function() {
  x <- rma(c(-1e150,0,1e150), c(5e-324,5e-324,5e-324), method="REML")
  c(x$beta, x$se, x$zval, x$pval, x$tau2, x$QE, x$I2, x$H2)
})
probe("rma_REML_effect_1e300", function() {
  x <- rma(c(-1e300,0,1e300), c(1,1,1), method="REML")
  c(x$beta, x$se, x$zval, x$pval, x$tau2, x$QE, x$I2, x$H2)
})
probe("rma_REML_effect_1e150_vi_1e-300", function() {
  x <- rma(c(-1e150,0,1e150), c(1e-300,1e-300,1e-300), method="REML")
  c(x$beta, x$se, x$zval, x$pval, x$tau2, x$QE, x$I2, x$H2)
})

# Number of studies, identical effects/variances, and heterogeneity on the zero boundary.
probe("rma_one_study", function() {
  x <- rma(0.1, 0.04, method="REML")
  c(x$beta, x$se, x$tau2, x$QE, x$QEp, x$I2, x$H2)
})
probe("rma_two_studies", function() {
  x <- rma(c(0.1,0.2), c(0.04,0.04), method="REML")
  c(x$beta, x$se, x$tau2, x$QE, x$QEp, x$I2, x$H2)
})
probe("rma_3000_identical", function() {
  x <- rma(rep(0.1,3000), rep(0.04,3000), method="REML")
  c(x$beta, x$se, x$tau2, x$QE, x$QEp, x$I2, x$H2)
})
probe("rma_3000_equal_variance", function() {
  y <- rep(c(0.1,0.2,0.3),1000)
  x <- rma(y, rep(0.04,3000), method="DL")
  c(x$beta, x$se, x$tau2, x$QE, x$QEp, x$I2, x$H2)
})

# Scale invariance: effects and SDs scale by 2^k; variances and tau^2 scale by 2^(2k).
base_y <- c(-0.2,0.1,0.4,0.25)
base_v <- c(0.04,0.05,0.03,0.06)
probe("rma_scale_base", function() {
  x <- rma(base_y,base_v,method="REML")
  c(x$beta,x$se,x$tau2,x$zval,x$pval,x$I2,x$H2)
})
probe("rma_scale_plus500", function() {
  s <- 2^500
  x <- rma(base_y*s,base_v*s*s,method="REML")
  c(x$beta/s,x$se/s,x$tau2/(s*s),x$zval,x$pval,x$I2,x$H2)
})
probe("rma_scale_minus500", function() {
  s <- 2^-500
  x <- rma(base_y*s,base_v*s*s,method="REML")
  c(x$beta/s,x$se/s,x$tau2/(s*s),x$zval,x$pval,x$I2,x$H2)
})

# Public analysis methods on an ordinary model, including profile intervals, prediction and Egger regression.
probe("rma_confint_predict_regtest", function() {
  x <- rma(c(-0.2,0.1,0.4,0.25,0.3),c(0.04,0.05,0.03,0.06,0.04),method="REML")
  ci <- confint(x,type="PL")
  pr <- predict(x)
  eg <- regtest(x)
  c(x$tau2,ci$random[,"ci.lb"],ci$random[,"ci.ub"],pr$pred,pr$pi.lb,pr$pi.ub,eg$zval,eg$pval)
})

# Near-collinear moderators and a forced one-step fit expose rank and convergence boundaries.
probe("rma_near_collinear_mods", function() {
  x <- rma(c(0.1,0.2,0.3,0.4,0.5),rep(0.04,5),
    mods=cbind(c(1,2,3,4,5),c(1,2,3,4,5)+c(0,1e-14,0,-1e-14,0)),
    method="REML")
  c(x$beta,x$tau2,x$QE,x$QM,x$QMp)
})
probe("rma_forced_one_iteration", function() {
  x <- rma(c(0.1,0.2,0.3,0.4),c(0.04,0.05,0.03,0.06),method="REML",
    control=list(maxiter=1,threshold=1e-15))
  c(x$beta,x$tau2,x$QE,x$I2,x$H2)
})
