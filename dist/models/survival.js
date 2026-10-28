// Survival analysis: the G-rho family of tests (R's survdiff from the survival package: the log-rank test for rho = 0,
// Peto & Peto for rho = 1) and the Kaplan-Meier estimate with Greenwood's standard error, its pointwise confidence
// intervals and the median survival times (survival's survfit and summary(fit, censored = TRUE)).
//
// Written for rStats.js (no ported code) from oracle/survival-behaviour.md and the published methods: Kaplan and Meier
// (1958), "Nonparametric estimation from incomplete observations", JASA 53, 457-481; Greenwood (1926) for the variance;
// Harrington and Fleming (1982), "A class of rank test procedures for censored survival data", Biometrika 69, 553-566,
// for the weights S(t-)^rho; Brookmeyer and Crowley (1982) for the confidence limits of the median.
import { pchisq } from "../distributions/chisq.js";
import { qnorm } from "../distributions/normal.js";
import { levelText, numberLevels } from "../internal/levels.js";
import { solve } from "../linalg/solve.js";
const isMissing = (v) => v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
/** Observations with no missing value, the sorted labels and the group index of each */
function prepare(time, status, group) {
    if (time.length !== status.length)
        throw new RangeError("'time' and 'status' must have the same length");
    if (group !== undefined && group.length !== time.length)
        throw new RangeError("'group' must have the same length as 'time'");
    const keep = [];
    for (let i = 0; i < time.length; i++) {
        if (Number.isNaN(time[i]) || Number.isNaN(status[i]) || (group !== undefined && isMissing(group[i])))
            continue;
        const s = status[i];
        if (s !== 0 && s !== 1)
            throw new RangeError("'status' must be 0 (censored) or 1 (event)");
        keep.push(i);
    }
    if (keep.length === 0)
        throw new RangeError("no observations without missing values");
    let labels = [];
    const index = new Map();
    // numeric labels with the same 15-digit text are one group, as in R's factor()
    if (group !== undefined)
        group = numberLevels(group);
    if (group !== undefined) {
        labels = Array.from(new Set(keep.map((i) => group[i]))).sort((a, b) => typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
        labels.forEach((l, k) => index.set(l, k));
    }
    const obs = keep.map((i) => ({
        time: time[i],
        event: status[i] === 1,
        group: group === undefined ? 0 : index.get(group[i]),
    }));
    obs.sort((a, b) => a.time - b.time);
    return { obs, labels: labels.map((l) => `group=${levelText(l)}`) };
}
/**
 * Test of the difference between survival curves: the G-rho family of Harrington and Fleming, the log-rank test for
 * `rho = 0`. Equivalent to R's `survival::survdiff()`. As `survdiff(Surv(time, status) ~ group, rho = rho)`.
 *
 * Rows with a missing time, status or group are dropped.
 *
 * @param time Follow-up times.
 * @param status 1 for an event, 0 for a censored time.
 * @param group Group labels, one per observation.
 * @param options See {@link SurvdiffOptions}.
 *
 * @example
 * ```ts
 * const r = survdiff([1, 2, 3, 4, 5, 6], [1, 1, 0, 1, 1, 1], ["a", "b", "a", "b", "a", "b"]);
 * r.chisq;  // 0.073903
 * r.pvalue; // 0.78574
 * ```
 *
 * @category Survival analysis
 */
export function survdiff(time, status, group, options = {}) {
    const { rho = 0 } = options;
    if (!Number.isFinite(rho))
        throw new RangeError("'rho' must be a finite number");
    const { obs, labels } = prepare(time, status, group);
    const k = labels.length;
    const n = new Array(k).fill(0);
    for (const o of obs)
        n[o.group]++;
    const observed = new Array(k).fill(0);
    const expected = new Array(k).fill(0);
    const V = Array.from({ length: k }, () => new Array(k).fill(0));
    // at risk per group (time >= t); obs is sorted by time
    const atRisk = n.slice();
    let total = obs.length;
    let km = 1; // pooled Kaplan-Meier estimate just before the current time
    for (let i = 0; i < obs.length;) {
        const t = obs[i].time;
        let j = i;
        const dg = new Array(k).fill(0);
        const leaving = new Array(k).fill(0);
        let d = 0;
        while (j < obs.length && obs[j].time === t) {
            const o = obs[j];
            leaving[o.group]++;
            if (o.event) {
                dg[o.group]++;
                d++;
            }
            j++;
        }
        if (d > 0) {
            const w = rho === 0 ? 1 : km ** rho;
            for (let g = 0; g < k; g++) {
                observed[g] += w * dg[g];
                expected[g] += (w * d * atRisk[g]) / total;
            }
            if (total > 1) {
                const f = (w * w * d * (total - d)) / (total * (total - 1));
                for (let g = 0; g < k; g++) {
                    for (let h = 0; h < k; h++) {
                        V[g][h] += f * atRisk[g] * ((g === h ? 1 : 0) - atRisk[h] / total);
                    }
                }
            }
            km *= 1 - d / total;
        }
        for (let g = 0; g < k; g++)
            atRisk[g] -= leaving[g];
        total -= j - i;
        i = j;
    }
    // chi-squared on the groups with a positive expected count, dropping the first of them
    const used = expected.map((e, g) => (e > 0 ? g : -1)).filter((g) => g >= 0);
    let chisq = 0;
    if (used.length >= 2) {
        const r = used.slice(1);
        const u = r.map((g) => observed[g] - expected[g]);
        const x = solve(r.map((g) => r.map((h) => V[g][h])), u);
        chisq = u.reduce((s, ui, a) => s + ui * x[a], 0);
    }
    const pvalue = pchisq(chisq, used.length - 1, { lowerTail: false });
    return { n, groups: labels, obs: observed, exp: expected, var: V, chisq, pvalue };
}
/**
 * The median of a curve over the rows of a stratum: the first time at which it falls below 0.5, or, if it equals 0.5
 * (within sqrt(eps)) there, the midpoint between that time and the next event time. NaN if it never goes below
 * 0.5 + sqrt(eps).
 */
function curveMedian(time, nEvent, curve) {
    const tol = Math.sqrt(Number.EPSILON);
    for (let i = 0; i < curve.length; i++) {
        const c = curve[i];
        if (!(c < 0.5 + tol))
            continue;
        if (c > 0.5 - tol) {
            for (let j = i + 1; j < curve.length; j++)
                if (nEvent[j] > 0)
                    return (time[i] + time[j]) / 2;
            return time[i];
        }
        return time[i];
    }
    return NaN;
}
/**
 * Kaplan-Meier estimate of the survival function with Greenwood's standard error and pointwise confidence intervals.
 * Equivalent to R's `survival::survfit()`. As `summary(survfit(Surv(time, status) ~ group, conf.type, conf.int),
 * censored = TRUE)`, with the medians and their confidence limits of `summary(fit)$table`.
 *
 * Rows with a missing time, status or group are dropped.
 *
 * @param time Follow-up times.
 * @param status 1 for an event, 0 for a censored time.
 * @param options See {@link SurvfitOptions}.
 *
 * @example
 * ```ts
 * survfit([1, 2, 2, 3, 4], [1, 1, 0, 1, 0]).surv; // [0.8, 0.6, 0.3, 0.3]
 * ```
 *
 * @category Survival analysis
 */
export function survfit(time, status, options = {}) {
    const { group, confType = "log", confInt = 0.95 } = options;
    if (confType !== "log" && confType !== "plain" && confType !== "log-log") {
        throw new RangeError(`invalid 'confType': ${String(confType)}`);
    }
    if (!(confInt > 0 && confInt < 1))
        throw new RangeError("'confInt' must be between 0 and 1");
    const { obs, labels } = prepare(time, status, group);
    const names = group === undefined ? ["all"] : labels;
    const z = qnorm(1 - (1 - confInt) / 2);
    const out = {
        strata: [], time: [], nRisk: [], nEvent: [], nCensor: [], surv: [], stdErr: [], lower: [], upper: [],
        median: [], medianRows: names,
    };
    names.forEach((name, g) => {
        const rows = obs.filter((o) => o.group === g);
        const start = out.time.length;
        let atRisk = rows.length;
        let S = 1;
        let greenwood = 0;
        for (let i = 0; i < rows.length;) {
            const t = rows[i].time;
            let j = i;
            let d = 0;
            while (j < rows.length && rows[j].time === t) {
                if (rows[j].event)
                    d++;
                j++;
            }
            const c = j - i - d;
            if (d > 0) {
                S *= 1 - d / atRisk;
                greenwood += d < atRisk ? d / (atRisk * (atRisk - d)) : Infinity;
            }
            const sigma = Math.sqrt(greenwood);
            let lo;
            let up;
            if (confType === "log") {
                lo = S === 0 ? NaN : S * Math.exp(-z * sigma);
                up = S === 0 ? NaN : Math.min(1, S * Math.exp(z * sigma));
            }
            else if (confType === "plain") {
                const h = z * sigma * S;
                lo = Number.isNaN(h) ? NaN : Math.max(0, S - h);
                up = Number.isNaN(h) ? NaN : Math.min(1, S + h);
            }
            else if (S === 0 || S === 1) {
                lo = NaN;
                up = NaN;
            }
            else {
                const ls = Math.log(S);
                const m = Math.log(-ls);
                lo = Math.exp(-Math.exp(m - (z * sigma) / ls));
                up = Math.exp(-Math.exp(m + (z * sigma) / ls));
            }
            out.strata.push(name);
            out.time.push(t);
            out.nRisk.push(atRisk);
            out.nEvent.push(d);
            out.nCensor.push(c);
            out.surv.push(S);
            out.stdErr.push(S * sigma);
            out.lower.push(lo);
            out.upper.push(up);
            atRisk -= j - i;
            i = j;
        }
        const tt = out.time.slice(start);
        const ev = out.nEvent.slice(start);
        out.median.push([
            curveMedian(tt, ev, out.surv.slice(start)),
            curveMedian(tt, ev, out.lower.slice(start)),
            curveMedian(tt, ev, out.upper.slice(start)),
        ]);
    });
    return out;
}
