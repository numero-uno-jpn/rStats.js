# oracle-platform: amd64
# The example data of the demo's Plots tab and R's values of what each figure shows, written to demo/plot-data.json
# (npm run oracle -- demoplots). The data are R's and its packages' datasets (survival's lung, pROC's aSAH,
# metafor's dat.bcg, netmeta's Senn2013, faithful, precip, InsectSprays, mtcars, cars, Nile, USAccDeaths,
# USArrests) and one seeded competing-risks sample. Only the documented output of exported functions is recorded.
suppressPackageStartupMessages({
  library(jsonlite); library(survival); library(pROC); library(metafor); library(meta); library(cmprsk); library(forecast)
})
num <- function(v) unname(as.numeric(v))
ds <- list(); rv <- list()

# survival: lung by sex
lu <- survival::lung
ds$lung <- list(time = num(lu$time), status = num(lu$status == 2), group = ifelse(lu$sex == 1, "Male", "Female"))
f <- survfit(Surv(time, status == 2) ~ ifelse(sex == 1, "Male", "Female"), data = lu)
tt <- c(0, 200, 400, 600, 800, 1000)
s <- summary(f, times = tt, extend = TRUE)
rv$km <- list(lung = list(times = tt, surv = num(s$surv), nRisk = num(s$n.risk),
                          median = num(summary(f)$table[, "median"])))
# a smaller one: survival's aml
am <- survival::aml
ds$aml <- list(time = num(am$time), status = num(am$status), group = as.character(am$x))
f2 <- survfit(Surv(time, status) ~ as.character(x), data = am)
t2 <- c(0, 10, 20, 30, 40)
s2 <- summary(f2, times = t2, extend = TRUE)
rv$km$aml <- list(times = t2, surv = num(s2$surv), nRisk = num(s2$n.risk), median = num(summary(f2)$table[, "median"]))

# competing risks: a seeded sample
set.seed(20261128)
n <- 80; g <- rep(c("A", "B"), each = 40)
t1 <- rexp(n, ifelse(g == "A", 0.10, 0.06)); t2 <- rexp(n, 0.05); cen <- runif(n, 5, 30)
ft <- round(pmin(t1, t2, cen), 2); fs <- ifelse(ft == round(cen, 2), 0, ifelse(ft == round(t1, 2), 1, 2))
ds$crisk <- list(time = num(ft), status = num(fs), group = g)
ci <- cuminc(ft, fs, g)
tp <- timepoints(ci, c(5, 10, 15, 20))
rv$cuminc <- list(crisk = list(times = c(5, 10, 15, 20), names = rownames(tp$est), est = unname(tp$est)))

# ROC: pROC's aSAH
data(aSAH, package = "pROC")
ds$aSAH <- list(outcome = as.character(aSAH$outcome), marker = num(aSAH$s100b), markerName = "s100b")
r <- roc(aSAH$outcome, aSAH$s100b, quiet = TRUE)
rv$roc <- list(aSAH = list(auc = as.numeric(r$auc), youden = max(r$sensitivities + r$specificities - 1)))
ds$aSAHwfns <- list(outcome = as.character(aSAH$outcome), marker = num(aSAH$wfns), markerName = "wfns")
r2 <- roc(aSAH$outcome, as.numeric(aSAH$wfns), quiet = TRUE)
rv$roc$aSAHwfns <- list(auc = as.numeric(r2$auc), youden = max(r2$sensitivities + r2$specificities - 1))

