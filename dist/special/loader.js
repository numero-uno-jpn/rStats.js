// Building blocks for computing binomial and Poisson probabilities (densities) without cancellation.
//
// The method follows Catherine Loader (2000) "Fast and Accurate Computation of Binomial
// Probabilities". b(x; n, p) is split into the form
//   exp(-[difference of stirlerr(n)] - bd0(x, np) - bd0(n-x, nq)) / sqrt(2 pi x (n-x) / n)
// and the error term of Stirling's approximation, stirlerr, and the deviance bd0(x, M) = x log(x/M) + M - x
// are each computed without cancellation.
// Written from the formulas in the paper. The table of stirlerr at half-integers was computed with Rmpfr (256 bits).
import { LS2PI } from "./constants.js";
import { lgamma1p } from "./gamma.js";
import { ddAdd, ddDiv, ddDivNum, ddLog, ddMul, ddMulNum, ddNeg, ddSub, isDoubleDouble, SPLITTER, twoSum } from "./dd.js";
const DBL_MIN = 2.2250738585072014e-308;
const LN_2PI = 1.837877066409345483560659472811;
/* stirlerr(k/2), k = 1..30 */
const STIRLERR_HALVES = [
    0.15342640972002736, 0.081061466795327261, 0.054814121051917651, 0.041340695955409297,
    0.033162873519936291, 0.027677925684998338, 0.023746163656297496, 0.020790672103765093,
    0.018488450532673187, 0.016644691189821193, 0.015134973221917378, 0.013876128823070748,
    0.012810465242920227, 0.01189670994589177, 0.011104559758206917, 0.010411265261972096,
    0.0097994161261588039, 0.0092554621827127329, 0.0087687001341393862, 0.0083305634333628708,
    0.0079341145643140199, 0.0075736754879518406, 0.007244554301320383, 0.0069428401072095299,
    0.0066652470327076821, 0.0064089941880042071, 0.0061717122630394576, 0.0059513701127588475,
    0.0057462165130101155, 0.0055547335519628011,
];
/* Stirling series coefficients B_{2k} / (2k (2k-1)) */
const S0 = 1 / 12;
const S1 = 1 / 360;
const S2 = 1 / 1260;
const S3 = 1 / 1680;
const S4 = 1 / 1188;
const S5 = 691 / 360360;
const S6 = 1 / 156;
/** Stirling series for n > 15 */
function stirlerrSeries(n) {
    const nn = 1 / (n * n);
    if (n > 500)
        return (S0 - S1 * nn) / n;
    if (n > 80)
        return (S0 - (S1 - S2 * nn) * nn) / n;
    if (n > 35)
        return (S0 - (S1 - (S2 - S3 * nn) * nn) * nn) / n;
    return (S0 - (S1 - (S2 - (S3 - (S4 - (S5 - S6 * nn) * nn) * nn) * nn) * nn) * nn) / n;
}
/**
 * Error of Stirling's approximation, stirlerr(n) = log(n!) - log(sqrt(2 pi n) (n/e)^n).
 * It enters the exponent of probabilities, so the absolute (not relative) error must be kept small.
 */
export function stirlerr(n) {
    if (n > 15)
        return stirlerrSeries(n);
    const k = 2 * n;
    if (k === Math.floor(k) && k >= 1)
        return STIRLERR_HALVES[k - 1];
    if (n < 1)
        return lgamma1p(n) - (n + 0.5) * Math.log(n) + n - LS2PI;
    // Push above 15 with stirlerr(m) = stirlerr(m + 1) + (m + 1/2) log(1 + 1/m) - 1
    let acc = 0;
    let m = n;
    while (m <= 15) {
        acc += (m + 0.5) * Math.log1p(1 / m) - 1;
        m += 1;
    }
    return acc + stirlerrSeries(m);
}
/**
 * Deviance bd0(x, M) = x log(x/M) + M - x (>= 0) in double-double.
 * M is also taken in double-double (so as not to bring in the rounding of a product such as n p).
 * When x and M are close, it is computed by the series in v = (x - M)/(x + M) (Loader 2000).
 */
