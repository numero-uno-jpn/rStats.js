# tsmeta120-glmmrare2.R: glmer on rare events more broadly (1.20.0, session 42, log 111): binomial proportions of
# about 1e-3 .. 1e-6 with weights 1e3 .. 1e7, with and without a covariate and between-group variation, and poisson
# counts with tiny rates through a large offset. lme4's theta, fixed effects and log-likelihood (nAGQ = 1).
library(jsonlite)
suppressPackageStartupMessages(library(lme4))
grab <- function(expr) tryCatch(suppressMessages(suppressWarnings(expr)), error = function(err) list(error = conditionMessage(err)))
set.seed(5)
g <- factor(rep(paste0("g", 1:8), each = 3)); x <- round(rnorm(24), 2)
cases <- list()
for (lw in c(3, 5, 7)) for (lp in c(-3, -5, -6)) for (re in c(0, 0.5)) {
  w <- round(10^lw * runif(24, 0.5, 1.5)); eta <- lp * log(10) + 0.3 * x + rep(rnorm(8, 0, re), each = 3)
  ev <- rbinom(24, w, plogis(eta))
  d <- data.frame(p = ev / w, w = w, x = x, g = g)
  cases[[sprintf("w%d_p%d_re%s", lw, -lp, re)]] <- list(data = d, fit = grab({ f <- glmer(p ~ x + (1 | g), data = d, family = binomial, weights = w)
    list(theta = unname(getME(f, "theta")), fixef = unname(fixef(f)), loglik = as.numeric(logLik(f))) }))
}
for (lo in c(8, 12)) {
  off <- log(10^lo * runif(24, 0.5, 1.5)); y <- rpois(24, exp(off - lo * log(10) + 1 + 0.2 * x + rep(rnorm(8, 0, 0.4), each = 3)))
  d <- data.frame(y = y, x = x, g = g, off = off)
  cases[[sprintf("pois_off%d", lo)]] <- list(data = d, fit = grab({ f <- glmer(y ~ x + offset(off) + (1 | g), data = d, family = poisson)
    list(theta = unname(getME(f, "theta")), fixef = unname(fixef(f)), loglik = as.numeric(logLik(f))) }))
}
cat(toJSON(cases, auto_unbox = TRUE, digits = I(17), na = "null", null = "null"))
