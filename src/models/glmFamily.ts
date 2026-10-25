// Families and links of generalized linear models, as in R's stats (family objects: gaussian, binomial, poisson,
// Gamma, inverse.gaussian, quasi, quasibinomial, quasipoisson; links of make.link and power).
//
// Written for rStats.js (no ported code). The variance functions, links, deviance residuals and log-likelihoods
// (for the AIC) are the textbook ones: P. McCullagh and J. A. Nelder, Generalized Linear Models (2nd ed., 1989),
// §2.2-2.3 and tables 2.1 (links) and 2.2 (unit deviances). What R adds to them was taken from R's documentation and
// checked against R's output (test/fixtures/glm.json): the links are kept away from the ends of their range by
// DBL_EPSILON (logit, probit, cauchit, cloglog, log, power), the families' starting values (mustart) and the checks of
// the response, the valid ranges of mu and eta, and the AIC conventions (?family, ?glm).

import { dbinom1 } from "../distributions/binomial.js";
import { dcauchy1, pcauchy1, qcauchy1 } from "../distributions/cauchy.js";
import { dgamma1 } from "../distributions/gamma.js";
import { dnorm1, pnorm1, qnorm1 } from "../distributions/normal.js";
import { dpois1 } from "../distributions/poisson.js";
import { nonInt, roundHalfEven } from "../internal/integer.js";

/** Family names of R's stats. */
export type GlmFamilyName = "gaussian" | "binomial" | "poisson" | "Gamma" | "inverse.gaussian" | "quasi" | "quasibinomial" | "quasipoisson";
/** Link names of R's `make.link`. */
export type GlmLinkName = "logit" | "probit" | "cauchit" | "cloglog" | "identity" | "log" | "sqrt" | "1/mu^2" | "inverse";
/** A link: a name, or `{ power: lambda }` for R's `power(lambda)` (mu^lambda; the log link for lambda <= 0). */
export type GlmLink = GlmLinkName | { power: number };
/** Variance functions of R's `quasi` family. */
export type QuasiVariance = "constant" | "mu(1-mu)" | "mu" | "mu^2" | "mu^3";

/** A family given as an object: the name, and optionally the link and (for `quasi`) the variance function. */
export interface GlmFamilySpec {
  family: GlmFamilyName;
  link?: GlmLink;
  variance?: QuasiVariance;
}

/** A link with its inverse and derivative (R's `link-glm` object). */
export interface LinkFunctions {
  /** R's name of the link (`"mu^0.333"` for a power link). */
  name: string;
  linkfun(mu: number): number;
  linkinv(eta: number): number;
  /** d mu / d eta. */
  muEta(eta: number): number;
  valideta(eta: readonly number[]): boolean;
}

/** A resolved family: what the fit needs (R's `family` object). */
export interface Family {
  /** R's family name (`"quasi"` for quasi). */
  family: GlmFamilyName;
  link: LinkFunctions;
  /** Name of the variance function (R's `varfun` of quasi; for the other families their variance). */
  varianceName: string;
  variance(mu: number): number;
  validmu(mu: readonly number[]): boolean;
  /** Deviance residual of one observation (before the square root); `nan` is called where R would warn "NaNs produced". */
  devResid(y: number, mu: number, wt: number, nan: () => void): number;
  /** AIC of the fit without 2 * rank (NaN for the quasi families). */
  aic(y: readonly number[], n: readonly number[], mu: readonly number[], wt: readonly number[], dev: number, warn: (m: string) => void): number;
  /** Whether the dispersion is fixed at 1 (binomial, poisson). */
  fixedDispersion: boolean;
}

const EPS = Number.EPSILON;
const allTrue = (): boolean => true;
const allFinitePositive = (a: readonly number[]): boolean => a.every((v) => Number.isFinite(v) && v > 0);

const LOGIT_THRESH = 30;
const PROBIT_THRESH = -qnorm1(EPS, 0, 1, true, false);
const CAUCHIT_THRESH = -qcauchy1(EPS, 0, 1, true, false);

