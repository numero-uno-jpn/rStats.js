// Ported from xsf include/xsf/cephes/incbet.h (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
//
// Regularized incomplete beta function I_x(a, b) and 1 - I_x(a, b).
// Changes from xsf
// - x and 1 - x are taken separately (the caller can often form 1 - x accurately,
//   e.g. n/(n + t^2) and t^2/(n + t^2) for the t distribution)
// - For each tail, choose the frame in which it can be computed directly (I_x(a,b) or I_{1-x}(b,a)),
//   because forming it as 1 - (the other) loses digits in the smaller tail
// - The factor x^a (1-x)^b / B(a, b) in front of the series and continued fractions is computed with
//   Loader's dbinomRaw (avoids cancellation in the log for large a, b), or for a small shape, or a huge one with the
//   other moderate, from the forms of incbetPrefactor.ts
// - The log is formed directly from the result of each computation

import { MACHEP } from "./constants.js";
import { dbinomExponent, dbinomRawDD } from "./loader.js";
import { ddAdd, ddDiv, ddLog, ddMul, ddMulNum, ddSub, isDoubleDouble, SPLITTER, twoProd, twoSum, type DD } from "./dd.js";
import { lgamma1p } from "./gamma.js";
import { lgammaDiffDD } from "./lgammaDiff.js";
import {
  HUGE_SHAPE,
  HUGE_SHAPE_MAX_SMALL,
  lgammaRatioHuge,
  prefactorParts,
  SMALL_SHAPE,
  smallShapeG,
} from "./incbetPrefactor.js";
import { betaIncTemme, TEMME_MIN_M } from "./incbetTemme.js";
import { betaIncLargeA, LARGE_A_MIN, SMALL_B_MAX } from "./incbetLargeA.js";

const BIG = 4.503599627370496e15;
const BIGINV = 2.22044604925031308085e-16;

/**
 * Log of x^a (1-x)^b / B(a, b).
 * Since dbinom(a; a + b, x) = Gamma(a+b+1)/(Gamma(a+1) Gamma(b+1)) x^a (1-x)^b
 * (a and b are passed separately; recovering them from a + b loses digits of the smaller one),
 * x^a (1-x)^b / B(a, b) = dbinom(a; a+b, x) * a b / (a + b). For a small shape, or a huge one with the other moderate,
 * from prefactorParts (incbetPrefactor.ts) instead, as in prefactor and smallPrefactorTimes
 */
function logPrefactor(a: number, b: number, x: DD, xc: DD): number {
  const parts = prefactorParts(a, b, x, xc);
  if (parts !== undefined) return Math.log(parts[0]) + parts[1][0] + parts[1][1];
  return dbinomRawDD(a, b, x, xc, true) + Math.log(a) + Math.log(b) - Math.log(a + b);
}

/** Linear value of x^a (1-x)^b / B(a, b) (0 on underflow) */
function prefactor(a: number, b: number, x: DD, xc: DD): number {
  const parts = prefactorParts(a, b, x, xc);
  if (parts !== undefined) return parts[0] * (Math.exp(parts[1][0]) * (1 + parts[1][1]));
  return dbinomRawDD(a, b, x, xc, false) * ((a * b) / (a + b));
}

/** Lower limit of normal numbers. If the prefactor is larger, multiply on the linear scale */
const NORMAL_MIN = 2.2250738585072014e-308 * 1e3;

/**
 * m x^a (1-x)^b / B(a, b) for a prefactor below NORMAL_MIN (m a moderate factor such as the series sum).
 * Going through the log would round an exponent near -708 to 0.5 ulp, which is 1e-13 relative after exp,
 * so the exponent of dbinom(a; a+b, x) is kept in double-double and exp is taken once at the end.
 * (multiplying by exp(-700) last rounds once, so a subnormal result is still correctly rounded).
 * Returns undefined when the result underflows to 0 (the caller then works on the log scale)
 */
function smallPrefactorTimes(a: number, b: number, x: DD, xc: DD, m: number): number | undefined {
  const parts = prefactorParts(a, b, x, xc);
  if (parts !== undefined) {
    const [ms, e] = parts;
    const c = m * ms;
    if (!(e[0] > -1400) || !Number.isFinite(c) || c === 0) return undefined;
    // (exp(e) directly above -700, where the prefactor is below the normal range through c alone, a shape below 1e-305:
    // e + 700 would round e to the ulp of 700, 1e-13, and pbeta(1 - 6e-14, 0.97, 4.7e-307, { lowerTail: false }) was
    // 1 - 5.5e-14, not 1)
    if (e[0] > -700) return Math.exp(e[0]) * (1 + e[1]) * c || undefined;
    const v = Math.exp(e[0] + 700) * (1 + e[1]) * c * Math.exp(-700);
    return v > 0 ? v : undefined;
  }
  const { e } = dbinomExponent(a, b, x, xc);
  const c = (m * ((a * b) / (a + b))) / Math.sqrt(2 * Math.PI * a * (b / (a + b)));
  if (!(e[0] < 1400) || !Number.isFinite(c) || c === 0) return undefined;
  const v = Math.exp(700 - e[0]) * (1 - e[1]) * c * Math.exp(-700);
  return v > 0 ? v : undefined;
}

/**
 * Series sum S = Σ_{n>=1} (1-b)_n / n! x^n / (a + n) (the core of xsf's pseries).
 * xsf stops on the relative error of the sum including 1/a; here we stop on S itself
 * (for small a, 1/a is large and xsf's criterion leaves S insufficiently accurate).
 */
function pseriesSum(a: number, b: number, x: number): number {
  let u = (1 - b) * x;
  let v = u / (a + 1);
  const t1 = v;
  let t = u;
  let n = 2;
  let s = 0;
  while (Math.abs(v) > MACHEP * Math.abs(s + t1) || n < 4) {
    if (n > 1e7) break;
    u = ((n - b) * x) / n;
    t *= u;
    v = t / (a + n);
    s += v;
    n += 1;
  }
  return s + t1;
}

/**
 * Compute 1 - I_x(a, b) without subtraction in the series region (b x <= 1, x <= 0.95).
 * Since I_x(a, b) = E (1 + a S) with E = x^a Gamma(a+b) / (Gamma(a+1) Gamma(b)) = exp(L),
 *   1 - I = -expm1(L) - E a S,  L = a log x + [lgamma(b+a) - lgamma(b)] - lgamma1p(a)
 * For small a, I is close to 1 and forming 1 - I by subtraction loses digits (1e-7 relative at a = 1e-10).
 * (Derived from the definition of the series)
 * a log x and lgamma(b+a) - lgamma(b) (about a log b for a huge b) are added in double-double: for x near 1/b they
 * cancel, and their rounding was 5e-14 of the result at pbeta(1.37e-272, 0.054, 3.9e270, { lowerTail: false }) (the
 * latter from lgammaRatioHuge for a huge b, see there)
 */
