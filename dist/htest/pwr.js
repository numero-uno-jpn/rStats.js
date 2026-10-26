// Power calculations of the pwr package (Cohen's effect sizes): pwr.t.test, pwr.t2n.test, pwr.2p.test,
// pwr.2p2n.test, pwr.p.test, pwr.norm.test, pwr.r.test, pwr.chisq.test, pwr.anova.test, pwr.f2.test, and the
// effect-size helpers ES.h, ES.w1, ES.w2 and cohen.ES.
//
// Written for rStats.js from oracle/effectsize-behaviour.md (no ported code; pwr's source was not read). The quantity
// given as null is solved for with uniroot (src/numerics/integrate.ts) on pwr's intervals with uniroot's default
// tolerance and no extension of the interval, so that the tolerance-limited root is pwr's.
import { pchisq, qchisq } from "../distributions/chisq.js";
import { pf, qf } from "../distributions/f.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { qt } from "../distributions/t.js";
import { checkExactlyOne, isUnknown, matchChoice, ptNcp, solveFor } from "./power.js";
const COHEN = {
    p: [0.2, 0.5, 0.8],
    t: [0.2, 0.5, 0.8],
    r: [0.1, 0.3, 0.5],
    anov: [0.1, 0.25, 0.4],
    chisq: [0.1, 0.3, 0.5],
    f2: [0.02, 0.15, 0.35],
};
/**
 * Cohen's conventional effect sizes. Equivalent to pwr's `cohen.ES(test, size)`.
 *
 * @example
 * ```ts
 * cohenES("anov", "medium").effectSize; // 0.25
 * ```
 */
export function cohenES(test = "p", size = "small") {
    const t = matchChoice(test, ["p", "t", "r", "anov", "chisq", "f2"]);
    const s = matchChoice(size, ["small", "medium", "large"]);
    return { test: t, size: s, effectSize: COHEN[t][["small", "medium", "large"].indexOf(s)], method: "Conventional effect size from Cohen (1982)" };
}
/** Effect size h of two proportions: `2 asin(sqrt(p1)) - 2 asin(sqrt(p2))`. Equivalent to pwr's `ES.h`. */
export function esH(p1, p2) {
    return 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2));
}
/** Effect size w of a goodness-of-fit test, `sqrt(sum((p1 - p0)^2 / p0))`. Equivalent to pwr's `ES.w1`. */
export function esW1(p0, p1) {
    if (p0.length !== p1.length)
        throw new RangeError("'P0' and 'P1' must have the same length");
    let s = 0;
    for (let i = 0; i < p0.length; i++)
        s += (p1[i] - p0[i]) ** 2 / p0[i];
    return Math.sqrt(s);
}
/**
 * Effect size w of a test of association, for a matrix of cell probabilities (an array of rows): with the row sums
 * r and column sums c, `p0 = r c'` and `sqrt(sum((p - p0)^2 / p0))`. Equivalent to pwr's `ES.w2`.
 */
export function esW2(p) {
    const rows = p.map((r) => r.reduce((a, b) => a + b, 0));
    const nc = p[0]?.length ?? 0;
    const cols = Array.from({ length: nc }, (_, j) => p.reduce((a, r) => a + r[j], 0));
    let s = 0;
    // column-major order, as R sums a matrix
    for (let j = 0; j < nc; j++) {
        for (let i = 0; i < p.length; i++) {
            const p0 = rows[i] * cols[j];
            s += (p[i][j] - p0) ** 2 / p0;
        }
    }
    return Math.sqrt(s);
}
const SIG_MESSAGE = "‘sig.level’ must be numeric in [0, 1]";
const POWER_MESSAGE = "‘power’ must be numeric in [0, 1]";
function checkProbabilities(sigLevel, power) {
    const bad = (v) => !isUnknown(v) && !(typeof v === "number" && v >= 0 && v <= 1);
    if (bad(sigLevel))
        throw new RangeError(SIG_MESSAGE);
    if (bad(power))
        throw new RangeError(POWER_MESSAGE);
}
/** A string effect size replaced by Cohen's value for the test */
function effect(es, test) {
    return typeof es === "string" ? cohenES(test, es).effectSize : es;
}
const ALTERNATIVES = ["two.sided", "less", "greater"];
/** The interval of an effect size: two-sided, less, greater */
function esInterval(alt, two) {
    return alt === "two.sided" ? two : alt === "less" ? [-10, 5] : [-5, 10];
}
/** The power of a t test with nu degrees of freedom and noncentrality ncp, by pwr's rejection regions */
function tPower(nu, ncp, sig, alt) {
    if (alt === "less")
        return ptNcp(qt(sig, nu), nu, ncp, true);
    if (alt === "greater")
        return ptNcp(qt(sig, nu, { lowerTail: false }), nu, ncp, false);
    const q = qt(sig / 2, nu, { lowerTail: false });
    return ptNcp(q, nu, ncp, false) + ptNcp(-q, nu, ncp, true);
}
/** The power of a normal test with shift `es * scale`, by pwr's rejection regions */
function normalPower(shift, sig, alt) {
    if (alt === "greater")
        return pnorm(qnorm(1 - sig) - shift, { lowerTail: false });
    if (alt === "less")
        return pnorm(qnorm(sig) - shift);
    return (pnorm(qnorm(1 - sig / 2) - shift, { lowerTail: false }) + pnorm(qnorm(sig / 2) - shift));
}
/**
 * Power of a t test of means, or the sample size, effect size or significance level for a given power. Equivalent
 * to pwr's `pwr.t.test()`.
 *
 * @example
 * ```ts
 * pwrTTest({ n: 20, d: 0.5 }).power;          // 0.3379390289250411
 * pwrTTest({ d: 0.5, power: 0.8 }).n;         // 63.76561044415068
 * ```
 */