function makeLink(name: GlmLinkName, onNaN: () => void): LinkFunctions {
  switch (name) {
    case "logit":
      return {
        name,
        linkfun: (mu) => Math.log(mu / (1 - mu)),
        linkinv: (eta) => {
          const t = eta < -LOGIT_THRESH ? EPS : eta > LOGIT_THRESH ? 1 / EPS : Math.exp(eta);
          return t / (1 + t);
        },
        muEta: (eta) => {
          if (eta > LOGIT_THRESH || eta < -LOGIT_THRESH) return EPS;
          const opexp = 1 + Math.exp(eta);
          return Math.exp(eta) / (opexp * opexp);
        },
        valideta: allTrue,
      };
    case "probit":
      return {
        name,
        linkfun: (mu) => qnorm1(mu, 0, 1, true, false),
        linkinv: (eta) => pnorm1(Math.min(Math.max(eta, -PROBIT_THRESH), PROBIT_THRESH), 0, 1, true, false),
        muEta: (eta) => Math.max(dnorm1(eta, 0, 1, false), EPS),
        valideta: allTrue,
      };
    case "cauchit":
      return {
        name,
        linkfun: (mu) => qcauchy1(mu, 0, 1, true, false),
        linkinv: (eta) => pcauchy1(Math.min(Math.max(eta, -CAUCHIT_THRESH), CAUCHIT_THRESH), 0, 1, true, false),
        muEta: (eta) => Math.max(dcauchy1(eta, 0, 1, false), EPS),
        valideta: allTrue,
      };
    case "cloglog":
      return {
        name,
        linkfun: (mu) => Math.log(-Math.log(1 - mu)),
        linkinv: (eta) => Math.max(Math.min(-Math.expm1(-Math.exp(eta)), 1 - EPS), EPS),
        muEta: (eta) => {
          const e = Math.min(eta, 700);
          return Math.max(Math.exp(e) * Math.exp(-Math.exp(e)), EPS);
        },
        valideta: allTrue,
      };
    case "identity":
      return { name, linkfun: (mu) => mu, linkinv: (eta) => eta, muEta: () => 1, valideta: allTrue };
    case "log":
      return {
        name,
        linkfun: (mu) => Math.log(mu),
        linkinv: (eta) => Math.max(Math.exp(eta), EPS),
        muEta: (eta) => Math.max(Math.exp(eta), EPS),
        valideta: allTrue,
      };
    case "sqrt":
      return {
        name,
        linkfun: (mu) => Math.sqrt(mu),
        linkinv: (eta) => eta * eta,
        muEta: (eta) => 2 * eta,
        valideta: allFinitePositive,
      };
    case "1/mu^2":
      return {
        name,
        linkfun: (mu) => 1 / (mu * mu),
        linkinv: (eta) => {
          if (eta < 0) onNaN();
          return 1 / Math.sqrt(eta);
        },
        muEta: (eta) => -1 / (2 * Math.pow(eta, 1.5)),
        valideta: allFinitePositive,
      };
    case "inverse":
      return {
        name,
        linkfun: (mu) => 1 / mu,
        linkinv: (eta) => 1 / eta,
        muEta: (eta) => -1 / (eta * eta),
        valideta: (a) => a.every((v) => Number.isFinite(v) && v !== 0),
      };
    default:
      throw new RangeError(`'${String(name)}' link not recognised`);
  }
}

/** R's power(lambda): the log link for lambda <= 0, the identity for lambda = 1, mu^lambda otherwise */
function powerLink(lambda: number, onNaN: () => void): LinkFunctions {
  if (!Number.isFinite(lambda)) throw new RangeError("invalid argument 'lambda'");
  if (lambda <= 0) return makeLink("log", onNaN);
  if (lambda === 1) return makeLink("identity", onNaN);
  return {
    name: `mu^${Math.round(lambda * 1000) / 1000}`,
    linkfun: (mu) => Math.pow(mu, lambda),
    linkinv: (eta) => Math.max(Math.pow(eta, 1 / lambda), EPS),
    muEta: (eta) => Math.max((1 / lambda) * Math.pow(eta, 1 / lambda - 1), EPS),
    valideta: allFinitePositive,
  };
}

