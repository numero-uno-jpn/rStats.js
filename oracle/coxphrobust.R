# oracle-platform: amd64
source("/oracle/_anova.R")
suppressPackageStartupMessages(library(survival))

# Robust (Lin-Wei) variance of the Cox model: survival::coxph with robust = TRUE, a cluster, or non-integer case weights
# (fixture coxphRobust). Behaviour in oracle/robust-behaviour.md, section 4; the fit itself in
# oracle/coxph-behaviour.md. The matrix interface of oracle/coxph.R: coxph(Surv(time, status) ~ x [+ strata(strata)]
# [+ cluster(cluster)], weights, ties, init, robust, cluster, control).
#   Arguments: time, status, x ("NA" for a missing value), and optionally weights, strata, ties, init, iter.max, robust
#   (TRUE/FALSE; absent: R's default), cluster (labels; "NA" for a missing one), clusterTerm (TRUE: the cluster is given
#   as a cluster() term of the formula instead of the argument), clusterBoth (a second cluster, given as the argument
#   while `cluster` is the formula term).
#   Written (fit): coef, var (the robust variance when used), naive.var (absent when no robust variance was computed),
#   rscore (the robust score test statistic, absent likewise), wald (unrounded, from var), loglik, score, iter, n,
#   nevent; (summary) se (from naive.var when present), robustSe (from var; absent without a robust variance), z, p,
#   lower, upper (95% interval of exp(coef), from var), logtest, sctest, waldtest, robscore (each test, df, pvalue);
#   (residuals of the robust fit, one row per observation used, in input order) scoreResid (type "score", unweighted),
#   dfbeta (type "dfbeta", weighted: the rows whose cluster sums make var), only for fits with at most 120 rows; warnings.
#   Errors as {"error": message}.

set.seed(20261113)
sim <- function(n, beta, rate = 0.1, cens = 0.05, digits = NULL, p01 = FALSE, frailty = NULL) {
  x <- matrix(rnorm(n * length(beta)), n)
  if (p01) x[, 1] <- rbinom(n, 1, 0.4)
  lp <- drop(x %*% beta); if (!is.null(frailty)) lp <- lp + frailty
  t <- rexp(n, rate * exp(lp)); c <- rexp(n, cens)
  time <- pmin(t, c); if (!is.null(digits)) time <- round(time, digits) + 10^-digits
  list(time = time, status = as.integer(t <= c), x = round(x, 4))
}
cases <- list()
add <- function(d, ...) cases[[length(cases) + 1]] <<- c(list(time = I(d$time), status = I(d$status), x = d$x), list(...))

# clustered data: 25 clusters of 2 to 6 subjects with a shared frailty
sz <- sample(2:6, 25, replace = TRUE); cl <- rep(seq_along(sz), sz); nc <- length(cl)
s1 <- sim(nc, c(0.6, -0.4), frailty = rnorm(25, 0, 0.6)[cl])
s2 <- sim(nc, c(0.6, -0.4), digits = 0, frailty = rnorm(25, 0, 0.6)[cl], p01 = TRUE)   # heavy ties, a 0/1 covariate
wnon <- round(runif(nc, 0.4, 3), 3)
for (ties in c("efron", "breslow")) {
  add(s1, ties = ties, robust = TRUE)                       # each subject its own cluster
  add(s1, ties = ties, cluster = I(cl))
  add(s2, ties = ties, cluster = I(cl))
  add(s1, ties = ties, weights = I(wnon))                   # non-integer weights: robust by default
  add(s2, ties = ties, weights = I(wnon), cluster = I(cl))
  add(s2, ties = ties, weights = I(wnon), cluster = I(cl), strata = I(rep(c("b", "a"), length.out = nc)))
}
add(s1, weights = I(wnon), robust = FALSE)                  # non-integer weights without the robust variance
add(s1, weights = I(sample(1:3, nc, replace = TRUE)))        # integer weights: not robust by default
add(s1, weights = I(sample(1:3, nc, replace = TRUE)), robust = TRUE)
add(s1, weights = I(rep(2.5, nc)))                           # constant non-integer weights
add(s1, cluster = I(cl), clusterTerm = TRUE)                 # cluster() term: same as the argument
add(s1, cluster = I(cl), clusterTerm = TRUE, clusterBoth = I(rep(1:5, length.out = nc)))   # both: warning, term ignored
add(s1, cluster = I(cl), robust = FALSE)                     # warning, cluster ignored
add(s1, cluster = I(letters[(cl - 1) %% 26 + 1]))            # string labels
add(s1, cluster = I(cl), init = I(c(0.3, -0.2)))             # the robust score test at init
add(s1, robust = TRUE, init = I(c(0.3, -0.2)))
add(s1, cluster = I(cl), iter.max = 1)                       # not converged
clna <- cl; clna[c(4, 30)] <- NA
add(s1, cluster = I(clna))                                   # missing cluster labels: those rows are dropped
add(s1, cluster = I(rep(1:2, length.out = nc)))              # two clusters (rank-deficient robust score matrix)
add(s1, cluster = I(rep(1, nc)))                             # a single cluster: R's error
s3 <- s1; s3$x <- cbind(s3$x, s3$x[, 1] - s3$x[, 2])         # an aliased column
add(s3, cluster = I(cl))
add(list(time = s1$time, status = rep(0L, nc), x = s1$x), robust = TRUE)   # no events
# the lung data clustered by institution (inst has a missing value: that row is dropped) and with sex as strata
lungx <- as.matrix(lung[, c("age", "sex", "ph.ecog")])
lung1 <- list(time = lung$time, status = lung$status - 1L, x = lungx)
add(lung1, cluster = I(lung$inst))
add(lung1, cluster = I(lung$inst), ties = "breslow")
add(list(time = lung$time, status = lung$status - 1L, x = lungx[, c(1, 3)]), cluster = I(lung$inst),
    strata = I(ifelse(lung$sex == 1, "m", "f")))
