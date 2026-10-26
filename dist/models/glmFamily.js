// Families and links of R's glm: variance functions, links with their inverses and derivatives (with R's clamps),
// deviance contributions, the AIC, the checks of the response and the starting means.
//
// Written for rStats.js (no ported code) from the description in oracle/glm-behaviour.md, R's help pages (?family,
// ?glm) and McCullagh and Nelder (1989), Generalized Linear Models, 2nd ed., chapter 2 (the variance functions and
// deviances of table 2.1).
import { pcauchy1, qcauchy1, dcauchy1 } from "../distributions/cauchy.js";
import { dbinom1 } from "../distributions/binomial.js";
import { dgamma1 } from "../distributions/gamma.js";
import { dnorm, pnorm, qnorm } from "../distributions/normal.js";
import { dpois1, nonInteger } from "../distributions/poisson.js";
import { roundHalfEven } from "../internal/integer.js";
const EPS = 2 ** -52;
const ALLOWED = {
    gaussian: ["identity", "log", "inverse"],
    binomial: ["logit", "probit", "cauchit", "log", "cloglog"],
    quasibinomial: ["logit", "probit", "cauchit", "log", "cloglog"],
    poisson: ["log", "identity", "sqrt"],
    quasipoisson: ["log", "identity", "sqrt"],
    Gamma: ["inverse", "identity", "log"],
    "inverse.gaussian": ["1/mu^2", "inverse", "identity", "log"],
    quasi: ["identity", "logit", "probit", "cloglog", "inverse", "log", "1/mu^2", "sqrt"],
};
const positive = (eta) => Number.isFinite(eta) && eta > 0;
const anyEta = () => true;
/** Collects warnings in order of first appearance, each once (as the fixtures list R's warnings) */
export class Warnings {
    list = [];
    add(message) {
        if (!this.list.includes(message))
            this.list.push(message);
    }
}
/** The warnings sink of the link functions that warn ("NaNs produced"); set while a fit runs */
let currentWarnings;
export function withWarnings(sink, f) {
    const saved = currentWarnings;
    currentWarnings = sink;
    try {
        return f();
    }
    finally {
        currentWarnings = saved;
    }
}
/** Square root that warns as R's sqrt does when it produces NaN */
function sqrtWarn(x) {
    if (x < 0)
        currentWarnings?.add("NaNs produced");
    return Math.sqrt(x);
}
function namedLink(name) {
    switch (name) {
        case "identity":
            return { name, link: (m) => m, linkinv: (e) => e, muEta: () => 1, etaOk: anyEta };
        case "log":
            return {
                name,
                link: Math.log,
                linkinv: (e) => Math.max(Math.exp(e), EPS),
                muEta: (e) => Math.max(Math.exp(e), EPS),
                etaOk: anyEta,
            };
        case "inverse":
            return {
                name,
                link: (m) => 1 / m,
                linkinv: (e) => 1 / e,
                muEta: (e) => -1 / (e * e),
                etaOk: (e) => Number.isFinite(e) && e !== 0,
            };
        case "sqrt":
            return { name, link: Math.sqrt, linkinv: (e) => e * e, muEta: (e) => 2 * e, etaOk: positive };
        case "1/mu^2":
            return {
                name,
                link: (m) => 1 / (m * m),
                linkinv: (e) => 1 / sqrtWarn(e),
                muEta: (e) => -1 / (2 * e ** 1.5),
                etaOk: positive,
            };
        case "logit":
            return {
                name,
                link: (m) => Math.log(m / (1 - m)),
                linkinv: (e) => {
                    const t = e < -30 ? EPS : e > 30 ? 1 / EPS : Math.exp(e);
                    return t / (1 + t);
                },
                muEta: (e) => {
                    if (Math.abs(e) > 30)
                        return EPS;
                    const t = Math.exp(e);
                    return t / ((1 + t) * (1 + t));
                },
                etaOk: anyEta,
            };
        case "probit": {
            const c = -qnorm(EPS);
            return {
                name,
                link: (m) => qnorm(m),
                linkinv: (e) => pnorm(Math.min(Math.max(e, -c), c)),
                muEta: (e) => Math.max(dnorm(e), EPS),
                etaOk: anyEta,
            };
        }
        case "cauchit": {
            const c = -qcauchy1(EPS, 0, 1, true, false);
            return {
                name,
                link: (m) => qcauchy1(m, 0, 1, true, false),
                linkinv: (e) => pcauchy1(Math.min(Math.max(e, -c), c), 0, 1, true, false),
                muEta: (e) => Math.max(dcauchy1(e, 0, 1, false), EPS),
                etaOk: anyEta,
            };
        }
        case "cloglog":
            return {
                name,
                link: (m) => Math.log(-Math.log(1 - m)),
                linkinv: (e) => Math.min(Math.max(-Math.expm1(-Math.exp(e)), EPS), 1 - EPS),
                muEta: (e) => {
                    const t = Math.min(e, 700);
                    return Math.max(Math.exp(t) * Math.exp(-Math.exp(t)), EPS);
                },
                etaOk: anyEta,
            };
        default:
            throw new RangeError(`unknown link "${String(name)}"`);
    }
}
/** R's power(lambda): the log link for lambda <= 0, the identity for 1, else mu^lambda */
function powerLink(lambda) {
    if (!Number.isFinite(lambda))
        throw new RangeError("invalid power for the power link");
    if (lambda <= 0)
        return namedLink("log");
    if (lambda === 1)
        return namedLink("identity");
    const inv = 1 / lambda;
    return {
        name: `mu^${Math.round(lambda * 1000) / 1000}`,
        link: (m) => m ** lambda,
        linkinv: (e) => Math.max(e ** inv, EPS),
        muEta: (e) => Math.max(inv * e ** (inv - 1), EPS),
        etaOk: positive,
    };
}
function quasiVariance(v) {
    switch (v) {
        case "constant":
            return { variance: () => 1, muOk: () => true, dev: (y, mu, w) => w * (y - mu) ** 2 };
        case "mu(1-mu)":
            return { variance: (m) => m * (1 - m), muOk: (m) => m > 0 && m < 1, dev: binomialDev };
        case "mu":
            return {
                variance: (m) => m,
                muOk: (m) => m > 0,
                dev: (y, mu, w) => 2 * w * ((y === 0 ? 0 : y * Math.log(y / mu)) - (y - mu)),
            };
        case "mu^2":
            return {
                variance: (m) => m * m,
                muOk: (m) => m > 0,
                dev: (y, mu, w) => Math.max(-2 * w * (Math.log(y > 0 ? y / mu : 1 / mu) - (y - mu) / mu), 0),
            };
        case "mu^3":
            return { variance: (m) => m * m * m, muOk: (m) => m > 0, dev: inverseGaussianDev };
        default:
            throw new RangeError(`'variance' "${String(v)}" is invalid: possible values are "mu(1-mu)", "mu", "mu^2", "mu^3" and "constant"`);
    }
}
function binomialDev(y, mu, w) {
    const a = y === 0 ? 0 : y * Math.log(y / mu);
    const b = y === 1 ? 0 : (1 - y) * Math.log((1 - y) / (1 - mu));
    return 2 * w * (a + b);
}
function inverseGaussianDev(y, mu, w) {
    return (w * (y - mu) ** 2) / (y * mu * mu);
}
/** Resolves a family name or specification (and a link given separately) to its functions */
export function makeFamily(family, link) {
    const spec = typeof family === "string" ? { family } : family;
    const name = spec.family;
    const allowed = ALLOWED[name];
    if (allowed === undefined)
        throw new RangeError(`unknown family "${String(name)}"`);
    const lk = link ?? spec.link ?? allowed[0];
    let lf;
    if (typeof lk === "object") {
        if (name !== "quasi")
            throw new RangeError(`link "power" not available for ${name} family`);
        lf = powerLink(lk.power);
    }
    else {
        if (!allowed.includes(lk)) {
            throw new RangeError(`link "${lk}" not available for ${name} family; available links are ${allowed.map((a) => `'${a}'`).join(", ")}`);
        }
        lf = namedLink(lk);
    }
    if (spec.variance !== undefined && name !== "quasi")
        throw new TypeError("'variance' is only used by the quasi family");
    const base = { ...lf, family: name, varianceName: undefined, fixedDispersion: false };
    switch (name) {
        case "gaussian":
            return { ...base, variance: () => 1, muOk: () => true, devContribution: (y, mu, w) => w * (y - mu) ** 2 };
        case "binomial":
        case "quasibinomial":
            return {
                ...base,
                fixedDispersion: name === "binomial",
                variance: (m) => m * (1 - m),
                muOk: (m) => Number.isFinite(m) && m > 0 && m < 1,
                devContribution: binomialDev,
            };
        case "poisson":
        case "quasipoisson":
            return {
                ...base,
                fixedDispersion: name === "poisson",
                variance: (m) => m,
                muOk: (m) => Number.isFinite(m) && m > 0,
                devContribution: (y, mu, w) => (y > 0 ? 2 * w * (y * Math.log(y / mu) - (y - mu)) : 2 * w * mu),
            };
        case "Gamma":
            return {
                ...base,
                variance: (m) => m * m,
                muOk: (m) => Number.isFinite(m) && m > 0,
                devContribution: (y, mu, w) => -2 * w * ((y === 0 ? 0 : Math.log(y / mu)) - (y - mu) / mu),
            };
        case "inverse.gaussian":
            return { ...base, variance: (m) => m * m * m, muOk: () => true, devContribution: inverseGaussianDev };
        case "quasi": {
            const vname = spec.variance ?? "constant";
            const q = quasiVariance(vname);
            return { ...base, varianceName: vname, variance: q.variance, muOk: q.muOk, devContribution: q.dev };
        }
    }
}
/**
 * Checks the response and computes the starting means (R's family initialize). `y` is a vector or, for the binomial
 * families, rows (successes, failures). `hasStart`: starting values were given, so the gaussian check of the
 * starting means is skipped.
 */
