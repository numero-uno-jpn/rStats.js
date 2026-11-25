# regression117-betareg-resid.R: betareg's residuals, predictions, confint and input errors (1.17.0). Candidates for
# the residuals from the help page's references (Espinheira, Ferrari and Cribari-Neto 2008; Dunn and Smyth 1996),
# with y* = logit(y), mu* = digamma(mu phi) - digamma((1 - mu) phi), v = trigamma(mu phi) + trigamma((1 - mu) phi):
#   quantile: qnorm(pbeta(y, mu phi, (1 - mu) phi))
#   response: y - mu;  pearson: (y - mu) / sqrt(mu (1 - mu) / (1 + phi))
#   deviance: sign(y - mu) sqrt(2 (l(y | mean y) - l(y | mean mu)))
#   weighted: (y* - mu*) / sqrt(v) or / sqrt(phi v) or * sqrt(phi) / sqrt(v)
#   sweighted / sweighted2: the weighted ones over sqrt(1 - h), with h the diagonal of the hat matrix
#     W^1/2 X (X'WX)^-1 X' W^1/2, W = phi v (dmu/deta)^2, or of other variants
# Each candidate is compared with R for constant and modelled phi, with and without case weights. Also predict's
# types, confint (Wald with qnorm?), and the errors for y outside (0, 1) and with 0 or 1 (xbetax).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(betareg) })
out <- list(R = R.version.string, arch = R.version$arch, betareg = as.character(packageVersion("betareg")))
set.seed(20261129)
n <- 50
x1 <- rnorm(n); z1 <- rnorm(n); w <- rpois(n, 1.5) + 1
mu0 <- plogis(0.2 + 0.7 * x1); ph0 <- exp(2 + 0.6 * z1)
yv <- rbeta(n, mu0 * ph0, (1 - mu0) * ph0)
yc <- rbeta(n, mu0 * 15, (1 - mu0) * 15)
d <- data.frame(x1, z1, w, yv, yc)
assign("d", d, envir = globalenv())
mx <- function(a, b) max(abs(a - b))

cands <- function(f, X, y, wt) {
  mu <- predict(f, type = "response"); ph <- predict(f, type = "precision"); eta <- predict(f, type = "link")
  dme <- mu * (1 - mu)   # logit link
  ys <- qlogis(y); ms <- digamma(mu * ph) - digamma((1 - mu) * ph)
  v <- trigamma(mu * ph) + trigamma((1 - mu) * ph)
  ll <- function(m) dbeta(y, m * ph, (1 - m) * ph, log = TRUE)
  hat <- function(Wd) { Xw <- sqrt(Wd) * X; rowSums((Xw %*% solve(crossprod(Xw))) * Xw) }
  W1 <- ph * v * dme^2; h1 <- hat(W1); h1w <- hat(wt * W1)
  r <- function(type) as.numeric(residuals(f, type = type))
  wr <- list(a = (ys - ms) / sqrt(v), b = (ys - ms) / sqrt(ph * v), c = sqrt(ph) * (ys - ms) / sqrt(v))
  list(
    quantile = mx(r("quantile"), qnorm(pbeta(y, mu * ph, (1 - mu) * ph))),
    response = mx(r("response"), y - mu),
    pearson = mx(r("pearson"), (y - mu) / sqrt(mu * (1 - mu) / (1 + ph))),
    pearson_w = mx(r("pearson"), sqrt(wt) * (y - mu) / sqrt(mu * (1 - mu) / (1 + ph))),
    deviance = mx(r("deviance"), sign(y - mu) * sqrt(2 * pmax(ll(y) - ll(mu), 0))),
    deviance_w = mx(r("deviance"), sign(y - mu) * sqrt(2 * wt * pmax(ll(y) - ll(mu), 0))),
    weighted = sapply(wr, function(c) mx(r("weighted"), c)),
    sweighted = c(sapply(wr, function(c) mx(r("sweighted"), c / sqrt(1 - h1))),
                  sapply(wr, function(c) mx(r("sweighted"), c / sqrt(1 - h1w)))),
    sweighted2 = c(sapply(wr, function(c) mx(r("sweighted2"), c / sqrt(1 - h1))),
                   sapply(wr, function(c) mx(r("sweighted2"), c / sqrt(1 - h1w)))),
    hatvalues = c(h1 = mx(hatvalues(f), h1), h1w = mx(hatvalues(f), h1w)),
    values = list(weighted = r("weighted")[1:4], sweighted = r("sweighted")[1:4], sweighted2 = r("sweighted2")[1:4],
                  deviance = r("deviance")[1:4], cand_a = wr$a[1:4], cand_b = wr$b[1:4], h1 = h1[1:4]),
    default_type = mx(as.numeric(residuals(f)), r("quantile")))
}
X <- cbind(1, x1)
res <- list()
res$const <- cands(betareg(yc ~ x1, data = d), X, yc, rep(1, n))
res$var <- cands(betareg(yv ~ x1 | z1, data = d), X, yv, rep(1, n))
res$const_weights <- cands(betareg(yc ~ x1, data = d, weights = w), X, yc, w)
out$residuals <- res

