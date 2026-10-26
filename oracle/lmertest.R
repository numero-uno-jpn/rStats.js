DEBUG_ONE <- TRUE
source("/oracle/lmer.R")   # prepare, pls, optimum and the 128-bit helpers (DEBUG_ONE: lmer.R writes nothing)
rm(DEBUG_ONE)
suppressPackageStartupMessages(library(lmerTest))

# lmerTest 3.2.1: Satterthwaite's t- and F-tests for lmer fits (fixture lmerTest). Behaviour in
# oracle/lmertest-behaviour.md. Each case has
#   formula, data, REML, contrasts, levels   as in the fixture lmer
#   contests   (optional) a list of {L: a vector or a matrix (one array per row), rhs, joint, confint, level}
# Written (R: lmerTest::lmer with the default control, then its methods):
#   summary    the coefficient table of summary(fit): names, estimate, stdError, df, tValue, pValue
#   varpar     getVarPar: theta and sigma; vcovVarpar  fit@vcov_varpar (one array per row)
#   contests   one result per entry of `contests`: rows of {estimate, stdError, df, tValue, pValue, lower, upper}
#              (1D tests) or {sumSq, meanSq, numDF, denDF, F, pValue} (joint tests)
#   anova      for type "I", "II", "III": the table (terms, sumSq, meanSq, numDF, denDF, F, pValue) and the
#              hypothesis matrices (attr "hypotheses"): one {term, rows, columns, values (one array per row)} per term
#   messages, warnings  R's messages and warnings (of the fit, the coercion and every method)
# reference: the same numbers at the exact optimum of the criterion (theta from oracle/lmer.R's optimum(), sigma
#   from the penalised residual sum of squares), with the Hessian of the deviance in (theta, sigma) by central
#   differences in 128-bit arithmetic (step 1e-10) and the Jacobian of vcov(beta) by central differences (step
#   1e-15). The hypothesis matrices are lmerTest's (they depend only on the model matrix). Also written:
#   hessian (one array per row) and hessianEigenvalues.

twopi <- 2 * Const("pi", BITS)
dev_vp <- function(s, vp, reml) {
  m <- length(vp); r <- pls(s, vp[-m]); sg2 <- vp[m]^2; n <- s$n; p <- s$p
  ldL <- r$devML - n * (1 + log(twopi * r$prss / n))
  d <- ldL + r$prss / sg2 + n * log(twopi * sg2)
  if (!reml) return(d)
  ldRX <- r$devREML - ldL - (n - p) * (1 + log(twopi * r$prss / (n - p)))
  d + ldRX - p * log(twopi * sg2)
}
covbeta_vp <- function(s, vp) { m <- length(vp); r <- pls(s, vp[-m]); vp[m]^2 * mp_inverse_spd(r$RX) }

