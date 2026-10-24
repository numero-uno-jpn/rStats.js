source("/oracle/_linalg.R")

# Numerical methods: integrate, optimize, uniroot (stats); approx, spline, splinefun, splinefunH (stats);
# pracma::barylag (Lagrange interpolation); Hermite interpolation with given derivatives (reference computed
# here with Rmpfr); deSolve::ode with fixed-step methods; numDeriv::grad / hessian / jacobian.
#
# Functions cannot be written to JSON, so each case names its function by an id and gives the same function as
# a JavaScript expression in args.js (a body in x, or in t, y, p for ode; Math.* names). The tests can build it
# with new Function. R evaluates its own copy of the function (fns below), so both must describe the same
# function: they are listed side by side.

set.seed(20261028)
cases <- list()
# NULL arguments are left out of the case (otherwise they would be written as [])
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))
vo <- function(x) vec_out(x)
s <- function(x) num2str(unname(x))

fns <- list(
  gauss      = list(r = function(x) exp(-x^2 / 2),            js = "Math.exp(-x * x / 2)"),
  dnorm      = list(r = function(x) dnorm(x),                 js = "Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)"),
  cauchyLike = list(r = function(x) 1 / (1 + x^2),            js = "1 / (1 + x * x)"),
  invSqrtMix = list(r = function(x) 1 / ((x + 1) * sqrt(x)),  js = "1 / ((x + 1) * Math.sqrt(x))"),
  sqrt       = list(r = function(x) sqrt(x),                  js = "Math.sqrt(x)"),
  log        = list(r = function(x) log(x),                   js = "Math.log(x)"),
  powm09     = list(r = function(x) x^-0.9,                   js = "Math.pow(x, -0.9)"),
  inv        = list(r = function(x) 1 / x,                    js = "1 / x"),
  expCos     = list(r = function(x) exp(-x) * cos(x),         js = "Math.exp(-x) * Math.cos(x)"),
  cubic      = list(r = function(x) x^3 - 2 * x,              js = "x * x * x - 2 * x"),
  kink       = list(r = function(x) abs(x - 0.3),             js = "Math.abs(x - 0.3)"),
  exp        = list(r = function(x) exp(x),                   js = "Math.exp(x)"),
  cos100     = list(r = function(x) cos(100 * x),             js = "Math.cos(100 * x)"),
  sin        = list(r = function(x) sin(x),                   js = "Math.sin(x)"),
  sinc       = list(r = function(x) sin(x) / x,               js = "Math.sin(x) / x"),
  quad13     = list(r = function(x) (x - 1 / 3)^2,            js = "(x - 1 / 3) * (x - 1 / 3)"),
  absm2      = list(r = function(x) abs(x - 2),               js = "Math.abs(x - 2)"),
  quartic    = list(r = function(x) x^4 - 3 * x^3 + 2,        js = "x ** 4 - 3 * x ** 3 + 2"),
  xexp       = list(r = function(x) x * exp(-x),              js = "x * Math.exp(-x)"),
  cos        = list(r = function(x) cos(x),                   js = "Math.cos(x)"),
  flat       = list(r = function(x) 1,                        js = "1"),
  sq2        = list(r = function(x) x^2 - 2,                  js = "x * x - 2"),
  cosx       = list(r = function(x) cos(x) - x,               js = "Math.cos(x) - x"),
  cub        = list(r = function(x) x^3 - x - 1,              js = "x * x * x - x - 1"),
  atan1      = list(r = function(x) atan(x) - 1,              js = "Math.atan(x) - 1"),
  expBig     = list(r = function(x) exp(x) - 1e6,             js = "Math.exp(x) - 1e6"),
  lin5       = list(r = function(x) x - 5,                    js = "x - 5"),
  pos        = list(r = function(x) x^2 + 1,                  js = "x * x + 1"),
  nanMid     = list(r = function(x) if (x < 0) -1 else if (x < 1) NaN else 1,  js = "x < 0 ? -1 : x < 1 ? NaN : 1"),
  infHi      = list(r = function(x) if (x < 0.5) -1 else Inf,                  js = "x < 0.5 ? -1 : Infinity"),
  nanLeft    = list(r = function(x) if (x < -1e-4) NaN else x - 10,            js = "x < -1e-4 ? NaN : x - 10")
)
F <- function(id) fns[[id]]$r

