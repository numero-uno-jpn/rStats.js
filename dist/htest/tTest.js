// t-test (R's t.test): one-sample, two-sample (Welch / equal variance) and paired.
//
// The statistic and degrees-of-freedom formulas are the same as scipy.stats ttest_1samp, ttest_ind
// (equal_var = False is Welch) and ttest_rel (scipy/stats/_stats_py.py; SciPy commit a087e61,
// BSD-3-Clause, see THIRD_PARTY_NOTICES.md). Defaults, confidence intervals and result names follow R's output.
// - Welch is the default (scipy's default is equal variance)
// - If the standard error is below 10 eps times the absolute mean, the data are treated as constant and an error is raised (as in R)
import { pt1, qt1 } from "../distributions/t.js";
import { completePairs, dropNaN, mean, variance } from "../internal/summary.js";
import { twoSampleData } from "./testFormula.js";
import { checkConfLevel, matchAlternative } from "./types.js";
export function tTest(x, y, options = {}) {
    if (typeof x === "string")
        return tTestFormula(x, y, options);
    // Also accept the form tTest(x, { mu: 1 })
    let ys;
    if (y !== undefined && !ArrayBuffer.isView(y) && !Array.isArray(y))
        options = y;
    else
        ys = y;
    const alternative = matchAlternative(options.alternative);
    const mu = options.mu ?? 0;
    const paired = options.paired ?? false;
    const varEqual = options.varEqual ?? false;
    const confLevel = options.confLevel ?? 0.95;
    if (Number.isNaN(mu))
        throw new RangeError("mu must be a number");
    checkConfLevel(confLevel);
    if (paired && ys === undefined)
        throw new TypeError("y is required when paired is true");
    let xs = Array.from(x);
    let yv = ys === undefined ? undefined : Array.from(ys);
    if (paired) {
        const [a, b] = completePairs(xs, yv);
        xs = a.map((v, i) => v - b[i]);
        yv = undefined;
    }
    else {
        xs = dropNaN(xs);
        if (yv !== undefined)
            yv = dropNaN(yv);
    }
    let tstat;
    let df;
    let stdErr;
    let estimate;
    let estimateNames;
    let method;
    let nullValueName;
    const nx = xs.length;
    if (nx < 2)
        throw new Error("not enough 'x' observations");
    const mx = mean(xs);
    const vx = variance(xs);
    if (yv === undefined) {
        df = nx - 1;
        stdErr = Math.sqrt(vx / nx);
        if (stdErr < 10 * Number.EPSILON * Math.abs(mx))
            throw new Error("data are essentially constant");
        tstat = (mx - mu) / stdErr;
        method = paired ? "Paired t-test" : "One Sample t-test";
        estimate = mx;
        estimateNames = paired ? "mean difference" : "mean of x";
        nullValueName = paired ? "mean difference" : "mean";
    }
    else {
        const ny = yv.length;
        if (ny < 1 || (!varEqual && ny < 2))
            throw new Error("not enough 'y' observations");
        if (varEqual && nx + ny < 3)
            throw new Error("not enough observations");
        const my = mean(yv);
        const vy = variance(yv);
        method = `${varEqual ? "" : "Welch"} Two Sample t-test`;
        estimate = [mx, my];
        estimateNames = ["mean of x", "mean of y"];
        nullValueName = "difference in means";
        if (varEqual) {
            df = nx + ny - 2;
            let v = 0;
            if (nx > 1)
                v += (nx - 1) * vx;
            if (ny > 1)
                v += (ny - 1) * vy;
            v /= df;
            stdErr = Math.sqrt(v * (1 / nx + 1 / ny));
        }
        else {
            const sx = vx / nx;
            const sy = vy / ny;
            stdErr = Math.sqrt(sx + sy);
            df = (stdErr * stdErr) ** 2 / ((sx * sx) / (nx - 1) + (sy * sy) / (ny - 1));
        }
        if (stdErr < 10 * Number.EPSILON * Math.max(Math.abs(mx), Math.abs(my))) {
            throw new Error("data are essentially constant");
        }
        tstat = (mx - my - mu) / stdErr;
    }
    let pValue;
    let confInt;
    if (alternative === "less") {
        pValue = pt1(tstat, df, true, false);
        confInt = [-Infinity, tstat + qt1(confLevel, df, true, false)];
    }
    else if (alternative === "greater") {
        pValue = pt1(tstat, df, false, false);
        confInt = [tstat - qt1(confLevel, df, true, false), Infinity];
    }
    else {
        pValue = 2 * pt1(-Math.abs(tstat), df, true, false);
        const alpha = 1 - confLevel;
        const c = qt1(1 - alpha / 2, df, true, false);
        confInt = [tstat - c, tstat + c];
    }
    confInt = [mu + confInt[0] * stdErr, mu + confInt[1] * stdErr];
    return {
        method,
        alternative,
        statistic: tstat,
        statisticName: "t",
        parameter: df,
        parameterName: "df",
        pValue,
        confInt,
        confLevel,
        estimate,
        estimateNames,
        nullValue: mu,
        nullValueName,
        stdErr,
    };
}
/** t.test from a formula: the default form on the data the formula selects, with the estimates named after the levels */
function tTestFormula(formula, data, options) {
    if (options.paired !== undefined)
        throw new Error("cannot use 'paired' in formula method");
    const d = twoSampleData(formula, data, true);
    if (d.kind === "one")
        return tTest(d.x, options);
    if (d.kind === "paired")
        return tTest(d.x, d.y, { ...options, paired: true });
    const [first, second] = d.levels;
    return {
        ...tTest(d.x, d.y, options),
        estimateNames: [`mean in group ${first}`, `mean in group ${second}`],
        nullValueName: `difference in means between group ${first} and group ${second}`,
    };
}