# predictions
f <- betareg(yv ~ x1 | z1, data = d)
nd <- data.frame(x1 = c(-1, 0, 2), z1 = c(0.5, -1, 0))
mu <- predict(f, nd); ph <- predict(f, nd, type = "precision")
out$predict <- list(
  response = mu, link = predict(f, nd, type = "link"), precision = ph,
  variance = predict(f, nd, type = "variance"), variance_cand = mu * (1 - mu) / (1 + ph),
  quantile = predict(f, nd, type = "quantile", at = c(0.25, 0.5, 0.75)),
  quantile_cand = t(sapply(1:3, function(i) qbeta(c(0.25, 0.5, 0.75), mu[i] * ph[i], (1 - mu[i]) * ph[i]))),
  quantile_elementwise = predict(f, nd, type = "quantile", at = c(0.1, 0.5, 0.9)),
  quantile_one = predict(f, nd, type = "quantile", at = 0.5),
  density = predict(f, nd, type = "density", at = 0.4),
  density_cand = dbeta(0.4, mu * ph, (1 - mu) * ph),
  probability = predict(f, nd, type = "probability", at = c(0.3, 0.6), elementwise = FALSE),
  parameters = as.matrix(predict(f, nd, type = "parameters")),
  parameters_names = colnames(predict(f, nd, type = "parameters")),
  fitted_vs_response = mx(fitted(f), predict(f)))

# confint
ci <- confint(f); ci90 <- confint(f, level = 0.9)
sev <- sqrt(diag(vcov(f))); cf <- c(f$coefficients$mean, f$coefficients$precision)
out$confint <- list(rows = rownames(ci), cols = colnames(ci), z95 = mx(ci, cbind(cf - qnorm(0.975) * sev, cf + qnorm(0.975) * sev)),
                    z90 = mx(ci90, cbind(cf - qnorm(0.95) * sev, cf + qnorm(0.95) * sev)),
                    coef_mean = coef(f, model = "mean"), coef_precision = coef(f, model = "precision"),
                    vcov_mean_dim = dim(vcov(f, model = "mean")))
# summary table and pvalues
s <- summary(f)
out$summary <- list(mean = unname(s$coefficients$mean), precision = unname(s$coefficients$precision),
                    z_cand = mx(s$coefficients$mean[, 3], cf[1:2] / sev[1:2]),
                    p_cand = mx(s$coefficients$mean[, 4], 2 * pnorm(-abs(cf[1:2] / sev[1:2]))),
                    residuals_type = s$residuals.type, iterations = s$iterations)
# input errors and boundary values
err <- function(expr) tryCatch({ r <- expr; list(ok = TRUE, dist = r$dist, coef = unlist(r$coefficients)) },
                               error = function(e) list(error = conditionMessage(e)),
                               warning = function(w) list(warning = conditionMessage(w)))
d2 <- d; d2$y0 <- d$yc; d2$y0[1] <- 0; d2$y1 <- d$yc; d2$y1[1] <- 1; d2$yneg <- d$yc; d2$yneg[1] <- -0.1
d2$ybig <- d$yc; d2$ybig[1] <- 1.2; d2$yna <- d$yc; d2$yna[1] <- NA
assign("d2", d2, envir = globalenv())
out$errors <- list(y0 = err(betareg(y0 ~ x1, data = d2)), y1 = err(betareg(y1 ~ x1, data = d2)),
                   yneg = err(betareg(yneg ~ x1, data = d2)), ybig = err(betareg(ybig ~ x1, data = d2)),
                   yna = err(betareg(yna ~ x1, data = d2)),
                   nobs_na = betareg(yna ~ x1, data = d2)$nobs,
                   bad_link = err(betareg(yc ~ x1, data = d, link = "identity")),
                   bad_phi_link = err(betareg(yc ~ x1, data = d, link.phi = "inverse")),
                   bad_type = err(betareg(yc ~ x1, data = d, type = "XX")),
                   zero_weight = err(betareg(yc ~ x1, data = d, weights = c(0, rep(1, n - 1)))))
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
