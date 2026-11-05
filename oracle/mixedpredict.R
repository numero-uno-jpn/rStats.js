source("/oracle/_mixedexact.R")

# Predictions of lmer and glmer fits: lme4's predict.merMod (fixture mixedPredict). Behaviour in
# oracle/glmer-behaviour.md ("Prediction: glmerPredict and lmerPredict (stage 4)"). Each case is one fit and several
# predictions:
#   kind            "glmer" or "lmer"
#   formula, data (with dataTypes)  the fit's; glmer: family, link, nAGQ (a string), optional weights (an array) and
#                   offset: an array, or the name of a column of data (G7; R fits it as an offset() term of the
#                   formula, so that predict() evaluates it in newdata); lmer: REML
#   calls           one object per prediction, with rStats.js's options: newdata (with newdataTypes), reForm (absent:
#                   all terms; false or "~0": none; a formula string), allowNewLevels, randomOnly, type, seFit,
#                   newoffset (with an offset given as an array: R's prediction plus newoffset)
# Written: expected, one entry per call: lme4's predict() at lme4's estimates, {fit, seFit, warnings} or {error};
# reference, one entry per call: the same at the exact optimum (glmer: oracle/glmer.R's search and Newton's method;
# lmer: oracle/lmer.R's optimum()), from the definitions of the behaviour document: eta = offset + V (b, beta) with the
# rows V = (z, x) from oracle/_mixedexact.R's design_rows() (lme4's predict() on copies of the fit with unit
# parameters), the type "response" by R's family linkinv (the fitted means of the exact fit without newdata, re.form
# and random.only), seFit = sqrt(v' C v) with C of cond_cov() at the exact fit (times |mu.eta(eta)| for "response"),
# and rStats.js's errors where they differ from R's (a new level of a factor of the fixed part; re.form's terms), NaN
# for rows with a missing value in a factor of the fixed part (an error in R). "lme4SeDiffers" (reference, per call,
# information) is true where lme4's se.fit differs by more than 1e-3 (relative) from the same formula at lme4's own
# estimates (with the weights of its last PIRLS iteration), or fails: lme4's errors.

SE_WARNING <- "se.fit computation uses an approximation to estimate the sampling distribution of the parameters"

offset_column <- function(a) is.character(a$offset) && length(a$offset) == 1
r_fit <- function(a) {   # lme4's fit, with an offset column as an offset() term
  if (a$kind == "lmer") {
    s <- LM$prepare(a)
    return(eval(substitute(lme4::lmer(F, dat, REML = R, contrasts = C), list(F = as.formula(a$formula), R = isTRUE(a$REML), C = s$ctr)),
                list2env(list(dat = s$dat))))
  }
  b <- a
  if (offset_column(a)) { b$formula <- paste(a$formula, "+ offset(", a$offset, ")"); b$offset <- NULL }
  suppressMessages(suppressWarnings(fit_lme4(b)))
}
exact_args <- function(a) { b <- a; if (offset_column(a)) b$offset <- a$data[[a$offset]]; b }

r_args <- function(cl) {
  out <- list()
  if (!is.null(cl$newdata)) out$newdata <- cl$newdata
  rf <- cl$reForm
  if (!is.null(rf)) out$re.form <- if (isFALSE(rf) || gsub(" ", "", rf) == "~0") NA else as.formula(rf)
  if (isTRUE(cl$randomOnly)) out$random.only <- TRUE
  out
}
fixed_factors <- function(fit) {   # the factors of the fixed part and their levels
  fr <- model.frame(fit, fixed.only = TRUE)
  vars <- all.vars(delete.response(terms(fit, fixed.only = TRUE)))
  levs <- lapply(vars, function(v) if (is.factor(fr[[v]])) levels(fr[[v]]))
  names(levs) <- vars
  Filter(Negate(is.null), levs)
}

