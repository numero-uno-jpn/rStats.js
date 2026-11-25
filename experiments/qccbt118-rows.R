# qccbt118-rows.R: the number of rows of qcc's limits with equal sizes, per type (1.18.0): the fixture gave one row per
# group for a p chart with equal sizes where xbar, np and c give one row. Also: R's ptukey / qtukey against a finer
# evaluation (integrate) of the range distribution with df = Inf, to see which of R and rStats.js is closer.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
set.seed(1)
cnt <- rpois(10, 5); m <- matrix(rnorm(30), 10, 3); x <- rnorm(10)
rows <- function(q) nrow(q$limits)
out <- list(
  p = rows(qcc(cnt, sizes = 50, type = "p", plot = FALSE)), np = rows(qcc(cnt, sizes = 50, type = "np", plot = FALSE)),
  c = rows(qcc(cnt, type = "c", plot = FALSE)), u = rows(qcc(cnt, sizes = 2, type = "u", plot = FALSE)),
  u1 = rows(qcc(cnt, sizes = 1, type = "u", plot = FALSE)), g = rows(suppressWarnings(qcc(cnt, type = "g", plot = FALSE))),
  xbar = rows(qcc(m, type = "xbar", plot = FALSE)), R = rows(qcc(m, type = "R", plot = FALSE)),
  S = rows(qcc(m, type = "S", plot = FALSE)), xone = rows(qcc(x, type = "xbar.one", plot = FALSE)),
  p_conf = tryCatch(rows(qcc(cnt, sizes = 50, type = "p", confidence.level = 0.9, plot = FALSE)), error = function(e) conditionMessage(e)),
  p_conf_vec = tryCatch(rows(qcc(cnt, sizes = rep(50, 10), type = "p", confidence.level = 0.9, plot = FALSE)), error = function(e) conditionMessage(e)),
  p_vec = rows(qcc(cnt, sizes = rep(50, 10), type = "p", plot = FALSE)),
  u_conf = tryCatch(rows(qcc(cnt, sizes = 2, type = "u", confidence.level = 0.9, plot = FALSE)), error = function(e) conditionMessage(e)),
  np_conf = tryCatch(rows(qcc(cnt, sizes = 50, type = "np", confidence.level = 0.9, plot = FALSE)), error = function(e) conditionMessage(e)))
prange <- function(w, n) integrate(function(z) n * dnorm(z) * (pnorm(z + w) - pnorm(z))^(n - 1), -Inf, Inf,
                                   rel.tol = 1e-13)$value
out$ptukey <- list(R = ptukey(c(2, 3.5, 5), 5, Inf), integ = sapply(c(2, 3.5, 5), prange, n = 5))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE))