# --- integrate --------------------------------------------------------------------------------------------
# ier: 0 OK, 1 maximum number of subdivisions reached, 2 roundoff error was detected, 3 extremely bad integrand
# behaviour, 4 roundoff error is detected in the extrapolation table, 5 the integral is probably divergent,
# 6 the input is invalid (the order of R's messages, which are QUADPACK's ier)
msgs <- c("OK", "maximum number of subdivisions reached", "roundoff error was detected",
          "extremely bad integrand behaviour", "roundoff error is detected in the extrapolation table",
          "the integral is probably divergent", "the input is invalid")
ints <- list(
  list("gauss", -Inf, Inf), list("gauss", 0, Inf), list("gauss", -Inf, 1.5), list("dnorm", -1.96, 1.96),
  list("cauchyLike", -Inf, Inf), list("invSqrtMix", 0, Inf), list("sqrt", 0, 1), list("log", 0, 1),
  list("powm09", 0, 1), list("inv", 0, 1), list("expCos", 0, Inf), list("cubic", -1, 3), list("kink", 0, 1),
  list("exp", 0, 700), list("cos100", 0, 2 * pi), list("sin", 0, 1e4), list("sinc", 0.1, 20),
  list("cubic", 3, -1), list("cubic", 2, 2), list("sin", 0, Inf)
)
for (it in ints) for (soe in c(TRUE, FALSE)) {
  add(fn = it[[1]], js = fns[[it[[1]]]]$js, lower = it[[2]], upper = it[[3]], stopOnError = soe)
}
for (it in ints[c(1, 7, 8, 15)]) add(fn = it[[1]], js = fns[[it[[1]]]]$js, lower = it[[2]], upper = it[[3]],
                                     relTol = 1e-10, subdivisions = 200)
add(fn = "cos100", js = fns$cos100$js, lower = 0, upper = 2 * pi, subdivisions = 5, stopOnError = FALSE)
write_htest_fixture("integrate", cases, function(a) {
  r <- call_with(integrate, list(f = F(a$fn), lower = a$lower, upper = a$upper, subdivisions = a$subdivisions,
                                 rel.tol = a$relTol, stop.on.error = a$stopOnError))
  list(value = s(r$value), absError = s(r$abs.error), subdivisions = s(r$subdivisions),
       ier = s(match(r$message, msgs) - 1))
})

# --- optimize ---------------------------------------------------------------------------------------------
cases <- list()
opts <- list(list("quad13", 0, 1), list("sin", 0, 2 * pi), list("absm2", 0, 5), list("quartic", -1, 4),
             list("xexp", 0, 10), list("cos", 0, 10), list("flat", 0, 1), list("exp", -3, 2))
for (o in opts) for (mx in c(FALSE, TRUE)) for (tol in list(NULL, 1e-10))
  add(fn = o[[1]], js = fns[[o[[1]]]]$js, lower = o[[2]], upper = o[[3]], maximum = mx, tol = tol)
write_htest_fixture("optimize", cases, function(a) {
  r <- call_with(optimize, list(f = F(a$fn), lower = a$lower, upper = a$upper, maximum = a$maximum, tol = a$tol))
  list(optimum = s(if (a$maximum) r$maximum else r$minimum), objective = s(r$objective))
})

# --- uniroot ----------------------------------------------------------------------------------------------
cases <- list()
roots <- list(list("sq2", 0, 2), list("cosx", 0, 1), list("cub", 1, 2), list("atan1", 0, 5),
              list("expBig", 0, 20), list("lin5", 0, 1), list("pos", -1, 1), list("sin", 3, 4))
for (r in roots) for (tol in list(NULL, 1e-12)) for (ext in c("no", "yes"))
  add(fn = r[[1]], js = fns[[r[[1]]]]$js, lower = r[[2]], upper = r[[3]], tol = tol, extendInt = ext)
