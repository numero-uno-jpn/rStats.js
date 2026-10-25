// Test of proportions (R's prop.test): one proportion against a hypothesized value, equality of k proportions, or k
// proportions against given values.
//
// Written for rStats.js from the textbook construction and R's documented behaviour (groups with a missing count are
// dropped; a given p has one value per group before dropping). The statistic is Pearson's chi-squared on the k x 2
// table of successes and failures, with Yates' continuity correction (|O - E| - c) for k <= 2, where c = 1/2 is
// reduced so as not to overshoot (to |x - n p| for one sample, and |p1 - p2| / (1/n1 + 1/n2) for two without p; the
// statistic is then exactly 0). One-sided alternatives use the signed square root of the statistic as a normal
// deviate. Intervals: the Wilson score interval (Wilson, JASA 22, 1927) with continuity correction for one proportion
// (Newcombe, Statistics in Medicine 17, 1998, method 4), and the Wald interval with continuity correction for the
// difference of two.
import { pgamma1 } from "../distributions/gamma.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { checkConfLevelOpen, matchAlternative } from "./types.js";
/**
 * Test of equal or given proportions. Equivalent to R's `prop.test()`.
 *
 * @param x Numbers of successes, or a table of rows `[successes, failures]`.
 * @param n Numbers of trials (omitted, and the options passed in its place, when `x` is a table).
 * @param options See {@link PropTestOptions}.
 *
 * @example
 * ```ts
 * propTest([83, 90, 129, 70], [86, 93, 136, 82]).pValue; // equality of four proportions
 * propTest(15, 20, { p: 0.5 }).confInt;
 * ```
 */
