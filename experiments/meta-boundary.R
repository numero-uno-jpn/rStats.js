# issue: 529
# Compact public-API boundary probes; no source inspection.
suppressPackageStartupMessages(library(metafor))

probe_fit <- function(label, yi, vi, method="REML", control=NULL) {
  cat("\nCASE", label, "\n")
  withCallingHandlers(
    tryCatch({
      fit <- rma(yi, vi, method=method, control=control)
      print(list(beta=fit$beta, stdError=fit$se, tau2=fit$tau2,
                 Q=fit$QE, Qp=fit$QEp, I2=fit$I2, H2=fit$H2, k=fit$k), digits=17)
    }, error=function(e) cat("ERROR:", conditionMessage(e), "\n")),
    warning=function(w) {
      cat("WARNING:", conditionMessage(w), "\n")
      invokeRestart("muffleWarning")
    }
  )
}

probe_fit("one study REML", c(0.1), c(0.04))
probe_fit("two studies REML", c(0.1,0.2), c(0.04,0.05))
probe_fit("identical effects DL", rep(0.1,4), c(0.04,0.05,0.03,0.06), "DL")
probe_fit("Q below df DL", c(0.1,0.11,0.09,0.1), c(0.04,0.05,0.03,0.06), "DL")
probe_fit("non-positive sampling variance DL", c(0.1,0.2,0.3), c(0,-0.1,0.2), "DL")
probe_fit("REML one iteration", c(0.1,0.2,0.3), c(0.04,0.05,0.06), "REML", list(maxiter=1, threshold=1e-15))

cat("\nCASE Egger two studies\n")
withCallingHandlers(
  tryCatch(print(regtest(c(0.1,0.2), vi=c(0.04,0.05), model="lm", predictor="sei"), digits=17),
                 error=function(e) cat("ERROR:", conditionMessage(e), "\n")),
  warning=function(w) {
    cat("WARNING:", conditionMessage(w), "\n")
    invokeRestart("muffleWarning")
  }
)
cat("\nCASE Egger constant SE\n")
withCallingHandlers(
  tryCatch(print(regtest(c(0.1,0.2,0.3,0.4), vi=rep(0.04,4), model="lm", predictor="sei"), digits=17),
                 error=function(e) cat("ERROR:", conditionMessage(e), "\n")),
  warning=function(w) {
    cat("WARNING:", conditionMessage(w), "\n")
    invokeRestart("muffleWarning")
  }
)
