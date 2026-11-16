# issue: 529
# Public-API boundary experiments only; outputs are observations, not assumptions.
suppressPackageStartupMessages(library(metafor))

probe <- function(label, expr) {
  cat("\nCASE", label, "\n")
  withCallingHandlers(
    tryCatch(print(expr, digits=17), error=function(e) cat("ERROR:", conditionMessage(e), "\n")),
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