function pseriesComplement(a: number, b: number, xd: DD, log: boolean): number {
  const x = xd[0];
  const lg = b >= HUGE_SHAPE && a <= HUGE_SHAPE_MAX_SMALL ? lgammaRatioHuge(a, b) : lgammaDiffDD(a, b);
  const Ld = ddAdd(ddAdd(ddMulNum(ddLog(xd), a), lg), [-lgamma1p(a), 0]);
  const E = Math.exp(Ld[0]) * (1 + Ld[1]);
  const v = -(Math.expm1(Ld[0]) + Ld[1] * Math.exp(Ld[0])) - E * a * pseriesSum(a, b, x);
  return log ? Math.log(v) : v;
}

/** Series (when b x is small and x is not close to 1). Returns I_x(a, b) */
function pseries(a: number, b: number, xd: DD, xcd: DD, log: boolean): number {
  const x = xd[0];
  const ai = 1 / a;
  let u = (1 - b) * x;
  let v = u / (a + 1);
  const t1 = v;
  let t = u;
  let n = 2;
  let s = 0;
  const z = MACHEP * ai;
  while (Math.abs(v) > z) {
    u = ((n - b) * x) / n;
    t *= u;
    v = t / (a + n);
    s += v;
    n += 1;
  }
  s += t1;
  s += ai;
  // I = s x^a / B(a, b) = s * [x^a (1-x)^b / B(a,b)] * (1-x)^(-b)
  // (1-x)^b is formed as exp(b log1p(-x)) rather than a power of the rounded xc. The rounding error of xc
  // would be amplified b times (4e-12 relative at b = 1e5); in this region x <= 1/b is small and log1p is accurate
  const l1m = log1pNeg(xd);
  if (!log) {
    const pf = prefactor(a, b, xd, xcd);
    if (pf > NORMAL_MIN) return (s * pf) / Math.exp(b * l1m);
    const v = smallPrefactorTimes(a, b, xd, xcd, s / Math.exp(b * l1m));
    if (v !== undefined) return v;
  }
  const lv = Math.log(s) + logPrefactor(a, b, xd, xcd) - b * l1m;
  return log ? lv : Math.exp(lv);
}

/**
 * Evaluate continued fraction #1 / #2 in double-double.
 *
 * The coefficients are multiplied by x (or z = x/(1-x)), so the rounding error of x enters every coefficient in
 * the same direction. For large a with x near the mean the continued fraction is extremely sensitive to this:
 * the rounding of x = 0.999 (1e-19) alone shifts the result by 6e-13 relative (measured at a = 1e5, b = 100;
 * reference values checked with Rmpfr). So x is kept as an exact double-double and the recurrence also runs in
 * double-double.
 *
 * For the same reason a + b and b - 1 are kept in double-double: with a ≫ b, rounding a + b loses digits of b
 * (5e-11 relative at a = 1e8, b = 0.01, x = 1 - 1e-6; checked against mpmath). From 2^52 on, the steps k += 1 of
 * the other coefficients would be lost as well, so there every coefficient is a double-double (huge). Below 2^52 the
 * same holds for a non-integer a just below a power of two: a + 1, a + 2, ... cross into the next binade, where a's
 * last bit no longer fits, and every coefficient after that is rounded the same way. The error grows with a (log P
 * off by 3e-8 at a = 2^40 - 2^-13, 1.3e-4 at a = 2^52 - 0.5); see stepsInexact
 */
// ddDiv for the loop of the continued fraction without allocating: the same operations as in dd.ts, with the
// result left in R (a typed array, so that storing it allocates nothing). Generated with python3 scripts/ddgen.py scalar
const R = new Float64Array(2);

function sDiv(ah: number, al: number, bh: number, bl: number): void {
  const q1 = ah / bh;
  const p2 = bh * q1;
  const t3 = SPLITTER * bh;
  const ah4 = t3 - (t3 - bh);
  const al5 = bh - ah4;
  const t6 = SPLITTER * q1;
  const bh7 = t6 - (t6 - q1);
  const bl8 = q1 - bh7;
  const e9 = ah4 * bh7 - p2 + ah4 * bl8 + al5 * bh7 + al5 * bl8;
  const u10 = e9 + bl * q1;
  const s11 = p2 + u10;
  const e12 = u10 - (s11 - p2);
  const n13 = -s11;
  const n14 = -e12;
  const s15 = ah + n13;
  const bb16 = s15 - ah;
  const e17 = ah - (s15 - bb16) + (n13 - bb16);
  const s18 = al + n14;
  const bb19 = s18 - al;
  const e20 = al - (s18 - bb19) + (n14 - bb19);
  const u21 = e17 + s18;
  const s22 = s15 + u21;
  const e23 = u21 - (s22 - s15);
  const w24 = e23 + e20;
  const s25 = s22 + w24;
  const e26 = w24 - (s25 - s22);
  const q27 = s25 / bh;
  const p28 = bh * q27;
  const t29 = SPLITTER * bh;
  const ah30 = t29 - (t29 - bh);
  const al31 = bh - ah30;
  const t32 = SPLITTER * q27;
  const bh33 = t32 - (t32 - q27);
  const bl34 = q27 - bh33;
  const e35 = ah30 * bh33 - p28 + ah30 * bl34 + al31 * bh33 + al31 * bl34;
  const u36 = e35 + bl * q27;
  const s37 = p28 + u36;
  const e38 = u36 - (s37 - p28);
  const n39 = -s37;
  const n40 = -e38;
  const s41 = s25 + n39;
  const bb42 = s41 - s25;
  const e43 = s25 - (s41 - bb42) + (n39 - bb42);
  const s44 = e26 + n40;
  const bb45 = s44 - e26;
  const e46 = e26 - (s44 - bb45) + (n40 - bb45);
  const u47 = e43 + s44;
  const s48 = s41 + u47;
  const e49 = u47 - (s48 - s41);
  const w50 = e49 + e46;
  const s51 = s48 + w50;
  const e52 = w50 - (s51 - s48);
  const q53 = s51 / bh;
  const s54 = q1 + q27;
  const e55 = q27 - (s54 - q1);
  const s56 = s54 + q53;
  const bb57 = s56 - s54;
  const e58 = s54 - (s56 - bb57) + (q53 - bb57);
  const s59 = e55 + 0;
  const bb60 = s59 - e55;
  const e61 = e55 - (s59 - bb60) + (0 - bb60);
  const u62 = e58 + s59;
  const s63 = s56 + u62;
  const e64 = u62 - (s63 - s56);
  const w65 = e64 + e61;
  const s66 = s63 + w65;
  const e67 = w65 - (s66 - s63);
  R[0] = s66;
  R[1] = e67;
}

/** The continued fractions stop after 100000 steps, where the largest coefficient is a + 2 * 100000 + 2 */
const CF_SPAN = 200002;

