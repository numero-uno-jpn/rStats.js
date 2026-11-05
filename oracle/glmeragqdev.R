source("/oracle/_glmeragq.R")

# The adaptive Gauss-Hermite quadrature (AGQ) deviance of a generalised linear mixed model with one scalar
# random-effects term at given parameters: the function lme4's glmer minimises when nAGQ > 1 (fixture
# glmerAgqDeviance). Behaviour in oracle/glmer-behaviour.md ("Adaptive Gauss-Hermite quadrature"). Each case has
#   formula, data   as in the fixture glmerDeviance (one scalar random-effects term)
#   family, link    the glm family and its link
#   weights, offset optional, one value per row of data
#   nAGQ            the number of quadrature points (2 to 100)
#   theta, beta     the covariance parameter (one) and the fixed effects
# Written (expected: lme4's values, from the deviance function glmer builds: glFormula, mkGlmerDevfun(nAGQ = 0)
# (its initial PIRLS at theta = 1), then updateGlmerDevfun(nAGQ), as oracle/glmerdev.R does for nAGQ = 1):
#   deviance        the value of the deviance function: devResid + ussq + ldL2 + quad (no aic term)
#   u, b, mu        the conditional modes of the spherical random effects, b = theta u, the conditional means
#   devResid, ussq  the sum of the deviance residuals at mu (prior weights included) and |u|^2
#   ldL2            log det(Lambda' Z' W Z Lambda + I) (lme4: W of its last PIRLS iteration)
#   quad            the quadrature term -2 sum_j log(sum_k w_k exp(-(Delta_jk - z_k^2) / 2)) (deviance minus the
#                   other four)
#   nodes, weights  the rule: lme4's GHrule(nAGQ) (z and w)
# reference: the same at the exact conditional mode with the exact rule, in 110-bit arithmetic (Rmpfr): the mode by
#   Newton's method as in oracle/glmer.R (accurate to about 1e-30), the nodes (zeros of the Hermite polynomial
#   He_nAGQ) by Newton's method and the weights by the Christoffel formula (oracle/_glmeragq.R), plus condSd, the
#   conditional standard deviation of each level 1 / sqrt(1 + sum_(i in level) W_i (Z_ij theta)^2) by which the
#   nodes are scaled (W at the mode). lme4's GHrule differs from the exact rule by up to 1.6e-14 in the nodes and
#   1.5e-13 (relative) in the weights (nAGQ = 100); its deviance differs from the reference by up to about 1e-7
#   (relative) because of its PIRLS (oracle/glmer-behaviour.md, "Accuracy"); the oracle stops if more than 1e-5.

build <- function(a) {
  la <- lme4_args(a)
  glmod <- suppressWarnings(do.call(glFormula, c(list(formula = as.formula(a$formula), data = la$dat,
                                                      family = la$fam), la$extra)))
  glmod$formula <- NULL
  devf <- suppressWarnings(do.call(mkGlmerDevfun, c(glmod, list(nAGQ = 0L, control = glmerControl()))))
  updateGlmerDevfun(devf, glmod$reTrms, nAGQ = as.integer(a$nAGQ))
}
par_of <- function(a) c(as.numeric(a$theta), as.numeric(a$beta))
nv <- function(v) I(num2str(as.numeric(v)))

expected <- function(a) {
  devf <- build(a); e <- environment(devf)
  dev <- suppressWarnings(devf(par_of(a)))
  pp <- e$pp; resp <- e$resp
  dr <- resp$resDev(); ussq <- pp$sqrL(1); ldL2 <- pp$ldL2()
  g <- GHrule(as.integer(a$nAGQ))
  list(deviance = num2str(dev), u = nv(pp$u(1)), b = nv(pp$b(1)), mu = nv(resp$mu), devResid = num2str(dr),
       ussq = num2str(ussq), ldL2 = num2str(ldL2), quad = num2str(dev - dr - ussq - ldL2),
       nodes = nv(g[, "z"]), weights = nv(g[, "w"]))
}

