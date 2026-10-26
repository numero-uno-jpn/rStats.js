// Linear models: R's lm (with summary.lm's table) from a matrix or from a formula, confint and predict.
//
// Written for rStats.js (no ported code). The fit is the QR decomposition of the model matrix (a column of ones
// first unless `intercept` is false, rows scaled by sqrt(weights)) with R's LINPACK pivoting (src/linalg/qr.ts,
// tolerance 1e-7): columns that are linear combinations of earlier ones are moved to the end and get NaN
// coefficients ("aliased"), as in R. The summary follows summary.lm: residual variance rss / (n - rank),
// covariance of the estimates sigma^2 (R'R)^-1 from the triangular factor, t tests on n - rank degrees of freedom,
// R^2 from the (weighted) mean-corrected model sum of squares when there is an intercept, and the overall F test.
// Rows of weight 0 are left out of the fit and of the counts of observations, but get fitted values (and residuals)
// from the coefficients, as in R. The formula form fits the model matrix of src/models/modelMatrix.ts the same way
// (the same decomposition decides the rank and the aliased columns), recomputes the coefficients, fitted values,
// residuals, effects Q'y and sums of squares in double-double on the columns kept (src/models/ddLeastSquares.ts), and
// keeps what the analyses of variance need (the effects, the model matrix, the terms).
import { pf1 } from "../distributions/f.js";
import { pt1, qt1 } from "../distributions/t.js";
import { chol2inv } from "../linalg/chol.js";
import { qr, qrCoef, qrResid } from "../linalg/qr.js";
import { ddAdd, ddDiv, ddMul, ddMulNum, ddSub } from "../special/dd.js";
import { ddLeastSquares, ddSqrtWeights, ddSumSquares } from "./ddLeastSquares.js";
import { parseFormula } from "./formula.js";
import { design } from "./modelMatrix.js";
/** The formula fit (lm, and aov without Error()) */
export function lmFormulaFit(formula, d, aov) {
    const y = d.y;
    if (y === undefined)
        throw new TypeError("the formula has no response");
    const core = fitLm(d.x, y, d.frame.weights, d.terms.intercept, true);
    const r = core.result;
    const warnings = [...d.warnings];
    if (!aov) {
        // summary.lm: residual variance negligible against the fitted values' mean square and variance
        const f = core.fitRows.map((i) => r.fittedValues[i]);
        const m = f.reduce((s, v) => s + v, 0) / f.length;
        const v = f.length > 1 ? f.reduce((s, t) => s + (t - m) ** 2, 0) / (f.length - 1) : NaN;
        const resvar = core.rss / r.dfResidual;
        if (Number.isFinite(resvar) && resvar < 1e-30 * (m * m + v))
            warnings.push("essentially perfect fit: summary may be unreliable");
    }
    const out = {
        ...r,
        formula,
        response: d.terms.variables[0],
        coefNames: d.colNames,
        assign: d.assign,
        termLabels: d.terms.termLabels,
        order: d.terms.order,
        variables: d.terms.variables,
        factors: d.terms.factors,
        rows: d.frame.rows,
        x: d.x,
        y,
        effects: core.effects,
        rss: core.rss,
        nObs: core.fitRows.length,
        aov,
        warnings,
    };
    if (d.frame.weights !== undefined)
        out.weights = d.frame.weights;
    return out;
}
export function lm(x, y, options = {}) {
    if (typeof x === "string") {
        return lmFormulaFit(x, design(parseFormula(x), y, { ...options, dropUnusedLevels: true }), false);
    }
    return lmMatrix(x, y, options);
}
function lmMatrix(x, y, options) {
    const intercept = options.intercept ?? true;
    const xr = x.length > 0 && typeof x[0] !== "number" ? x.map((r) => Array.from(r)) : Array.from(x, (v) => [v]);
    const ys = Array.from(y);
    if (xr.length !== ys.length)
        throw new RangeError("variable lengths differ (found for 'x')");
    const wsAll = options.weights === undefined ? undefined : Array.from(options.weights);
    if (wsAll !== undefined && wsAll.length !== ys.length)
        throw new RangeError("variable lengths differ (found for '(weights)')");
    if (wsAll?.some((w) => w < 0))
        throw new RangeError("missing or negative weights not allowed");
    const keep = ys.map((v, i) => !Number.isNaN(v) && xr[i].every((t) => !Number.isNaN(t)) && (wsAll === undefined || !Number.isNaN(wsAll[i])));
    const Xall = xr.filter((_, i) => keep[i]).map((r) => (intercept ? [1, ...r] : r));
    const Yall = ys.filter((_, i) => keep[i]);
    const Wall = wsAll?.filter((_, i) => keep[i]);
    return fitLm(Xall, Yall, Wall, intercept).result;
}
/**
 * The coefficients, fitted values, residuals, effects and sums of squares of a fit recomputed in double-double on the
 * columns kept by the double-precision decomposition q (its rank and pivoting decide what is aliased)
 */
