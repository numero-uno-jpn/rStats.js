# issue: 529
suppressPackageStartupMessages(library(metafor))
suppressPackageStartupMessages(library(metadat))

dat <- dat.colditz1994
rr <- escalc(measure="RR", ai=tpos, bi=tneg, ci=cpos, di=cneg, data=dat)

show_case <- function(label, expression) {
  cat("\nCASE ", label, "\n", sep="")
  warns <- character()
  result <- tryCatch(
    withCallingHandlers(
      expression,
      warning=function(cond) {
        warns <<- c(warns, conditionMessage(cond))
        invokeRestart("muffleWarning")
      }
    ),
    error=function(cond) {
      cat("ERROR: ", conditionMessage(cond), "\n", sep="")
      NULL
    }
  )
  if (!is.null(result)) print(result)
  if (length(warns)) cat("WARNINGS: ", paste(unique(warns), collapse=" | "), "\n", sep="")
}

estimators <- c("EE","FE","DL","HE","HS","HSk","SJ","ML","REML","EB","PM")
for (m in estimators) {
  show_case(paste("method", m), {
    fit <- rma(yi, vi, data=rr, method=m)
    fit
  })
}

for (test_name in c("z","t","knha")) {
  show_case(paste("test", test_name), {
    fit <- rma(yi, vi, data=rr, method="REML", test=test_name)
    fit[c("beta","se","zval","pval","ci.lb","ci.ub","tau2","se.tau2","QE","QEp","I2","H2","k")]
  })
}

for (test_name in c("z","t","knha")) {
  show_case(paste("meta regression", test_name), {
    fit <- rma(yi, vi, data=rr, mods=~ablat, test=test_name)
    fit
  })
}

show_case("meta regression numeric matrix", {
  fit <- rma(yi, vi, data=rr, mods=cbind(ablat, as.numeric(alloc == "random")))
  fit
})

show_case("meta regression prediction newmods", {
  fit <- rma(yi, vi, data=rr, mods=~ablat)
  list(default=predict(fit), newmods=predict(fit, newmods=c(10,30,50)),
       riley=predict(fit, newmods=c(10,30,50), predtype="riley"))
})

for (kind in c("QP","PL")) {
  show_case(paste("confint type", kind), {
    fit <- rma(yi, vi, data=rr, method="REML")
    confint(fit, type=kind)
  })
}

show_case("RD zero cells defaults", {
  escalc(measure="RD", ai=c(0,5,0,0), bi=c(20,15,20,0),
         ci=c(2,4,0,0), di=c(18,16,0,0))[,c("yi","vi")]
})
show_case("RD zero cells add all", {
  escalc(measure="RD", ai=c(0,5,0,0), bi=c(20,15,20,0),
         ci=c(2,4,0,0), di=c(18,16,0,0), add=0.5, to="all") [,c("yi","vi")]
})
show_case("RD drop double zero", {
  escalc(measure="RD", ai=c(0,5,0,0), bi=c(20,15,20,0),
         ci=c(2,4,0,0), di=c(18,16,0,0), drop00=TRUE) [,c("yi","vi")]
})
show_case("ZCOR", {
  escalc(measure="ZCOR", ri=c(0.2,-0.4,0.7), ni=c(30,40,25))[,c("yi","vi")]
})
show_case("ZCOR boundary", {
  escalc(measure="ZCOR", ri=c(1,-1,1.2), ni=c(30,40,25))[,c("yi","vi")]
})