# meta-analysis: metafor's dat.bcg (log risk ratios); meta's REML at the maximum (control threshold 1e-14)
es <- escalc("RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = dat.bcg)
ds$bcg <- list(TE = num(es$yi), seTE = sqrt(num(es$vi)), labels = paste(dat.bcg$author, dat.bcg$year))
m <- metagen(num(es$yi), sqrt(num(es$vi)), control = list(threshold = 1e-14, maxiter = 1000))
rv$forest <- list(bcg = list(lower = num(m$lower), upper = num(m$upper), weight = 100 * num(m$w.random) / sum(m$w.random),
                             TEcommon = m$TE.common, TErandom = m$TE.random, lowerRandom = m$lower.random,
                             upperRandom = m$upper.random, tau2 = m$tau2, I2 = m$I2))
rv$funnel <- list(bcg = list(reference = m$TE.common, maxSe = max(sqrt(num(es$vi))),
                             xmin = m$TE.common - qnorm(0.975) * max(sqrt(num(es$vi))),
                             xmax = m$TE.common + qnorm(0.975) * max(sqrt(num(es$vi)))))

# network: netmeta's Senn2013
data(Senn2013, package = "netmeta")
ds$senn <- list(TE = num(Senn2013$TE), seTE = num(Senn2013$seTE), treat1 = as.character(Senn2013$treat1),
                treat2 = as.character(Senn2013$treat2), studlab = as.character(Senn2013$studlab))
pairs <- apply(cbind(as.character(Senn2013$treat1), as.character(Senn2013$treat2)), 1, function(p) paste(sort(p), collapse = ":"))
tab <- table(pairs)
rv$netgraph <- list(senn = list(pairs = names(tab), studies = num(tab)))

# distributions: faithful, precip, InsectSprays
ds$eruptions <- list(x = num(faithful$eruptions), name = "faithful$eruptions")
ds$precip <- list(x = num(precip), name = "precip")
for (nm in c("eruptions", "precip")) {
  x <- ds[[nm]]$x
  d <- density(x)
  h <- hist(x, plot = FALSE)
  q <- qqnorm(x, plot.it = FALSE)
  yq <- quantile(x, c(0.25, 0.75)); xq <- qnorm(c(0.25, 0.75)); sl <- diff(yq) / diff(xq)
  rv$density[[nm]] <- list(bw = d$bw, y = num(d$y[c(1, 129, 257, 385, 512)]), idx = c(0, 128, 256, 384, 511))
  rv$hist[[nm]] <- list(breaks = num(h$breaks), counts = num(h$counts))
  rv$qq[[nm]] <- list(x = num(q$x[1:5]), slope = num(sl), intercept = num(yq[1] - sl * xq[1]))
  rv$ecdf[[nm]] <- list(at = num(quantile(x, c(0.1, 0.5, 0.9), type = 1)), F = num(ecdf(x)(quantile(x, c(0.1, 0.5, 0.9), type = 1))))
}
ds$sprays <- list(value = num(InsectSprays$count), group = as.character(InsectSprays$spray))
ds$mpgcyl <- list(value = num(mtcars$mpg), group = paste0(mtcars$cyl, " cyl"))
for (nm in c("sprays", "mpgcyl")) {
  gr <- unique(ds[[nm]]$group)
  rv$boxplot[[nm]] <- list(groups = gr, stats = lapply(gr, function(k) num(boxplot.stats(ds[[nm]]$value[ds[[nm]]$group == k])$stats)),
                           out = lapply(gr, function(k) num(boxplot.stats(ds[[nm]]$value[ds[[nm]]$group == k])$out)))
}

# models: mtcars (mpg ~ wt), cars (stopping distance ~ speed)
ds$mtcars <- list(x = num(mtcars$wt), y = num(mtcars$mpg), xName = "wt", yName = "mpg")
ds$cars <- list(x = num(cars$speed), y = num(cars[[2]]), xName = "speed", yName = "dist")
for (nm in c("mtcars", "cars")) {
  d <- data.frame(x = ds[[nm]]$x, y = ds[[nm]]$y)
  fit <- lm(y ~ x, data = d)
  grid <- seq(min(d$x), max(d$x), length.out = 5)
  pc <- predict(fit, data.frame(x = grid), interval = "confidence"); pp <- predict(fit, data.frame(x = grid), interval = "prediction")
  ci2 <- confint(fit)
  rv$lmdiag[[nm]] <- list(hat = num(hatvalues(fit)), cooks = num(cooks.distance(fit)), rstandard = num(rstandard(fit)),
                          smooth = num(lowess(fitted(fit), residuals(fit))$y))
  rv$coef[[nm]] <- list(estimate = num(coef(fit)), lower = num(ci2[, 1]), upper = num(ci2[, 2]))
  rv$band[[nm]] <- list(x = num(grid), fit = num(pc[, 1]), confLower = num(pc[, 2]), confUpper = num(pc[, 3]),
                        predLower = num(pp[, 2]), predUpper = num(pp[, 3]))
}

# time series: Nile (yearly), USAccDeaths (monthly)
ds$nile <- list(y = num(Nile), start = 1871, frequency = 1, name = "Nile")
ds$usacc <- list(y = num(USAccDeaths), start = 1973, frequency = 12, name = "USAccDeaths")
a1 <- acf(Nile, plot = FALSE); a2 <- acf(USAccDeaths, plot = FALSE)
rv$acf <- list(nile = list(acf = num(a1$acf), clim = qnorm(0.975) / sqrt(length(Nile))),
               usacc = list(acf = num(a2$acf), clim = qnorm(0.975) / sqrt(length(USAccDeaths))))
f1 <- rwf(Nile, h = 10, drift = TRUE); f2b <- snaive(USAccDeaths, h = 24)
rv$forecast <- list(nile = list(method = "rwf (drift)", mean = num(f1$mean), lower95 = num(f1$lower[, 2]), upper95 = num(f1$upper[, 2])),
                    usacc = list(method = "snaive", mean = num(f2b$mean), lower95 = num(f2b$lower[, 2]), upper95 = num(f2b$upper[, 2])))

# multivariate: USArrests
ds$usarrests <- list(rows = unname(as.matrix(USArrests)), labels = rownames(USArrests), columns = colnames(USArrests))
hc <- hclust(dist(scale(USArrests)), method = "average")
p <- prcomp(USArrests, scale. = TRUE)
rv$dendrogram <- list(usarrests = list(height = num(hc$height), order = num(hc$order)))
rv$biplot <- list(usarrests = list(sdev = num(p$sdev), absRotation = abs(unname(p$rotation[, 1:2]))))

out <- list(R = R.version.string, datasets = ds, r = rv)
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"), "/demo/plot-data.json")
