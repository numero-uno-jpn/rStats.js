# issue: 568
# oracle-platform: amd64
# Public outputs of qcc 2.7 for test/fixtures/qcc.json (1.18.0): qcc (every type, std.dev methods, nsigmas,
# confidence.level, given center / std.dev / limits, newdata, violations), cusum, ewma, ewmaSmooth, oc.curves,
# process.capability, mqcc, qcc.overdispersion.test, pareto.chart and qcc.groups. The behaviour is in
# oracle/qcc-bt-behaviour.md; the experiments behind it in experiments/qccbt118-*.R. Public calls only. The data sets
# are written out so that the tests chart the same values.
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
pdf(NULL)
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")),
            d2 = qcc.options("exp.R.unscaled"), d3 = qcc.options("se.R.unscaled"))
set.seed(20261125)
r4 <- function(x) round(x, 4)
bal <- r4(matrix(rnorm(20 * 5, 10, 2), 20, 5)); bal[7, ] <- bal[7, ] + 4
unb <- r4(matrix(rnorm(18 * 6, 3, 0.5), 18, 6))
unb[2, 3:6] <- NA; unb[5, 5:6] <- NA; unb[9, 4:6] <- NA; unb[13, 6] <- NA; unb[17, 3:6] <- NA
big <- r4(matrix(rnorm(10 * 30), 10, 30))
x1 <- r4(c(rnorm(25, 5, 1), 9, rnorm(4, 5, 1)))
sz <- sample(40:60, 25, TRUE); D <- rbinom(25, sz, 0.1); D[9] <- 18
Dc <- rbinom(25, 50, 0.1)
cnt <- rpois(25, 4); cnt[14] <- 13
usz <- sample(c(1, 1.5, 2, 2.5), 25, TRUE); ux <- rpois(25, 3 * usz)
gg <- rgeom(30, 0.05)
mats <- list(bal = bal, unb = unb, big = big)
vecs <- list(x1 = x1, sz = sz, D = D, Dc = Dc, cnt = cnt, usz = usz, ux = ux, gg = gg)
out$data <- list(mats = lapply(mats, function(m) unname(split(m, row(m)))), vecs = vecs)
assign("mats", mats, envir = globalenv()); assign("vecs", vecs, envir = globalenv())

lim_out <- function(L) unname(matrix(as.numeric(L), nrow(L)))
qcc_out <- function(q) list(statistics = unname(as.numeric(q$statistics)), sizes = unname(as.numeric(q$sizes)),
                            center = unname(as.numeric(q$center)), std_dev = unname(as.numeric(q$std.dev)),
                            limits = lim_out(q$limits), beyond = unname(q$violations$beyond.limits),
                            runs = unname(q$violations$violating.runs),
                            newstats = if (is.null(q$newstats)) NULL else unname(as.numeric(q$newstats)),
                            newsizes = if (is.null(q$newsizes)) NULL else unname(as.numeric(q$newsizes)))