add(fn = "sq2", js = fns$sq2$js, lower = 0, upper = 2, maxiter = 3)
# non-finite values of f are replaced by the largest finite numbers (R warns); a NaN met while extending the
# interval undoes that step; extension in one direction
add(fn = "nanMid", js = fns$nanMid$js, lower = -1, upper = 3)
add(fn = "infHi", js = fns$infHi$js, lower = 0, upper = 3)
add(fn = "nanLeft", js = fns$nanLeft$js, lower = 0, upper = 1, extendInt = "yes")
add(fn = "lin5", js = fns$lin5$js, lower = 0, upper = 1, extendInt = "upX")
write_htest_fixture("uniroot", cases, function(a) {
  r <- call_with(uniroot, list(f = F(a$fn), lower = a$lower, upper = a$upper, tol = a$tol, maxiter = a$maxiter,
                               extendInt = a$extendInt))
  list(root = s(r$root), fRoot = s(r$f.root), iter = s(r$iter), initIt = s(r$init.it), estimPrec = s(r$estim.prec))
})

# --- approx -----------------------------------------------------------------------------------------------
cases <- list()
ax <- c(1, 2, 2, 4, 7, 8); ay <- c(1, 3, 5, 2, 0, -1)
xq <- c(0, 1, 1.5, 2, 3, 5, 7.9, 8, 9, NA)
for (m in c("linear", "constant")) for (rule in list(1, 2, I(c(1, 2)))) for (ties in c("mean", "min", "max"))
  add(x = I(ax), y = I(ay), xout = I(xq), method = m, rule = rule, ties = ties)
add(x = I(ax), y = I(ay), xout = I(xq), method = "constant", f = 0.5, ties = "mean")
add(x = I(ax), y = I(ay), xout = I(xq), yleft = -10, yright = 10, ties = "mean")
add(x = I(ax), y = I(ay), n = 7, ties = "mean")
add(x = I(c(1, 2, NA, 4)), y = I(c(1, NA, 3, 4)), xout = I(c(1.5, 3.5)))
add(x = I(c(1)), y = I(c(2)), xout = I(c(1)))
write_htest_fixture("approx", cases, function(a) {
  r <- call_with(approx, list(x = a$x, y = a$y, xout = a$xout, method = a$method, n = a$n, yleft = a$yleft,
                              yright = a$yright, rule = unclass(a$rule), f = a$f,
                              ties = if (is.null(a$ties)) mean else get(a$ties)))
  list(x = vo(r$x), y = vo(r$y))
})

# --- spline, splinefun (with derivatives), splinefunH -----------------------------------------------------
cases <- list()
sx <- c(0, 1, 2.5, 3, 4.5, 6); sy <- sin(sx)
sq <- c(-1, 0, 0.3, 1.7, 2.5, 3.9, 6, 7)
for (m in c("fmm", "natural", "periodic", "hyman")) {
  y <- if (m == "periodic") c(sy[-6], sy[1]) else if (m == "hyman") cumsum(abs(sy)) else sy
  add(x = I(sx), y = I(y), method = m, n = 9)
  add(x = I(sx), y = I(y), method = m, xout = I(sq))
}
add(x = I(c(1, 2, 3)), y = I(c(1, 4, 9)), method = "fmm", xmin = 0, xmax = 4, n = 5)
# without xout, n, xmin and xmax come from the regularized x (NA pairs dropped, ties merged)
add(x = I(c(1, 2, NA, 4, 5)), y = I(c(1, 4, 2, 6, 3)), method = "fmm")
add(x = I(c(1, 2, 3, 4, 5)), y = I(c(1, NA, 2, 6, 3)), method = "natural")
add(x = I(c(1, 2, 2, 3, 4)), y = I(c(1, 3, 5, 2, 4)), method = "fmm")
add(x = I(c(4, 2, 1, 2, 3)), y = I(c(4, 5, 1, 3, 2)), method = "natural")
write_htest_fixture("spline", cases, function(a) {
  r <- call_with(spline, list(x = a$x, y = a$y, n = a$n, method = a$method, xout = a$xout, xmin = a$xmin,
                              xmax = a$xmax))
  list(x = vo(r$x), y = vo(r$y))
})
cases <- list()
for (m in c("fmm", "natural", "periodic", "monoH.FC", "hyman")) for (d in 0:3) {
  y <- if (m == "periodic") c(sy[-6], sy[1]) else if (m %in% c("hyman", "monoH.FC")) cumsum(abs(sy)) else sy
  if (m %in% c("monoH.FC", "hyman") && d == 3) next
  add(x = I(sx), y = I(y), method = m, xq = I(sq), deriv = d)
}
write_htest_fixture("splinefun", cases, function(a)
  list(value = vo(splinefun(a$x, a$y, method = a$method)(a$xq, deriv = a$deriv))))
