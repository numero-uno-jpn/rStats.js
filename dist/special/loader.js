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
/** Bound on |x v^3| below which the series tail of bd0dd is summed in double precision (see scripts/ddgen.py) */
const TAIL_IN_DOUBLE = 0.12;
/**
 * Deviance bd0(x, M) = x log(x/M) + M - x (>= 0) in double-double.
 * M is also taken in double-double (so as not to bring in the rounding of a product such as n p).
 * When x and M are close, it is computed by the series in v = (x - M)/(x + M) (Loader 2000).
 */
export function bd0dd(x, M) {
    // bd0 is homogeneous of degree 1: from about 1e300 the splitting in the double-double products overflows (x + M
    // enters them), so scale x and M by 2^-64 (exactly, unless the smaller one would become subnormal; its quotient is
    // then far out and the logarithms are taken separately below) and the result back (pgamma(9.9e299, 1e300) was NaN)
    if (Math.max(x, M[0]) > 1e299 && Math.min(x, M[0]) > 1e-250) {
        return scaleUp(bd0dd(x * 2 ** -64, [M[0] * 2 ** -64, M[1] * 2 ** -64]));
    }
    if (!isDoubleDouble())
        return bd0ddOps(x, M);
    // d = x - M and the series expand the same operations as bd0ddOps below, in the same order, without allocating arrays
    // (see docs/performance.md). Generated with python3 scripts/ddgen.py bd0dd. One difference: when the series tail
    // 2x (v^3/3 + v^5/5 + ...) is small (|x v^3| <= TAIL_IN_DOUBLE, so |tail| <= 1/12), it is summed in double
    // precision. Its rounding, at most 3 eps |tail| (the low part of v is dropped: 1.5 eps through v^3), is then below
    // eps/4 in absolute terms, i.e. below eps/4 relative in exp(-bd0); the double-double sum needs up to 16 steps more
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
        if (Math.abs(x * vh * vh * vh) <= TAIL_IN_DOUBLE) {
            const vv = vh * vh;
            let ej = 2 * x * vh * vv;
            let tail = ej / 3;
            for (let j = 2; j < 1000; j++) {
                ej *= vv;
                const t = ej / (2 * j + 1);
                tail += t;
                if (Math.abs(t) <= 2 ** -60 * sh)
                    break;
            }
            const s105 = sh + tail;
            const bb106 = s105 - sh;
            const e107 = sh - (s105 - bb106) + (tail - bb106);
            const s108 = sl + 0;
            const bb109 = s108 - sl;
            const e110 = sl - (s108 - bb109) + (0 - bb109);
            const u111 = e107 + s108;
            const s112 = s105 + u111;
            const e113 = u111 - (s112 - s105);
            const w114 = e113 + e110;
            const s115 = s112 + w114;
            const e116 = w114 - (s115 - s112);
            return [s115, e116];
        }
        const x2 = 2 * x;
        const p117 = vh * x2;
        const t118 = SPLITTER * vh;
        const ah119 = t118 - (t118 - vh);
        const al120 = vh - ah119;
        const t121 = SPLITTER * x2;
        const bh122 = t121 - (t121 - x2);
        const bl123 = x2 - bh122;
        const e124 = ah119 * bh122 - p117 + ah119 * bl123 + al120 * bh122 + al120 * bl123;
        const u125 = e124 + vl * x2;
        const s126 = p117 + u125;
        const e127 = u125 - (s126 - p117);
        let ejh = s126;
        let ejl = e127;
        const p128 = vh * vh;
        const t129 = SPLITTER * vh;
        const ah130 = t129 - (t129 - vh);
        const al131 = vh - ah130;
        const t132 = SPLITTER * vh;
        const bh133 = t132 - (t132 - vh);
        const bl134 = vh - bh133;
        const e135 = ah130 * bh133 - p128 + ah130 * bl134 + al131 * bh133 + al131 * bl134;
        const u136 = e135 + (vh * vl + vl * vh);
        const s137 = p128 + u136;
        const e138 = u136 - (s137 - p128);
        const v2h = s137;
        const v2l = e138;
        for (let j = 1; j < 1000; j++) {
            const p139 = ejh * v2h;
            const t140 = SPLITTER * ejh;
            const ah141 = t140 - (t140 - ejh);
            const al142 = ejh - ah141;
            const t143 = SPLITTER * v2h;
            const bh144 = t143 - (t143 - v2h);
            const bl145 = v2h - bh144;
            const e146 = ah141 * bh144 - p139 + ah141 * bl145 + al142 * bh144 + al142 * bl145;
            const u147 = e146 + (ejh * v2l + ejl * v2h);
            const s148 = p139 + u147;
            const e149 = u147 - (s148 - p139);
            ejh = s148;
            ejl = e149;
            const dv = 2 * j + 1;
            const q150 = ejh / dv;
            const p151 = dv * q150;
            const t152 = SPLITTER * dv;
            const ah153 = t152 - (t152 - dv);
            const al154 = dv - ah153;
            const t155 = SPLITTER * q150;
            const bh156 = t155 - (t155 - q150);
            const bl157 = q150 - bh156;
            const e158 = ah153 * bh156 - p151 + ah153 * bl157 + al154 * bh156 + al154 * bl157;
            const u159 = e158 + 0 * q150;
            const s160 = p151 + u159;
            const e161 = u159 - (s160 - p151);
            const n162 = -s160;
            const n163 = -e161;
            const s164 = ejh + n162;
            const bb165 = s164 - ejh;
            const e166 = ejh - (s164 - bb165) + (n162 - bb165);
            const s167 = ejl + n163;
            const bb168 = s167 - ejl;
            const e169 = ejl - (s167 - bb168) + (n163 - bb168);
            const u170 = e166 + s167;
            const s171 = s164 + u170;
            const e172 = u170 - (s171 - s164);
            const w173 = e172 + e169;
            const s174 = s171 + w173;
            const e175 = w173 - (s174 - s171);
            const q176 = s174 / dv;
            const p177 = dv * q176;
            const t178 = SPLITTER * dv;
            const ah179 = t178 - (t178 - dv);
            const al180 = dv - ah179;
            const t181 = SPLITTER * q176;
            const bh182 = t181 - (t181 - q176);
            const bl183 = q176 - bh182;
            const e184 = ah179 * bh182 - p177 + ah179 * bl183 + al180 * bh182 + al180 * bl183;
            const u185 = e184 + 0 * q176;
            const s186 = p177 + u185;
            const e187 = u185 - (s186 - p177);
            const n188 = -s186;
            const n189 = -e187;
            const s190 = s174 + n188;
            const bb191 = s190 - s174;
            const e192 = s174 - (s190 - bb191) + (n188 - bb191);
            const s193 = e175 + n189;
            const bb194 = s193 - e175;
            const e195 = e175 - (s193 - bb194) + (n189 - bb194);
            const u196 = e192 + s193;
            const s197 = s190 + u196;
            const e198 = u196 - (s197 - s190);
            const w199 = e198 + e195;
            const s200 = s197 + w199;
            const e201 = w199 - (s200 - s197);
            const q202 = s200 / dv;
            const s203 = q150 + q176;
            const e204 = q176 - (s203 - q150);
            const s205 = s203 + q202;
            const bb206 = s205 - s203;
            const e207 = s203 - (s205 - bb206) + (q202 - bb206);
            const s208 = e204 + 0;
            const bb209 = s208 - e204;
            const e210 = e204 - (s208 - bb209) + (0 - bb209);
            const u211 = e207 + s208;
            const s212 = s205 + u211;
            const e213 = u211 - (s212 - s205);
            const w214 = e213 + e210;
            const s215 = s212 + w214;
            const e216 = w214 - (s215 - s212);
            const s217 = sh + s215;
            const bb218 = s217 - sh;
            const e219 = sh - (s217 - bb218) + (s215 - bb218);
            const s220 = sl + e216;
            const bb221 = s220 - sl;
            const e222 = sl - (s220 - bb221) + (e216 - bb221);
            const u223 = e219 + s220;
            const s224 = s217 + u223;
            const e225 = u223 - (s224 - s217);
            const w226 = e225 + e222;
            const s227 = s224 + w226;
            const e228 = w226 - (s227 - s224);
            if (Math.abs(s215) <= 1e-33 * Math.abs(s227) || (s227 === sh && e228 === sl))
                return [s227, e228];
            sh = s227;
            sl = e228;
        }
        return [sh, sl];
    }
    // x log(x/M) + (M - x), with log(x/M) from the double-double quotient (one logarithm instead of two) unless the
    // quotient leaves the normal range, where its low part would be lost, or x or M is above 1e300, where the splitting
    // of the double-double division overflows (dgamma(9.3e281, 1.9e183, { rate: 3e21 }) threw a TypeError)
    const ratio = x / M[0];
    const lr = ratio > 1e-290 && ratio < 1e290 && Math.max(x, M[0]) < 1e300 ? ddLog(ddDiv([x, 0], M)) : ddSub(ddLog([x, 0]), ddLog(M));
    return farDeviance(lr, x, [dh, dl]);
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
    const ratio = x / M[0];
    const lr = ratio > 1e-290 && ratio < 1e290 && Math.max(x, M[0]) < 1e300 ? ddLog(ddDiv([x, 0], M)) : ddSub(ddLog([x, 0]), ddLog(M));
    return farDeviance(lr, x, d);
}
/**
 * x lr - d for lr = log(x/M) and d = x - M (the far branch of bd0dd). Above 1e299 the splitting of x in the product
 * overflows (pgamma(1e-300, 1e301) was NaN, where M is too small for the scaling at the top of bd0dd): the product and
 * d are then taken times 2^-64 (exactly) and the sum scaled back, Infinity where that overflows
 */
