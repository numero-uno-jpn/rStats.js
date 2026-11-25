# mediation116-slopes-probe.R: the structure of sim_slopes' result (names, classes, attributes) (1.16.0), because
# mediation116-slopes.R assumed ss$jn was a list of Johnson-Neyman results and failed.
# Output: JSON on stdout. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(interactions))
set.seed(20261125)
n <- 80
C <- rnorm(n); X <- rnorm(n, 3, 1.5); W <- rnorm(n, 10, 3)
Y <- 1 + 0.3 * X + 0.2 * W + 0.15 * X * (W - 10) + 0.3 * C + rnorm(n, 0, 1 + 0.2 * abs(X))
d <- data.frame(C, X, W, Y)
fit <- lm(Y ~ X * W + C, data = d)
ss <- sim_slopes(fit, pred = "X", modx = "W", modx.values = "mean-plus-minus", johnson_neyman = TRUE, jnalpha = 0.05,
                 confint = TRUE, ci.width = 0.95, robust = FALSE)
desc <- function(x) list(class = class(x), names = names(x), attr_names = names(attributes(x)))
out <- list(ss = desc(ss), parts = lapply(unclass_names <- names(ss), function(nm) desc(ss[[nm]])),
            attrs = lapply(attributes(ss)[setdiff(names(attributes(ss)), c("names", "class"))], function(a) if (is.atomic(a)) a else desc(a)))
names(out$parts) <- names(ss)
cat(toJSON(out, auto_unbox = TRUE, pretty = TRUE, force = TRUE, digits = I(17)))