const OK_LINKS: Record<Exclude<GlmFamilyName, "quasi">, GlmLinkName[]> = {
  gaussian: ["inverse", "log", "identity"],
  binomial: ["logit", "probit", "cloglog", "cauchit", "log"],
  quasibinomial: ["logit", "probit", "cloglog", "cauchit", "log"],
  poisson: ["log", "identity", "sqrt"],
  quasipoisson: ["log", "identity", "sqrt"],
  Gamma: ["inverse", "identity", "log"],
  "inverse.gaussian": ["1/mu^2", "inverse", "identity", "log"],
};
const DEFAULT_LINK: Record<GlmFamilyName, GlmLinkName> = {
  gaussian: "identity",
  binomial: "logit",
  quasibinomial: "logit",
  poisson: "log",
  quasipoisson: "log",
  Gamma: "inverse",
  "inverse.gaussian": "1/mu^2",
  quasi: "identity",
};
const ALL_LINKS: GlmLinkName[] = ["logit", "probit", "cauchit", "cloglog", "identity", "log", "sqrt", "1/mu^2", "inverse"];

// y log(y / mu), 0 for y = 0 (the binomial unit deviance)
const yLogY = (y: number, mu: number): number => (y !== 0 ? y * Math.log(y / mu) : 0);
// log(x) of R code, which warns "NaNs produced" for x < 0
const rlog = (x: number, nan: () => void): number => {
  if (x < 0) nan();
  return Math.log(x);
};

const binomialDev = (y: number, mu: number, wt: number): number => 2 * wt * (yLogY(y, mu) + yLogY(1 - y, 1 - mu));
const poissonDev = (y: number, mu: number, wt: number, nan: () => void): number =>
  y > 0 ? 2 * (wt * (y * rlog(y / mu, nan) - (y - mu))) : 2 * mu * wt;
const gammaDev = (y: number, mu: number, wt: number, nan: () => void): number =>
  -2 * wt * (rlog(y === 0 ? 1 : y / mu, nan) - (y - mu) / mu);
const invGaussDev = (y: number, mu: number, wt: number): number => (wt * (y - mu) ** 2) / (y * mu * mu);
const gaussianDev = (y: number, mu: number, wt: number): number => wt * (y - mu) ** 2;

const sum = (a: readonly number[]): number => a.reduce((s, v) => s + v, 0);

function binomialAic(y: readonly number[], n: readonly number[], mu: readonly number[], wt: readonly number[]): number {
  const m = n.some((v) => v > 1) ? n : wt;
  let s = 0;
  for (let i = 0; i < y.length; i++) {
    const f = m[i]! > 0 ? wt[i]! / m[i]! : 0;
    s += f * dbinom1(roundHalfEven(m[i]! * y[i]!), roundHalfEven(m[i]!), mu[i]!, true);
  }
  return -2 * s;
}

function poissonAic(y: readonly number[], mu: readonly number[], wt: readonly number[], warn: (m: string) => void): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) {
    if (nonInt(y[i]!)) warn(`non-integer x = ${y[i]!.toFixed(6)}`);
    s += dpois1(y[i]!, mu[i]!, true) * wt[i]!;
  }
  return -2 * s;
}