# a case: data (name of a matrix or vector), type, options; newdata as rows from / to of the same data
cases <- list(
  list(data = "bal", type = "xbar"), list(data = "bal", type = "xbar", std = "UWAVE-SD"),
  list(data = "bal", type = "xbar", std = "MVLUE-R"), list(data = "bal", type = "xbar", std = "MVLUE-SD"),
  list(data = "bal", type = "xbar", std = "RMSDF"), list(data = "bal", type = "xbar", nsigmas = 2),
  list(data = "bal", type = "xbar", conf = 0.99), list(data = "bal", type = "xbar", center = 10, stdnum = 2),
  list(data = "bal", type = "xbar", split = 15), list(data = "bal", type = "xbar", limits = c(9, 12)),
  list(data = "bal", type = "R"), list(data = "bal", type = "R", std = "MVLUE-R"), list(data = "bal", type = "R", conf = 0.99),
  list(data = "bal", type = "R", center = 10, stdnum = 2), list(data = "bal", type = "R", split = 15),
  list(data = "bal", type = "S"), list(data = "bal", type = "S", std = "RMSDF"), list(data = "bal", type = "S", conf = 0.99),
  list(data = "bal", type = "S", nsigmas = 2),
  list(data = "unb", type = "xbar"), list(data = "unb", type = "xbar", std = "UWAVE-SD"),
  list(data = "unb", type = "xbar", std = "MVLUE-R"), list(data = "unb", type = "xbar", std = "MVLUE-SD"),
  list(data = "unb", type = "xbar", std = "RMSDF"), list(data = "unb", type = "xbar", conf = 0.9),
  list(data = "unb", type = "R"), list(data = "unb", type = "R", std = "MVLUE-R"), list(data = "unb", type = "R", conf = 0.9),
  list(data = "unb", type = "S"), list(data = "unb", type = "S", std = "MVLUE-SD"), list(data = "unb", type = "S", conf = 0.9),
  list(data = "unb", type = "xbar", split = 12),
  list(data = "big", type = "xbar"), list(data = "big", type = "S"), list(data = "big", type = "R"),
  list(data = "x1", type = "xbar.one"), list(data = "x1", type = "xbar.one", std = "SD"),
  list(data = "x1", type = "xbar.one", conf = 0.99), list(data = "x1", type = "xbar.one", split = 20),
  list(data = "x1", type = "xbar.one", center = 5, stdnum = 1),
  list(data = "D", sizes = "sz", type = "p"), list(data = "D", sizes = "sz", type = "p", conf = 0.99),
  list(data = "D", sizes = "sz", type = "p", center = 0.1), list(data = "D", sizes = "sz", type = "p", nsigmas = 2),
  list(data = "Dc", size = 50, type = "p"), list(data = "Dc", size = 50, type = "np"),
  list(data = "Dc", size = 50, type = "np", conf = 0.99), list(data = "D", sizes = "sz", type = "np"),
  list(data = "cnt", type = "c"), list(data = "cnt", type = "c", conf = 0.99), list(data = "cnt", type = "c", split = 20),
  list(data = "ux", sizes = "usz", type = "u"), list(data = "ux", sizes = "usz", type = "u", conf = 0.99),
  list(data = "ux", sizes = "usz", type = "u", split = 20),
  list(data = "gg", type = "g"), list(data = "gg", type = "g", conf = 0.99),
  list(data = "unb", type = "xbar", center = 3, stdnum = 0.5, runlen = 4)
)
call_qcc <- function(cs) {
  d <- if (!is.null(mats[[cs$data]])) mats[[cs$data]] else vecs[[cs$data]]
  sizes <- if (!is.null(cs$sizes)) vecs[[cs$sizes]] else cs$size
  args <- list(type = cs$type, plot = FALSE)
  if (!is.null(cs$std)) args$std.dev <- cs$std
  if (!is.null(cs$stdnum)) args$std.dev <- cs$stdnum
  if (!is.null(cs$center)) args$center <- cs$center
  if (!is.null(cs$nsigmas)) args$nsigmas <- cs$nsigmas
  if (!is.null(cs$conf)) args$confidence.level <- cs$conf
  if (!is.null(cs$limits)) args$limits <- cs$limits
  if (!is.null(cs$split)) {
    k <- cs$split
    if (is.matrix(d)) { args$data <- d[1:k, , drop = FALSE]; args$newdata <- d[-(1:k), , drop = FALSE] }
    else { args$data <- d[1:k]; args$newdata <- d[-(1:k)] }
    if (length(sizes) > 1) { args$sizes <- sizes[1:k]; args$newsizes <- sizes[-(1:k)] }
    else if (!is.null(sizes)) { args$sizes <- sizes; args$newsizes <- sizes }
  } else {
    args$data <- d
    if (!is.null(sizes)) args$sizes <- sizes
  }
  q <- do.call(qcc, args)
  if (!is.null(cs$runlen)) q$violations <- shewhart.rules(q, run.length = cs$runlen)
  q
}
out$qcc <- lapply(cases, function(cs) {
  r <- run(call_qcc(cs))
  c(cs, if (is.null(r$error)) list(result = qcc_out(r$value)) else list(error = r$error), list(warnings = r$warnings))
})
out$qcc_errors <- list(
  list(data = "unbsize1", type = "xbar", error = run(qcc(rbind(c(1, 2), c(3, NA), c(2, 5)), type = "xbar", plot = FALSE))$error),
  list(data = "bal", type = "R", std = "UWAVE-SD", error = run(qcc(bal, type = "R", std.dev = "UWAVE-SD", plot = FALSE))$error),
  list(data = "bal", type = "S", std = "UWAVE-R", error = run(qcc(bal, type = "S", std.dev = "UWAVE-R", plot = FALSE))$error),
  list(data = "cnt", type = "c", sizes = "usz", error = run(qcc(cnt, sizes = usz, type = "c", plot = FALSE))$error))

# cusum and ewma
cs_out <- function(q) list(statistics = unname(as.numeric(q$statistics)), center = q$center, std_dev = q$std.dev,
                           pos = unname(q$pos), neg = unname(q$neg), lower = unname(q$violations$lower),
                           upper = unname(q$violations$upper))
ew_out <- function(q) list(statistics = unname(as.numeric(q$statistics)), center = q$center, std_dev = q$std.dev,
                           y = unname(q$y), sigma = unname(q$sigma), limits = lim_out(q$limits),
                           violations = unname(q$violations))
