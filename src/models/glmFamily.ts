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
import { bd0 } from "../special/loader.js";
import { log1pmx } from "../special/log1p.js";

/**
 * Names of the families of R's stats.
 *
 * @category Generalized linear models
 */
export type GlmFamilyName =
  | "gaussian"
  | "binomial"
  | "quasibinomial"
  | "poisson"
  | "quasipoisson"
  | "Gamma"
  | "inverse.gaussian"
  | "quasi";

/**
 * Names of the links of R's stats (`make.link`).
 *
 * @category Generalized linear models
 */
export type GlmLinkName = "identity" | "log" | "inverse" | "logit" | "probit" | "cauchit" | "cloglog" | "sqrt" | "1/mu^2";

/**
 * A link: one of R's named links or a power link `mu^power` (R's `power(lambda)`; `power <= 0` is the log link).
 *
 * @category Generalized linear models
 */
export type GlmLink =
  | GlmLinkName
  | {
      /** The exponent lambda of the power link (R's `power(lambda)`). */
      power: number;
    };

/**
 * Variance functions of the `quasi` family.
 *
 * @category Generalized linear models
 */
export type QuasiVariance = "constant" | "mu(1-mu)" | "mu" | "mu^2" | "mu^3";

/**
 * A family with its link (and, for `quasi`, its variance function), as R's family objects such as `quasi(link = "log", variance = "mu^2")`.
 *
 * @category Generalized linear models
 */
export interface GlmFamilySpec {
  /** The family's name, such as `"binomial"`. */
  family: GlmFamilyName;
  /** The link: any named link (for `quasi`, one of its own list). Default: the family's default link. */
  link?: GlmLink;
  /** Variance function of `quasi`. Default `"constant"`. */
  variance?: QuasiVariance;
}

/** A link resolved to its functions. */
export interface LinkFunctions {
  name: string;
  /** eta = g(mu) */
  link(mu: number): number;
  /** mu = g^-1(eta) */
  linkinv(eta: number): number;
  /** d mu / d eta */
  muEta(eta: number): number;
  /** Whether a linear predictor is in the domain of the inverse link */
  etaOk(eta: number): boolean;
  /**
   * d mu/d eta = c mu^a for mu > 0 (identity, log, inverse, sqrt, 1/mu^2 and the power links): the working weights
   * and residuals in that form where the direct one overflows or underflows (see irls in glm.ts)
   */
  muPower?: { c: number; a: number };
}

/** A family resolved to its functions (the counterpart of R's family object). */
export interface Family extends LinkFunctions {
  family: GlmFamilyName;
  /** For quasi: the variance function's name */
  varianceName: QuasiVariance | undefined;
  variance(mu: number): number;
  muOk(mu: number): boolean;
  /** Deviance contribution of one observation with prior weight w */
  devContribution(y: number, mu: number, w: number): number;
  /** Whether the dispersion is fixed at 1 (binomial and poisson) */
  fixedDispersion: boolean;
  /** The variance function is mu^varPower (gaussian 0, poisson 1, Gamma 2, inverse.gaussian 3 and their quasi) */
  varPower?: number;
}

const ALLOWED: Record<GlmFamilyName, readonly string[]> = {
  gaussian: ["identity", "log", "inverse"],
  binomial: ["logit", "probit", "cauchit", "log", "cloglog"],
  quasibinomial: ["logit", "probit", "cauchit", "log", "cloglog"],
  poisson: ["log", "identity", "sqrt"],
  quasipoisson: ["log", "identity", "sqrt"],
  Gamma: ["inverse", "identity", "log"],
  "inverse.gaussian": ["1/mu^2", "inverse", "identity", "log"],
  quasi: ["identity", "logit", "probit", "cloglog", "inverse", "log", "1/mu^2", "sqrt"],
};

const positive = (eta: number) => Number.isFinite(eta) && eta > 0;
const anyEta = () => true;