/**
 * Whether the steps a + 1, a + 2, ... of the continued fraction are not all exact in double (a < 2^52). They are all
 * exact when a + CF_SPAN is (the ulp only grows along the way), which for a > CF_SPAN is (a + CF_SPAN) - a === CF_SPAN.
 * Only from 2^20 on: below, the rounding of the steps (relative ε/2) moves the result by about an ulp (against the
 * double-double steps: 2e-16 on log P at a = 2^20, 7e-16 at 2^25), and the slower double-double steps would be taken
 * by most non-integer a (a + CF_SPAN crosses a binade for every a below 2^17)
 */
function stepsInexact(a: number): boolean {
  return a >= 2 ** 20 && a < 2 ** 52 && a + CF_SPAN - a !== CF_SPAN;
}

function continuedFractionCore(a: number, b: number, xd: DD, xcd: DD, second: boolean): number {
  if (!isDoubleDouble() || Math.max(a, b) >= 2 ** 52 || stepsInexact(a)) {
    return continuedFractionCoreOps(a, b, xd, xcd, second);
  }
  // The loop of continuedFractionCoreOps below on local variables, without allocating [hi, lo] arrays: the same
  // operations in the same order, so the result is bit-identical. Generated with python3 scripts/ddgen.py cf
  let zh = xd[0];
  let zl = xd[1];
  if (second) {
    sDiv(xd[0], xd[1], xcd[0], xcd[1]);
    zh = R[0]!;
    zl = R[1]!;
  }
  const s1 = b + -1;
  const bb2 = s1 - b;
  const e3 = b - (s1 - bb2) + (-1 - bb2);
  const s4 = a + b;
  const bb5 = s4 - a;
  const e6 = a - (s4 - bb5) + (b - bb5);
  let k2h = second ? s1 : s4;
  let k2l = second ? e3 : e6;
  let k6h = second ? s4 : s1;
  let k6l = second ? e6 : e3;
  let k1 = a;
  let k3 = a;
  let k4 = a + 1;
  let k5 = 1;
  let k7 = a + 1;
  let k8 = a + 2;
  const d1 = second ? -1 : 1;
  const nd1 = -d1;
  let pkm2h = 0;
  let pkm2l = 0;
  let qkm2h = 1;
  let qkm2l = 0;
  let pkm1h = 1;
  let pkm1l = 0;
  let qkm1h = 1;
  let qkm1l = 0;
  let ansh = 1;
  let ansl = 0;
  for (let n = 0; n < 100000; n++) {
    // xk = z k1 k2 / (k3 k4); pk = pkm1 - pkm2 xk, qk = qkm1 - qkm2 xk
    const p7 = zh * k1;
    const t8 = SPLITTER * zh;
    const ah9 = t8 - (t8 - zh);
    const al10 = zh - ah9;
    const t11 = SPLITTER * k1;
    const bh12 = t11 - (t11 - k1);
    const bl13 = k1 - bh12;
    const e14 = ah9 * bh12 - p7 + ah9 * bl13 + al10 * bh12 + al10 * bl13;
    const u15 = e14 + zl * k1;
    const s16 = p7 + u15;
    const e17 = u15 - (s16 - p7);
    const p18 = s16 * k2h;
    const t19 = SPLITTER * s16;
    const ah20 = t19 - (t19 - s16);
    const al21 = s16 - ah20;
    const t22 = SPLITTER * k2h;
    const bh23 = t22 - (t22 - k2h);
    const bl24 = k2h - bh23;
    const e25 = ah20 * bh23 - p18 + ah20 * bl24 + al21 * bh23 + al21 * bl24;
    const u26 = e25 + (s16 * k2l + e17 * k2h);
    const s27 = p18 + u26;
    const e28 = u26 - (s27 - p18);
    const p29 = k3 * k4;
    const t30 = SPLITTER * k3;
    const ah31 = t30 - (t30 - k3);
    const al32 = k3 - ah31;
    const t33 = SPLITTER * k4;
    const bh34 = t33 - (t33 - k4);
    const bl35 = k4 - bh34;
    const e36 = ah31 * bh34 - p29 + ah31 * bl35 + al32 * bh34 + al32 * bl35;
    sDiv(s27, e28, p29, e36);
    const qh37 = R[0]!;
    const ql38 = R[1]!;
    const p39 = pkm2h * qh37;
    const t40 = SPLITTER * pkm2h;
    const ah41 = t40 - (t40 - pkm2h);
    const al42 = pkm2h - ah41;
    const t43 = SPLITTER * qh37;
    const bh44 = t43 - (t43 - qh37);
    const bl45 = qh37 - bh44;
    const e46 = ah41 * bh44 - p39 + ah41 * bl45 + al42 * bh44 + al42 * bl45;
    const u47 = e46 + (pkm2h * ql38 + pkm2l * qh37);
    const s48 = p39 + u47;
    const e49 = u47 - (s48 - p39);
    const n50 = -s48;
    const n51 = -e49;
    const s52 = pkm1h + n50;
    const bb53 = s52 - pkm1h;
    const e54 = pkm1h - (s52 - bb53) + (n50 - bb53);
    const s55 = pkm1l + n51;
    const bb56 = s55 - pkm1l;
    const e57 = pkm1l - (s55 - bb56) + (n51 - bb56);
    const u58 = e54 + s55;
    const s59 = s52 + u58;
    const e60 = u58 - (s59 - s52);
    const w61 = e60 + e57;
    const s62 = s59 + w61;
    const e63 = w61 - (s62 - s59);
    const p64 = qkm2h * qh37;
    const t65 = SPLITTER * qkm2h;
    const ah66 = t65 - (t65 - qkm2h);
    const al67 = qkm2h - ah66;
    const t68 = SPLITTER * qh37;
    const bh69 = t68 - (t68 - qh37);
    const bl70 = qh37 - bh69;
    const e71 = ah66 * bh69 - p64 + ah66 * bl70 + al67 * bh69 + al67 * bl70;
    const u72 = e71 + (qkm2h * ql38 + qkm2l * qh37);
    const s73 = p64 + u72;
    const e74 = u72 - (s73 - p64);
    const n75 = -s73;
    const n76 = -e74;
    const s77 = qkm1h + n75;
    const bb78 = s77 - qkm1h;
    const e79 = qkm1h - (s77 - bb78) + (n75 - bb78);
    const s80 = qkm1l + n76;
    const bb81 = s80 - qkm1l;
    const e82 = qkm1l - (s80 - bb81) + (n76 - bb81);
    const u83 = e79 + s80;
    const s84 = s77 + u83;
    const e85 = u83 - (s84 - s77);
    const w86 = e85 + e82;
    const s87 = s84 + w86;
    const e88 = w86 - (s87 - s84);
    pkm2h = pkm1h;
    pkm2l = pkm1l;
    pkm1h = s62;
    pkm1l = e63;
    qkm2h = qkm1h;
    qkm2l = qkm1l;
    qkm1h = s87;
    qkm1l = e88;
    // xk = z k5 k6 / (k7 k8); pk = pkm1 + pkm2 xk, qk = qkm1 + qkm2 xk
    const p89 = zh * k5;
    const t90 = SPLITTER * zh;
    const ah91 = t90 - (t90 - zh);
    const al92 = zh - ah91;
    const t93 = SPLITTER * k5;
    const bh94 = t93 - (t93 - k5);
    const bl95 = k5 - bh94;
    const e96 = ah91 * bh94 - p89 + ah91 * bl95 + al92 * bh94 + al92 * bl95;
    const u97 = e96 + zl * k5;
    const s98 = p89 + u97;
    const e99 = u97 - (s98 - p89);
    const p100 = s98 * k6h;
    const t101 = SPLITTER * s98;
    const ah102 = t101 - (t101 - s98);
    const al103 = s98 - ah102;
    const t104 = SPLITTER * k6h;
    const bh105 = t104 - (t104 - k6h);
    const bl106 = k6h - bh105;
    const e107 = ah102 * bh105 - p100 + ah102 * bl106 + al103 * bh105 + al103 * bl106;
    const u108 = e107 + (s98 * k6l + e99 * k6h);
    const s109 = p100 + u108;
    const e110 = u108 - (s109 - p100);
    const p111 = k7 * k8;
    const t112 = SPLITTER * k7;
    const ah113 = t112 - (t112 - k7);
    const al114 = k7 - ah113;
    const t115 = SPLITTER * k8;
    const bh116 = t115 - (t115 - k8);
    const bl117 = k8 - bh116;
    const e118 = ah113 * bh116 - p111 + ah113 * bl117 + al114 * bh116 + al114 * bl117;
    sDiv(s109, e110, p111, e118);
    const qh119 = R[0]!;
    const ql120 = R[1]!;
    const p121 = pkm2h * qh119;
    const t122 = SPLITTER * pkm2h;
    const ah123 = t122 - (t122 - pkm2h);
    const al124 = pkm2h - ah123;
    const t125 = SPLITTER * qh119;
    const bh126 = t125 - (t125 - qh119);
    const bl127 = qh119 - bh126;
    const e128 = ah123 * bh126 - p121 + ah123 * bl127 + al124 * bh126 + al124 * bl127;
    const u129 = e128 + (pkm2h * ql120 + pkm2l * qh119);
    const s130 = p121 + u129;
    const e131 = u129 - (s130 - p121);
    const s132 = pkm1h + s130;
    const bb133 = s132 - pkm1h;
    const e134 = pkm1h - (s132 - bb133) + (s130 - bb133);
    const s135 = pkm1l + e131;
    const bb136 = s135 - pkm1l;
    const e137 = pkm1l - (s135 - bb136) + (e131 - bb136);
    const u138 = e134 + s135;
    const s139 = s132 + u138;
    const e140 = u138 - (s139 - s132);
    const w141 = e140 + e137;
    const s142 = s139 + w141;
    const e143 = w141 - (s142 - s139);
    const p144 = qkm2h * qh119;
    const t145 = SPLITTER * qkm2h;
    const ah146 = t145 - (t145 - qkm2h);
    const al147 = qkm2h - ah146;
    const t148 = SPLITTER * qh119;
    const bh149 = t148 - (t148 - qh119);
    const bl150 = qh119 - bh149;
    const e151 = ah146 * bh149 - p144 + ah146 * bl150 + al147 * bh149 + al147 * bl150;
    const u152 = e151 + (qkm2h * ql120 + qkm2l * qh119);
    const s153 = p144 + u152;
    const e154 = u152 - (s153 - p144);
    const s155 = qkm1h + s153;
    const bb156 = s155 - qkm1h;
    const e157 = qkm1h - (s155 - bb156) + (s153 - bb156);
    const s158 = qkm1l + e154;
    const bb159 = s158 - qkm1l;
    const e160 = qkm1l - (s158 - bb159) + (e154 - bb159);
    const u161 = e157 + s158;
    const s162 = s155 + u161;
    const e163 = u161 - (s162 - s155);
    const w164 = e163 + e160;
    const s165 = s162 + w164;
    const e166 = w164 - (s165 - s162);
    pkm2h = pkm1h;
    pkm2l = pkm1l;
    pkm1h = s142;
    pkm1l = e143;
    qkm2h = qkm1h;
    qkm2l = qkm1l;
    qkm1h = s165;
    qkm1l = e166;
    if (s165 !== 0) {
      sDiv(s142, e143, s165, e166);
      const qh167 = R[0]!;
      const ql168 = R[1]!;
      const t = qh167 !== 0 ? Math.abs((ansh - qh167) / qh167) : 1;
      ansh = qh167;
      ansl = ql168;
      if (t < MACHEP && n > 1) break;
    }
    const s169 = k2h + d1;
    const bb170 = s169 - k2h;
    const e171 = k2h - (s169 - bb170) + (d1 - bb170);
    const s172 = k2l + 0;
    const bb173 = s172 - k2l;
    const e174 = k2l - (s172 - bb173) + (0 - bb173);
    const u175 = e171 + s172;
    const s176 = s169 + u175;
    const e177 = u175 - (s176 - s169);
    const w178 = e177 + e174;
    const s179 = s176 + w178;
    const e180 = w178 - (s179 - s176);
    k2h = s179;
    k2l = e180;
    const s181 = k6h + nd1;
    const bb182 = s181 - k6h;
    const e183 = k6h - (s181 - bb182) + (nd1 - bb182);
    const s184 = k6l + 0;
    const bb185 = s184 - k6l;
    const e186 = k6l - (s184 - bb185) + (0 - bb185);
    const u187 = e183 + s184;
    const s188 = s181 + u187;
    const e189 = u187 - (s188 - s181);
    const w190 = e189 + e186;
    const s191 = s188 + w190;
    const e192 = w190 - (s191 - s188);
    k6h = s191;
    k6l = e192;
    k5 += 1;
    k1 += 1;
    k3 += 2;
    k4 += 2;
    k7 += 2;
    k8 += 2;
    // Rescaling (both conditions are tested on this step's pk, qk)
    if (Math.abs(s165) + Math.abs(s142) > BIG) {
      const p193 = pkm2h * BIGINV;
      const t194 = SPLITTER * pkm2h;
      const ah195 = t194 - (t194 - pkm2h);
      const al196 = pkm2h - ah195;
      const t197 = SPLITTER * BIGINV;
      const bh198 = t197 - (t197 - BIGINV);
      const bl199 = BIGINV - bh198;
      const e200 = ah195 * bh198 - p193 + ah195 * bl199 + al196 * bh198 + al196 * bl199;
      const u201 = e200 + pkm2l * BIGINV;
      const s202 = p193 + u201;
      const e203 = u201 - (s202 - p193);
      pkm2h = s202;
      pkm2l = e203;
      const p204 = pkm1h * BIGINV;
      const t205 = SPLITTER * pkm1h;
      const ah206 = t205 - (t205 - pkm1h);
      const al207 = pkm1h - ah206;
      const t208 = SPLITTER * BIGINV;
      const bh209 = t208 - (t208 - BIGINV);
      const bl210 = BIGINV - bh209;
      const e211 = ah206 * bh209 - p204 + ah206 * bl210 + al207 * bh209 + al207 * bl210;
      const u212 = e211 + pkm1l * BIGINV;
      const s213 = p204 + u212;
      const e214 = u212 - (s213 - p204);
      pkm1h = s213;
      pkm1l = e214;
      const p215 = qkm2h * BIGINV;
      const t216 = SPLITTER * qkm2h;
      const ah217 = t216 - (t216 - qkm2h);
      const al218 = qkm2h - ah217;
      const t219 = SPLITTER * BIGINV;
      const bh220 = t219 - (t219 - BIGINV);
      const bl221 = BIGINV - bh220;
      const e222 = ah217 * bh220 - p215 + ah217 * bl221 + al218 * bh220 + al218 * bl221;
      const u223 = e222 + qkm2l * BIGINV;
      const s224 = p215 + u223;
      const e225 = u223 - (s224 - p215);
      qkm2h = s224;
      qkm2l = e225;
      const p226 = qkm1h * BIGINV;
      const t227 = SPLITTER * qkm1h;
      const ah228 = t227 - (t227 - qkm1h);
      const al229 = qkm1h - ah228;
      const t230 = SPLITTER * BIGINV;
      const bh231 = t230 - (t230 - BIGINV);
      const bl232 = BIGINV - bh231;
      const e233 = ah228 * bh231 - p226 + ah228 * bl232 + al229 * bh231 + al229 * bl232;
      const u234 = e233 + qkm1l * BIGINV;
      const s235 = p226 + u234;
      const e236 = u234 - (s235 - p226);
      qkm1h = s235;
      qkm1l = e236;
    }
    if (Math.abs(s165) < BIGINV || Math.abs(s142) < BIGINV) {
      const p237 = pkm2h * BIG;
      const t238 = SPLITTER * pkm2h;
      const ah239 = t238 - (t238 - pkm2h);
      const al240 = pkm2h - ah239;
      const t241 = SPLITTER * BIG;
      const bh242 = t241 - (t241 - BIG);
      const bl243 = BIG - bh242;
      const e244 = ah239 * bh242 - p237 + ah239 * bl243 + al240 * bh242 + al240 * bl243;
      const u245 = e244 + pkm2l * BIG;
      const s246 = p237 + u245;
      const e247 = u245 - (s246 - p237);
      pkm2h = s246;
      pkm2l = e247;
      const p248 = pkm1h * BIG;
      const t249 = SPLITTER * pkm1h;
      const ah250 = t249 - (t249 - pkm1h);
      const al251 = pkm1h - ah250;
      const t252 = SPLITTER * BIG;
      const bh253 = t252 - (t252 - BIG);
      const bl254 = BIG - bh253;
      const e255 = ah250 * bh253 - p248 + ah250 * bl254 + al251 * bh253 + al251 * bl254;
      const u256 = e255 + pkm1l * BIG;
      const s257 = p248 + u256;
      const e258 = u256 - (s257 - p248);
      pkm1h = s257;
      pkm1l = e258;
      const p259 = qkm2h * BIG;
      const t260 = SPLITTER * qkm2h;
      const ah261 = t260 - (t260 - qkm2h);
      const al262 = qkm2h - ah261;
      const t263 = SPLITTER * BIG;
      const bh264 = t263 - (t263 - BIG);
      const bl265 = BIG - bh264;
      const e266 = ah261 * bh264 - p259 + ah261 * bl265 + al262 * bh264 + al262 * bl265;
      const u267 = e266 + qkm2l * BIG;
      const s268 = p259 + u267;
      const e269 = u267 - (s268 - p259);
      qkm2h = s268;
      qkm2l = e269;
      const p270 = qkm1h * BIG;
      const t271 = SPLITTER * qkm1h;
      const ah272 = t271 - (t271 - qkm1h);
      const al273 = qkm1h - ah272;
      const t274 = SPLITTER * BIG;
      const bh275 = t274 - (t274 - BIG);
      const bl276 = BIG - bh275;
      const e277 = ah272 * bh275 - p270 + ah272 * bl276 + al273 * bh275 + al273 * bl276;
      const u278 = e277 + qkm1l * BIG;
      const s279 = p270 + u278;
      const e280 = u278 - (s279 - p270);
      qkm1h = s279;
      qkm1l = e280;
    }
  }
  return ansh + ansl;
}

