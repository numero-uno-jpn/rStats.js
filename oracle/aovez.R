source("/oracle/_anova.R")
suppressPackageStartupMessages(library(afex))

# Repeated-measures and mixed analysis of variance as afex computes it: aov_ez(id, dv, data, between, within, type,
# observed, anova_table = list(correction, es)) (fixture aovEz). Each case has
#   data, id, dv, between, within (names of columns; between and within may be absent)
#   type        2 or 3 (default 3)
#   correction  "GG" (default), "HF" or "none"
#   es          "ges" (default), "pes", or both
#   observed    (optional) names of observed (not manipulated) factors, for ges
# Written for each case:
#   anova         afex's table (columns "num Df", "den Df", "MSE", "F", then "ges" and/or "pes", "Pr(>F)"), without
#                 the intercept
#   univariate    the uncorrected univariate tests of car (summary(Anova, multivariate = FALSE)$univariate.tests:
#                 "Sum Sq", "num Df", "Error SS", "den Df", "F value", "Pr(>F)"), intercept included; for a design
#                 without within-subject factors, car's Anova table instead
#   corrections   car's pval.adjustments ("GG eps", "Pr(>F[GG])", "HF eps", "Pr(>F[HF])") for the terms with more
#                 than one degree of freedom within subjects (absent when there are none)
#   sphericity    car's Mauchly tests ("Test statistic", "p-value") for the same terms (absent when there are none)
#   warnings
# "reference" holds univariate, corrections and sphericity computed exactly (see the comments of exact_mlm below).

set.seed(20261106)
data(obk.long, package = "afex")
obk <- obk.long; for (v in c("id", "treatment", "gender", "phase", "hour")) obk[[v]] <- as.character(obk[[v]])
w1 <- long(8, list(W = c("w1", "w2", "w3")))
w1b <- long(8, list(W = c("w1", "w2")))
w2 <- long(6, list(W1 = c("a", "b"), W2 = c("x", "y", "z")))
mix <- long(10, list(W = c("w1", "w2", "w3")), between = c("g1", "g2"))
mixu <- long(9, list(W = c("w1", "w2", "w3", "w4")), between = c("g1", "g2", "g2"))
rep2 <- rbind(w1, transform(w1, y = round(y + rnorm(nrow(w1), 0, 0.5), 2)))   # two observations per cell
betw <- data.frame(id = sprintf("b%02d", 1:14), G = rep(c("g1", "g2"), times = 7),
                   H = rep(c("h1", "h2", "h3"), length.out = 14), stringsAsFactors = FALSE)
betw$y <- round(rnorm(14, 5) + 0.7 * (betw$G == "g2"), 2)
betw_bad <- betw; betw_bad$H <- ifelse(betw_bad$G == "g1", "h1", rep(c("h2", "h3"), 7))  # empty between cells
w3 <- long(12, list(W = c("w1", "w2", "w3", "w4", "w5")), sd_sub = 0.2, sd = 1)  # close to spherical: HF eps > 1
bad_between <- mix; bad_between$G[1] <- "g2"                        # s01 in both groups
bad_within <- w2[!(w2$W1 == "b" & w2$W2 == "z"), ]                  # an empty within-subject cell
one_level <- w1; one_level$W <- "w1"

cases <- list()
add <- function(data, ...) cases[[length(cases) + 1]] <<- c(list(data = data, id = "id", dv = "y"), list(...))
add(w1, within = "W")
add(w1, within = "W", correction = "HF")
add(w1, within = "W", correction = "none")
add(w1, within = "W", es = "pes")
add(w1, within = "W", es = I(c("ges", "pes")))
add(w1b, within = "W")
add(w2, within = I(c("W1", "W2")))
add(w2, within = I(c("W2", "W1")))
add(mix, between = "G", within = "W")
add(mix, between = "G", within = "W", type = 2)
add(mixu, between = "G", within = "W")
add(mixu, between = "G", within = "W", type = 2)
add(mixu, between = "G", within = "W", observed = "G")
add(rep2, within = "W")                                              # aggregated by the mean, with a warning
add(betw, between = I(c("G", "H")))
add(betw, between = I(c("G", "H")), type = 2)
add(betw, between = "G")
add(betw_bad, between = I(c("G", "H")))                       # rank deficient: an error
add(w2, within = I(c("W1", "W2")), correction = "HF")           # HF eps > 1: a warning
add(w3, within = "W")
add(w3, within = "W", correction = "HF")
cases[[length(cases) + 1]] <- list(data = obk, id = "id", dv = "value", between = I(c("treatment", "gender")),
                                   within = I(c("phase", "hour")))