/** Collects warnings in order of first appearance, each once (as the fixtures list R's warnings) */
export class Warnings {
  readonly list: string[] = [];
  add(message: string): void {
    if (!this.list.includes(message)) this.list.push(message);
  }
}

/** The warnings sink of the link functions that warn ("NaNs produced"); set while a fit runs */
let currentWarnings: Warnings | undefined;
export function withWarnings<T>(sink: Warnings, f: () => T): T {
  const saved = currentWarnings;
  currentWarnings = sink;
  try {
    return f();
  } finally {
    currentWarnings = saved;
  }
}

/** Square root that warns as R's sqrt does when it produces NaN */
function sqrtWarn(x: number): number {
  if (x < 0) currentWarnings?.add("NaNs produced");
  return Math.sqrt(x);
}

/**
 * Logarithm that warns as R's log does when it produces NaN (a negative argument, -Inf included; NaN does not warn).
 * Used by the deviance contributions that R computes in R code (poisson, quasipoisson, Gamma, quasi "mu" and "mu^2")
 */
function logWarn(x: number): number {
  if (x < 0) currentWarnings?.add("NaNs produced");
  return Math.log(x);
}

/** A number as C's printf("%g") writes it: 6 significant digits, fixed or scientific, trailing zeros dropped */
function formatG(v: number): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? "nan" : v > 0 ? "inf" : "-inf";
  const sci = v.toExponential(5);
  const e = Number(sci.slice(sci.indexOf("e") + 1));
  if (e >= -4 && e < 6) return v.toFixed(5 - e).replace(/\.?0+$/, "");
  const [mant, exp] = sci.split("e") as [string, string];
  return `${mant.replace(/\.?0+$/, "")}e${e < 0 ? "-" : "+"}${String(Math.abs(Number(exp))).padStart(2, "0")}`;
}

/** The logit link function: a mean outside [0, 1] is an error, as in R (0 and 1 give -Inf and Inf) */
function logit(m: number): number {
  if (m < 0 || m > 1) throw new RangeError(`Value ${formatG(m)} out of range (0, 1)`);
  return Math.log(m / (1 - m));
}

const LINK_NAMES: readonly string[] = ["logit", "probit", "cauchit", "cloglog", "identity", "log", "sqrt", "1/mu^2", "inverse"];

/** A probability kept within (0, 1): the least double and the largest double below 1 at the ends */
const inUnit = (p: number): number => Math.min(Math.max(p, Number.MIN_VALUE), 1 - 2 ** -53);

