# step115-edge.R: stats' step on extreme inputs, public functions only (1.15.0): the response and the predictors
# scaled by 1e±150 and 1e±300, a common value of 1e8 and 1e15 added, case weights scaled by 1e±200, a poisson glm with
# an offset shifted by 1e2 (log scale) and predictors scaled by 1e±150, a binomial glm with scaled predictors, 60
# candidate terms, a factor with 20 levels, and the time of each. For each: the selected terms, the path ($anova) and
# R's warnings or error. The scaled models have the same path in theory, with every criterion shifted by n log(c²)
# (lm, response times c) or unchanged (predictors scaled, weights for glm).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
run <- function(expr) {
  warns <- character(0)
  t0 <- proc.time()[[3]]
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
  secs <- proc.time()[[3]] - t0
  if (inherits(value, "caught")) return(list(error = value$message, warnings = unique(warns), seconds = secs))
  c(value, list(warnings = unique(warns), seconds = secs))
}
df_list <- function(d) c(list(rownames = rownames(d)), lapply(as.list(d), function(v) if (is.factor(v)) as.character(v) else v))
quiet <- function(e) { r <- NULL; invisible(capture.output(r <- e)); r }
res <- function(r) list(terms = attr(terms(r), "term.labels"), anova = df_list(r$anova))

set.seed(20261201)
n <- 80
base <- data.frame(x1 = rnorm(n), x2 = rnorm(n), x3 = rnorm(n), x4 = rnorm(n), x5 = rnorm(n),
                   f = sample(c("a", "b", "c"), n, TRUE))
base$y <- 1 + 0.9 * base$x1 - 0.5 * base$x2 + 0.25 * base$x3 + 0.3 * (base$f == "c") + rnorm(n)
base$w <- runif(n, 0.3, 3)
base$cnt <- rpois(n, exp(0.4 + 0.5 * base$x1 + 0.3 * base$x3))
base$yb <- rbinom(n, 1, plogis(0.2 + 1.2 * base$x1 - 0.8 * base$x2))
base$e <- runif(n, 1, 3)
upper <- ~ x1 + x2 + x3 + x4 + x5 + f
out <- list(R = R.version.string, data = base)

lm_case <- function(transform) run({
  d <- transform(base); assign("cur", d, envir = globalenv())
  res(quiet(step(lm(y ~ 1, data = cur), scope = upper)))
})
out$lm <- list(
  plain = lm_case(identity),
  y_1e150 = lm_case(function(d) { d$y <- d$y * 1e150; d }),
  y_1em150 = lm_case(function(d) { d$y <- d$y * 1e-150; d }),
  y_1e300 = lm_case(function(d) { d$y <- d$y * 1e300; d }),
  y_1em300 = lm_case(function(d) { d$y <- d$y * 1e-300; d }),
  x_1e150 = lm_case(function(d) { d$x1 <- d$x1 * 1e150; d$x2 <- d$x2 * 1e-150; d }),
  x_1e300 = lm_case(function(d) { d$x1 <- d$x1 * 1e300; d$x2 <- d$x2 * 1e-300; d }),
  y_shift_1e8 = lm_case(function(d) { d$y <- d$y + 1e8; d }),
  y_shift_1e15 = lm_case(function(d) { d$y <- d$y + 1e15; d }),
  x_shift_1e8 = lm_case(function(d) { d$x1 <- d$x1 + 1e8; d }),
  x_shift_1e15 = lm_case(function(d) { d$x1 <- d$x1 + 1e15; d }))
lmw_case <- function(c) run({
  d <- base; d$w <- d$w * c; assign("cur", d, envir = globalenv())
  res(quiet(step(lm(y ~ x1 + x2 + x3 + x4 + x5 + f, data = cur, weights = w))))
})
out$weights <- list(w1 = lmw_case(1), w_1e200 = lmw_case(1e200), w_1em200 = lmw_case(1e-200), w_1e300 = lmw_case(1e300))

glm_case <- function(transform, family, response, offset = FALSE) run({
  d <- transform(base); assign("cur", d, envir = globalenv())
  fo <- as.formula(paste(response, "~ 1"))
  start <- if (offset) glm(fo, family = family, data = cur, offset = log(e)) else glm(fo, family = family, data = cur)
  res(quiet(step(start, scope = upper)))
})
out$glm <- list(
  poisson = glm_case(identity, poisson, "cnt"),
  poisson_offset = glm_case(identity, poisson, "cnt", TRUE),
  poisson_offset_shift = glm_case(function(d) { d$e <- d$e * exp(100); d }, poisson, "cnt", TRUE),
  poisson_x_1e150 = glm_case(function(d) { d$x1 <- d$x1 * 1e150; d$x3 <- d$x3 * 1e-150; d }, poisson, "cnt"),
  binomial = glm_case(identity, binomial, "yb"),
  binomial_x_1e150 = glm_case(function(d) { d$x1 <- d$x1 * 1e150; d$x2 <- d$x2 * 1e-150; d }, binomial, "yb"),
  binomial_x_shift_1e8 = glm_case(function(d) { d$x1 <- d$x1 + 1e8; d }, binomial, "yb"))

## many terms, a factor with many levels
set.seed(20261202)
nm <- 300; p <- 60
X <- matrix(rnorm(nm * p), nm, p, dimnames = list(NULL, paste0("v", 1:p)))
many <- data.frame(X); many$g20 <- sample(sprintf("L%02d", 1:20), nm, TRUE)
many$y <- drop(X[, 1:5] %*% c(1, -0.8, 0.6, 0.5, -0.4)) + 0.5 * (many$g20 %in% c("L01", "L02", "L03")) + rnorm(nm)
many$yb <- rbinom(nm, 1, plogis(drop(X[, 1:3] %*% c(0.9, -0.7, 0.5))))
out$many_data <- many
assign("cur", many, envir = globalenv())
up60 <- reformulate(c(paste0("v", 1:p), "g20"))
out$many <- list(
  lm_forward = run(res(quiet(step(lm(y ~ 1, data = cur), scope = up60, direction = "forward")))),
  lm_both = run(res(quiet(step(lm(y ~ 1, data = cur), scope = up60)))),
  lm_backward = run(res(quiet(step(lm(reformulate(c(paste0("v", 1:p), "g20"), "y"), data = cur), direction = "backward")))),
  glm_forward = run(res(quiet(step(glm(yb ~ 1, family = binomial, data = cur), scope = up60, direction = "forward")))))

cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", dataframe = "columns", pretty = FALSE))