/** Resolves a family name or object (and a separate link) to the functions the fit uses. */
export function resolveFamily(spec: GlmFamilyName | GlmFamilySpec, linkOption: GlmLink | undefined, onNaN: () => void): Family {
  const s: GlmFamilySpec = typeof spec === "string" ? { family: spec } : spec;
  const name = s.family;
  if (!(name in DEFAULT_LINK)) throw new RangeError(`family '${String(name)}' not recognised`);
  const linkSpec = linkOption ?? s.link ?? DEFAULT_LINK[name];
  let link: LinkFunctions;
  if (typeof linkSpec === "object") link = powerLink(linkSpec.power, onNaN);
  else {
    const ok = name === "quasi" ? ALL_LINKS : OK_LINKS[name];
    if (!ok.includes(linkSpec)) {
      const avail = ok.map((l) => `‘${l}’`).join(", ");
      throw new RangeError(
        name === "quasi"
          ? `'${String(linkSpec)}' link not recognised`
          : `link "${String(linkSpec)}" not available for ${name} family; available links are ${avail}`,
      );
    }
    link = makeLink(linkSpec, onNaN);
  }
  if (s.variance !== undefined && name !== "quasi") throw new TypeError("'variance' is only used by the quasi family");
  const nanAic = (): number => NaN;
  switch (name) {
    case "gaussian":
      return {
        family: name, link, varianceName: "constant", variance: () => 1, validmu: allTrue, devResid: gaussianDev, fixedDispersion: false,
        aic: (y, _n, _mu, wt, dev) => {
          const nobs = y.length;
          let slw = 0;
          for (const w of wt) slw += Math.log(w);
          return nobs * (Math.log((2 * Math.PI * dev) / nobs) + 1) + 2 - slw;
        },
      };
    case "binomial":
    case "quasibinomial":
      return {
        family: name, link, varianceName: "mu(1-mu)", variance: (mu) => mu * (1 - mu),
        validmu: (a) => a.every((v) => Number.isFinite(v) && v > 0 && v < 1),
        devResid: binomialDev, fixedDispersion: name === "binomial",
        aic: name === "binomial" ? (y, n, mu, wt) => binomialAic(y, n, mu, wt) : nanAic,
      };
    case "poisson":
    case "quasipoisson":
      return {
        family: name, link, varianceName: "mu", variance: (mu) => mu, validmu: allFinitePositive, devResid: poissonDev,
        fixedDispersion: name === "poisson",
        aic: name === "poisson" ? (y, _n, mu, wt, _dev, warn) => poissonAic(y, mu, wt, warn) : nanAic,
      };
    case "Gamma":
      return {
        family: name, link, varianceName: "mu^2", variance: (mu) => mu * mu, validmu: allFinitePositive, devResid: gammaDev,
        fixedDispersion: false,
        aic: (y, _n, mu, wt, dev) => {
          const disp = dev / sum(wt);
          let s = 0;
          for (let i = 0; i < y.length; i++) s += dgamma1(y[i]!, 1 / disp, mu[i]! * disp, true) * wt[i]!;
          return -2 * s + 2;
        },
      };
    case "inverse.gaussian":
      return {
        family: name, link, varianceName: "mu^3", variance: (mu) => mu ** 3, validmu: allTrue, devResid: invGaussDev,
        fixedDispersion: false,
        aic: (y, _n, _mu, wt, dev) => {
          const sw = sum(wt);
          let sly = 0;
          for (let i = 0; i < y.length; i++) sly += Math.log(y[i]!) * wt[i]!;
          return sw * (Math.log((dev / sw) * 2 * Math.PI) + 1) + 3 * sly + 2;
        },
      };
    case "quasi": {
      const v = s.variance ?? "constant";
      const base = { family: name, link, varianceName: v, fixedDispersion: false, aic: nanAic };
      switch (v) {
        case "constant":
          return { ...base, variance: () => 1, validmu: allTrue, devResid: gaussianDev };
        case "mu(1-mu)":
          return {
            ...base, variance: (mu) => mu * (1 - mu), validmu: (a) => a.every((m) => m > 0 && m < 1),
            devResid: (y, mu, wt, nan) =>
              2 * wt * (y * rlog(y === 0 ? 1 : y / mu, nan) + (1 - y) * rlog(y === 1 ? 1 : (1 - y) / (1 - mu), nan)),
          };
        case "mu":
          return {
            ...base, variance: (mu) => mu, validmu: (a) => a.every((m) => m > 0),
            devResid: (y, mu, wt, nan) => 2 * wt * (y * rlog(y === 0 ? 1 : y / mu, nan) - (y - mu)),
          };
        case "mu^2":
          return {
            ...base, variance: (mu) => mu * mu, validmu: (a) => a.every((m) => m > 0),
            devResid: (y, mu, wt, nan) => Math.max(-2 * wt * (rlog((y === 0 ? 1 : y) / mu, nan) - (y - mu) / mu), 0),
          };
        case "mu^3":
          return { ...base, variance: (mu) => mu ** 3, validmu: (a) => a.every((m) => m > 0), devResid: invGaussDev };
        default:
          throw new RangeError(`'variance' "${String(v)}" is invalid: possible values are "mu(1-mu)", "mu", "mu^2", "mu^3" and "constant"`);
      }
    }
  }
}

