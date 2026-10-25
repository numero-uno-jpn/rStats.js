// One-way analysis of means (R's oneway.test) and the Shapiro-Wilk normality test (R's shapiro.test).
//
// Written for rStats.js from the published formulas (no ported code). oneway.test: with equal variances the classical
// F = (sum n_i (m_i - m)^2 / (k - 1)) / (sum (n_i - 1) s_i^2 / (N - k)); otherwise Welch's (Biometrika 38, 1951)
// weighted statistic with w_i = n_i / s_i^2, F = sum w_i (m_i - m_w)^2 / ((k - 1)(1 + 2 (k - 2) c)),
// c = sum (1 - w_i / sum w)^2 / (n_i - 1) / (k^2 - 1), on (k - 1, 1 / (3 c)) degrees of freedom.
// shapiro.test: W and its p-value from src/htest/core/shapiro.ts (Royston's AS R94).
import { pf1 } from "../distributions/f.js";
import { mean, variance } from "../internal/summary.js";
import { swilkOneMinusW, swilkPValueFromOneMinusW } from "./core/shapiro.js";
import { toGroups } from "./groups.js";
/**
 * Test that several normal samples have equal means, without (default) or with the assumption of equal variances.
 * Equivalent to R's `oneway.test()`.
 *
 * @param x An array of samples, or one sample with group labels `g`.
 * @param g Group labels, parallel to `x` (or the options, when `x` is an array of samples).
 */
export function onewayTest(x, g, options = {}) {
    let labels;
    if (g !== undefined && !Array.isArray(g))
        options = g;
    else
        labels = g;
    const groups = toGroups(x, labels);
    const varEqual = options.varEqual ?? false;
    const k = groups.length;
    if (k < 2)
        throw new RangeError("not enough groups");
    const ni = groups.map((s) => s.length);
    if (ni.some((n) => n < 2))
        throw new RangeError("not enough observations");
    const mi = groups.map(mean);
    const vi = groups.map(variance);
    const N = ni.reduce((a, b) => a + b, 0);
    let statistic;
    let df2;
    if (varEqual) {
        const m = mean(groups.flat());
        let between = 0;
        let within = 0;
        for (let i = 0; i < k; i++) {
            between += ni[i] * (mi[i] - m) ** 2;
            within += (ni[i] - 1) * vi[i];
        }
        df2 = N - k;
        statistic = between / (k - 1) / (within / df2);
    }
    else {
        const wi = ni.map((n, i) => n / vi[i]);
        const sw = wi.reduce((a, b) => a + b, 0);
        let c = 0;
        let mw = 0;
        for (let i = 0; i < k; i++) {
            c += (1 - wi[i] / sw) ** 2 / (ni[i] - 1);
            mw += wi[i] * mi[i];
        }
        c /= k * k - 1;
        mw /= sw;
        let num = 0;
        for (let i = 0; i < k; i++)
            num += wi[i] * (mi[i] - mw) ** 2;
        statistic = num / ((k - 1) * (1 + 2 * (k - 2) * c));
        df2 = 1 / (3 * c);
    }
    return {
        method: varEqual ? "One-way analysis of means" : "One-way analysis of means (not assuming equal variances)",
        statistic,
        statisticName: "F",
        parameter: [k - 1, df2],
        parameterName: ["num df", "denom df"],
        pValue: pf1(statistic, k - 1, df2, false, false),
    };
}
/**
 * Shapiro-Wilk test of normality. Equivalent to R's `shapiro.test()`. `NaN` values are dropped; the sample size must
 * be between 3 and 5000.
 */
export function shapiroTest(x) {
    const xs = Array.from(x)
        .filter((v) => !Number.isNaN(v))
        .sort((a, b) => a - b);
    const n = xs.length;
    if (n < 3 || n > 5000)
        throw new RangeError("sample size must be between 3 and 5000");
    if (!Number.isFinite(xs[0]) || !Number.isFinite(xs[n - 1]))
        throw new RangeError("'x' must be finite");
    if (xs[n - 1] === xs[0])
        throw new RangeError("all 'x' values are identical");
    const w1 = swilkOneMinusW(xs);
    return {
        method: "Shapiro-Wilk normality test",
        statistic: 1 - w1,
        statisticName: "W",
        pValue: swilkPValueFromOneMinusW(w1, n),
    };
}
