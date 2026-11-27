# tsmeta120-reml.R: meta's REML tau2 near 0 (1.20.0, log item 97). metabin's zero-cell set gives tau2 = 2.9e-6 in meta
# where rStats.js's rma gives 0. Designed: the same study values through metafor's rma(REML) with its defaults and with
# control stepadj 0.5 / maxiter 1000 / threshold 1e-10 / tau2.init 0, and meta's metagen with control = list(...).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
e1 <- c(0, 3, 5, 0, 12, 0, 7); n1 <- c(20, 30, 40, 25, 60, 15, 33); e2 <- c(2, 0, 8, 0, 15, 3, 7); n2 <- c(22, 28, 41, 24, 58, 16, 33)
m <- metabin(e1, n1, e2, n2, sm = "RR")
ok <- !is.na(m$TE); y <- m$TE[ok]; s <- m$seTE[ok]
fits <- list(default = rma(y, sei = s, method = "REML"), stepadj05 = rma(y, sei = s, method = "REML", control = list(stepadj = 0.5)),
             maxiter1000 = rma(y, sei = s, method = "REML", control = list(maxiter = 1000)), thr = rma(y, sei = s, method = "REML", control = list(threshold = 1e-10)),
             init0 = rma(y, sei = s, method = "REML", control = list(tau2.init = 0)), both = rma(y, sei = s, method = "REML", control = list(stepadj = 0.5, maxiter = 1000)))
cat(toJSON(list(meta_tau2 = m$tau2, y = y, s = s, fits = lapply(fits, function(f) list(tau2 = f$tau2, iter = f$iter))), digits = I(17), auto_unbox = TRUE))
