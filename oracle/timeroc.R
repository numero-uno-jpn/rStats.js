# issue: 569
# oracle-platform: amd64
# Public outputs of timeROC 0.4.1 (timeROC, confint, compare, SeSpPPVNPV) and survivalROC 1.0.3.1 (KM) for
# test/fixtures/timeroc.json (1.19.0). The behaviour is in oracle/tdroc-behaviour.md; the experiments behind it in
# experiments/tdroc119-*.R. Public calls only. Data sets with ties (point estimates, weights) and without ties (also the
# iid representation, standard errors, confint and compare, which rStats.js computes in the tie-correct form: equal to
# R's only without ties). The data sets are written out so that the tests use the same values.
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(timeROC); library(survivalROC) })
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
out <- list(R = R.version.string, arch = R.version$arch, timeROC = as.character(packageVersion("timeROC")),
            survivalROC = as.character(packageVersion("survivalROC")))
r6 <- function(x) round(x, 6)
make <- function(seed, n, cr, ties) {
  set.seed(seed)
  marker <- round(rnorm(n), if (ties) 1 else 6)
  other <- round(marker + rnorm(n), 6)
  t1 <- rexp(n, exp(0.8 * marker) / 10); t2 <- rexp(n, 1 / 15); cc <- rexp(n, 1 / 15)
  tt <- if (cr) pmin(t1, t2, cc) else pmin(t1, cc)
  T <- if (ties) round(tt) + 1 else r6(tt) + 0.5
  delta <- if (cr) ifelse(cc <= pmin(t1, t2), 0, ifelse(t1 <= t2, 1, 2)) else as.numeric(t1 <= cc)
  list(T = T, delta = delta, marker = marker, other = other)
}
data <- list(
  ties = make(20261201, 40, FALSE, TRUE), smooth = make(20261202, 45, FALSE, FALSE),
  crTies = make(20261203, 50, TRUE, TRUE), crSmooth = make(20261204, 50, TRUE, FALSE))
out$data <- data
times <- list(ties = c(5, 10, 15), smooth = c(4.1, 8.3, 12.7), crTies = c(4, 8, 12), crSmooth = c(4.1, 8.3, 12.7), crCi = c(2.1, 4.3, 6.7))
out$times <- times

fit_out <- function(r) {
  cr <- inherits(r, "ipcwcompetingrisksROC")
  cols <- function(m) if (is.null(m)) NULL else if (is.null(dim(m))) list(unname(as.vector(m))) else lapply(seq_len(ncol(m)), function(j) unname(m[, j]))
  res <- list(class = class(r), times = unname(r$times), n = r$n, cumInc = unname(r$CumulativeIncidence),
              survProb = unname(r$survProb), stats = unname(r$Stats), statsNames = colnames(r$Stats),
              ipcwTimes = cols(r$weights$IPCW.times), ipcwSubject = unname(r$weights$IPCW.subjectTimes))
  if (cr) { res$auc1 <- unname(r$AUC_1); res$auc2 <- unname(r$AUC_2); res$tp <- cols(r$TP); res$fp1 <- cols(r$FP_1); res$fp2 <- cols(r$FP_2) }
  else { res$auc <- unname(r$AUC); res$tp <- cols(r$TP); res$fp <- cols(r$FP) }
  if (isTRUE(r$iid)) {
    res$sd1 <- unname(r$inference$vect_sd_1); res$iid1 <- cols(r$inference$mat_iid_rep_1)
    if (cr) { res$sd2 <- unname(r$inference$vect_sd_2); res$iid2 <- cols(r$inference$mat_iid_rep_2) }
  }
  res
}
call_tr <- function(d, t, weighting = "marginal", iid = FALSE, other = FALSE, marker = d$marker) {
  if (other) timeROC(T = d$T, delta = d$delta, marker = marker, other_markers = as.matrix(d$other), cause = 1, weighting = weighting, times = t, iid = iid)
  else timeROC(T = d$T, delta = d$delta, marker = marker, cause = 1, weighting = weighting, times = t, iid = iid)
}
out$fits <- list(); out$errors <- list()
for (nm in names(data)) {
  d <- data[[nm]]; t <- times[[nm]]
  r <- run(call_tr(d, t, iid = TRUE))
  # R's competing-risks iid fails ("incorrect number of dimensions") when a subset of the subjects has one row
  if (is.null(r$error)) out$fits[[nm]] <- fit_out(r$value) else {
    out$errors[[paste0(nm, "_iid")]] <- r$error
    out$fits[[nm]] <- fit_out(call_tr(d, t))
    for (k in seq_along(t)) { rk <- run(call_tr(d, t[k], iid = TRUE)); out$errors[[paste0(nm, "_iid_t", k)]] <- list(error = rk$error, stats = unname(call_tr(d, t[k])$Stats)) }
  }
  out$fits[[paste0(nm, "_cox")]] <- fit_out(call_tr(d, t, weighting = "cox", other = TRUE))
  out$fits[[paste0(nm, "_cox0")]] <- fit_out(call_tr(d, t, weighting = "cox"))
}
out$fits$smooth_aalen <- fit_out(call_tr(data$smooth, times$smooth, weighting = "aalen"))
out$fits$smooth_aalen_other <- fit_out(call_tr(data$smooth, times$smooth, weighting = "aalen", other = TRUE))
out$fits$crSmooth_aalen <- fit_out(call_tr(data$crSmooth, times$crSmooth, weighting = "aalen"))
out$fits$crSmooth_ci <- fit_out(call_tr(data$crSmooth, times$crCi, iid = TRUE))
out$fits$ties_single <- fit_out(call_tr(data$ties, 10, iid = TRUE))
out$errors$cox_iid <- (run(call_tr(data$ties, times$ties, weighting = "cox", iid = TRUE))$error)

