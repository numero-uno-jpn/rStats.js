// One-way analysis of variance (the table of R's summary(aov(y ~ g))), aov from a model formula (the fit of
// src/models/lm.ts; its table is aovSummary in src/models/anovaSequential.ts), Tukey's honest significant differences (R's
// TukeyHSD) and the z test with known standard deviations (as BSDA's z.test).
//
// Written for rStats.js from the textbook formulas. The sums of squares are accumulated in
// double-double: between groups sum n_i (m_i - m)^2, within groups sum (x - m_i)^2, so a within sum that is exactly
// 0 stays 0 (F = Inf; R's QR leaves rounding residue there). TukeyHSD uses the Tukey-Kramer standard error
// sqrt(MSE / 2 (1/n_i + 1/n_j)) with the studentized range distribution for the interval and the adjusted p-value.
// zTest is the textbook z test (standard error sigma / sqrt(n), or sqrt(sigma_x^2/n_x + sigma_y^2/n_y) for two
// samples, normal quantiles for the interval around the estimate); its input checks (at least 3 observations,
// confLevel allowed in the closed [0, 1]) follow BSDA's documented/observed behaviour, with messages of our own.
import { pf1 } from "../distributions/f.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { ptukey, qtukey } from "../distributions/tukey.js";
import { meanDD } from "../internal/summary.js";
import { ddAdd, ddMul, ddSub } from "../special/dd.js";
import { parseFormula, splitErrorTerms } from "../models/formula.js";
import { aovStrataFit } from "../models/aovStrata.js";
import { lmFormulaFit } from "../models/lm.js";
import { design } from "../models/modelMatrix.js";
import { labelledGroups, toGroups } from "./groups.js";
import { matchAlternative } from "./types.js";
function sums(groups) {
    const all = groups.flat();
    const m = meanDD(all);
    let ssb = [0, 0];
    let ssw = [0, 0];
    const means = [];
    for (const g of groups) {
        const mi = meanDD(g);
        means.push(mi[0]);
        const d = ddSub(mi, m);
        ssb = ddAdd(ssb, ddMul(ddMul(d, d), [g.length, 0]));
        for (const v of g) {
            const e = ddSub([v, 0], mi);
            ssw = ddAdd(ssw, ddMul(e, e));
        }
    }
    return { ssb: ssb[0], ssw: ssw[0], means };
}
export function aov(x, g, options = {}) {
    if (typeof x === "string")
        return aovFormula(x, g, options);
    return aovOneway(x, g);
}
/** aov from a formula (without Error() strata) */
function aovFormula(formula, data, options) {
    const parsed = parseFormula(formula, true);
    const { treatment, errors } = splitErrorTerms(parsed.rhs);
    if (errors.length > 1)
        throw new Error(`there are ${errors.length} Error terms: only 1 is allowed`);
    if (errors.length === 1)
        return aovStrataFit(formula, parsed, treatment, errors[0], data, options);
    return lmFormulaFit(formula, design(parsed, data, { ...options, dropUnusedLevels: true }, treatment), true);
}
function aovOneway(x, g) {
    const groups = toGroups(x, g);
    const k = groups.length;
    if (k < 2)
        throw new RangeError("contrasts can be applied only to factors with 2 or more levels");
    const N = groups.reduce((a, s) => a + s.length, 0);
    const { ssb, ssw } = sums(groups);
    const df1 = k - 1;
    const df2 = N - k;
    const msb = ssb / df1;
    const msw = ssw / df2;
    const fValue = msb / msw;
    return {
        df: [df1, df2],
        sumSq: [ssb, ssw],
        meanSq: [msb, msw],
        fValue,
        pValue: df2 > 0 ? pf1(fValue, df1, df2, false, false) : NaN,
    };
}
/**
 * Tukey's honest significant differences between the group means of a one-way ANOVA (Tukey-Kramer for unequal
 * sizes). Equivalent to R's `TukeyHSD(aov(y ~ g))`.
 *
 * @param x An array of samples (groups), or one sample with group labels `g` (then `options` comes third).
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * const r = TukeyHSD(x, g);
 * r.names; // ["b-a", "c-a", "c-b"]
 * r.diff;  // [1.4333333333333336, 2.7666666666666666, 1.333333333333333]
 * r.pAdj;  // [0.03403130149294014, 0.001492661804896774, 0.04527523376597547]
 * ```
 *
 * @category Multiple comparisons
 */
