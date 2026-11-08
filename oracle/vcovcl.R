source("/oracle/_robust.R")

# Clustered covariance matrices: sandwich::vcovCL(fit, cluster, type, sandwich, fix, cadjust, multi0) for lm and glm
# fits (fixture vcovCL). Behaviour in oracle/robust-behaviour.md. Model arguments as in oracle/_robust.R, and:
#   cluster        one-way: a vector (numbers or strings, NA for a missing label); multi-way: an array of such vectors,
#                  one per dimension (columns). Absent: every observation is its own cluster (R's default)
#   clusterLevels  the cluster is a factor with these levels (unused levels included)
#   type           "HC0", "HC1", "HC2", "HC3" (and "HC", R's alias of HC0); absent: R's default (HC1 for lm, HC0 for
#                  glm); others: R's error
#   cadjust, multi0, fix, sandwich   as in vcovCL (defaults TRUE, FALSE, FALSE, TRUE)
#   refKind        present when the case has a "reference" (what rStats.js may return instead of R's value):
#                  "subset"   the fit has rows of prior weight 0; reference = vcovCL of the model fitted without them
#                  "natural"  HC2/HC3 of a weighted lm or of a glm with clusters of more than one observation; reference =
#                             the same with the symmetric adjustment (I - Hs_gg)^(-1/2) or ^(-1) of the rows scaled by
#                             sqrt(working weight) (robust-behaviour.md, section 2.4); for lm and HC3 it is the
#                             leave-one-cluster-out jackknife sum of (b_-g - b)(b_-g - b)', also
#                             written (jackknife; only with cadjust = TRUE, where the two agree)
# Written: vcov (rows), names (the dimnames), warnings (of vcovCL), fitWarnings (of the fit). Errors as {"error": message}.

set.seed(20261110)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))

# 12 clusters of 2 to 8 observations; a second dimension (6 periods) crossing them
sizes <- c(2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 8)
G <- length(sizes); n <- sum(sizes)
g <- rep(seq_len(G), sizes)
tm <- unlist(lapply(sizes, function(s) sample(1:6, s, replace = s > 6)))
u <- rnorm(G)[g]
X <- cbind(rnorm(n) + 0.7 * u, runif(n, -1, 1))
yl <- drop(1 + X %*% c(1, -0.5) + u + rnorm(n))
wl <- round(runif(n, 0.3, 3), 3)
ypois <- rpois(n, exp(0.3 + 0.4 * X[, 1] + 0.3 * u))
ybin <- rbinom(n, 1, plogis(-0.2 + 0.6 * X[, 1] + 0.5 * u))
ygam <- rgamma(n, 3, 3 / exp(1 + 0.3 * X[, 1] + 0.2 * u))
wipw <- round(1 / runif(n, 0.15, 0.85), 4)
M <- list(
  lm = list(model = "lm", x = X, y = I(yl)),
  lmw = list(model = "lm", x = X, y = I(yl), weights = I(wl)),
  lmalias = list(model = "lm", x = cbind(X, X[, 1] + X[, 2]), y = I(yl)),
  pois = list(model = "glm", x = X, y = I(ypois), family = "poisson"),
  bin = list(model = "glm", x = X, y = I(ybin), family = "binomial"),
  qbw = list(model = "glm", x = X, y = I(ybin), family = "quasibinomial", weights = I(wipw)),
  gam = list(model = "glm", x = X, y = I(ygam), family = "Gamma", link = "log"))
addm <- function(m, ...) do.call(add, c(M[[m]], list(...)))
natural <- function(m, t) (m != "lm" && m != "lmalias") && t %in% c("HC2", "HC3")

# one-way: every type, with and without cadjust
for (m in names(M)) for (t in c("HC0", "HC1", "HC2", "HC3")) for (ca in c(TRUE, FALSE))
  addm(m, cluster = I(g), type = t, cadjust = ca, refKind = if (natural(m, t)) "natural")
