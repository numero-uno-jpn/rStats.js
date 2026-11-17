# issue: 531
# Public-call numerical probes only; no reference-package or R implementation source is inspected.
suppressPackageStartupMessages(library(epiR))
suppressPackageStartupMessages(library(exact2x2))
suppressPackageStartupMessages(library(powerSurvEpi))
suppressPackageStartupMessages(library(clinfun))

emit <- function(label, value) {
  cat(label, ": ")
  if (is.numeric(value)) cat(paste(sprintf("%.17g", as.numeric(value)), collapse=","))
  else if (is.list(value)) cat(paste(capture.output(str(value, max.level=2)), collapse=" "))
  else cat(paste(capture.output(print(value)), collapse=" "))
  cat("\n")
}
probe <- function(label, call) {
  ans <- tryCatch(call(), error=function(e) structure(list(message=conditionMessage(e)), class="probe_error"))
  if (inherits(ans, "probe_error")) emit(paste0(label, " ERROR"), ans$message) else emit(label, ans)
}

# epiR continuous equality: a nearly zero difference makes the required n enormous.
probe("epiSsequc_large_n", function() epi.ssequc(treat=0.5, control=0.500000000001,
  sigma=1, delta=NA, n=NA, power=0.999999, r=1, type="equality",
  nfractional=TRUE, alpha=1e-10))
probe("epiSsequc_tail_power", function() epi.ssequc(treat=0.5, control=0.500000000001,
  sigma=1, delta=NA, n=1e24, power=NA, r=1, type="equality",
  nfractional=TRUE, alpha=1e-10))
probe("epiSsequb_large_n", function() epi.ssequb(treat=0.5, control=0.500000000001,
  delta=NA, n=NA, power=0.999999, r=1, type="equality",
  nfractional=TRUE, alpha=1e-10))

# Exact McNemar: rare discordances, large number of pairs.
probe("McNemar_rare_1000", function() powerPaired2x2(pb=1e-10, pc=1e-10,
  npairs=1000, errbound=0))
probe("McNemar_rare_2000", function() powerPaired2x2(pb=1e-10, pc=1e-10,
  npairs=2000, errbound=0))
probe("McNemar_rare_asymmetric", function() powerPaired2x2(pb=1e-10, pc=2e-10,
  npairs=1000, errbound=0))

# Simon's two-stage design at probabilities close to the boundaries.
probe("Simon_rare_pa_near_one", function() {
  x <- ph2simon(pu=1e-6, pa=1-1e-6, ep1=0.05, ep2=0.10, nmax=1000)
  c(nrow(x$out), x$minimax$n, x$minimax$n1, x$optimal$n, x$optimal$n1)
})
probe("Simon_rare_pu_near_zero", function() {
  x <- ph2simon(pu=1e-6, pa=0.2, ep1=0.05, ep2=0.10, nmax=1000)
  c(nrow(x$out), x$minimax$n, x$minimax$n1, x$optimal$n, x$optimal$n1)
})

# Public powerSurvEpi scalar APIs: tails and very large sample-size calculations.
probe("powerEpi_tiny_tail", function() powerEpi.default(n=1, theta=1.000000000001,
  p=0.5, psi=1, rho2=0, alpha=1e-10))
probe("powerEpi_near_one", function() powerEpi.default(n=1e8, theta=2,
  p=0.5, psi=1, rho2=0, alpha=1e-10))
probe("ssizeEpi_large_n", function() ssizeEpi.default(power=0.999999,
  theta=1.000000000001, p=0.5, psi=1, rho2=0, alpha=1e-10))
probe("numDEpi_large_n", function() numDEpi.default(power=0.999999,
  theta=1.000000000001, p=0.5, rho2=0, alpha=1e-10))
probe("powerCT_tail", function() powerCT.default(nE=1e8, nC=1e8,
  pE=0.5, pC=0.5, RR=1.000000000001, alpha=1e-10))
probe("ssizeCT_large_n", function() ssizeCT.default(power=0.999999,
  k=1, pE=0.5, pC=0.5, RR=1.000000000001, alpha=1e-10))