export function TukeyHSD(x, g, options = {}) {
    let labels;
    if (g !== undefined && !Array.isArray(g))
        options = g;
    else
        labels = g;
    // names follow the groups: a label (or list position) whose values are all missing has no group, as R drops the
    // unused factor level
    const { labels: names, groups } = labelledGroups(x, labels);
    const k = groups.length;
    if (k < 2)
        throw new RangeError("contrasts can be applied only to factors with 2 or more levels");
    const confLevel = options.confLevel ?? 0.95;
    const N = groups.reduce((a, s) => a + s.length, 0);
    const df = N - k;
    const { ssw, means } = sums(groups);
    const mse = ssw / df;
    const q = qtukey(confLevel, k, df);
    const out = { names: [], i: [], j: [], diff: [], lwr: [], upr: [], pAdj: [] };
    for (let b = 0; b < k - 1; b++) {
        for (let a = b + 1; a < k; a++) {
            const diff = means[a] - means[b];
            const se = Math.sqrt((mse / 2) * (1 / groups[a].length + 1 / groups[b].length));
            out.names.push(`${names[a]}-${names[b]}`);
            out.i.push(a + 1);
            out.j.push(b + 1);
            out.diff.push(diff);
            out.lwr.push(diff - q * se);
            out.upr.push(diff + q * se);
            out.pAdj.push(ptukey(Math.abs(diff) / se, k, df, { lowerTail: false }));
        }
    }
    return out;
}
/**
 * z test for the mean of one sample, or the difference of the means of two, with known standard deviations.
 * Equivalent to `BSDA::z.test()` in R. The open end of a one-sided interval is ±Infinity here (NA in BSDA). `NaN`
 * values are dropped.
 *
 * @example
 * ```ts
 * zTest([5.1, 4.9, 5.6, 5.8, 6.0], { mu: 5, sigmaX: 0.5 }).pValue; // 0.031823127386490346
 * ```
 *
 * @category Hypothesis tests
 */
export function zTest(x, y, options = {}) {
    let ys;
    if (y !== undefined && !ArrayBuffer.isView(y) && !Array.isArray(y))
        options = y;
    else
        ys = y;
    const { sigmaX, sigmaY } = options;
    const mu = options.mu ?? 0;
    if (sigmaX === undefined && ys === undefined)
        throw new RangeError("sigmaX (the known standard deviation of x) is required");
    if (sigmaX === undefined || (ys !== undefined && sigmaY === undefined)) {
        throw new RangeError("sigmaX and sigmaY are both required for two samples");
    }
    if (Number.isNaN(mu))
        throw new RangeError("mu must be a number");
    const alternative = matchAlternative(options.alternative);
    const confLevel = options.confLevel ?? 0.95;
    if (!(confLevel >= 0 && confLevel <= 1))
        throw new RangeError("confLevel must be between 0 and 1");
    const xs = Array.from(x).filter((v) => !Number.isNaN(v));
    const yv = ys === undefined ? undefined : Array.from(ys).filter((v) => !Number.isNaN(v));
    if (xs.length < 3)
        throw new RangeError("x needs at least 3 non-missing values");
    if (yv !== undefined && yv.length < 3)
        throw new RangeError("y needs at least 3 non-missing values");
    const meanX = meanDD(xs)[0];
    const meanY = yv === undefined ? NaN : meanDD(yv)[0];
    const se = yv === undefined ? sigmaX / Math.sqrt(xs.length) : Math.sqrt(sigmaX ** 2 / xs.length + sigmaY ** 2 / yv.length);
    const target = yv === undefined ? meanX : meanX - meanY;
    const z = (target - mu) / se;
    let pValue;
    let confInt;
    if (alternative === "less") {
        pValue = pnorm(z);
        confInt = [-Infinity, target + qnorm(confLevel) * se];
    }
    else if (alternative === "greater") {
        pValue = pnorm(z, { lowerTail: false });
        confInt = [target - qnorm(confLevel) * se, Infinity];
    }
    else {
        pValue = 2 * pnorm(-Math.abs(z));
        const half = qnorm(1 - (1 - confLevel) / 2) * se;
        confInt = [target - half, target + half];
    }
    const twoSample = yv !== undefined;
    return {
        method: twoSample ? "Two-sample z-Test" : "One-sample z-Test",
        alternative,
        statistic: z,
        statisticName: "z",
        pValue,
        confInt,
        confLevel,
        estimate: twoSample ? [meanX, meanY] : meanX,
        estimateNames: twoSample ? ["mean of x", "mean of y"] : "mean of x",
        nullValue: mu,
        nullValueName: twoSample ? "difference in means" : "mean",
    };
}
