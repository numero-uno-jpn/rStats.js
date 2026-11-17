# Fixture generator for lme4 confidence intervals (public API only).
source("/oracle/_common.R")
suppressPackageStartupMessages({library(lme4); library(jsonlite)})

json_value <- function(x) {
  if (is.null(x)) return(NULL)
  if (inherits(x, "formula")) return(paste(deparse(x, width.cutoff=500L), collapse=""))
  if (is.matrix(x)) {
    return(list(dim=as.list(dim(x)), rowNames=rownames(x), colNames=colnames(x),
                rows=lapply(seq_len(nrow(x)), function(i) I(as.list(num2str(x[i, ]))))))
  }
  if (is.data.frame(x)) return(list(rowNames=rownames(x), columns=lapply(x, json_value)))
  if (is.factor(x)) return(as.character(x))
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
    y <- lapply(x, json_value); names(y) <- names(x); return(y)
  }
  as.character(x)
}

capture_raw <- function(f) {
  warnings <- character(0); messages <- character(0)
  value <- tryCatch(withCallingHandlers(f(),
    warning=function(cnd) { warnings <<- c(warnings, conditionMessage(cnd)); invokeRestart("muffleWarning") },
    message=function(cnd) { messages <<- c(messages, sub("\\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") }),
    error=function(cnd) structure(list(message=conditionMessage(cnd)), class="oracle_error"))
  if (inherits(value, "oracle_error")) return(list(error=value$message, warnings=I(unique(warnings)), messages=I(unique(messages))))
  list(value=value, warnings=I(unique(warnings)), messages=I(unique(messages)))
}

fit_record <- function(a) {
  out <- a
  out$formula <- paste(deparse(a$formula, width.cutoff=500L), collapse="")
  if (!is.null(a$family)) out$family <- list(family=a$family$family, link=a$family$link)
  json_value(out)
}

capture <- function(f) {
  warnings <- character(0); messages <- character(0)
  value <- tryCatch(withCallingHandlers(f(),
    warning=function(cnd) { warnings <<- c(warnings, conditionMessage(cnd)); invokeRestart("muffleWarning") },
    message=function(cnd) { messages <<- c(messages, sub("\\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") }),
    error=function(cnd) structure(list(message=conditionMessage(cnd)), class="oracle_error"))
  if (inherits(value, "oracle_error")) return(list(error=value$message, warnings=I(unique(warnings)), messages=I(unique(messages))))
  list(value=json_value(value), warnings=I(unique(warnings)), messages=I(unique(messages)))
}

sleep <- as.data.frame(sleepstudy)
sleep$Subject <- as.character(sleep$Subject)
cb <- as.data.frame(cbpp)
cb$herd <- as.character(cb$herd)
pen <- as.data.frame(Penicillin)
pen$plate <- as.character(pen$plate); pen$sample <- as.character(pen$sample)
boundary <- data.frame(g=rep(paste0("g", 1:6), each=4), y=rep(c(-1,1,-1,1), 6))
set.seed(535)
corrBoundary <- expand.grid(g=factor(paste0("g", 1:12)), x=seq(-2, 2, length.out=5))
gi <- as.integer(corrBoundary$g)
u0 <- rnorm(12)
u1 <- 0.5 * u0 + rnorm(12, 0, 1e-4)
corrBoundary$y <- 2 + 0.5 * corrBoundary$x + u0[gi] + u1[gi] * corrBoundary$x + rnorm(nrow(corrBoundary), 0, 0.1)

cases <- list(
  list(id="sleepstudy-profile-default", kind="lmer",
       fit=list(formula=as.formula("Reaction ~ Days + (Days | Subject)"), data=sleep, REML=TRUE),
       calls=list(list(), list(method="Wald"), list(method="profile", parm="beta_"),
                  list(method="profile", parm="theta_"), list(method="profile", parm=".sig01", maxpts=8), list(method="profile", signames=FALSE, maxpts=8),
                  list(method="Wald", level=1.1), list(method="profile", parm="not-a-parameter", maxpts=8))),
  list(id="sleepstudy-ml", kind="lmer",
       fit=list(formula=as.formula("Reaction ~ Days + (Days | Subject)"), data=sleep, REML=FALSE),
       calls=list(list(method="profile", level=0.90, maxpts=8),
                  list(method="profile", parm=1L, level=0.95, maxpts=8),
                  list(method="profile", zeta=1.959963984540054, maxpts=8))),
  list(id="penicillin-random-intercepts", kind="lmer",
       fit=list(formula=as.formula("diameter ~ (1 | plate) + (1 | sample)"), data=pen, REML=TRUE),
       calls=list(list(method="Wald"), list(method="profile", maxpts=8))),
  list(id="zero-random-intercept-boundary", kind="lmer",
       fit=list(formula=as.formula("y ~ 1 + (1 | g)"), data=boundary, REML=TRUE),
       calls=list(list(method="Wald"), list(method="profile", maxpts=8))),
  list(id="near-perfect-random-effect-correlation", kind="lmer",
       fit=list(formula=as.formula("y ~ x + (x | g)"), data=corrBoundary, REML=TRUE),
       calls=list(list(method="Wald"), list(method="profile", maxpts=8))),
  list(id="cbpp-laplace", kind="glmer",
       fit=list(formula=as.formula("cbind(incidence, size - incidence) ~ period + (1 | herd)"), data=cb,
                family=binomial(), nAGQ=1),
       calls=list(list(method="Wald"), list(method="profile", maxpts=8),
                  list(method="profile", parm="beta_", maxpts=8))),
  list(id="cbpp-nagq-zero", kind="glmer",
       fit=list(formula=as.formula("cbind(incidence, size - incidence) ~ period + (1 | herd)"), data=cb,
                family=binomial(), nAGQ=0),
       calls=list(list(method="Wald"), list(method="profile", maxpts=8))),
  list(id="cbpp-nagq-greater-one", kind="glmer",
       fit=list(formula=as.formula("cbind(incidence, size - incidence) ~ period + (1 | herd)"), data=cb,
                family=binomial(), nAGQ=9),
       calls=list(list(method="Wald"), list(method="profile", maxpts=8)))
)

rows <- lapply(cases, function(case) {
  fit_result <- capture_raw(function() {
    if (case$kind == "lmer") do.call(lme4::lmer, case$fit) else do.call(lme4::glmer, case$fit)
  })
  if (!is.null(fit_result$error)) {
    return(list(id=case$id, kind=case$kind, fit=fit_record(case$fit),
                fitResult=fit_result, calls=I(list())))
  }
  fit <- fit_result$value
  calls <- lapply(case$calls, function(call_args) {
    result <- capture(function() do.call(stats::confint, c(list(object=fit), call_args)))
    list(args=json_value(call_args), result=result)
  })
  list(id=case$id, kind=case$kind, fit=fit_record(case$fit),
       fitWarnings=fit_result$warnings, fitMessages=fit_result$messages, calls=calls)
})

packages <- list(lme4=as.character(packageVersion("lme4")), Matrix=as.character(packageVersion("Matrix")))
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
tj <- function(x) jsonlite::toJSON(x, auto_unbox=TRUE, digits=NA, null="null", na="string")
lines <- c("{", sprintf('  "function": %s,', tj("mixedConfint")),
           sprintf('  "r_version": %s,', tj(R.version.string)),
           sprintf('  "packages": %s,', tj(packages)), sprintf('  "generated": %s,', tj(stamp)),
           '  "cases": [', paste0("    ", vapply(rows, tj, character(1)),
                                 c(rep(",", length(rows)-1), "")), "  ]", "}")
writeLines(lines, file.path("/out", "mixedConfint.json"))
cat(sprintf("mixedConfint: %d cases -> /out/mixedConfint.json; lme4 %s; Matrix %s\n",
            length(rows), packages$lme4, packages$Matrix))
