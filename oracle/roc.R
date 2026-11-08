source("/oracle/_htest.R")

# ROC curves with pROC (fixtures roc, rocAuc, ciAuc, rocCoords). See oracle/roc-behaviour.md.
#
# Arguments (camelCase of pROC's): either `controls` and `cases`, or `response` and `predictor` (with `levels`,
# `naRm`); `responseIsString: true` marks a character response (the fixture writes every vector as strings).
# `direction` "auto" (default), "<" or ">". The expected fields keep pROC's names.
#   roc:       thresholds, sensitivities, specificities (in pROC's stored order), auc, direction, levels, controls,
#              cases (after removing NA and the observations outside `levels`). pROC returns NaN instead of a curve
#              for an infinite predictor value: then the expected value is {"value": "NaN"}.
#   rocAuc:    auc with partialAuc = c(a, b), partialAucFocus, partialAucCorrect (a decision for the user).
#   ciAuc:     ci.auc(method = "delong"): ci = [lower, auc, upper], var = var(roc) (DeLong), auc.
#   rocCoords: coords(roc, x, ret = "all") for x = "best" (bestMethod, bestWeights) or numeric thresholds. Every
#              column is an array (one value per row). Where pROC is inaccurate the case has a `reference` (exact
#              rational arithmetic, rounded once) with `refKind`:
#                ties          the set of "best" rows differs: pROC compares floating-point criteria with == and loses
#                              rows whose criterion is mathematically equal to the maximum;
#                counts        tp, fn, tn or fp are not integers (pROC rebuilds them as se * ncases, ...);
#                cancellation  a column is off by more than 1e-13 relative (fpr = 1 - sp, lr_pos, lr_neg, ... near
#                              sp = 1 or se = 1).

# oracle-memory: 1g

suppressPackageStartupMessages({ library(pROC); library(gmp); library(Rmpfr) })
data(aSAH)

set.seed(20261109)
datasets <- list()
dset <- function(name, controls, cases) datasets[[name]] <<- list(controls = controls, cases = cases)
dset("small", c(1, 2, 2, 3, 5, 7), c(2, 4, 5, 5, 8, 9, 10))
dset("noties", c(0.3, 1.1, 1.9, 2.2, 3.4), c(1.5, 2.8, 3.9, 4.4))
dset("tiesAcross", c(1, 1, 2, 2, 3, 3), c(2, 2, 3, 3, 4, 4))
dset("perfect", c(1, 2, 3), c(4, 5))
dset("inverse", c(4, 5, 6), c(1, 2, 3))
dset("allEqual", c(1, 1, 1), c(1, 1))
dset("oneEach", 1, 2)
dset("oneCase", c(1, 2, 3), 2.5)
dset("oneControl", 2.5, c(1, 2, 3, 4))
dset("tieYouden", c(1, 2, 3, 4, 5, 6), c(3.5, 5.5, 7))
dset("lostTies1", c(0, 12, 2, 11, 11), c(15, 4, 3, 8, 7, 15, 2, 2, 13, 9, 5, 3, 5, 8, 1))
dset("lostTies2", c(7, 10, 12, 6, 10, 6), c(5, 2, 3, 1, 12, 14, 12, 14, 3, 14, 8, 13))
dset("lostTopleft", c(6, -2, 4, 11, 7, 6, 4, 1, 0, 11, 11, -1, 6, 0, 12), c(14, 13, 9, 13, 7))
dset("negative", c(-3.5, -1, -0.25, 0), c(-2, 0.5, 1, 7))
dset("s100b", aSAH$s100b[aSAH$outcome == "Good"], aSAH$s100b[aSAH$outcome == "Poor"])
dset("wfns", as.numeric(aSAH$wfns[aSAH$outcome == "Good"]), as.numeric(aSAH$wfns[aSAH$outcome == "Poor"]))
dset("ndka", aSAH$ndka[aSAH$outcome == "Good"], aSAH$ndka[aSAH$outcome == "Poor"])
dset("norm40", rnorm(40), rnorm(35, 1))
dset("rounded", round(rnorm(150), 1), round(rnorm(120, 0.7), 1))
dset("ordinal", sample(1:5, 60, TRUE, prob = c(5, 4, 3, 2, 1)), sample(1:5, 50, TRUE, prob = c(1, 2, 3, 4, 5)))
dset("large", round(rnorm(1500), 2), round(rnorm(1200, 0.4), 2))
dset("sparseFp", c(rep(0, 9999), 2), c(1, 1, 3))                      # fpr = 1e-4 at threshold 1.5
dset("adjacent", c(1, 1 + 2^-52), c(1 + 2^-52, 1 + 2^-51))
dset("subnormal", c(5e-324, 1.5e-323), c(1e-323, 2e-323))
dset("huge", c(-1.7e308, 1.7e308), c(1.79e308, 1e308))
for (k in c(-1070, -1000, -600, 600, 1000, 1019)) {
  datasets[[paste0("small2^", k)]] <- list(controls = datasets$small$controls * 2^k, cases = datasets$small$cases * 2^k)
}

