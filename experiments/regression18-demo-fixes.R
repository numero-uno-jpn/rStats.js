# issue: 545
# regression18-demo-fixes.R: rq anova across taus (ddf = n m - q), geeglm QIC parts and the nested anova table (1.8.0)
suppressMessages({library(quantreg); library(geepack)})
x <- seq(0, 4.9, by = 0.1); i <- 0:49; d <- data.frame(x = x, y = 1 + 0.8 * x + ((i * 17) %% 11 - 5) / 10)
for (m in c("br", "fn")) { t <- anova(rq(y ~ x, data = d, tau = c(0.25,0.5,0.75), method = m))$table; cat(m, format(unlist(t[1, ]), digits = 10), "\n") }
u <- c(-0.3,0.2,0.1,-0.4,0.5,-0.1,0.3,-0.2,0.4,-0.5,0.15,0.25); g <- rep(0:11, each = 3); xx <- rep(0:2, 12)
dd <- data.frame(id = rep(1:12, each = 3), x = xx, y = 2 + 0.7*xx + 0.4*(g %% 2) + rep(u, each = 3) + rep(c(0.05,-0.04,0.02), 12) * rep(c(0.5,1,1.5,2), each=3, length.out=36))
fit <- geeglm(y ~ x, data = dd, id = id, corstr = "independence")
print(QIC(fit), digits = 12); cat("RSS", sum(residuals(fit)^2), "scale", summary(fit)$dispersion$Estimate, "\n")
u <- c(-0.3,0.2,0.1,-0.4,0.5,-0.1,0.3,-0.2,0.4,-0.5,0.15,0.25); g <- rep(0:11, each = 3); xx <- rep(0:2, 12)
d <- data.frame(id = rep(1:12, each = 3), x = xx, z = g %% 2, y = 2 + 0.7*xx + 0.4*(g %% 2) + rep(u, each = 3) + rep(c(0.05,-0.04,0.02), 12) * rep(c(0.5,1,1.5,2), each=3, length.out=36))
a <- anova(geeglm(y ~ x, data = d, id = id, corstr = "independence"), geeglm(y ~ x + z, data = d, id = id, corstr = "independence")); print(a); print(dim(a))
