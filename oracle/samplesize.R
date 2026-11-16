# issue: 527
# Fixture generators for the public sample-size and power APIs; no reference-package source is inspected.
source("/oracle/_common.R")
suppressPackageStartupMessages(library(epiR))
library(exact2x2)
suppressPackageStartupMessages(library(clinfun))
suppressPackageStartupMessages(library(powerSurvEpi))
suppressPackageStartupMessages(library(survival))
suppressPackageStartupMessages(library(jsonlite))

# Preserve every returned field, names, matrix dimensions and non-finite numbers as JSON-safe strings.
json_value <- function(x) {
  if (is.null(x)) return(NULL)
  if (is.factor(x)) return(as.character(x))
  if (is.matrix(x)) {
    rows <- lapply(seq_len(nrow(x)), function(i) I(json_value(x[i, ])))
    return(list(dim = as.list(dim(x)), rowNames = rownames(x), colNames = colnames(x), rows = I(rows)))
  }
  if (is.data.frame(x)) return(lapply(x, json_value))
  if (is.numeric(x)) {
    v <- num2str(x)
    if (length(v) == 1) return(unname(v))
    if (!is.null(names(x))) { names(v) <- names(x); return(as.list(v)) }
    return(I(v))
  }
  if (is.logical(x) || is.character(x)) {
    if (length(x) == 1) return(unname(x))
    if (!is.null(names(x))) return(as.list(x))
    return(I(x))
  }
  if (is.list(x)) {
    y <- lapply(x, json_value)
    names(y) <- names(x)
    return(y)
  }
  as.character(x)
}

make_case <- function(fn, args, run) list(fn = fn, args = args, run = run)

write_samplesize_fixture <- function(name, cases) {
  rows <- lapply(cases, function(case) {
    w <- character()
    value <- tryCatch(
      withCallingHandlers(case$run(), warning = function(x) {
        w <<- c(w, conditionMessage(x))
        invokeRestart("muffleWarning")
      }),
      error = function(x) structure(list(message = conditionMessage(x)), class = "samplesize_error")
    )
    expected <- if (inherits(value, "samplesize_error")) {
      list(error = value$message)
    } else {
      list(value = json_value(value), warnings = I(unique(w)))
    }
    list(fn = case$fn, args = json_value(case$args), expected = expected)
  })
  out <- list(
    `function` = name,
    r_version = R.version.string,
    packages = list(epiR=as.character(packageVersion("epiR")),
                    exact2x2=as.character(packageVersion("exact2x2")),
                    clinfun=as.character(packageVersion("clinfun")),
                    powerSurvEpi=as.character(packageVersion("powerSurvEpi"))),
    generated = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
    cases = rows
  )
  tj <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE, digits = NA, null = "null", na = "string")
  lines <- c(
    "{",
    sprintf('  "function": %s,', tj(name)),
    sprintf('  "r_version": %s,', tj(R.version.string)),
    sprintf('  "packages": %s,', tj(out$packages)),
    sprintf('  "generated": %s,', tj(out$generated)),
    '  "cases": [',
    paste0("    ", vapply(rows, tj, character(1)), c(rep(",", length(rows) - 1), "")),
    "  ]",
    "}"
  )
  path <- file.path("/out", paste0(name, ".json"))
  writeLines(lines, path)
  cat(sprintf("%s: %d cases -> %s (%s)\n", name, length(rows), path, R.version.string))
}

