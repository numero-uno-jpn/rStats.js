// Double-double arithmetic (about 106 bits of precision from the sum hi + lo of two doubles).
//
// When Loader's method computes a probability as exp(-E), the absolute error of E becomes the relative error
// of the probability. In tails where E is in the hundreds (probabilities around 1e-300), double precision alone
// gives relative errors up to 1e-13, so only the parts that assemble E are computed at this precision.
// The technique is the error-free transformations of Dekker (1971) and Knuth TAOCP 4.2.2.

/** [hi, lo] represents hi + lo. |lo| <= ulp(hi)/2 */
export type DD = readonly [number, number];

/** 2^27 + 1 used for Veltkamp splitting (exported for use by the expanded code) */
export const SPLITTER = 134217729;

// Switch for evaluation (not part of the public API). When false, every helper drops its error term and computes
// in plain double precision. Used to measure the accuracy and speed without double-double
// (scripts/bench.mjs and the RSTATS_PRECISION=double tests; see docs/performance.md)
let ddEnabled = true;

export function setDoubleDouble(on: boolean): void {
  ddEnabled = on;
}

export function isDoubleDouble(): boolean {
  return ddEnabled;
}

/** [s, e] satisfying a + b = s + e exactly */
export function twoSum(a: number, b: number): DD {
  if (!ddEnabled) return [a + b, 0];
  const s = a + b;
  // A sum, product or quotient beyond the double range has no error term (the steps below would make it NaN)
  if (!Number.isFinite(s)) return [s, 0];
  const bb = s - a;
  const e = a - (s - bb) + (b - bb);
  return [s, e];
}

/** x 2^k, in two steps so that 2^k itself cannot overflow or underflow */
function scale2(x: number, k: number): number {
  const h = Math.trunc(k / 2);
  return x * 2 ** h * 2 ** (k - h);
}

/**
 * The rounding error a * b - fl(a * b) for operands so large that Veltkamp splitting overflows: each operand is
 * scaled near 1 by a power of 2 (exact), and the error of the scaled product scaled back
 */
function prodErrScaled(a: number, b: number): number {
  const ka = a === 0 ? 0 : Math.floor(Math.log2(Math.abs(a)));
  const kb = b === 0 ? 0 : Math.floor(Math.log2(Math.abs(b)));
  const x = scale2(a, -ka);
  const y = scale2(b, -kb);
  const p = x * y;
  let t = SPLITTER * x;
  const xh = t - (t - x);
  const xl = x - xh;
  t = SPLITTER * y;
  const yh = t - (t - y);
  const yl = y - yh;
  return scale2(scale2(xh * yh - p + xh * yl + xl * yh + xl * yl, ka), kb);
}

/** [p, e] satisfying a * b = p + e exactly (Veltkamp splitting) */
export function twoProd(a: number, b: number): DD {
  if (!ddEnabled) return [a * b, 0];
  const p = a * b;
  // A sum, product or quotient beyond the double range has no error term (the steps below would make it NaN)
  if (!Number.isFinite(p)) return [p, 0];
  let t = SPLITTER * a;
  const ah = t - (t - a);
  const al = a - ah;
  t = SPLITTER * b;
  const bh = t - (t - b);
  const bl = b - bh;
  let e = ah * bh - p + ah * bl + al * bh + al * bl;
  if (!Number.isFinite(e) && Number.isFinite(p)) e = prodErrScaled(a, b);
  return [p, e];
}

// The helpers below expand the form that calls twoSum, quickTwoSum and twoProd (Dekker / Knuth), keeping the same
// operations in the same order. They are faster because they allocate no intermediate [hi, lo] arrays (the results
// are bit-identical to the calling form; see docs/performance.md). Variable names: s and e are the sum and error of
// twoSum / quickTwoSum, p and e the product and error of twoProd, q a quotient, n a negated value. Generated with
// scripts/ddgen.py (python3 scripts/ddgen.py ops).

