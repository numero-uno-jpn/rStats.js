# oracle-platform: amd64
# issue: 545
# Quantile regression oracle. Only documented public calls and documented fit components are used.
suppressMessages(library(quantreg))
library(jsonlite)

run <- function(expr) {
  warns <- character(0)
  msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) {
      warns <<- c(warns, conditionMessage(w))
      invokeRestart("muffleWarning")
    },
    message = function(m) {
      msgs <<- c(msgs, conditionMessage(m))
      invokeRestart("muffleMessage")
    }
  )
  if (inherits(value, "caught")) {
    return(list(error = value$message, warnings = warns, messages = msgs))
  }
  list(value = value, warnings = warns, messages = msgs)
}

tab <- function(x) {
  z <- as.matrix(x)
  list(rows = rownames(z), cols = colnames(z), values = unname(z))
}

data.frame.rq <- data.frame(
  x = c(-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
  y = c(2, 1, 4, 2, 5, 3, 8, 5, 9, 7, 11, 8, 14, 10, 15, 13)
)
X <- model.matrix(y ~ x, data.frame.rq)
n <- nrow(data.frame.rq)
d <- data.frame.rq
out <- list()
out$data <- list(X = tab(X), y = data.frame.rq$y)
out$bandwidth <- list(
  hs = sapply(c(.25, .5, .75), function(t) bandwidth.rq(t, n, hs = TRUE)),
  bofinger = sapply(c(.25, .5, .75), function(t) bandwidth.rq(t, n, hs = FALSE))
)

for (tau in c(.25, .5, .75)) {
  for (method in c("br", "fn")) {
    key <- paste(method, tau, sep = "_")
    out[[key]] <- run({
      fit <- rq(y ~ x, data = data.frame.rq, tau = tau, method = method)
      tight <- if (method == "fn") {
        rq(y ~ x, data = data.frame.rq, tau = tau, method = method, eps = 1e-12)
      } else {
        fit
      }
      list(
        coef = unname(coef(fit)),
        rho = unname(fit$rho),
        residuals = unname(residuals(fit)),
        tightCoef = unname(coef(tight)),
        tightRho = unname(tight$rho)
      )
    })
  }
}

out$engel_br_fn <- run({
  data(engel)
  ans <- list()
  for (method in c("br", "fn")) {
    fit <- rq(foodexp ~ income, data = engel, tau = .5, method = method)
    tight <- if (method == "fn") {
      rq(foodexp ~ income, data = engel, tau = .5, method = method, eps = 1e-12)
    } else {
      fit
    }
    ans[[method]] <- list(
      coef = unname(coef(fit)),
      rho = unname(fit$rho),
      residuals = unname(residuals(fit)),
      tightCoef = unname(coef(tight)),
      tightRho = unname(tight$rho)
    )
  }
  ans
})

out$nonunique <- run({
  data <- data.frame(x = 1:6, y = c(2, 1, 4, 3, 6, 5))
  list(
    br = list(coef = unname(coef(rq(y ~ x, data = data, tau = .5, method = "br"))),
              rho = unname(rq(y ~ x, data = data, tau = .5, method = "br")$rho)),
    fn = list(coef = unname(coef(rq(y ~ x, data = data, tau = .5, method = "fn"))),
              rho = unname(rq(y ~ x, data = data, tau = .5, method = "fn")$rho))
  )
})

out$exact_fit <- run({
  data <- data.frame(x = 1:10, y = 2 + 3 * (1:10))
  fit <- rq(y ~ x, data = data, tau = .5)
  list(coef = unname(coef(fit)), rho = unname(fit$rho),
       residuals = unname(residuals(fit)),
       summary = run(tab(coef(summary(fit, se = "rank")))),
       iid = run(tab(coef(summary(fit, se = "iid")))),
       nid = run(tab(coef(summary(fit, se = "nid")))),
       ker = run(tab(coef(summary(fit, se = "ker")))))
})

out$collinear <- run({
  data <- data.frame(x1 = 1:8, x2 = 2 * (1:8), y = c(3, 1, 4, 1, 5, 9, 2, 6))
  rq(y ~ x1 + x2, data = data, tau = .5)
})

out$na_rows <- run({
  data <- data.frame(x = c(1:9, NA), y = c(3, 1, 4, 1, 5, NA, 2, 6, 5, 3))
  fit <- rq(y ~ x, data = data, tau = .5)
  list(coef = unname(coef(fit)), rho = unname(fit$rho),
       residuals = unname(residuals(fit)), fitted = unname(fitted(fit)))
})

# R returns its quantile process (class rq.process, not JSON-encodable) for tau outside (0, 1); rStats.js errors
# (choices 3), so only the class is recorded
out$tau_out_of_range <- run({
  data(engel)
  class(rq(foodexp ~ income, data = engel, tau = 1.5))
})

out$zero_weights <- run({
  data <- data.frame(x = 0:5, y = c(0, 1, 2, 3, 100, 200))
  weights <- c(1, 1, 1, 1, 0, 0)
  fit <- rq(y ~ x, data = data, tau = .5, weights = weights)
  list(coef = unname(coef(fit)), rho = unname(fit$rho),
       residuals = unname(residuals(fit)), fitted = unname(fitted(fit)))
})

out$summary_se_warnings <- run({
  data(stackloss)
  fit <- rq(stack.loss ~ ., data = stackloss, tau = .5)
  ans <- list()
  for (seMethod in c("rank", "iid", "nid", "ker", "boot")) {
    ans[[seMethod]] <- run({
      # the coefficient table and (when there is one) the covariance: a summary.rq object is not JSON-encodable
      s <- if (seMethod == "boot") {
        set.seed(1)
        summary(fit, se = seMethod, R = 40)
      } else {
        summary(fit, se = seMethod, covariance = TRUE)
      }
      list(coefficients = list(rows = rownames(coef(s)), cols = colnames(coef(s)), values = unname(coef(s))),
           cov = if (is.null(s$cov)) NULL else unname(s$cov))
    })
  }
  ans
})

out$bootstrap <- list()
for (method in c("xy", "pwy", "mcmb", "wxy")) {
  out$bootstrap[[method]] <- run({
    data(engel)
    set.seed(1)
    fit <- rq(foodexp ~ income, data = engel, tau = .5)
    summaryFit <- summary(fit, se = "boot", bsmethod = method, R = 200)
    list(summary = tab(coef(summaryFit)), bootstrapCoefficients = unname(summaryFit$B))
  })
}

# Restored coverage from the a183864d oracle; retain these cases alongside the stage-2 additions.
out$defaultSEswitch<-run({
 ans<-list()
 for(n0 in c(1000,1001)){
  xx<-sin(seq_len(n0)*.17); yy<-1+2*xx+cos(seq_len(n0)*.31)
  ff<-rq(yy~xx,tau=.5)
  ans[[as.character(n0)]]<-list(default=tab(coef(summary(ff))),
    rank=tab(coef(summary(ff,se="rank"))),nid=tab(coef(summary(ff,se="nid"))))
 }
 ans
})
out$stacklossNid<-run({
 data(stackloss)
 f<-rq(stack.loss~.,data=stackloss,tau=.5,weights=rep(c(1,2,3),length.out=nrow(stackloss)))
 s<-summary(f,se="nid")
 list(coef=tab(coef(s)))
})
out$weighted<-run({w<-seq(.5,2,length.out=n);f<-rq(y~x,data=d,tau=.5,weights=w);list(weights=w,coef=unname(coef(f)),rho=unname(f$rho),residuals=unname(residuals(f)),nid=tab(coef(summary(f,se="nid"))))})
out$rankTests<-run({f<-rq(y~x,data=d,tau=.5);list(rank=tab(coef(summary(f,se="rank",alpha=.1))),rank95=tab(coef(summary(f,se="rank",alpha=.05))))})
out$multiTau<-run({f<-rq(y~x,data=d,tau=c(.25,.5,.75));list(coef=tab(coef(f)),joint=tab(anova(f)$table),separate=tab(anova(f,joint=FALSE)$table))})
out$engelPredict<-run({
 data(engel)
 f<-rq(foodexp~income,data=engel,tau=.5)
 nd<-data.frame(income=c(500,1000,2500))
 s<-summary(f,se="nid",covariance=TRUE)
 list(data=list(income=unname(engel$income),foodexp=unname(engel$foodexp)),coef=unname(coef(f)),cov=tab(s$cov),prediction=unname(predict(f,newdata=nd)),
      ciNone=tab(predict(f,newdata=nd,interval="confidence",se="nid",type="none")),
      ciDirect=tab(predict(f,newdata=nd,interval="confidence",type="direct")),
      ciPercentile=tab(predict(f,newdata=nd,interval="confidence",type="percentile",se="boot",R=40)))
})
out$multiTauTwoPredictors<-run({
 d2<-data.frame(x=seq(-2,2,length.out=60),z=sin(seq_len(60)*.3))
 d2$y<-1+1.2*d2$x-.6*d2$z+sin(seq_len(60)*.7)*.4
 f<-rq(y~x+z,data=d2,tau=c(.25,.5,.75))
 list(data=list(x=unname(d2$x),z=unname(d2$z),y=unname(d2$y)),coef=tab(coef(f)),joint=tab(anova(f,joint=TRUE)$table),separate=tab(anova(f,joint=FALSE)$table))
})

writeLines(
  toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
  file.path("/out", "rq.json")
)
