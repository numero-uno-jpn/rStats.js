source("/oracle/_anova.R")
suppressPackageStartupMessages(library(car))

# Type II and type III tests of linear models: car::Anova(lm(formula, data), type = 2 or 3) (fixture carAnova). Each
# case has formula, data, contrasts and weights as in oracle/anovalm.R, and type (2 or 3). Written: the table
# ({colNames, rowNames, table}) and warnings. "reference" holds the table computed exactly from model comparisons:
#   type II:  SS(term) = RSS(model without the term and the terms that contain it) - RSS(model without the terms
#             that contain it)
#   type III: SS(term) = RSS(model without the term's columns) - RSS(model), the intercept included
# (the columns removed are those of the model's own model matrix, so type III depends on the contrasts).

set.seed(20261104)
mk2 <- function(sizes, sd = 1) {
  cells <- expand.grid(A = c("a", "b", "c"), B = c("p", "q"), stringsAsFactors = FALSE)
  rows <- cells[rep(seq_len(nrow(cells)), sizes), ]
  ia <- match(rows$A, c("a", "b", "c")); ib <- match(rows$B, c("p", "q"))
  y <- 10 + c(0, 1.5, -1)[ia] + c(0, 0.8)[ib] + 0.7 * (ia == 2 & ib == 2) + rnorm(nrow(rows), 0, sd)
  data.frame(y = round(y, 2), A = rows$A, B = rows$B, x = round(runif(nrow(rows), 0, 10), 1),
             w = sample(c(0.5, 1, 2), nrow(rows), TRUE), stringsAsFactors = FALSE, row.names = NULL)
}
bal <- mk2(rep(4, 6))
unb <- mk2(c(3, 5, 2, 4, 6, 3))
empty <- mk2(c(3, 4, 2, 3, 0, 3))
one <- mk2(rep(1, 6))
d3 <- mk2(c(4, 3, 5, 3, 4, 4)); d3$C <- rep(c("u", "v"), length.out = nrow(d3))
perfect <- bal; perfect$y <- 10 + c(a = 0, b = 2, c = -1)[perfect$A] + c(p = 0, q = 3)[perfect$B]
wb <- warpbreaks; wb$wool <- as.character(wb$wool); wb$tension <- as.character(wb$tension)
sum2 <- list(A = "contr.sum", B = "contr.sum")

cases <- list()
add <- function(formula, data, ...) cases[[length(cases) + 1]] <<- c(list(formula = formula, data = data), list(...))
for (type in c(2, 3)) {
  for (d in list(bal, unb)) {
    for (f in c("y ~ A", "y ~ A + B", "y ~ A * B", "y ~ B * A", "y ~ A * B + x", "y ~ x * A", "y ~ A + x"))
      add(f, d, type = type)
    add("y ~ A * B", d, type = type, contrasts = sum2)
    add("y ~ A * B + x", d, type = type, contrasts = sum2)
  }
  add("y ~ A * B", unb, type = type, contrasts = list(A = "contr.helmert", B = "contr.sum"))
  add("y ~ A * B", unb, type = type, weights = "w", contrasts = sum2)
  add("y ~ A * B * C", d3, type = type, contrasts = list(A = "contr.sum", B = "contr.sum", C = "contr.sum"))
  add("y ~ A * B * C", d3, type = type)
  add("y ~ A + B - 1", unb, type = type)
  add("y ~ A * B", empty, type = type)                   # aliased: type II by model comparison, type III an error
  add("y ~ A + B", empty, type = type)
  add("y ~ 1", unb, type = type)                         # type II: "Type III test substituted"
  add("y ~ A * B", one, type = type)                     # residual df 0: an error
  add("y ~ A + B", perfect, type = type)                 # residual sum of squares 0: an error
  add("breaks ~ wool * tension", wb, type = type)
  add("breaks ~ wool * tension", wb, type = type, contrasts = list(wool = "contr.sum", tension = "contr.sum"))
}

fit <- function(formula, a) {
  ctr <- if (is.null(a$contrasts)) NULL else lapply(a$contrasts, identity)
  dat <- a$data
  if (is.null(a$weights)) lm(as.formula(formula), dat, contrasts = ctr)
  else { dat$.w <- dat[[a$weights]]; lm(as.formula(formula), dat, weights = .w, contrasts = ctr) }
}

write_anova_fixture("carAnova", cases, function(a) {
  r <- with_warnings(function() tab_out(Anova(fit(a$formula, a), type = a$type)))
  c(r$value, list(warnings = r$warnings))
}, ref = function(a) {
  m <- fit(a$formula, a)
  X <- model.matrix(m); y <- model.response(model.frame(m))
  w <- if (is.null(m$weights)) NULL else q_of(m$weights)
  asg <- attr(X, "assign"); tt <- terms(m); fac <- attr(tt, "factors"); labs <- attr(tt, "term.labels")
  intercept <- attr(tt, "intercept") == 1
  rss <- function(drop_terms) q_rss(X, y, which(!(asg %in% drop_terms)), w)
  full <- rss(integer(0)); n <- if (is.null(w)) length(y) else sum(m$weights != 0)
  rdf <- n - m$rank
  if (rdf == 0 || qn(full) < sqrt(.Machine$double.eps)) return(NULL)
  contains <- function(t) which(vapply(seq_along(labs), function(u) u != t && all(fac[, t] == 0 | fac[, u] > 0), NA))
  if (a$type == 2 && length(labs) > 0) {
    ss <- lapply(seq_along(labs), function(t) { rel <- contains(t); rss(c(rel, t)) - rss(rel) })
    dfs <- vapply(seq_along(labs), function(t) { rel <- contains(t)
      sum(q_gs(q_cols(X)[!(asg %in% rel)], w)$kept) - sum(q_gs(q_cols(X)[!(asg %in% c(rel, t))], w)$kept) }, 0)
  } else {
    if (any(is.na(coef(m)))) return(NULL)
    ts <- c(if (intercept) 0L, seq_along(labs))
    ss <- lapply(ts, function(t) rss(t) - full)
    dfs <- vapply(ts, function(t) sum(asg == t), 0)
  }
  rows <- lapply(seq_along(ss), function(i) {
    f <- (ss[[i]] / dfs[i]) / (full / rdf)
    c(qn(ss[[i]]), dfs[i], qn(f), pf(qn(f), dfs[i], rdf, lower.tail = FALSE))
  })
  rows[[length(rows) + 1]] <- c(qn(full), rdf, NA, NA)
  list(table = lapply(rows, function(r) I(num2str(r))))
})