export function ddAdd(a: DD, b: DD): DD {
  if (!ddEnabled) return [a[0] + b[0], 0];
  const s1 = a[0] + b[0];
  // A sum, product or quotient beyond the double range has no error term (the steps below would make it NaN)
  if (!Number.isFinite(s1)) return [s1, 0];
  const bb2 = s1 - a[0];
  const e3 = a[0] - (s1 - bb2) + (b[0] - bb2);
  const s4 = a[1] + b[1];
  const bb5 = s4 - a[1];
  const e6 = a[1] - (s4 - bb5) + (b[1] - bb5);
  const u7 = e3 + s4;
  const s8 = s1 + u7;
  const e9 = u7 - (s8 - s1);
  const w10 = e9 + e6;
  const s11 = s8 + w10;
  const e12 = w10 - (s11 - s8);
  return [s11, e12];
}

export function ddNeg(a: DD): DD {
  return [-a[0], -a[1]];
}

export function ddSub(a: DD, b: DD): DD {
  if (!ddEnabled) return [a[0] - b[0], 0];
  const n1 = -b[0];
  const n2 = -b[1];
  const s3 = a[0] + n1;
  // A sum, product or quotient beyond the double range has no error term (the steps below would make it NaN)
  if (!Number.isFinite(s3)) return [s3, 0];
  const bb4 = s3 - a[0];
  const e5 = a[0] - (s3 - bb4) + (n1 - bb4);
  const s6 = a[1] + n2;
  const bb7 = s6 - a[1];
  const e8 = a[1] - (s6 - bb7) + (n2 - bb7);
  const u9 = e5 + s6;
  const s10 = s3 + u9;
  const e11 = u9 - (s10 - s3);
  const w12 = e11 + e8;
  const s13 = s10 + w12;
  const e14 = w12 - (s13 - s10);
  return [s13, e14];
}

export function ddMul(a: DD, b: DD): DD {
  if (!ddEnabled) return [a[0] * b[0], 0];
  const p1 = a[0] * b[0];
  // A sum, product or quotient beyond the double range has no error term (the steps below would make it NaN)
  if (!Number.isFinite(p1)) return [p1, 0];
  const t2 = SPLITTER * a[0];
  const ah3 = t2 - (t2 - a[0]);
  const al4 = a[0] - ah3;
  const t5 = SPLITTER * b[0];
  const bh6 = t5 - (t5 - b[0]);
  const bl7 = b[0] - bh6;
  let e8 = ah3 * bh6 - p1 + ah3 * bl7 + al4 * bh6 + al4 * bl7;
  if (!Number.isFinite(e8) && Number.isFinite(p1)) e8 = prodErrScaled(a[0], b[0]);
  const u9 = e8 + (a[0] * b[1] + a[1] * b[0]);
  const s10 = p1 + u9;
  const e11 = u9 - (s10 - p1);
  return [s10, e11];
}

export function ddMulNum(a: DD, b: number): DD {
  if (!ddEnabled) return [a[0] * b, 0];
  const p1 = a[0] * b;
  // A sum, product or quotient beyond the double range has no error term (the steps below would make it NaN)
  if (!Number.isFinite(p1)) return [p1, 0];
  const t2 = SPLITTER * a[0];
  const ah3 = t2 - (t2 - a[0]);
  const al4 = a[0] - ah3;
  const t5 = SPLITTER * b;
  const bh6 = t5 - (t5 - b);
  const bl7 = b - bh6;
  let e8 = ah3 * bh6 - p1 + ah3 * bl7 + al4 * bh6 + al4 * bl7;
  if (!Number.isFinite(e8) && Number.isFinite(p1)) e8 = prodErrScaled(a[0], b);
  const u9 = e8 + a[1] * b;
  const s10 = p1 + u9;
  const e11 = u9 - (s10 - p1);
  return [s10, e11];
}