satterthwaite_at <- function(s, theta, reml) {
  r <- pls(s, theta); n <- s$n; p <- s$p
  sigma <- sqrt(r$prss / (if (reml) n - p else n))
  vp <- c(theta, sigma); m <- length(vp)
  h <- mp(1e-10); H <- mpfrArray(0, BITS, dim = c(m, m))
  ev <- function(k, l, sk, sl) { v <- vp; v[k] <- v[k] + sk * h; v[l] <- v[l] + sl * h; dev_vp(s, v, reml) }
  for (k in seq_len(m)) for (l in k:m)
    H[k, l] <- H[l, k] <- (ev(k, l, 1, 1) - ev(k, l, 1, -1) - ev(k, l, -1, 1) + ev(k, l, -1, -1)) / (4 * h^2)
  hJ <- mp(1e-15)
  J <- lapply(seq_len(m), function(k) {
    a <- vp; a[k] <- a[k] + hJ; b <- vp; b[k] <- b[k] - hJ
    (covbeta_vp(s, a) - covbeta_vp(s, b)) / (2 * hJ)
  })
  Hd <- asNumeric(H); e <- eigen(Hd, symmetric = TRUE)
  A <- if (all(e$values > 1e-8)) 2 * mp_inverse_spd(mp_chol(H)) else {
    pos <- e$values > 1e-8
    mpm(2 * e$vectors[, pos, drop = FALSE] %*% diag(1 / e$values[pos], nrow = sum(pos)) %*% t(e$vectors[, pos, drop = FALSE]))
  }
  list(beta = r$beta, V = sigma^2 * mp_inverse_spd(r$RX), J = J, A = A, H = H, eig = e$values, sigma = sigma, vp = vp)
}
qf_mp <- function(x, M) sum(x * as.vector(M %*% colv(x)))
ddf_1d <- function(S, L) {
  L <- mp(L); v <- qf_mp(L, S$V)
  g <- mp(numeric(length(S$J))); for (k in seq_along(S$J)) g[k] <- qf_mp(L, S$J[[k]])
  list(var = v, df = 2 * v^2 / qf_mp(g, S$A))
}
t_row <- function(S, L, rhs = 0, confint = FALSE, level = 0.95) {
  est <- sum(mp(L) * S$beta); d <- ddf_1d(S, L)
  se <- sqrt(d$var); t <- (est - rhs) / se
  tn <- asNumeric(t); dfn <- asNumeric(d$df)
  out <- list(estimate = asNumeric(est), stdError = asNumeric(se), df = dfn, tValue = tn,
              pValue = 2 * pt(abs(tn), dfn, lower.tail = FALSE))
  if (confint) { f <- qt((1 - level) / 2, dfn, lower.tail = FALSE); out$lower <- asNumeric(est - se * f); out$upper <- asNumeric(est + se * f) }
  out
}
fstat_ddf <- function(nu) {
  if (length(nu) == 1L) return(nu)
  if (all(abs(diff(nu)) < 1e-8)) return(mean(nu))
  if (any(nu <= 2)) return(2)
  E <- sum(nu / (nu - 2)); 2 * E / (E - length(nu))
}
f_row <- function(S, L, rhs = 0) {
  if (!is.matrix(L)) L <- matrix(L, nrow = 1)
  if (nrow(L) == 0) return(NULL)
  mk <- function(Fv, ndf, ddf) list(sumSq = Fv * asNumeric(S$sigma)^2 * ndf, meanSq = Fv * asNumeric(S$sigma)^2,
                                     numDF = ndf, denDF = ddf, F = Fv, pValue = pf(Fv, ndf, ddf, lower.tail = FALSE))
  if (nrow(L) == 1) { r <- t_row(S, L[1, ], rhs); return(mk(r$tValue^2, 1, r$df)) }
  Lm <- mpm(L); VL <- Lm %*% S$V %*% t(Lm)
  e <- eigen(asNumeric(VL), symmetric = TRUE); d <- e$values
  pos <- d > max(sqrt(.Machine$double.eps) * d[1], 0); q <- sum(pos)
  if (q == 0) return(NULL)
  PtL <- t(e$vectors[, seq_len(q), drop = FALSE]) %*% L      # double: the rotation from lmerTest's eigen
  if (q == 1) { r <- t_row(S, PtL[1, ], rhs); return(mk(r$tValue^2, 1, r$df)) }
  beta <- S$beta
  if (!all(rhs == 0)) stop("rhs != 0 with several rows: not in this fixture")
  dm <- mp(numeric(q)); t2 <- mp(numeric(q)); nu <- numeric(q)
  for (i in seq_len(q)) {
    Li <- mp(PtL[i, ]); dm[i] <- qf_mp(Li, S$V); t2[i] <- sum(Li * beta)^2 / dm[i]
    nu[i] <- asNumeric(ddf_1d(S, PtL[i, ])$df)
  }
  mk(asNumeric(sum(t2) / q), q, fstat_ddf(nu))
}

rows_out <- function(rows) {
  if (is.null(rows) || !length(rows)) return(list())
  nms <- names(rows[[1]])
  setNames(lapply(nms, function(k) I(num2str(vapply(rows, function(r) r[[k]], numeric(1))))), nms)
}
contest_rows <- function(spec, one, multi) {
  L <- spec$L; if (is.list(L)) L <- do.call(rbind, lapply(L, unlist)) else L <- unlist(L)
  rhs <- spec$rhs %||% 0
  if (isFALSE(spec$joint)) {
    if (!is.matrix(L)) L <- matrix(L, nrow = 1)
    rows_out(lapply(seq_len(nrow(L)), function(i) one(L[i, ], rhs, !isFALSE(spec$confint), spec$level %||% 0.95)))
  } else rows_out(list(multi(L, rhs)))
}
hyp_out <- function(Ll) lapply(names(Ll), function(tm) {
  M <- Ll[[tm]]
  list(term = tm, rows = I(rownames(M) %||% character(0)), columns = I(colnames(M)),
       values = lapply(seq_len(nrow(M)), function(i) I(num2str(unname(M[i, ])))))
})

