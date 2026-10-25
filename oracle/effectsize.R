source("/oracle/_anova.R")
suppressPackageStartupMessages({library(effectsize); library(car)})

# Standardized differences and effect sizes of ANOVA tables as effectsize computes them (fixtures cohensD and
# etaSquared).
#
# cohensD: cohens_d(x, y, pooled_sd, mu, paired, adjust, ci, alternative); fn is "cohens_d" or "hedges_g". y may be
# absent (one sample). ci "NULL" means no interval. Written: the effect size's name ("Cohens_d" or "Hedges_g"), value,
# and CI, CI_low, CI_high when there is an interval; warnings.
#
# etaSquared: an ANOVA table built from formula and data (contrasts optional) by source: "anova" (anova(lm(...)),
# R's sequential table), "Anova2" / "Anova3" (car::Anova(lm(...), type = 2 or 3)); then fn ("eta_squared",
# "omega_squared" or "epsilon_squared") with partial, generalized (TRUE or the names of observed factors, eta only),
# ci, alternative. Written: colNames (effectsize's columns after "Parameter"), rowNames (the parameters), table,
# warnings.
#
# "reference" holds the interval limits with the noncentrality parameters solved to full precision: effectsize finds
# them with optim (Nelder-Mead, abstol 1e-9 on the sum of the absolute quantile differences), so its limits are only
# about 1e-9 accurate. For a t statistic t on df degrees of freedom and a two-sided level L, the noncentrality limits
# are the ncp with pt(t, df, ncp) = (1 + L)/2 and = (1 - L)/2; for F the ncp with pf(F, df1, df2, ncp) = (1 + L)/2 and
# (1 - L)/2, replaced by 0 as effectsize does when F is at most the central quantile; roots found with uniroot at
# tol 1e-14 relative.

set.seed(20261110)
x1 <- round(rnorm(18, 10, 2), 2); x2 <- round(rnorm(22, 8.8, 2.5), 2)
p1 <- round(rnorm(15, 5, 1), 2); p2 <- round(p1 + rnorm(15, 0.4, 0.6), 2)
big1 <- round(rnorm(40, 0, 1), 3); big2 <- round(big1 * 0 + rnorm(40, 6, 1), 3)   # |t| about 30
na1 <- x1; na1[c(2, 7)] <- NA
nul <- "NULL"

dcases <- list()
addd <- function(...) dcases[[length(dcases) + 1]] <<- list(...)
for (fn in c("cohens_d", "hedges_g")) {
  for (alt in c("two.sided", "less", "greater")) {
    addd(fn = fn, x = I(x1), y = I(x2), alternative = alt)
    addd(fn = fn, x = I(x1), y = I(x2), pooled_sd = FALSE, alternative = alt)
    addd(fn = fn, x = I(p1), y = I(p2), paired = TRUE, alternative = alt)
    addd(fn = fn, x = I(x1), mu = 9, alternative = alt)
  }
  addd(fn = fn, x = I(x1), y = I(x2), ci = 0.9)
  addd(fn = fn, x = I(x1), y = I(x2), ci = nul)
  addd(fn = fn, x = I(x1), y = I(x2), mu = 1)
  addd(fn = fn, x = I(p1), y = I(p2), paired = TRUE, mu = 0.2)
  addd(fn = fn, x = I(big1), y = I(big2))
  addd(fn = fn, x = I(na1), y = I(x2))
  addd(fn = fn, x = I(x1[1:3]), y = I(x2[1:3]))
  addd(fn = fn, x = I(c(1, 2, 3, 4)), y = I(c(1, 2, 3, 4)))                       # d = 0
}
addd(fn = "cohens_d", x = I(x1), y = I(x2), adjust = TRUE)

ref_ncp_t <- function(t, df, level) {
  f <- function(p) { g <- function(ncp) pt(t, df, ncp) - p
    uniroot(g, t + c(-1, 1), extendInt = "downX", tol = 1e-14 * max(1, abs(t)), maxiter = 5000)$root }
  sort(c(f((1 + level) / 2), f((1 - level) / 2)))
}

