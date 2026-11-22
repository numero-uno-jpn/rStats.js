# issue: 549
# multivariate19-stage1-check-local.R: ChatGPT's multivariate19-stage1-check.R with the variables ranks and page renamed (both names
# are refused by scripts/r-experiment-check.mjs), plus the T2' df candidates; run by Claude on the experiment image
# Independent formula checks from public R functions and base linear algebra only.
library(PMCMRplus); library(MASS); library(jsonlite)
tab <- function(x) list(rows=rownames(x), cols=colnames(x), values=unname(as.matrix(x)))
## Page: direct within-block rk and the published null moments.
m <- matrix(c(3.4,4.1,4.8,5.0, 2.9,3.0,3.8,4.4, 3.1,3.9,3.7,4.9,
              2.5,3.6,4.0,4.1, 3.0,2.8,4.5,4.6), nrow=5, byrow=TRUE)
rk <- t(apply(m,1,rank)); k <- ncol(m); n <- nrow(m)
Rj <- colSums(rk); L <- sum(seq_len(k)*Rj)
EL <- n*k*(k+1)^2/4; VL <- n*k^2*(k-1)*(k+1)^2/144
z <- (L-EL-0.5*sign(L-EL))/sqrt(VL)
pg <- pageTest(m)
## T2: independently compute means, unbiased variances, Welch df, t and Sidak from PlantGrowth.
d <- split(PlantGrowth$weight, PlantGrowth$group); pairs <- combn(names(d),2)
t2rows <- lapply(seq_len(ncol(pairs)), function(i) {
 a<-d[[pairs[1,i]]]; b<-d[[pairs[2,i]]]
 va<-var(a)/length(a); vb<-var(b)/length(b)
 tt<-(mean(a)-mean(b))/sqrt(va+vb)
 nu<-(va+vb)^2/(va^2/(length(a)-1)+vb^2/(length(b)-1))
 p0<-2*pt(-abs(tt),df=nu); c(t=tt,df=nu,p0=p0,pSidak=1-(1-p0)^(length(d)*(length(d)-1)/2))
})
## MANOVA: derive H/E from fitted group means and residuals; compare eigen-root statistics.
Y <- as.matrix(iris[,1:4]); g <- iris$Species
fit <- lm(Y ~ g)
Fv <- fitted(fit); Er <- residuals(fit)
H <- crossprod(Fv - matrix(colMeans(Y), nrow(Y), ncol(Y), byrow=TRUE))
E <- crossprod(Er)
lam <- Re(eigen(solve(E,H), only.values=TRUE)$values); lam <- sort(lam[lam>1e-10], decreasing=TRUE)
mv <- manova(Y ~ g, data=iris)
sm <- summary(mv, test="Pillai")$stats
pillai <- sum(lam/(1+lam))
## LDA: class means, pooled within covariance, and generalized roots.
X <- as.matrix(iris[,1:4]); lev <- levels(g); means <- t(vapply(lev,function(a) colMeans(X[g==a,,drop=FALSE]),numeric(ncol(X))))
W <- matrix(0,ncol(X),ncol(X)); B <- W
for(a in lev){z0<-sweep(X[g==a,,drop=FALSE],2,means[a,],"-"); W<-W+crossprod(z0)
 d0<-means[a,]-colMeans(X); B<-B+sum(g==a)*tcrossprod(d0)}
lda_fit <- lda(X,g); lda_eigen <- Re(eigen(solve(W,B),only.values=TRUE)$values); lda_eigen <- sort(lda_eigen[lda_eigen>1e-10],decreasing=TRUE)
## CANCor: canonical roots from cross-product matrices.
xc <- scale(as.matrix(LifeCycleSavings[,2:3]),center=TRUE,scale=FALSE)
yc <- scale(as.matrix(LifeCycleSavings[,-(2:3)]),center=TRUE,scale=FALSE)
Sxx<-crossprod(xc); Syy<-crossprod(yc); Sxy<-crossprod(xc,yc)
ccroots <- Re(eigen(solve(Sxx,Sxy)%*%solve(Syy,t(Sxy)),only.values=TRUE)$values)
cc <- cancor(LifeCycleSavings[,2:3],LifeCycleSavings[,-(2:3)])
out <- list(pg=list(L=L, E=EL, V=VL, z=z, reference=pg$statistic, estimate=pg$estimate),
 t2=do.call(rbind,t2rows), manova=list(eigenvalues=lam, pillai=pillai, reference=sm),
 lda=list(generalized_roots=lda_eigen, scaling=tab(lda_fit$scaling), svd=lda_fit$svd),
 cancor=list(eigen_roots=ccroots, correlations=cc$cor))
## T2': candidate dfs with the same t and Sidak (PlantGrowth has equal sizes; chickwts does not)
t2p <- function(d) lapply(combn(names(d), 2, simplify = FALSE), function(pr) {
  a <- d[[pr[1]]]; b <- d[[pr[2]]]; na <- length(a); nb <- length(b); m <- length(d) * (length(d) - 1) / 2
  tt <- (mean(a) - mean(b)) / sqrt(var(a) / na + var(b) / nb); N <- sum(lengths(d)); k <- length(d)
  sid <- function(df) 1 - (1 - 2 * pt(-abs(tt), df))^m
  list(pair = pr, nanb2 = sid(na + nb - 2), Nk = sid(N - k), N2 = sid(N - 2))
})
out$t2prime <- list(PlantGrowth = t2p(split(PlantGrowth$weight, PlantGrowth$group)),
                    chickwts = t2p(split(chickwts$weight, chickwts$feed)))
cat(toJSON(out, digits = NA, auto_unbox = TRUE, na = "string"))
