# Exact lmer and glmer fits for the oracles glmersummary.R, glmeranova.R and mixedpredict.R (stages 3 and 4 of
# oracle/glmer-behaviour.md). This file takes the machinery of oracle/glmer.R (through oracle/_glmeragq.R, so that
# nAGQ > 1 uses the AGQ deviance) and of oracle/lmer.R (in the environment LM, since both files define functions of
# the same names); none of their cases is run and neither changes. Defines
#   glmer_exact(a)   the exact optimum of a glmer case (oracle/glmer.R's arguments: formula, data, family, link,
#                    weights, offset (arrays), nAGQ) by glmer.R's search and 110-bit Newton's method, and at it, in
#                    double precision: theta, beta, u, b, eta, mu, the Fisher weights W at the mode, RX (upper
#                    triangular, positive diagonal), sigma, logLik (G12: the true log-likelihood for nAGQ > 1), df
#   lmer_exact(a, reml)  the exact optimum of an lmer case (oracle/lmer.R's arguments) by lmer.R's optimum() from
#                    lme4's theta, and theta, beta, b, sigma, RX, logLik at it (lmer.R's 128-bit pls)
#   cond_cov(X, Z, Lambda, W, sigma)  C = sigma^2 A K^-1 A' of oracle/glmer-behaviour.md ("Standard errors")
#   design_rows(...) the rows v = (z, x) of a prediction by lme4's own predict() on copies of the fit with unit
#                    parameters (see there)

if (exists("DEBUG_ONE")) DEBUG_MIXED <- DEBUG_ONE
DEBUG_ONE <- integer(0)
source("/oracle/_glmeragq.R")      # glmer.R's functions and data; no case is run
rm(DEBUG_ONE)
LM <- new.env()
assign("DEBUG_ONE", TRUE, LM)      # lmer.R writes nothing
sys.source("/oracle/lmer.R", envir = LM)
if (exists("DEBUG_MIXED")) { DEBUG_ONE <- DEBUG_MIXED; rm(DEBUG_MIXED) }
cases <- list()

rows_matrix <- function(R) {       # glmer.R's row layout of an upper triangular matrix -> matrix
  k <- length(R); M <- matrix(0, k, k)
  for (j in seq_len(k)) M[j, j:k] <- asNumeric(R[[j]])
  M
}

glmer_exact <- function(a) {
  fit <- suppressMessages(suppressWarnings(fit_lme4(a)))
  s <- prepare(a)
  par_lme4 <- unname(if (s$nagq >= 1L) c(getME(fit, "theta"), fixef(fit)) else getME(fit, "theta"))
  v_lme4 <- unname(if (s$nagq >= 1L) getME(fit, "u") else c(getME(fit, "u"), fixef(fit)))
  dopt <- double_optimum(s, par_lme4, v_lme4)
  opt <- mp_optimum(s, dopt$par, dopt$f)
  ps <- par_split(s, opt$par)
  ev <- evaluate_mp(s, ps$theta, ps$beta, mode_at(dopt$f, opt$par), full = TRUE)
  yv <- mp(s$y)
  pearson <- sqrt(mp(s$wt)) * (yv - ev$mu) / sqrt(variance(ev$mu, s$family))
  sigma <- if (s$useSc) sqrt((sum(pearson^2) + ev$ussq) / s$n) else mp(1)
  dev <- ev$dev
  if (s$nagq > 1L) dev <- dev + aic_of(s$y, s$nb, ev$mu, s$wt, sum(ev$di), s$family) - sum(ev$di)   # G12
  df <- s$p + s$nth + as.integer(s$useSc)
  message(sprintf("glmer %-36s %-20s nAGQ %d: %s; Newton steps %s; |gradient| %.2g", a$formula,
                  paste(a$family, a$link), s$nagq, dopt$note, paste(opt$steps, collapse = " "), opt$gmax))
  list(s = s, fit = fit, theta = asNumeric(ps$theta), beta = asNumeric(ev$beta), u = asNumeric(ev$u),
       b = asNumeric(ev$b), eta = asNumeric(ev$eta), mu = asNumeric(ev$mu), W = asNumeric(ev$W),
       RX = rows_matrix(ev$RX), sigma = asNumeric(sigma), logLik = asNumeric(-dev / 2), df = df, n = s$n,
       pearson = asNumeric(pearson))
}