export function ddDiv(a: DD, b: DD): DD {
  if (!ddEnabled) return [a[0] / b[0], 0];
  const q1 = a[0] / b[0];
  // A sum, product or quotient beyond the double range has no error term (the steps below would make it NaN)
  if (!Number.isFinite(q1)) return [q1, 0];
  const p2 = b[0] * q1;
  const t3 = SPLITTER * b[0];
  const ah4 = t3 - (t3 - b[0]);
  const al5 = b[0] - ah4;
  const t6 = SPLITTER * q1;
  const bh7 = t6 - (t6 - q1);
  const bl8 = q1 - bh7;
  let e9 = ah4 * bh7 - p2 + ah4 * bl8 + al5 * bh7 + al5 * bl8;
  if (!Number.isFinite(e9) && Number.isFinite(p2)) e9 = prodErrScaled(b[0], q1);
  const u10 = e9 + b[1] * q1;
  const s11 = p2 + u10;
  const e12 = u10 - (s11 - p2);
  const n13 = -s11;
  const n14 = -e12;
  const s15 = a[0] + n13;
  const bb16 = s15 - a[0];
  const e17 = a[0] - (s15 - bb16) + (n13 - bb16);
  const s18 = a[1] + n14;
  const bb19 = s18 - a[1];
  const e20 = a[1] - (s18 - bb19) + (n14 - bb19);
  const u21 = e17 + s18;
  const s22 = s15 + u21;
  const e23 = u21 - (s22 - s15);
  const w24 = e23 + e20;
  const s25 = s22 + w24;
  const e26 = w24 - (s25 - s22);
  const q27 = s25 / b[0];
  const p28 = b[0] * q27;
  const t29 = SPLITTER * b[0];
  const ah30 = t29 - (t29 - b[0]);
  const al31 = b[0] - ah30;
  const t32 = SPLITTER * q27;
  const bh33 = t32 - (t32 - q27);
  const bl34 = q27 - bh33;
  let e35 = ah30 * bh33 - p28 + ah30 * bl34 + al31 * bh33 + al31 * bl34;
  if (!Number.isFinite(e35) && Number.isFinite(p28)) e35 = prodErrScaled(b[0], q27);
  const u36 = e35 + b[1] * q27;
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
  const q53 = s51 / b[0];
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
  return [s66, e67];
}

export function ddDivNum(a: DD, b: number): DD {
  if (!ddEnabled) return [a[0] / b, 0];
  const q1 = a[0] / b;
  // A sum, product or quotient beyond the double range has no error term (the steps below would make it NaN)
  if (!Number.isFinite(q1)) return [q1, 0];
  const p2 = b * q1;
  const t3 = SPLITTER * b;
  const ah4 = t3 - (t3 - b);
  const al5 = b - ah4;
  const t6 = SPLITTER * q1;
  const bh7 = t6 - (t6 - q1);
  const bl8 = q1 - bh7;
  let e9 = ah4 * bh7 - p2 + ah4 * bl8 + al5 * bh7 + al5 * bl8;
  if (!Number.isFinite(e9) && Number.isFinite(p2)) e9 = prodErrScaled(b, q1);
  const u10 = e9 + 0 * q1;
  const s11 = p2 + u10;
  const e12 = u10 - (s11 - p2);
  const n13 = -s11;
  const n14 = -e12;
  const s15 = a[0] + n13;
  const bb16 = s15 - a[0];
  const e17 = a[0] - (s15 - bb16) + (n13 - bb16);
  const s18 = a[1] + n14;
  const bb19 = s18 - a[1];
  const e20 = a[1] - (s18 - bb19) + (n14 - bb19);
  const u21 = e17 + s18;
  const s22 = s15 + u21;
  const e23 = u21 - (s22 - s15);
  const w24 = e23 + e20;
  const s25 = s22 + w24;
  const e26 = w24 - (s25 - s22);
  const q27 = s25 / b;
  const p28 = b * q27;
  const t29 = SPLITTER * b;
  const ah30 = t29 - (t29 - b);
  const al31 = b - ah30;
  const t32 = SPLITTER * q27;
  const bh33 = t32 - (t32 - q27);
  const bl34 = q27 - bh33;
  let e35 = ah30 * bh33 - p28 + ah30 * bl34 + al31 * bh33 + al31 * bl34;
  if (!Number.isFinite(e35) && Number.isFinite(p28)) e35 = prodErrScaled(b, q27);
  const u36 = e35 + 0 * q27;
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
  const q53 = s51 / b;
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
  return [s66, e67];
}

const LN2: DD = [0.6931471805599453, 2.3190468138462996e-17];
const SQRT2 = Math.SQRT2;

// ---- Constants for ddLog ----
// Both are Rmpfr (400-bit) values rounded to double-double. Generated in R by:
//   dd <- function(v) { h <- asNumeric(v); c(h, asNumeric(v - mpfr(h, 400))) }
//   RECIP[j] = dd(1 / mpfr(2 * j + 1, 400))           (j = 1..5; RECIP[0] = 1)
//   LOGTAB128[i - 89] = dd(log(mpfr(i, 400) / 128))  (i = 89..183)
const RECIP: readonly DD[] = [
  [1, 0],
  [0.33333333333333331, 1.8503717077085941e-17],
  [0.20000000000000001, -1.1102230246251566e-17],
  [0.14285714285714285, 7.9301644616082606e-18],
  [0.1111111111111111, 6.1679056923619804e-18],
  [0.090909090909090912, -2.5232341468753558e-18],
];

