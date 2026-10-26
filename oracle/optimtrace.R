# oracle-platform: amd64
source("/oracle/_anova.R")
source("/oracle/_optimfns.R")

# A trace of optim's evaluations, to find where an implementation leaves R's path (fixture optimTrace): for each
# case, the first 400 calls of fn and gr in order: kind ("fn" or "gr"), the point (scaled parameters as passed), and
# the value (fn) or gradient (gr). Case: rosenbrock, n = 4, CG type 1, analytic gradient (optim.json case 17), and the
# numerical-gradient run of the same (case 13; the gradient calls are then fn calls at the perturbed points).
trace_case <- function(gr) {
  log <- list()
  f <- function(x) { v <- OPT_FNS$rosenbrock$fn(x); if (length(log) < 400) log[[length(log) + 1]] <<- list(kind = "fn", x = I(num2str(x)), v = I(num2str(v))); v }
  g <- function(x) { v <- OPT_FNS$rosenbrock$gr(x); if (length(log) < 400) log[[length(log) + 1]] <<- list(kind = "gr", x = I(num2str(x)), v = I(num2str(v))); v }
  optim(c(-1.2, 1, -1.2, 1), f, if (gr) g, method = "CG", control = list(maxit = 5000))
  log
}
cases <- list(list(gradient = TRUE), list(gradient = FALSE))
write_anova_fixture("optimTrace", cases, function(a) list(calls = trace_case(a$gradient)))