export function pwrTTest(options = {}) {
    let { n, power } = options;
    let d = effect(options.d, "t");
    let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
    checkExactlyOne([n, d, power, sigLevel], "exactly one of n, d, power, and sig.level must be NULL");
    checkProbabilities(sigLevel, power);
    const type = matchChoice(options.type, ["two.sample", "one.sample", "paired"]);
    const alt = matchChoice(options.alternative, ALTERNATIVES);
    const ts = type === "two.sample" ? 2 : 1;
    if (alt === "two.sided" && !isUnknown(d))
        d = Math.abs(d);
    const powerOf = (n, d, sig) => tPower((n - 1) * ts, Math.sqrt(n / ts) * d, sig, alt);
    if (isUnknown(power))
        power = powerOf(n, d, sigLevel);
    else {
        const target = power;
        if (isUnknown(n))
            n = solveFor((x) => powerOf(x, d, sigLevel) - target, 2 + 1e-10, 1e9);
        else if (isUnknown(d))
            d = solveFor((x) => powerOf(n, x, sigLevel) - target, ...esInterval(alt, [1e-7, 10]));
        else
            sigLevel = solveFor((x) => powerOf(n, d, x) - target, 1e-10, 1 - 1e-10);
    }
    const note = type === "paired" ? "n is number of *pairs*" : type === "two.sample" ? "n is number in *each* group" : undefined;
    const method = { "two.sample": "Two-sample", "one.sample": "One-sample", paired: "Paired" }[type] + " t test power calculation";
    return { n: n, d: d, sigLevel: sigLevel, power, alternative: alt, ...(note === undefined ? {} : { note }), method };
}
/**
 * Power of a two-sample t test with unequal sample sizes, or a sample size, the effect size or the significance
 * level for a given power. Equivalent to pwr's `pwr.t2n.test()`.
 */
