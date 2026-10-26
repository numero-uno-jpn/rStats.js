// Cox proportional hazards regression for right-censored data with a matrix interface: R's coxph from the survival
// package (the fit, with Efron's or Breslow's handling of ties, case weights and strata) and the values of
// summary(fit): the coefficient table, the confidence intervals of exp(coef), the likelihood ratio, score and Wald
// tests and the R^2 of Nagelkerke's kind.
//
// Written for rStats.js (no ported code) from oracle/coxph-behaviour.md (a description of the behaviour of survival
// 3.8-3) and the published methods: Cox (1972), "Regression models and life-tables", JRSS B 34, 187-220; Efron (1977),
// "The efficiency of Cox's likelihood function for censored data", JASA 72, 557-565; Breslow (1974), "Covariance
// analysis of censored survival data", Biometrics 30, 89-99. Newton-Raphson runs on centred and scaled covariates and
// uses a generalised Cholesky factorisation (LDL' with a tolerance on the pivots) so that aliased columns get NaN
// (R's NA) coefficients.
import { pchisq } from "../distributions/chisq.js";
import { qnorm } from "../distributions/normal.js";
import { Warnings } from "./glmFamily.js";
const isMissingLabel = (v) => v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
const compareLabels = (a, b) => typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
/** Times within sqrt(eps) (absolutely or relative to the mean absolute distinct time) merged to the smaller one */
function mergeTiedTimes(time) {
    const tol = Math.sqrt(2 ** -52);
    const distinct = Array.from(new Set(time.filter((t) => Number.isFinite(t)))).sort((a, b) => a - b);
    if (distinct.length < 2)
        return time.slice();
    let meanAbs = 0;
    for (const y of distinct)
        meanAbs += Math.abs(y);
    meanAbs /= distinct.length;
    const cuts = [distinct[0]];
    for (let k = 0; k + 1 < distinct.length; k++) {
        const gap = distinct[k + 1] - distinct[k];
        if (!(gap <= tol || gap / meanAbs <= tol))
            cuts.push(distinct[k + 1]);
    }
    return time.map((t) => {
        if (!Number.isFinite(t))
            return t;
        // the largest cut point not above t
        let lo = 0;
        let hi = cuts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (cuts[mid] <= t)
                lo = mid;
            else
                hi = mid - 1;
        }
        return cuts[lo];
    });
}
function evaluate(data, beta, efron) {
    const { time, event, weight, x, stratumEnd } = data;
    const n = time.length;
    const p = beta.length;
    const zeros = () => new Array(p).fill(0);
    const zeroMatrix = () => Array.from({ length: p }, zeros);
    const score = zeros();
    const info = zeroMatrix();
    let loglik = 0;
    let riskSum = 0;
    let riskX = zeros();
    let riskXX = zeroMatrix();
    const deathX = zeros();
    const deathXX = zeroMatrix();
    for (let k = n - 1; k >= 0;) {
        if (stratumEnd[k]) {
            riskSum = 0;
            riskX = zeros();
            riskXX = zeroMatrix();
        }
        const t = time[k];
        let deaths = 0;
        let deathWeight = 0;
        let deathRisk = 0;
        let j = k;
        do {
            const xj = x[j];
            let eta = 0;
            for (let i = 0; i < p; i++)
                eta += beta[i] * xj[i];
            const w = weight[j];
            const r = Math.exp(eta) * w;
            if (!event[j]) {
                riskSum += r;
                for (let i = 0; i < p; i++) {
                    riskX[i] += r * xj[i];
                    const row = riskXX[i];
                    for (let l = 0; l <= i; l++)
                        row[l] += r * xj[i] * xj[l];
                }
            }
            else {
                deaths++;
                deathWeight += w;
                deathRisk += r;
                loglik += w * eta;
                for (let i = 0; i < p; i++) {
                    score[i] += w * xj[i];
                    deathX[i] += r * xj[i];
                    const row = deathXX[i];
                    for (let l = 0; l <= i; l++)
                        row[l] += r * xj[i] * xj[l];
                }
            }
            j--;
        } while (j >= 0 && time[j] === t && !stratumEnd[j]);
        if (deaths > 0) {
            const steps = efron ? deaths : 1;
            const share = efron ? deaths : 1;
            const stepWeight = deathWeight / steps;
            for (let s = 0; s < steps; s++) {
                riskSum += efron ? deathRisk / share : deathRisk;
                loglik -= stepWeight * Math.log(riskSum);
                for (let i = 0; i < p; i++) {
                    riskX[i] += efron ? deathX[i] / share : deathX[i];
                    const mean = riskX[i] / riskSum;
                    score[i] -= stepWeight * mean;
                    const row = riskXX[i];
                    const drow = deathXX[i];
                    const irow = info[i];
                    for (let l = 0; l <= i; l++) {
                        row[l] += efron ? drow[l] / share : drow[l];
                        irow[l] += (stepWeight * (row[l] - mean * riskX[l])) / riskSum;
                    }
                }
            }
            deathX.fill(0);
            for (const row of deathXX)
                row.fill(0);
        }
        k = j;
    }
    for (let i = 0; i < p; i++)
        for (let l = 0; l < i; l++)
            info[l][i] = info[i][l];
    return { loglik, score, info };
}
/**
 * Generalised Cholesky factorisation M = L D L' in place (D on the diagonal, L below it), pivots below the tolerance
 * set to 0. Returns the rank (negative when M is not non-negative definite).
 */
