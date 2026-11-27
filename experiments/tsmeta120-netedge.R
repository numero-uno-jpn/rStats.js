# tsmeta120-netedge.R: netmeta's and tseries' edge cases (1.20.0, session 42; the spec's "Edge-case plan", the fine axes
# of netmeta and tseries). netmeta: scale (TE and seTE times 1e-150 .. 1e150), a network of one comparison, a star, a
# consistent network (Q = 0), equal seTE, a large network (30 treatments), tied P-scores, invalid input. tseries: the
# smallest series each test accepts, adf's k and alternative, kpss' lshort, pp's types, po.test with collinear or
# identical columns, runs.test with ties at the median, terasvirta / white on short series.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(netmeta); library(tseries) })
out <- list(R = R.version.string, arch = R.version$arch, netmeta = as.character(packageVersion("netmeta")),
            tseries = as.character(packageVersion("tseries")))
grab <- function(expr) {
  w <- character(0)
  r <- tryCatch(withCallingHandlers(expr, warning = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleWarning") }),
                error = function(e) list(error = conditionMessage(e)))
  if (length(w)) r$warnings <- unique(w)
  r
}
fit <- function(d, ...) {
  msg <- capture.output(nm <- netmeta(d$TE, d$seTE, d$t1, d$t2, d$stud, reference.group = sort(unique(c(d$t1, d$t2)))[1], ...))
  pr <- netrank(nm)
  list(trts = nm$trts, TE.common = unname(nm$TE.common[, 1]), seTE.common = unname(nm$seTE.common[, 1]),
       TE.random = unname(nm$TE.random[, 1]), seTE.random = unname(nm$seTE.random[, 1]), Q = nm$Q, df.Q = nm$df.Q,
       pval.Q = nm$pval.Q, tau2 = nm$tau^2, I2 = nm$I2, Pscore.random = unname(pr$ranking.random), Pscore.common = unname(pr$ranking.common))
}
mk <- function(st, arms, eff, sA) { cmb <- combn(length(arms), 2)
  data.frame(stud = st, t1 = arms[cmb[1, ]], t2 = arms[cmb[2, ]], TE = eff[cmb[1, ]] - eff[cmb[2, ]], seTE = sqrt(sA[cmb[1, ]]^2 + sA[cmb[2, ]]^2)) }
set.seed(91)
true <- c(A = 0, B = -0.3, C = -0.5, D = -0.2, E = -0.6)
designs <- list(c("A", "B"), c("A", "B"), c("A", "C"), c("A", "C"), c("B", "C"), c("A", "D"), c("C", "D"), c("B", "E"), c("D", "E"), c("A", "E"),
                c("A", "B", "C"), c("A", "D", "E"), c("B", "D"))
d <- do.call(rbind, lapply(seq_along(designs), function(i) { a <- designs[[i]]; sA <- runif(length(a), 0.08, 0.15)
  mk(paste0("s", i), a, true[a] + rnorm(length(a), 0, 0.25), sA) }))
net <- list(data = d, base = grab(fit(d)))
sc <- list()
for (c0 in c(1e-150, 1e-10, 1e10, 1e150)) { dc <- d; dc$TE <- d$TE * c0; dc$seTE <- d$seTE * c0; sc[[format(c0)]] <- grab(fit(dc)) }
net$scale <- sc
# one comparison, three studies
d1 <- data.frame(stud = c("a", "b", "c"), t1 = "A", t2 = "B", TE = c(-0.2, -0.4, -0.1), seTE = c(0.1, 0.15, 0.12))
# a star: every comparison against A, one study each (no heterogeneity df)
ds <- data.frame(stud = c("a", "b", "c"), t1 = "A", t2 = c("B", "C", "D"), TE = c(-0.2, -0.4, -0.1), seTE = c(0.1, 0.15, 0.12))
# a consistent network: TE = the differences of fixed effects exactly (Q = 0)
eff <- c(A = 0, B = -0.3, C = -0.5)
dq <- data.frame(stud = c("a", "b", "c", "e"), t1 = c("A", "A", "B", "A"), t2 = c("B", "C", "C", "B"), TE = c(0.3, 0.5, 0.2, 0.3), seTE = c(0.1, 0.12, 0.11, 0.2))
# equal seTE
de <- d; de$seTE <- 0.1
# tied P-scores: B and C with identical effects against A in a symmetric network
dt <- data.frame(stud = c("a", "b", "c", "e"), t1 = c("A", "A", "A", "A"), t2 = c("B", "C", "B", "C"), TE = c(0.3, 0.3, 0.5, 0.5), seTE = c(0.1, 0.1, 0.1, 0.1))
net$one <- list(data = d1, fit = grab(fit(d1)))
net$star <- list(data = ds, fit = grab(fit(ds)))
net$consistent <- list(data = dq, fit = grab(fit(dq)))
net$equalse <- list(data = de, fit = grab(fit(de)))
net$tied <- list(data = dt, fit = grab(fit(dt)))
# 30 treatments: a ring plus random chords, one study per edge
set.seed(92)
tr <- sprintf("T%02d", 1:30); te <- rnorm(30, 0, 0.5)
edges <- rbind(cbind(1:30, c(2:30, 1)), t(replicate(30, sort(sample(30, 2)))))
edges <- unique(edges[edges[, 1] != edges[, 2], ])
dl <- data.frame(stud = paste0("L", seq_len(nrow(edges))), t1 = tr[edges[, 1]], t2 = tr[edges[, 2]],
                 TE = te[edges[, 1]] - te[edges[, 2]] + rnorm(nrow(edges), 0, 0.2), seTE = runif(nrow(edges), 0.1, 0.3))
net$large <- list(data = dl, fit = grab(fit(dl)))
# invalid input
net$invalid <- list(
  negative_se = grab({ x <- d1; x$seTE[1] <- -0.1; fit(x) }), zero_se = grab({ x <- d1; x$seTE[1] <- 0; fit(x) }),
  na_te = grab({ x <- d1; x$TE[1] <- NA; fit(x) }), same_treat = grab({ x <- d1; x$t2[1] <- "A"; fit(x) }),
  inf_te = grab({ x <- d1; x$TE[1] <- Inf; fit(x) }))
out$netmeta <- net

# tseries
set.seed(93)
e <- rnorm(200)
ts_ <- list(e = e)
for (n in c(3, 4, 5, 6, 8, 10, 20)) {
  x <- cumsum(e[1:n])
  ts_[[paste0("n", n)]] <- list(
    adf = grab({ t <- adf.test(x); list(statistic = unname(t$statistic), p = t$p.value, k = unname(t$parameter)) }),
    adf_k0 = grab({ t <- adf.test(x, k = 0); list(statistic = unname(t$statistic), p = t$p.value) }),
    kpss = grab({ t <- kpss.test(x); list(statistic = unname(t$statistic), p = t$p.value, l = unname(t$parameter)) }),
    pp = grab({ t <- pp.test(x); list(statistic = unname(t$statistic), p = t$p.value) }),
    jarque = grab({ t <- jarque.bera.test(diff(c(0, x))); list(statistic = unname(t$statistic), p = t$p.value) }),
    terasvirta = grab({ t <- terasvirta.test(ts(x)); list(statistic = unname(t$statistic), p = t$p.value) }),
    white = grab({ set.seed(1); t <- white.test(ts(x)); list(statistic = unname(t$statistic), p = t$p.value) }))
}
x <- cumsum(e)
ts_$options <- list(
  adf_explosive = grab({ t <- adf.test(x, alternative = "explosive"); list(statistic = unname(t$statistic), p = t$p.value) }),
  adf_k10 = grab({ t <- adf.test(x, k = 10); list(statistic = unname(t$statistic), p = t$p.value) }),
  adf_k150 = grab({ t <- adf.test(x, k = 150); list(statistic = unname(t$statistic), p = t$p.value) }),
  kpss_long = grab({ t <- kpss.test(x, lshort = FALSE); list(statistic = unname(t$statistic), p = t$p.value) }),
  kpss_trend = grab({ t <- kpss.test(x, null = "Trend"); list(statistic = unname(t$statistic), p = t$p.value) }),
  pp_alpha = grab({ t <- pp.test(x, type = "Z(alpha)"); list(statistic = unname(t$statistic), p = t$p.value) }),
  pp_explosive = grab({ t <- pp.test(x, alternative = "explosive"); list(statistic = unname(t$statistic), p = t$p.value) }),
  pp_long = grab({ t <- pp.test(x, lshort = FALSE); list(statistic = unname(t$statistic), p = t$p.value) }),
  po_collinear = grab({ t <- po.test(cbind(x, 2 * x)); list(statistic = unname(t$statistic), p = t$p.value) }),
  po_identical = grab({ t <- po.test(cbind(x, x)); list(statistic = unname(t$statistic), p = t$p.value) }),
  po_one = grab({ t <- po.test(cbind(x)); list(statistic = unname(t$statistic), p = t$p.value) }),
  po_three = grab({ t <- po.test(cbind(x, cumsum(e[c(101:200, 1:100)]), x + e)); list(statistic = unname(t$statistic), p = t$p.value) }),
  runs_median_ties = grab({ v <- c(1, 2, 3, 3, 3, 4, 5, 3, 2, 3, 6, 3); t <- runs.test(factor(v > median(v))); list(statistic = unname(t$statistic), p = t$p.value) }),
  runs_two = grab({ t <- runs.test(factor(c(1, 2))); list(statistic = unname(t$statistic), p = t$p.value) }),
  terasvirta_F = grab({ t <- terasvirta.test(ts(x), type = "F"); list(statistic = unname(t$statistic), p = t$p.value) }),
  white_F = grab({ set.seed(1); t <- white.test(ts(x), type = "F"); list(statistic = unname(t$statistic), p = t$p.value) }))
out$tseries <- ts_
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), na = "null", null = "null"))
