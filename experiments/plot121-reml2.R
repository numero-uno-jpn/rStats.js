# plot121-reml2.R: R references iterated to the maximum, part 2 (1.21.0, experiment 8). After experiment 7 the
# references pass metafor threshold = 1e-14 through meta's `control` (1e-16 stops: "Fisher scoring algorithm did not
# converge"). Two places are left:
# (a) trimfill refits the filled data: does it keep the meta object's control? Compare trimfill(m)$tau2 with metagen
#     of trimfill's filled TE / seTE at the tight control, and try trimfill(m, control = ...);
# (b) metaprop near 0 and 1 (the sets of tsmeta120-propedge.R, inverse variance) at the tight control.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
ctl <- list(threshold = 1e-14, maxiter = 1000)
out <- list(R = R.version.string, arch = R.version$arch)
es <- escalc("RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = dat.colditz1994)
y <- as.numeric(es$yi); s <- sqrt(as.numeric(es$vi))
m <- metagen(y, s, control = ctl)
tf <- trimfill(m)
mfilled <- metagen(tf$TE, tf$seTE, control = ctl)
tf2 <- tryCatch(trimfill(m, control = ctl), error = function(e) conditionMessage(e))
out$trimfill <- list(tau2 = tf$tau2, filledTau2 = mfilled$tau2, k = tf$k,
                     withControl = if (is.character(tf2)) tf2 else list(tau2 = tf2$tau2, TE.random = tf2$TE.random, seTE.random = tf2$seTE.random))
ml <- metagen(y[-c(1, 4)], s[-c(1, 4)], control = ctl)
tfl <- tryCatch(trimfill(ml, control = ctl), error = function(e) conditionMessage(e))
out$trimfill_left <- if (is.character(tfl)) tfl else list(tau2 = tfl$tau2, TE.random = tfl$TE.random, seTE.random = tfl$seTE.random)
sets <- list(zeros = list(e = c(0, 1, 0, 2), n = c(50, 80, 40, 120)), all = list(e = c(50, 79, 40, 118), n = c(50, 80, 40, 120)),
             tiny = list(e = c(1, 2, 1, 3), n = c(1e5, 2e5, 8e4, 3e5)), huge = list(e = c(1e6 - 1, 2e6 - 3, 1e6, 5e5), n = c(1e6, 2e6, 1e6, 5e5)),
             mixed = list(e = c(0, 25, 50, 3), n = c(50, 50, 50, 60)))
pe <- list(sets = sets)
for (nm in names(sets)) {
  st <- sets[[nm]]; r <- list()
  for (sm in c("PLOGIT", "PFT", "PAS", "PRAW", "PLN")) r[[sm]] <- tryCatch({
    mp <- suppressWarnings(metaprop(st$e, st$n, sm = sm, method = "Inverse", control = ctl))
    list(TE.random = mp$TE.random, seTE.random = mp$seTE.random, tau2 = mp$tau2) }, error = function(e) list(error = conditionMessage(e)))
  pe[[nm]] <- r
}
out$propedge <- pe
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