predict_r <- function(fit, a, cl) {
  w <- character(0)
  r <- tryCatch(withCallingHandlers(
    do.call(predict, c(list(fit), r_args(cl), list(allow.new.levels = isTRUE(cl$allowNewLevels),
                                                  type = cl$type %||% "link", se.fit = isTRUE(cl$seFit)))),
    warning = function(cnd) { w <<- c(w, conditionMessage(cnd)); invokeRestart("muffleWarning") }),
    error = function(e) list(error = conditionMessage(e)))
  if (is.list(r) && !is.null(r$error)) return(r)
  fitv <- unname(if (is.list(r)) r$fit else r)
  if (!is.null(cl$newoffset)) fitv <- fitv + as.numeric(cl$newoffset)
  out <- list(fit = I(num2str(fitv)))
  if (isTRUE(cl$seFit)) out$seFit <- I(num2str(unname(r$se.fit)))
  out$warnings <- I(unique(w))
  out
}

expected <- function(a) {
  fit <- r_fit(a)
  lapply(a$calls, function(cl) predict_r(fit, a, cl))
}

reference <- function(a) {
  fit <- r_fit(a)
  glmm <- a$kind == "glmer"
  e <- if (glmm) glmer_exact(exact_args(a)) else lmer_exact(a)
  fam <- if (glmm) get(a$family, mode = "function")(link = a$link)
  X <- getME(fit, "X"); Z <- as.matrix(getME(fit, "Z"))
  C <- cond_cov(X, Z, lambda_of(fit, e$theta), if (glmm) e$W else 1, e$sigma)
  par <- c(e$b, e$beta)
  ff <- fixed_factors(fit)
  lapply(a$calls, function(cl) {
    if (!is.null(cl$refError)) return(list(error = cl$refError))
    nd <- cl$newdata
    nanRows <- integer(0)
    if (!is.null(nd)) for (v in names(ff)) {
      if (is.null(nd[[v]])) next
      new <- setdiff(nd[[v]][!is.na(nd[[v]])], ff[[v]])
      if (length(new)) return(list(error = sprintf("factor %s has new level %s", v, new[1])))
      miss <- which(is.na(nd[[v]])); nanRows <- union(nanRows, miss)
      nd[[v]][miss] <- ff[[v]][1]
    }
    cl2 <- cl; cl2$newdata <- nd
    plain <- cl2; plain$seFit <- NULL
    rr <- predict_r(fit, a, plain)   # R's own errors (NA grouping values, new levels, ...), without lme4's se.fit
    if (!is.null(rr$error)) return(rr)
    args <- r_args(cl2)
    raw <- is.null(args$newdata) && is.null(args$re.form) && !isTRUE(args$random.only)
    dr <- design_rows(fit, args, if (glmm) e$s$off else 0)
    eta <- if (raw && glmm) e$eta else as.vector(dr$off + dr$V %*% par)
    if (!is.null(cl$newoffset)) eta <- eta + as.numeric(cl$newoffset)
    type <- cl$type %||% "link"
    val <- if (glmm && type == "response") (if (raw) e$mu else fam$linkinv(eta)) else eta
    val[nanRows] <- NaN
    out <- list(fit = I(num2str(val)))
    if (isTRUE(cl$seFit)) {
      se <- sqrt(rowSums((dr$V %*% C) * dr$V))
      if (glmm && type == "response") se <- se * abs(fam$mu.eta(eta))
      se[nanRows] <- NaN
      out$seFit <- I(num2str(se))
      # lme4's se.fit against the formula at lme4's own estimates (its weights of the last PIRLS iteration)
      rs <- predict_r(fit, a, cl2)   # lme4's se.fit itself fails in some cases ("non-conformable arguments")
      ex <- if (is.null(rs$error)) suppressWarnings(num_in(rs$seFit)) else NA
      C4 <- cond_cov(X, Z, lambda_of(fit, unname(getME(fit, "theta"))), if (glmm) fit@resp$sqrtWrkWt()^2 else 1, sigma(fit))
      se4 <- sqrt(rowSums((dr$V %*% C4) * dr$V))
      if (glmm && type == "response") se4 <- se4 * abs(fam$mu.eta(as.vector(dr$off + dr$V %*% c(as.numeric(getME(fit, "b")), unname(fixef(fit))))))
      out$lme4SeDiffers <- !is.null(rs$error) || any(abs(ex - se4) > 1e-3 * abs(se4), na.rm = TRUE)
    }
    out$warnings <- I(if (glmm && isTRUE(cl$seFit)) SE_WARNING else character(0))
    out
  })
}
num_in <- function(x) as.numeric(unlist(x))