function cholFactor(m, tol) {
    const p = m.length;
    let scale = 0;
    let anyPositive = false;
    for (let i = 0; i < p; i++) {
        const d = m[i][i];
        if (d > 0) {
            if (!anyPositive || d > scale)
                scale = d;
            anyPositive = true;
        }
    }
    const limit = anyPositive ? scale * tol : tol;
    let rank = 0;
    let nonNegative = true;
    for (let i = 0; i < p; i++) {
        const pivot = m[i][i];
        if (!Number.isFinite(pivot) || pivot < limit) {
            m[i][i] = 0;
            if (pivot < -8 * limit)
                nonNegative = false;
            continue;
        }
        rank++;
        for (let j = i + 1; j < p; j++) {
            const t = m[j][i] / pivot;
            m[j][i] = t;
            m[j][j] -= t * t * pivot;
            for (let k = j + 1; k < p; k++)
                m[k][j] -= t * m[k][i];
        }
    }
    return nonNegative ? rank : -rank;
}
/** Solves M y = b with the factor of {@link cholFactor} (0 for the dropped pivots) */
function cholSolve(m, b) {
    const p = m.length;
    const y = b.slice();
    for (let i = 0; i < p; i++) {
        let v = y[i];
        for (let j = 0; j < i; j++)
            v -= y[j] * m[i][j];
        y[i] = v;
    }
    for (let i = p - 1; i >= 0; i--) {
        if (m[i][i] === 0) {
            y[i] = 0;
            continue;
        }
        let v = y[i] / m[i][i];
        for (let j = i + 1; j < p; j++)
            v -= y[j] * m[j][i];
        y[i] = v;
    }
    return y;
}
/** The (generalised) inverse from the factor of {@link cholFactor}, in place; returns the full symmetric matrix */
function cholInverse(m) {
    const p = m.length;
    for (let i = 0; i < p; i++) {
        if (!(m[i][i] > 0))
            continue;
        m[i][i] = 1 / m[i][i];
        for (let j = i + 1; j < p; j++) {
            m[j][i] = -m[j][i];
            for (let k = 0; k < i; k++)
                m[j][k] += m[j][i] * m[i][k];
        }
    }
    for (let i = 0; i < p; i++) {
        if (m[i][i] === 0) {
            for (let j = 0; j < p; j++) {
                m[i][j] = 0;
                m[j][i] = 0;
            }
            continue;
        }
        for (let j = i + 1; j < p; j++) {
            const t = m[j][i] * m[j][j];
            m[i][j] = t;
            for (let k = i; k < j; k++)
                m[i][k] += t * m[j][k];
        }
    }
    for (let i = 0; i < p; i++)
        for (let j = 0; j < i; j++)
            m[i][j] = m[j][i];
    return m;
}
/** A test statistic with its upper chi-squared tail */
const chisqTest = (statistic, df) => ({
    statistic,
    df,
    pValue: pchisq(statistic, df, { lowerTail: false }),
});
/**
 * Cox proportional hazards regression. Equivalent to R's `survival::coxph()`. As
 * `coxph(Surv(time, status) ~ x [+ strata(strata)], weights, ties, init, control)` for right-censored data, with the
 * values of `summary(fit)`.
 *
 * Rows with a missing time, status, covariate, weight or stratum are dropped. Times within sqrt(eps) of each other are
 * treated as tied. Covariates whose values all lie in `nocenter` are not centred; the others are centred by their
 * weighted means, which only shifts the linear predictors. R's warnings (non-convergence, possibly infinite
 * coefficients) are returned in `warnings`.
 *
 * @param time Follow-up times.
 * @param status 1 for an event, 0 for a censored time.
 * @param x The covariate matrix, one row per observation (at least one column).
 * @param options See {@link CoxphOptions}.
 *
 * @example
 * ```ts
 * const fit = coxph([5, 3, 8, 1, 9, 4], [1, 1, 0, 1, 0, 1], [[1.2], [0.3], [-0.5], [2], [0.7], [0.1]]);
 * fit.coefficients;   // [1.0324]
 * fit.logtest.pValue; // 0.18817
 * ```
 *
 * @category Survival analysis
 */