export function propTest(x, n, options = {}) {
    // ---- inputs: successes and trials per group ----
    let xs;
    let ns;
    let opts = options;
    if (typeof x !== "number" && x.length > 0 && Array.isArray(x[0])) {
        const rows = x;
        if (rows.some((r) => r.length !== 2))
            throw new RangeError("'x' must have 2 columns");
        xs = rows.map((r) => r[0]);
        ns = rows.map((r) => r[0] + r[1]);
        if (n !== undefined && typeof n === "object" && !Array.isArray(n))
            opts = n;
    }
    else {
        if (n === undefined || (typeof n === "object" && !Array.isArray(n)))
            throw new RangeError("'n' must be given");
        xs = typeof x === "number" ? [x] : Array.from(x);
        ns = typeof n === "number" ? [n] : Array.from(n);
    }
    if (xs.length !== ns.length)
        throw new RangeError("'x' and 'n' must have the same length");
    const L = xs.length;
    const kept = []; // 0-based positions of the groups without missing values
    for (let i = 0; i < L; i++)
        if (!Number.isNaN(xs[i]) && !Number.isNaN(ns[i]))
            kept.push(i);
    const k = kept.length;
    if (k < 1)
        throw new RangeError("not enough data");
    xs = kept.map((i) => xs[i]);
    ns = kept.map((i) => ns[i]);
    if (ns.some((v) => !(v > 0)))
        throw new RangeError("elements of 'n' must be positive");
    if (xs.some((v) => !(v >= 0)))
        throw new RangeError("elements of 'x' must be nonnegative");
    if (xs.some((v, i) => v > ns[i]))
        throw new RangeError("elements of 'x' must not be greater than those of 'n'");
    let p;
    if (opts.p !== undefined) {
        const given = typeof opts.p === "number" ? [opts.p] : Array.from(opts.p);
        if (given.length !== L)
            throw new RangeError("'p' must have the same length as 'x' and 'n'");
        p = kept.map((i) => given[i]);
        if (p.some((v) => !(v > 0 && v < 1)))
            throw new RangeError("elements of 'p' must be in (0,1)");
    }
    const pGiven = p !== undefined;
    if (k === 1 && p === undefined)
        p = [0.5];
    const confLevel = opts.confLevel ?? 0.95;
    checkConfLevelOpen(confLevel);
    let alternative = matchAlternative(opts.alternative);
    if (k > 2 || (k === 2 && pGiven))
        alternative = "two.sided";
    const phat = xs.map((v, i) => v / ns[i]);
    const delta = k === 2 ? phat[0] - phat[1] : 0;
    const invSum = k === 2 ? 1 / ns[0] + 1 / ns[1] : 0;
    // ---- continuity correction, reduced so as not to overshoot |O - E| ----
    let yates = (opts.correct ?? true) && k <= 2 ? 0.5 : 0;
    let capped = false;
    if (yates > 0 && k === 1) {
        const gap = Math.abs(xs[0] - ns[0] * p[0]);
        if (gap <= yates)
            [yates, capped] = [gap, true];
    }
    else if (yates > 0 && k === 2 && !pGiven) {
        const gap = Math.abs(delta) / invSum;
        if (gap <= yates)
            [yates, capped] = [gap, true];
    }
    // ---- Pearson's chi-squared on the k x 2 table of successes and failures ----
    const pooled = xs.reduce((a, b) => a + b, 0) / ns.reduce((a, b) => a + b, 0);
    let statistic = 0;
    if (!capped) {
        for (let i = 0; i < k; i++) {
            const pi = p?.[i] ?? pooled;
            const e1 = ns[i] * pi;
            const e2 = ns[i] * (1 - pi);
            statistic += (Math.abs(xs[i] - e1) - yates) ** 2 / e1;
            statistic += (Math.abs(ns[i] - xs[i] - e2) - yates) ** 2 / e2;
        }
    }
    const df = p !== undefined ? k : k - 1;
    let pValue;
    if (alternative === "two.sided")
        pValue = pgamma1(statistic, df / 2, 2, false, false);
    else {
        const sign = Math.sign(k === 1 ? phat[0] - p[0] : delta);
        pValue = pnorm(sign * Math.sqrt(statistic), { lowerTail: alternative === "less" });
    }
    // ---- confidence interval ----
    let confInt;
    if (k === 1 || (k === 2 && !pGiven)) {
        const z = qnorm(alternative === "two.sided" ? (1 + confLevel) / 2 : confLevel);
        if (k === 1) {
            const nn = ns[0];
            const z2 = z * z;
            // Wilson score bound for the shifted proportion pc (Newcombe 1998, method 4)
            const wilson = (pc, sgn) => (pc + z2 / (2 * nn) + sgn * z * Math.sqrt((pc * (1 - pc)) / nn + z2 / (4 * nn * nn))) / (1 + z2 / nn);
            const pUp = phat[0] + yates / nn;
            const pLo = phat[0] - yates / nn;
            const upper = Math.min(1, Math.max(0, pUp >= 1 ? 1 : wilson(pUp, 1)));
            const lower = Math.min(1, Math.max(0, pLo <= 0 ? 0 : wilson(pLo, -1)));
            confInt = alternative === "two.sided" ? [lower, upper] : alternative === "greater" ? [lower, 1] : [0, upper];
        }
        else {
            const se = Math.sqrt(phat.reduce((acc, v, i) => acc + (v * (1 - v)) / ns[i], 0));
            const w = z * se + yates * invSum;
            const lower = Math.max(-1, delta - w);
            const upper = Math.min(1, delta + w);
            confInt = alternative === "two.sided" ? [lower, upper] : alternative === "greater" ? [lower, 1] : [-1, upper];
        }
    }
    const names = k === 1 ? "p" : kept.map((i) => `prop ${i + 1}`);
    const kind = k === 1 ? "1-sample proportions test" : `${k}-sample test for ${pGiven ? "given proportions" : "equality of proportions"}`;
    const result = {
        method: `${kind} ${yates !== 0 ? "with" : "without"} continuity correction`,
        alternative,
        statistic,
        statisticName: "X-squared",
        parameter: df,
        parameterName: "df",
        pValue,
        estimate: k === 1 ? phat[0] : phat,
        estimateNames: names,
    };
    if (p !== undefined) {
        result.nullValue = k === 1 ? p[0] : p;
        result.nullValueName = names;
    }
    if (confInt !== undefined) {
        result.confInt = confInt;
        result.confLevel = confLevel;
    }
    return result;
}