export function bd0dd(x, M) {
    if (!isDoubleDouble())
        return bd0ddOps(x, M);
    // d = x - M and the series expand the same operations as bd0ddOps below, in the same order, without allocating arrays
    // (the result is bit-identical; see docs/performance.md). Generated with python3 scripts/ddgen.py bd0dd
    const n1 = -M[0];
    const n2 = -M[1];
    const s3 = x + n1;
    const bb4 = s3 - x;
    const e5 = x - (s3 - bb4) + (n1 - bb4);
    const s6 = 0 + n2;
    const bb7 = s6 - 0;
    const e8 = 0 - (s6 - bb7) + (n2 - bb7);
    const u9 = e5 + s6;
    const s10 = s3 + u9;
    const e11 = u9 - (s10 - s3);
    const w12 = e11 + e8;
    const s13 = s10 + w12;
    const e14 = w12 - (s13 - s10);
    const dh = s13;
    const dl = e14;
    if (Math.abs(dh) < 0.1 * (x + M[0])) {
        const s15 = x + M[0];
        const bb16 = s15 - x;
        const e17 = x - (s15 - bb16) + (M[0] - bb16);
        const s18 = 0 + M[1];
        const bb19 = s18 - 0;
        const e20 = 0 - (s18 - bb19) + (M[1] - bb19);
        const u21 = e17 + s18;
        const s22 = s15 + u21;
        const e23 = u21 - (s22 - s15);
        const w24 = e23 + e20;
        const s25 = s22 + w24;
        const e26 = w24 - (s25 - s22);
        const q27 = dh / s25;
        const p28 = s25 * q27;
        const t29 = SPLITTER * s25;
        const ah30 = t29 - (t29 - s25);
        const al31 = s25 - ah30;
        const t32 = SPLITTER * q27;
        const bh33 = t32 - (t32 - q27);
        const bl34 = q27 - bh33;
        const e35 = ah30 * bh33 - p28 + ah30 * bl34 + al31 * bh33 + al31 * bl34;
        const u36 = e35 + e26 * q27;
        const s37 = p28 + u36;
        const e38 = u36 - (s37 - p28);
        const n39 = -s37;
        const n40 = -e38;
        const s41 = dh + n39;
        const bb42 = s41 - dh;
        const e43 = dh - (s41 - bb42) + (n39 - bb42);
        const s44 = dl + n40;
        const bb45 = s44 - dl;
        const e46 = dl - (s44 - bb45) + (n40 - bb45);
        const u47 = e43 + s44;
        const s48 = s41 + u47;
        const e49 = u47 - (s48 - s41);
        const w50 = e49 + e46;
        const s51 = s48 + w50;
        const e52 = w50 - (s51 - s48);
        const q53 = s51 / s25;
        const p54 = s25 * q53;
        const t55 = SPLITTER * s25;
        const ah56 = t55 - (t55 - s25);
        const al57 = s25 - ah56;
        const t58 = SPLITTER * q53;
        const bh59 = t58 - (t58 - q53);
        const bl60 = q53 - bh59;
        const e61 = ah56 * bh59 - p54 + ah56 * bl60 + al57 * bh59 + al57 * bl60;
        const u62 = e61 + e26 * q53;
        const s63 = p54 + u62;
        const e64 = u62 - (s63 - p54);
        const n65 = -s63;
        const n66 = -e64;
        const s67 = s51 + n65;
        const bb68 = s67 - s51;
        const e69 = s51 - (s67 - bb68) + (n65 - bb68);
        const s70 = e52 + n66;
        const bb71 = s70 - e52;
        const e72 = e52 - (s70 - bb71) + (n66 - bb71);
        const u73 = e69 + s70;
        const s74 = s67 + u73;
        const e75 = u73 - (s74 - s67);
        const w76 = e75 + e72;
        const s77 = s74 + w76;
        const e78 = w76 - (s77 - s74);
        const q79 = s77 / s25;
        const s80 = q27 + q53;
        const e81 = q53 - (s80 - q27);
        const s82 = s80 + q79;
        const bb83 = s82 - s80;
        const e84 = s80 - (s82 - bb83) + (q79 - bb83);
        const s85 = e81 + 0;
        const bb86 = s85 - e81;
        const e87 = e81 - (s85 - bb86) + (0 - bb86);
        const u88 = e84 + s85;
        const s89 = s82 + u88;
        const e90 = u88 - (s89 - s82);
        const w91 = e90 + e87;
        const s92 = s89 + w91;
        const e93 = w91 - (s92 - s89);
        const vh = s92;
        const vl = e93;
        const p94 = dh * vh;
        const t95 = SPLITTER * dh;
        const ah96 = t95 - (t95 - dh);
        const al97 = dh - ah96;
        const t98 = SPLITTER * vh;
        const bh99 = t98 - (t98 - vh);
        const bl100 = vh - bh99;
        const e101 = ah96 * bh99 - p94 + ah96 * bl100 + al97 * bh99 + al97 * bl100;
        const u102 = e101 + (dh * vl + dl * vh);
        const s103 = p94 + u102;
        const e104 = u102 - (s103 - p94);
        let sh = s103;
        let sl = e104;
        const x2 = 2 * x;
        const p105 = vh * x2;
        const t106 = SPLITTER * vh;
        const ah107 = t106 - (t106 - vh);
        const al108 = vh - ah107;
        const t109 = SPLITTER * x2;
        const bh110 = t109 - (t109 - x2);
        const bl111 = x2 - bh110;
        const e112 = ah107 * bh110 - p105 + ah107 * bl111 + al108 * bh110 + al108 * bl111;
        const u113 = e112 + vl * x2;
        const s114 = p105 + u113;
        const e115 = u113 - (s114 - p105);
        let ejh = s114;
        let ejl = e115;
        const p116 = vh * vh;
        const t117 = SPLITTER * vh;
        const ah118 = t117 - (t117 - vh);
        const al119 = vh - ah118;
        const t120 = SPLITTER * vh;
        const bh121 = t120 - (t120 - vh);
        const bl122 = vh - bh121;
        const e123 = ah118 * bh121 - p116 + ah118 * bl122 + al119 * bh121 + al119 * bl122;
        const u124 = e123 + (vh * vl + vl * vh);
        const s125 = p116 + u124;
        const e126 = u124 - (s125 - p116);
        const v2h = s125;
        const v2l = e126;
        for (let j = 1; j < 1000; j++) {
            const p127 = ejh * v2h;
            const t128 = SPLITTER * ejh;
            const ah129 = t128 - (t128 - ejh);
            const al130 = ejh - ah129;
            const t131 = SPLITTER * v2h;
            const bh132 = t131 - (t131 - v2h);
            const bl133 = v2h - bh132;
            const e134 = ah129 * bh132 - p127 + ah129 * bl133 + al130 * bh132 + al130 * bl133;
            const u135 = e134 + (ejh * v2l + ejl * v2h);
            const s136 = p127 + u135;
            const e137 = u135 - (s136 - p127);
            ejh = s136;
            ejl = e137;
            const dv = 2 * j + 1;
            const q138 = ejh / dv;
            const p139 = dv * q138;
            const t140 = SPLITTER * dv;
            const ah141 = t140 - (t140 - dv);
            const al142 = dv - ah141;
            const t143 = SPLITTER * q138;
            const bh144 = t143 - (t143 - q138);
            const bl145 = q138 - bh144;
            const e146 = ah141 * bh144 - p139 + ah141 * bl145 + al142 * bh144 + al142 * bl145;
            const u147 = e146 + 0 * q138;
            const s148 = p139 + u147;
            const e149 = u147 - (s148 - p139);
            const n150 = -s148;
            const n151 = -e149;
            const s152 = ejh + n150;
            const bb153 = s152 - ejh;
            const e154 = ejh - (s152 - bb153) + (n150 - bb153);
            const s155 = ejl + n151;
            const bb156 = s155 - ejl;
            const e157 = ejl - (s155 - bb156) + (n151 - bb156);
            const u158 = e154 + s155;
            const s159 = s152 + u158;
            const e160 = u158 - (s159 - s152);
            const w161 = e160 + e157;
            const s162 = s159 + w161;
            const e163 = w161 - (s162 - s159);
            const q164 = s162 / dv;
            const p165 = dv * q164;
            const t166 = SPLITTER * dv;
            const ah167 = t166 - (t166 - dv);
            const al168 = dv - ah167;
            const t169 = SPLITTER * q164;
            const bh170 = t169 - (t169 - q164);
            const bl171 = q164 - bh170;
            const e172 = ah167 * bh170 - p165 + ah167 * bl171 + al168 * bh170 + al168 * bl171;
            const u173 = e172 + 0 * q164;
            const s174 = p165 + u173;
            const e175 = u173 - (s174 - p165);
            const n176 = -s174;
            const n177 = -e175;
            const s178 = s162 + n176;
            const bb179 = s178 - s162;
            const e180 = s162 - (s178 - bb179) + (n176 - bb179);
            const s181 = e163 + n177;
            const bb182 = s181 - e163;
            const e183 = e163 - (s181 - bb182) + (n177 - bb182);
            const u184 = e180 + s181;
            const s185 = s178 + u184;
            const e186 = u184 - (s185 - s178);
            const w187 = e186 + e183;
            const s188 = s185 + w187;
            const e189 = w187 - (s188 - s185);
            const q190 = s188 / dv;
            const s191 = q138 + q164;
            const e192 = q164 - (s191 - q138);
            const s193 = s191 + q190;
            const bb194 = s193 - s191;
            const e195 = s191 - (s193 - bb194) + (q190 - bb194);
            const s196 = e192 + 0;
            const bb197 = s196 - e192;
            const e198 = e192 - (s196 - bb197) + (0 - bb197);
            const u199 = e195 + s196;
            const s200 = s193 + u199;
            const e201 = u199 - (s200 - s193);
            const w202 = e201 + e198;
            const s203 = s200 + w202;
            const e204 = w202 - (s203 - s200);
            const s205 = sh + s203;
            const bb206 = s205 - sh;
            const e207 = sh - (s205 - bb206) + (s203 - bb206);
            const s208 = sl + e204;
            const bb209 = s208 - sl;
            const e210 = sl - (s208 - bb209) + (e204 - bb209);
            const u211 = e207 + s208;
            const s212 = s205 + u211;
            const e213 = u211 - (s212 - s205);
            const w214 = e213 + e210;
            const s215 = s212 + w214;
            const e216 = w214 - (s215 - s212);
            if (Math.abs(s203) <= 1e-33 * Math.abs(s215) || (s215 === sh && e216 === sl))
                return [s215, e216];
            sh = s215;
            sl = e216;
        }
        return [sh, sl];
    }
    // x log(x/M) + (M - x)
    const lr = ddSub(ddLog([x, 0]), ddLog(M));
    return ddAdd(ddMulNum(lr, x), [-dh, -dl]);
}
/** bd0dd written with calls to the double-double helpers (used when evaluating in double-precision mode; see src/special/dd.ts) */
function bd0ddOps(x, M) {
    const d = ddSub([x, 0], M);
    if (Math.abs(d[0]) < 0.1 * (x + M[0])) {
        const v = ddDiv(d, ddAdd([x, 0], M));
        let s = ddMul(d, v);
        let ej = ddMulNum(v, 2 * x);
        const v2 = ddMul(v, v);
        for (let j = 1; j < 1000; j++) {
            ej = ddMul(ej, v2);
            const t = ddDivNum(ej, 2 * j + 1);
            const s1 = ddAdd(s, t);
            if (Math.abs(t[0]) <= 1e-33 * Math.abs(s1[0]) || s1[0] === s[0] && s1[1] === s[1])
                return s1;
            s = s1;
        }
        return s;
    }
    // x log(x/M) + (M - x)
    const lr = ddSub(ddLog([x, 0]), ddLog(M));
    return ddAdd(ddMulNum(lr, x), ddNeg(d));
}
/** Double-precision version of bd0 */
export function bd0(x, M) {
    if (!Number.isFinite(x) || !Number.isFinite(M) || M === 0)
        return NaN;
    if (x === 0)
        return M;
    const r = bd0dd(x, [M, 0]);
    return r[0] + r[1];
}
/** exp(-(e[0] + e[1])) / sqrt(denom). Keeps relative accuracy even for large e */
function expNegDD(e, log, logDenom, denom) {
    if (log)
        return -e[0] - e[1] - 0.5 * logDenom();
    if (e[0] < 700)
        return (Math.exp(-e[0]) * (1 - e[1])) / Math.sqrt(denom());
    // Region where the result is near subnormal: multiply by exp(-700) last so that rounding happens once, at the end
    const d = denom();
    if (!Number.isFinite(d) || d === 0)
        return Math.exp(-e[0] - e[1] - 0.5 * logDenom());
    return ((Math.exp(700 - e[0]) * (1 - e[1])) / Math.sqrt(d)) * Math.exp(-700);
}
/**
 * Binomial probability C(n, x) p^x q^(n-x). x and n need not be integers (used by the beta and F distributions).
 * The caller passes q = 1 - p accurately.
 */
