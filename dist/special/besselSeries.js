// The power-series prefix shared by the Bessel functions I and J (besselIK.ts, besselJY.ts).
import { gamma } from "./gamma.js";
import { dpoisRaw } from "./loader.js";
const DBL_MIN = 2.2250738585072014e-308;
/**
 * (x/2)^v / Gamma(v + 1) * sum, the leading factor of the power series of I_v and J_v times the series sum.
 * For v >= 10 the factor is Loader's Poisson term dpois(v; x/2) e^(x/2), which is accurate where pow / gamma loses
 * 1e-14 (v = 32) and exp(v log(x/2) - lgamma(v + 1)) loses 7e-14 (v = 500). When the factor or the result is
 * subnormal the logs are combined and exp taken once, so that a subnormal result is not built from a subnormal
 * factor (the log of a value near 1e-308 carries an absolute error of 700 ε, which a subnormal result can afford)
 */
export function seriesTimesPrefix(v, x, sum) {
    if (v < 10)
        return (Math.pow(x / 2, v) / gamma(v + 1)) * sum;
    const lambda = x / 2;
    const d = dpoisRaw(v, lambda, false);
    if (d >= DBL_MIN && lambda < 700) {
        const r = d * Math.exp(lambda) * sum;
        if (Math.abs(r) >= DBL_MIN)
            return r;
    }
    const ld = dpoisRaw(v, lambda, true) + lambda + Math.log(Math.abs(sum));
    return Math.sign(sum) * Math.exp(ld);
}