function preciseFit(Xall, Yall, Wall, fitRows, q, intercept) {
    const rank = q.rank;
    const piv = q.pivot.slice(0, rank);
    const sw = ddSqrtWeights(Wall === undefined ? undefined : fitRows.map((i) => Wall[i]), fitRows.length);
    const cols = piv.map((j) => fitRows.map((i, k) => ddMulNum(sw[k], Xall[i][j])));
    const { qty, coef } = ddLeastSquares(cols, fitRows.map((i, k) => ddMulNum(sw[k], Yall[i])));
    const coefficients = Xall[0]?.map(() => NaN) ?? [];
    piv.forEach((j, k) => (coefficients[j] = coef[k][0]));
    // fitted values x'b of every row (aliased coefficients count as 0)
    const fitted = Xall.map((r) => {
        let f = [0, 0];
        piv.forEach((j, k) => (f = ddAdd(f, ddMulNum(coef[k], r[j]))));
        return f;
    });
    const rss = ddSumSquares(qty, rank)[0];
    // model sum of squares (about the weighted mean with an intercept)
    const w = fitRows.map((i) => Wall?.[i] ?? 1);
    let center = [0, 0];
    if (intercept) {
        let sw0 = [0, 0];
        let sf = [0, 0];
        fitRows.forEach((i, k) => {
            sw0 = ddAdd(sw0, [w[k], 0]);
            sf = ddAdd(sf, ddMulNum(fitted[i], w[k]));
        });
        center = ddDiv(sf, sw0);
    }
    let mss = [0, 0];
    fitRows.forEach((i, k) => {
        const d = ddSub(fitted[i], center);
        mss = ddAdd(mss, ddMulNum(ddMul(d, d), w[k]));
    });
    return {
        coefficients,
        fittedValues: fitted.map((f) => f[0]),
        residuals: fitted.map((f, i) => ddSub([Yall[i], 0], f)[0]),
        effects: qty.map((e) => e[0]),
        rss,
        mss: mss[0],
    };
}
/**
 * Least squares on a full model matrix (the column of ones included when `intercept` is true). Rows of weight 0 are
 * left out of the fit and of the counts.
 */
export function fitLm(Xall, Yall, Wall, intercept, precise = false) {
    if (Yall.length === 0)
        throw new RangeError("0 (non-NA) cases");
    // the fit uses the rows of non-zero weight only
    const fitRow = Yall.map((_, i) => Wall === undefined || Wall[i] !== 0);
    const X = Xall.filter((_, i) => fitRow[i]);
    const Y = Yall.filter((_, i) => fitRow[i]);
    const W = Wall?.filter((_, i) => fitRow[i]);
    const n = Y.length;
    if (n === 0)
        throw new RangeError("all weights are zero");
    const fitRows = Yall.flatMap((_, i) => (fitRow[i] ? [i] : []));
    const sw = W?.map(Math.sqrt);
    const Xw = sw === undefined ? X : X.map((r, i) => r.map((v) => v * sw[i]));
    const Yw = sw === undefined ? Y : Y.map((v, i) => v * sw[i]);
    const q = qr(Xw);
    const rank = q.rank;
    const pf = precise ? preciseFit(Xall, Yall, Wall, fitRows, q, intercept) : undefined;
    const coefficients = pf?.coefficients ?? qrCoef(q, Yw);
    const residuals = pf?.residuals ?? [];
    const fittedValues = pf?.fittedValues ?? [];
    const dfResidual = n - rank;
    const w = W ?? new Array(n).fill(1);
    let rss = pf?.rss ?? 0;
    if (pf === undefined) {
        // residuals from Q (the part of Q'y beyond the rank), so a saturated model has residuals of exactly 0, as in R
        const rw = qrResid(q, Yw);
        const fitResiduals = sw === undefined ? rw : rw.map((v, i) => v / sw[i]);
        // rows of weight 0: fitted values x'b (aliased coefficients count as 0), residuals y - fitted
        let k = 0;
        Yall.forEach((v, i) => {
            if (fitRow[i]) {
                residuals.push(fitResiduals[k]);
                fittedValues.push(v - fitResiduals[k]);
                k++;
            }
            else {
                const fv = Xall[i].reduce((s, t, j) => (Number.isNaN(coefficients[j]) ? s : s + t * coefficients[j]), 0);
                fittedValues.push(fv);
                residuals.push(v - fv);
            }
        });
        for (let i = 0; i < n; i++)
            rss += w[i] * fitResiduals[i] ** 2;
    }
    const fitted = fittedValues.filter((_, i) => fitRow[i]);
    const resvar = rss / dfResidual;
    const sigma = Math.sqrt(resvar);
    // (R'R)^-1 of the leading rank x rank block, in pivot order
    const Rr = q.qr.slice(0, rank).map((row) => row.slice(0, rank));
    const covUnscaled = rank > 0 ? chol2inv(Rr) : [];
    const piv = q.pivot.slice(0, rank);
    const order = piv.map((col, k) => [col, k]).sort((a, b) => a[0] - b[0]);
    const estimate = order.map(([col]) => coefficients[col]);
    const stdError = order.map(([, k]) => Math.sqrt(covUnscaled[k][k] * resvar));
    const tValue = estimate.map((e, i) => e / stdError[i]);
    const pValue = tValue.map((t) => 2 * pt1(-Math.abs(t), dfResidual, true, false));
    const result = {
        coefficients,
        residuals,
        fittedValues,
        rank,
        dfResidual,
        coefTable: { estimate, stdError, tValue, pValue },
        sigma,
        rSquared: 0,
        adjRSquared: 0,
        intercept,
        qr: q,
    };
    const dfInt = intercept ? 1 : 0;
    const numdf = rank - dfInt;
    const core = { result, fitRows, effects: pf?.effects ?? [], rss };
    // nothing beyond the intercept: R^2 = 0 and no F test, as in summary.lm
    if (numdf === 0)
        return core;
    let mss = 0;
    if (pf !== undefined)
        mss = pf.mss;
    else if (intercept) {
        const sumw = w.reduce((a, b) => a + b, 0);
        let m = 0;
        for (let i = 0; i < n; i++)
            m += (w[i] * fitted[i]) / sumw;
        for (let i = 0; i < n; i++)
            mss += w[i] * (fitted[i] - m) ** 2;
    }
    else
        for (let i = 0; i < n; i++)
            mss += w[i] * fitted[i] ** 2;
    result.rSquared = mss / (mss + rss);
    result.adjRSquared = 1 - (1 - result.rSquared) * ((n - dfInt) / dfResidual);
    const fValue = mss / numdf / resvar;
    result.fStatistic = { value: fValue, numdf, dendf: dfResidual };
    result.fPValue = pf1(fValue, numdf, dfResidual, false, false);
    return core;
}
/**
 * Confidence intervals for the coefficients of a linear model (NaN for aliased columns). Equivalent to R's
 * `confint()` for an `lm` fit.
 */
