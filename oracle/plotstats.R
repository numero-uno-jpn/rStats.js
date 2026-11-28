# issue: 571
# oracle-platform: amd64
# Public outputs of ppoints, qqnorm, boxplot.stats, lowess, bw.nrd0, bw.nrd, density and lm's influence measures
# (R 4.6.2) for test/fixtures/plotstats.json (1.21.0). The cases are those of experiments/plot121-basic.R and
# experiments/plot121-edge.R (experiments 1 and 2 of experiments/plot121-log.md), whose behaviour they fix.
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
num <- function(v) { v <- as.numeric(v); v }

set.seed(20261128)
samples <- list(
  eruptions = as.numeric(faithful$eruptions),
  precip = as.numeric(precip),
  small = c(3.1, 1.2, 5.5, 1.2, 9.0),
  ties = c(1, 2, 2, 2, 3, 3, 10, -4, 2, 2, 2, 7),
  two = c(0.5, 2.5),
  one = 4,
  const = rep(2.5, 6),
  normal = rnorm(40),
  large = rexp(2000)
)

# ppoints, qqnorm, qqline
pp <- list()
for (n in c(1, 2, 5, 10, 11, 50)) pp[[as.character(n)]] <- list(n = n, default = ppoints(n), a0 = ppoints(n, a = 0),
                                                                  a1 = ppoints(n, a = 1))
out$ppoints <- pp
qq <- list()
for (nm in names(samples)) {
  y <- samples[[nm]]
  q <- qqnorm(y, plot.it = FALSE)
  # qqline's line: recorded through its documented construction (no plotting device needed for the values)
  yq <- quantile(y, c(0.25, 0.75), names = FALSE); xq <- qnorm(c(0.25, 0.75))
  slope <- diff(yq) / diff(xq); int <- yq[1] - slope * xq[1]
  qq[[nm]] <- list(y = y, x = num(q$x), qy = num(q$y), slope = slope, intercept = int)
}
yna <- c(2, NA, 5, 1, NA, 3)
qna <- qqnorm(yna, plot.it = FALSE)
qq$withNA <- list(y = yna, x = num(qna$x), qy = num(qna$y))
out$qqnorm <- qq

# boxplot.stats
bs <- list()
for (nm in names(samples)) {
  y <- samples[[nm]]
  for (cf in c(1.5, 0, 3)) {
    b <- boxplot.stats(y, coef = cf)
    bs[[paste(nm, cf)]] <- list(sample = nm, coef = cf, stats = num(b$stats), n = b$n, conf = num(b$conf),
                                out = num(b$out))
  }
}
b <- boxplot.stats(yna); bs$withNA <- list(sample = "withNA", y = yna, coef = 1.5, stats = num(b$stats), n = b$n,
                                           conf = num(b$conf), out = num(b$out))
out$boxplot <- bs
# boxplot(plot = FALSE) for groups: the grouped stats
g <- boxplot(count ~ spray, data = InsectSprays, plot = FALSE)
out$boxplotGroups <- list(stats = g$stats, n = num(g$n), conf = g$conf, out = num(g$out), group = num(g$group),
                          names = g$names)

# lowess
lw <- list()
xy <- list(cars = list(x = as.numeric(cars$speed), y = as.numeric(cars[[2]])),
           faithful = list(x = as.numeric(faithful$waiting), y = as.numeric(faithful$eruptions)),
           small = list(x = c(1, 2, 3, 4, 5, 6, 7), y = c(2, 1, 4, 3, 7, 5, 9)),
           unsorted = list(x = c(5, 1, 4, 2, 3, 2), y = c(1, 5, 2, 4, 3, 6)))
for (nm in names(xy)) {
  d <- xy[[nm]]
  for (st in list(c(f = 2/3, iter = 3), c(f = 0.3, iter = 0), c(f = 1, iter = 5))) {
    r <- lowess(d$x, d$y, f = st[["f"]], iter = st[["iter"]])
    lw[[paste(nm, st[["f"]], st[["iter"]])]] <- list(data = nm, x = d$x, y = d$y, f = st[["f"]], iter = st[["iter"]],
                                                     ox = num(r$x), oy = num(r$y))
  }
  r <- lowess(d$x, d$y, delta = 0)
  lw[[paste(nm, "delta0")]] <- list(data = nm, x = d$x, y = d$y, f = 2/3, iter = 3, delta = 0, ox = num(r$x),
                                    oy = num(r$y))
}
out$lowess <- lw