/** continuedFractionCore with calls to the double-double helpers (also for huge parameters and double-precision mode) */
function continuedFractionCoreOps(a: number, b: number, xd: DD, xcd: DD, second: boolean): number {
  // #1: coefficients use x; #2: coefficients use z = x/(1-x)
  const z: DD = second ? ddDiv(xd, xcd) : xd;
  const huge = Math.max(a, b) >= 2 ** 52 || stepsInexact(a);
  // Above 1e150 the products of two of the parameters (h3 h4 = a (a + 1), ...) overflow: divide before multiplying
  const vast = Math.max(a, b) > 1e150;
  // The splitting of an operand, or of a quotient, above about 1.3e300 overflows in ddDiv and ddMul: where one would be
  // that large, the operands are scaled by 2^±64 first (exactly; the other operand is then small, or the result
  // overflows anyway), and a quotient back. pbeta(1.5e-236, 9220.5, 2.6e301) and pbeta(1e-307, 55.1, 6.3e307) were NaN
  const div = (p: DD, q: DD): DD => {
    if (q[0] > 1e299) return ddDiv(scaled(p, 2 ** -64), scaled(q, 2 ** -64));
    if (Math.abs(p[0]) > 1e299 * q[0]) return scaled(ddDiv(scaled(p, 2 ** -64), q), 2 ** 64);
    return ddDiv(p, q);
  };
  const mul = (p: DD, q: DD): DD => {
    if (Math.abs(q[0]) > 1e299) return ddMul(scaled(p, 2 ** 64), scaled(q, 2 ** -64));
    if (Math.abs(p[0]) > 1e299) return ddMul(scaled(p, 2 ** -64), scaled(q, 2 ** 64));
    return ddMul(p, q);
  };
  // Partial numerators k1 x k2 / (k3 k4) and k5 x k6 / (k7 k8). k1, k3, k4, k7, k8 are doubles, with
  // double-double copies (h1, ...) that are used and advanced only when huge
  let k1 = a;
  let k2: DD = second ? twoSum(b, -1) : twoSum(a, b);
  let k3 = a;
  let k4 = a + 1;
  let k5 = 1;
  let k6: DD = second ? twoSum(a, b) : twoSum(b, -1);
  let k7 = a + 1;
  let k8 = a + 2;
  let h1: DD = [a, 0];
  let h3: DD = [a, 0];
  let h4: DD = twoSum(a, 1);
  let h7: DD = twoSum(a, 1);
  let h8: DD = twoSum(a, 2);
  const d1 = second ? -1 : 1;
  let pkm2: DD = [0, 0];
  let qkm2: DD = [1, 0];
  let pkm1: DD = [1, 0];
  let qkm1: DD = [1, 0];
  let ans: DD = [1, 0];
  for (let n = 0; n < 100000; n++) {
    let xk = vast
      ? mul(mul(z, div(h1, h3)), div(k2, h4))
      : huge
        ? ddDiv(ddMul(ddMul(z, h1), k2), ddMul(h3, h4))
        : ddDiv(ddMul(ddMulNum(z, k1), k2), twoProd(k3, k4));
    let pk = ddSub(pkm1, ddMul(pkm2, xk));
    let qk = ddSub(qkm1, ddMul(qkm2, xk));
    pkm2 = pkm1;
    pkm1 = pk;
    qkm2 = qkm1;
    qkm1 = qk;
    xk = vast
      ? mul(mul(z, [k5, 0]), div(div(k6, h7), h8))
      : ddDiv(ddMul(ddMulNum(z, k5), k6), huge ? ddMul(h7, h8) : twoProd(k7, k8));
    pk = ddAdd(pkm1, ddMul(pkm2, xk));
    qk = ddAdd(qkm1, ddMul(qkm2, xk));
    pkm2 = pkm1;
    pkm1 = pk;
    qkm2 = qkm1;
    qkm1 = qk;
    if (qk[0] !== 0) {
      const r = ddDiv(pk, qk);
      const t = r[0] !== 0 ? Math.abs((ans[0] - r[0]) / r[0]) : 1;
      ans = r;
      if (t < MACHEP && n > 1) break;
    }
    k2 = ddAdd(k2, [d1, 0]);
    k6 = ddAdd(k6, [-d1, 0]);
    k5 += 1;
    if (huge) {
      h1 = ddAdd(h1, [1, 0]);
      h3 = ddAdd(h3, [2, 0]);
      h4 = ddAdd(h4, [2, 0]);
      h7 = ddAdd(h7, [2, 0]);
      h8 = ddAdd(h8, [2, 0]);
    } else {
      k1 += 1;
      k3 += 2;
      k4 += 2;
      k7 += 2;
      k8 += 2;
    }
    const mag = Math.abs(qk[0]) + Math.abs(pk[0]);
    if (mag > BIG) {
      pkm2 = ddMulNum(pkm2, BIGINV);
      pkm1 = ddMulNum(pkm1, BIGINV);
      qkm2 = ddMulNum(qkm2, BIGINV);
      qkm1 = ddMulNum(qkm1, BIGINV);
    }
    if (Math.abs(qk[0]) < BIGINV || Math.abs(pk[0]) < BIGINV) {
      pkm2 = ddMulNum(pkm2, BIG);
      pkm1 = ddMulNum(pkm1, BIG);
      qkm2 = ddMulNum(qkm2, BIG);
      qkm1 = ddMulNum(qkm1, BIG);
    }
  }
  return ans[0] + ans[1];
}

