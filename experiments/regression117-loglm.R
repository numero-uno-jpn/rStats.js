# regression117-loglm.R: MASS::loglm, the formula front end to loglin (1.17.0). From its help page: defaults
# eps = 1/10, iter = 40, param = TRUE; a.b, a*b and a/b are equivalent; with frequencies on the left of a data frame
# formula, missing cells are structural zeros and one df is deducted per structural zero. Checked here: the fit against
# loglin with the margins the formula implies (candidate: the maximal terms, in the order of the formula's terms),
# lrt (= deviance), pearson, df, the printed output, fitted, residuals (types), coef, anova between nested models, and
# the data frame form with and without missing cells, against glm(poisson).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(MASS))
out <- list(R = R.version.string, arch = R.version$arch, MASS = as.character(packageVersion("MASS")))
mx <- function(a, b) max(abs(a - b))
t3 <- HairEyeColor
assign("t3", t3, envir = globalenv())

forms <- list(
  no3 = list(f = ~ Hair * Eye + Hair * Sex + Eye * Sex, mg = list(c(1, 2), c(1, 3), c(2, 3))),
  no3_power = list(f = ~ (Hair + Eye + Sex)^2, mg = list(c(1, 2), c(1, 3), c(2, 3))),
  order = list(f = ~ Eye:Sex + Hair:Sex + Hair:Eye, mg = list(c(2, 3), c(1, 3), c(1, 2))),
  cond = list(f = ~ Hair:Eye + Hair:Sex, mg = list(c(1, 2), c(1, 3))),
  mutual = list(f = ~ Hair + Eye + Sex, mg = list(1, 2, 3)),
  numbers = list(f = ~ 1 + 2 + 3, mg = list(1, 2, 3)),
  mixed = list(f = ~ Hair + Eye:Sex + Hair:Eye, mg = list(c(2, 3), c(1, 2)))
)
res <- list()
for (nm in names(forms)) {
  fm <- forms[[nm]]
  g <- loglm(fm$f, data = t3, fitted = TRUE)
  ll <- loglin(t3, fm$mg, eps = 0.1, iter = 40, fit = TRUE, param = TRUE, print = FALSE)
  res[[nm]] <- list(lrt = g$lrt, pearson = g$pearson, df = g$df, deviance = deviance(g),
                    margin = g$margin, fit_vs_loglin = mx(fitted(g), ll$fit),
                    lrt_vs_loglin = g$lrt - ll$lrt, fields = names(g),
                    printed = capture.output(print(g)),
                    resid = lapply(c("deviance", "pearson", "response"), function(ty) as.vector(residuals(g, type = ty))[1:4]),
                    coef_names = names(coef(g)))
}
out$forms <- res
# residual candidates for the no3 model
g <- loglm(~ (Hair + Eye + Sex)^2, data = t3, fitted = TRUE); fv <- fitted(g); ob <- t3
out$resid_cand <- list(
  response = mx(residuals(g, type = "response"), ob - fv),
  pearson = mx(residuals(g, type = "pearson"), (ob - fv) / sqrt(fv)),
  deviance = mx(residuals(g, type = "deviance"),
                sign(ob - fv) * sqrt(2 * abs(ifelse(ob > 0, ob * log(ob / fv), 0) - (ob - fv)))),
  default = mx(residuals(g), residuals(g, type = "deviance")))
# anova
g0 <- loglm(~ Hair + Eye + Sex, data = t3); g1 <- loglm(~ Hair * Eye + Sex, data = t3); g2 <- loglm(~ (Hair + Eye + Sex)^2, data = t3)
a <- anova(g0, g1, g2)
out$anova <- list(table = matrix(as.numeric(as.matrix(a)), nrow(a)), cols = colnames(a), printed = capture.output(print(a)))
# data frame form with frequencies, against glm(poisson)
df3 <- as.data.frame(t3)
assign("df3", df3, envir = globalenv())
h <- loglm(Freq ~ Hair * Eye + Hair * Sex + Eye * Sex, data = df3)
gp <- glm(Freq ~ (Hair + Eye + Sex)^2, family = poisson, data = df3)
out$data_frame <- list(lrt = h$lrt, df = h$df, glm_dev = deviance(gp), glm_df = df.residual(gp))
df3m <- df3[-c(5, 20), ]   # two cells missing: structural zeros
assign("df3m", df3m, envir = globalenv())
hm <- loglm(Freq ~ Hair * Eye + Hair * Sex + Eye * Sex, data = df3m)
gm <- glm(Freq ~ (Hair + Eye + Sex)^2, family = poisson, data = df3m)
out$data_frame_missing <- list(lrt = hm$lrt, df = hm$df, glm_dev = deviance(gm), glm_df = df.residual(gm),
                               printed = capture.output(print(hm)))
# a table with a sampling zero
tz <- t3; tz[1, 1, 1] <- 0
gz <- loglm(~ (Hair + Eye + Sex)^2, data = tz)
out$zero <- list(lrt = gz$lrt, pearson = gz$pearson, df = gz$df)
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
