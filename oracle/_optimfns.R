# Test functions for the optim oracles (oracle/optim.R, oracle/optimsann.R), by name: fn and its gradient
OPT_FNS <- list(
  rosenbrock = list(fn = function(x) sum(100 * (x[-1] - x[-length(x)]^2)^2 + (1 - x[-length(x)])^2),
                    gr = function(x) { n <- length(x); g <- numeric(n)
                      g[-n] <- -400 * x[-n] * (x[-1] - x[-n]^2) - 2 * (1 - x[-n]); g[-1] <- g[-1] + 200 * (x[-1] - x[-n]^2); g }),
  quadratic = list(fn = function(x) sum((x - seq_along(x))^2 * seq_along(x)), gr = function(x) 2 * (x - seq_along(x)) * seq_along(x)),
  beale = list(fn = function(x) (1.5 - x[1] + x[1] * x[2])^2 + (2.25 - x[1] + x[1] * x[2]^2)^2 + (2.625 - x[1] + x[1] * x[2]^3)^2,
               gr = function(x) { a <- 1.5 - x[1] + x[1] * x[2]; b <- 2.25 - x[1] + x[1] * x[2]^2; c <- 2.625 - x[1] + x[1] * x[2]^3
                 c(2 * a * (x[2] - 1) + 2 * b * (x[2]^2 - 1) + 2 * c * (x[2]^3 - 1), 2 * a * x[1] + 4 * b * x[1] * x[2] + 6 * c * x[1] * x[2]^2) }),
  wood = list(fn = function(x) 100 * (x[1]^2 - x[2])^2 + (x[1] - 1)^2 + (x[3] - 1)^2 + 90 * (x[3]^2 - x[4])^2 +
                10.1 * ((x[2] - 1)^2 + (x[4] - 1)^2) + 19.8 * (x[2] - 1) * (x[4] - 1), gr = NULL),
  cosine = list(fn = function(x) cos(x[1]) + 0.1 * x[1]^2, gr = function(x) -sin(x[1]) + 0.2 * x[1])
)
opt_out <- function(r) list(par = I(num2str(r$par)), value = num2str(r$value), counts = I(num2str(unname(r$counts))),
                            convergence = num2str(r$convergence), message = if (is.null(r$message)) "NULL" else r$message,
                            hessian = if (is.null(r$hessian)) NULL else lapply(seq_len(nrow(r$hessian)), function(i) I(num2str(r$hessian[i, ]))))
