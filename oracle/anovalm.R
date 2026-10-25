source("/oracle/_anova.R")

# Linear models from a formula, their sequential analysis of variance and model comparisons: R's lm(formula, data),
# anova(fit), summary(aov(formula, data)) and anova(fit1, fit2, ...) (fixture anovaLm). Each case has
#   formula    the formula
#   data       the data frame
#   contrasts  (optional) contrast per factor, as in oracle/modelmatrix.R
#   weights    (optional) the name of a numeric column of data used as weights
#   compare    (optional) more formulas: the table is then anova(lm(formula), lm(compare[1]), ...)
# Written: coefNames and coefficients (NA for aliased columns), dfResidual, sigma, rSquared, adjRSquared, anova
# (anova.lm's table), aov (summary(aov(...))[[1]], the same table as summary.aov prints it), compare (when given)
# and warnings. "reference" holds the anova and compare tables, the coefficients, sigma, rSquared and adjRSquared
# computed exactly (oracle/_anova.R).

set.seed(20261102)
mk2 <- function(sizes, effA = c(0, 1.5, -1), effB = c(0, 0.8), effAB = 0.7, sd = 1) {
  cells <- expand.grid(A = c("a", "b", "c"), B = c("p", "q"), stringsAsFactors = FALSE)
  rows <- cells[rep(seq_len(nrow(cells)), sizes), ]
  ia <- match(rows$A, c("a", "b", "c")); ib <- match(rows$B, c("p", "q"))
  y <- 10 + effA[ia] + effB[ib] + effAB * (ia == 2 & ib == 2) + rnorm(nrow(rows), 0, sd)
  data.frame(y = round(y, 2), A = rows$A, B = rows$B, x = round(runif(nrow(rows), 0, 10), 1),
             w = sample(c(0.5, 1, 2), nrow(rows), TRUE), stringsAsFactors = FALSE, row.names = NULL)
}
bal <- mk2(rep(4, 6))
unb <- mk2(c(3, 5, 2, 4, 6, 3))
empty <- mk2(c(3, 4, 2, 3, 0, 3))                      # cell (b, q) empty: one interaction column is aliased
one <- mk2(rep(1, 6))                                   # one observation per cell: no residual df for A * B
add_exact <- function(d) {                              # y exactly additive: the interaction sum of squares is 0
  d$y <- 10 + c(a = 0, b = 2, c = -1)[d$A] + c(p = 0, q = 3)[d$B]; d
}
wb <- warpbreaks; wb$wool <- as.character(wb$wool); wb$tension <- as.character(wb$tension)
tg <- ToothGrowth; tg$supp <- as.character(tg$supp); tg$dose <- as.character(tg$dose)
na <- unb; na$y[3] <- NA; na$A[7] <- NA; na$x[11] <- NA
big <- unb; big$y <- big$y + 1e6                        # large mean: the intercept dominates the sums of squares
d3 <- mk2(rep(3, 6)); d3$C <- rep(c("u", "v", "w"), length.out = nrow(d3))

cases <- list()
add <- function(formula, data, ...) cases[[length(cases) + 1]] <<- c(list(formula = formula, data = data), list(...))

for (d in list(bal, unb)) for (f in c("y ~ A", "y ~ A + B", "y ~ B + A", "y ~ A * B", "y ~ B * A", "y ~ A:B",
                                       "y ~ A + A:B", "y ~ A - 1", "y ~ A * B - 1", "y ~ x", "y ~ x + A",
                                       "y ~ A + x", "y ~ A * x", "y ~ x:A", "y ~ A * B + x", "y ~ 1"))
  add(f, d)