export function pwrT2nTest(options = {}) {
    let { n1, n2, power } = options;
    let d = effect(options.d, "t");
    let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
    checkExactlyOne([n1, n2, d, power, sigLevel], "exactly one of n1, n2, d, power, and sig.level must be NULL");
    checkProbabilities(sigLevel, power);
    if (!isUnknown(n1) && n1 < 2)
        throw new RangeError("number of observations in the first group must be at least 2");
    if (!isUnknown(n2) && n2 < 2)
        throw new RangeError("number of observations in the second group must be at least 2");
    const alt = matchChoice(options.alternative, ALTERNATIVES);
    if (alt === "two.sided" && !isUnknown(d))
        d = Math.abs(d);
    const powerOf = (n1, n2, d, sig) => tPower(n1 + n2 - 2, d / Math.sqrt(1 / n1 + 1 / n2), sig, alt);
    if (isUnknown(power))
        power = powerOf(n1, n2, d, sigLevel);
    else {
        const target = power;
        if (isUnknown(n1))
            n1 = solveFor((x) => powerOf(x, n2, d, sigLevel) - target, 2 + 1e-10, 1e9);
        else if (isUnknown(n2))
            n2 = solveFor((x) => powerOf(n1, x, d, sigLevel) - target, 2 + 1e-10, 1e9);
        else if (isUnknown(d))
            d = solveFor((x) => powerOf(n1, n2, x, sigLevel) - target, ...esInterval(alt, [1e-7, 10]));
        else
            sigLevel = solveFor((x) => powerOf(n1, n2, d, x) - target, 1e-10, 1 - 1e-10);
    }
    return { n1: n1, n2: n2, d: d, sigLevel: sigLevel, power, alternative: alt, method: "t test power calculation" };
}
/** The normal-approximation tests: pwr.2p.test (scale sqrt(n/2)), pwr.p.test and pwr.norm.test (sqrt(n)) */
function normalTest(es0, options, name, scale, nLower, esLower) {
    let { n, power } = options;
    let es = effect(es0, name === "h" ? "p" : "t");
    let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
    checkExactlyOne([es, n, power, sigLevel], `exactly one of ${name}, n, power, and sig.level must be NULL`);
    checkProbabilities(sigLevel, power);
    if (!isUnknown(n) && n < 1)
        throw new RangeError("number of observations in each group must be at least 1");
    const alt = matchChoice(options.alternative, ALTERNATIVES);
    if (alt === "two.sided" && !isUnknown(es))
        es = Math.abs(es);
    const powerOf = (es, n, sig) => normalPower(es * scale(n), sig, alt);
    if (isUnknown(power))
        power = powerOf(es, n, sigLevel);
    else {
        const target = power;
        if (isUnknown(es))
            es = solveFor((x) => powerOf(x, n, sigLevel) - target, ...esInterval(alt, [esLower, 10]));
        else if (isUnknown(n))
            n = solveFor((x) => powerOf(es, x, sigLevel) - target, nLower, 1e9);
        else
            sigLevel = solveFor((x) => powerOf(es, n, x) - target, 1e-10, 1 - 1e-10);
    }
    return { es: es, n: n, sigLevel: sigLevel, power, alternative: alt };
}
/**
 * Power of the test of two proportions with equal sample sizes (arcsine transformation), or the effect size, sample
 * size or significance level for a given power. Equivalent to pwr's `pwr.2p.test()`.
 */
export function pwr2pTest(options = {}) {
    const r = normalTest(options.h, options, "h", (n) => Math.sqrt(n / 2), 2 + 1e-10, 1e-10);
    return {
        h: r.es,
        n: r.n,
        sigLevel: r.sigLevel,
        power: r.power,
        alternative: r.alternative,
        method: "Difference of proportion power calculation for binomial distribution (arcsine transformation)",
        note: "same sample sizes",
    };
}
/**
 * Power of the test of one proportion (arcsine transformation), or the effect size, sample size or significance
 * level for a given power. Equivalent to pwr's `pwr.p.test()`.
 */
export function pwrPTest(options = {}) {
    const r = normalTest(options.h, options, "h", (n) => Math.sqrt(n), 2 + 1e-10, 1e-10);
    return {
        h: r.es,
        n: r.n,
        sigLevel: r.sigLevel,
        power: r.power,
        alternative: r.alternative,
        method: "proportion power calculation for binomial distribution (arcsine transformation)",
    };
}
/**
 * Power of the test of a mean of a normal distribution with known variance, or the effect size, sample size or
 * significance level for a given power. Equivalent to pwr's `pwr.norm.test()`.
 */
export function pwrNormTest(options = {}) {
    const r = normalTest(options.d, options, "d", (n) => Math.sqrt(n), 1 + 1e-10, 1e-10);
    return {
        d: r.es,
        n: r.n,
        sigLevel: r.sigLevel,
        power: r.power,
        alternative: r.alternative,
        method: "Mean power calculation for normal distribution with known variance",
    };
}
/**
 * Power of the test of two proportions with unequal sample sizes (arcsine transformation), or the effect size, a
 * sample size or the significance level for a given power. Equivalent to pwr's `pwr.2p2n.test()`.
 */