export function coxph(time, status, x, options = {}) {
    const { ties = "efron", weights, strata, init, control = {}, nocenter = [-1, 0, 1], confLevel = 0.95 } = options;
    const { eps = 1e-9, iterMax = 20, tolerChol = 2 ** -39 } = control;
    const tolerInf = control.tolerInf ?? Math.sqrt(eps);
    if (ties !== "efron" && ties !== "breslow")
        throw new RangeError(`invalid 'ties': ${String(ties)}`);
    if (!(eps > 0))
        throw new RangeError("'eps' must be positive");
    if (!(Number.isInteger(iterMax) && iterMax >= 0))
        throw new RangeError("'iterMax' must be a non-negative integer");
    if (!(confLevel > 0 && confLevel < 1))
        throw new RangeError("'confLevel' must be between 0 and 1");
    const nIn = time.length;
    if (status.length !== nIn || x.length !== nIn)
        throw new RangeError("'time', 'status' and 'x' must have the same length");
    if (weights !== undefined && weights.length !== nIn)
        throw new RangeError("'weights' must have the same length as 'time'");
    if (strata !== undefined && strata.length !== nIn)
        throw new RangeError("'strata' must have the same length as 'time'");
    const p = nIn === 0 ? 0 : x[0].length;
    if (p < 1)
        throw new RangeError("'x' must have at least one column");
    if (x.some((row) => row.length !== p))
        throw new RangeError("the rows of 'x' must have the same length");
    if (init !== undefined && init.length !== p)
        throw new RangeError("'init' must have one value per column of 'x'");
    // 1. the rows used
    const keep = [];
    for (let i = 0; i < nIn; i++) {
        if (Number.isNaN(time[i]) || Number.isNaN(status[i]) || x[i].some((v) => Number.isNaN(v)))
            continue;
        if (weights !== undefined && Number.isNaN(weights[i]))
            continue;
        if (strata !== undefined && isMissingLabel(strata[i]))
            continue;
        const s = status[i];
        if (s !== 0 && s !== 1)
            throw new RangeError("'status' must be 0 (censored) or 1 (event)");
        keep.push(i);
    }
    const n = keep.length;
    if (n === 0)
        throw new RangeError("no observations without missing values");
    const w = keep.map((i) => (weights === undefined ? 1 : weights[i]));
    if (w.some((v) => !(v > 0)))
        throw new RangeError("Invalid weights, must be >0");
    if (w.some((v) => !Number.isInteger(v)))
        throw new RangeError("non-integer weights (robust variance) are not supported yet");
    let nevent = 0;
    for (const i of keep)
        nevent += status[i];
    const mergedTime = mergeTiedTimes(keep.map((i) => time[i]));
    let stratumOf = new Array(n).fill(0);
    if (strata !== undefined) {
        const labels = Array.from(new Set(keep.map((i) => strata[i]))).sort(compareLabels);
        const index = new Map();
        labels.forEach((l, k) => index.set(l, k));
        stratumOf = keep.map((i) => index.get(strata[i]));
    }
    const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => stratumOf[a] - stratumOf[b] || mergedTime[a] - mergedTime[b] || a - b);
    // 2. centring and scaling (sums over the sorted observations)
    let totalWeight = 0;
    for (const v of w)
        totalWeight += v;
    const sortedW = order.map((k) => w[k]);
    const xs = order.map((k) => x[keep[k]].slice());
    const means = new Array(p).fill(0);
    const scales = new Array(p).fill(1);
    const exempt = new Set(nocenter);
    for (let j = 0; j < p; j++) {
        if (xs.every((row) => exempt.has(row[j])))
            continue;
        let sum = 0;
        for (let k = 0; k < n; k++)
            sum += sortedW[k] * xs[k][j];
        const m = sum / totalWeight;
        let absSum = 0;
        for (let k = 0; k < n; k++) {
            xs[k][j] -= m;
            absSum += sortedW[k] * Math.abs(xs[k][j]);
        }
        const s = absSum === 0 ? 1 : totalWeight / absSum;
        for (let k = 0; k < n; k++)
            xs[k][j] *= s;
        means[j] = m;
        scales[j] = s;
    }
    const data = {
        time: order.map((k) => mergedTime[k]),
        event: order.map((k) => status[keep[k]] === 1),
        weight: sortedW,
        x: xs,
        stratumEnd: order.map((k, r) => r === n - 1 || stratumOf[order[r + 1]] !== stratumOf[k]),
    };
    const efron = ties === "efron";
    // 3.-5. Newton-Raphson on the scaled coefficients
    let beta = init === undefined ? new Array(p).fill(0) : init.map((v, j) => v / scales[j]);
    let ev = evaluate(data, beta, efron);
    const loglik = [ev.loglik, ev.loglik];
    let factor = ev.info.map((row) => row.slice());
    let rank = cholFactor(factor, tolerChol);
    let step = cholSolve(factor, ev.score);
    let scoreTest = 0;
    for (let i = 0; i < p; i++)
        scoreTest += ev.score[i] * step[i];
    let iter = 0;
    let inverse;
    let ranOut = false;
    if (iterMax === 0 || !Number.isFinite(ev.loglik)) {
        inverse = cholInverse(factor);
    }
    else {
        let best = ev.loglik;
        let next = beta.map((b, i) => b + step[i]);
        let halvings = 0;
        let converged = false;
        for (iter = 1; iter <= iterMax; iter++) {
            ev = evaluate(data, next, efron);
            factor = ev.info.map((row) => row.slice());
            rank = cholFactor(factor, tolerChol);
            const finite = Number.isFinite(ev.loglik) && ev.score.every(Number.isFinite) && ev.info.every((row) => row.every(Number.isFinite));
            if (finite && Math.abs(1 - best / ev.loglik) <= eps) {
                converged = true;
                loglik[1] = ev.loglik;
                beta = next;
                break;
            }
            if (!finite || ev.loglik < best) {
                halvings++;
                next = next.map((b, i) => (b + halvings * beta[i]) / (halvings + 1));
            }
            else {
                halvings = 0;
                best = ev.loglik;
                loglik[1] = best;
                step = cholSolve(factor, ev.score);
                beta = next;
                next = next.map((b, i) => b + step[i]);
            }
        }
        if (converged) {
            inverse = cholInverse(factor);
        }
        else {
            iter = iterMax + 1;
            ranOut = true;
            if (iterMax > 1) {
                // R recomputes at the last accepted point and applies the inverse step without factorising: that step reads
                // the triangle the accumulation leaves at zero, so only the diagonal survives (off-diagonal entries -0)
                ev = evaluate(data, beta, efron);
                loglik[1] = ev.loglik;
                inverse = ev.info.map((row, i) => row.map((_, j) => (i === j ? (row[i] > 0 ? 1 / row[i] : 0) : -0)));
            }
            else {
                inverse = cholInverse(factor);
            }
        }
    }
    // back to the original scale
    const internal = beta.map((b, j) => b * scales[j]);
    const u = ev.score.map((v, j) => v / scales[j]);
    const variance = inverse.map((row, i) => row.map((v, j) => v * scales[i] * scales[j]));
    // 6. output
    const coefficients = internal.slice();
    if (iterMax > 0 && Math.abs(rank) < p) {
        for (let j = 0; j < p; j++)
            if (variance[j][j] === 0)
                coefficients[j] = NaN;
    }
    let centre = 0;
    for (let j = 0; j < p; j++)
        centre += internal[j] * means[j];
    const linearPredictors = keep.map((i) => {
        let s = 0;
        for (let j = 0; j < p; j++)
            s += x[i][j] * internal[j];
        return s - centre;
    });
    const warnings = new Warnings();
    if (iterMax > 1) {
        const infinity = variance.map((_, j) => {
            let s = 0;
            for (let i = 0; i < p; i++)
                s += u[i] * variance[i][j];
            return Math.abs(s);
        });
        if (ranOut) {
            warnings.add("Ran out of iterations and did not converge");
            if (Math.max(...linearPredictors) > 500 || infinity.some((f) => !Number.isFinite(f))) {
                warnings.add("one or more coefficients may be infinite");
            }
        }
        else {
            const flagged = [];
            for (let j = 0; j < p; j++) {
                const f = infinity[j];
                if (!Number.isFinite(u[j]) || (f > eps && f > tolerInf * Math.abs(internal[j])))
                    flagged.push(j + 1);
            }
            if (flagged.length > 0) {
                warnings.add(`Loglik converged before variable  ${flagged.join(",")} ; coefficient may be infinite. `);
            }
        }
    }
    // 7. tests and the summary
    const used = coefficients.map((c, j) => (Number.isNaN(c) ? -1 : j)).filter((j) => j >= 0);
    const k = used.length;
    const b = used.map((j) => coefficients[j] - (init === undefined ? 0 : init[j]));
    let wald = 0;
    if (k === 1) {
        wald = (b[0] * b[0]) / variance[used[0]][used[0]];
    }
    else if (k > 1) {
        const v = used.map((i) => used.map((j) => variance[i][j]));
        cholFactor(v, tolerChol);
        const y = cholSolve(v, b);
        for (let i = 0; i < k; i++)
            wald += b[i] * y[i];
    }
    const q = qnorm((1 + confLevel) / 2);
    const se = variance.map((row, j) => Math.sqrt(row[j]));
    const z = coefficients.map((c, j) => c / se[j]);
    const pz = z.map((v) => pchisq(v * v, 1, { lowerTail: false }));
    const lower = coefficients.map((c, j) => Math.exp(c - q * se[j]));
    const upper = coefficients.map((c, j) => Math.exp(c + q * se[j]));
    const lr = -2 * (loglik[0] - loglik[1]);
    return {
        coefficients,
        var: variance,
        loglik,
        score: scoreTest,
        wald,
        iter,
        means,
        n,
        nevent,
        linearPredictors,
        se,
        z,
        p: pz,
        lower,
        upper,
        logtest: chisqTest(lr, k),
        sctest: chisqTest(scoreTest, k),
        waldtest: chisqTest(wald, k),
        rsq: { rsq: 1 - Math.exp(-lr / n), maxrsq: 1 - Math.exp((2 * loglik[0]) / n) },
        warnings: warnings.list,
    };
}