lmer_exact <- function(a, reml = isTRUE(a$REML)) {
  s <- LM$prepare(a)
  fit <- suppressMessages(suppressWarnings(lme4::lmer(as.formula(a$formula), s$dat, REML = isTRUE(a$REML),
                                                      contrasts = s$ctr)))
  th0 <- unname(getME(if (isTRUE(a$REML) && !reml) lme4::refitML(fit) else fit, "theta"))
  opt <- LM$optimum(s, th0, reml)
  r <- LM$pls(s, opt$theta)
  sigma <- sqrt(r$prss / (if (reml) s$n - s$p else s$n))
  crit <- if (reml) r$devREML else r$devML
  message(sprintf("lmer %-37s REML %s: Newton steps %s", a$formula, reml, paste(opt$steps, collapse = " ")))
  list(s = s, fit = fit, theta = asNumeric(opt$theta), beta = asNumeric(r$beta), u = asNumeric(r$u),
       b = asNumeric(r$b), sigma = asNumeric(sigma), RX = asNumeric(r$RX), logLik = asNumeric(-crit / 2),
       df = s$p + length(th0) + 1, n = s$n, reml = reml)
}

# C = sigma^2 A K^-1 A', K = [L'Z'WZL + I, L'Z'WX; X'WZL, X'WX], A = diag(L, I) (L = Lambda, q x q)
cond_cov <- function(X, Z, Lambda, W, sigma) {
  ZL <- Z %*% Lambda; q <- ncol(Z); p <- ncol(X)
  K <- rbind(cbind(crossprod(ZL, W * ZL) + diag(q), crossprod(ZL, W * X)), cbind(crossprod(X, W * ZL), crossprod(X, W * X)))
  A <- matrix(0, q + p, q + p); A[seq_len(q), seq_len(q)] <- Lambda
  if (p) A[q + seq_len(p), q + seq_len(p)] <- diag(p)
  sigma^2 * A %*% solve(K, t(A))
}
lambda_of <- function(fit, theta) { Lt <- getME(fit, "Lambdat"); Lt@x <- theta[getME(fit, "Lind")]; t(as.matrix(Lt)) }

# The rows v = (z, x) of predictions (one row per prediction) and the part that does not depend on (b, beta) (the
# offset), from lme4's predict() on copies of the fit whose Lambda is the identity (the structure's initial theta)
# and whose (u, beta) is a unit vector, so that each prediction is linear in (b, beta): the column of b_k or beta_j.
# `args` are predict()'s arguments (newdata, re.form, random.only); allow.new.levels is TRUE (new levels have zero
# columns), and lme4's raw path (no newdata, no re.form, no random.only) is replaced by the fit's own X and Z.
design_rows <- function(fit, args, offset0) {
  q <- length(getME(fit, "u")); p <- length(fixef(fit))
  if (is.null(args$newdata) && is.null(args$re.form) && !isTRUE(args$random.only)) {
    return(list(V = cbind(as.matrix(getME(fit, "Z")), getME(fit, "X")), off = offset0))
  }
  theta0 <- ifelse(getME(fit, "lower") == 0, 1, 0)
  at <- function(u, beta) {
    obj <- lme4:::setParams(fit, list(theta = theta0, beta = beta))
    obj@pp$setDelu(u - obj@pp$u0)
    unname(do.call(predict, c(list(obj), args, list(allow.new.levels = TRUE, type = "link"))))
  }
  zero <- at(numeric(q), numeric(p))
  cols <- c(lapply(seq_len(q), function(k) at(as.numeric(seq_len(q) == k), numeric(p)) - zero),
            lapply(seq_len(p), function(j) at(numeric(q), as.numeric(seq_len(p) == j)) - zero))
  list(V = do.call(cbind, cols), off = zero)
}
