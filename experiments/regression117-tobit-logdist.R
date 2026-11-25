# regression117-tobit-logdist.R (after regression117-tobit.R): tobit with the positive distributions that ReactiveStat
# offers (weibull, lognormal, exponential, and loglogistic, rayleigh) (1.17.0). Candidate as for gaussian: survreg on
# y clipped to [left, right] with the limits censored (left only: type "left"; right only: right censoring; both:
# interval2 with NA ends). Also: the default left = 0 with a positive distribution (every y > 0 then uncensored?),
# a left limit of 0 with zeros in y, AIC and the logLik df, and the scale of exponential (fixed 1).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(AER) })
out <- list(R = R.version.string, arch = R.version$arch, AER = as.character(packageVersion("AER")))
set.seed(20261201)
n <- 80
x1 <- rnorm(n)
ys <- exp(0.5 + 0.6 * x1 + rnorm(n, 0, 0.7))
yz <- ys; yz[1:5] <- 0
d <- data.frame(x1, ys, yz)
assign("d", d, envir = globalenv())
cmp <- function(a, b) max(abs(c(coef(a) - coef(b), a$loglik - b$loglik, a$var - b$var)))
res <- list()
for (dn in c("weibull", "lognormal", "exponential", "loglogistic", "rayleigh")) {
  for (lim in list(c(1, Inf), c(-Inf, 4), c(1, 4), c(0, Inf))) {
    key <- paste(dn, lim[1], lim[2])
    ft <- tryCatch(tobit(ys ~ x1, left = lim[1], right = lim[2], dist = dn, data = d), error = function(e) e)
    if (inherits(ft, "error")) { res[[key]] <- list(error = conditionMessage(ft)); next }
    yy <- d$ys; lo <- ifelse(yy <= lim[1], NA, pmin(yy, lim[2])); hi <- ifelse(yy >= lim[2], NA, pmax(yy, lim[1]))
    lo[yy >= lim[2]] <- lim[2]; hi[yy <= lim[1]] <- lim[1]
    sv <- tryCatch(survreg(Surv(lo, hi, type = "interval2") ~ x1, data = d, dist = dn), error = function(e) e)
    res[[key]] <- list(diff = if (inherits(sv, "error")) conditionMessage(sv) else cmp(ft, sv),
                       ncens = c(sum(yy <= lim[1]), sum(yy >= lim[2])), aic = AIC(ft), aic_cand = -2 * ft$loglik[2] + 2 * attr(logLik(ft), "df"),
                       df = attr(logLik(ft), "df"), scale = ft$scale, wald = summary(ft)$wald)
  }
}
res$zeros_left0_weibull <- tryCatch({ f <- tobit(yz ~ x1, dist = "weibull", data = d); list(coef = coef(f)) }, error = function(e) list(error = conditionMessage(e)))
res$zeros_left0_gaussian_ok <- tryCatch({ f <- tobit(yz ~ x1, data = d); list(coef = coef(f)) }, error = function(e) list(error = conditionMessage(e)))
res$left_ge_right <- tryCatch({ f <- tobit(ys ~ x1, left = 3, right = 2, data = d); list(coef = coef(f)) }, error = function(e) list(error = conditionMessage(e)))
res$all_censored <- tryCatch({ f <- tobit(ys ~ x1, left = 100, data = d); list(coef = coef(f), warn = "none") },
                             error = function(e) list(error = conditionMessage(e)), warning = function(w) list(warning = conditionMessage(w)))
out$cases <- res
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