add("y ~ A * B", unb, contrasts = list(A = "contr.sum", B = "contr.sum"))
add("y ~ A * B", unb, contrasts = list(A = "contr.helmert", B = "contr.sum"))
add("y ~ A * B", empty)
add("y ~ A + B", empty)
add("y ~ A * B", one)
add("y ~ A + B", one)
add("y ~ A * B", add_exact(bal))
add("y ~ A * B", add_exact(unb))
add("y ~ A", add_exact(bal)[add_exact(bal)$B == "p", ])   # the residuals are exactly 0: perfect fit
add("y ~ A * B", na)
add("y ~ x + A", na)
add("y ~ A * B", unb, weights = "w")
add("y ~ x * A", unb, weights = "w")
add("y ~ A * B", big)
add("y ~ A * B * C", d3)
add("y ~ (A + B + C)^2", d3)
add("y ~ A/B", unb)
add("breaks ~ wool * tension", wb)
add("breaks ~ tension * wool", wb)
add("len ~ supp * dose", tg)
add("len ~ dose + supp", tg)
add("y ~ .", unb[, c("y", "A", "x")])
# comparisons
add("y ~ 1", unb, compare = I(c("y ~ A", "y ~ A + B", "y ~ A * B")))
add("y ~ A * B", unb, compare = I(c("y ~ A + B", "y ~ A")))     # larger model first
add("y ~ A", unb, compare = I("y ~ B"))                         # not nested
add("y ~ A", unb, compare = I("y ~ x + A"))
add("y ~ A + B", unb, weights = "w", compare = I("y ~ A * B"))
add("y ~ A", na, compare = I("y ~ A + B"))                      # the same rows are used: both drop the same
add("y ~ A", na, compare = I("y ~ A + x"))                      # x has its own missing value: different sizes

fit <- function(formula, a) {
  ctr <- if (is.null(a$contrasts)) NULL else lapply(a$contrasts, identity)
  dat <- a$data
  if (is.null(a$weights)) lm(as.formula(formula), dat, contrasts = ctr)
  else { dat$.w <- dat[[a$weights]]; lm(as.formula(formula), dat, weights = .w, contrasts = ctr) }
}

