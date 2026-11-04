// Profile likelihood confidence intervals for the coefficients of a glm (R's confint for a glm fit, MASS's method
// before R 4.4), with the exact limits instead of R's spline interpolation of the profile.
//
// Written for rStats.js (no ported code) from oracle/glm-behaviour.md and R's help pages (?confint, ?profile.glm).
// The signed root of the likelihood ratio statistic (McCullagh and Nelder 1989) of coefficient j is
//   z(b) = sign(b - b_j) sqrt((D(b) - D) / phi),
// with D(b) the deviance of the fit with b_j fixed at b (its column moved into the offset), D the deviance of the fit and
// phi its dispersion; for the score test (test = "Rao") D(b) - D is replaced by the score statistic of the restricted
// fit. The limits solve z(b) = qnorm((1 -/+ level) / 2) by Brent's method on a bracket found by doubling the distance
// from the estimate (up to 2^30 standard errors). All fits are iterated until the coefficients stop changing (to
// rounding, at most 100 iterations): the deviance is stationary at the estimate, so R's rule on its relative change
// stops while the coefficients, the dispersion and the score statistic can still move by about sqrt(epsilon).
import { qnorm } from "../distributions/normal.js";
import { ldexp } from "../internal/summary.js";
import { uniroot } from "../internal/uniroot.js";
import { qr, qrResid } from "../linalg/qr.js";
import { glmSummary, refit, scaledView } from "./glm.js";
import { Warnings } from "./glmFamily.js";
/**
 * Settings of the fits iterated to convergence: until the coefficients stop changing (at most 100 iterations), and
 * the tolerance of the QR decomposition that of epsilon = 1e-300 (columns found aliased by the fit are left out)
 */
const CONVERGED = { epsilon: 1e-300, maxit: 100, untilCoefficients: true };
/**
 * Score statistic of residuals r with weights v regressed on the columns of x (rows of weight 0 left out): the
 * weighted sum of squares of r about its weighted mean (about 0 without intercept) minus the residual sum of squares.
 */
export function scoreStatistic(x, r, v, intercept, tol = 1e-11) {
    const rows = [];
    for (let i = 0; i < r.length; i++)
        if (v[i] > 0)
            rows.push(i);
    let sw = 0;
    let swr = 0;
    for (const i of rows) {
        sw += v[i];
        swr += v[i] * r[i];
    }
    if (intercept && !(Number.isFinite(sw) && Number.isFinite(swr))) {
        // only where the sums overflow (#173): the weights divided by a power of 2 (2^k at most the largest weight)
        let m = 0;
        for (const i of rows)
            m = Math.max(m, v[i]);
        if (Number.isFinite(m)) {
            const k = m > 1 ? Math.floor(Math.log2(m)) : 0;
            sw = 0;
            swr = 0;
            for (const i of rows) {
                const vi = ldexp(v[i], -k);
                sw += vi;
                swr += vi * r[i];
            }
        }
    }
    const centre = intercept ? swr / sw : 0;
    let total = 0;
    for (const i of rows)
        total += v[i] * (r[i] - centre) ** 2;
    const p = x.length > 0 ? x[0].length : 0;
    if (p === 0 || rows.length === 0)
        return 0;
    const s = rows.map((i) => Math.sqrt(v[i]));
    const q = qr(rows.map((i, k) => x[i].map((t) => t * s[k])), { tol });
    const res = qrResid(q, rows.map((i, k) => r[i] * s[k]));
    let rss = 0;
    for (const e of res)
        rss += e * e;
    if (!Number.isFinite(total)) {
        // only where v (r - centre)^2 overflows (#172): the total from sqrt(v) (r - centre), as the rss, both scaled by a
        // power of 2 when those squares overflow too
        const t = rows.map((i, k) => s[k] * (r[i] - centre));
        let m = 0;
        for (const e of t)
            m = Math.max(m, Math.abs(e));
        for (const e of res)
            m = Math.max(m, Math.abs(e));
        if (Number.isFinite(m)) {
            const k = m > 1 ? Math.floor(Math.log2(m)) : 0;
            let ts = 0;
            for (const e of t)
                ts += ldexp(e, -k) ** 2;
            let rs = 0;
            for (const e of res)
                rs += ldexp(e, -k) ** 2;
            return ldexp(ldexp(ts - rs, k), k);
        }
    }
    return total - rss;
}
/**
 * Profile likelihood confidence intervals for the coefficients of a generalized linear model (NaN for aliased
 * columns, and for a limit that the profile does not reach), for a `glm` fit. Equivalent to R's `confint()`. With
 * the exact solutions of the profile equations, where R interpolates a spline through a grid of profile points (and
 * is up to about 5e-4 standard errors from them).
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmConfint(fit); // { lower: [-15.124, -0.065819], upper: [0.57792, 4.1592] }
 * ```
 *
 * @category Generalized linear models
 */