/** p s for a power of two s */
function scaled(p: DD, s: number): DD {
  return [p[0] * s, p[1] * s];
}

/** Whether the series can be used in frame (a, b, x) */
function pseriesOk(a: number, b: number, x: number): boolean {
  return b * x <= 1 && x <= 0.95;
}

/**
 * Whether to compute I_x(a, b) by continued fraction in frame (a, b, x) (below the mean, as in xsf). Above x = 1/2 the
 * test is 1 - x >= b/(a + b), on the smaller sides: x and the mean can both round to 1 (pnbinom(2.6e200, 3.1e287,
 * { mu: 195.6 }) has 1 - x = 6.3e-286 against b/(a + b) = 8.5e-88, and the continued fraction above the mean was NaN)
 */
function cfOk(a: number, b: number, x: DD, xc: DD): boolean {
  if (x[0] <= 0.5) return x[0] <= a / (a + b);
  // (b/(a + b) as 1/(1 + a/b) where a + b overflows)
  return xc[0] >= (a + b < Infinity ? b / (a + b) : 1 / (1 + a / b));
}

/** Compute I_x(a, b) by continued fraction */
function continuedFraction(a: number, b: number, xd: DD, xcd: DD, log: boolean): number {
  const x = xd[0];
  const xc = xcd[0];
  /* Choose expansion for better convergence */
  const y = x * (a + b - 2) - (a - 1);
  const w = y < 0 ? continuedFractionCore(a, b, xd, xcd, false) : continuedFractionCore(a, b, xd, xcd, true) / xc;
  // I = x^a (1-x)^b / (a B(a, b)) * w
  if (!log) {
    const pf = prefactor(a, b, xd, xcd);
    // w / a first: pf / a can fall into the subnormal range for huge a (1e-316 at a = 7e18) and lose digits
    if (pf > NORMAL_MIN) return pf * (w / a);
    const v = smallPrefactorTimes(a, b, xd, xcd, w / a);
    if (v !== undefined) return v;
  }
  const lv = logPrefactor(a, b, xd, xcd) - Math.log(a) + Math.log(w);
  return log ? lv : Math.exp(lv);
}