const LOGTAB128_START = 89;
const LOGTAB128: readonly DD[] = [
  [-0.36339389418747731, -2.1068447522266051e-17],
  [-0.35222059358935209, -5.7233316949182485e-18],
  [-0.34117075740276714, 1.9366790062602867e-17],
  [-0.33024168687057687, 1.0828321637483858e-17],
  [-0.31943077076636123, -1.3542568572648111e-18],
  [-0.30873548164961329, 1.6199186085148102e-17],
  [-0.29815337231907635, 1.720695867445866e-17],
  [-0.2876820724517809, -2.607160616442564e-17],
  [-0.27731928541623435, 7.4452840558351297e-18],
  [-0.26706278524904525, 7.3289153273201695e-18],
  [-0.25691041378502721, -2.502843296152504e-17],
  [-0.24686007793152578, -1.361743371748368e-17],
  [-0.23690974707835771, -1.9682402978398164e-18],
  [-0.22705745063534608, -9.5514157627384884e-18],
  [-0.21730127568998139, -1.6168452453763015e-18],
  [-0.20763936477824449, -1.2053243216686129e-17],
  [-0.19806991376209379, -3.742843482461439e-18],
  [-0.18859116980755003, 7.4321642191969251e-18],
  [-0.179201429457711, 1.0785017454858423e-17],
  [-0.16989903679539747, 4.8680087644390708e-19],
  [-0.16068238169047347, 3.6501835530478371e-18],
  [-0.15154989812720093, -5.1669593684615594e-18],
  [-0.14250006260728304, 9.9263882342257491e-18],
  [-0.13353139262452263, 3.6644576636600847e-18],
  [-0.1246424452072766, 5.8089126789409707e-18],
  [-0.1158318155251217, -4.338484369808096e-18],
  [-0.1070981355563671, 1.73705104015906e-18],
  [-0.098440072813252524, 4.4390096336751359e-18],
  [-0.089856329121861048, 6.273760163689594e-19],
  [-0.081345639453952401, -5.0770763559311699e-18],
  [-0.072906770808087787, 6.3068602575327778e-18],
  [-0.064538521137571178, 6.470486661692933e-18],
  [-0.056239718322876081, 3.2835149805605613e-18],
  [-0.048009219186360606, -1.4390903347292205e-18],
  [-0.039845908547199674, 3.1295476803152081e-18],
  [-0.031748698314580298, -3.0382263084680858e-18],
  [-0.023716526617316044, 1.5774243488668215e-18],
  [-0.015748356968139168, -1.0021578630528974e-18],
  [-0.0078431774610258926, -2.7647081541249038e-19],
  [0, 0],
  [0.007782140442054949, -1.2819179123343845e-20],
  [0.015504186535965254, -3.2783210228924291e-19],
  [0.023167059281534379, -1.1769544932063305e-18],
  [0.030771658666753687, 1.0431732029005968e-18],
  [0.038318864302136602, -2.3579961573512861e-18],
  [0.045809536031294201, 1.9029598664742571e-18],
  [0.053244514518812285, -1.6655758169736629e-18],
  [0.06062462181643484, 2.6424025938726934e-18],
  [0.067950661908507751, -1.2802141240611733e-18],
  [0.075223421237587532, -5.9306041962932407e-18],
  [0.082443669211074586, 5.7004377738139872e-18],
  [0.089612158689687138, -5.4268129336647135e-18],
  [0.096729626458551113, -5.5973974862899648e-19],
  [0.10379679368164356, 5.4777241572665901e-18],
  [0.11081436634029011, 1.1837483428256489e-18],
  [0.11778303565638346, -1.1971685747593677e-18],
  [0.12470347850095724, -4.6522609636496624e-18],
  [0.13157635778871926, 1.1123000879729588e-17],
  [0.13840232285911913, 4.4477773013575269e-18],
  [0.14518200984449789, 8.2424187830224754e-18],
  [0.15191604202584197, 6.4838631244022194e-18],
  [0.15860503017663857, 1.1257003872182592e-17],
  [0.16524957289530717, -1.0094935622322628e-17],
  [0.17185025692665923, -6.0224538210113705e-18],
  [0.17840765747281831, -1.2432553788701131e-17],
  [0.18492233849401199, 3.0236614153574064e-18],
  [0.19139485299962947, -1.2129496905792884e-17],
  [0.19782574332991987, 1.2821194372980142e-17],
  [0.20421554142869089, 2.7338281018722773e-18],
  [0.21056476910734964, -4.2494053147298953e-18],
  [0.21687393830061436, 4.5510261932342832e-18],
  [0.22314355131420976, -9.091270597324799e-18],
  [0.22937410106484582, 9.9276718239780255e-18],
  [0.23556607131276691, -2.3943371495187355e-18],
  [0.24171993688714516, 8.9009900221666426e-18],
  [0.24783616390458127, -1.2432209578702523e-17],
  [0.25391520998096345, -8.0480973944242013e-18],
  [0.25995752443692605, 2.069806938978935e-17],
  [0.26596354849713794, 5.3393802761314314e-18],
  [0.27193371548364176, 7.8331963769744201e-19],
  [0.27786845100345631, -9.1601829490926308e-19],
  [0.28376817313064462, -2.0326655811266561e-17],
  [0.28963329258304266, 2.0535953219858174e-17],
  [0.2954642128938359, -2.16461086040599e-17],
  [0.30126133057816179, -9.0485111440485636e-18],
  [0.30702503529491187, -1.2319916200101964e-17],
  [0.3127557100038969, -1.4518083530989511e-17],
  [0.31845373111853459, 2.7114779367326236e-17],
  [0.32411946865421198, -7.9582143818938126e-18],
  [0.32975328637246798, 2.122020616196946e-18],
  [0.33535554192113781, 1.834564437059473e-17],
  [0.34092658697059319, 1.7467136443544747e-17],
  [0.34646676734620857, 1.0285835854962651e-17],
  [0.3519764231571782, -1.2953893030191963e-17],
  [0.3574558889218038, -2.5136910072413547e-17],
];