export function confint(fit, options = {}) {
    const level = options.level ?? 0.95;
    const t = qt1((1 + level) / 2, fit.dfResidual, true, false);
    const { estimate, stdError } = fit.coefTable;
    const lower = fit.coefficients.map(() => NaN);
    const upper = fit.coefficients.map(() => NaN);
    let k = 0;
    fit.coefficients.forEach((c, j) => {
        if (Number.isNaN(c))
            return;
        lower[j] = estimate[k] - t * stdError[k];
        upper[j] = estimate[k] + t * stdError[k];
        k++;
    });
    return { lower, upper };
}
/**
 * Predictions of a linear model at new values of the predictors, with standard errors and optionally intervals.
 * Equivalent to R's `predict()` for an `lm` fit (`se.fit = TRUE`). Aliased columns are left out, as R does.
 *
 * @param newdata New predictor values, with the columns of `x` (no column of ones).
 */
export function predict(fit, newdata, options = {}) {
    const rows = newdata.length > 0 && typeof newdata[0] !== "number"
        ? newdata.map((r) => Array.from(r))
        : Array.from(newdata, (v) => [v]);
    const X = rows.map((r) => (fit.intercept ? [1, ...r] : r));
    const rank = fit.rank;
    const piv = fit.qr.pivot.slice(0, rank);
    const Rr = fit.qr.qr.slice(0, rank).map((row) => row.slice(0, rank));
    const resvar = fit.sigma ** 2;
    const values = X.map((r) => r.reduce((s, v, j) => (Number.isNaN(fit.coefficients[j]) ? s : s + v * fit.coefficients[j]), 0));
    // se: || R^-T x_piv || sigma, by forward substitution with R^T
    const seFit = X.map((r) => {
        const z = new Array(rank).fill(0);
        for (let i = 0; i < rank; i++) {
            let s = r[piv[i]];
            for (let k = 0; k < i; k++)
                s -= Rr[k][i] * z[k];
            z[i] = s / Rr[i][i];
        }
        return Math.sqrt(z.reduce((a, v) => a + v * v, 0) * resvar);
    });
    const interval = options.interval ?? "none";
    if (interval === "none")
        return { fit: values, seFit };
    const t = qt1((1 + (options.level ?? 0.95)) / 2, fit.dfResidual, true, false);
    const half = seFit.map((s) => t * Math.sqrt(s * s + (interval === "prediction" ? resvar : 0)));
    return { fit: values, seFit, lwr: values.map((v, i) => v - half[i]), upr: values.map((v, i) => v + half[i]) };
}