cases <- list()
for (d in 0:3) add(x = I(sx), y = I(sy), m = I(cos(sx)), xq = I(sq), deriv = d)
write_htest_fixture("splinefunH", cases, function(a)
  list(value = vo(splinefunH(a$x, a$y, a$m)(a$xq, deriv = a$deriv))))

# --- Lagrange (pracma::barylag) and Hermite interpolation with given derivatives --------------------------
cases <- list()
# barylag refuses points outside [min(xi), max(xi)]; the last case checks that error
lx <- c(-1, -0.3, 0.4, 1, 2); lq <- c(-1, -0.5, 0, 0.4, 0.7, 1.9, 2)
for (f in list(function(x) exp(x), function(x) 1 / (1 + 25 * x^2), function(x) x^3 - x))
  add(xi = I(lx), yi = I(f(lx)), x = I(lq))
add(xi = I(lx), yi = I(exp(lx)), x = I(c(2.5)))
write_htest_fixture("barylag", cases, function(a) list(value = vo(pracma::barylag(unclass(a$xi), unclass(a$yi), unclass(a$x)))))

# Hermite: the polynomial of degree 2n - 1 with p(x_i) = y_i and p'(x_i) = d_i (Newton form with doubled nodes,
# evaluated with 256-bit Rmpfr so that the reference is exact to double precision). This is what jStat's
# hermite(X, F, dF, value) computes.
hermite_ref <- function(xi, yi, di, xq) {
  z <- Rmpfr::mpfr(rep(xi, each = 2), 256); n <- length(z)
  Q <- matrix(list(), n, n)
  col <- as.list(Rmpfr::mpfr(rep(yi, each = 2), 256))
  coef <- list(col[[1]])
  prev <- col
  for (k in 1:(n - 1)) {
    cur <- vector("list", n - k)
    for (i in 1:(n - k)) {
      if (k == 1 && i %% 2 == 1) cur[[i]] <- Rmpfr::mpfr(di[(i + 1) / 2], 256)
      else cur[[i]] <- (prev[[i + 1]] - prev[[i]]) / (z[i + k] - z[i])
    }
    coef[[k + 1]] <- cur[[1]]
    prev <- cur
  }
  vapply(xq, function(x) {
    x <- Rmpfr::mpfr(x, 256); p <- coef[[n]]
    for (k in (n - 1):1) p <- p * (x - z[k]) + coef[[k]]
    Rmpfr::asNumeric(p)
  }, 0)
}
cases <- list()
hx <- c(0, 1, 2.5, 3); hq <- c(-0.5, 0, 0.5, 1.7, 2.5, 3, 3.5)
add(xi = I(hx), yi = I(sin(hx)), di = I(cos(hx)), x = I(hq))
add(xi = I(c(0, 1)), yi = I(c(0, 1)), di = I(c(0, 0)), x = I(c(0, 0.25, 0.5, 1)))
add(xi = I(c(-1, 0, 2)), yi = I(exp(c(-1, 0, 2))), di = I(exp(c(-1, 0, 2))), x = I(c(-2, -0.5, 1, 3)))
write_htest_fixture("hermite", cases, function(a) list(value = vo(hermite_ref(a$xi, a$yi, a$di, a$x))))

