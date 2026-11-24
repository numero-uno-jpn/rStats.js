# psm112-edge.R: edge cases and extreme scales of Match, bal.tab, CreateTableOne/ExtractSmd and clogit, public
# functions only (1.12.0): scales 1e+-300, a large common offset, single-member groups, separation, collinearity,
# uninformative strata and a large matched set. Output: JSON on stdout, 17 significant digits (x86_64 R).
library(jsonlite)
suppressPackageStartupMessages({ library(Matching); library(cobalt); library(tableone); library(survival) })
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  t0 <- proc.time()[["elapsed"]]
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  secs <- proc.time()[["elapsed"]] - t0
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs, secs = secs))
  list(value = value, warnings = warns, messages = msgs, secs = secs)
}
mres <- function(m) if (is.list(m)) list(t = m$index.treated, c = m$index.control, ecaliper = m$ecaliper,
                                         dropped = m$index.dropped, ndrops = m$ndrops) else list(notMatched = TRUE)
out <- list(R = R.version.string, arch = R.version$arch)
tr <- c(1, 0, 1, 0, 0, 1, 0, 0, 1, 0)
x <- c(0.31, -0.42, 1.25, 0.97, -1.6, 0.05, 0.28, -0.21, 0.66, 0.6)
## Match: scales and a large offset (the pairs should not change; ties could appear through rounding)
for (nm in c("base", "big", "tiny", "offset")) {
  X <- switch(nm, base = x, big = x * 1e300, tiny = x * 1e-300, offset = x + 1e15)
  out$match[[nm]] <- list(X = X,
    nocal = run({ set.seed(1); mres(Match(Tr = tr, X = X, ties = FALSE, replace = FALSE)) }),
    cal = run({ set.seed(1); mres(Match(Tr = tr, X = X, ties = FALSE, replace = FALSE, caliper = 0.5)) }))
}
out$match$oneTreated <- run({ set.seed(1); mres(Match(Tr = c(1, 0, 0), X = c(0, 1, 2), ties = FALSE, replace = FALSE)) })
out$match$allEqualX <- run({ set.seed(1); mres(Match(Tr = c(1, 0, 1, 0), X = c(2, 2, 2, 2), ties = FALSE,
                                                     replace = FALSE, caliper = 0.2)) })
out$match$infX <- run({ set.seed(1); mres(Match(Tr = c(1, 0, 1, 0), X = c(1, Inf, 2, 3), ties = FALSE, replace = FALSE)) })
## bal.tab: the covariate at extreme scales and with an offset, on the base match
set.seed(1); m <- Match(Tr = tr, X = x, ties = FALSE, replace = FALSE)
bal <- function(v) { b <- bal.tab(m, formula = tr ~ v, data = data.frame(tr = tr, v = v), un = TRUE, disp.v.ratio = TRUE)
  list(diffUn = b$Balance$Diff.Un, diffAdj = b$Balance$Diff.Adj, vUn = b$Balance$V.Ratio.Un, vAdj = b$Balance$V.Ratio.Adj) }
age <- c(52, 40, 61, 58, 33, 47, 50, 45, 39, 55)
out$baltab <- list(base = run(bal(age)), big = run(bal(age * 1e300)), tiny = run(bal(age * 1e-300)),
                   offset = run(bal(age + 1e15)), constant = run(bal(rep(3, 10))))
## tableone: one member per group, extreme scales, offset, a factor level absent from one group
smd <- function(d, fv = NULL) as.vector(ExtractSmd(if (is.null(fv)) CreateTableOne(vars = "v", strata = "g", data = d, test = FALSE)
                                                   else CreateTableOne(vars = "v", strata = "g", data = d, factorVars = fv, test = FALSE)))
g <- c(0, 0, 0, 0, 1, 1, 1, 1); v <- c(1, 2, 4, 3, 5, 4, 6, 7)
out$tableone <- list(
  onePerGroup = run(smd(data.frame(g = c(0, 1), v = c(1, 2)))),
  big = run(smd(data.frame(g = g, v = v * 1e300))), tiny = run(smd(data.frame(g = g, v = v * 1e-300))),
  offset = run(smd(data.frame(g = g, v = v + 1e15))),
  factorAbsent = run(smd(data.frame(g = g, v = c("a", "a", "b", "a", "c", "c", "c", "c")), "v")),
  factorOneLevelEach = run(smd(data.frame(g = g, v = c("a", "a", "a", "a", "b", "b", "b", "b")), "v")))
## clogit: separation, collinearity, only uninformative strata, a large matched set, extreme covariate scales
cl <- function(f, d, method = "exact") { fit <- clogit(f, data = d, method = method)
  list(coef = unname(coef(fit)), var = as.vector(fit$var), loglik = fit$loglik, iter = fit$iter) }
pairs <- data.frame(s = rep(1:6, each = 2), y = rep(c(1, 0), 6), x = c(1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0),
                    z = c(0.3, 0.1, 0.5, 0.9, 0.2, 0.4, 0.8, 0.6, 0.1, 0.7, 0.4, 0.2))
pairs$z2 <- 2 * pairs$z
for (meth in c("exact", "approximate")) {
  out$clogit[[meth]] <- list(
    separation = run(cl(y ~ x + strata(s), pairs, meth)),
    collinear = run(cl(y ~ z + z2 + strata(s), pairs, meth)),
    uninformative = run(cl(y ~ z + strata(s), data.frame(s = c(1, 1, 2, 2), y = c(1, 1, 0, 0), z = c(1, 2, 3, 4)), meth)),
    bigScale = run(cl(y ~ z + strata(s), transform(pairs, z = z * 1e150), meth)),
    tinyScale = run(cl(y ~ z + strata(s), transform(pairs, z = z * 1e-150), meth)),
    offset = run(cl(y ~ z + strata(s), transform(pairs, z = z + 1e12), meth)))
}
set.seed(5); big <- data.frame(s = 1, y = rep(c(1, 0), c(150, 150)), z = round(rnorm(300), 3))
big$z <- big$z + 0.4 * big$y
out$clogit$largeSet <- run(cl(y ~ z + strata(s), big, "exact"))
out$clogit$largeSetData <- list(z = big$z, y = big$y)
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "string"), "\n")