reference <- function(a) {
  s <- prepare(a)
  theta <- as.numeric(a$theta); beta <- as.numeric(a$beta)
  v0 <- evaluate_d(s, theta, beta)$v
  ev <- evaluate_mp(s, mp(theta), mp(beta), v0, full = TRUE)
  dev <- asNumeric(ev$dev)
  dl <- suppressWarnings(build(a)(par_of(a)))
  message(sprintf("%-42s %-22s nAGQ %3s: deviance %.12g, lme4 %+.1e (relative), quad %.6g", a$formula,
                  paste(a$family, a$link), a$nAGQ, dev, (dl - dev) / dev, asNumeric(ev$quad)))
  if (abs(dl - dev) > 1e-5 * abs(dev)) stop("lme4's deviance is far from the reference")
  list(deviance = num2str(dev), u = nn(ev$u), b = nn(ev$b), mu = nn(ev$mu), devResid = num2str(asNumeric(sum(ev$di))),
       ussq = num2str(asNumeric(ev$ussq)), ldL2 = num2str(asNumeric(ev$ldL2)), quad = num2str(asNumeric(ev$quad)),
       nodes = nn(s$rule$z), weights = nn(s$rule$w), condSd = nn(ev$condSd))
}

# ---- cases (the data of oracle/glmer.R) ----
add <- function(formula, data, family, link, nAGQ, theta, beta, weights = NULL, offset = NULL) {
  a <- list(formula = formula, data = data, family = family, link = link)
  if (!is.null(weights)) a$weights <- I(num2str(weights))
  if (!is.null(offset)) a$offset <- I(num2str(offset))
  a$nAGQ <- as.character(nAGQ); a$theta <- I(num2str(theta)); a$beta <- I(num2str(beta))
  cases[[length(cases) + 1]] <<- a
}
bcb <- c(-1.399, -0.992, -1.128, -1.580)
# binomial, cbpp: the same parameters with the numbers of points 2, 3, 5, 9, 25 and 100 (the largest allowed), far
# from the optimum, the proportion with weights, probit
for (k in c(2, 3, 5, 9, 25, 100)) add(cbf, cb, "binomial", "logit", k, 0.647, bcb)
add(cbf, cb, "binomial", "logit", 4, 1.8, c(-0.5, -1.5, -1, -2))
add("prop ~ period + (1 | herd)", cb, "binomial", "logit", 9, 0.647, bcb, weights = cb$size)
add(cbf, cb, "binomial", "probit", 9, 0.37, c(-0.82, -0.58, -0.66, -0.92))
# binomial 0/1: far from the optimum, theta = 0 (the quadrature term is 0), cloglog, a scalar slope term
# (0 + x | g), a missing value, a factor response (written as strings)
add("y ~ x + (1 | g)", dbin, "binomial", "logit", 3, 2, c(0.1, -0.2))
add("y ~ x + (1 | g)", dbin, "binomial", "logit", 5, 0, c(0, 0.1))
add("y ~ x + (1 | g)", dbin, "binomial", "cloglog", 4, 0.53, c(-0.4, -0.03))
add("y ~ x + (0 + x | g)", dbin, "binomial", "logit", 6, 0.8, c(0, 0.1))
add("y ~ x + (1 | g)", dbna, "binomial", "logit", 7, 0.76, c(0.05, -0.09))
add("yn ~ x + (1 | g)", dbin, "binomial", "logit", 2, 0.72, c(0.005, 0.009))
# poisson: an offset, prior weights, the sqrt link
add("yt ~ x + (1 | g)", dpo, "poisson", "log", 5, 0.83, c(0.244, 0.504), offset = log(dpo$t))
add("y ~ x + (1 | g)", dpo, "poisson", "log", 3, 0.52, c(0.233, 0.299), weights = dpo$w)
add("y ~ x + (1 | g)", dpo, "poisson", "sqrt", 9, 0.335, c(1.13, 0.258))
# families with a dispersion (which the AGQ deviance does not have): Gamma, inverse.gaussian, gaussian (log)
add("y ~ x + (1 | g)", dgm, "Gamma", "log", 5, 0.3, c(1.32, 0.32))
add("y ~ x + (1 | g)", dgm, "Gamma", "log", 25, 0.65, c(1.22, 0.35))
add("y ~ x + (1 | g)", dgm, "Gamma", "log", 3, 0.6, c(1.2, 0.35), weights = dgm$w)
add("yi ~ x + (1 | g)", dgm, "inverse.gaussian", "log", 3, 0.5, c(1.3, 0.46))
add("yg ~ x + (1 | g)", dgm, "gaussian", "log", 9, 0.4, c(1.24, 0.4))

if (exists("DEBUG_ONE")) {
  for (i in DEBUG_ONE) { a <- cases[[i]]; print(system.time(r <- reference(a))); str(expected(a)[c("deviance", "ldL2", "quad")]); str(r[c("deviance", "ldL2", "quad")]) }
} else write_anova_fixture("glmerAgqDeviance", cases, expected, reference)