export function prepareResponse(fam, y, prior, hasStart, warnings) {
    const name = fam.family;
    const binomialLike = name === "binomial" || name === "quasibinomial";
    const twoCol = y.length > 0 && Array.isArray(y[0]);
    if (twoCol) {
        const rows = y;
        // a one-column matrix is a vector
        if (rows.every((r) => r.length === 1))
            return prepareResponse(fam, rows.map((r) => r[0]), prior, hasStart, warnings);
        if (!binomialLike)
            throw new TypeError("y must be a vector (or, for the binomial families, a two-column matrix)");
        if (rows.some((r) => r.length !== 2)) {
            throw new TypeError(`for the '${name}' family, y must be a vector of 0 and 1's\nor a 2 column matrix where col 1 is no. successes and col 2 is no. failures`);
        }
        if (name === "binomial" && rows.some((r) => Math.abs(r[0] - Math.round(r[0])) > 1e-3 || Math.abs(r[1] - Math.round(r[1])) > 1e-3)) {
            warnings.add("non-integer counts in a binomial glm!");
        }
        const size = rows.map((r) => r[0] + r[1]);
        const yy = rows.map((r, i) => (size[i] === 0 ? 0 : r[0] / size[i]));
        const weights = prior.map((w, i) => w * size[i]);
        const mustart = yy.map((v, i) => (size[i] * v + 0.5) / (size[i] + 1));
        return { y: yy, weights, mustart, size };
    }
    const yv = y.slice();
    const weights = prior.slice();
    switch (name) {
        case "binomial":
        case "quasibinomial": {
            for (let i = 0; i < yv.length; i++)
                if (weights[i] === 0)
                    yv[i] = 0;
            if (yv.some((v) => v < 0 || v > 1))
                throw new RangeError("y values must be 0 <= y <= 1");
            const mustart = yv.map((v, i) => (weights[i] * v + 0.5) / (weights[i] + 1));
            if (name === "binomial" && yv.some((v, i) => Math.abs(weights[i] * v - Math.round(weights[i] * v)) > 1e-3)) {
                warnings.add("non-integer #successes in a binomial glm!");
            }
            return { y: yv, weights, mustart, size: yv.map(() => 1) };
        }
        case "poisson":
        case "quasipoisson":
            if (yv.some((v) => v < 0))
                throw new RangeError(`negative values not allowed for the '${name === "poisson" ? "Poisson" : "quasiPoisson"}' family`);
            return { y: yv, weights, mustart: yv.map((v) => v + 0.1), size: undefined };
        case "Gamma":
            if (yv.some((v) => v <= 0))
                throw new RangeError("non-positive values not allowed for the 'Gamma' family");
            return { y: yv, weights, mustart: yv.slice(), size: undefined };
        case "inverse.gaussian":
            if (yv.some((v) => v <= 0))
                throw new RangeError("positive values only are allowed for the 'inverse.gaussian' family");
            return { y: yv, weights, mustart: yv.slice(), size: undefined };
        case "gaussian":
            if (!hasStart && ((fam.name === "inverse" && yv.some((v) => v === 0)) || (fam.name === "log" && yv.some((v) => v <= 0)))) {
                throw new Error("cannot find valid starting values: please specify some");
            }
            return { y: yv, weights, mustart: yv.slice(), size: undefined };
        case "quasi": {
            const v = fam.varianceName;
            const mustart = v === "constant" ? yv.slice() : v === "mu(1-mu)" ? yv.map((t) => Math.min(Math.max(t, 0.001), 0.999)) : yv.map((t) => t + (t === 0 ? 0.1 : 0));
            return { y: yv, weights, mustart, size: undefined };
        }
    }
}
/** The family's AIC before the 2 rank term (R's family$aic); NaN for the quasi families */
export function familyAic(fam, y, mu, w, size, dev, warnings) {
    const n = y.length;
    let s = 0;
    switch (fam.family) {
        case "gaussian": {
            let slw = 0;
            for (const wi of w)
                slw += Math.log(wi);
            return n * (Math.log((2 * Math.PI * dev) / n) + 1) + 2 - slw;
        }
        case "binomial": {
            const m = size !== undefined && size.some((v) => v > 1) ? size : w;
            for (let i = 0; i < n; i++) {
                // R's round: half to even
                if (m[i] > 0)
                    s += (w[i] / m[i]) * dbinom1(roundHalfEven(m[i] * y[i]), roundHalfEven(m[i]), mu[i], true);
            }
            return -2 * s;
        }
        case "poisson":
            for (let i = 0; i < n; i++) {
                if (nonInteger(y[i]))
                    warnings.add(`non-integer x = ${y[i].toFixed(6)}`);
                s += w[i] * dpois1(y[i], mu[i], true);
            }
            return -2 * s;
        case "Gamma": {
            let sw = 0;
            for (const wi of w)
                sw += wi;
            const disp = dev / sw;
            for (let i = 0; i < n; i++)
                s += w[i] * dgamma1(y[i], 1 / disp, mu[i] * disp, true);
            return -2 * s + 2;
        }
        case "inverse.gaussian": {
            let sw = 0;
            let sly = 0;
            for (let i = 0; i < n; i++) {
                sw += w[i];
                sly += w[i] * Math.log(y[i]);
            }
            return sw * (Math.log((2 * Math.PI * dev) / sw) + 1) + 3 * sly + 2;
        }
        default:
            return NaN;
    }
}
