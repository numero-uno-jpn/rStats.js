# regression117-betareg.R: what betareg's fit is (1.17.0). From the help pages and the papers they cite (Ferrari and
# Cribari-Neto 2004; Simas, Barreto-Souza and Rocha 2010; Cribari-Neto and Zeileis 2010), candidates for
#   - the log-likelihood: sum of w * dbeta(y, mu phi, (1 - mu) phi, log = TRUE)
#   - the maximum: the gradient of that log-likelihood at R's estimates (numerically), and a Newton refit from R's
#     estimates written here (how far R's point is from the exact maximum)
#   - vcov: the inverse of the expected information (the formulas of Simas et al.), or of the observed information
#     (numerical Hessian of the candidate log-likelihood)
#   - the starting values: lm of g(y) on X; phi from mean(mu (1 - mu) / sigma2) - 1 with sigma2 by the delta method
#     (Ferrari and Cribari-Neto 2004, section 2), on the scale of link.phi
#   - pseudo.r.squared: cor(eta, g(y))^2
# across the mean links (logit, probit, cloglog, cauchit, log, loglog), constant phi (identity link) and y ~ x | z
# (log link), and weights. Also the fields of the fit and of summary, and the iteration counts.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(betareg) })
out <- list(R = R.version.string, arch = R.version$arch, betareg = as.character(packageVersion("betareg")))
set.seed(20261127)
n <- 90
x1 <- rnorm(n); x2 <- runif(n); z1 <- rnorm(n); w <- rpois(n, 2) + 1
mu0 <- plogis(-0.3 + 0.6 * x1 - 0.8 * x2); ph0 <- exp(2.5 + 0.5 * z1)
yv <- rbeta(n, mu0 * ph0, (1 - mu0) * ph0)
yc <- rbeta(n, mu0 * 30, (1 - mu0) * 30)
d <- data.frame(x1, x2, z1, w, yv, yc)
assign("d", d, envir = globalenv())

linkinv <- list(logit = plogis, probit = pnorm, cloglog = function(e) 1 - exp(-exp(e)), cauchit = pcauchy,
                log = exp, loglog = function(e) exp(-exp(-e)), identity = function(e) e, sqrt = function(e) e^2)
linkfun <- list(logit = qlogis, probit = qnorm, cloglog = function(m) log(-log(1 - m)), cauchit = qcauchy,
                log = log, loglog = function(m) -log(-log(m)), identity = function(m) m, sqrt = sqrt)
mueta <- list(logit = function(e) plogis(e) * (1 - plogis(e)), probit = dnorm,
              cloglog = function(e) exp(e - exp(e)), cauchit = dcauchy, log = exp,
              loglog = function(e) exp(-e - exp(-e)), identity = function(e) rep(1, length(e)),
              sqrt = function(e) 2 * e)