# Builds the curve from an argument list (NULL arguments are left out, so that `levels` stays missing)
make_roc <- function(a) {
  if (!is.null(a$controls)) {
    return(call_with(roc, list(controls = a$controls, cases = a$cases, direction = a$direction, quiet = TRUE)))
  }
  response <- if (isTRUE(a$responseIsString)) as.character(a$response) else a$response
  call_with(roc, list(response = response, predictor = a$predictor, levels = a$levels, direction = a$direction,
                      na.rm = a$naRm, quiet = TRUE))
}

# ---- roc ----
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (nm in names(datasets)) {
  d <- datasets[[nm]]
  for (dir in if (nm %in% c("large", "sparseFp")) "auto" else c("auto", "<", ">")) add(controls = d$controls, cases = d$cases, direction = if (dir != "auto") dir)
}
# response/predictor: levels, order, NA, more than two levels, character responses
add(response = c(0, 1, 1, 0, 1, 0, 1), predictor = c(1, 2, 3, 4, 5, 2, 7))
add(response = c(0, 1, 1, 0, 1, 0, 1), predictor = c(1, 2, 3, 4, 5, 2, 7), levels = c(1, 0))
add(response = c(0, 1, 1, 0, 1, 0, 1), predictor = c(1, 2, 3, 4, 5, 2, 7), levels = c(1, 0), direction = "<")
add(response = c(0, 1, 1, 0, 2, 1), predictor = c(1, 2, 3, 4, 5, 6))                     # 3 levels: warning
add(response = c(0, 1, 1, 0, 2, 1), predictor = c(1, 2, 3, 4, 5, 6), levels = c(0, 2))
add(response = c(0, 1, 1, 0, 2, 1), predictor = c(1, 2, 3, 4, 5, 6), levels = c(2, 1))
add(response = c("b", "a", "a", "b", "a"), predictor = c(1, 2, 3, 4, 0), responseIsString = TRUE)
add(response = c("pos", "neg", "neg", "pos", "neg"), predictor = c(5, 2, 3, 4, 0), responseIsString = TRUE)
add(response = c("pos", "neg", "neg", "pos", "neg"), predictor = c(5, 2, 3, 4, 0), levels = c("neg", "pos"),
    responseIsString = TRUE)
add(response = c(0, 1, NA, 0, 1, 1), predictor = c(1, 2, 3, NA, 6, NaN))
add(response = c(0, 1, NA, 0, 1, 1), predictor = c(1, 2, 3, NA, 6, 4), naRm = FALSE)
add(response = c(0, 1, 0, 1), predictor = c(1, 2, 3, 4), direction = "<")
# errors and NaN results
add(response = c(0, 0, 0), predictor = c(1, 2, 3))
add(response = c(0, 0, 1), predictor = c(1, 2, 3), levels = c(0, 2))
add(response = c(0, 0, 1), predictor = c(1, 2, 3), levels = c(0, 1, 2))
add(response = c(0, 0, 1), predictor = c(1, 2))
add(response = c(0, 0, 1, 1), predictor = c(1, 2, 3, 4), direction = "x")
add(response = c(0, 1, 0, 1), predictor = c(1, Inf, 3, 4))
add(controls = c(1, -Inf), cases = c(2, 3))
add(controls = numeric(0), cases = c(2, 3))
add(controls = c(NA, NA), cases = c(2, 3))

write_htest_fixture("roc", cases, function(a) {
  r <- make_roc(a)
  if (!inherits(r, "roc")) return(list(value = num2str(r)))
  list(thresholds = I(num2str(r$thresholds)), sensitivities = I(num2str(r$sensitivities)),
       specificities = I(num2str(r$specificities)), auc = num2str(as.numeric(r$auc)), direction = r$direction,
       levels = I(as.character(r$levels)), controls = I(num2str(r$controls)), cases = I(num2str(r$cases)))
}, warnings = TRUE)

# ---- rocAuc (partial AUC) ----
cases <- list()
pa <- list(c(1, 0.8), c(0.8, 1), c(0.9, 0.85), c(0.951, 0.95), c(1, 0), c(0.5, 0), c(1, 0.9))
for (nm in c("small", "s100b", "ndka", "norm40", "inverse", "perfect")) {
  d <- datasets[[nm]]
  for (p in pa) for (focus in c("specificity", "sensitivity")) for (corr in c(FALSE, TRUE)) {
    cases[[length(cases) + 1]] <- list(controls = d$controls, cases = d$cases, partialAuc = p, partialAucFocus = focus,
                                       partialAucCorrect = corr)
  }
}
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases)
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, partialAuc = 0.8)
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases,
                                   partialAuc = c(1.2, 0.8))
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases,
                                   partialAuc = c(1, 0.8), partialAucFocus = "se")