export function dbinomRaw(x, n, p, q, log) {
    return dbinomRawSplit(x, n - x, p, q, log);
}
/**
 * Version of dbinomRaw taking x and n - x separately (n = x + nmx).
 * Used where forming n = a + b and recovering n - a would lose digits of the smaller one, as in the beta
 * function with a ≪ b.
 */
export function dbinomRawSplit(x, nmx, p, q, log) {
    return dbinomRawDD(x, nmx, [p, 0], [q, 0], log);
}
/**
 * Version that additionally takes p and q = 1 - p in double-double.
 * The rounding error of p^x is amplified x times (1e-11 at x = 1e5), so where p is formed as 1 - (smaller side),
 * pass that difference exactly in double-double.
 */
export function dbinomRawDD(x, nmx, p, q, log) {
    const zero = log ? -Infinity : 0;
    const one = log ? 0 : 1;
    const nn = twoSum(x, nmx); // n in double-double
    const n = nn[0];
    if (p[0] === 0)
        return x === 0 ? one : zero;
    if (q[0] === 0)
        return nmx === 0 ? one : zero;
    if (x === 0) {
        if (n === 0)
            return one;
        if (p[0] < 0.1) {
            // n log q = -bd0(n, n q) - n p
            const e = ddAdd(bd0dd(n, ddMul(nn, q)), ddMul(nn, p));
            return log ? -e[0] - e[1] : Math.exp(-e[0]) * (1 - e[1]);
        }
        const lq = ddLog(q);
        const lc = ddMul(nn, lq);
        return log ? lc[0] + lc[1] : Math.exp(lc[0]) * (1 + lc[1]);
    }
    if (nmx === 0) {
        if (q[0] < 0.1) {
            const e = ddAdd(bd0dd(n, ddMul(nn, p)), ddMul(nn, q));
            return log ? -e[0] - e[1] : Math.exp(-e[0]) * (1 - e[1]);
        }
        const lc = ddMul(nn, ddLog(p));
        return log ? lc[0] + lc[1] : Math.exp(lc[0]) * (1 + lc[1]);
    }
    if (x < 0 || nmx < 0)
        return zero;
    // E = stirlerr(x) + stirlerr(n-x) - stirlerr(n) + bd0(x, np) + bd0(n-x, nq)
    let e = ddAdd(bd0dd(x, ddMul(nn, p)), bd0dd(nmx, ddMul(nn, q)));
    e = ddAdd(e, twoSum(stirlerr(x) + stirlerr(nmx), -stirlerr(n)));
    // Denominator 2 pi x (n - x) / n
    return expNegDD(e, log, () => LN_2PI + Math.log(x) + Math.log(nmx) - Math.log(n), () => 2 * Math.PI * x * (nmx / n));
}
/**
 * Return the exponent of the core binomial probability (0 < x, 0 < n - x, 0 < p, q) in double-double.
 * Probability = exp(-e) / sqrt(denom). Used when exp should be taken after combining with other factors (beta density).
 */
