# Shared public-call cases for the 1.11.0 oracle; outputs are selected by each oracle script.
# ca111.R: ca 0.72 (ca, mjca) on small data and boundary cases, public functions only (1.11.0)
# Output: JSON on stdout, 17 significant digits. Only numbers and strings are kept (no R objects)
library(ca)
library(jsonlite)
# Helpers (the same in each script): run() records the value, the warnings, the messages and the error of one call
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(as.matrix(m)))
# keep(): the documented components of a fit (a list), numbers and strings only; matrices as tab(), the call dropped
# rows = FALSE drops the per-row components (wg93 has 871 rows; the row parts are compared on its first 60 rows)
keep <- function(r, rows = TRUE) {
  out <- list()
  for (nm in names(r)) {
    if (!rows && (startsWith(nm, "row") || nm == "indmat")) next
    v <- r[[nm]]
    if (is.matrix(v) || is.data.frame(v)) out[[nm]] <- tab(v)
    else if (is.numeric(v) || is.character(v) || is.logical(v)) out[[nm]] <- list(names = names(v), values = unname(v))
    else if (is.factor(v)) out[[nm]] <- list(values = as.character(v))
  }
  out
}
# the tables of summary() (principal inertias and the row and column contributions), numbers and strings only
sm <- function(r) {
  s <- summary(r)
  lapply(s[c("scree", "rows", "columns")], function(t) if (is.null(t)) NULL else tab(t))
}
# summary() runs in its own run(), so that an error in it does not hide the fit
cf <- function(r, rows = TRUE) list(fit = keep(r, rows), summary = run(sm(r)))
out <- list()

## ca: simple correspondence analysis
out$ca_smoke <- run(cf(ca(smoke)))
out$ca_smoke_nd1 <- run(cf(ca(smoke, nd = 1)))
out$ca_smoke_nd5 <- run(cf(ca(smoke, nd = 5)))
out$ca_smoke_suprow <- run(cf(ca(smoke, suprow = 5)))
out$ca_smoke_supcol <- run(cf(ca(smoke, supcol = 1)))
out$ca_smoke_sup_both <- run(cf(ca(smoke, suprow = c(1, 3), supcol = 4)))
out$ca_smoke_t <- run(cf(ca(t(smoke))))
out$ca_author <- run(cf(ca(author)))
out$ca_author_nd3 <- run(cf(ca(author, nd = 3)))
hec <- margin.table(HairEyeColor, c(1, 2))
out$ca_haireye_table <- run(cf(ca(hec)))
out$ca_haireye_formula <- run(cf(ca(~ Hair + Eye, data = as.data.frame(HairEyeColor), weights = Freq)))
out$ca_dataframe <- run(cf(ca(as.data.frame.matrix(smoke))))
out$ca_cacoord_standard <- run(tab(cacoord(ca(smoke), type = "standard", rows = TRUE)))
out$ca_cacoord_principal <- run(tab(cacoord(ca(smoke), type = "principal", cols = TRUE)))
out$ca_cacoord_symmetric <- run(lapply(cacoord(ca(smoke), type = "symmetric"), tab))
out$ca_cacoord_rowprincipal <- run(lapply(cacoord(ca(author), type = "rowprincipal", dim = 1:3), tab))
out$ca_cacoord_colgreen <- run(lapply(cacoord(ca(author), type = "colgreen"), tab))
out$ca_cacoord_rowgab <- run(lapply(cacoord(ca(smoke), type = "rowgab"), tab))
# boundary cases
m22 <- matrix(c(10, 20, 30, 5), 2, dimnames = list(c("r1", "r2"), c("c1", "c2")))
out$ca_2x2 <- run(cf(ca(m22)))
m23 <- matrix(c(1, 2, 3, 4, 5, 6), 2)
out$ca_no_names <- run(cf(ca(m23)))
out$ca_independent <- run(cf(ca(outer(c(1, 2, 3), c(2, 4, 6, 8)))))
out$ca_zero_row <- run(cf(ca(rbind(smoke, zero = 0))))
out$ca_zero_col <- run(cf(ca(cbind(smoke, zero = 0))))
out$ca_negative <- run(cf(ca(matrix(c(1, -2, 3, 4, 5, 6), 2))))
out$ca_na <- run(cf(ca(matrix(c(1, NA, 3, 4, 5, 6), 2))))
out$ca_one_row <- run(cf(ca(matrix(c(1, 2, 3), 1))))
out$ca_fraction <- run(cf(ca(smoke / 7)))
out$ca_scale_big <- run(cf(ca(smoke * 2^300)))
out$ca_scale_small <- run(cf(ca(smoke * 2^-300)))
out$ca_suprow_only_one_left <- run(cf(ca(m22, suprow = 1)))
out$ca_suprow_names <- run(cf(ca(smoke, suprow = "SE")))
out$ca_identity <- run(cf(ca(diag(4))))

