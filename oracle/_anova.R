source("/oracle/_htest.R")
suppressPackageStartupMessages(library(gmp))

# Shared code for the analysis-of-variance fixtures (oracle/modelmatrix.R, anovalm.R, caranova.R, aovstrata.R,
# aovez.R, mauchly.R). The behaviour being reproduced is described in oracle/anova-behaviour.md.
#
# Arguments. A data frame is written as an object with one array per column: numeric columns as strings (num2str,
# "NA" for a missing value), character columns as strings (null for a missing value), logical columns as booleans
# (null for a missing value). A formula is written as the string R deparses it to. Other arguments as in
# write_htest_fixture.
#
# Expected values. An anova table is written as {colNames, rowNames, table}: R's column and row names (row names
# without the padding R adds) and one array per row, with "NA" where R leaves the cell empty. Errors are written as
# {"error": message} and R's warnings as "warnings" (unique, in order).
#
# References. For the cases where R's floating-point result could be inaccurate, "reference" holds the same cells
# computed exactly: the sums of squares are rational functions of the data, computed with gmp's big rationals from the
# exact binary values of the doubles (Gram-Schmidt with exact arithmetic, so that aliased columns are found exactly);
# F values and the epsilons of the sphericity corrections are exact ratios converted to double at the end; p-values
# are R's pf() at the exact F value and degrees of freedom (the accuracy of pf() itself is tested elsewhere).

df_json <- function(d) {
  out <- lapply(d, function(v) {
    if (is.factor(v)) v <- as.character(v)
    if (is.character(v)) return(I(ifelse(is.na(v), NA, v)))
    if (is.logical(v)) return(I(v))
    I(num2str(v))
  })
  names(out) <- names(d)
  out
}

arg_json_plain <- arg_json
arg_json <- function(v) {
  if (is.data.frame(v)) return(df_json(v))
  if (inherits(v, "formula")) return(deparse1(v))
  if (is.list(v) && !inherits(v, "AsIs")) return(lapply(v, arg_json))
  arg_json_plain(v)
}

tab_out <- function(tab) {
  tab <- as.data.frame(tab)
  list(colNames = I(colnames(tab)), rowNames = I(trimws(rownames(tab))),
       table = lapply(seq_len(nrow(tab)), function(i) I(num2str(unname(unlist(tab[i, ]))))))
}

with_warnings <- function(f) {
  w <- character(0)
  v <- withCallingHandlers(f(), warning = function(cnd) {
    w <<- c(w, conditionMessage(cnd))
    invokeRestart("muffleWarning")
  })
  list(value = v, warnings = I(unique(w)))
}

# ---- exact least squares with big rationals ----

q_of <- function(x) as.bigq(x)
q_dot <- function(a, b, w = NULL) if (is.null(w)) sum(a * b) else sum(w * a * b)

# Gram-Schmidt on the columns of X (a list of bigq vectors), in order, with the inner product weighted by w.
# Returns the orthogonal vectors kept and, for each column, whether it was kept (FALSE: an exact linear combination
# of the earlier columns, which R reports as aliased).
q_gs <- function(cols, w = NULL) {
  basis <- list(); norms <- list(); kept <- logical(length(cols))
  for (j in seq_along(cols)) {
    v <- cols[[j]]
    for (k in seq_along(basis)) v <- v - (q_dot(v, basis[[k]], w) / norms[[k]]) * basis[[k]]
    nv <- q_dot(v, v, w)
    if (nv != 0) { basis[[length(basis) + 1]] <- v; norms[[length(norms) + 1]] <- nv; kept[j] <- TRUE }
  }
  list(basis = basis, norms = norms, kept = kept)
}

# Squared effects of y on the orthogonalised columns (one per kept column), and the residual sum of squares
q_effects <- function(gs, y, w = NULL) {
  e <- lapply(seq_along(gs$basis), function(k) q_dot(y, gs$basis[[k]], w)^2 / gs$norms[[k]])
  list(effects = e, rss = q_dot(y, y, w) - if (length(e)) Reduce(`+`, e) else q_of(0))
}

# Columns of a model matrix as bigq vectors
q_cols <- function(X) lapply(seq_len(ncol(X)), function(j) q_of(X[, j]))

# Residual sum of squares of y on the columns `which` of X (all if missing)
q_rss <- function(X, y, which = seq_len(ncol(X)), w = NULL) {
  q_effects(q_gs(q_cols(X)[which], w), q_of(y), w)$rss
}

# Sequential (type I) sums of squares by term: assign gives the term of each column (0 = intercept).
# Returns list(ss = bigq per term present among the kept columns, df, terms, rss, rdf)
q_sequential <- function(X, y, assign, w = NULL) {
  gs <- q_gs(q_cols(X), w)
  ef <- q_effects(gs, q_of(y), w)
  a <- assign[gs$kept]
  terms <- unique(a)
  ss <- lapply(terms, function(t) Reduce(`+`, ef$effects[a == t]))
  n <- if (is.null(w)) length(y) else sum(w != 0)
  list(ss = ss, df = vapply(terms, function(t) sum(a == t), 0), terms = terms, rss = ef$rss,
       rdf = n - sum(gs$kept))
}

qn <- function(q) as.numeric(q)  # bigq -> double (gmp truncates: within one unit in the last place)

# Long-format repeated-measures data: nsub subjects (id "s01", ...), the within-subject factors crossed (a named list
# of level vectors), an optional between-subjects factor G (levels recycled over the subjects), y with a subject
# effect; drop removes rows (to make cells missing)
long <- function(nsub, within, between = NULL, sd_sub = 1.5, sd = 0.7, drop = NULL) {
  g <- if (is.null(between)) rep("g1", nsub) else rep(between, length.out = nsub)
  w <- expand.grid(within, stringsAsFactors = FALSE)
  rows <- do.call(rbind, lapply(seq_len(nsub), function(s) data.frame(id = sprintf("s%02d", s), G = g[s], w,
                                                                      stringsAsFactors = FALSE)))
  subj <- rnorm(nsub, 0, sd_sub)[match(rows$id, sprintf("s%02d", seq_len(nsub)))]
  eff <- Reduce(`+`, lapply(names(within), function(f) (match(rows[[f]], within[[f]]) - 1) * 0.6))
  rows$y <- round(20 + subj + eff + 0.8 * (rows$G == "g2") + rnorm(nrow(rows), 0, sd), 2)
  if (!is.null(drop)) rows <- rows[-drop, ]
  if (is.null(between)) rows$G <- NULL
  rownames(rows) <- NULL
  rows
}

# Determinant of a square bigq matrix (Gaussian elimination with exact pivots)
q_det <- function(M) {
  n <- nrow(M); d <- as.bigq(1)
  for (k in seq_len(n)) {
    piv <- which(vapply(k:n, function(i) M[i, k] != 0, NA))[1]
    if (is.na(piv)) return(as.bigq(0))
    piv <- piv + k - 1
    if (piv != k) { tmp <- M[k, ]; M[k, ] <- M[piv, ]; M[piv, ] <- tmp; d <- -d }
    d <- d * M[k, k]
    if (k < n) for (i in (k + 1):n) if (M[i, k] != 0) M[i, ] <- M[i, ] - (M[i, k] / M[k, k]) * M[k, ]
  }
  d
}