# ---- cases ----
add_case <- function(kind, formula, data, calls, ...) {
  calls <- lapply(calls, function(cl) { if (!is.null(cl$newdata)) cl$newdataTypes <- col_types(cl$newdata); cl })
  cases[[length(cases) + 1]] <<- c(list(kind = kind, formula = formula, data = data), list(...), list(calls = calls))
}
P <- function(...) list(...)
ND <- function(...) data.frame(..., stringsAsFactors = FALSE)

# glmer: cbpp
nd_cb <- ND(period = c("1", "2", "4", "3"), herd = c("1", "3", "15", "7"))
add_case("glmer", cbf, cb, family = "binomial", link = "logit", nAGQ = "1", calls = list(
  P(), P(type = "response"), P(seFit = TRUE),
  P(newdata = nd_cb, seFit = TRUE), P(newdata = nd_cb, type = "response", seFit = TRUE),
  P(newdata = ND(period = c("1", "2"), herd = c("1", NA))),                                        # NA: R's error
  P(newdata = ND(period = c("1", "2", "3"), herd = c("1", NA, "16")), allowNewLevels = TRUE, seFit = TRUE),
  P(newdata = ND(period = c("1", "2", "3"), herd = c("16", "17", "16"))),                          # new levels
  P(newdata = nd_cb, reForm = FALSE), P(reForm = "~0"), P(reForm = "~ (1 | herd)", type = "response"),
  P(newdata = nd_cb, randomOnly = TRUE), P(newdata = nd_cb, randomOnly = TRUE, reForm = FALSE),
  P(newdata = ND(period = c("1", "5"), herd = c("1", "2"))),                                       # a new level of period
  P(newdata = ND(period = c("1", NA, "2"), herd = c("1", "2", "3"))),                              # NaN here (R: an error)
  P(newdata = nd_cb, reForm = "~ (1 | foo)",
    refError = "grouping factors specified in re.form that were not present in original model"),
  P(newdata = nd_cb, reForm = "~ 1")))
# glmer: crossed grouping factors (lme4's se.fit is wrong here: the permutation, and the re.form subset)
nd_x <- ND(x = c(-0.5, 0, NA, 0.8), g = c("g01", "g05", "g07", "g12"), h = c("h2", "h6", "h1", "h3"))
add_case("glmer", "y ~ x + (1 | g) + (1 | h)", dbin, family = "binomial", link = "logit", nAGQ = "1", calls = list(
  P(newdata = nd_x, seFit = TRUE), P(newdata = nd_x, reForm = "~ (1 | h)", seFit = TRUE),
  P(newdata = nd_x, reForm = "~ (1 | g)", seFit = TRUE, type = "response"), P(seFit = TRUE, reForm = "~ (1 | g)")))
# glmer: an offset given as a column (evaluated in newdata) and as an array (newoffset)
dpl <- transform(dpo, lt = log(t))
nd_o <- ND(x = c(0.5, 1.5), g = c("g02", "g09"), lt = c(0, 1))
add_case("glmer", "yt ~ x + (1 | g)", dpl, family = "poisson", link = "log", nAGQ = "1", offset = "lt", calls = list(
  P(), P(reForm = FALSE), P(randomOnly = TRUE), P(newdata = nd_o), P(newdata = nd_o, reForm = FALSE, type = "response"),
  P(newdata = nd_o, randomOnly = TRUE)))
add_case("glmer", "yt ~ x + (1 | g)", dpl, family = "poisson", link = "log", nAGQ = "1", offset = I(num2str(dpl$lt)),
         calls = list(P(reForm = FALSE), P(newdata = nd_o[, c("x", "g")]),
                      P(newdata = nd_o[, c("x", "g")], newoffset = I(num2str(c(0, 1))), seFit = TRUE)))