fit_lmertest <- function(a, s, w, msg) withCallingHandlers(
  lmerTest::lmer(as.formula(a$formula), s$dat, REML = isTRUE(a$REML), contrasts = s$ctr),
  warning = function(cnd) { w(conditionMessage(cnd)); invokeRestart("muffleWarning") },
  message = function(cnd) { msg(sub("\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") })

expected <- function(a) {
  s <- prepare(a)
  ws <- character(0); ms <- character(0)
  W <- function(x) ws <<- c(ws, x); M <- function(x) ms <<- c(ms, x)
  quiet <- function(expr) withCallingHandlers(expr,
    warning = function(cnd) { W(conditionMessage(cnd)); invokeRestart("muffleWarning") },
    message = function(cnd) { M(sub("\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") })
  fit <- fit_lmertest(a, s, W, M)
  co <- quiet(summary(fit))$coefficients
  out <- list(summary = list(names = I(rownames(co)), estimate = I(num2str(unname(co[, 1]))), stdError = I(num2str(unname(co[, 2]))),
                             df = I(num2str(unname(co[, 3]))), tValue = I(num2str(unname(co[, 4]))), pValue = I(num2str(unname(co[, 5])))),
              varpar = I(num2str(lmerTest:::getVarPar(fit))),
              vcovVarpar = lapply(seq_len(nrow(fit@vcov_varpar)), function(i) I(num2str(fit@vcov_varpar[i, ]))))
  if (length(a$contests)) out$contests <- lapply(a$contests, function(spec) {
    L <- spec$L; L <- if (is.list(L)) do.call(rbind, lapply(L, unlist)) else unlist(L)
    r <- quiet(contest(fit, L, rhs = spec$rhs %||% 0, joint = !isFALSE(spec$joint), confint = !isFALSE(spec$confint),
                       level = spec$level %||% 0.95))
    pick <- if (!isFALSE(spec$joint)) c(sumSq = "Sum Sq", meanSq = "Mean Sq", numDF = "NumDF", denDF = "DenDF", F = "F value", pValue = "Pr(>F)")
            else c(estimate = "Estimate", stdError = "Std. Error", df = "df", tValue = "t value", pValue = "Pr(>|t|)", lower = "lower", upper = "upper")
    pick <- pick[pick %in% colnames(r)]
    setNames(lapply(pick, function(k) I(num2str(unname(r[[k]])))), names(pick))
  })
  out$anova <- lapply(c("III", "II", "I"), function(ty) {
    tab <- quiet(anova(fit, type = ty))
    list(type = ty, terms = I(rownames(tab)), sumSq = I(num2str(tab[["Sum Sq"]])), meanSq = I(num2str(tab[["Mean Sq"]])),
         numDF = I(num2str(tab[["NumDF"]])), denDF = I(num2str(tab[["DenDF"]])), F = I(num2str(tab[["F value"]])),
         pValue = I(num2str(tab[["Pr(>F)"]])), hypotheses = hyp_out(attr(tab, "hypotheses")))
  })
  out$messages <- I(unique(ms)); out$warnings <- I(unique(ws))
  out
}

reference <- function(a) {
  s <- prepare(a)
  fit <- suppressMessages(suppressWarnings(lmerTest::lmer(as.formula(a$formula), s$dat, REML = isTRUE(a$REML), contrasts = s$ctr)))
  opt <- optimum(s, unname(getME(fit, "theta")), isTRUE(a$REML))
  S <- satterthwaite_at(s, opt$theta, isTRUE(a$REML))
  p <- s$p
  one <- function(L, rhs = 0, confint = FALSE, level = 0.95) t_row(S, L, rhs, confint, level)
  co <- lapply(seq_len(p), function(i) one(as.numeric(seq_len(p) == i)))
  out <- list(summary = rows_out(co)[c("estimate", "stdError", "df", "tValue", "pValue")],
              varpar = I(num2str(asNumeric(S$vp))),
              vcovVarpar = lapply(seq_len(nrow(S$A)), function(i) I(num2str(asNumeric(S$A[i, ])))),
              hessian = lapply(seq_len(nrow(S$H)), function(i) I(num2str(asNumeric(S$H[i, ])))),
              hessianEigenvalues = I(num2str(S$eig)))
  if (length(a$contests)) out$contests <- lapply(a$contests, function(spec) contest_rows(spec, one, function(L, rhs) f_row(S, L, rhs)))
  out$anova <- lapply(c("III", "II", "I"), function(ty) {
    hyp <- attr(suppressMessages(anova(fit, type = ty)), "hypotheses")
    rows <- lapply(hyp, function(L) f_row(S, L))
    keep <- !vapply(rows, is.null, NA)
    c(list(type = ty, terms = I(as.character(names(hyp)[keep]))), rows_out(rows[keep]))
  })
  message(sprintf("%s REML=%s: Newton steps %s; Hessian eigenvalues %s", a$formula, isTRUE(a$REML),
                  paste(opt$steps, collapse = " "), paste(sprintf("%.3g", S$eig), collapse = " ")))
  out
}

# ---- cases ----
set.seed(20261030)
# A (between subjects, 2 levels) x B (within, 3 levels), 12 subjects, 2 replicates per cell
fac <- expand.grid(rep = 1:2, B = c("b1", "b2", "b3"), subj = sprintf("s%02d", 1:12), stringsAsFactors = FALSE)
fac$A <- ifelse(match(fac$subj, unique(fac$subj)) <= 6, "a1", "a2")
si <- match(fac$subj, unique(fac$subj))
fac$y <- round(10 + c(a1 = 0, a2 = 1.2)[fac$A] + c(b1 = 0, b2 = 0.6, b3 = 1.5)[fac$B] +
               ifelse(fac$A == "a2" & fac$B == "b3", 0.8, 0) + rnorm(12, 0, 1.1)[si] + rnorm(nrow(fac), 0, 0.7), 2)
fac$x <- round(runif(nrow(fac), 0, 3), 2)
unb <- fac[-c(3, 4, 9, 20, 27, 28, 31, 50, 61), ]                   # unbalanced: Types I, II and III differ
miss <- fac[!(fac$A == "a2" & fac$B == "b3"), ]                      # an empty cell: "Missing cells" in Type III
abc <- fac; abc$C <- rep(c("c1", "c2"), length.out = nrow(abc))

cases <- list()
add <- function(formula, data, ..., remls = c(TRUE, FALSE)) for (reml in remls)
  cases[[length(cases) + 1]] <<- c(list(formula = formula, data = data, REML = reml), list(...))
add("Reaction ~ Days + (Days | Subject)", sleep,
    contests = list(list(L = c(0, 1), rhs = 10), list(L = list(c(1, 0), c(0, 1))),
                    list(L = list(c(1, 0), c(0, 1)), joint = FALSE, level = 0.9)))
add("Reaction ~ Days + (Days || Subject)", sleep)
add("diameter ~ 1 + (1 | plate) + (1 | sample)", pen)
add("Yield ~ 1 + (1 | Batch)", dye)
add("y ~ x + (x | g) + (1 | h)", d)
add("y ~ x * f + (1 | g)", d, contrasts = list(f = "contr.sum"))
add("y ~ x * f + (1 | g)", d)
add("y ~ f + x + (1 | g)", d, levels = list(f = c("mid", "lo", "hi")),
    contests = list(list(L = list(c(0, 1, -1, 0)), joint = FALSE), list(L = list(c(0, 1, 0, 0), c(0, 0, 1, 0), c(0, 1, 1, 0)))))
add("y ~ x + (x | g)", dna)
add("y ~ 0 + f + x + (1 | g)", d)
add("y ~ A * B + (1 | subj)", fac)
add("y ~ A * B + (1 | subj)", unb)
add("y ~ A * B + (1 | subj)", unb, contrasts = list(A = "contr.sum", B = "contr.sum"))
add("y ~ A * B + (1 | subj)", unb, contrasts = list(A = "contr.helmert", B = "contr.poly"))
add("y ~ A * B + (1 | subj)", miss)
add("y ~ B * x + A + (1 | subj)", unb)
add("y ~ A * B * C + (1 | subj)", abc, remls = TRUE)
add("y ~ A + B + (1 | subj) + (1 | subj:B)", unb)
# (added after the first cases) a fit on the boundary (theta = 0): the Hessian's warnings
add("Yield ~ 1 + (1 | Batch)", dye2)

# The references take minutes per case, so the cases can be computed in parallel shards first:
#   LMERTEST_SHARD=i/k   compute the cases i, i + k, ... and save them in /out/.lmertest-cache (then stop)
#   (no shard)           write the fixture, taking each case from the cache when it is there
cache_dir <- "/out/.lmertest-cache"
cache_file <- function(i) file.path(cache_dir, sprintf("case%03d.rds", i))
shard <- Sys.getenv("LMERTEST_SHARD", "")
if (nzchar(shard)) {
  ik <- as.integer(strsplit(shard, "/")[[1]]); dir.create(cache_dir, showWarnings = FALSE)
  for (i in seq(ik[1], length(cases), by = ik[2])) {
    if (file.exists(cache_file(i))) next
    e <- tryCatch(suppressWarnings(expected(cases[[i]])), error = function(err) list(error = conditionMessage(err)))
    r <- if (is.null(e$error)) reference(cases[[i]]) else NULL
    saveRDS(list(expected = e, reference = r), cache_file(i))
  }
  quit(save = "no")
}
case_index <- 0
cached <- function(a, part) {
  if (part == "expected") case_index <<- case_index + 1
  f <- cache_file(case_index)
  if (file.exists(f)) readRDS(f)[[part]] else if (part == "expected") expected(a) else reference(a)
}
# LMERTEST_NOREF=1 writes lmerTest's values only (no references), quickly
noref <- nzchar(Sys.getenv("LMERTEST_NOREF", ""))
if (!exists("DEBUG_ONE")) write_anova_fixture("lmerTest", cases, function(a) cached(a, "expected"),
                                              if (noref) NULL else function(a) cached(a, "reference"))