write_anova_fixture("anovaLm", cases, function(a) {
  r <- with_warnings(function() {
    m <- fit(a$formula, a)
    s <- summary(m)
    out <- list(coefNames = I(names(coef(m))), coefficients = I(num2str(unname(coef(m)))),
                dfResidual = num2str(m$df.residual), sigma = num2str(s$sigma),
                rSquared = num2str(s$r.squared), adjRSquared = num2str(s$adj.r.squared),
                anova = tab_out(anova(m)))
    ctr <- if (is.null(a$contrasts)) NULL else lapply(a$contrasts, identity)
    av <- if (is.null(a$weights)) aov(as.formula(a$formula), a$data, contrasts = ctr) else {
      dat <- a$data; dat$.w <- dat[[a$weights]]; aov(as.formula(a$formula), dat, weights = .w, contrasts = ctr)
    }
    out$aov <- tab_out(summary(av)[[1]])
    if (!is.null(a$compare)) {
      fits <- c(list(m), lapply(unclass(a$compare), fit, a = a))
      out$compare <- tab_out(do.call(anova, fits))
    }
    out
  })
  c(r$value, list(warnings = r$warnings))
}, ref = function(a) {
  # exact sequential table and comparison table
  exact_fit <- function(formula) {
    m <- fit(formula, a)
    X <- model.matrix(m); y <- model.response(model.frame(m)); w <- m$weights
    q_sequential(X, y, attr(X, "assign"), if (is.null(w)) NULL else q_of(w))
  }
  e <- exact_fit(a$formula)
  m <- fit(a$formula, a)
  keep <- if (attr(terms(m), "intercept")) e$terms != 0 else rep(TRUE, length(e$terms))
  rows <- lapply(which(keep), function(i) {
    ms <- e$ss[[i]] / e$df[i]
    if (e$rdf > 0 && e$rss != 0) {
      f <- ms / (e$rss / e$rdf)
      c(e$df[i], qn(e$ss[[i]]), qn(ms), qn(f), pf(qn(f), e$df[i], e$rdf, lower.tail = FALSE))
    } else if (e$rdf > 0) {                             # perfect fit: F is Inf (NaN for a zero sum of squares)
      fv <- if (e$ss[[i]] == 0) NaN else Inf
      c(e$df[i], qn(e$ss[[i]]), qn(ms), fv, pf(fv, e$df[i], e$rdf, lower.tail = FALSE))
    } else c(e$df[i], qn(e$ss[[i]]), qn(ms), NA, NA)
  })
  rows[[length(rows) + 1]] <- c(e$rdf, qn(e$rss), if (e$rdf > 0) qn(e$rss / e$rdf) else NaN, NA, NA)
  out <- list(anova = list(table = lapply(rows, function(r) I(num2str(r)))))
  # coefficients (NA for the aliased columns), sigma, R^2 and adjusted R^2, exactly (sigma: the square root of the
  # exact residual variance, rounded once more)
  X <- model.matrix(m); y <- model.response(model.frame(m)); w <- m$weights
  qw <- if (is.null(w)) NULL else q_of(w)
  kept <- q_gs(q_cols(X), qw)$kept
  Xk <- as.bigq(X[, kept, drop = FALSE]); qy <- matrix(q_of(y), ncol = 1)
  WXk <- Xk
  if (!is.null(w)) for (j in seq_len(ncol(Xk))) WXk[, j] <- Xk[, j] * qw   # rows scaled by the weights
  XtX <- t(WXk) %*% Xk
  Xty <- t(WXk) %*% qy
  b <- if (sum(kept)) solve(XtX, Xty) else NULL
  coefs <- rep(NA_real_, ncol(X)); if (sum(kept)) coefs[kept] <- vapply(seq_len(sum(kept)), function(k) qn(b[k, 1]), 0)
  out$coefficients <- I(num2str(coefs))
  if (e$rdf > 0) out$sigma <- num2str(sqrt(qn(e$rss / e$rdf)))
  intercept <- attr(terms(m), "intercept") == 1
  n_eff <- if (is.null(w)) length(y) else sum(w != 0)
  if (sum(kept) > intercept && e$rdf > 0) {
    qy1 <- q_of(y)
    tss <- if (intercept) {
      ybar <- if (is.null(qw)) sum(qy1) / length(y) else sum(qw * qy1) / sum(qw)
      q_dot(qy1 - ybar, qy1 - ybar, qw)
    } else q_dot(qy1, qy1, qw)
    r2 <- 1 - e$rss / tss
    out$rSquared <- num2str(qn(r2))
    out$adjRSquared <- num2str(qn(1 - (1 - r2) * ((n_eff - intercept) / e$rdf)))
  }
  if (!is.null(a$compare)) {
    es <- c(list(e), lapply(unclass(a$compare), exact_fit))
    if (length(unique(vapply(es, function(x) x$rdf + sum(x$df), 0))) == 1) {
      big <- which.min(vapply(es, function(x) x$rdf, 0))
      scale <- es[[big]]$rss / es[[big]]$rdf
      rows <- lapply(seq_along(es), function(i) {
        if (i == 1) return(c(es[[i]]$rdf, qn(es[[i]]$rss), NA, NA, NA, NA))
        ddf <- es[[i - 1]]$rdf - es[[i]]$rdf; dss <- es[[i - 1]]$rss - es[[i]]$rss
        if (ddf == 0) return(c(es[[i]]$rdf, qn(es[[i]]$rss), 0, qn(dss), NA, NA))
        f <- (dss / ddf) / scale
        fv <- if (qn(f) < 0) NA else qn(f)
        c(es[[i]]$rdf, qn(es[[i]]$rss), ddf, qn(dss), fv, pf(fv, abs(ddf), es[[big]]$rdf, lower.tail = FALSE))
      })
      out$compare <- list(table = lapply(rows, function(r) I(num2str(r))))
    }
  }
  out
})
