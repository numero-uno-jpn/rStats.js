source("/oracle/_glm.R")
suppressPackageStartupMessages({ library(sandwich); library(lmtest) })

# Shared code for the robust-covariance oracles (vcovhc, vcovcl, coeftest). Behaviour in oracle/robust-behaviour.md.
#
# A case describes the model with the matrix interface of oracle/_glm.R:
#   model      "lm" or "glm"
#   x, y, intercept, weights   as in oracle/_glm.R (lm: no offset); x has no intercept column, its columns are the
#              terms x1..xp
#   family, link, variance, offset, start, epsilon, maxit   glm only, as in oracle/_glm.R
# Rows with NA are dropped by the fit (na.omit); the row names of the model frame are the original row numbers 1..n,
# which is what sandwich's warnings name.
# A one-way cluster is a vector (numbers or strings, "NA" for a missing label); a multi-way cluster is a list of such
# vectors, one per clustering dimension (written as an array of columns, not of rows).

# arg_json of _htest.R, extended to lists (a JSON array, or an object for a named list, of the converted elements)
.arg_json_base <- arg_json
arg_json <- function(v) {
  if (is.list(v) && !is.data.frame(v)) return(lapply(v, function(e) {
    if (is.list(e)) return(arg_json(e))
    if (is.character(e) || is.logical(e) || is.matrix(e)) return(.arg_json_base(unclass(e)))
    .arg_json_base(if (length(e) == 1) unclass(e) else I(unclass(e)))
  }))
  .arg_json_base(v)
}

robust_fit <- function(a) {
  if (identical(a$model, "lm")) {
    d <- glm_frame(a$x)
    y <- unclass(a$y)
    if (NROW(y) != nrow(d)) stop("variable lengths differ (found for 'x1')")
    d$y <- y
    cl <- list(formula = glm_formula(a[c("x", "intercept")]), data = d)
    if (!is.null(a$weights)) { cl$data$.w <- unclass(a$weights); cl$weights <- quote(.w) }
    return(do.call("lm", cl))
  }
  glm_fit(a)
}

# The fit and its warnings (kept apart from the warnings of the covariance function)
fit_with_warnings <- function(a) with_warnings(function() robust_fit(a))

# The cluster argument as sandwich takes it: a vector, a factor (clusterLevels: the factor's levels, unused ones
# included) or a data frame of the dimensions
cluster_arg <- function(a) {
  cl <- a$cluster
  if (is.null(cl)) return(NULL)
  if (is.list(cl)) {
    cols <- lapply(cl, unclass)
    names(cols) <- paste0("c", seq_along(cols))
    return(as.data.frame(cols, stringsAsFactors = FALSE))
  }
  cl <- unclass(cl)
  if (!is.null(a$clusterLevels)) cl <- factor(cl, levels = unclass(a$clusterLevels))
  cl
}

# A covariance matrix: its rows and its dimnames
vc_out <- function(V) list(vcov = mat_out(V), names = I(rownames(V) %||% character(0)))

# The pieces of the sandwich in R's own terms, recomputed without sandwich (for the references): the model matrix of the
# non-aliased columns, the residual factor res (lm: w e; glm: W z / phi), the bread core A (X'WX)^-1, n (all rows) and
# n_ok (rows of non-zero weight), the hat values (rows of non-zero weight only)
sandwich_parts <- function(fit) {
  X <- model.matrix(fit)
  al <- is.na(coef(fit))
  X <- X[, !al, drop = FALSE]
  if (inherits(fit, "glm")) {
    W <- fit$weights
    z <- fit$residuals
    phi <- if (fit$family$family %in% c("poisson", "binomial")) 1 else sum((W * z)^2) / sum(W)
    res <- W * z / phi
    A <- summary(fit)$cov.unscaled
  } else {
    W <- if (is.null(fit$weights)) rep(1, nrow(X)) else fit$weights
    res <- W * residuals(fit)
    phi <- 1
    A <- summary.lm(fit)$cov.unscaled
  }
  list(X = X, W = W, res = res, phi = phi, A = A, n = nrow(X), k = ncol(X), nok = fit$df.residual + fit$rank)
}

# The clustered meat with the symmetric HC2/HC3 adjustment (weights inside the square roots), for the references of
# weighted fits: U_g = Xs_g' M_g rs_g with Xs = sqrt(W) X, rs = res / sqrt(W) and M_g = (I - Hs_gg)^(-1/2) or ^(-1), Hs_gg =
# Xs_g A Xs_g'. Rows of zero weight must have been removed. Returns the sandwich with sandwich's scaling (one-way only)
natural_cl <- function(fit, cluster, type, cadjust = TRUE) {
  P <- sandwich_parts(fit)
  if (any(P$W <= 0)) stop("natural_cl: zero weights")
  sw <- sqrt(P$W)
  Xs <- sw * P$X
  rs <- P$res / sw
  A <- P$A
  labs <- unique(cluster)
  G <- length(labs)
  n <- P$n
  S <- matrix(0, P$k, P$k)
  for (j in labs) {
    i <- which(cluster == j)
    Hs <- Xs[i, , drop = FALSE] %*% A %*% t(Xs[i, , drop = FALSE])
    IH <- diag(length(i)) - Hs
    M <- if (type == "HC3") solve(IH) else { e <- eigen((IH + t(IH)) / 2, symmetric = TRUE); e$vectors %*% (e$values^-0.5 * t(e$vectors)) }
    U <- crossprod(Xs[i, , drop = FALSE], M %*% rs[i])
    S <- S + tcrossprod(U)
  }
  # sandwich: adj G/(G-1) times the factor (G-1)/G of HC2/HC3; meat /n; bread n_ok A phi; sandwich /n
  adj <- if (cadjust) 1 else (G - 1) / G
  B <- P$nok * A * P$phi
  V <- B %*% (adj * S / n) %*% B / n
  dimnames(V) <- list(colnames(P$X), colnames(P$X))
  V
}
