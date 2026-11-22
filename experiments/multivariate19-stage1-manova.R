# issue: 549
# Independent MANOVA SSP, generalized-root and F-approximation checks.
# Uses public R modeling functions and base linear algebra only.
library(jsonlite)
maxdiff <- function(a,b) {
 if(length(a)!=length(b)) return(Inf)
 if(!length(a)) return(0)
 max(abs(as.numeric(a)-as.numeric(b)),na.rm=TRUE)
}
tab <- function(a) list(rows=rownames(a),cols=colnames(a),values=unname(as.matrix(a)))
one_fit <- function(formula,data,with_intercept=FALSE,tol=1e-7) {
 fit_formula <- stats::manova(formula,data=data,tol=tol)
 sum0 <- summary(fit_formula,intercept=with_intercept)
 tests <- c("Pillai","Wilks","Hotelling-Lawley","Roy")
 full_mf <- model.frame(formula,data=data,na.action=na.omit)
 yy0 <- as.matrix(model.response(full_mf))
 scale_y <- apply(abs(yy0),2,max); scale_y[scale_y==0] <- 1
 yy <- sweep(yy0,2,scale_y,"/")
 tt <- terms(formula)
 xx <- model.matrix(tt,full_mf)
 aa <- attr(xx,"assign")
 labs <- attr(tt,"term.labels")
 qfull <- qr(xx)
 err <- crossprod(qr.resid(qfull,yy))
 p <- ncol(yy); v <- nrow(yy)-qfull$rank
 if(with_intercept) {
  base_fit <- matrix(0,nrow(yy),p); prev_rank <- 0L; first <- 0L
 } else {
  xbase <- xx[,aa==0L,drop=FALSE]
  qbase <- qr(xbase)
  base_fit <- qr.fitted(qbase,yy); prev_rank <- qbase$rank; first <- 1L
 }
 calc_rows <- list()
 hdiff <- list()
 eigdiff <- list()
 for(j in first:length(labs)) {
   take <- if(j==0L) aa==0L else aa<=j
   xxj <- xx[,take,drop=FALSE]
   qj <- qr(xxj)
   cur_fit <- qr.fitted(qj,yy)
   hmat <- crossprod(cur_fit-base_fit)
   qterm <- qj$rank-prev_rank
   term_name <- if(j==0L) "(Intercept)" else labs[j]
   if(qterm<=0L || is.null(sum0$SS[[term_name]])) {
    base_fit <- cur_fit; prev_rank <- qj$rank; next
   }
   ev <- eigen(solve(err,hmat),only.values=TRUE)$values
   roots <- sort(Re(ev[Re(ev)>1e-10]),decreasing=TRUE)
   ss <- sum(roots); ww <- prod(1/(1+roots)); hh <- sum(roots); rr <- if(length(roots)) max(roots) else 0
   s <- min(p,qterm); mm <- (abs(p-qterm)-1)/2; nn <- (v-p-1)/2
   vv <- c(Pillai=sum(roots/(1+roots)),Wilks=ww,Hotelling.Lawley=hh,Roy=rr)
   if(s>0) {
    d1p <- s*(2*mm+s+1); d2p <- s*(2*nn+s+1)
    fp <- ((2*nn+s+1)/(2*mm+s+1))*vv["Pillai"]/(s-vv["Pillai"])
    d1w <- p*qterm
    tw <- if(p*qterm==2) 1 else sqrt((p^2*qterm^2-4)/(p^2+qterm^2-5))
    uw <- (p*qterm-2)/4
    d2w <- (v-(p-qterm+1)/2)*tw-2*uw
    fw <- ((1-vv["Wilks"]^(1/tw))/vv["Wilks"]^(1/tw))*(d2w/d1w)
    d1h <- s*(2*mm+s+1); d2h <- 2*(s*nn+1)
    fh <- (d2h/(d1h*s))*vv["Hotelling.Lawley"]
    d1r <- max(p,qterm); d2r <- v-max(p,qterm)+qterm
    fr <- (d2r/d1r)*vv["Roy"]
    pred <- rbind(Pillai=c(fp,d1p,d2p,pf(fp,d1p,d2p,lower.tail=FALSE)),
                  Wilks=c(fw,d1w,d2w,pf(fw,d1w,d2w,lower.tail=FALSE)),
                  Hotelling.Lawley=c(fh,d1h,d2h,pf(fh,d1h,d2h,lower.tail=FALSE)),
                  Roy=c(fr,d1r,d2r,pf(fr,d1r,d2r,lower.tail=FALSE)))
   } else pred <- matrix(NA_real_,4,4)
   ref <- lapply(tests,function(t) summary(fit_formula,test=t,intercept=with_intercept)$stats)
   names(ref)<-tests
   row_idx <- match(term_name,rownames(ref[[1]]))
   observed <- t(vapply(tests,function(t) as.numeric(ref[[t]][row_idx,3:6]),numeric(4)))
   rownames(observed)<-tests
   ssref <- sum0$SS[[term_name]]
   hmat_raw <- hmat * outer(scale_y,scale_y)
   eigref <- sum0$Eigenvalues[term_name,,drop=FALSE]
   calc_rows[[term_name]] <- list(q=qterm,roots=roots,statistics=vv,
     predicted=pred,observed=observed,
     max_F_abs=maxdiff(pred[,1],observed[,1]),
     max_df_abs=maxdiff(pred[,2:3],observed[,2:3]),
     max_p_abs=maxdiff(pred[,4],observed[,4]))
   hdiff[[term_name]] <- maxdiff(hmat_raw,ssref)
   eigdiff[[term_name]] <- maxdiff(roots,as.numeric(eigref)[seq_along(roots)])
   base_fit <- cur_fit
   prev_rank <- qj$rank
 }
 list(rows=calc_rows,SS_max_abs=hdiff,Eigen_max_abs=eigdiff,
      residual_df=v,residual_SSP=tab(err*outer(scale_y,scale_y)),SSP_rank=qr(err)$rank,
      reference=lapply(tests,function(t) {
       z<-summary(fit_formula,test=t,intercept=with_intercept)$stats
       list(rows=rownames(z),cols=colnames(z),values=unname(z))
      }) |> setNames(tests),
      reference_SS=lapply(sum0$SS,tab),
      reference_Eigen=tab(sum0$Eigenvalues))
}
mt <- transform(mtcars,cyl=factor(cyl),am=factor(am),gear=factor(gear))
cases <- list(
 iris=list(f=cbind(Sepal.Length,Sepal.Width,Petal.Length,Petal.Width)~Species,d=iris),
 iris_intercept=list(f=cbind(Sepal.Length,Sepal.Width,Petal.Length,Petal.Width)~Species,d=iris,i=TRUE),
 two_factors=list(f=cbind(mpg,disp,hp)~cyl+am,d=mt),
 two_factors_reversed=list(f=cbind(mpg,disp,hp)~am+cyl,d=mt),
 interaction=list(f=cbind(mpg,qsec)~am*gear,d=mt),
 covariate=list(f=cbind(mpg,disp,hp)~wt+cyl,d=mt),
 two_responses_two_groups=list(f=cbind(mpg,hp)~am,d=mt),
 p_gt_df=list(f=cbind(mpg,disp,hp,drat,wt)~am,d=mt),
 na=list(f=cbind(mpg,disp,hp)~cyl,d=transform(mt,mpg=replace(mpg,3,NA))),
 tol=list(f=cbind(mpg,disp,hp)~cyl,d=mt,t=.5),
 scale=list(f=cbind(mpg*1e100,disp,hp*1e-100)~cyl,d=mt),
 npk=list(f=cbind(yield,as.numeric(block))~N*P,d=npk),
 one_response=list(f=cbind(mpg)~cyl,d=mt),
 few_df=list(f=cbind(mpg,disp,hp,drat,wt,qsec)~cyl,d=mt[1:8,]),
 collinear=list(f=cbind(mpg,disp,I(mpg+disp))~cyl,d=mt))
results <- lapply(cases,function(z) tryCatch(one_fit(z$f,z$d,isTRUE(z$i),if(is.null(z$t)) 1e-7 else z$t),
 error=function(e) list(error=conditionMessage(e))))
cat(toJSON(results,digits=NA,auto_unbox=TRUE,na="string",null="null"))