cases[[length(cases) + 1]] <- list(data = obk, id = "id", dv = "value", between = I(c("treatment", "gender")),
                                   within = I(c("phase", "hour")), observed = "gender", correction = "HF")
cases[[length(cases) + 1]] <- list(data = obk, id = "id", dv = "value", between = "treatment", within = "phase")
cases[[length(cases) + 1]] <- list(data = obk, id = "id", dv = "value", between = "treatment", within = "phase",
                                   type = 2)
add(bad_between, between = "G", within = "W")
add(bad_within, within = I(c("W1", "W2")))
add(one_level, within = "W")

run_afex <- function(a) {
  args <- list(id = a$id, dv = a$dv, data = a$data, type = if (is.null(a$type)) 3 else a$type,
               anova_table = list(correction = if (is.null(a$correction)) "GG" else a$correction,
                                  es = if (is.null(a$es)) "ges" else unclass(a$es)))
  if (!is.null(a$between)) args$between <- unclass(a$between)
  if (!is.null(a$within)) args$within <- unclass(a$within)
  if (!is.null(a$observed)) args$observed <- unclass(a$observed)
  suppressMessages(do.call(aov_ez, args))
}

# Exact univariate tests of car's Anova.mlm for afex's fit. Y is the wide response (subjects x within cells), X the
# between-subjects model matrix (contr.sum, full rank), H(S) the projection onto the columns of X outside the terms S.
#   between part of a test:  type III: SSP = Y'(H() - H({t}))Y, the intercept as the term 0
#                            type II:  SSP = Y'(H(rel) - H(rel + {t}))Y with rel the terms containing t; for the
#                                      intercept Y'H(all terms)Y, the projection onto the intercept column alone
#   error:                   E = Y'(I - H())Y
#   within part:             P = the columns of model.matrix(~ W1 * W2 ..., idata) (contr.sum) of the within term
#   SS = tr(P'SSP P (P'P)^-1), Error SS = tr(P'E P (P'P)^-1), num Df = df(t) ncol(P), den Df = (n - rank X) ncol(P)
#   GG eps = tr(A)^2 / (p tr(A^2)) with A = P'EP (P'P)^-1, p = ncol(P); HF eps = ((d + 1) p GG - 2) / (p (d - p GG))
#   with d = n - rank X; Mauchly's W = det(U) / (tr(U) / p)^p with U = (P'P)^-1 P'EP, its p-value as R computes it
#   from W (the asymptotic expansion, with the number of within cells in its 3p term).
exact_mlm <- function(fit, type) {
  lmfit <- fit$lm
  X <- model.matrix(lmfit); Y <- as.matrix(model.response(model.frame(lmfit)))
  asg <- attr(X, "assign"); fac <- attr(terms(lmfit), "factors"); labs <- attr(terms(lmfit), "term.labels")
  n <- nrow(X); rdf <- n - qr(X)$rank
  qY <- lapply(seq_len(ncol(Y)), function(j) q_of(Y[, j]))
  hat_of <- function(drop_terms) {        # function v -> H v for the columns of X outside drop_terms
    gs <- q_gs(q_cols(X)[!(asg %in% drop_terms)])
    function(v) { out <- q_of(rep(0, length(v)))
      for (k in seq_along(gs$basis)) out <- out + (q_dot(v, gs$basis[[k]]) / gs$norms[[k]]) * gs$basis[[k]]; out }
  }
  quad <- function(h1, h2) {              # Y'(H1 - H2)Y as a bigq matrix (H = NULL: the identity, "zero": 0)
    k <- length(qY); M <- matrix.bigq(as.bigq(0), k, k)
    apply1 <- function(h, v) if (identical(h, "I")) v else if (identical(h, "0")) v * 0 else h(v)
    hv1 <- lapply(qY, function(v) apply1(h1, v)); hv2 <- lapply(qY, function(v) apply1(h2, v))
    for (i in seq_len(k)) for (j in seq_len(k)) M[i, j] <- q_dot(qY[[i]], hv1[[j]] - hv2[[j]])
    M
  }
  full <- hat_of(integer(0))
  E <- quad("I", full)
  contains <- function(t) which(vapply(seq_along(labs), function(u) u != t && all(fac[, t] == 0 | fac[, u] > 0), NA))
  between_ssp <- function(t) {            # t = 0: the intercept
    if (type == 3) return(quad(full, hat_of(t)))
    if (t == 0) return(quad(hat_of(seq_along(labs)), "0"))
    rel <- contains(t); quad(hat_of(rel), hat_of(c(rel, t)))
  }
  idata <- fit$data$idata
  for (v in names(idata)) contrasts(idata[[v]]) <- "contr.sum"
  Xw <- model.matrix(as.formula(paste("~", paste(names(idata), collapse = "*"))), idata)
  wa <- attr(Xw, "assign"); wlabs <- c("(Intercept)", attr(terms(as.formula(paste("~", paste(names(idata), collapse = "*")))), "term.labels"))
  bterms <- c(0L, seq_along(labs)); blabs <- c("(Intercept)", labs)
  uni <- list(); corr <- list(); sph <- list(); rn <- character(0); rnc <- character(0)
  tr <- function(M) Reduce(`+`, lapply(seq_len(nrow(M)), function(i) M[i, i]))
  for (wi in seq_along(wlabs)) {
    P <- as.bigq(Xw[, wa == wi - 1, drop = FALSE]); p <- ncol(P)
    PtPinv <- solve(t(P) %*% P)
    Ew <- t(P) %*% E %*% P
    A <- Ew %*% PtPinv
    errss <- tr(A)
    for (bi in seq_along(bterms)) {
      H <- between_ssp(bterms[bi])
      ss <- tr(t(P) %*% H %*% P %*% PtPinv)
      dfb <- if (bterms[bi] == 0) 1 else sum(asg == bterms[bi])
      f <- (ss / (dfb * p)) / (errss / (rdf * p))
      uni[[length(uni) + 1]] <- c(qn(ss), dfb * p, qn(errss), rdf * p, qn(f), pf(qn(f), dfb * p, rdf * p, lower.tail = FALSE))
      name <- if (wi == 1) blabs[bi] else if (bi == 1) wlabs[wi] else paste0(blabs[bi], ":", wlabs[wi])
      rn <- c(rn, name)
      if (p >= 2) {
        gg <- tr(A)^2 / (p * tr(A %*% A))
        hf <- ((rdf + 1) * p * gg - 2) / (p * (rdf - p * gg))
        fn <- qn(f); ggn <- qn(gg); hfn <- min(1, qn(hf))
        corr[[length(corr) + 1]] <- c(ggn, pf(fn, ggn * dfb * p, ggn * rdf * p, lower.tail = FALSE),
                                      qn(hf), pf(fn, hfn * dfb * p, hfn * rdf * p, lower.tail = FALSE))
        U <- PtPinv %*% Ew
        W <- q_det(U) / (tr(U) / p)^p
        logW <- log(qn(W)); pp <- p; nn <- rdf; k <- nrow(P)
        rho <- 1 - (2 * pp^2 + pp + 2) / (6 * pp * nn)
        w2 <- (pp + 2) * (pp - 1) * (pp - 2) * (2 * pp^3 + 6 * pp^2 + 3 * k + 2) / (288 * (nn * pp * rho)^2)
        z <- -nn * rho * logW; df <- pp * (pp + 1) / 2 - 1
        pr1 <- pchisq(z, df, lower.tail = FALSE); pr2 <- pchisq(z, df + 4, lower.tail = FALSE)
        sph[[length(sph) + 1]] <- c(qn(W), pr1 + w2 * (pr2 - pr1))
        rnc <- c(rnc, name)
      }
    }
  }
  out <- list(univariate = list(rowNames = I(rn), table = lapply(uni, function(r) I(num2str(r)))))
  if (length(corr)) {
    out$corrections <- list(rowNames = I(rnc), table = lapply(corr, function(r) I(num2str(r))))
    out$sphericity <- list(rowNames = I(rnc), table = lapply(sph, function(r) I(num2str(r))))
  }
  out
}

write_htest_fixture("aovEz", cases, function(a) {
  r <- with_warnings(function() {
    fit <- run_afex(a)
    out <- list(anova = tab_out(fit$anova_table))
    if (inherits(fit$Anova, "Anova.mlm")) {
      s <- suppressWarnings(summary(fit$Anova, multivariate = FALSE))  # afex itself does not show these
      out$univariate <- tab_out(unclass(s$univariate.tests))
      if (nrow(s$pval.adjustments) > 0) out$corrections <- tab_out(s$pval.adjustments)
      if (nrow(s$sphericity.tests) > 0) out$sphericity <- tab_out(unclass(s$sphericity.tests))
    } else out$univariate <- tab_out(fit$Anova)
    out
  })
  c(r$value, list(warnings = r$warnings))
}, ref = function(a) {
  fit <- run_afex(a)
  if (!inherits(fit$Anova, "Anova.mlm")) return(NULL)
  exact_mlm(fit, if (is.null(a$type)) 3 else a$type)
})
