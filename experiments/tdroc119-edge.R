# tdroc119-edge.R: timeROC, SeSpPPVNPV, compare and survivalROC on degenerate data and at extreme scales (1.19.0, the
# comprehensive edge pass): what R returns or which error it gives. The data of oracle/timeroc.R's "ties" and
# "crTies" sets (regenerated with the same code and seeds).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(timeROC); library(survivalROC) })
out <- list(R = R.version.string, arch = R.version$arch)
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
make <- function(seed, n, cr, ties) {
  set.seed(seed)
  marker <- round(rnorm(n), if (ties) 1 else 6)
  other <- round(marker + rnorm(n), 6)
  t1 <- rexp(n, exp(0.8 * marker) / 10); t2 <- rexp(n, 1 / 15); cc <- rexp(n, 1 / 15)
  tt <- if (cr) pmin(t1, t2, cc) else pmin(t1, cc)
  T <- if (ties) round(tt) + 1 else round(tt, 6) + 0.5
  delta <- if (cr) ifelse(cc <= pmin(t1, t2), 0, ifelse(t1 <= t2, 1, 2)) else as.numeric(t1 <= cc)
  list(T = T, delta = delta, marker = marker, other = other)
}
d <- make(20261201, 40, FALSE, TRUE)
cr <- make(20261203, 50, TRUE, TRUE)
fo <- function(r) { if (!is.null(r$error)) return(list(error = r$error, warnings = r$warnings)); x <- r$value
  res <- list(warnings = r$warnings, times = unname(x$times))
  for (k in c("AUC", "AUC_1", "AUC_2", "TP", "FP", "PPV", "NPV", "NPV_1", "NPV_2", "FP_1", "FP_2", "p_values_AUC", "Cor", "CI_AUC", "CB_AUC", "C.alpha", "cut.values", "Survival")) if (!is.null(x[[k]])) res[[k]] <- unname(x[[k]])
  # (replaced: x$inference is not a list without iid, and $ on it stopped the script)
  if (is.list(x$inference) && !is.null(x$inference$vect_sd_1)) res$sd1 <- unname(x$inference$vect_sd_1)
  if (is.list(x$inference) && !is.null(x$inference$vect_se_Se)) res$seSe <- unname(x$inference$vect_se_Se)
  if (!is.null(x$Stats)) res$Stats <- unname(x$Stats)
  res }
tr <- function(T, delta, marker, times, ...) fo(run(timeROC(T = T, delta = delta, marker = marker, cause = 1, times = times, ...)))
out$equalMarkers <- tr(d$T, d$delta, rep(1, 40), c(5, 10), iid = TRUE)
out$beforeFirst <- tr(d$T, d$delta, d$marker, 0.5, iid = TRUE)
out$beyondMax <- tr(d$T, d$delta, d$marker, 1e6, iid = TRUE)
out$atMax <- tr(d$T, d$delta, d$marker, max(d$T), iid = TRUE)
out$allCensored <- tr(d$T, rep(0, 40), d$marker, 5, iid = TRUE)
out$noCensoring <- tr(d$T, rep(1, 40), d$marker, 5, iid = TRUE)
out$causeAbsent <- fo(run(timeROC(T = cr$T, delta = cr$delta, marker = cr$marker, cause = 3, times = 5, iid = TRUE)))
out$n2 <- tr(c(3, 8), c(1, 0), c(0.5, 0.1), 5, iid = TRUE)
out$negativeT <- tr(d$T - 10, d$delta, d$marker, -5, iid = TRUE)
out$naMarker <- tr(d$T, d$delta, replace(d$marker, 1, NA), 5)
out$coxConstOther <- tr(d$T, d$delta, d$marker, c(5, 10), weighting = "cox", other_markers = as.matrix(rep(1, 40)))
out$coxCollinear <- tr(d$T, d$delta, d$marker, c(5, 10), weighting = "cox", other_markers = as.matrix(2 * d$marker))
out$coxMarkerOnly <- tr(d$T, d$delta, d$marker, c(5, 10), weighting = "cox")
out$coxAllCensored <- tr(d$T, rep(0, 40), d$marker, 5, weighting = "cox")
out$coxNoCensoring <- tr(d$T, rep(1, 40), d$marker, 5, weighting = "cox")
out$aalenConstMarker <- tr(d$T, d$delta, rep(1, 40), c(5, 10), weighting = "aalen")
out$aalenCollinear <- tr(d$T, d$delta, d$marker, c(5, 10), weighting = "aalen", other_markers = as.matrix(2 * d$marker))
out$aalenNoCensoring <- tr(d$T, rep(1, 40), d$marker, 5, weighting = "aalen")
out$scaleMarker300 <- tr(d$T, d$delta, d$marker * 1e300, c(5, 10), iid = TRUE)
out$scaleT300 <- tr(d$T * 1e-300, d$delta, d$marker, c(5, 10) * 1e-300, iid = TRUE)
out$scaleTcox <- tr(d$T * 1e-300, d$delta, d$marker, c(5, 10) * 1e-300, weighting = "cox")
out$common1e8cox <- tr(d$T + 1e8, d$delta, d$marker, c(5, 10) + 1e8, weighting = "cox")
out$coxMarker300 <- tr(d$T, d$delta, d$marker * 1e300, c(5, 10), weighting = "cox")
sp <- function(cut, ...) fo(run(SeSpPPVNPV(cutpoint = cut, T = d$T, delta = d$delta, marker = d$marker, cause = 1, times = 5, ...)))
out$sespAbove <- sp(100, iid = TRUE)
out$sespBelow <- sp(-100, iid = TRUE)
x <- timeROC(T = d$T, delta = d$delta, marker = d$marker, cause = 1, times = c(5, 10, 15), iid = TRUE)
out$compareIdentical <- fo(run(compare(x, x, adjusted = TRUE)))
out$confintBeforeFirst <- { y <- timeROC(T = d$T, delta = d$delta, marker = d$marker, cause = 1, times = c(0.5, 5), iid = TRUE); set.seed(1); fo(run(confint(y, n.sim = 50))) }
sr <- function(...) fo(run(survivalROC(Stime = d$T, status = d$delta, method = "KM", ...)))
out$srocBeforeFirst <- sr(marker = d$marker, predict.time = 0.5)
out$srocAfterLast <- sr(marker = d$marker, predict.time = 1e6)
out$srocOneCut <- sr(marker = d$marker, predict.time = 8, cut.values = 0)
out$srocEqualMarkers <- sr(marker = rep(1, 40), predict.time = 8)
out$srocAllCensored <- fo(run(survivalROC(Stime = d$T, status = rep(0, 40), marker = d$marker, predict.time = 5, method = "KM")))
out$srocScale <- fo(run(survivalROC(Stime = d$T * 1e-300, status = d$delta, marker = d$marker * 1e300, predict.time = 8e-300, method = "KM")))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