cand <- function(f, X, Z, y, wt, lk, lkp) {
  p <- ncol(X); q <- ncol(Z)
  ll <- function(th) {
    mu <- linkinv[[lk]](X %*% th[1:p]); ph <- linkinv[[lkp]](Z %*% th[p + 1:q])
    sum(wt * dbeta(y, mu * ph, (1 - mu) * ph, log = TRUE))
  }
  th <- c(f$coefficients$mean, f$coefficients$precision)
  H <- optimHess(th, ll)
  # expected information (Simas et al. 2010)
  e1 <- as.vector(X %*% th[1:p]); e2 <- as.vector(Z %*% th[p + 1:q])
  mu <- linkinv[[lk]](e1); ph <- linkinv[[lkp]](e2); d1 <- mueta[[lk]](e1); d2 <- mueta[[lkp]](e2)
  a <- trigamma(mu * ph); b <- trigamma((1 - mu) * ph)
  Wd <- wt * ph^2 * (a + b) * d1^2
  Cd <- wt * ph * (a * mu - b * (1 - mu)) * d1 * d2
  Dd <- wt * (a * mu^2 + b * (1 - mu)^2 - trigamma(ph)) * d2^2
  K <- rbind(cbind(t(X) %*% (Wd * X), t(X) %*% (Cd * Z)), cbind(t(Z) %*% (Cd * X), t(Z) %*% (Dd * Z)))
  Vexp <- solve(K); Vobs <- solve(-H)
  # Newton from R's point on the candidate log-likelihood (numerical gradient and Hessian)
  g <- numeric(length(th)); h <- 1e-6
  for (j in seq_along(th)) { e <- replace(numeric(length(th)), j, h); g[j] <- (ll(th + e) - ll(th - e)) / (2 * h) }
  nstep <- solve(-H, g)
  # starting values
  gy <- linkfun[[lk]](y)
  lmf <- lm.wfit(X, gy, wt)
  b0 <- lmf$coefficients; mu_s <- linkinv[[lk]](lmf$fitted.values)
  dd <- mueta[[lk]](lmf$fitted.values)
  s2 <- sum(wt * lmf$residuals^2) / (sum(wt) - p) * dd^2
  s2b <- sum(lmf$residuals^2) / (length(y) - p) * dd^2
  ph_s <- c(weighted = sum(wt * (mu_s * (1 - mu_s) / s2 - 1)) / sum(wt), plain = mean(mu_s * (1 - mu_s) / s2b - 1))
  list(loglik_cand = ll(th), loglik = f$loglik, vcov_exp = max(abs(Vexp - f$vcov)), vcov_obs = max(abs(Vobs - f$vcov)),
       vcov_scale = max(abs(f$vcov)), grad_num = g, newton_step = nstep,
       start = unname(f$start), start_beta = unname(b0), start_phi = ph_s,
       start_phi_link = linkfun[[lkp]](ph_s),
       r2 = f$pseudo.r.squared, r2_cand = c(eta = cor(e1, gy)^2, weighted_eta = cov.wt(cbind(e1, gy), wt, cor = TRUE)$cor[1, 2]^2),
       coef = unname(th), counts = f$optim$counts, converged = f$converged, iterations = f$iterations,
       fields = names(f), df = c(null = f$df.null, residual = f$df.residual), nobs = f$nobs, n = f$n)
}
X <- cbind(1, x1, x2); Z1 <- matrix(1, n, 1); Zz <- cbind(1, z1)
res <- list()
for (lk in c("logit", "probit", "cloglog", "cauchit", "log", "loglog")) {
  f <- tryCatch(betareg(yc ~ x1 + x2, data = d, link = lk), error = function(e) e)
  res[[paste("const", lk)]] <- if (inherits(f, "error")) list(error = conditionMessage(f)) else cand(f, X, Z1, yc, rep(1, n), lk, "identity")
  f <- tryCatch(betareg(yv ~ x1 + x2 | z1, data = d, link = lk), error = function(e) e)
  res[[paste("var", lk)]] <- if (inherits(f, "error")) list(error = conditionMessage(f)) else cand(f, X, Zz, yv, rep(1, n), lk, "log")
}
f <- betareg(yc ~ x1 + x2, data = d, link.phi = "log"); res[["const logit phi-log"]] <- cand(f, X, Z1, yc, rep(1, n), "logit", "log")
f <- betareg(yv ~ x1 + x2 | z1, data = d, link.phi = "sqrt"); res[["var logit phi-sqrt"]] <- cand(f, X, Zz, yv, rep(1, n), "logit", "sqrt")
f <- betareg(yc ~ x1 + x2, data = d, weights = w); res[["const logit weights"]] <- cand(f, X, Z1, yc, w, "logit", "identity")
f <- betareg(yv ~ x1 + x2 | z1, data = d, weights = w); res[["var logit weights"]] <- cand(f, X, Zz, yv, w, "logit", "log")
out$fits <- res
f <- betareg(yv ~ x1 + x2 | z1, data = d)
s <- summary(f)
out$summary_fields <- names(s)
out$summary_coef_names <- lapply(s$coefficients, rownames)
out$print_summary <- capture.output(print(s))
out$print_const <- capture.output(print(summary(betareg(yc ~ x1 + x2, data = d))))
out$coef_names <- names(coef(f)); out$coef_names_const <- names(coef(betareg(yc ~ x1, data = d)))
out$vcov_names <- colnames(vcov(f))
out$logLik_df <- attr(logLik(f), "df")
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
