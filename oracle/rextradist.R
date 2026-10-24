# oracle-platform: amd64
source("/oracle/_random.R")

# Random numbers of the distributions from extraDistr (fixture rextradist). How extraDistr generates them, which
# determines how many uniforms each draw consumes (from extraDistr's source, checked against R's output):
#   rinvgamma(n, alpha, beta) = 1 / rgamma(n, alpha, rate = beta)
#   rkumar(n, a, b)           = qkumar(1 - u, a, b), u = runif
#   rpareto(n, a, b)          = qpareto(1 - u, a, b)
#   rtriang(n, a, b, c)       = from two uniforms u, v: a + (b - a) ((1 - cc) min(u, v) + cc max(u, v)),
#                               cc = (c - a)/(b - a)
#   rlaplace(n, mu, sigma)    = mu + sigma s e, e = exp_rand() (R's exponential generator, as rexp), then
#                               s = +1 if a following uniform is > 0.5, else -1
# The arcsine distribution is not in extraDistr: its r function has no R reference.

library(extraDistr)

for (s in c(1, 42, 20261024)) {
  rcase(s, list(fn = "rinvgamma", n = 10, alpha = 3, beta = 2), function() rinvgamma(10, 3, 2))
  rcase(s, list(fn = "rinvgamma", n = 10, alpha = 0.5, beta = 1), function() rinvgamma(10, 0.5, 1))
  rcase(s, list(fn = "rkumar", n = 10, a = 2, b = 3), function() rkumar(10, 2, 3))
  rcase(s, list(fn = "rpareto", n = 10, a = 2, b = 1.5), function() rpareto(10, 2, 1.5))
  rcase(s, list(fn = "rtriang", n = 10, a = 0, b = 3, c = 1), function() rtriang(10, 0, 3, 1))
  rcase(s, list(fn = "rtriang", n = 10, a = -1, b = 1, c = 1), function() rtriang(10, -1, 1, 1))
  rcase(s, list(fn = "rlaplace", n = 10, mu = 1, sigma = 2), function() rlaplace(10, 1, 2))
}
rcase(7, list(fn = "rlaplace", n = 3, mu = 0, sigma = -1), function() rlaplace(3, 0, -1))
rcase(7, list(fn = "rpareto", n = 3, a = 0, b = 1), function() rpareto(3, 0, 1))
write_random_fixture("rextradist")
