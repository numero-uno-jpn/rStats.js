# oracle-platform: amd64
source("/oracle/_anova.R")
source("/oracle/_optimfns.R")

# optim's SANN (simulated annealing), which draws R's random numbers: run on x86_64 R (see oracle/_random.R).
# Each case: set.seed(seed) then optim(par, fn, method = "SANN", control). Written as in oracle/optim.R.
cases <- list()
for (seed in c(1, 42)) for (fn in c("rosenbrock", "quadratic")) for (mx in c(200, 3000))
  cases[[length(cases) + 1]] <- list(fn = fn, par = I(if (fn == "rosenbrock") c(-1.2, 1) else c(0, 0)), seed = seed, control = list(maxit = mx))
cases[[length(cases) + 1]] <- list(fn = "rosenbrock", par = I(c(-1.2, 1)), seed = 7, control = list(maxit = 1000, temp = 20, tmax = 5))
write_anova_fixture("optimSANN", cases, function(a) {
  set.seed(a$seed)
  opt_out(optim(unclass(a$par), OPT_FNS[[a$fn]]$fn, method = "SANN", control = lapply(a$control, unclass)))
})
