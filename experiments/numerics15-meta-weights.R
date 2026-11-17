# issue: 531
# Public metafor calls only; no package or R implementation source is inspected.
suppressPackageStartupMessages(library(metafor))
emit <- function(label, x) cat(label, ": ", paste(sprintf("%.17g", as.numeric(x)), collapse=","), "\n", sep="")
probe <- function(label, f) {
  x <- tryCatch(f(), error=function(e) structure(list(message=conditionMessage(e)), class="probe_error"))
  if (inherits(x,"probe_error")) cat(label," ERROR: ",x$message,"\n",sep="") else emit(label,x)
}
probe("REML_vi_1e-300", function() {x<-rma(c(0.1,0.2,0.3),rep(1e-300,3),method="REML");c(x$beta,x$se,x$tau2,x$QE,x$I2,x$H2)})
probe("REML_vi_1e-308", function() {x<-rma(c(0.1,0.2,0.3),rep(1e-308,3),method="REML");c(x$beta,x$se,x$tau2,x$QE,x$I2,x$H2)})
probe("REML_vi_subnormal", function() {x<-rma(c(0.1,0.2,0.3),rep(5e-324,3),method="REML");c(x$beta,x$se,x$tau2,x$QE,x$I2,x$H2)})
probe("REML_effect_1e150", function() {x<-rma(c(-1e150,0,1e150),rep(1,3),method="REML");c(x$beta,x$se,x$tau2,x$QE,x$I2,x$H2)})
probe("REML_effect_1e300", function() {x<-rma(c(-1e300,0,1e300),rep(1,3),method="REML");c(x$beta,x$se,x$tau2,x$QE,x$I2,x$H2)})