## mjca: multiple and joint correspondence analysis
w4 <- wg93[, 1:4]
for (lam in c("adjusted", "indicator", "Burt", "JCA")) {
  out[[paste0("mjca_wg93_", lam)]] <- run(cf(mjca(w4, lambda = lam), rows = FALSE))
}
out$mjca_wg93_nd3 <- run(cf(mjca(w4, nd = 3), rows = FALSE))
out$mjca_wg93_supcol <- run(cf(mjca(wg93, supcol = 5:7), rows = FALSE))
out$mjca_wg93_supcol_indicator <- run(cf(mjca(wg93, supcol = 5:7, lambda = "indicator"), rows = FALSE))
out$mjca_wg93_reti <- run(cf(mjca(w4, lambda = "indicator", reti = TRUE), rows = FALSE))
out$mjca_wg93_jca_maxit <- run(cf(mjca(w4, lambda = "JCA", maxit = 5), rows = FALSE))
out$mjca_wg93_jca_eps <- run(cf(mjca(w4, lambda = "JCA", epsilon = 1e-10, maxit = 500), rows = FALSE))
out$mjca_wg93_subsetcat <- run(cf(mjca(w4, subsetcat = c(1:5, 11:15)), rows = FALSE))
out$mjca_wg93_ps <- run(cf(mjca(w4, ps = "."), rows = FALSE))
out$mjca_wg93_crosstab <- run(cf(mjca(table(w4[, 1:3])), rows = FALSE))
w60 <- wg93[1:60, 1:4]
for (lam in c("adjusted", "indicator", "Burt", "JCA")) {
  out[[paste0("mjca_w60_", lam)]] <- run(cf(mjca(w60, lambda = lam)))
}
out$mjca_w60_reti <- run(cf(mjca(w60[1:12, ], lambda = "indicator", reti = TRUE)))
small <- data.frame(a = factor(c("x", "y", "x", "z", "y", "x")), b = factor(c("p", "p", "q", "q", "q", "p")),
                    c = factor(c("u", "v", "v", "u", "u", "v")))
for (lam in c("adjusted", "indicator", "Burt", "JCA")) {
  out[[paste0("mjca_small_", lam)]] <- run(cf(mjca(small, lambda = lam)))
}
out$mjca_two_vars <- run(cf(mjca(small[, 1:2])))
out$mjca_one_var <- run(cf(mjca(small[, 1, drop = FALSE])))
out$mjca_unused_level <- run(cf(mjca(data.frame(a = factor(c("x", "y", "x"), levels = c("x", "y", "w")),
                                                b = factor(c("p", "q", "q"))))))
out$mjca_na <- run(cf(mjca(data.frame(a = factor(c("x", NA, "x", "y")), b = factor(c("p", "q", "q", "p"))))))
out$mjca_numeric_cols <- run(cf(mjca(data.frame(a = c(1, 2, 1, 2), b = c(3, 3, 4, 4)))))