out$cusum <- list(
  list(data = "bal", result = cs_out(cusum(bal, plot = FALSE))),
  list(data = "bal", h = 4, shift = 2, result = cs_out(cusum(bal, decision.interval = 4, se.shift = 2, plot = FALSE))),
  list(data = "bal", head = 2, result = cs_out(cusum(bal, head.start = 2, plot = FALSE))),
  list(data = "unb", result = cs_out(cusum(unb, plot = FALSE))),
  list(data = "unb", std = "UWAVE-SD", result = cs_out(cusum(unb, std.dev = "UWAVE-SD", plot = FALSE))),
  list(data = "x1", result = cs_out(cusum(x1, plot = FALSE))),
  list(data = "x1", center = 5, stdnum = 1, result = cs_out(cusum(x1, center = 5, std.dev = 1, plot = FALSE))),
  list(data = "x1", split = 20, result = cs_out(cusum(x1[1:20], newdata = x1[21:30], plot = FALSE))),
  list(data = "bal", head = 6, error = run(cusum(bal, head.start = 6, plot = FALSE))$error))
out$ewma <- list(
  list(data = "bal", result = ew_out(ewma(bal, plot = FALSE))),
  list(data = "bal", lambda = 0.5, nsigmas = 2.7, result = ew_out(ewma(bal, lambda = 0.5, nsigmas = 2.7, plot = FALSE))),
  list(data = "unb", result = ew_out(ewma(unb, plot = FALSE))),
  list(data = "x1", result = ew_out(ewma(x1, plot = FALSE))),
  list(data = "x1", center = 5, stdnum = 1, lambda = 0.3, result = ew_out(ewma(x1, center = 5, std.dev = 1, lambda = 0.3, plot = FALSE))),
  list(data = "x1", split = 20, result = ew_out(ewma(x1[1:20], newdata = x1[21:30], plot = FALSE))),
  list(data = "x1", lambda = 1, result = ew_out(ewma(x1, lambda = 1, plot = FALSE))))
xs <- c(3, 1, 2, 5, 4); ys <- c(10, 12, 9, 15, 11)
out$ewmaSmooth <- list(x = xs, y = ys, def = ewmaSmooth(xs, ys), start = ewmaSmooth(xs, ys, lambda = 0.4, start = 0))

# oc.curves
oc_m <- function(b) list(value = unname(matrix(as.numeric(b), nrow(b))), rows = rownames(b), cols = colnames(b))
qx <- qcc(bal, type = "xbar", plot = FALSE); qR <- qcc(bal, type = "R", plot = FALSE); qS <- qcc(bal, type = "S", plot = FALSE)
qp <- qcc(Dc, sizes = 50, type = "p", plot = FALSE); qnp <- qcc(Dc, sizes = 50, type = "np", plot = FALSE)
qc <- qcc(cnt, type = "c", plot = FALSE); qu <- qcc(cnt, sizes = 2, type = "u", plot = FALSE)
qxc <- qcc(bal, type = "xbar", confidence.level = 0.99, plot = FALSE)
ocv <- function(b) list(value = unname(as.numeric(b)), names = names(b))
out$oc <- list(
  xbar = oc_m(oc.curves(qx)), xbar2 = oc_m(oc.curves.xbar(qx, n = c(2, 7), c = c(0, 0.5, 1.5), nsigmas = 2)),
  xbar_conf = oc_m(oc.curves.xbar(qxc, n = c(5, 3), c = c(0, 1))),
  R = oc_m(oc.curves(qR)), R2 = oc_m(oc.curves.R(qR, n = c(3, 5), c = c(1, 1.5, 3))),
  S = oc_m(oc.curves(qS)), S2 = oc_m(oc.curves.S(qS, n = c(3, 5), c = c(1, 1.5, 3))),
  p = ocv(suppressWarnings(oc.curves(qp))), np = ocv(suppressWarnings(oc.curves(qnp))),
  c = ocv(suppressWarnings(oc.curves(qc))), u = ocv(suppressWarnings(oc.curves(qu))),
  p_warning = run(oc.curves(qp))$warnings, c_warning = run(oc.curves(qc))$warnings,
  xbar_one_error = run(oc.curves(qcc(x1, type = "xbar.one", plot = FALSE)))$error)

# process.capability
pc_out <- function(p) list(nobs = p$nobs, center = p$center, std_dev = p$std.dev, target = p$target,
                           spec = unname(p$spec.limits), indices = unname(matrix(as.numeric(p$indices), 5)),
                           cols = colnames(p$indices), exp = unname(p$exp), obs = unname(p$obs))