/**
 * Regularized incomplete beta function: I_x(a, b) if lower, otherwise 1 - I_x(a, b).
 * The caller passes xc = 1 - x accurately. Assumes a, b > 0 and 0 <= x <= 1.
 *
 * The requested tail is computed by the first applicable subtraction-free method in this order:
 * 1. series in that tail's frame  2. complement of the series in the opposite frame (pseriesComplement)
 * 3. continued fraction in that tail's frame  4. 1 - (other side) from the continued fraction in the opposite frame
 * (the lower frame is (a, b, x); the upper is (b, a, 1-x) via 1 - I_x(a,b) = I_{1-x}(b, a))
 */
export function betaInc(a: number, b: number, x: number, xc: number, lower: boolean, log: boolean): number {
  if (x <= 0) return lower ? (log ? -Infinity : 0) : log ? 0 : 1;
  if (xc <= 0) return lower ? (log ? 0 : 1) : log ? -Infinity : 0;
  // Take the smaller of x and 1 - x as the base and form the other exactly in double-double
  // (for pbeta(q), either q or 1 - q is exact, and then the other is free of rounding too)
  const xd: DD = x <= xc ? [x, 0] : twoSum(1, -xc);
  const xcd: DD = x <= xc ? twoSum(1, -x) : [xc, 0];
  return betaIncDD(a, b, xd, xcd, lower, log);
}

/**
 * Version of betaInc taking x and 1 - x in double-double.
 * When x is itself computed, as in n/(n + t^2) for the t distribution, its rounding (0.5 ulp) is amplified
 * a times (3e-14 at a = 500), so the caller builds it in double-double and passes it as is.
 */
export function betaIncDD(a: number, b: number, xd: DD, xcd: DD, lower: boolean, log: boolean): number {
  const r = betaIncCore(a, b, xd, xcd, lower, log);
  return log ? r[0] : r[1];
}

/**
 * Return both the log and the linear value of betaIncDD from a single core computation ([log, linear]).
 * Used by the Newton iteration for quantiles, which needs both the log and linear distribution function at the same x.
 * The values are bit-identical to betaIncDD(..., true) and betaIncDD(..., false) respectively
 */