export function pwr2p2nTest(options = {}) {
    let { n1, n2, power } = options;
    let h = effect(options.h, "p");
    let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
    checkExactlyOne([h, n1, n2, power, sigLevel], "exactly one of h, n1, n2, power, and sig.level must be NULL");
    checkProbabilities(sigLevel, power);
    if (!isUnknown(n1) && n1 < 2)
        throw new RangeError("number of observations in the first group must be at least 2");
    if (!isUnknown(n2) && n2 < 2)
        throw new RangeError("number of observations in the second group must be at least 2");
    const alt = matchChoice(options.alternative, ALTERNATIVES);
    if (alt === "two.sided" && !isUnknown(h))
        h = Math.abs(h);
    const powerOf = (h, n1, n2, sig) => normalPower(h * Math.sqrt((n1 * n2) / (n1 + n2)), sig, alt);
    if (isUnknown(power))
        power = powerOf(h, n1, n2, sigLevel);
    else {
        const target = power;
        if (isUnknown(h))
            h = solveFor((x) => powerOf(x, n1, n2, sigLevel) - target, ...esInterval(alt, [1e-10, 10]));
        else if (isUnknown(n1))
            n1 = solveFor((x) => powerOf(h, x, n2, sigLevel) - target, 2 + 1e-10, 1e9);
        else if (isUnknown(n2))
            n2 = solveFor((x) => powerOf(h, n1, x, sigLevel) - target, 2 + 1e-10, 1e9);
        else
            sigLevel = solveFor((x) => powerOf(h, n1, n2, x) - target, 1e-10, 1 - 1e-10);
    }
    return {
        h: h,
        n1: n1,
        n2: n2,
        sigLevel: sigLevel,
        power,
        alternative: alt,
        method: "difference of proportion power calculation for binomial distribution (arcsine transformation)",
        note: "different sample sizes",
    };
}
/**
 * Power of the test of a correlation (Fisher's z transformation), or the sample size, correlation or significance
 * level for a given power. Equivalent to pwr's `pwr.r.test()`. As in pwr, the power computed for `"less"` reports
 * `r` negated.
 */
export function pwrRTest(options = {}) {
    let { n, power } = options;
    let r = effect(options.r, "r");
    let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
    checkExactlyOne([n, r, power, sigLevel], "exactly one of n, r, power, and sig.level must be NULL");
    checkProbabilities(sigLevel, power);
    if (!isUnknown(n) && n < 4)
        throw new RangeError("number of observations must be at least 4");
    const alt = matchChoice(options.alternative, ALTERNATIVES);
    if (alt === "two.sided" && !isUnknown(r))
        r = Math.abs(r);
    const upper = (n, r, sig, twoSided) => {
        const t = qt(twoSided ? sig / 2 : sig, n - 2, { lowerTail: false });
        const rc = Math.sqrt(t ** 2 / (t ** 2 + n - 2));
        const zr = Math.atanh(r) + r / (2 * (n - 1));
        const zrc = Math.atanh(rc);
        const p = pnorm((zr - zrc) * Math.sqrt(n - 3));
        return twoSided ? p + pnorm((-zr - zrc) * Math.sqrt(n - 3)) : p;
    };
    const powerOf = (n, r, sig) => alt === "two.sided" ? upper(n, r, sig, true) : upper(n, alt === "less" ? -r : r, sig, false);
    if (isUnknown(power)) {
        power = powerOf(n, r, sigLevel);
        if (alt === "less")
            r = -r;
    }
    else {
        const target = power;
        if (isUnknown(n))
            n = solveFor((x) => powerOf(x, r, sigLevel) - target, 4 + 1e-10, 1e9);
        else if (isUnknown(r)) {
            const [lo, hi] = alt === "two.sided" ? [1e-10, 1 - 1e-10] : [-1 + 1e-10, 1 - 1e-10];
            r = solveFor((x) => powerOf(n, x, sigLevel) - target, lo, hi);
        }
        else
            sigLevel = solveFor((x) => powerOf(n, r, x) - target, 1e-10, 1 - 1e-10);
    }
    return {
        n: n,
        r: r,
        sigLevel: sigLevel,
        power,
        alternative: alt,
        method: "approximate correlation power calculation (arctangh transformation)",
    };
}
/**
 * Power of a chi-squared test, or the effect size, number of observations or significance level for a given power.
 * Equivalent to pwr's `pwr.chisq.test()`.
 */