write_htest_fixture("rocAuc", cases, function(a) {
  r <- make_roc(a)
  args <- list(roc = r, partial.auc = a$partialAuc, partial.auc.focus = a$partialAucFocus,
               partial.auc.correct = a$partialAucCorrect)
  list(auc = num2str(as.numeric(call_with(auc, args))))
}, warnings = TRUE)

# ---- ciAuc (DeLong) ----
cases <- list()
for (nm in names(datasets)) {
  d <- datasets[[nm]]
  cases[[length(cases) + 1]] <- list(controls = d$controls, cases = d$cases)
  if (nm %in% c("small", "s100b", "norm40", "rounded", "inverse")) {
    cases[[length(cases) + 1]] <- list(controls = d$controls, cases = d$cases, direction = ">")
    for (cl in c(0, 0.5, 0.9, 0.99, 0.999999, 1)) cases[[length(cases) + 1]] <- list(controls = d$controls,
                                                                                    cases = d$cases, confLevel = cl)
  }
}
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, method = "del")
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, method = "foo")
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, confLevel = 1.1)
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, confLevel = -0.1)
write_htest_fixture("ciAuc", cases, function(a) {
  r <- make_roc(a)
  ci <- call_with(ci.auc, list(roc = r, conf.level = a$confLevel, method = a$method))
  v <- if (length(r$controls) > 1 && length(r$cases) > 1) var(r) else NA
  list(ci = I(num2str(as.numeric(ci))), var = num2str(as.numeric(v)), auc = num2str(as.numeric(r$auc)))
}, warnings = TRUE)

# ---- rocCoords ----
COLS <- c("threshold", "sensitivity", "specificity", "accuracy", "tn", "tp", "fn", "fp", "npv", "ppv", "fpr",
          "lr_pos", "lr_neg", "youden", "closest.topleft")
cases <- list()
for (nm in c("small", "noties", "tiesAcross", "perfect", "inverse", "allEqual", "tieYouden", "lostTies1", "lostTies2",
             "lostTopleft", "s100b", "wfns", "ndka", "norm40", "rounded", "ordinal", "sparseFp", "oneCase")) {
  d <- datasets[[nm]]
  for (bm in c("youden", "closest.topleft")) {
    cases[[length(cases) + 1]] <- list(controls = d$controls, cases = d$cases, x = "best", bestMethod = bm)
    if (nm %in% c("small", "s100b", "norm40")) {
      for (w in list(c(1, 0.3), c(2, 0.5), c(0.5, 0.1))) cases[[length(cases) + 1]] <-
        list(controls = d$controls, cases = d$cases, x = "best", bestMethod = bm, bestWeights = w)
      cases[[length(cases) + 1]] <- list(controls = d$controls, cases = d$cases, direction = ">", x = "best",
                                         bestMethod = bm)
    }
  }
  pr <- sort(unique(c(d$controls, d$cases)))
  thr <- unique(c(pr[c(1, ceiling(length(pr) / 2), length(pr))], (pr[1] + pr[min(2, length(pr))]) / 2,
                  -Inf, Inf, pr[1] - 1, pr[length(pr)] + 1))
  cases[[length(cases) + 1]] <- list(controls = d$controls, cases = d$cases, x = thr)
  if (nm %in% c("small", "s100b")) cases[[length(cases) + 1]] <- list(controls = d$controls, cases = d$cases,
                                                                     direction = ">", x = thr)
}
cases[[length(cases) + 1]] <- list(controls = datasets$sparseFp$controls, cases = datasets$sparseFp$cases,
                                   x = c(0.5, 1.5, 2.5))
cases[[length(cases) + 1]] <- list(controls = 1:10, cases = seq(0.5, 49, by = 1), x = "best")   # 49 cases
cases[[length(cases) + 1]] <- list(controls = 1:10, cases = seq(0.5, 49, by = 1), x = c(17, 22, 33))
# argument checks
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, x = "be")
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, x = "best",
                                   bestMethod = "topleft")
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, x = "best",
                                   bestMethod = "foo")
for (w in list(c(1, 0), c(1, 1), c(1, 1.5), c(-1, 0.5), c(0, 0.5), 1)) cases[[length(cases) + 1]] <-
  list(controls = datasets$small$controls, cases = datasets$small$cases, x = "best", bestWeights = I(w))
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, x = numeric(0))
cases[[length(cases) + 1]] <- list(controls = datasets$small$controls, cases = datasets$small$cases, x = NaN)