export function betaIncBothDD(a: number, b: number, xd: DD, xcd: DD, lower: boolean): [number, number] {
  return betaIncCore(a, b, xd, xcd, lower, true);
}

/** Version of betaInc returning both (takes x and 1 - x in double precision, like betaInc) */
export function betaIncBoth(a: number, b: number, x: number, xc: number, lower: boolean): [number, number] {
  if (x <= 0) return lower ? [-Infinity, 0] : [0, 1];
  if (xc <= 0) return lower ? [0, 1] : [-Infinity, 0];
  const xd: DD = x <= xc ? [x, 0] : twoSum(1, -xc);
  const xcd: DD = x <= xc ? twoSum(1, -x) : [xc, 0];
  return betaIncCore(a, b, xd, xcd, lower, true);
}

const DBL_MIN = 2.2250738585072014e-308;

/**
 * I_x(a, b) (lower) or 1 - I_x(a, b) for x below DBL_MIN, from x and lx = log x in double-double (x itself may have
 * underflowed to 0, as in the F distribution far out: only lx then carries it), as [log, linear] (log NaN unless
 * wantLog). From the series I_x(a, b) = x^a / (a B(a, b)) (1 + a S), S = pseriesSum(a, b, x): the terms of S are about
 * (-b x)^n / n!, and b x is at most 4 here (b near the largest double), mostly negligible.
 * log(1/(a B(a, b))) is lgamma(a+b) - lgamma(b) - lgamma(a+1) without subtraction, or for a small shape
 * log(b/(a + b)) + log Γ(1+a+b)/(Γ(1+a) Γ(1+b)) with the ratio r = b/(a + b) kept on the linear scale (as a log, its
 * rounding of ε |log r| would become the relative error of the result)
 */
export function betaIncTinyX(a: number, b: number, x: number, lx: DD, lower: boolean, wantLog: boolean): [number, number] {
  const c = Math.log1p(a * pseriesSum(a, b, x));
  let r = 1;
  let lr = 0;
  let e: DD;
  if (Math.min(a, b) < SMALL_SHAPE) {
    const q = Math.min(a, b) / Math.max(a, b);
    [r, lr] = a <= b ? [1 / (1 + q), -Math.log1p(q)] : [q / (1 + q), Math.log(q) - Math.log1p(q)];
    e = ddAdd(ddAdd(ddMulNum(lx, a), smallShapeG(a, b)), [c, 0]);
  } else {
    const lg = b >= HUGE_SHAPE && a <= HUGE_SHAPE_MAX_SMALL ? lgammaRatioHuge(a, b) : lgammaDiffDD(a, b);
    e = ddAdd(ddAdd(ddMulNum(lx, a), lg), [c - lgamma1p(a), 0]);
  }
  const lt = lr + e[0] + e[1];
  const v = r * (Math.exp(e[0]) * (1 + e[1]));
  if (lower) return [lt, v];
  // The other tail: -expm1(lt), and its log from v where v is small (lt rounded to a double is off by up to ε |lt|,
  // which would become the relative error of the result for |lt| > 700) and from -expm1(lt) where v is close to 1
  // (log1p(-v) would lose the digits of 1 - v: 1 - I is -Infinity for x = 5e-324 at a = 5.7e-37)
  return [wantLog ? (lt < -Math.LN2 ? Math.log1p(-v) : Math.log(-Math.expm1(lt))) : NaN, -Math.expm1(lt)];
}

/**
 * Core of betaIncDD. Returns [log, linear]. The linear value is always computed; the log only when wantLog
 * (otherwise the log slot is NaN). The log is log(v) of the linear value v; if v exceeds 1/2 the other side is
 * computed directly and log1p is used, and if v is close to subnormal it is recomputed on the spot.
 * A value within rounding of 1 can come out an ulp above it (from the product of a prefactor and a series near 1:
 * pbeta(0.615, 2, 2.7e-158, { lowerTail: false }) was 1.0000000000000002), so it is capped at 1 (log at 0)
 */
function betaIncCore(a: number, b: number, xd: DD, xcd: DD, lower: boolean, wantLog: boolean): [number, number] {
  const r = betaIncUncapped(a, b, xd, xcd, lower, wantLog);
  return r[1] > 1 || r[0] > 0 ? [Math.min(r[0], 0), Math.min(r[1], 1)] : r;
}

/**
 * Below this shape s, the tail of the order of s (1 - I_x(s, b), or I_x(a, s)) is taken as (s / SUB_SHAPE) times its
 * value at SUB_SHAPE, where the other shape is above SUB_OTHER: 1 - I_x(s, b) = s g(x, b) (1 + O(s / min(1, b)) times
 * logs of x and b), so the relative error of the scaling is below 1e-19. The tail is subnormal for s below 1e-308 or
 * so, and its log, taken of the subnormal value, had lost digits (dbeta(0.97, 0.13, 8.15e-322) did not match the
 * differences of pbeta(x, 0.13, 8.15e-322, { logP: true }))
 */
const SUB_SHAPE = 1e-300;
const SUB_OTHER = 1e-280;

/** [log, linear] of the tail t at SUB_SHAPE scaled to the shape s (small), or of the other tail (!small) */
function subShapeTail(t: [number, number], s: number, small: boolean): [number, number] {
  const r = s / SUB_SHAPE;
  const v = t[1] * r;
  if (small) return [t[0] + Math.log(r), v];
  return [Math.log1p(-v), 1 - v];
}