function namedLink(name: GlmLinkName): LinkFunctions {
  switch (name) {
    case "identity":
      return { name, link: (m) => m, linkinv: (e) => e, muEta: () => 1, etaOk: anyEta, muPower: { c: 1, a: 0 } };
    case "log":
      return {
        name,
        link: Math.log,
        // exp(eta) down to the least double (R: pmax(exp(eta), eps), so a mean of e^-100 was 2.2e-16); never 0, so
        // the variance stays positive
        linkinv: (e) => Math.max(Math.exp(e), Number.MIN_VALUE),
        muEta: (e) => Math.max(Math.exp(e), Number.MIN_VALUE),
        etaOk: anyEta,
        muPower: { c: 1, a: 1 },
      };
    case "inverse":
      return {
        name,
        link: (m) => 1 / m,
        linkinv: (e) => 1 / e,
        muEta: (e) => -1 / (e * e),
        etaOk: (e) => Number.isFinite(e) && e !== 0,
        muPower: { c: -1, a: 2 },
      };
    case "sqrt":
      return { name, link: Math.sqrt, linkinv: (e) => e * e, muEta: (e) => 2 * e, etaOk: positive, muPower: { c: 2, a: 0.5 } };
    case "1/mu^2":
      return {
        name,
        link: (m) => 1 / (m * m),
        linkinv: (e) => 1 / sqrtWarn(e),
        muEta: (e) => -1 / (2 * e ** 1.5),
        etaOk: positive,
        muPower: { c: -0.5, a: 3 },
      };
    case "logit":
      return {
        name,
        link: logit,
        // R's C code clamps |eta| > 30 to the values at eps, a jump (1 - 9.4e-14 at 30, 1 - 2.2e-16 just beyond) that
        // kept fits from their solution. Beyond 30 the exact values (as R's formula within), down to the least double
        // and up to the largest double below 1: mu is never 0 or 1, so the variance stays positive
        linkinv: (e) => {
          if (e > 30) return Math.min(1 / (1 + Math.exp(-e)), 1 - 2 ** -53);
          const t = Math.exp(e);
          return Math.max(t / (1 + t), Number.MIN_VALUE);
        },
        muEta: (e) => {
          if (Math.abs(e) > 30) {
            const z = Math.exp(-Math.abs(e));
            return Math.max(z / ((1 + z) * (1 + z)), Number.MIN_VALUE);
          }
          const t = Math.exp(e);
          return t / ((1 + t) * (1 + t));
        },
        etaOk: anyEta,
      };
    // probit, cauchit and cloglog: R clamps eta (or mu) to the values at eps and the derivative to eps (Phi(-10) =
    // 7.6e-24 was 2.2e-16); here the exact values, kept within (0, 1) by the least double and the largest double
    // below 1 as logit. Within R's range the same values
    case "probit":
      return {
        name,
        link: (m) => qnorm(m),
        linkinv: (e) => inUnit(pnorm(e)),
        muEta: (e) => Math.max(dnorm(e), Number.MIN_VALUE),
        etaOk: anyEta,
      };
    case "cauchit":
      return {
        name,
        link: (m) => qcauchy1(m, 0, 1, true, false),
        linkinv: (e) => inUnit(pcauchy1(e, 0, 1, true, false)),
        muEta: (e) => Math.max(dcauchy1(e, 0, 1, false), Number.MIN_VALUE),
        etaOk: anyEta,
      };
    case "cloglog":
      return {
        name,
        // log1p: 1 - mu rounded to 1 for small means (log(-log(1 - 1e-20)) was -Infinity, R too)
        link: (m) => Math.log(-Math.log1p(-m)),
        linkinv: (e) => inUnit(-Math.expm1(-Math.exp(e))),
        muEta: (e) => {
          const t = Math.min(e, 700);
          return Math.max(Math.exp(t) * Math.exp(-Math.exp(t)), Number.MIN_VALUE);
        },
        etaOk: anyEta,
      };
    default:
      throw new RangeError(`unknown link "${String(name)}"`);
  }
}

/** R's power(lambda): the log link for lambda <= 0, the identity for 1, else mu^lambda */
function powerLink(lambda: number): LinkFunctions {
  if (!Number.isFinite(lambda)) throw new RangeError("invalid power for the power link");
  if (lambda <= 0) return namedLink("log");
  if (lambda === 1) return namedLink("identity");
  const inv = 1 / lambda;
  return {
    name: `mu^${Math.round(lambda * 1000) / 1000}`,
    link: (m) => m ** lambda,
    // (R: pmax(..., eps), so a mean of 1e-16 was 2.2e-16)
    // (1 ** Infinity is NaN in JavaScript, where 1/lambda overflows)
    linkinv: (e) => Math.max(e === 1 ? 1 : e ** inv, Number.MIN_VALUE),
    muEta: (e) => powerMuEta(e, lambda, inv),
    etaOk: positive,
    // (eta^(1/lambda - 1) = mu^(1 - lambda); none where 1/lambda overflows)
    ...(Number.isFinite(inv) ? { muPower: { c: inv, a: 1 - lambda } } : {}),
  };
}

/**
 * d mu/d eta = eta^(1/lambda - 1)/lambda of the power link. Where that form is not finite (1/lambda overflows, or
 * eta^(1/lambda - 1) overflows against a tiny 1/lambda), as eta^(1/lambda)/(lambda eta), or from its logs
 */
