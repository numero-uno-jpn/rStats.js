source("/oracle/_anova.R")
suppressPackageStartupMessages(library(lme4))

# The structure of a linear mixed model: lme4's lFormula() (fixture lmerTerms). Behaviour in oracle/lmer-behaviour.md
# ("Formulas with random-effects terms" and "The structure"). Each case has
#   formula    the formula, as a string
#   data       the data frame (see oracle/_anova.R)
#   contrasts  (optional) contrast per factor of the fixed-effects part
#   levels     (optional) level order per factor (R: factor(x, levels = ...) before the call)
# Written for each case:
#   rows        1-based rows of data kept (rows with a missing value in any variable of the formula are dropped)
#   xColNames   column names of the fixed-effects model matrix X (after dropping aliased columns)
#   x           X, one array per row
#   terms       the random-effects terms in their final order: label (the term as R deparses it, e.g. "0 + x | g"),
#               group (the grouping factor's name), columns (the names of the term's columns), nLevels
#   groups      the distinct grouping factors in order of first use by the terms: name and levels
#   termGroup   for each term, the 1-based index of its grouping factor in groups
#   z           the nonzero entries of Z (n x q) as [row, column, value], 1-based, by column then row
#   zColLevels  for each column of Z, the level it belongs to
#   theta       the initial value of theta; lower its lower bounds
#   lambda      the nonzero pattern of Lambda (q x q, lower triangular) as [row, column, k], 1-based, by column then
#               row: the entry is theta[k]
#   messages, warnings  R's messages (without the final newline) and warnings, unique, in order
# Inputs R rejects: {"error": message}.