export function pwrChisqTest(options) {
    let { N, power } = options;
    const { df } = options;
    let w = effect(options.w, "chisq");
    let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
    checkExactlyOne([w, N, power, sigLevel], "exactly one of w, N, power, and sig.level must be NULL");
    if (typeof df !== "number")
        throw new TypeError('argument "df" is missing, with no default');
    checkProbabilities(sigLevel, power);
    if (!isUnknown(w) && w < 0)
        throw new RangeError("w must be positive");
    if (!isUnknown(N) && N < 1)
        throw new RangeError("number of observations must be at least 1");
    const powerOf = (w, N, sig) => pchisq(qchisq(sig, df, { lowerTail: false }), df, { ncp: N * w ** 2, lowerTail: false });
    if (isUnknown(power))
        power = powerOf(w, N, sigLevel);
    else {
        const target = power;
        if (isUnknown(w))
            w = solveFor((x) => powerOf(x, N, sigLevel) - target, 1e-10, 1e9);
        else if (isUnknown(N))
            N = solveFor((x) => powerOf(w, x, sigLevel) - target, 1 + 1e-10, 1e9);
        else
            sigLevel = solveFor((x) => powerOf(w, N, x) - target, 1e-10, 1 - 1e-10);
    }
    return { w: w, N: N, df, sigLevel: sigLevel, power, method: "Chi squared power calculation", note: "N is the number of observations" };
}
/**
 * Power of the F test of a balanced one-way analysis of variance, or the number of groups, sample size, effect size
 * or significance level for a given power. Equivalent to pwr's `pwr.anova.test()`.
 */
export function pwrAnovaTest(options = {}) {
    let { k, n, power } = options;
    let f = effect(options.f, "anov");
    let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
    checkExactlyOne([k, n, f, power, sigLevel], "exactly one of k, n, f, power, and sig.level must be NULL");
    checkProbabilities(sigLevel, power);
    if (!isUnknown(f) && f < 0)
        throw new RangeError("f must be positive");
    if (!isUnknown(k) && k < 2)
        throw new RangeError("number of groups must be at least 2");
    if (!isUnknown(n) && n < 2)
        throw new RangeError("number of observations in each group must be at least 2");
    const powerOf = (k, n, f, sig) => {
        const df1 = k - 1;
        const df2 = (n - 1) * k;
        return pf(qf(sig, df1, df2, { lowerTail: false }), df1, df2, { ncp: k * n * f ** 2, lowerTail: false });
    };
    if (isUnknown(power))
        power = powerOf(k, n, f, sigLevel);
    else {
        const target = power;
        if (isUnknown(k))
            k = solveFor((x) => powerOf(x, n, f, sigLevel) - target, 2 + 1e-10, 100);
        else if (isUnknown(n))
            n = solveFor((x) => powerOf(k, x, f, sigLevel) - target, 2 + 1e-10, 1e9);
        else if (isUnknown(f))
            f = solveFor((x) => powerOf(k, n, x, sigLevel) - target, 1e-7, 1e7);
        else
            sigLevel = solveFor((x) => powerOf(k, n, f, x) - target, 1e-10, 1 - 1e-10);
    }
    return {
        k: k,
        n: n,
        f: f,
        sigLevel: sigLevel,
        power,
        note: "n is number in each group",
        method: "Balanced one-way analysis of variance power calculation",
    };
}
/**
 * Power of the F test of a general linear model, or the degrees of freedom, effect size or significance level for a
 * given power. Equivalent to pwr's `pwr.f2.test()`.
 */
export function pwrF2Test(options = {}) {
    let { u, v, power } = options;
    let f2 = effect(options.f2, "f2");
    let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
    checkExactlyOne([u, v, f2, power, sigLevel], "exactly one of u, v, f2, power, and sig.level must be NULL");
    checkProbabilities(sigLevel, power);
    if (!isUnknown(f2) && f2 < 0)
        throw new RangeError("f2 must be positive");
    if (!isUnknown(u) && u < 1)
        throw new RangeError("degree of freedom u for numerator must be at least 1");
    if (!isUnknown(v) && v < 1)
        throw new RangeError("degree of freedom v for denominator must be at least 1");
    const powerOf = (u, v, f2, sig) => pf(qf(sig, u, v, { lowerTail: false }), u, v, { ncp: f2 * (u + v + 1), lowerTail: false });
    if (isUnknown(power))
        power = powerOf(u, v, f2, sigLevel);
    else {
        const target = power;
        if (isUnknown(u))
            u = solveFor((x) => powerOf(x, v, f2, sigLevel) - target, 1 + 1e-10, 100);
        else if (isUnknown(v))
            v = solveFor((x) => powerOf(u, x, f2, sigLevel) - target, 1 + 1e-10, 1e9);
        else if (isUnknown(f2))
            f2 = solveFor((x) => powerOf(u, v, x, sigLevel) - target, 1e-7, 1e7);
        else
            sigLevel = solveFor((x) => powerOf(u, v, f2, x) - target, 1e-10, 1 - 1e-10);
    }
    return { u: u, v: v, f2: f2, sigLevel: sigLevel, power, method: "Multiple regression power calculation" };
}