/** Result of a family's initialize: the response as a vector, the prior weights, starting means and binomial totals. */
export interface Initialized {
  y: number[];
  weights: number[];
  mustart: number[];
  /** Binomial totals (1 for a vector response), used by the binomial AIC. */
  n: number[];
}

/**
 * The family's checks of the response and its starting values (R's `family$initialize`). `y` is a vector, or for the
 * binomial families an array of [successes, failures] rows. `hasStart`: starting values or an eta were given.
 */
export function initialize(
  fam: Family,
  y: readonly number[] | readonly (readonly number[])[],
  weights: readonly number[],
  hasStart: boolean,
  warn: (m: string) => void,
): Initialized {
  const nobs = y.length;
  const ones = new Array<number>(nobs).fill(1);
  const isMatrix = nobs > 0 && typeof y[0] !== "number";
  const binomial = fam.family === "binomial" || fam.family === "quasibinomial";
  if (isMatrix) {
    const rows = y as readonly (readonly number[])[];
    if (!binomial || rows.some((r) => r.length !== 2)) {
      throw new TypeError(
        binomial
          ? `for the '${fam.family}' family, y must be a vector of 0 and 1's\nor a 2 column matrix where col 1 is no. successes and col 2 is no. failures`
          : "the response must be a vector for this family",
      );
    }
    if (fam.family === "binomial" && rows.some((r) => Math.abs(r[0]! - Math.round(r[0]!)) > 1e-3 || Math.abs(r[1]! - Math.round(r[1]!)) > 1e-3)) {
      warn("non-integer counts in a binomial glm!");
    }
    const n = rows.map((r) => r[0]! + r[1]!);
    const yy = rows.map((r, i) => (n[i] === 0 ? 0 : r[0]! / n[i]!));
    return { y: yy, weights: weights.map((w, i) => w * n[i]!), mustart: yy.map((v, i) => (n[i]! * v + 0.5) / (n[i]! + 1)), n };
  }
  const yv = Array.from(y as readonly number[]);
  switch (fam.family) {
    case "gaussian":
      if (!hasStart && ((fam.link.name === "inverse" && yv.some((v) => v === 0)) || (fam.link.name === "log" && yv.some((v) => v <= 0)))) {
        throw new RangeError("cannot find valid starting values: please specify some");
      }
      return { y: yv, weights: Array.from(weights), mustart: yv.slice(), n: ones };
    case "binomial":
    case "quasibinomial": {
      const yb = yv.map((v, i) => (weights[i] === 0 ? 0 : v));
      if (yb.some((v) => v < 0 || v > 1)) throw new RangeError("y values must be 0 <= y <= 1");
      if (fam.family === "binomial" && yb.some((v, i) => Math.abs(weights[i]! * v - Math.round(weights[i]! * v)) > 1e-3)) {
        warn("non-integer #successes in a binomial glm!");
      }
      return { y: yb, weights: Array.from(weights), mustart: yb.map((v, i) => (weights[i]! * v + 0.5) / (weights[i]! + 1)), n: ones };
    }
    case "poisson":
    case "quasipoisson":
      if (yv.some((v) => v < 0)) {
        throw new RangeError(`negative values not allowed for the '${fam.family === "poisson" ? "Poisson" : "quasiPoisson"}' family`);
      }
      return { y: yv, weights: Array.from(weights), mustart: yv.map((v) => v + 0.1), n: ones };
    case "Gamma":
      if (yv.some((v) => v <= 0)) throw new RangeError("non-positive values not allowed for the 'Gamma' family");
      return { y: yv, weights: Array.from(weights), mustart: yv.slice(), n: ones };
    case "inverse.gaussian":
      if (yv.some((v) => v <= 0)) throw new RangeError("positive values only are allowed for the 'inverse.gaussian' family");
      return { y: yv, weights: Array.from(weights), mustart: yv.slice(), n: ones };
    case "quasi": {
      const v = fam.varianceName;
      const mustart =
        v === "mu(1-mu)" ? yv.map((t) => Math.max(0.001, Math.min(0.999, t))) : v === "constant" ? yv.slice() : yv.map((t) => t + 0.1 * (t === 0 ? 1 : 0));
      return { y: yv, weights: Array.from(weights), mustart, n: ones };
    }
  }
}