function powerMuEta(e: number, lambda: number, inv: number): number {
  const r = inv * e ** (inv - 1);
  if (r < Infinity) return Math.max(r, Number.MIN_VALUE);
  if (e === 1) return inv;
  const a = e ** inv;
  const b = lambda * e;
  if (a > 0 && a < Infinity && b >= 2 ** -1022 && b < Infinity) return Math.max(a / b, Number.MIN_VALUE);
  return Math.max(Math.exp(inv * Math.log(e) - Math.log(lambda) - Math.log(e)), Number.MIN_VALUE);
}

function quasiVariance(v: QuasiVariance): {
  variance: (mu: number) => number;
  muOk: (mu: number) => boolean;
  dev: Family["devContribution"];
  varPower?: number;
} {
  switch (v) {
    case "constant":
      return { variance: () => 1, muOk: () => true, dev: (y, mu, w) => w * (y - mu) ** 2, varPower: 0 };
    case "mu(1-mu)":
      return { variance: (m) => m * (1 - m), muOk: (m) => m > 0 && m < 1, dev: binomialDev };
    case "mu":
      return {
        variance: (m) => m,
        muOk: (m) => m > 0,
        varPower: 1,
        dev: poissonDev,
      };
    case "mu^2":
      return {
        variance: (m) => m * m,
        muOk: (m) => m > 0,
        varPower: 2,
        // log(y/mu) for every y != 0 (NaN for a negative y, as in R), log(1/mu) for y = 0
        dev: (y, mu, w) => (nearMean(y, mu) ? gammaNear(y, mu, w) : Math.max(-2 * w * (logWarn(y !== 0 ? y / mu : 1 / mu) - (y - mu) / mu), 0)),
      };
    case "mu^3":
      return { variance: (m) => m * m * m, muOk: (m) => m > 0, dev: inverseGaussianDev, varPower: 3 };
    default:
      throw new RangeError(`'variance' "${String(v)}" is invalid: possible values are "mu(1-mu)", "mu", "mu^2", "mu^3" and "constant"`);
  }
}

/**
 * Whether y is within 10% of the mean (abs(y - mu) < 0.1 mu, so mu > 0), where the first-order terms of the poisson,
 * binomial and Gamma deviances cancel: the direct forms lose about 2 eps / abs(t) relative (t = (y - mu)/mu; 1e-10 at
 * t = 1e-3, and the sign at t = 2^-52, #161-#163), so there they are formed as bd0 (and log1pmx), as R's dpois_raw
 * and dbinom_raw switch to bd0 for abs(x - np) < 0.1 (x + np). Beyond 10% the direct forms are good to about 20 ulp
 * and kept, with R's bits
 */
const nearMean = (y: number, mu: number): boolean => Math.abs(y - mu) < 0.1 * mu;

/** The Gamma deviance -2 w (log(y/mu) - (y - mu)/mu) = -2 w log1pmx(t), t = (y - mu)/mu, for y near mu */
const gammaNear = (y: number, mu: number, w: number): number => -2 * w * log1pmx((y - mu) / mu);

/**
 * bd0(M + d, M) = (M + d) log(1 + d/M) - d = M (s log1p(s) + log1pmx(s)) with s = d/M, for abs(s) < 0.1: d is exact
 * where M + d is not
 */
function bd0Shift(M: number, d: number): number {
  const s = d / M;
  return M * (s * Math.log1p(s) + log1pmx(s));
}

/** The poisson deviance 2 w (y log(y/mu) - (y - mu)); 2 w bd0(y, mu) for y near mu (nearMean) */
function poissonDev(y: number, mu: number, w: number): number {
  if (nearMean(y, mu)) return 2 * w * bd0(y, mu);
  return 2 * w * ((y === 0 ? 0 : y * logWarn(y / mu)) - (y - mu));
}

