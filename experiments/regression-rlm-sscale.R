# regression-rlm-sscale.R: what MASS 7.3-66's S-estimator (lqs(method = "S")) reports as crit and scale, and which
# scale rlm(method = "MM") uses; public functions and documented arguments only (1.7.0)
# Output: JSON on stdout, 17 significant digits
suppressMessages(library(MASS))
library(jsonlite)
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
sfit <- function(fml, d, ...) {
  f <- lqs(fml, data = d, method = "S", ...)
  list(coefficients = unname(coef(f)), names = names(coef(f)), crit = unname(f$crit), scale = unname(f$scale),
       residuals = unname(residuals(f)), bestone = unname(f$bestone))
}
out <- list()
sl <- stackloss
f <- stack.loss ~ Air.Flow + Water.Temp + Acid.Conc.
out$stackloss_exact <- run(sfit(f, sl, nsamp = "exact"))
for (s in c(1, 2, 123)) out[[paste0("stackloss_seed", s)]] <- run({ set.seed(s); sfit(f, sl) })
out$stackloss_exact_k0_2 <- run(sfit(f, sl, nsamp = "exact", k0 = 2))
out$stackloss_exact_k0_3 <- run(sfit(f, sl, nsamp = "exact", k0 = 3))
out$phones_exact <- run(sfit(calls ~ year, phones, nsamp = "exact"))
# location only: small samples where the S-scale can be computed by hand
loc <- list(a = c(1, 2, 3, 4, 100), b = c(-2, -1, 0, 0.5, 1, 3, 8), c = c(0.1, 0.4, 0.45, 1.2, 1.3, 2.2, 5, 9, 9.5))
for (nm in names(loc)) out[[paste0("location_", nm)]] <- run(sfit(y ~ 1, data.frame(y = loc[[nm]]), nsamp = "exact"))
# rlm MM: its scale against the S fit of the same data, with nsamp passed through (documented "...")
out$mm_stackloss_seed1 <- run({ set.seed(1); r <- rlm(f, data = sl, method = "MM"); list(s = unname(r$s), coefficients = unname(coef(r))) })
out$mm_stackloss_exact <- run({ r <- rlm(f, data = sl, method = "MM", nsamp = "exact"); list(s = unname(r$s), coefficients = unname(coef(r))) })
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE), "\n")
