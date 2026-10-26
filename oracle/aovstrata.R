source("/oracle/_anova.R")

# Analysis of variance with an Error() term (several error strata): summary(aov(formula, data)) (fixture aovStrata).
# Each case has formula, data and (optional) contrasts as in oracle/anovalm.R. Written: strata, one entry per stratum
# that summary() prints ({stratum: "Error: id", colNames, rowNames, table}), and warnings. "reference" holds the
# same tables computed exactly: each stratum is the space spanned by one term of the Error() model orthogonal to the
# earlier ones (the last, "Within", is what remains), and the treatment columns projected onto it are fitted in
# order, leaving out those whose projection has squared length at most 1e-5, as R does.

set.seed(20261105)
w1 <- long(8, list(W = c("w1", "w2", "w3")))
w2 <- long(6, list(W1 = c("a", "b"), W2 = c("x", "y", "z")))
mix <- long(10, list(W = c("w1", "w2", "w3")), between = c("g1", "g2"))
mixu <- long(9, list(W = c("w1", "w2", "w3", "w4")), between = c("g1", "g2", "g2"))
miss <- long(8, list(W = c("w1", "w2", "w3")), drop = c(5, 13))     # two subjects miss one condition
npk2 <- npk; for (v in c("block", "N", "P", "K")) npk2[[v]] <- as.character(npk2[[v]])
wb <- w1; wb$wt <- 1

cases <- list()
add <- function(formula, data, ...) cases[[length(cases) + 1]] <<- c(list(formula = formula, data = data), list(...))
add("y ~ W + Error(id/W)", w1)
add("y ~ W + Error(id)", w1)
add("y ~ W1 * W2 + Error(id/(W1 * W2))", w2)
add("y ~ W1 * W2 + Error(id/(W1 + W2))", w2)
add("y ~ W1 * W2 + Error(id)", w2)
add("y ~ G * W + Error(id/W)", mix)
add("y ~ G * W + Error(id/W)", mixu)
add("y ~ G * W + Error(id/W)", mixu, contrasts = list(G = "contr.sum", W = "contr.sum"))
add("y ~ W * G + Error(id/W)", mixu)
add("y ~ G + Error(id)", mix)
add("y ~ W + Error(id/W)", miss)
add("y ~ W + Error(id)", miss)
add("yield ~ N * P * K + Error(block)", npk2)
add("yield ~ N + P + K + Error(block)", npk2)
add("yield ~ N * P + Error(block/N)", npk2)
add("y ~ W + Error(id/W) - 1", w1)
add("y ~ Error(id)", w1)
add("y ~ W + Error(id + G)", mix)          # G is constant within id: the Error() model is singular
# errors
add("y ~ W + Error(id) + Error(W)", w1)
cases[[length(cases) + 1]] <- list(formula = "y ~ W + Error(id/W)", data = wb, weights = "wt")

# (added later, at the end so that the earlier cases keep their indices)
# a contrast for a variable that appears only inside Error(): absent from the treatment model, so R warns
add("y ~ G * W + Error(id/W)", mixu, contrasts = list(id = "contr.sum", W = "contr.sum", Q = "contr.helmert"))

write_anova_fixture("aovStrata", cases, function(a) {
  r <- with_warnings(function() {
    ctr <- if (is.null(a$contrasts)) NULL else lapply(a$contrasts, identity)
    dat <- a$data
    fit <- if (is.null(a$weights)) aov(as.formula(a$formula), dat, contrasts = ctr) else {
      dat$.w <- dat[[a$weights]]; aov(as.formula(a$formula), dat, weights = .w, contrasts = ctr)
    }
    s <- summary(fit)
    lapply(names(s), function(nm) c(list(stratum = nm), tab_out(s[[nm]][[1]])))
  })
  list(strata = r$value, warnings = r$warnings)
}, ref = function(a) {
  ctr <- if (is.null(a$contrasts)) NULL else lapply(a$contrasts, identity)
  f <- as.formula(a$formula)
  tt <- terms(f, "Error", data = a$data)
  ie <- attr(tt, "specials")$Error
  if (length(ie) != 1 || !is.null(a$weights)) return(NULL)
  eterm <- attr(tt, "variables")[[1 + ie]]
  intercept <- attr(tt, "intercept") == 1
  op <- options(contrasts = c("contr.helmert", "contr.poly")); on.exit(options(op))
  ef <- as.formula(paste(deparse1(f[[2]]), "~", deparse1(eterm[[2]]), if (!intercept) "- 1"))
  mfe <- model.frame(ef, a$data); Xe <- model.matrix(ef, mfe)
  options(op)
  tf <- update(f, paste(". ~ . -", deparse1(eterm)))
  mft <- model.frame(tf, a$data); Xt <- model.matrix(terms(tf), mft, contrasts.arg = ctr)
  y <- q_of(model.response(mft))
  gs <- q_gs(q_cols(Xe))
  ae <- attr(Xe, "assign")[gs$kept]
  labs <- c("(Intercept)", attr(terms(ef), "term.labels"))
  proj <- function(v, idx) {                       # projection of v onto the span of the basis vectors idx
    out <- q_of(rep(0, length(v)))
    for (k in idx) out <- out + (q_dot(v, gs$basis[[k]]) / gs$norms[[k]]) * gs$basis[[k]]
    out
  }
  strata <- c(lapply(sort(unique(ae)), function(s) list(name = labs[s + 1], idx = which(ae == s))),
              if (length(y) > length(ae)) list(list(name = "Within", idx = NULL)))
  tlabs <- c("(Intercept)", attr(terms(tf), "term.labels"))
  out <- list()
  for (st in strata) {
    if (st$name == "(Intercept)") next
    P <- if (is.null(st$idx)) function(v) v - proj(v, seq_along(gs$basis)) else function(v) proj(v, st$idx)
    dim_s <- if (is.null(st$idx)) length(y) - length(gs$basis) else length(st$idx)
    cols <- lapply(q_cols(Xt), P)
    keep <- vapply(cols, function(v) qn(q_dot(v, v)) > 1e-5, NA)
    py <- P(y)
    g2 <- q_gs(cols[keep])
    ee <- q_effects(g2, py)
    at <- attr(Xt, "assign")[keep][g2$kept]
    terms_s <- unique(at)
    rdf <- dim_s - length(at)
    rows <- lapply(terms_s, function(t) {
      ss <- Reduce(`+`, ee$effects[at == t]); df <- sum(at == t); ms <- ss / df
      if (rdf > 0) { fv <- qn(ms / (ee$rss / rdf)); c(df, qn(ss), qn(ms), fv, pf(fv, df, rdf, lower.tail = FALSE)) }
      else c(df, qn(ss), qn(ms))
    })
    rn <- tlabs[terms_s + 1]
    if (rdf > 0) { rows[[length(rows) + 1]] <- c(rdf, qn(ee$rss), qn(ee$rss / rdf), NA, NA); rn <- c(rn, "Residuals") }
    keep_rows <- rn != "(Intercept)"
    out[[length(out) + 1]] <- list(stratum = paste("Error:", st$name), rowNames = I(rn[keep_rows]),
                                   table = lapply(rows[keep_rows], function(r) I(num2str(r))))
  }
  list(strata = out)
})
