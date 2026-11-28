# plot121-metalevel.R: which intervals meta's and netmeta's `level` changes (1.21.0, experiment 5). Experiment 4
# found that metagen(level = 0.9) leaves the pooled and prediction intervals at 95%: level.ma and level.predict keep
# their defaults (gs("level.ma"), gs("level.predict")) whatever `level` is. Here the same for metainc (MH, IRD),
# metaprop (GLMM) and netmeta: level = 0.9 against the default, and against level.ma = 0.9 / level.predict = 0.9.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(netmeta) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")),
            netmeta = as.character(packageVersion("netmeta")),
            gs = list(level = gs("level"), level.ma = gs("level.ma"), level.predict = gs("level.predict")))
pick <- function(m) list(lower = as.numeric(m$lower)[1], lc = m$lower.common, lr = m$lower.random, lp = m$lower.predict)
e1 <- c(3, 5, 2, 8); t1 <- c(100, 120, 90, 200); e2 <- c(6, 9, 4, 10); t2 <- c(110, 100, 95, 210)
out$metainc <- list(def = pick(metainc(e1, t1, e2, t2, sm = "IRD", method = "MH", prediction = TRUE)),
                    lv = pick(metainc(e1, t1, e2, t2, sm = "IRD", method = "MH", prediction = TRUE, level = 0.9)),
                    ma = pick(metainc(e1, t1, e2, t2, sm = "IRD", method = "MH", prediction = TRUE, level.ma = 0.9)))
ev <- c(4, 9, 12, 3, 7); nn <- c(40, 50, 60, 35, 45)
out$metaprop <- list(def = pick(metaprop(ev, nn, method = "GLMM", prediction = TRUE)),
                     lv = pick(metaprop(ev, nn, method = "GLMM", prediction = TRUE, level = 0.9)),
                     pr = pick(metaprop(ev, nn, method = "GLMM", prediction = TRUE, level.predict = 0.9)))
TE <- c(0.3, 0.5, 0.2, 0.4, 0.1); seTE <- c(0.1, 0.2, 0.15, 0.2, 0.12)
t1n <- c("A", "A", "B", "A", "B"); t2n <- c("B", "C", "C", "B", "C"); sl <- c("s1", "s2", "s3", "s4", "s5")
nm <- function(...) { f <- netmeta(TE, seTE, t1n, t2n, sl, ...); list(lc = f$lower.common["A", "B"], lr = f$lower.random["A", "B"],
                                                                        lp = f$lower.predict["A", "B"], level = f$level, level.ma = f$level.ma) }
out$netmeta <- list(def = nm(), lv = nm(level = 0.9), ma = nm(level.ma = 0.9), pr = nm(level.predict = 0.9))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = TRUE))
