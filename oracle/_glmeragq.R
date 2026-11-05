# Adaptive Gauss-Hermite quadrature (nAGQ > 1) for the oracles glmeragqdev.R and glmeragq.R. Behaviour in
# oracle/glmer-behaviour.md ("Adaptive Gauss-Hermite quadrature"). This file takes the Laplace machinery of
# oracle/glmer.R (its functions and data; none of its cases is run) and replaces the deviance by the AGQ deviance
# when the model's nAGQ is above 1, so that glmer.R's search, Newton's method and fields work unchanged.

if (exists("DEBUG_ONE")) DEBUG_AGQ <- DEBUG_ONE
DEBUG_ONE <- integer(0)   # glmer.R defines everything and runs no case
source("/oracle/glmer.R")
rm(DEBUG_ONE)
if (exists("DEBUG_AGQ")) { DEBUG_ONE <- DEBUG_AGQ; rm(DEBUG_AGQ) }
cases <- list()

# The exact rule for the standard normal density with n points (mpfr): the nodes are the zeros of the
# probabilists' Hermite polynomial He_n (He_0 = 1, He_1 = x, He_(k+1) = x He_k - k He_(k-1)), found by Newton's
# method from lme4's nodes; the weights are the Christoffel numbers 1 / sum_(j < n) He_j(z)^2 / j! (they sum to 1)
he_all <- function(x, n) {   # He_0 .. He_n at x
  h <- list(x * 0 + 1, x)
  if (n >= 2) for (k in 2:n) h[[k + 1]] <- x * h[[k]] - (k - 1) * h[[k - 1]]
  h
}
exact_rule <- function(n) {
  z <- mp(GHrule(n)[, "z"])
  for (it in 1:40) {
    h <- he_all(z, n)
    st <- h[[n + 1]] / (n * h[[n]])   # He_n' = n He_(n-1)
    z <- z - st
    if (max(abs(asNumeric(st))) < 1e-31) break
  }
  if (it == 40) stop("the nodes did not converge")
  h <- he_all(z, n - 1)
  s <- z * 0; fact <- mp(1)
  for (j in 0:(n - 1)) { if (j > 0) fact <- fact * j; s <- s + h[[j + 1]]^2 / fact }
  w <- 1 / s
  if (abs(asNumeric(sum(w)) - 1) > 1e-25) stop("the weights do not sum to 1")
  if (n %% 2 == 1) z[(n + 1) / 2] <- mp(0)
  list(z = z, w = w, zd = asNumeric(z), wd = asNumeric(w))
}

prepare_laplace <- prepare
prepare <- function(a) {
  s <- prepare_laplace(a)
  if (s$nagq > 1L) {
    if (s$nth != 1L || s$q != length(s$zcols) || any(lengths(lapply(s$zcols, `[[`, "terms")) != 1L))
      stop("not a single scalar random-effects term")
    s$rule <- exact_rule(s$nagq)
  }
  s
}

# The quadrature term -2 sum_j log(sum_k w_k exp(-(Delta_jk - z_k^2) / 2)) at the conditional mode u (eta, the
# prior-weighted deviance residuals di and the working weights W at the mode); theta is the single element of
# theta. Returns the term and the conditional sd of each level, 1 / sqrt(1 + sum_(i in j) W_i (Z_ij theta)^2).
agq_term <- function(s, theta, u, eta, di, W, mpfr) {
  rule_z <- if (mpfr) s$rule$z else s$rule$zd
  rule_w <- if (mpfr) s$rule$w else s$rule$wd
  yv <- if (mpfr) mp(s$y) else s$y
  q <- s$q
  sd <- u * 0; lm <- u * 0
  for (j in seq_len(q)) {
    i <- s$zcols[[j]]$i
    zl <- s$zcols[[j]]$terms[[1]]$z * theta
    sd[j] <- 1 / sqrt(1 + sum(W[i] * zl^2))
    m <- 0
    for (k in seq_along(rule_z)) {
      zk <- rule_z[k]
      if (asNumeric(zk) == 0) { m <- m + rule_w[k]; next }
      t <- zk * sd[j]
      li <- linkinv(eta[i] + zl * t, s$link)
      if (mpfr) clamp_check(s, li)
      delta <- (u[j] + t)^2 - u[j]^2 + sum(devres(yv[i], li$mu, s$wt[i], s$family) - di[i])
      m <- m + rule_w[k] * exp(-(delta - zk^2) / 2)
    }
    lm[j] <- log(m)
  }
  list(quad = -2 * sum(lm), sd = sd)
}

# lme4's links clamp the means (oracle/glmer-behaviour.md, "Links and families"); the references use the links
# without clamps, so no clamp may be active at a node
clamp_check <- function(s, li) {
  mu <- asNumeric(li$mu); eps <- .Machine$double.eps
  if (s$family == "binomial" && (any(mu < 1e3 * eps) || any(1 - mu < 1e3 * eps))) stop("a clamp is active at a node")
  if (any(abs(asNumeric(li$d)) < 1e3 * eps) || (s$link == "log" && any(mu < 1e3 * eps))) stop("a clamp is active at a node")
}

# Double precision: the Laplace evaluation of glmer.R gives the exact conditional mode; the AGQ deviance is
# devResid + |u|^2 + ldL2 - 2 sum_j log(...) there (no aic term)
evaluate_d_laplace <- evaluate_d
evaluate_d <- function(s, theta, beta = NULL, v0 = NULL) {
  r <- evaluate_d_laplace(s, theta, beta, v0)
  if (s$nagq <= 1L) return(r)
  u <- r$v
  ZL <- s$Z * theta[1]
  eta <- s$off + as.vector(s$X %*% beta) + as.vector(ZL %*% u)
  li <- linkinv(eta, s$link)
  W <- s$wt * li$d^2 / variance(li$mu, s$family)
  di <- devres(s$y, li$mu, s$wt, s$family)
  ag <- agq_term(s, theta[1], u, eta, di, W, FALSE)
  list(dev = sum(di) + sum(u^2) - 2 * sum(log(ag$sd)) + ag$quad, v = u)
}

# mpfr: the same at the mpfr conditional mode of glmer.R
evaluate_mp_laplace <- evaluate_mp
evaluate_mp <- function(s, theta, beta = NULL, v0, full = FALSE) {
  if (s$nagq <= 1L) return(evaluate_mp_laplace(s, theta, beta, v0, full))
  ev <- evaluate_mp_laplace(s, theta, beta, v0, full = TRUE)
  ag <- agq_term(s, theta[1], ev$u, ev$eta, ev$di, ev$W, TRUE)
  ldL2 <- -2 * sum(log(ag$sd))
  dev <- sum(ev$di) + ev$ussq + ldL2 + ag$quad
  if (!full) return(dev)
  ev$dev <- dev; ev$ldL2 <- ldL2; ev$quad <- ag$quad; ev$condSd <- ag$sd
  ev
}
