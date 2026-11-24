# step115-threshold.R: when does stats' step (and MASS's stepAIC) take a move whose improvement of the criterion is
# tiny, public functions only (1.15.0). k is set so that adding xa improves the criterion by exactly delta (up to
# rounding); the script records whether the move is taken. Also: separation in a binomial glm during the search (the
# warnings), BIC with a glm, and the time of a search with 30 candidate terms.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2). The trace argument is
# left at its default 1 and the printed trace captured (the checker keeps its name out).
library(jsonlite)
suppressPackageStartupMessages(library(MASS))
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
df_list <- function(d) if (is.null(d)) NULL else c(list(rownames = rownames(d)), lapply(as.list(d), function(v) if (is.factor(v)) as.character(v) else v))
labels_of <- function(fit) attr(terms(fit), "term.labels")
quiet <- function(e) { r <- NULL; invisible(capture.output(r <- e)); r }
out <- list(R = R.version.string, arch = R.version$arch, MASS = as.character(packageVersion("MASS")))

set.seed(20261127)
n <- 40
d <- data.frame(x1 = round(rnorm(n), 3), xa = round(rnorm(n), 3))
d$y <- round(1 + d$x1 + 0.3 * d$xa + rnorm(n), 3)
m0 <- lm(y ~ x1, data = d); m1 <- lm(y ~ x1 + xa, data = d)
gain <- extractAIC(m0, k = 0)[2] - extractAIC(m1, k = 0)[2]   # n log(RSS0 / RSS1)
out$gain <- gain
deltas <- c(-1e-6, -1e-9, -1e-12, 0, 1e-12, 1e-10, 1e-9, 1e-8, 5e-8, 1e-7, 2e-7, 1e-6, 1e-5)
out$lm <- lapply(deltas, function(dl) {
  k <- gain - dl
  s <- quiet(step(m0, scope = ~ x1 + xa, direction = "forward", k = k))
  a <- quiet(stepAIC(m0, scope = ~ x1 + xa, direction = "forward", k = k))
  b <- quiet(step(m1, direction = "backward", k = gain + dl))   # dropping xa improves by delta
  list(delta = dl, k = k, step_terms = labels_of(s), stepAIC_terms = labels_of(a), back_terms = labels_of(b),
       improvement = extractAIC(m0, k = k)[2] - extractAIC(m1, k = k)[2])
})

## the same for a poisson glm (the criterion is AIC + (k - 2) edf)
d$cnt <- rpois(n, exp(0.3 + 0.4 * d$x1 + 0.2 * d$xa))
g0 <- glm(cnt ~ x1, family = poisson, data = d); g1 <- glm(cnt ~ x1 + xa, family = poisson, data = d)
ggain <- extractAIC(g0, k = 0)[2] - extractAIC(g1, k = 0)[2]
out$ggain <- ggain
out$glm <- lapply(deltas, function(dl) {
  s <- quiet(step(g0, scope = ~ x1 + xa, direction = "forward", k = ggain - dl))
  list(delta = dl, step_terms = labels_of(s))
})

## separation during the search: warnings and the path
d$ys <- as.integer(d$x1 > 0.2)
d$ys[c(1, 2)] <- 1L - d$ys[c(1, 2)]
d$x2 <- round(rnorm(n), 3)
sep <- glm(ys ~ x1 + xa + x2, family = binomial, data = d)
out$separation <- run({ r <- NULL; txt <- capture.output(r <- step(sep)); list(terms = labels_of(r), anova = df_list(r$anova), printed = txt) })
d$yq <- as.integer(d$x1 > 0)
out$complete_separation <- run({ r <- NULL; txt <- capture.output(r <- step(glm(yq ~ x1 + xa, family = binomial, data = d)))
  list(terms = labels_of(r), anova = df_list(r$anova), printed = txt) })

## BIC with a glm
out$glm_bic <- run({ r <- quiet(step(glm(cnt ~ x1 + xa, family = poisson, data = d), k = log(n)))
  list(terms = labels_of(r), anova = df_list(r$anova)) })

## 30 candidate terms, 400 rows: the time of a both-direction search from the empty model
set.seed(20261128)
nb <- 400; p <- 30
X <- matrix(round(rnorm(nb * p), 3), nb, p, dimnames = list(NULL, paste0("v", 1:p)))
big <- data.frame(X)
big$y <- round(drop(X[, 1:6] %*% c(1, -0.8, 0.6, 0.5, -0.4, 0.3)) + rnorm(nb), 3)
big$yb <- rbinom(nb, 1, plogis(drop(X[, 1:4] %*% c(0.8, -0.6, 0.5, 0.4))))
upper <- reformulate(paste0("v", 1:p))
out$big <- list(
  lm = { t0 <- proc.time()[[3]]; r <- quiet(step(lm(y ~ 1, data = big), scope = upper)); list(seconds = proc.time()[[3]] - t0, terms = labels_of(r), anova = df_list(r$anova)) },
  glm = { t0 <- proc.time()[[3]]; r <- quiet(step(glm(yb ~ 1, family = binomial, data = big), scope = upper)); list(seconds = proc.time()[[3]] - t0, terms = labels_of(r), anova = df_list(r$anova)) })

cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