export function glmConfint(given, options = {}) {
    // on the scaled fit (scaledView); the limits scaled back
    const { fit, k } = scaledView(given);
    const level = options.level ?? 0.95;
    const test = options.test ?? "LRT";
    if (test !== "LRT" && test !== "Rao")
        throw new RangeError(`invalid 'test': ${String(test)}`);
    if (!(level > 0 && level < 1))
        throw new RangeError("'level' must be in (0, 1)");
    const p = fit.coefficients.length;
    const parm = options.parm ?? Array.from({ length: p }, (_, j) => j);
    for (const j of parm)
        if (!Number.isInteger(j) || j < 0 || j >= p)
            throw new RangeError(`invalid coefficient index ${j}`);
    const model = fit.model;
    const cols = fit.coefficients.map((_, j) => j).filter((j) => !Number.isNaN(fit.coefficients[j]));
    const warnings = new Warnings();
    // the fit iterated until it has converged (columns found aliased left out)
    const full = refit(model, cols, warnings, {
        ...CONVERGED,
        start: model.start === undefined ? undefined : cols.map((j) => model.start[j]),
    });
    const B = new Array(p).fill(NaN);
    cols.forEach((j, k) => (B[j] = full.fit.coefficients[k]));
    // the profile is that of the maximum likelihood fit: without a converged fit there is none (NaN limits)
    if (!full.fit.converged)
        return { lower: parm.map(() => NaN), upper: parm.map(() => NaN) };
    // set when a restricted fit of the profile does not converge: its deviance is not the profile's, so the limit
    // being searched is NaN rather than a root of a wrong function
    let unconverged = false;
    const convergedFit = {
        ...fit,
        coefficients: B,
        weights: full.fit.workingWeights,
        residuals: full.fit.workingResiduals,
        qr: full.fit.qr,
        rank: full.fit.rank,
    };
    const summary = glmSummary(convergedFit);
    const dispersion = summary.dispersion;
    const se = new Array(p).fill(NaN);
    const piv = full.fit.qr === undefined ? [] : full.fit.qr.pivot.slice(0, full.fit.rank);
    piv.forEach((k, m) => (se[cols[k]] = summary.stdError[m]));
    const xFull = model.x.map((r) => cols.map((j) => r[j]));
    const eta0 = full.fit.eta;
    const zStat = (j, b) => {
        const others = cols.filter((c) => c !== j);
        const restricted = refit(model, others, new Warnings(), {
            ...CONVERGED,
            start: undefined,
            etastart: eta0,
            extraOffset: model.x.map((r) => r[j] * b),
        }).fit;
        if (!restricted.converged) {
            unconverged = true;
            return NaN;
        }
        const stat = test === "LRT"
            ? restricted.deviance - full.fit.deviance
            : scoreStatistic(xFull, restricted.workingResiduals, restricted.workingWeights, false);
        return Math.sign(b - B[j]) * Math.sqrt(Math.max(stat / dispersion, 0));
    };
    // (for alpha below 1e-8 the upper probability itself: 1 - alpha loses its digits and rounds to 1 below 1.1e-16; review 58)
    const a2 = (1 - level) / 2;
    // the cutoff qnorm((1 + level) / 2) for a small level from the series of sqrt(2) erfinv(level) (relative error below 2e-18
    // where it is used: it is below 2^-9 only for level below about 1.6e-3), as 1 + level loses the digits of level
    const cSmall = Math.sqrt(Math.PI / 2) * level * (1 + (Math.PI / 12) * level ** 2 + ((7 * Math.PI ** 2) / 480) * level ** 4);
    // below this cutoff the deviance difference of the profile cannot resolve z (its relative error is about
    // epsilon D / z^2), so the limits come from the inverse profile b(z) interpolated through z = 0, +-C0, +-2 C0 (#179)
    const C0 = 2 ** -9;
    const tiny = cSmall < C0;
    const cut = tiny ? [-cSmall, cSmall] : [qnorm(a2), a2 < 1e-8 ? qnorm(a2, { lowerTail: false }) : qnorm((1 + level) / 2)];
    const lower = parm.map(() => NaN);
    const upper = parm.map(() => NaN);
    // the limit of coefficient j where the profile reaches the cutoff c (side 0: below the estimate, c < 0)
    const limitAt = (j, c, side) => {
        const dir = side === 0 ? -1 : 1;
        unconverged = false;
        let far = NaN;
        let zFar = NaN;
        for (let e = 0; e <= 30; e++) {
            const b = B[j] + dir * 2 ** e * se[j];
            const z = zStat(j, b);
            if (Math.abs(z) >= Math.abs(c)) {
                far = b;
                zFar = z;
                break;
            }
        }
        if (Number.isNaN(far) || unconverged)
            return NaN;
        const f = (b) => (b === B[j] ? -c : zStat(j, b) - c);
        const [lo, hi] = side === 0 ? [far, B[j]] : [B[j], far];
        const [fLo, fHi] = side === 0 ? [zFar - c, -c] : [-c, zFar - c];
        let root;
        try {
            root = uniroot(f, lo, hi, { tol: 1e-14 * se[j], maxIter: 500, fLower: fLo, fUpper: fHi });
        }
        catch (err) {
            if (!unconverged)
                throw err;
            root = NaN;
        }
        return unconverged ? NaN : root;
    };
    parm.forEach((j, k) => {
        if (Number.isNaN(B[j]))
            return;
        if (!tiny) {
            lower[k] = limitAt(j, cut[0], 0);
            upper[k] = limitAt(j, cut[1], 1);
            return;
        }
        // the polynomial of degree 4 through (z, b(z) - b_j) at z = -2 C0, -C0, 0, C0, 2 C0 (Lagrange form)
        const zs = [-2 * C0, -C0, 0, C0, 2 * C0];
        const ds = [limitAt(j, -2 * C0, 0), limitAt(j, -C0, 0), B[j], limitAt(j, C0, 1), limitAt(j, 2 * C0, 1)].map((b) => b - B[j]);
        const at = (z) => {
            let v = 0;
            for (let a = 0; a < 5; a++) {
                let w = 1;
                for (let b = 0; b < 5; b++)
                    if (b !== a)
                        w *= (z - zs[b]) / (zs[a] - zs[b]);
                v += w * ds[a];
            }
            return B[j] + v;
        };
        lower[k] = at(cut[0]);
        upper[k] = at(cut[1]);
    });
    return { lower: lower.map((v) => ldexp(v, k)), upper: upper.map((v) => ldexp(v, k)) };
}