# glmer: Gamma with a vector-valued term (re.form with fewer columns; sigma in seFit)
nd_g <- ND(x = c(0.2, 1.1, 1.9), g = c("g01", "g04", "g10"))
add_case("glmer", "y ~ x + (x | g)", dgm, family = "Gamma", link = "log", nAGQ = "1", calls = list(
  P(newdata = nd_g, seFit = TRUE, type = "response"), P(newdata = nd_g, reForm = "~ (1 | g)", seFit = TRUE),
  P(newdata = nd_g, reForm = "~ (z | g)",
    refError = "random effects specified in re.form that were not present in original model z")))
# glmer: nested grouping factors (h:g levels), nAGQ 5, a string response (not needed in newdata)
nd_t <- ND(cHEIGHT = c(-1, 0, 2), LOCATION = c("32", "32", "36"), BROOD = c("501", "999", "502"))
add_case("glmer", "TICKS ~ cHEIGHT + (1 | LOCATION/BROOD)", gt, family = "poisson", link = "log", nAGQ = "1", calls = list(
  P(newdata = nd_t, allowNewLevels = TRUE, seFit = TRUE), P(newdata = nd_t), P(newdata = nd_t, reForm = "~ (1 | LOCATION)"),
  P(newdata = nd_t[-2, ], seFit = TRUE)))
add_case("glmer", cbf, cb, family = "binomial", link = "logit", nAGQ = "5", calls = list(
  P(type = "response"), P(newdata = nd_cb, type = "response")))
add_case("glmer", "yn ~ x + (1 | g)", dbin, family = "binomial", link = "logit", nAGQ = "1", calls = list(
  P(newdata = ND(x = c(-1, 1), g = c("g03", "g04")), type = "response", seFit = TRUE)))

# lmer (oracle/lmer.R's data d and dna)
d <- LM$d; dna <- LM$dna
nd_l <- ND(x = c(0.5, 2, 3.5, NA), g = c("g01", "g06", "g12", "g02"), h = c("h1", "h3", "h5", "h2"))
add_case("lmer", "y ~ x + (1 | g) + (1 | h)", d, REML = TRUE, calls = list(
  P(), P(seFit = TRUE), P(type = "response"), P(newdata = nd_l, seFit = TRUE),
  P(newdata = nd_l, reForm = "~ (1 | h)", seFit = TRUE), P(newdata = nd_l, reForm = "~ (1 | g)", seFit = TRUE),
  P(newdata = nd_l, randomOnly = TRUE, seFit = TRUE), P(reForm = FALSE, seFit = TRUE),
  P(newdata = ND(x = 1:3, g = c("g01", "new1", "new2"), h = c("h1", "h9", NA)), allowNewLevels = TRUE, seFit = TRUE),
  P(newdata = ND(x = 1:12, g = sprintf("newsubject%d", 1:12), h = rep("h1", 12))),          # R's message cut at 60
  P(newdata = ND(x = 1:3, g = c("g01", "g02", NA), h = c("h1", "h2", "h3")))))
add_case("lmer", "y ~ f + x + (x | g)", d, REML = FALSE, levels = list(f = c("mid", "lo", "hi")), calls = list(
  P(newdata = ND(f = c("hi", "lo", "mid"), x = c(1, 2, 3), g = c("g03", "g04", "g05")), seFit = TRUE),
  P(newdata = ND(f = c("hi", "lo"), x = c(1, 2), g = c("g03", "g04")), reForm = "~ (1 | g)", seFit = TRUE),
  P(newdata = ND(f = c("hi", "top"), x = c(1, 2), g = c("g03", "g04")))))
add_case("lmer", "y ~ x + (1 | g)", dna, REML = TRUE, calls = list(P(), P(reForm = FALSE), P(seFit = TRUE)))

if (exists("DEBUG_ONE")) {
  for (i in DEBUG_ONE) { a <- cases[[i]]; str(expected(a)); str(reference(a)) }
} else write_anova_fixture("mixedPredict", cases, expected, reference)
