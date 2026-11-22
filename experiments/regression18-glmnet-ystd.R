# issue: 545
# regression18-glmnet-ystd.R: gaussian glmnet with alpha < 1 fits y / sd(y) at lambda / sd(y) (1.8.0)
suppressMessages(library(glmnet))
i <- 0:23; a <- 2*pi*i/24; x <- cbind(sin(a), cos(a) + 0.3 * sin(2 * a)); y <- 2.5 + 1.1*x[,1] - 0.6*x[,2] + 0.04*sin(3*a)
w <- rep(c(1, 3), 12)
show <- function(label, ...) { f <- glmnet(x, y, alpha = 0.5, lambda = c(0.4, 0.1), control = list(thresh = 1e-16), ...); cat(label, format(c(f$a0, as.vector(as.matrix(f$beta))), digits = 17), "\n") }
show("default")
show("nostd", standardize = FALSE)
show("weights", weights = w)
show("nointercept", intercept = FALSE)
f <- glmnet(x, y, alpha = 0, lambda = c(0.4, 0.1), control = list(thresh = 1e-16)); cat("ridge", format(c(f$a0, as.vector(as.matrix(f$beta))), digits = 17), "\n")