# 1. epiR: two-sample equivalence/equality, non-inferiority and superiority.
epi_cases <- list(
  make_case("epi.ssequb", list(treat=.50, control=.45, delta=.10, n=NA, power=.80, r=1.5, type="equivalence", nfractional=TRUE, alpha=.05), function() epi.ssequb(treat=.50, control=.45, delta=.10, n=NA, power=.80, r=1.5, type="equivalence", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequb", list(treat=.50, control=.45, delta=.10, n=NA, power=.80, r=1.5, type="equivalence", nfractional=FALSE, alpha=.05), function() epi.ssequb(treat=.50, control=.45, delta=.10, n=NA, power=.80, r=1.5, type="equivalence", nfractional=FALSE, alpha=.05)),
  make_case("epi.ssequb", list(treat=.50, control=.45, delta=.10, n=120, power=NA, r=1.5, type="equivalence", nfractional=TRUE, alpha=.05), function() epi.ssequb(treat=.50, control=.45, delta=.10, n=120, power=NA, r=1.5, type="equivalence", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequb", list(treat=.50, control=.40, delta=NA, n=NA, power=.80, r=1, type="equality", nfractional=TRUE, alpha=.05), function() epi.ssequb(treat=.50, control=.40, delta=NA, n=NA, power=.80, r=1, type="equality", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequb", list(treat=.50, control=.40, delta=NA, n=NA, power=.80, r=2, type="equality", nfractional=TRUE, alpha=.05), function() epi.ssequb(treat=.50, control=.40, delta=NA, n=NA, power=.80, r=2, type="equality", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequb", list(treat=.50, control=.40, delta=NA, n=120, power=NA, r=2, type="equality", nfractional=TRUE, alpha=.05), function() epi.ssequb(treat=.50, control=.40, delta=NA, n=120, power=NA, r=2, type="equality", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequb", list(treat=.50, control=.45, delta=.10, n=120, power=NA, r=1, type="equivalence", nfractional=TRUE, alpha=.05), function() epi.ssequb(treat=.50, control=.45, delta=.10, n=120, power=NA, r=1, type="equivalence", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequc", list(treat=20, control=21, sigma=10, delta=5, n=NA, power=.80, r=1.5, type="equivalence", nfractional=TRUE, alpha=.05), function() epi.ssequc(treat=20, control=21, sigma=10, delta=5, n=NA, power=.80, r=1.5, type="equivalence", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequc", list(treat=20, control=21, sigma=10, delta=5, n=NA, power=.80, r=1.5, type="equivalence", nfractional=FALSE, alpha=.05), function() epi.ssequc(treat=20, control=21, sigma=10, delta=5, n=NA, power=.80, r=1.5, type="equivalence", nfractional=FALSE, alpha=.05)),
  make_case("epi.ssequc", list(treat=20, control=21, sigma=10, delta=5, n=120, power=NA, r=1.5, type="equivalence", nfractional=TRUE, alpha=.05), function() epi.ssequc(treat=20, control=21, sigma=10, delta=5, n=120, power=NA, r=1.5, type="equivalence", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequc", list(treat=.70, control=.65, sigma=.06, delta=NA, n=NA, power=.80, r=1, type="equality", nfractional=TRUE, alpha=.05), function() epi.ssequc(treat=.70, control=.65, sigma=.06, delta=NA, n=NA, power=.80, r=1, type="equality", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequc", list(treat=.70, control=.65, sigma=.06, delta=NA, n=NA, power=.80, r=2, type="equality", nfractional=TRUE, alpha=.05), function() epi.ssequc(treat=.70, control=.65, sigma=.06, delta=NA, n=NA, power=.80, r=2, type="equality", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequc", list(treat=.70, control=.65, sigma=.06, delta=NA, n=120, power=NA, r=2, type="equality", nfractional=TRUE, alpha=.05), function() epi.ssequc(treat=.70, control=.65, sigma=.06, delta=NA, n=120, power=NA, r=2, type="equality", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssequc", list(treat=0, control=0, sigma=.25, delta=.05, n=40, power=NA, r=1, type="equivalence", nfractional=TRUE, alpha=.05), function() epi.ssequc(treat=0, control=0, sigma=.25, delta=.05, n=40, power=NA, r=1, type="equivalence", nfractional=TRUE, alpha=.05)),
  make_case("epi.ssninfb", list(treat=.85, control=.65, delta=.10, n=NA, power=.80, r=2, nfractional=TRUE, alpha=.05), function() epi.ssninfb(treat=.85, control=.65, delta=.10, n=NA, power=.80, r=2, nfractional=TRUE, alpha=.05)),
  make_case("epi.ssninfb", list(treat=.85, control=.65, delta=.10, n=120, power=NA, r=2, nfractional=TRUE, alpha=.05), function() epi.ssninfb(treat=.85, control=.65, delta=.10, n=120, power=NA, r=2, nfractional=TRUE, alpha=.05)),
  make_case("epi.ssninfc", list(treat=.22, control=.20, sigma=.10, delta=.05, n=NA, power=.80, r=2, nfractional=TRUE, alpha=.05), function() epi.ssninfc(treat=.22, control=.20, sigma=.10, delta=.05, n=NA, power=.80, r=2, nfractional=TRUE, alpha=.05)),
  make_case("epi.ssninfc", list(treat=.22, control=.20, sigma=.10, delta=.05, n=120, power=NA, r=2, nfractional=TRUE, alpha=.05), function() epi.ssninfc(treat=.22, control=.20, sigma=.10, delta=.05, n=120, power=NA, r=2, nfractional=TRUE, alpha=.05)),
  make_case("epi.ssninfc", list(treat=.10, control=.20, sigma=.10, delta=.05, n=NA, power=.80, r=1, nfractional=TRUE, alpha=.05), function() epi.ssninfc(treat=.10, control=.20, sigma=.10, delta=.05, n=NA, power=.80, r=1, nfractional=TRUE, alpha=.05)),
  make_case("epi.ssninfc", list(treat=.22, control=.20, sigma=.10, delta=.05, n=120, power=0, r=1, nfractional=TRUE, alpha=.05), function() epi.ssninfc(treat=.22, control=.20, sigma=.10, delta=.05, n=120, power=0, r=1, nfractional=TRUE, alpha=.05)),
  make_case("epi.ssninfc", list(treat=.22, control=.20, sigma=.10, delta=.05, n=120, power=1, r=1, nfractional=TRUE, alpha=.05), function() epi.ssninfc(treat=.22, control=.20, sigma=.10, delta=.05, n=120, power=1, r=1, nfractional=TRUE, alpha=.05)),
  make_case("epi.sssupb", list(treat=.85, control=.65, delta=.05, n=NA, power=.80, r=1, sided.test=1, nfractional=TRUE, alpha=.05), function() epi.sssupb(treat=.85, control=.65, delta=.05, n=NA, power=.80, r=1, sided.test=1, nfractional=TRUE, alpha=.05)),
  make_case("epi.sssupb", list(treat=.85, control=.65, delta=.05, n=NA, power=.80, r=1, sided.test=2, nfractional=TRUE, alpha=.05), function() epi.sssupb(treat=.85, control=.65, delta=.05, n=NA, power=.80, r=1, sided.test=2, nfractional=TRUE, alpha=.05)),
  make_case("epi.sssupb", list(treat=.50, control=.30, delta=.05, n=101, power=NA, r=.5, sided.test=1, nfractional=TRUE, alpha=.05), function() epi.sssupb(treat=.50, control=.30, delta=.05, n=101, power=NA, r=.5, sided.test=1, nfractional=TRUE, alpha=.05)),
  make_case("epi.sssupc", list(treat=20, control=20, sigma=10, delta=5, n=NA, power=.80, r=1, sided.test=1, nfractional=TRUE, alpha=.05), function() epi.sssupc(treat=20, control=20, sigma=10, delta=5, n=NA, power=.80, r=1, sided.test=1, nfractional=TRUE, alpha=.05)),
  make_case("epi.sssupc", list(treat=20, control=20, sigma=10, delta=5, n=NA, power=.80, r=1, sided.test=2, nfractional=TRUE, alpha=.05), function() epi.sssupc(treat=20, control=20, sigma=10, delta=5, n=NA, power=.80, r=1, sided.test=2, nfractional=TRUE, alpha=.05)),
  make_case("epi.sssupc", list(treat=20, control=20, sigma=10, delta=5, n=120, power=NA, r=1.5, sided.test=1, nfractional=TRUE, alpha=.05), function() epi.sssupc(treat=20, control=20, sigma=10, delta=5, n=120, power=NA, r=1.5, sided.test=1, nfractional=TRUE, alpha=.05)),
  make_case("epi.sssupc", list(treat=20, control=20, sigma=10, delta=5, n=120, power=NA, r=1.5, sided.test=2, nfractional=TRUE, alpha=.05), function() epi.sssupc(treat=20, control=20, sigma=10, delta=5, n=120, power=NA, r=1.5, sided.test=2, nfractional=TRUE, alpha=.05)),
  make_case("epi.sssupc", list(treat=20, control=20, sigma=10, delta=0, n=NA, power=.80, r=1, sided.test=1, nfractional=TRUE, alpha=.05), function() epi.sssupc(treat=20, control=20, sigma=10, delta=0, n=NA, power=.80, r=1, sided.test=1, nfractional=TRUE, alpha=.05))
)
write_samplesize_fixture("samplesizeEpi", epi_cases)

# 2. exact2x2: exact McNemar power. This function has no paired sample-size solver.
mcnemar_cases <- list(
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40), function() powerPaired2x2(pb=.50, pc=.30, npairs=40)),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, strict=TRUE), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, strict=TRUE)),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, strict=TRUE, tsmethod="central"), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, strict=TRUE, tsmethod="central")),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, strict=TRUE, tsmethod="minlike"), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, strict=TRUE, tsmethod="minlike")),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, strict=TRUE, tsmethod="blaker"), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, tsmethod="blaker")),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, alternative="one.sided"), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, alternative="one.sided")),
  make_case("powerPaired2x2", list(pb=.30, pc=.50, npairs=40, alternative="one.sided"), function() powerPaired2x2(pb=.30, pc=.50, npairs=40, alternative="one.sided")),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, errbound=0), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, errbound=0)),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, errbound=1e-8), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, errbound=1e-8)),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, errbound=.01), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, errbound=.01)),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, nullOddsRatio=2), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, nullOddsRatio=2)),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, sig.level=1e-6), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, sig.level=1e-6)),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, sig.level=0), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, sig.level=0)),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=40, sig.level=1), function() powerPaired2x2(pb=.50, pc=.30, npairs=40, sig.level=1)),
  make_case("powerPaired2x2", list(pb=.50, pc=.30, npairs=0), function() powerPaired2x2(pb=.50, pc=.30, npairs=0)),
  make_case("powerPaired2x2", list(pb=0, pc=0, npairs=40), function() powerPaired2x2(pb=0, pc=0, npairs=40)),
  make_case("powerPaired2x2", list(pb=.5, pc=.5, npairs=40), function() powerPaired2x2(pb=.5, pc=.5, npairs=40)),
  make_case("powerPaired2x2", list(pb=.7, pc=.6, npairs=40), function() powerPaired2x2(pb=.7, pc=.6, npairs=40)),
  make_case("powerPaired2x2", list(pb=.5, pc=.3, npairs=1000), function() powerPaired2x2(pb=.5, pc=.3, npairs=100000))
)
write_samplesize_fixture("samplesizeMcNemar", mcnemar_cases)

