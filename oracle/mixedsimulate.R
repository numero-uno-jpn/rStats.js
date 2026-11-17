# Fixture generator for lme4 simulation (public API only).
source("/oracle/_common.R")
suppressPackageStartupMessages({library(lme4); library(jsonlite)})

json_value <- function(x) {
  if (is.null(x)) return(NULL)
  if (inherits(x, "formula")) return(paste(deparse(x, width.cutoff=500L), collapse=""))
  if (is.data.frame(x)) return(list(rowNames=rownames(x), columns=lapply(x, json_value)))
  if (is.factor(x)) return(as.character(x))
  if (is.matrix(x)) return(lapply(seq_len(nrow(x)), function(i) I(as.list(num2str(x[i, ])))))
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
  if (is.list(x)) { y <- lapply(x, json_value); names(y) <- names(x); return(y) }
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

# Public fitted quantities let the JS simulation test isolate the RNG and response generator from
# the small, intentional numerical differences between the independent lmer/glmer optimisers.
fit_public_record <- function(fit, kind) {
  out <- list(
    fixef=lme4::fixef(fit),
    sigma=stats::sigma(fit),
    varCorr=as.data.frame(lme4::VarCorr(fit)),
    ranef=lme4::ranef(fit),
    fitted=unname(stats::fitted(fit))
  )
  if (kind == "glmer") out$eta <- unname(stats::predict(fit, re.form=NULL, type="link"))
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
cb_prop <- transform(cb, response=incidence/size)
cb_bernoulli <- do.call(rbind, lapply(seq_len(nrow(cb)), function(i) {
  data.frame(herd=cb$herd[i], period=cb$period[i],
             response=c(rep(1L, cb$incidence[i]), rep(0L, cb$size[i]-cb$incidence[i])))
}))
ticks <- as.data.frame(grouseticks)
ticks$BROOD <- as.character(ticks$BROOD)
pen <- as.data.frame(Pastes)
pen$batch <- as.character(pen$batch); pen$cask <- as.character(pen$cask)
boundary <- data.frame(g=rep(paste0("g", 1:6), each=4), y=rep(c(-1,1,-1,1), 6))

conditioning_calls <- function(partial_re) list(
  # Each option is tested alone; explicit re.form = NULL is its own case.
  list(nsim=2, seed=123, use.u=TRUE),
  list(nsim=2, seed=123, use.u=FALSE),
  list(nsim=2, seed=123, re.form=NA),
  list(nsim=2, seed=123, re.form=~0),
  list(nsim=2, seed=123, re.form=NULL),
  list(nsim=2, seed=123, re.form=partial_re),
  # Supplying both options is tested in both conflicting directions.
  list(nsim=2, seed=123, use.u=TRUE, re.form=NA),
  list(nsim=2, seed=123, use.u=FALSE, re.form=NULL)
)

cases <- list(
  list(id="lmer-default-new-effects", kind="lmer",
       fit=list(formula=as.formula("Reaction ~ Days + (Days | Subject)"), data=sleep, REML=TRUE),
       calls=c(list(list(nsim=1, seed=123), list(nsim=3, seed=123),
                    list(nsim=2, seed=NULL, externalSeed=20261117),
                    list(nsim=0, seed=123), list(nsim=1.5, seed=123), list(nsim=1, seed=NA_integer_)),
               conditioning_calls(as.formula("~ (1 | Subject)")))),
  list(id="lmer-boundary-variance", kind="lmer",
       fit=list(formula=as.formula("y ~ 1 + (1 | g)"), data=boundary, REML=TRUE),
       calls=c(list(list(nsim=3, seed=123)),
               conditioning_calls(as.formula("~ (1 | g)")))),
  list(id="glmer-binomial", kind="glmer",
       fit=list(formula=as.formula("cbind(incidence, size - incidence) ~ period + (1 | herd) + (1 | period)"), data=cb,
                family=binomial(), nAGQ=1),
       calls=c(list(list(nsim=3, seed=123),
                    list(nsim=2, seed=NULL, externalSeed=20261118)),
               conditioning_calls(as.formula("~ (1 | herd)")))),
  list(id="glmer-binomial-proportion-weights", kind="glmer",
       fit=list(formula=as.formula("response ~ period + (1 | herd)"), data=cb_prop,
                weights=cb_prop$size, family=binomial(), nAGQ=1),
       calls=list(list(nsim=3, seed=123), list(nsim=3, seed=123, re.form=NULL))),
  list(id="glmer-binomial-expanded-bernoulli", kind="glmer",
       fit=list(formula=as.formula("response ~ period + (1 | herd)"), data=cb_bernoulli,
                family=binomial(), nAGQ=1),
       calls=list(list(nsim=3, seed=123), list(nsim=3, seed=123, re.form=NULL))),
  list(id="glmer-poisson", kind="glmer",
       fit=list(formula=as.formula("TICKS ~ HEIGHT + (1 | BROOD) + (1 | YEAR)"), data=ticks, family=poisson(), nAGQ=1),
       calls=c(list(list(nsim=3, seed=123)),
               conditioning_calls(as.formula("~ (1 | BROOD)")))),
  list(id="glmer-gamma", kind="glmer",
       fit=list(formula=as.formula("strength ~ (1 | batch) + (1 | cask)"), data=pen,
                family=Gamma(link="log"), nAGQ=1),
       calls=c(list(list(nsim=3, seed=123)),
               conditioning_calls(as.formula("~ (1 | batch)")))),
  list(id="glmer-inverse-gaussian", kind="glmer",
       fit=list(formula=as.formula("strength ~ (1 | batch) + (1 | cask)"), data=pen,
                family=inverse.gaussian(link="1/mu^2"), nAGQ=1),
       calls=list(list(nsim=3, seed=123))),
  list(id="glmer-gaussian-log-link", kind="glmer",
       fit=list(formula=as.formula("strength ~ (1 | batch) + (1 | cask)"), data=pen,
                family=gaussian(link="log"), nAGQ=1),
       calls=list(list(nsim=3, seed=123)))
)

rows <- lapply(cases, function(case) {
  fit_result <- capture_raw(function() {
    if (case$kind == "lmer") do.call(lme4::lmer, case$fit) else do.call(lme4::glmer, case$fit)
  })
  if (!is.null(fit_result$error)) {
    return(list(id=case$id, kind=case$kind, fit=fit_record(case$fit), fitResult=list(error=fit_result$error, warnings=fit_result$warnings, messages=fit_result$messages), calls=I(list())))
  }
  fit <- fit_result$value
  calls <- lapply(case$calls, function(call_args) {
    external_seed <- call_args$externalSeed
    call_args$externalSeed <- NULL
    if (!is.null(external_seed)) set.seed(external_seed)
    before <- if (exists(".Random.seed", envir=.GlobalEnv, inherits=FALSE)) .Random.seed else NULL
    result <- capture(function() do.call(stats::simulate, c(list(object=fit), call_args)))
    after <- if (exists(".Random.seed", envir=.GlobalEnv, inherits=FALSE)) .Random.seed else NULL
    list(args=json_value(call_args), externalSeed=external_seed,
         rngBefore=json_value(before), result=result, rngAfter=json_value(after))
  })
  list(id=case$id, kind=case$kind, fit=fit_record(case$fit),
       fitPublic=fit_public_record(fit, case$kind),
       fitWarnings=fit_result$warnings, fitMessages=fit_result$messages, calls=calls)
})

packages <- list(lme4=as.character(packageVersion("lme4")), Matrix=as.character(packageVersion("Matrix")))
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
tj <- function(x) jsonlite::toJSON(x, auto_unbox=TRUE, digits=NA, null="null", na="string")
lines <- c("{", sprintf('  "function": %s,', tj("mixedSimulate")),
           sprintf('  "r_version": %s,', tj(R.version.string)),
           sprintf('  "packages": %s,', tj(packages)), sprintf('  "generated": %s,', tj(stamp)),
           '  "cases": [', paste0("    ", vapply(rows, tj, character(1)),
                                 c(rep(",", length(rows)-1), "")), "  ]", "}")
writeLines(lines, file.path("/out", "mixedSimulate.json"))
cat(sprintf("mixedSimulate: %d cases -> /out/mixedSimulate.json; lme4 %s; Matrix %s\n",
            length(rows), packages$lme4, packages$Matrix))