# bandwidths and density
bw <- list(); de <- list()
for (nm in names(samples)) {
  y <- samples[[nm]]
  b <- list(sample = nm, nrd0 = tryCatch(bw.nrd0(y), error = function(e) conditionMessage(e)),
            nrd = tryCatch(bw.nrd(y), error = function(e) conditionMessage(e)))
  if (length(y) >= 2 && var(y) > 0) {
    b$ucv <- suppressWarnings(bw.ucv(y)); b$bcv <- suppressWarnings(bw.bcv(y))
    b$sjste <- bw.SJ(y, method = "ste"); b$sjdpi <- bw.SJ(y, method = "dpi")
  }
  bw[[nm]] <- b
  for (k in c("gaussian", "epanechnikov", "rectangular", "triangular", "biweight", "cosine", "optcosine")) {
    d <- tryCatch(density(y, kernel = k), error = function(e) NULL)
    if (!is.null(d)) de[[paste(nm, k)]] <- list(sample = nm, kernel = k, bw = d$bw, n = d$n, x = num(d$x),
                                                y = num(d$y))
  }
}
out$bw <- bw
y <- samples$eruptions
de$n100 <- list(sample = "eruptions", kernel = "gaussian", nout = 100, d = density(y, n = 100)[c("x", "y", "bw")])
de$n1000 <- list(sample = "eruptions", kernel = "gaussian", nout = 1000, d = density(y, n = 1000)[c("x", "y", "bw")])
de$fromto <- list(sample = "eruptions", kernel = "gaussian", from = 0, to = 7,
                  d = density(y, from = 0, to = 7)[c("x", "y", "bw")])
de$adjust <- list(sample = "eruptions", kernel = "gaussian", adjust = 0.5,
                  d = density(y, adjust = 0.5)[c("x", "y", "bw")])
de$bw03 <- list(sample = "eruptions", kernel = "gaussian", bw = 0.3, d = density(y, bw = 0.3)[c("x", "y", "bw")])
de$cut1 <- list(sample = "eruptions", kernel = "gaussian", cut = 1, d = density(y, cut = 1)[c("x", "y", "bw")])
w <- seq_along(y) / sum(seq_along(y))
de$weights <- list(sample = "eruptions", kernel = "gaussian", weights = w,
                   d = suppressWarnings(density(y, weights = w))[c("x", "y", "bw")])
de$sj <- list(sample = "eruptions", kernel = "gaussian", bwName = "SJ", d = density(y, bw = "SJ")[c("x", "y", "bw")])
de$withNA <- list(sample = "withNA", y = yna, kernel = "gaussian",
                  d = density(yna, na.rm = TRUE)[c("x", "y", "bw", "n")])
out$density <- de

# lm influence
carsd <- data.frame(speed = cars$speed, stop = cars[[2]])
fits <- list(cars = lm(stop ~ speed, data = carsd),
             mtcars = lm(mpg ~ wt + hp + factor(cyl), data = mtcars),
             weighted = lm(mpg ~ wt, data = mtcars, weights = mtcars$hp / 100))
