/**
 * (x/2)^v / Gamma(v + 1) * sum, the leading factor of the power series of I_v and J_v times the series sum.
 * For v >= 10 the factor is Loader's Poisson term dpois(v; x/2) e^(x/2), which is accurate where pow / gamma loses
 * 1e-14 (v = 32) and exp(v log(x/2) - lgamma(v + 1)) loses 7e-14 (v = 500). When the factor or the result is
 * subnormal the logs are combined and exp taken once, so that a subnormal result is not built from a subnormal
 * factor (the log of a value near 1e-308 carries an absolute error of 700 ε, which a subnormal result can afford)
 */
export declare function seriesTimesPrefix(v: number, x: number, sum: number): number;