# inverse probability weighting: treatment assigned by a logistic model on two confounders, ATE weights
n <- 150
z1 <- rnorm(n); z2 <- rbinom(n, 1, 0.5); trt <- rbinom(n, 1, plogis(-0.3 + 0.8 * z1 + 0.6 * z2))
ps <- fitted(glm(trt ~ z1 + z2, family = binomial)); ipw <- round(ifelse(trt == 1, 1 / ps, 1 / (1 - ps)), 6)
tt <- rexp(n, 0.1 * exp(-0.5 * trt + 0.5 * z1 + 0.4 * z2)); cc <- rexp(n, 0.04)
dipw <- list(time = round(pmin(tt, cc), 2) + 0.01, status = as.integer(tt <= cc), x = cbind(trt))
add(dipw, weights = I(ipw))
add(dipw, weights = I(ipw), ties = "breslow")

write_anova_fixture("coxphRobust", cases, function(a) {
  df <- data.frame(time = unclass(a$time), status = unclass(a$status))
  x <- a$x; colnames(x) <- paste0("x", seq_len(ncol(x)))
  df$x <- x
  if (!is.null(a$strata)) df$s <- unclass(a$strata)
  if (!is.null(a$weights)) df$w <- unclass(a$weights)
  if (!is.null(a$cluster)) df$cl <- unclass(a$cluster)
  if (!is.null(a$clusterBoth)) df$cl2 <- unclass(a$clusterBoth)
  ctl <- coxph.control(iter.max = if (is.null(a$iter.max)) 20 else a$iter.max)
  rhs <- c("x", if (!is.null(a$strata)) "strata(s)", if (isTRUE(a$clusterTerm)) "cluster(cl)")
  fml <- as.formula(paste("Surv(time, status) ~", paste(rhs, collapse = " + ")))
  r <- tryCatch(with_warnings(function() {
    args <- list(fml, data = df, ties = if (is.null(a$ties)) "efron" else a$ties, control = ctl)
    if (!is.null(a$weights)) args$weights <- quote(w)
    if (!is.null(a$init)) args$init <- unclass(a$init)
    if (!is.null(a$robust)) args$robust <- a$robust
    if (!is.null(a$cluster) && !isTRUE(a$clusterTerm)) args$cluster <- quote(cl)
    if (!is.null(a$clusterBoth)) args$cluster <- quote(cl2)
    fit <- do.call(coxph, args)
    s <- summary(fit)
    test3 <- function(v) I(num2str(unname(v[c("test", "df", "pvalue")])))
    m <- function(v) lapply(seq_len(nrow(v)), function(i) I(num2str(v[i, ])))
    cf <- s$coefficients
    out <- list(coef = I(num2str(unname(fit$coefficients))), var = m(fit$var))
    if (!is.null(fit$naive.var)) out$naive.var <- m(fit$naive.var)
    if (!is.null(fit$rscore)) out$rscore <- num2str(fit$rscore)
    out <- c(out, list(wald = num2str(fit$wald.test), loglik = I(num2str(fit$loglik)), score = num2str(fit$score),
      iter = fit$iter, n = fit$n, nevent = fit$nevent,
      se = I(num2str(unname(cf[, "se(coef)"])))))
    if ("robust se" %in% colnames(cf)) out$robustSe <- I(num2str(unname(cf[, "robust se"])))
    out <- c(out, list(z = I(num2str(unname(cf[, "z"]))), p = I(num2str(unname(cf[, "Pr(>|z|)"]))),
      lower = I(num2str(unname(s$conf.int[, 3]))), upper = I(num2str(unname(s$conf.int[, 4]))),
      logtest = test3(s$logtest), sctest = test3(s$sctest),
      waldtest = I(num2str(c(fit$wald.test, s$waldtest[c("df", "pvalue")])))))
    if (!is.null(s$robscore)) out$robscore <- test3(s$robscore)
    if (!is.null(fit$naive.var) && fit$n <= 120) {
      out$scoreResid <- m(as.matrix(residuals(fit, type = "score")))
      out$dfbeta <- m(as.matrix(residuals(fit, type = "dfbeta")))
    }
    out
  }), error = function(e) list(value = list(error = conditionMessage(e)), warnings = I(character(0))))
  c(r$value, list(warnings = r$warnings))
})
