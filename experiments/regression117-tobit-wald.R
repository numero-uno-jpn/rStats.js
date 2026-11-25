# regression117-tobit-wald.R: the Wald statistic of summary(tobit) and the y that tobit builds (1.17.0), after
# regression117-tobit.R found tobit = survreg on y clipped to [left, right] with the limits censored.
# Candidates for the Wald statistic: b' V^-1 b over the coefficients other than the intercept (without Log(scale)),
# df = their number; and the same with V including the scale row. Also: the model without an intercept, a single
# regressor, a factor, weights, the y field (its type and status coding) when both limits are finite, ties at the
# limit (y == left), and tobit's logLik df.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(AER) })
out <- list(R = R.version.string, arch = R.version$arch, AER = as.character(packageVersion("AER")))
set.seed(20261126)
n <- 70
x1 <- rnorm(n); x2 <- rnorm(n); g <- factor(sample(c("a", "b", "c"), n, TRUE)); w <- rpois(n, 2) + 1
ys <- 0.3 + 0.9 * x1 + 0.4 * x2 + (g == "b") * 0.5 + rnorm(n)
ys[1:3] <- 0                   # ties at the limit
yl <- pmax(ys, 0); yb <- pmin(yl, 1.5)
d <- data.frame(x1, x2, g, w, ys, yl, yb)
assign("d", d, envir = globalenv())

wald_cand <- function(f) {
  b <- coef(f); V <- vcov(f); nm <- names(b)
  keep <- nm != "(Intercept)"
  bb <- b[keep]; VV <- V[nm[keep], nm[keep], drop = FALSE]
  if (!any(keep)) return(c(slopes = NA, df = 0))
  c(slopes = as.numeric(t(bb) %*% solve(VV) %*% bb), df = sum(keep))
}
fits <- list(
  base = function() tobit(ys ~ x1 + x2, data = d),
  no_intercept = function() tobit(ys ~ 0 + x1 + x2, data = d),
  one = function() tobit(ys ~ x1, data = d),
  factor = function() tobit(ys ~ x1 + g, data = d),
  weights = function() tobit(ys ~ x1 + x2, weights = w, data = d),
  both = function() tobit(ys ~ x1 + x2, right = 1.5, data = d),
  null = function() tobit(ys ~ 1, data = d)
)
res <- list()
for (nm in names(fits)) {
  f <- fits[[nm]]()
  st <- summary(f)
  res[[nm]] <- list(wald = if (is.null(st$wald)) NULL else as.numeric(st$wald),
                    print_wald = grep("Wald|Log-lik|Observ|Total|[0-9] +[0-9]", capture.output(print(st)), value = TRUE),
                    cand = wald_cand(f), vcov_names = colnames(vcov(f)), vcov_dim = dim(vcov(f)),
                    var_dim = dim(f$var), logLik_df = attr(logLik(f), "df"), nobs = nobs(f),
                    y_type = attr(f$y, "type"), y_head = as.matrix(f$y)[1:5, , drop = FALSE],
                    fitted_head = as.numeric(fitted(f))[1:3], lp_head = f$linear.predictors[1:3])
}
out$fits <- res
# survreg directly on the clipped y with weights, for the weights case
sw <- survreg(Surv(pmax(ys, 0), ys > 0, type = "left") ~ x1 + x2, weights = w, data = d, dist = "gaussian")
fw <- tobit(ys ~ x1 + x2, weights = w, data = d)
out$weights_vs_survreg <- max(abs(c(coef(sw) - coef(fw), sw$var - fw$var, sw$loglik - fw$loglik)))
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