coords_fun <- function(a) {
  r <- make_roc(a)
  x <- if (is.character(a$x)) a$x else unclass(a$x)
  co <- call_with(coords, list(roc = r, x = x, ret = "all", best.method = a$bestMethod,
                               best.weights = if (!is.null(a$bestWeights)) unclass(a$bestWeights), transpose = FALSE))
  out <- lapply(COLS, function(cn) I(num2str(co[[cn]])))
  names(out) <- COLS
  out
}

# Exact coordinates (rational arithmetic, rounded once to double)
q2d <- function(q) {
  v <- rep(NaN, length(q))
  for (i in seq_along(q)) if (!is.na(q[i])) v[i] <- asNumeric(mpfr(q[i], 53))
  v
}
qdiv <- function(n, d) {
  # n / d for integers, with Inf for n > 0 = d and NaN for 0/0
  out <- rep(NaN, length(n))
  ok <- d != 0
  out[ok] <- q2d(as.bigq(n[ok], d[ok]))
  out[!ok & n > 0] <- Inf
  out
}
exact_coords <- function(a, thr) {
  r <- make_roc(a)
  ctrl <- r$controls; cs <- r$cases; P <- length(cs); N <- length(ctrl)
  if (r$direction == "<") {
    tp <- vapply(thr, function(t) sum(cs >= t), 0); tn <- vapply(thr, function(t) sum(ctrl < t), 0)
  } else {
    tp <- vapply(thr, function(t) sum(cs <= t), 0); tn <- vapply(thr, function(t) sum(ctrl > t), 0)
  }
  fn <- P - tp; fp <- N - tn
  w <- if (is.null(a$bestWeights)) c(1, 0.5) else unclass(a$bestWeights)
  rq <- (1 - as.bigq(w[2])) / (as.bigq(w[1]) * as.bigq(w[2]))
  se <- as.bigq(tp, P); sp <- as.bigq(tn, N)
  youden <- se + rq * sp
  topleft <- as.bigq(fn, P)^2 + rq * as.bigq(fp, N)^2
  lrpos <- ifelse(fp == 0, ifelse(tp == 0, NaN, Inf), NA); lrneg <- ifelse(tn == 0, ifelse(fn == 0, NaN, Inf), NA)
  i <- which(fp > 0); if (length(i)) lrpos[i] <- q2d(as.bigq(tp[i] * N, P * fp[i]))
  i <- which(tn > 0); if (length(i)) lrneg[i] <- q2d(as.bigq(fn[i] * N, P * tn[i]))
  list(threshold = thr, sensitivity = q2d(se), specificity = q2d(sp), accuracy = q2d(as.bigq(tp + tn, P + N)),
       tn = tn, tp = tp, fn = fn, fp = fp, npv = qdiv(tn, tn + fn), ppv = qdiv(tp, tp + fp), fpr = q2d(as.bigq(fp, N)),
       lr_pos = lrpos, lr_neg = lrneg, youden = q2d(youden), closest.topleft = q2d(topleft),
       crit = if (identical(a$bestMethod, "closest.topleft")) -topleft else youden)
}
coords_ref <- function(a) {
  w <- if (is.null(a$bestWeights)) c(1, 0.5) else unclass(a$bestWeights)
  if (!(length(w) == 2 && w[1] > 0 && w[2] > 0 && w[2] < 1)) return(NULL)
  got <- coords_fun(a)
  r <- make_roc(a)
  if (is.character(a$x)) {
    ex <- exact_coords(a, r$thresholds)
    best <- which(ex$crit == max(ex$crit))
    # pROC's rows come in the order of its sorted curve (increasing specificity)
    best <- best[order(ex$specificity[best], -ex$sensitivity[best])]
    ex <- lapply(ex[COLS], function(v) v[best])
  } else {
    ex <- exact_coords(a, unclass(a$x))[COLS]
  }
  kind <- NULL
  gv <- lapply(got, function(v) as.numeric(unclass(v)))
  if (length(gv$threshold) != length(ex$threshold) || any(gv$threshold != ex$threshold)) {
    kind <- "ties"
  } else {
    if (any(c(gv$tp, gv$fn, gv$tn, gv$fp) != round(c(gv$tp, gv$fn, gv$tn, gv$fp)))) kind <- "counts"
    rel <- unlist(lapply(COLS, function(cn) {
      g <- gv[[cn]]; e <- ex[[cn]]
      ifelse(is.nan(g) & is.nan(e), 0, ifelse(g == e, 0, abs(g - e) / abs(e)))
    }))
    if (any(is.na(rel) | rel > 1e-13)) kind <- c(kind, "cancellation")
  }
  if (is.null(kind)) return(NULL)
  out <- lapply(ex, function(v) I(num2str(v)))
  c(list(refKind = if (length(kind) == 1) kind else I(kind)), out)
}
write_htest_fixture("rocCoords", cases, coords_fun, coords_ref, warnings = TRUE)