# 3. powerSurvEpi: Freedman clinical-trial approximation and Schoenfeld/Latouche epidemiological formulae.
data(Oph, package="powerSurvEpi")
X1 <- rep(c(0, 1), 50)
X2 <- rep(c(0, 0, 1, 1), 25)
failureFlag <- rep(c(0, 1, 0, 0, 1), 20)
survival_cases <- list(
  make_case("powerCT.default", list(nE=200, nC=200, pE=.3707, pC=.4890, RR=.7, alpha=.05), function() powerCT.default(nE=200, nC=200, pE=.3707, pC=.4890, RR=.7, alpha=.05)),
  make_case("powerCT.default", list(nE=240, nC=120, pE=.3707, pC=.4890, RR=.7, alpha=.05), function() powerCT.default(nE=240, nC=120, pE=.3707, pC=.4890, RR=.7, alpha=.05)),
  make_case("powerCT.default", list(nE=200, nC=200, pE=.3707, pC=.4890, RR=1, alpha=.05), function() powerCT.default(nE=200, nC=200, pE=.3707, pC=.4890, RR=1, alpha=.05)),
  make_case("ssizeCT.default", list(power=.8, k=1, pE=.3707, pC=.4890, RR=.7, alpha=.05), function() ssizeCT.default(power=.8, k=1, pE=.3707, pC=.4890, RR=.7, alpha=.05)),
  make_case("ssizeCT.default", list(power=.8, k=2, pE=.3707, pC=.4890, RR=.7, alpha=.05), function() ssizeCT.default(power=.8, k=2, pE=.3707, pC=.4890, RR=.7, alpha=.05)),
  make_case("ssizeCT.default", list(power=.8, k=1, pE=.5, pC=.5, RR=1.000001, alpha=.05), function() ssizeCT.default(power=.8, k=1, pE=.5, pC=.5, RR=1.000001, alpha=.05)),
  make_case("powerCT", list(formula="Surv(times, status) ~ group", dat=Oph, nE=200, nC=200, RR=.7, alpha=.05), function() powerCT(formula=survival::Surv(times, status) ~ group, dat=Oph, nE=200, nC=200, RR=.7, alpha=.05)),
  make_case("ssizeCT", list(formula="Surv(times, status) ~ group", dat=Oph, power=.8, k=1, RR=.7, alpha=.05), function() ssizeCT(formula=survival::Surv(times, status) ~ group, dat=Oph, power=.8, k=1, RR=.7, alpha=.05)),
  make_case("powerEpi.default", list(n=139, theta=2, p=.39, psi=.505, rho2=.132^2, alpha=.05), function() powerEpi.default(n=139, theta=2, p=.39, psi=.505, rho2=.132^2, alpha=.05)),
  make_case("ssizeEpi.default", list(power=.8, theta=2, p=.39, psi=.505, rho2=.132^2, alpha=.05), function() ssizeEpi.default(power=.8, theta=2, p=.39, psi=.505, rho2=.132^2, alpha=.05)),
  make_case("numDEpi.default", list(power=.8, theta=2, p=.39, rho2=.132^2, alpha=.05), function() numDEpi.default(power=.8, theta=2, p=.39, rho2=.132^2, alpha=.05)),
  make_case("ssizeEpi", list(X1=X1, X2=X2, failureFlag=failureFlag, power=.8, theta=2, alpha=.05), function() ssizeEpi(X1=X1, X2=X2, failureFlag=failureFlag, power=.8, theta=2, alpha=.05)),
  make_case("powerEpi", list(X1=X1, X2=X2, failureFlag=failureFlag, n=139, theta=2, alpha=.05), function() powerEpi(X1=X1, X2=X2, failureFlag=failureFlag, n=139, theta=2, alpha=.05)),
  make_case("numDEpi", list(X1=X1, X2=X2, power=.8, theta=2, alpha=.05), function() numDEpi(X1=X1, X2=X2, power=.8, theta=2, alpha=.05)),
  make_case("ssizeEpi.default", list(power=.8, theta=1, p=.39, psi=.505, rho2=.132^2, alpha=.05), function() ssizeEpi.default(power=.8, theta=1, p=.39, psi=.505, rho2=.132^2, alpha=.05)),
  make_case("ssizeEpi.default", list(power=.8, theta=2, p=0, psi=.505, rho2=0, alpha=.05), function() ssizeEpi.default(power=.8, theta=2, p=0, psi=.505, rho2=0, alpha=.05)),
  make_case("ssizeEpi.default", list(power=.8, theta=2, p=.39, psi=.505, rho2=1, alpha=.05), function() ssizeEpi.default(power=.8, theta=2, p=.39, psi=.505, rho2=1, alpha=.05)),
  make_case("ssizeEpi.default", list(power=0, theta=2, p=.39, psi=.505, rho2=.132^2, alpha=.05), function() ssizeEpi.default(power=0, theta=2, p=.39, psi=.505, rho2=.132^2, alpha=.05)),
  make_case("ssizeEpi.default", list(power=1, theta=2, p=.39, psi=.505, rho2=.132^2, alpha=.05), function() ssizeEpi.default(power=1, theta=2, p=.39, psi=.505, rho2=.132^2, alpha=.05))
)
write_samplesize_fixture("samplesizeSurvival", survival_cases)