qo <- qcc(x1, type = "xbar.one", plot = FALSE)
pcs <- list(
  list(chart = "xbar", spec = c(4, 16)), list(chart = "xbar", spec = c(4, 14.5), target = 10.2),
  list(chart = "xbar", spec = c(NA, 14.5)), list(chart = "xbar", spec = c(4, NA)),
  list(chart = "xbar", spec = c(4, 16), stdnum = 2.5, nsigmas = 2, conf = 0.9),
  list(chart = "xbar.one", spec = c(2, 9)), list(chart = "xbar.one", spec = c(3, 7.5), target = 5.5, conf = 0.8),
  list(chart = "xbar.one", spec = c(9, 2)))
out$capability <- lapply(pcs, function(cs) {
  q <- if (cs$chart == "xbar") qx else qo
  args <- list(object = q, spec.limits = cs$spec, print = FALSE)
  if (!is.null(cs$target)) args$target <- cs$target
  if (!is.null(cs$stdnum)) args$std.dev <- cs$stdnum
  if (!is.null(cs$nsigmas)) args$nsigmas <- cs$nsigmas
  if (!is.null(cs$conf)) args$confidence.level <- cs$conf
  r <- run(do.call(process.capability, args))
  c(cs, list(result = pc_out(r$value), warnings = r$warnings))
})
out$capability_error <- run(process.capability(qR, spec.limits = c(4, 16), print = FALSE))$error

# mqcc
X <- lapply(1:3, function(j) r4(matrix(rnorm(20 * 4, 10 * j, j), 20, 4)))
X[[2]] <- r4(X[[2]] + 0.5 * X[[1]]); X[[1]][5, ] <- X[[1]][5, ] + 3
Xs <- r4(rbind(sapply(X, function(M) M[, 1]), matrix(rnorm(30, c(10, 25, 30), c(1, 2, 3)), 10, 3, byrow = TRUE)))
mq_out <- function(q) list(statistics = unname(q$statistics), center = unname(q$center), cov = unname(q$cov),
                           limits = unname(as.numeric(q$limits)),
                           pred = if (is.null(q$pred.limits)) NULL else unname(as.numeric(q$pred.limits)),
                           conf = q$confidence.level, beyond = unname(q$violations$beyond.limits),
                           beyond_pred = unname(q$violations$beyond.pred.limits),
                           newstats = if (is.null(q$newstats)) NULL else unname(q$newstats))
out$mqcc <- list(
  data = list(X = lapply(X, function(m) unname(split(m, row(m)))), Xs = unname(split(Xs, row(Xs)))),
  T2 = mq_out(mqcc(X, type = "T2", pred.limits = TRUE, plot = FALSE)),
  T2_conf = mq_out(mqcc(X, type = "T2", confidence.level = 0.99, plot = FALSE)),
  single = mq_out(mqcc(Xs, type = "T2.single", pred.limits = TRUE, plot = FALSE)),
  single_new = mq_out(mqcc(Xs[1:20, ], type = "T2.single", newdata = Xs[21:30, ], pred.limits = TRUE, plot = FALSE)),
  single_given = mq_out(mqcc(Xs[1:20, ], type = "T2.single", center = c(10, 25, 30), cov = diag(c(1, 4, 9)), plot = FALSE)))

# overdispersion, pareto, groups
xb <- c(12, 11, 18, 11, 10, 16, 9, 11, 14, 15, 11, 9, 10, 13, 12, 8, 12, 13, 10, 12, 13, 16, 12, 18, 16, 10, 16, 10, 12, 14)
xpz <- c(11, 8, 13, 11, 13, 17, 25, 23, 11, 16, 9, 15, 10, 16, 12, 8, 9, 15, 4, 12, 12, 12, 15, 17, 14, 17, 12, 12, 7, 16)
szv <- sample(40:60, 30, TRUE)
od <- function(m) unname(as.numeric(m))
out$overdispersion <- list(xb = xb, xpz = xpz, szv = szv,
                           binom = od(qcc.overdispersion.test(xb, rep(50, 30))), pois = od(qcc.overdispersion.test(xpz)),
                           binom_var = od(qcc.overdispersion.test(xb, szv)),
                           pois_typed = od(qcc.overdispersion.test(xb, szv, type = "poisson")))
defect <- c(a = 80, b = 27, c = 66, d = 94, e = 33, f = 27)
pa <- pareto.chart(defect, plot = FALSE); pa2 <- pareto.chart(c(3, 1, 2), plot = FALSE)
out$pareto <- list(data = as.list(defect), value = unname(matrix(as.numeric(pa), nrow(pa))), rows = rownames(pa),
                   value2 = unname(matrix(as.numeric(pa2), nrow(pa2))), rows2 = rownames(pa2))
dv <- c(5, 1, 2, 7, 3, 9, 4); sv <- c(2, 1, 2, 1, 3, 2, 1)
gq <- qcc.groups(dv, sv)
out$groups <- list(data = dv, sample = sv, value = unname(split(gq, row(gq))), rows = rownames(gq))

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE),
           file.path("/out", "qcc.json"))