/**
 * Natural log in double-double. 0 gives -Infinity, Infinity gives Infinity, a negative x or NaN gives NaN.
 *
 * After reducing x = m 2^k (m ∈ [1/√2, √2)), divide m by the nearest c = i/128 and use
 *   log m = log c + 2 atanh(s),  s = (m - c)/(m + c)  (|s| <= 0.0028)
 * log c comes from a table (LOGTAB128); atanh is s (1 + s^2/3 + ... + s^10/11) evaluated by Horner's method
 * (the reciprocals are the constants RECIP). About 2.6 times faster than summing the series to 1e-34 with a
 * division per term, with the same accuracy (max relative 4.4e-32; see docs/performance.md). Operations such as
 * ddAdd are expanded into local variables (python3 scripts/ddgen.py ddlog). Subnormals are first multiplied by
 * 2^600 (a power of 2, so the scaling is exact)
 */
export function ddLog(x: DD): DD {
  if (!ddEnabled) return [Math.log(x[0]), 0];
  // Outside (0, Infinity) the table index below is out of range; answer as Math.log does
  if (!(x[0] > 0 && x[0] < Infinity)) return [Math.log(x[0]), 0];
  // x = m 2^k, m ∈ [1/√2, √2). Subnormals are first multiplied by 2^600 to make them normal (exact, being a power of 2)
  let x0 = x[0];
  let x1 = x[1];
  let k = 0;
  if (x0 < 2.2250738585072014e-308) {
    x0 *= 2 ** 600;
    x1 *= 2 ** 600;
    k = -600;
  }
  const e0 = Math.floor(Math.log2(x0));
  k += e0;
  const scale = 2 ** -e0;
  let m0 = x0 * scale;
  let m1 = x1 * scale;
  if (m0 >= SQRT2) {
    m0 = m0 / 2;
    m1 = m1 / 2;
    k += 1;
  } else if (m0 < SQRT2 / 2) {
    m0 = m0 * 2;
    m1 = m1 * 2;
    k -= 1;
  }
  const i = Math.round(m0 * 128);
  const c = i / 128;
  const lc = LOGTAB128[i - LOGTAB128_START]!;
  const n1 = -c;
  const n2 = -0;
  const s3 = m0 + n1;
  const bb4 = s3 - m0;
  const e5 = m0 - (s3 - bb4) + (n1 - bb4);
  const s6 = m1 + n2;
  const bb7 = s6 - m1;
  const e8 = m1 - (s6 - bb7) + (n2 - bb7);
  const u9 = e5 + s6;
  const s10 = s3 + u9;
  const e11 = u9 - (s10 - s3);
  const w12 = e11 + e8;
  const s13 = s10 + w12;
  const e14 = w12 - (s13 - s10);
  const s15 = m0 + c;
  const bb16 = s15 - m0;
  const e17 = m0 - (s15 - bb16) + (c - bb16);
  const s18 = m1 + 0;
  const bb19 = s18 - m1;
  const e20 = m1 - (s18 - bb19) + (0 - bb19);
  const u21 = e17 + s18;
  const s22 = s15 + u21;
  const e23 = u21 - (s22 - s15);
  const w24 = e23 + e20;
  const s25 = s22 + w24;
  const e26 = w24 - (s25 - s22);
  const q27 = s13 / s25;
  const p28 = s25 * q27;
  const t29 = SPLITTER * s25;
  const ah30 = t29 - (t29 - s25);
  const al31 = s25 - ah30;
  const t32 = SPLITTER * q27;
  const bh33 = t32 - (t32 - q27);
  const bl34 = q27 - bh33;
  let e35 = ah30 * bh33 - p28 + ah30 * bl34 + al31 * bh33 + al31 * bl34;
  if (!Number.isFinite(e35) && Number.isFinite(p28)) e35 = prodErrScaled(s25, q27);
  const u36 = e35 + e26 * q27;
  const s37 = p28 + u36;
  const e38 = u36 - (s37 - p28);
  const n39 = -s37;
  const n40 = -e38;
  const s41 = s13 + n39;
  const bb42 = s41 - s13;
  const e43 = s13 - (s41 - bb42) + (n39 - bb42);
  const s44 = e14 + n40;
  const bb45 = s44 - e14;
  const e46 = e14 - (s44 - bb45) + (n40 - bb45);
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
  let e61 = ah56 * bh59 - p54 + ah56 * bl60 + al57 * bh59 + al57 * bl60;
  if (!Number.isFinite(e61) && Number.isFinite(p54)) e61 = prodErrScaled(s25, q53);
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
  const p94 = s92 * s92;
  const t95 = SPLITTER * s92;
  const ah96 = t95 - (t95 - s92);
  const al97 = s92 - ah96;
  const t98 = SPLITTER * s92;
  const bh99 = t98 - (t98 - s92);
  const bl100 = s92 - bh99;
  let e101 = ah96 * bh99 - p94 + ah96 * bl100 + al97 * bh99 + al97 * bl100;
  if (!Number.isFinite(e101) && Number.isFinite(p94)) e101 = prodErrScaled(s92, s92);
  const u102 = e101 + (s92 * e93 + e93 * s92);
  const s103 = p94 + u102;
  const e104 = u102 - (s103 - p94);
  const p105 = RECIP[5]![0] * s103;
  const t106 = SPLITTER * RECIP[5]![0];
  const ah107 = t106 - (t106 - RECIP[5]![0]);
  const al108 = RECIP[5]![0] - ah107;
  const t109 = SPLITTER * s103;
  const bh110 = t109 - (t109 - s103);
  const bl111 = s103 - bh110;
  let e112 = ah107 * bh110 - p105 + ah107 * bl111 + al108 * bh110 + al108 * bl111;
  if (!Number.isFinite(e112) && Number.isFinite(p105)) e112 = prodErrScaled(RECIP[5]![0], s103);
  const u113 = e112 + (RECIP[5]![0] * e104 + RECIP[5]![1] * s103);
  const s114 = p105 + u113;
  const e115 = u113 - (s114 - p105);
  const s116 = s114 + RECIP[4]![0];
  const bb117 = s116 - s114;
  const e118 = s114 - (s116 - bb117) + (RECIP[4]![0] - bb117);
  const s119 = e115 + RECIP[4]![1];
  const bb120 = s119 - e115;
  const e121 = e115 - (s119 - bb120) + (RECIP[4]![1] - bb120);
  const u122 = e118 + s119;
  const s123 = s116 + u122;
  const e124 = u122 - (s123 - s116);
  const w125 = e124 + e121;
  const s126 = s123 + w125;
  const e127 = w125 - (s126 - s123);
  const p128 = s126 * s103;
  const t129 = SPLITTER * s126;
  const ah130 = t129 - (t129 - s126);
  const al131 = s126 - ah130;
  const t132 = SPLITTER * s103;
  const bh133 = t132 - (t132 - s103);
  const bl134 = s103 - bh133;
  let e135 = ah130 * bh133 - p128 + ah130 * bl134 + al131 * bh133 + al131 * bl134;
  if (!Number.isFinite(e135) && Number.isFinite(p128)) e135 = prodErrScaled(s126, s103);
  const u136 = e135 + (s126 * e104 + e127 * s103);
  const s137 = p128 + u136;
  const e138 = u136 - (s137 - p128);
  const s139 = s137 + RECIP[3]![0];
  const bb140 = s139 - s137;
  const e141 = s137 - (s139 - bb140) + (RECIP[3]![0] - bb140);
  const s142 = e138 + RECIP[3]![1];
  const bb143 = s142 - e138;
  const e144 = e138 - (s142 - bb143) + (RECIP[3]![1] - bb143);
  const u145 = e141 + s142;
  const s146 = s139 + u145;
  const e147 = u145 - (s146 - s139);
  const w148 = e147 + e144;
  const s149 = s146 + w148;
  const e150 = w148 - (s149 - s146);
  const p151 = s149 * s103;
  const t152 = SPLITTER * s149;
  const ah153 = t152 - (t152 - s149);
  const al154 = s149 - ah153;
  const t155 = SPLITTER * s103;
  const bh156 = t155 - (t155 - s103);
  const bl157 = s103 - bh156;
  let e158 = ah153 * bh156 - p151 + ah153 * bl157 + al154 * bh156 + al154 * bl157;
  if (!Number.isFinite(e158) && Number.isFinite(p151)) e158 = prodErrScaled(s149, s103);
  const u159 = e158 + (s149 * e104 + e150 * s103);
  const s160 = p151 + u159;
  const e161 = u159 - (s160 - p151);
  const s162 = s160 + RECIP[2]![0];
  const bb163 = s162 - s160;
  const e164 = s160 - (s162 - bb163) + (RECIP[2]![0] - bb163);
  const s165 = e161 + RECIP[2]![1];
  const bb166 = s165 - e161;
  const e167 = e161 - (s165 - bb166) + (RECIP[2]![1] - bb166);
  const u168 = e164 + s165;
  const s169 = s162 + u168;
  const e170 = u168 - (s169 - s162);
  const w171 = e170 + e167;
  const s172 = s169 + w171;
  const e173 = w171 - (s172 - s169);
  const p174 = s172 * s103;
  const t175 = SPLITTER * s172;
  const ah176 = t175 - (t175 - s172);
  const al177 = s172 - ah176;
  const t178 = SPLITTER * s103;
  const bh179 = t178 - (t178 - s103);
  const bl180 = s103 - bh179;
  let e181 = ah176 * bh179 - p174 + ah176 * bl180 + al177 * bh179 + al177 * bl180;
  if (!Number.isFinite(e181) && Number.isFinite(p174)) e181 = prodErrScaled(s172, s103);
  const u182 = e181 + (s172 * e104 + e173 * s103);
  const s183 = p174 + u182;
  const e184 = u182 - (s183 - p174);
  const s185 = s183 + RECIP[1]![0];
  const bb186 = s185 - s183;
  const e187 = s183 - (s185 - bb186) + (RECIP[1]![0] - bb186);
  const s188 = e184 + RECIP[1]![1];
  const bb189 = s188 - e184;
  const e190 = e184 - (s188 - bb189) + (RECIP[1]![1] - bb189);
  const u191 = e187 + s188;
  const s192 = s185 + u191;
  const e193 = u191 - (s192 - s185);
  const w194 = e193 + e190;
  const s195 = s192 + w194;
  const e196 = w194 - (s195 - s192);
  const p197 = s195 * s103;
  const t198 = SPLITTER * s195;
  const ah199 = t198 - (t198 - s195);
  const al200 = s195 - ah199;
  const t201 = SPLITTER * s103;
  const bh202 = t201 - (t201 - s103);
  const bl203 = s103 - bh202;
  let e204 = ah199 * bh202 - p197 + ah199 * bl203 + al200 * bh202 + al200 * bl203;
  if (!Number.isFinite(e204) && Number.isFinite(p197)) e204 = prodErrScaled(s195, s103);
  const u205 = e204 + (s195 * e104 + e196 * s103);
  const s206 = p197 + u205;
  const e207 = u205 - (s206 - p197);
  const s208 = s206 + RECIP[0]![0];
  const bb209 = s208 - s206;
  const e210 = s206 - (s208 - bb209) + (RECIP[0]![0] - bb209);
  const s211 = e207 + RECIP[0]![1];
  const bb212 = s211 - e207;
  const e213 = e207 - (s211 - bb212) + (RECIP[0]![1] - bb212);
  const u214 = e210 + s211;
  const s215 = s208 + u214;
  const e216 = u214 - (s215 - s208);
  const w217 = e216 + e213;
  const s218 = s215 + w217;
  const e219 = w217 - (s218 - s215);
  const p220 = s92 * s218;
  const t221 = SPLITTER * s92;
  const ah222 = t221 - (t221 - s92);
  const al223 = s92 - ah222;
  const t224 = SPLITTER * s218;
  const bh225 = t224 - (t224 - s218);
  const bl226 = s218 - bh225;
  let e227 = ah222 * bh225 - p220 + ah222 * bl226 + al223 * bh225 + al223 * bl226;
  if (!Number.isFinite(e227) && Number.isFinite(p220)) e227 = prodErrScaled(s92, s218);
  const u228 = e227 + (s92 * e219 + e93 * s218);
  const s229 = p220 + u228;
  const e230 = u228 - (s229 - p220);
  const p231 = s229 * 2;
  const t232 = SPLITTER * s229;
  const ah233 = t232 - (t232 - s229);
  const al234 = s229 - ah233;
  const t235 = SPLITTER * 2;
  const bh236 = t235 - (t235 - 2);
  const bl237 = 2 - bh236;
  let e238 = ah233 * bh236 - p231 + ah233 * bl237 + al234 * bh236 + al234 * bl237;
  if (!Number.isFinite(e238) && Number.isFinite(p231)) e238 = prodErrScaled(s229, 2);
  const u239 = e238 + e230 * 2;
  const s240 = p231 + u239;
  const e241 = u239 - (s240 - p231);
  const s242 = lc[0] + s240;
  const bb243 = s242 - lc[0];
  const e244 = lc[0] - (s242 - bb243) + (s240 - bb243);
  const s245 = lc[1] + e241;
  const bb246 = s245 - lc[1];
  const e247 = lc[1] - (s245 - bb246) + (e241 - bb246);
  const u248 = e244 + s245;
  const s249 = s242 + u248;
  const e250 = u248 - (s249 - s242);
  const w251 = e250 + e247;
  const s252 = s249 + w251;
  const e253 = w251 - (s252 - s249);
  const p254 = LN2[0] * k;
  const t255 = SPLITTER * LN2[0];
  const ah256 = t255 - (t255 - LN2[0]);
  const al257 = LN2[0] - ah256;
  const t258 = SPLITTER * k;
  const bh259 = t258 - (t258 - k);
  const bl260 = k - bh259;
  let e261 = ah256 * bh259 - p254 + ah256 * bl260 + al257 * bh259 + al257 * bl260;
  if (!Number.isFinite(e261) && Number.isFinite(p254)) e261 = prodErrScaled(LN2[0], k);
  const u262 = e261 + LN2[1] * k;
  const s263 = p254 + u262;
  const e264 = u262 - (s263 - p254);
  const s265 = s252 + s263;
  const bb266 = s265 - s252;
  const e267 = s252 - (s265 - bb266) + (s263 - bb266);
  const s268 = e253 + e264;
  const bb269 = s268 - e253;
  const e270 = e253 - (s268 - bb269) + (e264 - bb269);
  const u271 = e267 + s268;
  const s272 = s265 + u271;
  const e273 = u271 - (s272 - s265);
  const w274 = e273 + e270;
  const s275 = s272 + w274;
  const e276 = w274 - (s275 - s272);
  return [s275, e276];
}
