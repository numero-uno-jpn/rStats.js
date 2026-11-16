# issue: 529
# Fixture generators for meta-analysis public APIs (metafor 5.2.1 / metadat 1.6.0).
source("/oracle/_common.R")
suppressPackageStartupMessages(library(metafor))
suppressPackageStartupMessages(library(metadat))
suppressPackageStartupMessages(library(jsonlite))

json_value <- function(x) {
  if (is.null(x)) return(NULL)
  # A fitted model given as an argument (confint, predict, regtest): recorded by its inputs, not its internals
  if (inherits(x, "rma.uni")) return(list(rma=list(yi=json_value(as.numeric(x$yi)), vi=json_value(as.numeric(x$vi)), method=x$method)))
  if (is.factor(x)) return(as.character(x))
  if (is.matrix(x)) {
    rows <- lapply(seq_len(nrow(x)), function(i) I(as.list(json_value(x[i, ]))))
    return(list(dim=as.list(dim(x)), rowNames=rownames(x), colNames=colnames(x), rows=I(rows)))
  }
  if (is.data.frame(x)) return(lapply(x, json_value))
  if (is.numeric(x)) {
    v <- num2str(x)
    if (length(v) == 1) return(unname(v))
    if (!is.null(names(x))) { names(v) <- names(x); return(as.list(v)) }
    return(I(as.list(v)))
  }
  if (is.logical(x) || is.character(x)) {
    if (length(x) == 1) return(unname(x))
    if (!is.null(names(x))) return(as.list(x))
    return(I(as.list(x)))
  }
  if (is.list(x)) {
    y <- lapply(x, json_value)
    names(y) <- names(x)
    return(y)
  }
  as.character(x)
}

make_case <- function(kind, arguments, extract) {
  list(kind=kind, arguments=arguments, extract=extract)
}

run_case <- function(case) {
  switch(case$kind,
    effectSize=do.call(escalc, case$arguments),
    metaFit=do.call(rma, case$arguments),
    interval=do.call(confint, case$arguments),
    prediction=do.call(predict, case$arguments),
    egger=do.call(regtest, case$arguments)
  )
}

run_cases <- function(name, cases) {
  rows <- lapply(cases, function(case) {
    warnings <- character()
    value <- tryCatch(
      withCallingHandlers(
        run_case(case),
        warning=function(cond) {
          warnings <<- c(warnings, conditionMessage(cond))
          invokeRestart("muffleWarning")
        }
      ),
      error=function(cond) structure(list(message=conditionMessage(cond)), class="meta_error")
    )
    expected <- if (inherits(value, "meta_error")) {
      list(error=value$message)
    } else {
      list(value=json_value(case$extract(value)), warnings=I(unique(warnings)))
    }
    list(fn=case$kind, args=json_value(case$arguments), expected=expected)
  })
  packages <- list(metafor=as.character(packageVersion("metafor")),
                   metadat=as.character(packageVersion("metadat")))
  stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
  tj <- function(x) jsonlite::toJSON(x, auto_unbox=TRUE, digits=NA, null="null", na="string")
  lines <- c(
    "{",
    sprintf('  "function": %s,', tj(name)),
    sprintf('  "r_version": %s,', tj(R.version.string)),
    sprintf('  "packages": %s,', tj(packages)),
    sprintf('  "generated": %s,', tj(stamp)),
    '  "cases": [',
    paste0("    ", vapply(rows, tj, character(1)), c(rep(",", length(rows)-1), "")),
    "  ]",
    "}"
  )
  writeLines(lines, file.path("/out", paste0(name, ".json")))
  cat(sprintf("%s: %d cases -> /out/%s.json\n", name, length(rows), name))
}

fit_fields <- function(fit) {
  list(beta=fit$beta, se=fit$se, zval=fit$zval, pval=fit$pval,
       ci.lb=fit$ci.lb, ci.ub=fit$ci.ub, tau2=fit$tau2, se.tau2=fit$se.tau2,
       QE=fit$QE, QEp=fit$QEp, I2=fit$I2, H2=fit$H2, k=fit$k)
}

pred_fields <- function(value) {
  list(pred=value$pred, se=value$se, ci.lb=value$ci.lb, ci.ub=value$ci.ub,
       pi.lb=value$pi.lb, pi.ub=value$pi.ub)
}

interval_fields <- function(value) value