for (m in names(M)) addm(m, cluster = I(g))                                  # default type
for (m in c("lm", "pois")) {
  addm(m)                                                                    # no cluster: each observation its own
  for (t in c("HC0", "HC1", "HC2", "HC3")) addm(m, cluster = I(seq_len(n)), type = t)   # clusters of size one
  addm(m, cluster = I(g), sandwich = FALSE)
  addm(m, cluster = I(g), type = "HC3", sandwich = FALSE)
}
addm("lm", cluster = I(g), type = "HC")
addm("lm", cluster = I(g), type = "HC4")                                     # not accepted: R's error
addm("lm", cluster = I(g), type = "const")
addm("lm", cluster = I(letters[g]))                                          # string labels
addm("lm", cluster = I(g), clusterLevels = I(1:15))                          # a factor with unused levels
addm("lm", cluster = I(rep(1, n)))                                           # a single cluster: R's error
addm("lm", cluster = I(rep(1, n)), cadjust = FALSE)
gna <- g; gna[5] <- NA
addm("lm", cluster = I(gna))                                                 # a missing label: R's error
addm("lm", cluster = I(g[-1]))                                               # wrong length: R's error
# a missing response: the fit drops row 9 and vcovCL drops the same row of the full-length cluster
yna <- yl; yna[9] <- NA
add(model = "lm", x = X, y = I(yna), cluster = I(g))
add(model = "lm", x = X, y = I(yna), cluster = I(g), type = "HC3")
# rows of prior weight 0
w0 <- wl; w0[c(4, 20, 37)] <- 0
for (t in c("HC0", "HC1", "HC3")) add(model = "lm", x = X, y = I(yl), weights = I(w0), cluster = I(g), type = t, refKind = "subset")
add(model = "glm", x = X, y = I(ypois), family = "poisson", weights = I(ifelse(w0 == 0, 0, 1)), cluster = I(g), refKind = "subset")

# multi-way
for (m in c("lm", "lmw", "pois", "qbw")) for (t in c("HC0", "HC1")) for (m0 in c(FALSE, TRUE)) for (ca in c(TRUE, FALSE))
  addm(m, cluster = list(g, tm), type = t, multi0 = m0, cadjust = ca)
for (t in c("HC2", "HC3")) addm("lm", cluster = list(g, tm), type = t)
addm("lm", cluster = list(g, tm, rep(1:3, length.out = n)))                 # three-way
addm("lm", cluster = list(g, tm, rep(1:3, length.out = n)), multi0 = TRUE)
addm("pois", cluster = list(g, tm), fix = TRUE)
# labels joined with "_": ("a_b", "c") and ("a", "b_c") become the same intersection cluster "a_b_c"
add(model = "lm", x = X[1:40, ], y = I(yl[1:40]), cluster = list(rep(c("a_b", "a", "d", "e"), 10), rep(c("c", "b_c", "c", "f", "g"), 8)))
# a two-way case whose matrix has a negative eigenvalue (found by search), with and without fix
neg <- NULL
for (s in 1:500) {
  set.seed(s); yy <- rnorm(n); xx <- rnorm(n)
  V <- vcovCL(lm(yy ~ xx), cluster = data.frame(g, tm), type = "HC0", cadjust = FALSE)
  if (any(eigen(V, symmetric = TRUE)$values < 0)) { neg <- list(x = cbind(xx), y = yy); break }
}
for (fx in c(FALSE, TRUE)) {
  add(model = "lm", x = neg$x, y = I(neg$y), cluster = list(g, tm), type = "HC0", cadjust = FALSE, fix = fx)
  add(model = "lm", x = neg$x, y = I(neg$y), cluster = list(g, tm), type = "HC0", cadjust = FALSE, fix = fx, sandwich = FALSE)
}
set.seed(20261111)