# --- deSolve::ode with fixed steps (the step is the spacing of times) -------------------------------------
odes <- list(
  decay    = list(r = function(t, y, p) list(-p[1] * y), js = "[-p[0] * y[0]]", y0 = 1, p = 0.7),
  logistic = list(r = function(t, y, p) list(p[1] * y * (1 - y / p[2])), js = "[p[0] * y[0] * (1 - y[0] / p[1])]",
                  y0 = 0.1, p = c(1.5, 10)),
  harmonic = list(r = function(t, y, p) list(c(y[2], -p[1]^2 * y[1])), js = "[y[1], -p[0] * p[0] * y[0]]",
                  y0 = c(1, 0), p = 2),
  lotka    = list(r = function(t, y, p) list(c(p[1] * y[1] - p[2] * y[1] * y[2], p[3] * y[1] * y[2] - p[4] * y[2])),
                  js = "[p[0] * y[0] - p[1] * y[0] * y[1], p[2] * y[0] * y[1] - p[3] * y[1]]",
                  y0 = c(10, 5), p = c(1.1, 0.4, 0.1, 0.4)),
  forced   = list(r = function(t, y, p) list(t - y), js = "[t - y[0]]", y0 = 2, p = 0)
)
cases <- list()
for (id in names(odes)) for (m in c("euler", "rk2", "rk4")) for (h in c(0.1, 0.5)) {
  o <- odes[[id]]
  add(fn = id, js = o$js, y = I(o$y0), times = I(seq(0, 5, by = h)), parms = I(o$p), method = m)
}
write_htest_fixture("ode", cases, function(a) {
  o <- odes[[a$fn]]
  meth <- if (a$method == "rk2") deSolve::rkMethod("rk2") else a$method
  r <- deSolve::ode(y = unclass(a$y), times = unclass(a$times), func = o$r, parms = unclass(a$parms), method = meth)
  # Rows: one per time; columns: time, then the state variables
  list(value = mat_out(unclass(r)))
})

# --- numDeriv ---------------------------------------------------------------------------------------------
mfns <- list(
  sumsq      = list(r = function(x) sum(x^2),                              js = "x.reduce((s, v) => s + v * v, 0)"),
  rosenbrock = list(r = function(x) 100 * (x[2] - x[1]^2)^2 + (1 - x[1])^2, js = "100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2"),
  expsin     = list(r = function(x) exp(x[1]) * sin(x[2]),                  js = "Math.exp(x[0]) * Math.sin(x[1])"),
  scalarSin  = list(r = function(x) sin(x),                                 js = "Math.sin(x[0])"),
  logsum     = list(r = function(x) log(sum(exp(x))),                       js = "Math.log(x.reduce((s, v) => s + Math.exp(v), 0))")
)
pts <- list(sumsq = list(c(1, 2, 3), c(0, 0, 0)), rosenbrock = list(c(-1.2, 1), c(1, 1)), expsin = list(c(0.5, 2)),
            scalarSin = list(c(0), c(1e-3), c(2)), logsum = list(c(1, 2, 3), c(-100, 0, 100)))
cases <- list()
for (id in names(mfns)) for (x in pts[[id]]) for (m in c("Richardson", "simple", "complex")) {
  if (m == "complex" && id == "logsum") next
  add(fn = id, js = mfns[[id]]$js, x = I(x), method = m)
}
write_htest_fixture("grad", cases, function(a) list(value = vo(numDeriv::grad(mfns[[a$fn]]$r, a$x, method = a$method))))
cases <- list()
for (id in names(mfns)) for (x in pts[[id]]) add(fn = id, js = mfns[[id]]$js, x = I(x))
write_htest_fixture("hessian", cases, function(a) list(value = mat_out(numDeriv::hessian(mfns[[a$fn]]$r, a$x))))
vfns <- list(
  polar = list(r = function(x) c(x[1] * cos(x[2]), x[1] * sin(x[2])), js = "[x[0] * Math.cos(x[1]), x[0] * Math.sin(x[1])]"),
  mixed = list(r = function(x) c(x[1]^2 * x[2], 5 * x[1] + sin(x[2]), exp(x[1] - x[2])),
               js = "[x[0] ** 2 * x[1], 5 * x[0] + Math.sin(x[1]), Math.exp(x[0] - x[1])]")
)
cases <- list()
for (id in names(vfns)) for (x in list(c(1, 0.5), c(2, -1))) for (m in c("Richardson", "simple"))
  add(fn = id, js = vfns[[id]]$js, x = I(x), method = m)
write_htest_fixture("jacobian", cases, function(a) list(value = mat_out(numDeriv::jacobian(vfns[[a$fn]]$r, a$x, method = a$method))))
