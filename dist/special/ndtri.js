// Ported from xsf include/xsf/cephes/ndtri.h and include/xsf/ndtri_exp.h (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// ndtri_exp: Copyright Albert Steppi.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
import { p1evl, polevl } from "./polevl.js";
/* approximation for 0 <= |y - 0.5| <= 3/8 */
const P0 = [
    -5.99633501014107895267e1, 9.80010754185999661536e1, -5.66762857469070293439e1,
    1.39312609387279679503e1, -1.23916583867381258016e0,
];
const Q0 = [
    1.95448858338141759834e0, 4.67627912898881538453e0, 8.63602421390890590575e1,
    -2.25462687854119370527e2, 2.00260212380060660359e2, -8.20372256168333339912e1,
    1.59056225126211695515e1, -1.18331621121330003142e0,
];
/* z = sqrt(-2 log y) between 2 and 8, i.e. y between exp(-2) and exp(-32) */
const P1 = [
    4.05544892305962419923e0, 3.15251094599893866154e1, 5.71628192246421288162e1,
    4.40805073893200834700e1, 1.46849561928858024014e1, 2.18663306850790267539e0,
    -1.40256079171354495875e-1, -3.50424626827848203418e-2, -8.57456785154685413611e-4,
];
const Q1 = [
    1.57799883256466749731e1, 4.53907635128879210584e1, 4.13172038254672030440e1,
    1.50425385692907503408e1, 2.50464946208309415979e0, -1.42182922854787788574e-1,
    -3.80806407691578277194e-2, -9.33259480895457427372e-4,
];
/* z = sqrt(-2 log y) between 8 and 64, i.e. y between exp(-32) and exp(-2048) */
const P2 = [
    3.23774891776946035970e0, 6.91522889068984211695e0, 3.93881025292474443415e0,
    1.33303460815807542389e0, 2.01485389549179081538e-1, 1.23716634817820021358e-2,
    3.01581553508235416007e-4, 2.65806974686737550832e-6, 6.23974539184983293730e-9,
];
const Q2 = [
    6.02427039364742014255e0, 3.67983563856160859403e0, 1.37702099489081330271e0,
    2.16236993594496635890e-1, 1.34204006088543189037e-2, 3.28014464682127739104e-4,
    2.89247864745380683936e-6, 6.79019408009981274425e-9,
];
const EXP_M2 = 0.13533528323661269189; // exp(-2)
const SQRT2PI = 2.506628274631000502415765284811045253007;
/** x (absolute value on the < 0 side) from z = sqrt(-2 log y) by the tail approximation */
function tailFromZ(x) {
    const x0 = x - Math.log(x) / x;
    const z = 1 / x;
    const x1 = x < 8 ? (z * polevl(z, P1)) / p1evl(z, Q1) : (z * polevl(z, P2)) / p1evl(z, Q2);
    return x0 - x1;
}
/** Inverse of the standard normal distribution function. */
export function ndtri(y0) {
    if (y0 === 0)
        return -Infinity;
    if (y0 === 1)
        return Infinity;
    if (!(y0 >= 0 && y0 <= 1))
        return NaN;
    let y = y0;
    let negate = true;
    if (y > 1 - EXP_M2) {
        y = 1 - y;
        negate = false;
    }
    if (y > EXP_M2) {
        y = y - 0.5;
        const y2 = y * y;
        const x = y + y * ((y2 * polevl(y2, P0)) / p1evl(y2, Q0));
        return x * SQRT2PI;
    }
    const x = tailFromZ(Math.sqrt(-2 * Math.log(y)));
    return negate ? -x : x;
}
/** ndtri taking log(p). Computes ndtriExp(y) = ndtri(exp(y)) without overflow in exp. */
export function ndtriExp(y) {
    if (y < -Number.MAX_VALUE)
        return -Infinity;
    if (y < -2) {
        // sqrt(-2y) overflows for y < -DBL_MAX/2
        const x = y >= -Number.MAX_VALUE * 0.5 ? Math.sqrt(-2 * y) : Math.SQRT2 * Math.sqrt(-y);
        return -tailFromZ(x);
    }
    if (y > -0.14541345786885906)
        return -ndtri(-Math.expm1(y)); // log1p(-exp(-2))
    return ndtri(Math.exp(y));
}