# ---- realistic uses
# modified Poisson regression for a risk ratio (Zou 2004), clustered by matched set (infert's stratum)
ix <- cbind(infert$spontaneous, infert$induced, infert$age)
for (t in c("HC0", "HC1")) add(model = "glm", x = ix, y = I(infert$case), family = "poisson", cluster = I(infert$stratum), type = t)
# difference in differences: 30 units (15 treated) over 8 periods, treatment from period 5; unit effects and a common
# trend with autocorrelated errors. y ~ treated + post + treated:post, clustered by unit, and by unit and period
nu <- 30; np <- 8
unit <- rep(seq_len(nu), each = np); period <- rep(seq_len(np), nu)
treated <- as.numeric(unit <= 15); post <- as.numeric(period >= 5)
e <- unlist(lapply(seq_len(nu), function(i) as.numeric(arima.sim(list(ar = 0.6), np))))
ydid <- round(2 + rnorm(nu)[unit] + 0.3 * period + 0.8 * treated * post + e, 4)
xdid <- cbind(treated, post, treated * post)
add(model = "lm", x = xdid, y = I(ydid), cluster = I(unit))
add(model = "lm", x = xdid, y = I(ydid), cluster = I(unit), type = "HC0")
add(model = "lm", x = xdid, y = I(ydid), cluster = list(unit, period))
add(model = "lm", x = xdid, y = I(ydid), cluster = list(unit, period), multi0 = TRUE)
add(model = "lm", x = xdid, y = I(ydid), cluster = I(unit), type = "HC2")
add(model = "lm", x = xdid, y = I(ydid), cluster = I(unit), type = "HC3")
# two-way fixed effects (unit and period dummies): the unit dummies make each cluster's block I - H_gg singular, so HC2
# gives NaN and HC3 solves a numerically singular system (R returns meaningless numbers here; with other data R's
# error "system is computationally singular: reciprocal condition number = ...")
xfe <- cbind(treated * post, model.matrix(~ factor(unit) + factor(period))[, -1])
add(model = "lm", x = xfe, y = I(ydid), cluster = I(unit))
add(model = "lm", x = xfe, y = I(ydid), cluster = list(unit, period))
add(model = "lm", x = xfe, y = I(ydid), cluster = I(unit), type = "HC2")
add(model = "lm", x = xfe, y = I(ydid), cluster = I(unit), type = "HC3")

# ---- references
ref <- function(a) {
  if (is.null(a$refKind)) return(NULL)
  t <- a$type %||% (if (a$model == "lm") "HC1" else "HC0")
  if (a$refKind == "subset") {
    keep <- unclass(a$weights) > 0
    b <- a; b$x <- a$x[keep, , drop = FALSE]; b$y <- I(unclass(a$y)[keep]); b$weights <- I(unclass(a$weights)[keep])
    return(list(vcov = mat_out(vcovCL(robust_fit(b), cluster = unclass(a$cluster)[keep], type = t))))
  }
  fit <- robust_fit(a)
  out <- list(vcov = mat_out(natural_cl(fit, unclass(a$cluster), t, cadjust = a$cadjust %||% TRUE)))
  if (a$model == "lm" && t == "HC3" && isTRUE(a$cadjust %||% TRUE)) {
    b0 <- coef(fit); S <- 0
    for (j in unique(unclass(a$cluster))) {
      keep <- unclass(a$cluster) != j
      b <- a; b$x <- a$x[keep, , drop = FALSE]; b$y <- I(unclass(a$y)[keep]); b$weights <- I(unclass(a$weights)[keep])
      S <- S + tcrossprod(coef(robust_fit(b)) - b0)
    }
    out$jackknife <- mat_out(S)
  }
  out
}

write_htest_fixture("vcovCL", cases, function(a) {
  f <- fit_with_warnings(a)
  args <- list(f$value, cluster = cluster_arg(a))
  for (nm in c("type", "cadjust", "multi0", "fix", "sandwich")) if (!is.null(a[[nm]])) args[[nm]] <- a[[nm]]
  r <- with_warnings(function() do.call(vcovCL, args))
  c(vc_out(r$value), list(warnings = r$warnings, fitWarnings = f$warnings))
}, ref = ref)