function farDeviance(lr, x, d) {
    if (x < 1e299)
        return ddAdd(ddMulNum(lr, x), ddNeg(d));
    return scaleUp(ddAdd(ddMulNum(lr, x * 2 ** -64), [-d[0] * 2 ** -64, -d[1] * 2 ** -64]));
}
/**
 * A deviance computed times 2^-64, scaled back; [Infinity, 0] where it overflows (a finite low part beside it made
 * the sums of its callers NaN: dgamma(1.3e27, 9.2e305, rate 0.44) was NaN)
 */
function scaleUp(r) {
    const hi = r[0] * 2 ** 64;
    return Number.isFinite(hi) ? [hi, r[1] * 2 ** 64] : [hi, 0];
}
/**
 * bd0(x, n p) with n and p in double-double. Above 1e299 the splitting in the double-double product overflows, so n is
 * scaled by 2^-64 there (exactly) and the product back. Where n p is not a normal number well inside the range (below
 * 1e-290, down to 0 by underflow, as with tiny shapes: pbeta(5.8e-295, 2.8e-193, 3.5e-153) threw a TypeError), its
 * logarithm is taken as log n + log p
 */
function bd0Prod(x, nn, p) {
    const s = nn[0] > 1e299 ? 2 ** -64 : 1;
    const ms = ddMul([nn[0] * s, nn[1] * s], p);
    const M = [ms[0] / s, ms[1] / s];
    if (M[0] >= 1e-290)
        return bd0dd(x, M);
    const lr = ddSub(ddLog([x, 0]), ddAdd(ddLog(nn), ddLog(p)));
    return ddAdd(ddMulNum(lr, x), twoSum(nn[0] * p[0], -x));
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
    // Far below the subnormals; e[1] can then exceed 1 (it is up to half an ulp of e[0]) and 1 - e[1] would give -0
    if (e[0] > 2000)
        return 0;
    // Region where the result is near subnormal: multiply by exp(-700) last so that rounding happens once, at the end
    const d = denom();
    if (!Number.isFinite(d) || d === 0)
        return Math.exp(-e[0] - e[1] - 0.5 * logDenom());
    return ((Math.exp(700 - e[0]) * (1 - e[1])) / Math.sqrt(d)) * Math.exp(-700);
}
/**
 * n v for a double-double n that may exceed 1e299, where the splitting in ddMul overflows (dnbinom(0, 2.4e301, { prob:
 * 1 - 2.3e-11 }) was NaN): n is then scaled by 2^-64 (exactly) and the product back
 */