/**
 * (R computes this deviance in compiled code, so a mean outside (0, 1) gives NaN without "NaNs produced"). For y
 * within 10% of mu and of 1 - mu (as nearMean), 2 w (bd0(y, mu) + bd0(1 - y, 1 - mu)), the second term from the exact
 * difference mu - y (bd0Shift): 1 - y is rounded for y < 1/2 (1 - 0.3 by 5.6e-17), which is 1e-13 of the deviance at
 * y = 0.3, mu = 0.3003. For y = 0 and mu < 0.1, -log(1 - mu) is -log1p(-mu): 1 - mu is rounded (to 1 for mu below
 * 1.1e-16, where the contribution 2 w mu was 0, R too), a relative error of about eps/(2 mu); from mu = 0.1 on, R's bits
 */
function binomialDev(y: number, mu: number, w: number): number {
  if (Math.abs(y - mu) < 0.1 * Math.min(mu, 1 - mu)) return 2 * w * (bd0(y, mu) + bd0Shift(1 - mu, mu - y));
  const a = y === 0 ? 0 : y * Math.log(y / mu);
  const b = y === 1 ? 0 : y === 0 && mu < 0.1 ? -Math.log1p(-mu) : (1 - y) * Math.log((1 - y) / (1 - mu));
  return 2 * w * (a + b);
}

function inverseGaussianDev(y: number, mu: number, w: number): number {
  const den = y * mu * mu;
  const r = (w * (y - mu) ** 2) / den;
  if (Number.isFinite(r) && !(Math.abs(den) < 2 ** -1022)) return r;
  // ((y - mu)² or y mu² overflows, or y mu² is below the normal range: as ((y - mu)/mu)²/y)
  const d = (y - mu) / mu;
  return w * ((d * d) / y);
}

/** Resolves a family name or specification (and a link given separately) to its functions */
export function makeFamily(family: GlmFamilyName | GlmFamilySpec, link?: GlmLink): Family {
  const spec: GlmFamilySpec = typeof family === "string" ? { family } : family;
  const name = spec.family;
  const allowed = ALLOWED[name];
  if (allowed === undefined) throw new RangeError(`unknown family "${String(name)}"`);
  const lk = link ?? spec.link ?? allowed[0]!;
  let lf: LinkFunctions;
  if (typeof lk === "object") {
    if (name !== "quasi") throw new RangeError(`link "power" not available for ${name} family`);
    lf = powerLink(lk.power);
  } else {
    // As in R, a link given by name may be any link R knows, whatever the family; the family's list of usual links
    // restricts only the quasi family
    if (name === "quasi" && !allowed.includes(lk)) {
      throw new RangeError(`link "${lk}" not available for ${name} family; available links are ${allowed.map((a) => `'${a}'`).join(", ")}`);
    }
    if (!LINK_NAMES.includes(lk)) throw new RangeError(`\u2018${lk}\u2019 link not recognised`);
    lf = namedLink(lk as GlmLinkName);
  }
  if (spec.variance !== undefined && name !== "quasi") throw new TypeError("'variance' is only used by the quasi family");
  const base = { ...lf, family: name, varianceName: undefined as QuasiVariance | undefined, fixedDispersion: false };
  switch (name) {
    case "gaussian":
      return { ...base, varPower: 0, variance: () => 1, muOk: () => true, devContribution: (y, mu, w) => w * (y - mu) ** 2 };
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
        varPower: 1,
        variance: (m) => m,
        muOk: (m) => Number.isFinite(m) && m > 0,
        // (a row with y = 0 takes no logarithm, so a negative mean there does not warn, as in R)
        devContribution: (y, mu, w) => (y > 0 ? poissonDev(y, mu, w) : 2 * w * mu),
      };
    case "Gamma":
      return {
        ...base,
        varPower: 2,
        variance: (m) => m * m,
        muOk: (m) => Number.isFinite(m) && m > 0,
        devContribution: (y, mu, w) => (nearMean(y, mu) ? gammaNear(y, mu, w) : -2 * w * ((y === 0 ? 0 : logWarn(y / mu)) - (y - mu) / mu)),
      };
    case "inverse.gaussian":
      // the mean of an inverse Gaussian is positive (R's validmu accepts any mean, and a negative one turns the
      // working weights NaN); a step to an invalid mean is halved
      return {
        ...base,
        varPower: 3,
        variance: (m) => m * m * m,
        muOk: (m) => Number.isFinite(m) && m > 0,
        devContribution: inverseGaussianDev,
      };
    case "quasi": {
      const vname = spec.variance ?? "constant";
      const q = quasiVariance(vname);
      return {
        ...base,
        varianceName: vname,
        variance: q.variance,
        muOk: q.muOk,
        devContribution: q.dev,
        ...(q.varPower === undefined ? {} : { varPower: q.varPower }),
      };
    }
  }
}