with_conditions <- function(f) {
  w <- character(0); m <- character(0)
  v <- withCallingHandlers(f(),
    warning = function(cnd) { w <<- c(w, conditionMessage(cnd)); invokeRestart("muffleWarning") },
    message = function(cnd) { m <<- c(m, sub("\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") })
  list(value = v, warnings = I(unique(w)), messages = I(unique(m)))
}

triplets <- function(M) {
  M <- as(as(M, "generalMatrix"), "TsparseMatrix")
  o <- order(M@j, M@i)
  lapply(o, function(k) I(num2str(c(M@i[k] + 1, M@j[k] + 1, M@x[k]))))
}

set.seed(20261027)
n <- 24
d <- data.frame(
  y = round(rnorm(n, 10, 2), 2),
  x = rep(1:4, 6),
  z = round(rnorm(n), 2),
  a = rep(c("p", "q", "r"), each = 8),
  b = rep(c("u", "v"), 12),
  g = rep(c(3, 10, 2, 1), 6),
  f = rep(c("lo", "hi", "mid"), 8),
  L = rep(c(TRUE, FALSE, FALSE), 8),
  stringsAsFactors = FALSE
)
dna <- d
dna$a[3] <- NA; dna$x[5] <- NA; dna$y[7] <- NA; dna$b[11] <- NA
dsc <- transform(d, big = round(x * 1e4 + z, 2))                 # a column on a very different scale
dcol <- transform(d, x2 = 2 * x)                                  # an aliased column
dnum <- data.frame(y = d$y, G = rep(c(0.1, 0.2, 0.30000000000000004, 1e-20), 6), x = d$x)
sleep <- as.data.frame(sleepstudy); sleep$Subject <- as.character(sleep$Subject)
pen <- as.data.frame(Penicillin); pen$plate <- as.character(pen$plate); pen$sample <- as.character(pen$sample)
pastes <- as.data.frame(Pastes)[, c("strength", "batch", "cask")]
pastes$batch <- as.character(pastes$batch); pastes$cask <- as.character(pastes$cask)
dye <- as.data.frame(Dyestuff); dye$Batch <- as.character(dye$Batch)

cases <- list()
add <- function(formula, data = d, ...) cases[[length(cases) + 1]] <<- c(list(formula = formula, data = data), list(...))

for (f in c("y ~ x + (1 | g)", "y ~ x + (x | a)", "y ~ (1 | a) + (1 | g)", "y ~ (1 | b) + (1 | a) + (x | b)",
            "y ~ (1 | g) + (1 | a) + (1 | b)", "y ~ (1 | b) + (1 | a) + (1 | g)",
            "y ~ (1 | a/b)", "y ~ (1 | a:b)", "y ~ (1 | b:a)", "y ~ (1 | a*b)", "y ~ (1 | b/a/f)",
            "y ~ (x || a)", "y ~ (f || a)", "y ~ (x + z || a)", "y ~ (0 + x || a)", "y ~ (x || a/b)",
            "y ~ (f | a)", "y ~ (0 + f | a)", "y ~ (0 + x | a) + (1 | a)", "y ~ x + (x + z | a)",
            "y ~ (x:z | a)", "y ~ (x * z | a)", "y ~ (1 | b) + (1 | b)", "y ~ (1 + x | a) + (1 | a:b)",
            "y ~ x + (1 | a) - 1", "y ~ 0 + x + (1 | a)", "y ~ (-1 + x | a)", "y ~ (x - 1 | a)",
            "y ~ 1 + (1 | a)", "y ~ (1 | a) + x", "y ~ x * f + (1 | a)", "y ~ (x | a) + (x | b)",
            "y ~ g + (1 | g)", "y ~ (1 | L)", "y ~ L + (L | a)", "y ~ a + (1 | a)", "y ~ f + (1 | a) + (1 | f)",
            "y ~ a:b + (1 | g)", "y ~ (1 | (a + b))", "y ~ x + (1 | a) + (0 + z | b)"))
  add(f)
add("y ~ (x | a)", data = dna)
add("y ~ x + (1 | a/b)", data = dna)
add("y ~ a + (1 | b)", contrasts = list(a = "contr.sum"))
add("y ~ a * f + (f | b)", contrasts = list(a = "contr.helmert", f = "contr.sum"))
add("y ~ a + (1 | a)", levels = list(a = c("r", "p", "q", "s")))
add("y ~ f + (f | a)", levels = list(f = c("mid", "lo", "hi")))
add("y ~ x + x2 + (1 | a)", data = dcol)
add("y ~ x + big + (1 | a)", data = dsc)
add("y ~ x + (1 | G)", data = dnum)
dlg <- d; dlg$L <- TRUE
add("y ~ x + L + (1 | a)", data = dlg)                          # a logical column with one value: LTRUE aliased
add("y ~ x + (L | a)", data = dlg)                              # ... in the left-hand side of a bar
dl2 <- d; dl2$y[!dl2$L] <- NA
add("y ~ L + (1 | a)", data = dl2)                              # FALSE only in dropped rows
dl3 <- d; dl3$y[dl3$a == "r"] <- NA
add("y ~ a + (1 | g)", data = dl3)                              # a level only in dropped rows
add("Reaction ~ Days + (Days | Subject)", data = sleep)
add("Reaction ~ Days + (Days || Subject)", data = sleep)
add("Reaction ~ Days + (1 | Subject) + (0 + Days | Subject)", data = sleep)
add("diameter ~ 1 + (1 | plate) + (1 | sample)", data = pen)
add("strength ~ 1 + (1 | batch/cask)", data = pastes)
add("strength ~ 1 + (1 | batch) + (1 | cask:batch)", data = pastes)
add("Yield ~ 1 + (1 | Batch)", data = dye)
# errors
add("y ~ x")                                                     # no random-effects term
add("y ~ (1 | a)", data = d[1:8, ])                              # one level
add("y ~ (1 | x)", data = d[1:4, ])                              # as many levels as observations
add("y ~ (x | g)", data = d[1:8, ])                              # as many random effects as observations
add("y ~ (x | a) + (1 | g)", data = d[1:8, ])
add("y ~ (1 | L)", data = dl2)                                 # a logical grouping factor with one level left
add("y ~ (1 | Q)")                                               # unknown variable
d0 <- d; d0$y <- NA_real_
add("y ~ (1 | a)", data = d0)                                    # no rows left

write_anova_fixture("lmerTerms", cases, function(a) {
  r <- with_conditions(function() {
    dat <- a$data
    for (nm in names(a$levels)) dat[[nm]] <- factor(dat[[nm]], levels = a$levels[[nm]])
    ctr <- if (is.null(a$contrasts)) NULL else lapply(a$contrasts, identity)
    lf <- lFormula(as.formula(a$formula), dat, contrasts = ctr)
    rt <- lf$reTrms
    X <- lf$X
    Lt <- rt$Lambdat; Lt@x <- as.double(rt$Lind)
    list(
      rows = I(num2str(as.integer(rownames(lf$fr)))),
      xColNames = I(colnames(X)),
      x = lapply(seq_len(nrow(X)), function(i) I(num2str(unname(X[i, ])))),
      terms = lapply(seq_along(rt$cnms), function(k)
        list(label = names(rt$Ztlist)[k], group = names(rt$cnms)[k], columns = I(rt$cnms[[k]]),
             nLevels = num2str(rt$nl[k]))),
      groups = lapply(names(rt$flist), function(g) list(name = g, levels = I(levels(rt$flist[[g]])))),
      termGroup = I(num2str(attr(rt$flist, "assign"))),
      z = triplets(t(rt$Zt)),
      zColLevels = I(rownames(rt$Zt)),
      theta = I(num2str(rt$theta)),
      lower = I(num2str(rt$lower)),
      lambda = triplets(t(Lt))
    )
  })
  c(r$value, list(warnings = r$warnings, messages = r$messages))
})