write_anova_fixture("cohensD", dcases, function(a) {
  args <- list(x = unclass(a$x))
  if (!is.null(a$y)) args$y <- unclass(a$y)
  for (k in c("pooled_sd", "mu", "paired", "adjust", "alternative")) if (!is.null(a[[k]])) args[[k]] <- a[[k]]
  if (!is.null(a$ci)) args["ci"] <- list(if (identical(a$ci, nul)) NULL else a$ci)
  r <- with_warnings(function() suppressMessages(do.call(get(a$fn, envir = asNamespace("effectsize")), args)))
  v <- as.data.frame(r$value)
  out <- list(name = colnames(v)[1], value = num2str(v[[1]]))
  if ("CI" %in% colnames(v)) { out$CI <- num2str(v$CI); out$CI_low <- num2str(v$CI_low); out$CI_high <- num2str(v$CI_high) }
  c(out, list(warnings = r$warnings))
}, ref = function(a) {
  if (identical(a$ci, nul)) return(NULL)
  x <- as.numeric(na.omit(unclass(a$x))); y <- if (is.null(a$y)) NULL else as.numeric(na.omit(unclass(a$y)))
  mu <- if (is.null(a$mu)) 0 else a$mu; level <- if (is.null(a$ci)) 0.95 else a$ci
  alt <- if (is.null(a$alternative)) "two.sided" else a$alternative
  paired <- isTRUE(a$paired); pooled <- if (is.null(a$pooled_sd)) TRUE else a$pooled_sd
  adjust <- a$fn == "hedges_g" || isTRUE(a$adjust)
  if (is.null(y) || paired) {
    dlt <- if (is.null(y)) x else x - y
    n <- length(dlt); s <- sd(dlt); hn <- 1 / n; se <- s / sqrt(n); df1 <- n - 1; d <- mean(dlt)
  } else {
    n1 <- length(x); n2 <- length(y); d <- mean(x) - mean(y); s1 <- sd(x); s2 <- sd(y)
    if (pooled) { s <- sqrt(((n1 - 1) * s1^2 + (n2 - 1) * s2^2) / (n1 + n2 - 2)); hn <- 1 / n1 + 1 / n2
      se <- s * sqrt(hn); df1 <- n1 + n2 - 2 }
    else { hn <- (2 * (n2 * s1^2 + n1 * s2^2)) / (n1 * n2 * (s1^2 + s2^2)); se <- sqrt(s1^2 / n1 + s2^2 / n2)
      df1 <- se^4 / ((s1^2 / n1)^2 / (n1 - 1) + (s2^2 / n2)^2 / (n2 - 1)) }
  }
  L <- if (alt == "two.sided") level else 2 * level - 1
  t1 <- (d - mu) / se
  if (!is.finite(t1)) return(NULL)
  lim <- ref_ncp_t(t1, df1, L) * sqrt(hn)
  J <- if (adjust) exp(lgamma(df1 / 2) - log(sqrt(df1 / 2)) - lgamma((df1 - 1) / 2)) else 1
  lo <- lim[1] * J; hi <- lim[2] * J
  if (alt == "less") lo <- -Inf
  if (alt == "greater") hi <- Inf
  list(CI_low = num2str(lo), CI_high = num2str(hi))
})

# ---- eta squared and friends ----
mk2 <- function(sizes) {
  cells <- expand.grid(A = c("a", "b", "c"), B = c("p", "q"), stringsAsFactors = FALSE)
  rows <- cells[rep(seq_len(nrow(cells)), sizes), ]
  ia <- match(rows$A, c("a", "b", "c")); ib <- match(rows$B, c("p", "q"))
  y <- 10 + c(0, 1.5, -1)[ia] + c(0, 0.4)[ib] + rnorm(nrow(rows))
  data.frame(y = round(y, 2), A = rows$A, B = rows$B, x = round(runif(nrow(rows), 0, 10), 1),
             stringsAsFactors = FALSE, row.names = NULL)
}
unb <- mk2(c(5, 6, 4, 5, 7, 5))
flat <- unb; flat$y <- round(10 + rnorm(nrow(flat), 0, 1), 2)    # small effects: F near 0, truncated intervals
sum2 <- list(A = "contr.sum", B = "contr.sum")
ecases <- list()
adde <- function(...) ecases[[length(ecases) + 1]] <<- list(...)
for (src in c("anova", "Anova2", "Anova3")) for (fn in c("eta_squared", "omega_squared", "epsilon_squared")) {
  for (partial in c(TRUE, FALSE)) {
    adde(fn = fn, source = src, formula = "y ~ A * B + x", data = unb, contrasts = sum2, partial = partial)
    adde(fn = fn, source = src, formula = "y ~ A * B", data = flat, contrasts = sum2, partial = partial)
  }
  adde(fn = fn, source = src, formula = "y ~ A", data = unb, contrasts = list(A = "contr.sum"))  # one term
  adde(fn = fn, source = src, formula = "y ~ A * B", data = unb, contrasts = sum2, ci = 0.9)
  adde(fn = fn, source = src, formula = "y ~ A * B", data = unb, contrasts = sum2, alternative = "two.sided")
  adde(fn = fn, source = src, formula = "y ~ A * B", data = unb, contrasts = sum2, alternative = "less")
  adde(fn = fn, source = src, formula = "y ~ A * B", data = unb, contrasts = sum2, ci = nul)
}
for (src in c("anova", "Anova3")) {
  adde(fn = "eta_squared", source = src, formula = "y ~ A * B + x", data = unb, contrasts = sum2, generalized = TRUE)
  adde(fn = "eta_squared", source = src, formula = "y ~ A * B + x", data = unb, contrasts = sum2, generalized = "x")
  adde(fn = "eta_squared", source = src, formula = "y ~ A * B + x", data = unb, contrasts = sum2, generalized = "Q")
}