/** The response after the family has read it, with the prior weights, the starting means and the binomial sizes */
export interface PreparedResponse {
  y: number[];
  weights: number[];
  mustart: number[];
  /** Binomial sizes (s + f for a two-column response, 1 otherwise); undefined for the other families */
  size: number[] | undefined;
}

/**
 * Checks the response and computes the starting means (R's family initialize). `y` is a vector or, for the binomial
 * families, rows (successes, failures). `hasStart`: starting values were given, so the gaussian check of the
 * starting means is skipped.
 */
export function prepareResponse(fam: Family, y: number[] | number[][], prior: number[], hasStart: boolean, warnings: Warnings): PreparedResponse {
  const name = fam.family;
  const binomialLike = name === "binomial" || name === "quasibinomial";
  const twoCol = y.length > 0 && Array.isArray(y[0]);
  if (twoCol) {
    const rows = y as number[][];
    // a one-column matrix is a vector
    if (rows.every((r) => r.length === 1)) return prepareResponse(fam, rows.map((r) => r[0]!), prior, hasStart, warnings);
    if (!binomialLike) throw new TypeError("y must be a vector (or, for the binomial families, a two-column matrix)");
    if (rows.some((r) => r.length !== 2)) {
      throw new TypeError(
        `for the '${name}' family, y must be a vector of 0 and 1's\nor a 2 column matrix where col 1 is no. successes and col 2 is no. failures`,
      );
    }
    if (name === "binomial" && rows.some((r) => Math.abs(r[0]! - Math.round(r[0]!)) > 1e-3 || Math.abs(r[1]! - Math.round(r[1]!)) > 1e-3)) {
      warnings.add("non-integer counts in a binomial glm!");
    }
    if (rows.some((r) => r[0]! < 0 || r[1]! < 0)) throw new RangeError("counts must be nonnegative");
    const size = rows.map((r) => r[0]! + r[1]!);
    // Finite counts whose total overflows: the proportion could be formed (s/2 over s/2 + f/2), but the binomial size,
    // the prior weight that the deviance, the AIC and the covariance are proportional to, is not a double (R stops with
    // "cannot find valid starting values", the proportion 0 and the starting mean NaN; #160)
    const over = rows.findIndex((r, i) => Number.isFinite(r[0]!) && Number.isFinite(r[1]!) && !Number.isFinite(size[i]!));
    if (over >= 0) {
      throw new RangeError(
        `the total of successes and failures overflows in row ${over + 1} (${formatG(rows[over]![0]!)} + ${formatG(rows[over]![1]!)}): the binomial size must be a finite double`,
      );
    }
    const yy = rows.map((r, i) => (size[i] === 0 ? 0 : r[0]! / size[i]!));
    const weights = prior.map((w, i) => w * size[i]!);
    const mustart = yy.map((v, i) => (size[i]! * v + 0.5) / (size[i]! + 1));
    return { y: yy, weights, mustart, size };
  }
  const yv = (y as number[]).slice();
  const weights = prior.slice();
  switch (name) {
    case "binomial":
    case "quasibinomial": {
      for (let i = 0; i < yv.length; i++) if (weights[i] === 0) yv[i] = 0;
      if (yv.some((v) => v < 0 || v > 1)) throw new RangeError("y values must be 0 <= y <= 1");
      const mustart = yv.map((v, i) => (weights[i]! * v + 0.5) / (weights[i]! + 1));
      if (name === "binomial" && yv.some((v, i) => Math.abs(weights[i]! * v - Math.round(weights[i]! * v)) > 1e-3)) {
        warnings.add("non-integer #successes in a binomial glm!");
      }
      return { y: yv, weights, mustart, size: yv.map(() => 1) };
    }
    case "poisson":
    case "quasipoisson":
      if (yv.some((v) => v < 0)) throw new RangeError(`negative values not allowed for the '${name === "poisson" ? "Poisson" : "quasiPoisson"}' family`);
      return { y: yv, weights, mustart: yv.map((v) => v + 0.1), size: undefined };
    case "Gamma":
      if (yv.some((v) => v <= 0)) throw new RangeError("non-positive values not allowed for the 'Gamma' family");
      return { y: yv, weights, mustart: yv.slice(), size: undefined };
    case "inverse.gaussian":
      if (yv.some((v) => v <= 0)) throw new RangeError("positive values only are allowed for the 'inverse.gaussian' family");
      return { y: yv, weights, mustart: yv.slice(), size: undefined };
    case "gaussian":
      if (!hasStart && ((fam.name === "inverse" && yv.some((v) => v === 0)) || (fam.name === "log" && yv.some((v) => v <= 0)))) {
        throw new Error("cannot find valid starting values: please specify some");
      }
      return { y: yv, weights, mustart: yv.slice(), size: undefined };
    case "quasi": {
      const v = fam.varianceName;
      const mustart =
        v === "constant" ? yv.slice() : v === "mu(1-mu)" ? yv.map((t) => Math.min(Math.max(t, 0.001), 0.999)) : yv.map((t) => t + (t === 0 ? 0.1 : 0));
      return { y: yv, weights, mustart, size: undefined };
    }
  }
}

