# tsmeta120-reml2.R: metainc IRD's REML tau2 (1.20.0, log item 98): meta gives 5.4e-7, rStats.js 0. The study values
# are of order 1e-3 (variances ~5e-6), below metafor's absolute threshold 1e-5. Designed: metafor's rma(REML) on the
# same values with threshold 1e-5 (default) and 1e-12, on the values times 1000 (variances times 1e6), and the REML
# log-likelihood at tau2 = 0 and at meta's value (profile through rma with fixed tau2).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
e1 <- c(5, 0, 12, 3, 8, 0); t1 <- c(1000, 800, 2500, 600, 1500, 900); e2 <- c(9, 2, 15, 0, 10, 0); t2 <- c(1100, 750, 2400, 650, 1400, 950)
m <- metainc(e1, t1, e2, t2, sm = "IRD"); y <- m$TE; s <- m$seTE
res <- list(meta = m$tau2, default = rma(y, sei = s, method = "REML")$tau2, thr = rma(y, sei = s, method = "REML", control = list(threshold = 1e-12))$tau2,
            scaled = rma(1000 * y, sei = 1000 * s, method = "REML")$tau2 / 1e6,
            ll0 = as.numeric(logLik(rma(y, sei = s, tau2 = 0, method = "REML"))), llR = as.numeric(logLik(rma(y, sei = s, tau2 = m$tau2, method = "REML"))))
cat(toJSON(res, digits = I(17), auto_unbox = TRUE))