aov_table <- function(a) {
  m <- lm(as.formula(a$formula), a$data, contrasts = if (is.null(a$contrasts)) NULL else lapply(a$contrasts, identity))
  switch(a$source, anova = anova(m), Anova2 = Anova(m, type = 2), Anova3 = Anova(m, type = 3))
}
es_args <- function(a) {
  args <- list(model = aov_table(a))
  for (k in c("partial", "generalized", "alternative")) if (!is.null(a[[k]])) args[[k]] <- a[[k]]
  if (!is.null(a$ci)) args["ci"] <- list(if (identical(a$ci, nul)) NULL else a$ci)
  if (a$fn != "eta_squared") args$generalized <- NULL
  args
}

ref_ncp_f <- function(f, df1, df2, level) {
  probs <- c((1 - level) / 2, (1 + level) / 2)
  r <- function(p) { g <- function(ncp) pf(f, df1, df2, ncp) - p
    if (g(0) < 0) return(0)
    uniroot(g, c(0, max(10, f * df1 * 4)), extendInt = "downX", tol = 1e-14 * max(1, f * df1), maxiter = 5000)$root }
  lim <- sort(c(r(probs[2]), r(probs[1])))
  if (f <= qf(probs[1], df1, df2)) lim[2] <- 0
  if (f <= qf(probs[2], df1, df2)) lim[1] <- 0
  lim
}

write_anova_fixture("etaSquared", ecases, function(a) {
  r <- with_warnings(function() suppressMessages(do.call(get(a$fn, envir = asNamespace("effectsize")), es_args(a))))
  v <- as.data.frame(r$value)
  c(list(colNames = I(setdiff(colnames(v), "Parameter")), rowNames = I(v$Parameter),
         table = lapply(seq_len(nrow(v)), function(i) I(num2str(unname(unlist(v[i, setdiff(colnames(v), "Parameter")])))))),
    list(warnings = r$warnings))
}, ref = function(a) {
  if (identical(a$ci, nul)) return(NULL)
  r <- tryCatch(suppressWarnings(suppressMessages(do.call(get(a$fn, envir = asNamespace("effectsize")), es_args(a)))),
                error = function(e) NULL)
  if (is.null(r)) return(NULL)
  v <- as.data.frame(r); tab <- as.data.frame(aov_table(a))
  dfe <- tab[rownames(tab) == "Residuals", "Df"]
  level <- if (is.null(a$ci)) 0.95 else a$ci
  alt <- if (is.null(a$alternative)) "greater" else a$alternative
  L <- if (alt == "two.sided") level else 2 * level - 1
  rows <- lapply(seq_len(nrow(v)), function(i) {
    es <- max(0, v[i, 2]); df1 <- tab[trimws(rownames(tab)) == v$Parameter[i], "Df"]
    f <- (es / df1) / ((1 - es) / dfe)
    lim <- ref_ncp_f(f, df1, dfe, L)
    lo <- lim[1] / (lim[1] + dfe); hi <- lim[2] / (lim[2] + dfe)
    if (alt == "less") lo <- 0
    if (alt == "greater") hi <- 1
    c(lo, hi)
  })
  list(CI_low = I(num2str(vapply(rows, `[`, 0, 1))), CI_high = I(num2str(vapply(rows, `[`, 0, 2))))
})
