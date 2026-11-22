# issue: 545
# regression18-glmnet-cv-stop.R: R strict CV refits approach the optimum only at thresh 1e-20; the path ends when dev.ratio grows by less than fdev * dev.ratio (1.8.0)
suppressMessages(library(glmnet))
X<-matrix(c(-2,1,0,2,-1,3,1,-3,2,0,4,-2, 1,0,2,-1,3,-2,2,1,-3,4,0,-1, 2,-1,1,0,-2,3,-3,2,1,-1,4,0),12,3)
y<-c(4,2,5,1,7,0,6,3,8,2,9,1); foldid<-rep(1:3,4)
for (th in c(1e-14, 1e-16, 1e-20)) { ft <- cv.glmnet(X,y,foldid=foldid,nlambda=8,control=list(thresh=th,maxit=1e8)); cat(th, format(ft$cvm[1:3], digits=17), "\n") }
f <- glmnet(X, y, nlambda = 8, control = list(thresh = 1e-20, maxit = 1e8)); cat(length(f$lambda), format(f$dev.ratio, digits = 17), "\n")
f2 <- glmnet(X, y, nlambda = 8, lambda = glmnet(X, y, nlambda = 50)$lambda[1:8]); cat(length(f2$lambda), "\n")
