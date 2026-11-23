# issue: 560
# Supplementary-column projection and all cacoord maps checked against direct formulas.
library(ca)
library(jsonlite)
fit<-ca(smoke);sv<-as.numeric(fit$sv);rs<-as.matrix(fit$rowcoord);cs<-as.matrix(fit$colcoord)
rp<-sweep(rs,2,sv,"*");cp<-sweep(cs,2,sv,"*");ss<-sqrt(sv)
mr<-as.numeric(fit$rowmass);mc<-as.numeric(fit$colmass)
coord<-function(type){
 rr<-rs;cc<-cs
 if(type%in%c("principal","symmetric")){rr<-rp;cc<-cp}
 if(type=="rowprincipal")rr<-rp
 if(type=="colprincipal")cc<-cp
 if(type=="symbiplot"){rr<-sweep(rs,2,ss,"*");cc<-sweep(cs,2,ss,"*")}
 if(type=="rowgab"){rr<-rp;cc<-sweep(cs,1,mc,"*")}
 if(type=="rowgreen"){rr<-rp;cc<-sweep(cs,1,sqrt(mc),"*")}
 if(type=="colgab"){rr<-sweep(rs,1,mr,"*");cc<-cp}
 if(type=="colgreen"){rr<-sweep(rs,1,sqrt(mr),"*");cc<-cp}
 list(rows=rr,cols=cc)
}
types<-c("standard","principal","symmetric","rowprincipal","colprincipal","symbiplot","rowgab","rowgreen","colgab","colgreen")
public<-lapply(types,function(t)cacoord(fit,type=t));names(public)<-types
active<-ca(smoke[,-1,drop=FALSE]);supfit<-ca(smoke,supcol=1)
q<-as.numeric(smoke[,1])/sum(as.numeric(smoke[,1]))
pred<-as.numeric(t(q)%*%as.matrix(active$rowcoord))/as.numeric(active$sv)
out<-list(sv=sv,rowcoord=rs,colcoord=cs,rowmass=mr,colmass=mc,
 cacoord_public=public,cacoord_formula=lapply(types,coord),
 supcol_public=as.matrix(supfit$colcoord),supcol_formula=pred)
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