function betaIncUncapped(a: number, b: number, xd: DD, xcd: DD, lower: boolean, wantLog: boolean): [number, number] {
  if (xd[0] <= 0) return lower ? [-Infinity, 0] : [0, 1];
  if (xcd[0] <= 0) return lower ? [0, 1] : [-Infinity, 0];

  // The tail of the order of a shape below SUB_SHAPE (1 - I_x(a, b) for a tiny a, I_x(a, b) for a tiny b), from
  // that at SUB_SHAPE scaled (see there), and the other tail as 1 minus it
  if (a < SUB_SHAPE && b > SUB_OTHER) return subShapeTail(betaIncUncapped(SUB_SHAPE, b, xd, xcd, false, wantLog), a, !lower);
  if (b < SUB_SHAPE && a > SUB_OTHER) return subShapeTail(betaIncUncapped(a, SUB_SHAPE, xd, xcd, true, wantLog), b, lower);

  // x (or 1 - x) is subnormal: the series with its prefactor in logs (betaIncTinyX). The binomial-probability helpers
  // break down on products of subnormals
  if (xd[0] < DBL_MIN) return betaIncTinyX(a, b, xd[0], ddLog(xd), lower, wantLog);
  if (xcd[0] < DBL_MIN) return betaIncTinyX(b, a, xcd[0], ddLog(xcd), !lower, wantLog);

  // Both parameters large and x near the mean: the uniform asymptotic expansion, whose cost does not grow with
  // the parameters (the continued fraction needs about sqrt(a + b) steps there)
  if (a >= TEMME_MIN_M && b >= TEMME_MIN_M) {
    const t = betaIncTemme(a, b, xd, xcd, lower, wantLog);
    if (t !== undefined) return t;
  }

  const [pa, pb, px, pxc] = lower ? [a, b, xd, xcd] : [b, a, xcd, xd];
  const [oa, ob, ox, oxc] = lower ? [b, a, xcd, xd] : [a, b, xd, xcd];

  // One parameter large and the other small: where the continued fraction would be used below, the expansion for
  // large a (incbetLargeA.ts) instead, in the frame of the large parameter. The length of the continued fraction
  // stops growing with the large parameter, but in the bulk it takes 30 to 170 double-double steps; the expansion
  // takes a few terms
  // Also for a larger small parameter (up to 1e4, as the expansion takes about b/2 steps) where x rounds to 1 in the
  // frame of the large one (then l = -log x is below ε and the terms after the leading Q(b, u) or P(b, u) vanish):
  // the continued fraction is NaN there (pnbinom(1.9e153, 44.4, { prob: 1.6e-149, lowerTail: false }))
  const largeA =
    Math.max(a, b) >= LARGE_A_MIN &&
    (Math.min(a, b) <= SMALL_B_MAX ||
      ((a >= b ? xd[0] : xcd[0]) === 1 && Math.min(a, b) <= 1e4 && Math.min(a, b) < 1e-8 * Math.max(a, b)));
  const viaLargeA = (low: boolean, log: boolean): [number, number] | undefined => {
    if (!largeA) return undefined;
    return a >= b ? betaIncLargeA(a, b, xd, xcd, low, log) : betaIncLargeA(b, a, xcd, xd, !low, log);
  };

  // The log of a value near 1 is built with log1p from a direct computation of the other side
  const finish = (v: number, other: () => number | undefined): [number, number] => {
    if (!wantLog) return [NaN, v];
    if (v > 0.5) {
      const o = other();
      if (o !== undefined) return [Math.log1p(-o), v];
    }
    return [Math.log(v), v];
  };
  // The other tail, if it can be computed without subtraction
  const otherDirect = (): number | undefined => {
    if (pseriesOk(oa, ob, ox[0])) return pseries(oa, ob, ox, oxc, false);
    if (pseriesOk(pa, pb, px[0])) {
      const v = pseriesComplement(pa, pb, px, false);
      // Cancellation check as for the requested tail (see below)
      if (pa * Math.abs(Math.log(px[0])) > 32 * v) {
        const e = viaLargeA(!lower, false)?.[1];
        if (e !== undefined) return e;
        if (ox[0] < 1 && cfOk(oa, ob, ox, oxc)) return continuedFraction(oa, ob, ox, oxc, false);
      }
      return v;
    }
    if (cfOk(oa, ob, ox, oxc)) return viaLargeA(!lower, false)?.[1] ?? continuedFraction(oa, ob, ox, oxc, false);
    return undefined;
  };

  // A directly computed value close to subnormal has few significant digits, so recompute the log on the spot
  const TINY = 1e-290;
  if (pseriesOk(pa, pb, px[0])) {
    const v = pseries(pa, pb, px, pxc, false);
    if (wantLog && v < TINY) return [pseries(pa, pb, px, pxc, true), v];
    // Above 1/2 with the series applying in the other frame too: 1 minus the other tail, which is accurate to about an
    // ulp, while this series near x = 0.95 sums hundreds of terms whose products round (pbeta(0.9398, 0.0209, 0.723)
    // and its upper tail added up to 1 - 2e-15)
    if (v > 0.5 && pseriesOk(oa, ob, ox[0])) {
      const o = pseries(oa, ob, ox, oxc, false);
      return [wantLog ? Math.log1p(-o) : NaN, 1 - o];
    }
    // Likewise from the complement of the series where it passes the cancellation check (see below), as the log already
    // is: for a tiny shape the series value is 1 - O(shape) and its rounding of a few ulps was all of its distance from 1
    // (pbeta(1 - 6e-14, 0.97, 4.7e-307, { lowerTail: false }) was 1 - 1.1e-16 beside a lower tail of 1.4e-305)
    if (v > 0.5) {
      const o = pseriesComplement(pa, pb, px, false);
      if (pa * Math.abs(Math.log(px[0])) <= 32 * o) return [wantLog ? Math.log1p(-o) : NaN, 1 - o];
    }
    return finish(v, otherDirect);
  }
  if (pseriesOk(oa, ob, ox[0])) {
    // Where the other tail is below 1/2, 1 minus it is accurate to about an ulp, while the exponent of
    // pseriesComplement rounds at ε (|a log x| + |lgamma(b + a) - lgamma(b)| + |lgamma(a + 1)|), terms that cancel
    // (pbinom(20, 21, 0.9265) was 0.7985148925910792, 2e-15 above 1 - prob^21)
    const o = pseries(oa, ob, ox, oxc, false);
    if (o < 0.5) return [wantLog ? Math.log1p(-o) : NaN, 1 - o];
    const v = pseriesComplement(oa, ob, ox, false);
    // The exponent L of pseriesComplement is a sum of terms of size a |log x| that can cancel, and their rounding
    // (absolute, about ε a |log x|) is then large relative to a small result (1e-14 at a = 0.01, b = 1e4, x = 1e-4).
    // When a |log x| exceeds the result 32 times, use the expansion for large a where it applies, or the continued
    // fraction where it applies in this tail's frame (a lower threshold would also send cases where the series is
    // accurate, e.g. most of pt near 0, to the slower continued fraction). The expansion does not need the continued
    // fraction's side of the mean (the upper tail of pbeta(5.6e-161, 0.82, 1.5e160) was off by 8e-14 from the series)
    // (The continued fraction not when x rounds to 1 in this frame, with 1 - x below ε, e.g. pnbinom with size 6e178:
    // it is then NaN, and the exponent is so negative that the series value is 1 to double precision)
    if (oa * Math.abs(Math.log(ox[0])) > 32 * v) {
      const e = viaLargeA(lower, wantLog);
      if (e !== undefined) return e;
      if (px[0] < 1 && cfOk(pa, pb, px, pxc)) {
        const w = continuedFraction(pa, pb, px, pxc, false);
        if (wantLog && w < TINY) return [continuedFraction(pa, pb, px, pxc, true), w];
        return finish(w, otherDirect);
      }
    }
    return finish(v, () => o);
  }
  const e = viaLargeA(lower, wantLog);
  if (e !== undefined) return e;
  if (cfOk(pa, pb, px, pxc)) {
    const v = continuedFraction(pa, pb, px, pxc, false);
    if (wantLog && v < TINY) return [continuedFraction(pa, pb, px, pxc, true), v];
    return finish(v, otherDirect);
  }
  // 1 - (other side), from the other side (below the mean, hence small)
  const o = continuedFraction(oa, ob, ox, oxc, false);
  return [wantLog ? Math.log1p(-o) : NaN, 1 - o];
}

/** log(1 - x) from the double-double representation of x */
function log1pNeg(xd: DD): number {
  return Math.log1p(-xd[0]) - xd[1] / (1 - xd[0]);
}