# 4. clinfun: Simon's two-stage Phase II design. Capture the public print method as well as the returned candidate matrix.
simon_cases <- list(
  make_case("ph2simon", list(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=100), function() {
    x <- ph2simon(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=100)
    list(out=x$out, printed=utils::capture.output(print(x)))
  }),
  make_case("ph2simon", list(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=50), function() {
    x <- ph2simon(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=50)
    list(out=x$out, printed=utils::capture.output(print(x)))
  }),
  make_case("ph2simon", list(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=1), function() ph2simon(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=1)),
  make_case("ph2simon", list(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=1000), function() {
    x <- ph2simon(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=1000)
    list(rows=nrow(x$out), first=x$out[1, ], last=x$out[nrow(x$out), ])
  }),
  make_case("ph2simon", list(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=1001), function() ph2simon(pu=.20, pa=.40, ep1=.05, ep2=.10, nmax=1001)),
  make_case("ph2simon", list(pu=.80, pa=.95, ep1=.05, ep2=.20), function() {
    x <- ph2simon(pu=.80, pa=.95, ep1=.05, ep2=.20)
    list(out=x$out, printed=utils::capture.output(print(x)))
  }),
  make_case("ph2simon", list(pu=.20, pa=.21, ep1=.0001, ep2=.0001, nmax=10), function() ph2simon(pu=.20, pa=.21, ep1=.0001, ep2=.0001, nmax=10)),
  make_case("ph2simon", list(pu=.40, pa=.20, ep1=.05, ep2=.10), function() ph2simon(pu=.40, pa=.20, ep1=.05, ep2=.10)),
  make_case("ph2simon", list(pu=0, pa=.20, ep1=.05, ep2=.10, nmax=100), function() {
    x <- ph2simon(pu=0, pa=.20, ep1=.05, ep2=.10, nmax=100)
    list(out=x$out, printed=utils::capture.output(print(x)))
  }),
  make_case("ph2simon", list(pu=.20, pa=1, ep1=.05, ep2=.10, nmax=100), function() {
    x <- ph2simon(pu=.20, pa=1, ep1=.05, ep2=.10, nmax=100)
    list(out=x$out, printed=utils::capture.output(print(x)))
  })
)
write_samplesize_fixture("samplesizeSimon", simon_cases)
