# tsmeta120-metaedge.R: meta's degenerate inputs for the 1.20.0 edge-case review (log item 102). Designed: one study,
# two studies, identical TE (Q = 0) with classic and HK, identical TE and se, metabin with all studies double-zero (RR,
# OR, RD), a one-study subgroup.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(meta))
F <- c("TE.common", "seTE.common", "TE.random", "seTE.random", "lower.random", "upper.random", "pval.random", "lower.predict", "upper.predict",
       "tau2", "lower.tau2", "upper.tau2", "Q", "pval.Q", "H", "lower.H", "upper.H", "I2", "lower.I2", "upper.I2", "k")
pick <- function(m) { r <- lapply(F, function(f) if (is.null(m[[f]])) NULL else unname(m[[f]])); names(r) <- F; r }
tc <- function(expr) tryCatch(pick(expr), error = function(e) paste("error:", conditionMessage(e)))
cases <- list(k1 = list(0.3, 0.1), k2 = list(c(0.3, 0.1), c(0.1, 0.2)), sameTE = list(c(0.2, 0.2, 0.2), c(0.1, 0.2, 0.3)), sameAll = list(c(0.2, 0.2), c(0.1, 0.1)))
out <- list()
for (nm in names(cases)) for (ci in c("classic", "HK")) out[[paste(nm, ci)]] <- tc(metagen(cases[[nm]][[1]], cases[[nm]][[2]], method.random.ci = ci, prediction = TRUE))
for (sm in c("RR", "OR", "RD")) out[[paste("allzero", sm)]] <- tc(suppressWarnings(metabin(c(0, 0), c(10, 12), c(0, 0), c(11, 9), sm = sm)))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