/** The family's AIC before the 2 rank term (R's family$aic); NaN for the quasi families */
export function familyAic(fam: Family, y: number[], mu: number[], w: number[], size: number[] | undefined, dev: number, warnings: Warnings): number {
  const n = y.length;
  let s = 0;
  // Rows of weight 0 are not in the likelihood: left out of every sum (R's gaussian AIC took their log(0) = -Inf and
  // counted them in n, so it was Inf; 0 times an infinite log density was NaN elsewhere)
  switch (fam.family) {
    case "gaussian": {
      let slw = 0;
      let nPos = 0;
      for (const wi of w) {
        if (!(wi > 0)) continue;
        slw += Math.log(wi);
        nPos++;
      }
      return nPos * (Math.log((2 * Math.PI * dev) / nPos) + 1) + 2 - slw;
    }
    case "binomial": {
      const m = size !== undefined && size.some((v) => v > 1) ? size : w;
      for (let i = 0; i < n; i++) {
        // R's round: half to even
        if (m[i]! > 0) s += (w[i]! / m[i]!) * dbinom1(roundHalfEven(m[i]! * y[i]!), roundHalfEven(m[i]!), mu[i]!, true);
      }
      return -2 * s;
    }
    case "poisson":
      for (let i = 0; i < n; i++) {
        if (!(w[i]! > 0)) continue;
        if (nonInteger(y[i]!)) warnings.add(`non-integer x = ${y[i]!.toFixed(6)}`);
        s += w[i]! * dpois1(y[i]!, mu[i]!, true);
      }
      return -2 * s;
    case "Gamma": {
      let sw = 0;
      for (const wi of w) sw += wi;
      const disp = dev / sw;
      for (let i = 0; i < n; i++) if (w[i]! > 0) s += w[i]! * dgamma1(y[i]!, 1 / disp, mu[i]! * disp, true);
      return -2 * s + 2;
    }
    case "inverse.gaussian": {
      let sw = 0;
      let sly = 0;
      for (let i = 0; i < n; i++) {
        if (!(w[i]! > 0)) continue;
        sw += w[i]!;
        sly += w[i]! * Math.log(y[i]!);
      }
      return sw * (Math.log((2 * Math.PI * dev) / sw) + 1) + 3 * sly + 2;
    }
    default:
      return NaN;
  }
}
