# issue: 560
# Independent supplementary-column and cacoord scaling checks.
library(ca)
library(jsonlite)
fit <- ca(smoke)
sv <- as.numeric(fit$sv)
rs <- as.matrix(fit$rowcoord); cs <- as.matrix(fit$colcoord)
rp <- sweep(rs,2,sv,"*"); cp <- sweep(cs,2,sv,"*")
sqrt_s <- sqrt(sv)
mass_r <- as.numeric(fit$rowmass); mass_c <- as.numeric(fit$colmass)
mk <- function(x,scale) sweep(x,2,scale,"*")
coord <- function(type) {
  rr <- rs; cc <- cs
  if(type=="principal") { rr<-rp; cc<-cp }
  if(type=="symmetric" || type=="symbiplot") { rr<-mk(rs,sqrt_s); cc<-mk(cs,sqrt_s) }
  if(type=="rowprincipal") rr<-rp
  if(type=="colprincipal") cc<-cp
  if(type=="rowgab") cc<-sweep(cs,1,mass_c,"*")
  if(type=="rowgreen") cc<-sweep(cs,1,sqrt(mass_c),"*")
  if(type=="colgab") rr<-sweep(rs,1,mass_r,"*")
  if(type=="colgreen") rr<-sweep(rs,1,sqrt(mass_r),"*")
  list(rows=rr,cols=cc)
}
types <- c("standard","principal","symmetric","rowprincipal","colprincipal","symbiplot","rowgab","colgab","rowgreen","colgreen")
public <- lapply(types,function(t) cacoord(fit,type=t))
names(public) <- types
# A supplementary column is the transpose of a supplementary row projection.
# Column 1 is excluded; project its row profile onto active row coordinates.
supfit <- ca(smoke,supcol=1)
active <- ca(smoke[,-1,drop=FALSE])
q <- as.numeric(smoke[,1])/sum(as.numeric(smoke[,1]))
pred <- as.numeric(t(q) %*% as.matrix(active$rowcoord)) / as.numeric(active$sv)
out <- list(sv=sv,rowcoord=rs,colcoord=cs,rowmass=mass_r,colmass=mass_c,
  cacoord_public=public,cacoord_formula=lapply(types,coord),
  supcol_public=as.matrix(supfit$colcoord),
  supcol_active_rows=as.matrix(active$rowcoord),supcol_active_sv=as.numeric(active$sv),
  supcol_profile=q,supcol_formula=pred)
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