export function dbinomExponent(x, nmx, p, q) {
    const nn = twoSum(x, nmx);
    const n = nn[0];
    let e = ddAdd(bd0dd(x, ddMul(nn, p)), bd0dd(nmx, ddMul(nn, q)));
    e = ddAdd(e, twoSum(stirlerr(x) + stirlerr(nmx), -stirlerr(n)));
    return { e, logDenom: LN_2PI + Math.log(x) + Math.log(nmx) - Math.log(n) };
}
/** Poisson probability lambda^x e^-lambda / x!. x need not be an integer (used by the gamma distribution). */
export function dpoisRaw(x, lambda, log) {
    const r = dpoisRawCore(x, lambda, log, !log);
    return log ? r[0] : r[1];
}
/** Return [log, linear] of dpoisRaw in one computation (bit-identical to each of dpoisRaw's values) */
export function dpoisRawBoth(x, lambda) {
    return dpoisRawCore(x, lambda, true, true);
}
/** Core of dpoisRaw. Computes only the requested parts (the others are NaN) */
function dpoisRawCore(x, lambda, wantLog, wantLin) {
    if (lambda === 0)
        return x === 0 ? [0, 1] : [-Infinity, 0];
    if (!Number.isFinite(lambda) || x < 0)
        return [-Infinity, 0];
    if (x <= lambda * DBL_MIN)
        return [-lambda, wantLin ? Math.exp(-lambda) : NaN];
    if (lambda < x * DBL_MIN) {
        if (!Number.isFinite(x))
            return [-Infinity, 0];
        const v = -lambda + x * Math.log(lambda) - lgamma1p(x);
        return [v, wantLin ? Math.exp(v) : NaN];
    }
    const e = ddAdd(bd0dd(x, [lambda, 0]), [stirlerr(x), 0]);
    const logDenom = () => LN_2PI + Math.log(x);
    const denom = () => 2 * Math.PI * x;
    return [wantLog ? expNegDD(e, true, logDenom, denom) : NaN, wantLin ? expNegDD(e, false, logDenom, denom) : NaN];
}