function mulLarge(nn, v) {
    if (!(nn[0] > 1e299))
        return ddMul(nn, v);
    return scaleUp(ddMul([nn[0] * 2 ** -64, nn[1] * 2 ** -64], v));
}
/**
 * exp of a double-double log probability; 0 far below the subnormals, where the low part can exceed 1 and the first
 * order correction would give -0
 */
const expLogDD = (l) => (l[0] < -2000 ? 0 : Math.exp(l[0]) * (1 + l[1]));
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
            const e = ddAdd(bd0Prod(n, nn, q), mulLarge(nn, p));
            return log ? -e[0] - e[1] : expLogDD([-e[0], -e[1]]);
        }
        const lq = ddLog(q);
        const lc = mulLarge(nn, lq);
        return log ? lc[0] + lc[1] : expLogDD(lc);
    }
    if (nmx === 0) {
        if (q[0] < 0.1) {
            const e = ddAdd(bd0Prod(n, nn, p), mulLarge(nn, q));
            return log ? -e[0] - e[1] : expLogDD([-e[0], -e[1]]);
        }
        const lc = mulLarge(nn, ddLog(p));
        return log ? lc[0] + lc[1] : expLogDD(lc);
    }
    if (x < 0 || nmx < 0)
        return zero;
    // E = stirlerr(x) + stirlerr(n-x) - stirlerr(n) + bd0(x, np) + bd0(n-x, nq)
    const e = binomialExponent(x, nmx, nn, p, q);
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
    return { e: binomialExponent(x, nmx, nn, p, q), logDenom: LN_2PI + Math.log(x) + Math.log(nmx) - Math.log(n) };
}
/**
 * The exponent E = bd0(x, np) + bd0(n - x, nq) + stirlerr(x) + stirlerr(n - x) - stirlerr(n) in double-double;
 * [Infinity, 0] where a deviance overflows (the double-double sums made it NaN: dbeta(0.998, 55.1, 6.3e307))
 */