inf <- list()
for (nm in names(fits)) {
  f <- fits[[nm]]
  inf[[nm]] <- list(hat = num(hatvalues(f)), rstandard = num(rstandard(f)),
                    rstandardPred = num(rstandard(f, type = "predictive")), rstudent = num(rstudent(f)),
                    cooks = num(cooks.distance(f)), fitted = num(fitted(f)), residuals = num(residuals(f)),
                    dffits = num(dffits(f)), covratio = num(covratio(f)),
                    dfbetas = unname(dfbetas(f)))
}
# the model matrices, responses and weights, for the fits in rStats.js
for (nm in names(fits)) {
  f <- fits[[nm]]
  inf[[nm]]$X <- unname(model.matrix(f)); inf[[nm]]$y <- num(model.response(model.frame(f)))
  inf[[nm]]$w <- if (is.null(weights(f))) NULL else num(weights(f))
}
out$influence <- inf
run <- function(expr) {
  warns <- character()
  val <- withCallingHandlers(tryCatch(expr, error = function(e) list(error = conditionMessage(e))),
                             warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
  if (is.list(val) && !is.null(val$error)) return(list(error = val$error, warnings = warns))
  list(value = val, warnings = warns)
}
dens <- function(...) {
  r <- run(density(...))
  if (!is.null(r$value)) r$value <- list(x = num(r$value$x), y = num(r$value$y), bw = r$value$bw, n = r$value$n)
  r
}
e <- list()
x5 <- c(3.1, 1.2, 5.5, 1.2, 9.0)
e$d_one_bw <- dens(4, bw = 0.5)
e$d_one <- dens(4)
e$d_empty <- dens(numeric(0), bw = 1)
e$d_na <- dens(c(1, NA, 3))
e$d_nan_narm <- dens(c(1, NaN, 3, 4), na.rm = TRUE)
e$d_inf <- dens(c(1, Inf, 3, 4))
e$d_inf_bw <- dens(c(1, Inf, 3, 4), bw = 1)
e$d_const <- dens(rep(2.5, 6))
e$d_bw0 <- dens(x5, bw = 0)
e$d_bwneg <- dens(x5, bw = -1)
e$d_bwna <- dens(x5, bw = NA)
e$d_n1 <- dens(x5, n = 1)
e$d_n2 <- dens(x5, n = 2)
e$d_n513 <- dens(x5, n = 513)
e$d_fromgt <- dens(x5, from = 5, to = 1)
e$d_fromeq <- dens(x5, from = 2, to = 2)
e$d_w_unnorm <- dens(x5, weights = c(1, 2, 3, 4, 5))
e$d_w_neg <- dens(x5, weights = c(0.5, -0.1, 0.2, 0.2, 0.2))
e$d_w_zero <- dens(x5, weights = c(0, 0.25, 0.25, 0.25, 0.25))
e$d_w_na <- dens(x5, weights = c(NA, 0.25, 0.25, 0.25, 0.25))
e$d_w_len <- dens(x5, weights = c(0.5, 0.5))
e$d_w_na_x <- dens(c(3.1, NA, 5.5, 1.2, 9.0), weights = rep(0.2, 5), na.rm = TRUE)
e$d_big <- dens(x5 * 1e300)
e$d_huge <- dens(c(1, 2, 3) * 1e306)
e$d_tiny <- dens(x5 * 1e-300)
e$d_common <- dens(1e15 + x5)
e$d_adjust0 <- dens(x5, adjust = 0)
e$d_kernel_bad <- dens(x5, kernel = "foo")
e$d_kernel_abbrev <- dens(x5, kernel = "epan")
e$d_cut0 <- dens(x5, cut = 0)
e$d_bwname <- dens(x5, bw = "nrd")
e$d_bwname_case <- dens(x5, bw = "NRD0")
e$d_large_out <- dens(x5, n = 5000)
e$bw_nrd0_two <- run(bw.nrd0(c(1, 1)))
e$bw_nrd0_na <- run(bw.nrd0(c(1, NA, 3)))
e$bw_nrd0_zero <- run(bw.nrd0(c(0, 0, 0)))
e$bw_nrd0_iqr0 <- run(bw.nrd0(c(1, 2, 2, 2, 2, 2, 9)))
e$bw_nrd_iqr0 <- run(bw.nrd(c(1, 2, 2, 2, 2, 2, 9)))
e$bw_nrd0_big <- run(bw.nrd0(x5 * 1e300))
e$bw_nrd0_inf <- run(bw.nrd0(c(1, 2, Inf)))
# qqnorm / qqline / ppoints
qn <- function(y) { r <- run(qqnorm(y, plot.it = FALSE)); if (!is.null(r$value)) r$value <- list(x = num(r$value$x), y = num(r$value$y)); r }
e$q_empty <- qn(numeric(0))
e$q_one <- qn(5)
e$q_inf <- qn(c(1, -Inf, 3, Inf))
e$q_nan <- qn(c(2, NaN, 1))
e$q_allna <- qn(c(NA_real_, NA_real_))
e$q_ties <- qn(c(2, 1, 2, 1, 2))
e$pp_vec <- run(ppoints(c(9, 8, 7)))
e$pp_zero <- run(ppoints(0))
e$pp_frac <- run(ppoints(2.7))
e$pp_a_bad <- run(ppoints(5, a = 2))
e$pp_a_neg <- run(ppoints(5, a = -1))
# boxplot.stats
bs <- function(...) { r <- run(boxplot.stats(...)); if (!is.null(r$value)) r$value <- lapply(r$value, num); r }
e$b_empty <- bs(numeric(0))
e$b_allna <- bs(c(NA_real_, NA_real_))
e$b_inf <- bs(c(1, 2, 3, 4, Inf))
e$b_ninf <- bs(c(-Inf, 1, 2, 3, 4, 5, 6))
e$b_nan <- bs(c(1, NaN, 2, 3))
e$b_coefneg <- bs(c(1, 2, 3, 40), coef = -1)
e$b_noconf <- bs(c(1, 2, 3, 40), do.conf = FALSE, do.out = FALSE)
e$b_big <- bs(c(1, 2, 3, 4, 100) * 1e300)
e$b_common <- bs(1e15 + c(1, 2, 3, 4, 100))
# lowess
lw <- function(...) { r <- run(lowess(...)); if (!is.null(r$value)) r$value <- list(x = num(r$value$x), y = num(r$value$y)); r }
e$l_one <- lw(1, 2)
e$l_two <- lw(c(1, 2), c(3, 5))
e$l_three <- lw(c(1, 2, 3), c(3, 5, 4))
e$l_empty <- lw(numeric(0), numeric(0))
e$l_samex <- lw(rep(2, 5), c(1, 2, 3, 4, 5))
e$l_na <- lw(c(1, 2, NA, 4, 5), c(1, 3, 2, 5, 4))
e$l_nay <- lw(c(1, 2, 3, 4, 5), c(1, 3, NA, 5, 4))
e$l_inf <- lw(c(1, 2, 3, 4, Inf), c(1, 3, 2, 5, 4))
e$l_f0 <- lw(1:10, c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12), f = 0)
e$l_fneg <- lw(1:10, c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12), f = -1)
e$l_fbig <- lw(1:10, c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12), f = 3)
e$l_iterneg <- lw(1:10, c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12), iter = -1)
e$l_iterfrac <- lw(1:10, c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12), iter = 1.7)
e$l_deltaneg <- lw(1:10, c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12), delta = -1)
e$l_deltabig <- lw(1:10, c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12), delta = 100)
e$l_exact <- lw(1:10, 2 * (1:10) + 1)
e$l_outlier <- lw(1:12, c(1:11, 500))
e$l_big <- lw((1:10) * 1e300, c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12) * 1e300)
e$l_tiny <- lw((1:10) * 1e-300, c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12) * 1e-300)
e$l_common <- lw(1e15 + 1:10, 1e15 + c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12))
e$l_lenmismatch <- lw(1:5, 1:4)
e$l_ties <- lw(c(1, 1, 2, 2, 3, 3, 4, 4), c(1, 2, 2, 4, 3, 5, 4, 7))
# lm influence
infl <- function(f) {
  r <- run(list(hat = num(hatvalues(f)), rstandard = num(rstandard(f)), rstandardPred = num(rstandard(f, type = "predictive")),
                rstudent = num(rstudent(f)), cooks = num(cooks.distance(f)), dffits = num(dffits(f)), covratio = num(covratio(f))))
  r$X <- unname(model.matrix(f)); r$y <- num(model.response(model.frame(f)))
  r$w <- if (is.null(weights(f))) NULL else num(weights(f)[weights(f) > 0 | TRUE])
  r
}
d1 <- data.frame(x = c(1, 2, 3, 4, 10), y = c(1.1, 1.9, 3.2, 3.9, 7))
d1$g <- factor(c("a", "a", "b", "b", "c"))
e$i_lev1 <- infl(lm(y ~ x + g, data = d1))
e$i_exact <- infl(lm(y ~ x, data = data.frame(x = 1:5, y = 2 * (1:5) + 1)))
e$i_saturated <- infl(lm(y ~ factor(1:5), data = data.frame(y = c(1, 3, 2, 5, 4))))
e$i_two <- infl(lm(y ~ x, data = data.frame(x = 1:3, y = c(1, 3, 2))))
e$i_w0 <- infl(lm(y ~ x, data = data.frame(x = 1:6, y = c(1, 3, 2, 5, 4, 7)), weights = c(1, 1, 0, 1, 2, 1)))
e$i_na <- infl(lm(y ~ x, data = data.frame(x = c(1:5, NA, 7), y = c(1, 3, 2, 5, 4, 7, 6))))
e$i_big <- infl(lm(y ~ x, data = data.frame(x = (1:6) * 1e150, y = c(1, 3, 2, 5, 4, 7) * 1e150)))
e$i_noint <- infl(lm(y ~ 0 + x, data = data.frame(x = 1:6, y = c(1, 3, 2, 5, 4, 7))))
e$i_rankdef <- infl(lm(y ~ x + z, data = data.frame(x = 1:6, z = 2 * (1:6), y = c(1, 3, 2, 5, 4, 7))))
out$edge <- e
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "plotstats.json"))