# confint and compare on the data without ties (where the iid equals R's)
ci_out <- function(ci) lapply(ci, function(x) if (is.matrix(x)) unname(x) else unname(x))
s1 <- call_tr(data$smooth, times$smooth, iid = TRUE)
s2 <- call_tr(data$smooth, times$smooth, iid = TRUE, marker = data$smooth$other)
set.seed(1); out$confint <- list(smooth = ci_out(confint(s1)))
set.seed(7); out$confint$smooth90 <- ci_out(confint(s1, level = 0.9, n.sim = 500))
c1 <- call_tr(data$crSmooth, times$crCi, iid = TRUE)
c2 <- call_tr(data$crSmooth, times$crCi, iid = TRUE, marker = data$crSmooth$other)
set.seed(3); out$confint$crSmooth <- ci_out(confint(c1))
out$confint$names <- names(confint(c1)); out$confint$dimnames <- dimnames(confint(s1)$CI_AUC)
out$compare <- list(smooth = lapply(compare(s1, s2), unname), smoothAdj = lapply(compare(s1, s2, adjusted = TRUE), unname),
                    crSmooth = lapply(compare(c1, c2), unname), crSmoothAdj = lapply(compare(c1, c2, adjusted = TRUE), unname))

# SeSpPPVNPV
sp_out <- function(s) {
  keep <- setdiff(names(s), c("weights", "computation_time", "inference", "Stats"))
  res <- lapply(s[keep], unname)
  res$stats <- unname(s$Stats); res$statsNames <- colnames(s$Stats)
  if (isTRUE(s$iid)) res$se <- lapply(s$inference[grepl("^vect", names(s$inference))], unname)
  res
}
cut_t <- sort(unique(data$ties$marker))[12]
out$sespppv <- list(
  ties = sp_out(SeSpPPVNPV(cutpoint = cut_t, T = data$ties$T, delta = data$ties$delta, marker = data$ties$marker, cause = 1, times = times$ties, iid = TRUE)),
  smooth = sp_out(SeSpPPVNPV(cutpoint = 0.2, T = data$smooth$T, delta = data$smooth$delta, marker = data$smooth$marker, cause = 1, times = times$smooth, iid = TRUE)),
  crSmooth = sp_out(SeSpPPVNPV(cutpoint = 0.2, T = data$crSmooth$T, delta = data$crSmooth$delta, marker = data$crSmooth$marker, cause = 1, times = times$crSmooth, iid = TRUE)),
  crTies = sp_out(SeSpPPVNPV(cutpoint = 0.3, T = data$crTies$T, delta = data$crTies$delta, marker = data$crTies$marker, cause = 1, times = times$crTies)),
  smoothCox = sp_out(SeSpPPVNPV(cutpoint = 0.2, T = data$smooth$T, delta = data$smooth$delta, marker = data$smooth$marker, other_markers = as.matrix(data$smooth$other), cause = 1, weighting = "cox", times = times$smooth)))
out$sespppv$cut_ties <- cut_t

# survivalROC KM
sr <- function(d, pt, cuts = NULL) { r <- if (is.null(cuts)) survivalROC(Stime = d$T, status = as.numeric(d$delta == 1), marker = d$marker, predict.time = pt, method = "KM")
  else survivalROC(Stime = d$T, status = as.numeric(d$delta == 1), marker = d$marker, predict.time = pt, method = "KM", cut.values = cuts); lapply(r, unname) }
out$survivalROC <- list(ties = sr(data$ties, 8), smooth = sr(data$smooth, 6.3), cuts = sr(data$smooth, 6.3, c(-1, 0, 0.5, 1.5)),
                        late = sr(data$ties, 30))
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "timeroc.json"))