function binomialExponent(x, nmx, nn, p, q) {
    const d1 = bd0Prod(x, nn, p);
    const d2 = bd0Prod(nmx, nn, q);
    if (!Number.isFinite(d1[0] + d2[0]))
        return [Infinity, 0];
    return ddAdd(ddAdd(d1, d2), twoSum(stirlerr(x) + stirlerr(nmx), -stirlerr(nn[0])));
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
        // (lgamma1p(x) overflows from about 2.5e305 on, where x log(lambda) may too: the log is -Infinity, not NaN)
        const lg = lgamma1p(x);
        const v = lg === Infinity ? -Infinity : -lambda + x * Math.log(lambda) - lg;
        return [v, wantLin ? Math.exp(v) : NaN];
    }
    const b = bd0dd(x, [lambda, 0]);
    // (an overflowed deviance stays [Infinity, 0]: the double-double sum would make it NaN)
    const e = b[0] === Infinity ? b : ddAdd(b, [stirlerr(x), 0]);
    const logDenom = () => LN_2PI + Math.log(x);
    // 2 pi x overflows above about 2.9e307: the linear value is then taken with pi x / 8 and divided by 4 (it was 0 where
    // dchisq(1e308, 1e308) is 2.8e-155)
    const big = x > 2e307;
    const denom = big ? () => (Math.PI / 8) * x : () => 2 * Math.PI * x;
    return [
        wantLog ? expNegDD(e, true, logDenom, denom) : NaN,
        wantLin ? expNegDD(e, false, logDenom, denom) / (big ? 4 : 1) : NaN,
    ];
}
