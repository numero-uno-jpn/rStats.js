# plot121-basic.R: the published output of the statistics behind R's plots (1.21.0, experiment 1).
# What the help pages say, to be checked against the output:
#   ppoints(n, a = if (n <= 10) 3/8 else 1/2) = (1:n - a) / (n + 1 - 2a); qqnorm's x = qnorm(ppoints(n))[order(order(y))];
#   qqline through the probs = c(0.25, 0.75) quantiles (type 7) of y and of qnorm;
#   boxplot.stats: stats = the hinges of fivenum with whiskers at the most extreme points within coef * IQR of the
#     box (coef = 1.5), n = the non-NA count, conf = median +- 1.58 IQR / sqrt(n), out = the points beyond;
#   lowess(x, y, f = 2/3, iter = 3, delta = 0.01 * diff(range(x))) (Cleveland 1979);
#   bw.nrd0 = 0.9 min(sd, IQR / 1.34) n^-0.2 (with fall-backs when the spread is 0), bw.nrd = 1.06 ...;
#   density: from = min - cut bw, to = max + cut bw, cut = 3, n = 512 points, the mass binned on a grid and
#     convolved with the kernel by FFT, then linear interpolation;
#   lm's hatvalues, rstandard (type "sd.1" / "predictive"), rstudent, cooks.distance.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
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
out$influence <- inf
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