dat <- dat.colditz1994
escalc_cases <- list(
  make_case("effectSize", list(measure="RR", ai=dat$tpos, bi=dat$tneg, ci=dat$cpos, di=dat$cneg), function(x) x[, c("yi","vi")]),
  make_case("effectSize", list(measure="OR", ai=dat$tpos, bi=dat$tneg, ci=dat$cpos, di=dat$cneg), function(x) x[, c("yi","vi")]),
  make_case("effectSize", list(measure="RR", ai=c(0,5), bi=c(20,15), ci=c(2,4), di=c(18,16)), function(x) x[, c("yi","vi")]),
  make_case("effectSize", list(measure="MD", m1i=c(5.1,4.8,6.0), sd1i=c(1.2,1.0,1.4), n1i=c(30,28,32), m2i=c(4.7,4.4,5.2), sd2i=c(1.1,1.3,1.2), n2i=c(29,30,31)), function(x) x[, c("yi","vi")]),
  make_case("effectSize", list(measure="SMD", m1i=c(5.1,4.8,6.0), sd1i=c(1.2,1.0,1.4), n1i=c(30,28,32), m2i=c(4.7,4.4,5.2), sd2i=c(1.1,1.3,1.2), n2i=c(29,30,31)), function(x) x[, c("yi","vi")])
)
run_cases("metaEscalc", escalc_cases)

rr <- escalc(measure="RR", ai=dat$tpos, bi=dat$tneg, ci=dat$cpos, di=dat$cneg)
fit_cases <- list(
  make_case("metaFit", list(yi=rr$yi, vi=rr$vi, method="EE"), fit_fields),
  make_case("metaFit", list(yi=rr$yi, vi=rr$vi, method="FE"), fit_fields),
  make_case("metaFit", list(yi=rr$yi, vi=rr$vi, method="DL"), fit_fields),
  make_case("metaFit", list(yi=rr$yi, vi=rr$vi, method="REML"), fit_fields),
  make_case("metaFit", list(yi=c(0.1,0.2,0.0,-0.1), vi=c(0.04,0.05,0.03,0.06), method="DL"), fit_fields),
  make_case("metaFit", list(yi=c(0.1,0.2,0.0,-0.1), vi=c(0.04,0.05,0.03,0.06), method="REML"), fit_fields),
  make_case("metaFit", list(yi=c(0.1,0.1,0.1,0.1), vi=c(0.04,0.05,0.03,0.06), method="DL"), fit_fields),
  make_case("metaFit", list(yi=c(0.1), vi=c(0.04), method="REML"), fit_fields),
  make_case("metaFit", list(yi=c(0.1,0.2), vi=c(0.04,0.05), method="REML"), fit_fields),
  make_case("metaFit", list(yi=c(0.1,0.2,0.3), vi=c(0,-0.1,0.2), method="DL"), fit_fields),
  make_case("metaFit", list(yi=c(1e150,-1e150,1e150), vi=c(1e-300,1e-300,1e-300), method="DL"), fit_fields),
  make_case("metaFit", list(yi=c(0.1,0.2,0.3), vi=c(1e-300,1e-300,1e-300), method="REML"), fit_fields),
  # Not a case: rma(yi = c(0.1, 0.2, 0.3), vi = c(1e300, 1e300, 1e300), method = "REML") exhausts any memory limit
  # (killed at 1 GB and 2 GB on 2026-11-17), so R gives no reference there
  make_case("metaFit", list(yi=c(0.1,0.2,0.3), vi=c(0.04,0.05,0.06), method="REML", control=list(maxiter=1, threshold=1e-15)), fit_fields)
)
run_cases("metaRma", fit_cases)

fit <- rma(yi, vi, data=rr, method="REML")
run_cases("metaIntervals", list(
  make_case("interval", list(object=fit), interval_fields),
  make_case("interval", list(object=fit, type="PL"), interval_fields),
  make_case("prediction", list(object=fit), pred_fields),
  make_case("prediction", list(object=fit, predtype="riley"), pred_fields)
))
run_cases("metaEgger", list(
  make_case("egger", list(x=rr$yi, vi=rr$vi, model="lm", predictor="sei"), function(x) x[c("model","predictor","zval","pval","dfs","est","ci.lb","ci.ub")]),
  make_case("egger", list(x=fit, model="rma", predictor="sei"), function(x) x[c("model","predictor","zval","pval","dfs","est","ci.lb","ci.ub")]),
  make_case("egger", list(x=c(0.1,0.2), vi=c(0.04,0.05), model="lm", predictor="sei"), function(x) x[c("model","predictor","zval","pval","dfs","est","ci.lb","ci.ub")])
))
