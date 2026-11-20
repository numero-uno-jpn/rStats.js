# regression-polr-cauchit.R: MASS 7.3-66's cauchit link against the standard Cauchy cumulative-link model, public
# functions only (1.7.0). For an intercept-only model every link's maximum-likelihood cut-points are F^{-1} of the
# cumulative proportions and its deviance is the multinomial one; MASS's cauchit reaches neither
suppressMessages(library(MASS))
mt <- mtcars; mt$gearO <- factor(mt$gear, ordered = TRUE)
p <- cumsum(table(mt$gearO))[1:2] / 32
n <- table(mt$gearO)
cat("multinomial deviance:", sprintf("%.15g", -2 * sum(n * log(n / 32))), "\n")
for (m in c("logistic", "probit", "cloglog", "loglog", "cauchit")) {
  fit <- polr(gearO ~ 1, data = mt, method = m, control = list(reltol = 1e-15))
  cat(m, "zeta:", sprintf("%.10g", fit$zeta), "deviance:", sprintf("%.15g", deviance(fit)), "\n")
}
cat("qcauchy(p):", sprintf("%.10g", qcauchy(p)), "\n")
dev_at <- function(z) deviance(polr(gearO ~ 1, data = mt, method = "cauchit", start = z, control = list(maxit = 0)))
z <- polr(gearO ~ 1, data = mt, method = "cauchit", control = list(reltol = 1e-15))$zeta
cat("MASS's cauchit deviance at its own zeta:", sprintf("%.15g", dev_at(z)), "\n")
cat("MASS's cauchit deviance at qcauchy(p):", sprintf("%.15g", dev_at(qcauchy(p))), "\n")
pr <- c(pcauchy(z[1]), pcauchy(z[2]) - pcauchy(z[1]), 1 - pcauchy(z[2]))
cat("standard Cauchy deviance by hand at MASS's zeta:", sprintf("%.15g", -2 * sum(n * log(pr))), "\n")
