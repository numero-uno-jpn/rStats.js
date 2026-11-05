// The families and links of generalised linear mixed models as lme4's glmer computes them: its own inverse links,
// their derivatives and the variance functions, which clamp differently from R's family objects (and from glm's,
// src/models/glmFamily.ts, which is not changed); the link function itself, the deviance residuals, the checks of
// the response, the starting means and the aic term are those of glm.
//
// Written for rStats.js (no ported code) from oracle/glmer-behaviour.md ("Links and families as lme4 computes them").

import { dcauchy1, pcauchy1 } from "../distributions/cauchy.js";
import { dlogis1, plogis1 } from "../distributions/logistic.js";
import { dnorm, pnorm } from "../distributions/normal.js";
import { makeFamily, type Family, type GlmFamilyName, type GlmFamilySpec, type GlmLink, type GlmLinkName } from "./glmFamily.js";

/**
 * The families that {@link glmer} fits (the glm families without the quasi ones).
 *
 * @category Mixed models
 */
export type GlmerFamilyName = "binomial" | "poisson" | "Gamma" | "inverse.gaussian" | "gaussian";

/** A family of glmer resolved to its functions. */
export interface GlmerFamily {
  family: GlmerFamilyName;
  /** The link's name. */
  link: GlmLinkName;
  /** eta = g(mu): R's link function (used for the starting linear predictor only). */
  linkfun(mu: number): number;
  /** mu = g^-1(eta), lme4's. */
  linkinv(eta: number): number;
  /** d mu / d eta, lme4's. */
  muEta(eta: number): number;
  /** The variance function, lme4's. */
  variance(mu: number): number;
  /**
   * d² mu / d eta², the derivative of {@link muEta} (0 where lme4 clamps muEta to a constant): for the analytic
   * gradient of the deviance (src/models/glmerGradient.ts).
   */
  muEta2(eta: number): number;
  /** dV / d mu, the derivative of {@link variance} (0 where lme4 clamps it). */
  varianceDerivative(mu: number): number;
  /** The deviance residual of one observation with prior weight w. */
  devResid(y: number, mu: number, w: number): number;
  /** R's family object (glm's), for the checks of the response, the starting means and the aic term. */
  glm: Family;
}

/** lme4's eps: the clamps of its links and of the binomial variance (DBL_EPSILON, 2^-52) */
const EPS = 2 ** -52;

/**
 * lme4's inverse link and its derivative for the links it computes itself (logit, probit, cauchit, cloglog, log,
 * identity, inverse); undefined for sqrt and 1/mu^2, which are R's family functions. The clamps are lme4's: μ never
 * exactly 0 or 1 for logit and cloglog (but probit and cauchit have no lower clamp), the log link's mean at least eps
 * (e^-40 is 2.2e-16 here, unlike glm), the derivatives of logit, cloglog and log at least eps.
 */
function lme4Link(link: GlmLinkName): { linkinv: (eta: number) => number; muEta: (eta: number) => number } | undefined {
  switch (link) {
    case "logit":
      return {
        linkinv: (e) => Math.max(EPS, Math.min(1 - EPS, plogis1(e, 0, 1, true, false))),
        muEta: (e) => Math.max(EPS, dlogis1(e, 0, 1, false)),
      };
    case "probit":
      // (no lower clamp: lme4's)
      return { linkinv: (e) => Math.min(1 - EPS, pnorm(e)), muEta: (e) => dnorm(e) };
    case "cauchit":
      return { linkinv: (e) => Math.min(1 - EPS, pcauchy1(e, 0, 1, true, false)), muEta: (e) => dcauchy1(e, 0, 1, false) };
    case "cloglog":
      return {
        linkinv: (e) => Math.max(EPS, Math.min(1 - EPS, -Math.expm1(-Math.exp(e)))),
        muEta: (e) => Math.max(EPS, Math.exp(e - Math.exp(e))),
      };
    case "log":
      return { linkinv: (e) => Math.max(EPS, Math.exp(e)), muEta: (e) => Math.max(EPS, Math.exp(e)) };
    case "identity":
      return { linkinv: (e) => e, muEta: () => 1 };
    case "inverse":
      // (no clamp: lme4's)
      return { linkinv: (e) => 1 / e, muEta: (e) => -1 / (e * e) };
    default:
      return undefined;
  }
}

/**
 * d² mu / d eta² of the inverse links of {@link lme4Link} and of R's sqrt and 1/mu^2: the derivative of the muEta in
 * use, so 0 where that is clamped at eps (logit, cloglog, log)
 */
function linkSecondDerivative(link: GlmLinkName): (eta: number) => number {
  switch (link) {
    case "logit":
      // mu' = mu (1 − mu), mu'' = mu' (1 − 2 mu) = −mu' tanh(eta / 2)
      return (e) => {
        const d = dlogis1(e, 0, 1, false);
        return d < EPS ? 0 : -d * Math.tanh(e / 2);
      };
    case "probit":
      return (e) => -e * dnorm(e);
    case "cauchit":
      return (e) => (-2 * e) / (Math.PI * (1 + e * e) * (1 + e * e));
    case "cloglog":
      return (e) => {
        const d = Math.exp(e - Math.exp(e));
        return d < EPS ? 0 : d * -Math.expm1(e);
      };
    case "log":
      return (e) => (Math.exp(e) < EPS ? 0 : Math.exp(e));
    case "identity":
      return () => 0;
    case "inverse":
      return (e) => 2 / (e * e * e);
    case "sqrt":
      // (R's linkinv eta², muEta 2 eta)
      return () => 2;
    case "1/mu^2":
      // (R's linkinv eta^(−1/2), muEta −eta^(−3/2) / 2)
      return (e) => 0.75 / (e * e * Math.sqrt(e));
  }
}

/** dV / d mu of lme4's variance functions (0 where the binomial one is clamped at eps) */
function varianceDerivativeOf(family: GlmerFamilyName): (mu: number) => number {
  switch (family) {
    case "binomial":
      return (m) => (m * (1 - m) < EPS ? 0 : 1 - 2 * m);
    case "poisson":
      return () => 1;
    case "Gamma":
      return (m) => 2 * m;
    case "inverse.gaussian":
      return (m) => 3 * m * m;
    case "gaussian":
      return () => 0;
  }
}

/** lme4's variance functions (the binomial one at least eps) */
function lme4Variance(family: GlmerFamilyName): (mu: number) => number {
  switch (family) {
    case "binomial":
      return (m) => Math.max(EPS, m * (1 - m));
    case "poisson":
      return (m) => m;
    case "Gamma":
      return (m) => m * m;
    case "inverse.gaussian":
      return (m) => m * m * m;
    case "gaussian":
      return () => 1;
  }
}

const GLMER_FAMILIES: readonly string[] = ["binomial", "poisson", "Gamma", "inverse.gaussian", "gaussian"];

/**
 * The family of glmer from a family name or specification and a link given separately (glm's arguments): the quasi
 * families are an error (lme4's first check), and so is gaussian with the identity link, which R fits with lmer
 * (rStats.js's choice G3).
 */
export function glmerFamily(family: GlmFamilyName | GlmFamilySpec | undefined, link?: GlmLink): GlmerFamily {
  const spec: GlmFamilySpec = typeof family === "object" && family !== null ? family : { family: family ?? "gaussian" };
  if (typeof spec.family === "string" && spec.family.startsWith("quasi")) throw new RangeError('"quasi" families cannot be used in glmer');
  // (glm's resolution: unknown families and links, the power links of quasi only)
  const glm = makeFamily(spec, link);
  if (!GLMER_FAMILIES.includes(glm.family)) throw new RangeError(`unknown family "${String(glm.family)}"`);
  const name = glm.family as GlmerFamilyName;
  const linkName = glm.name as GlmLinkName;
  if (name === "gaussian" && linkName === "identity") {
    throw new RangeError("family gaussian with the identity link is a linear mixed model: use lmer (R's glmer calls lmer with a deprecation warning)");
  }
  const own = lme4Link(linkName);
  return {
    family: name,
    link: linkName,
    linkfun: glm.link,
    // (sqrt and 1/mu^2: R's family functions, as glm's)
    linkinv: own?.linkinv ?? glm.linkinv,
    muEta: own?.muEta ?? glm.muEta,
    variance: lme4Variance(name),
    muEta2: linkSecondDerivative(linkName),
    varianceDerivative: varianceDerivativeOf(name),
    devResid: glm.devContribution,
    glm,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The products of μ' and V of a row where they leave the range of the doubles (as glm's working weights, #159 #165-#168
// in src/models/glm.ts): a poisson mean beyond 1.34e154 squared μ' to Infinity, a Gamma mean beyond that V = μ², an
// inverse.gaussian mean beyond 5.6e102 V = μ³. Where μ' = c μ^a and V = μ^p (the families other than binomial with the
// links other than logit, probit, cauchit and cloglog; lme4's log link only above its clamp, which these means are),
// the quantities are formed from the powers of μ instead, which are in range wherever the quantity is. Elsewhere, and
// for every row whose parts are in range, R's form and bits.

const MIN_NORMAL = 2 ** -1022;

/** Whether v is a finite number of the normal range (not 0) */
const normal = (v: number): boolean => Math.abs(v) >= MIN_NORMAL && Math.abs(v) < Infinity;

/** c, a and p of μ' = c μ^a and V = μ^p, where the family and link have that form and μ > 0 */
function powerForm(fam: GlmerFamily, mu: number): { c: number; a: number; p: number } | undefined {
  const m = fam.glm.muPower;
  const p = fam.glm.varPower;
  if (m === undefined || p === undefined || fam.family === "binomial" || !(mu > 0)) return undefined;
  return { c: m.c, a: m.a, p };
}

/** Whether μ' and V of a row are such that their squares and products stay in range (R's forms then) */
function inRange(me: number, v: number): boolean {
  return normal(me * me) && normal(v);
}

/** The working weight w μ'² / V(μ) of a row of prior weight w > 0 (as w c² μ^(2a − p) where that overflows) */
export function workingWeight(fam: GlmerFamily, w: number, me: number, mu: number): number {
  const v = fam.variance(mu);
  const ww = (w * me * me) / v;
  if (inRange(me, v) && Number.isFinite(ww)) return ww;
  const f = powerForm(fam, mu);
  return f === undefined ? ww : w * f.c * f.c * mu ** (2 * f.a - f.p);
}

/** The score w (y − μ) μ' / V(μ) of a row (as w (y − μ) c μ^(a − p) where that overflows) */
export function workingScore(fam: GlmerFamily, w: number, y: number, me: number, mu: number): number {
  const v = fam.variance(mu);
  const s = (w * (y - mu) * me) / v;
  if (inRange(me, v) && Number.isFinite(s)) return s;
  const f = powerForm(fam, mu);
  return f === undefined ? s : w * ((y - mu) * f.c * mu ** (f.a - f.p));
}

/**
 * The weights of the gradient of a row of prior weight w > 0 (src/models/glmerGradient.ts rowWeights): W, dW/dη, the
 * score s and the observed weight Ŵ = W − w (y − μ)(μ''/V − (μ'/V)² V'), in R's form, or from the powers of μ
 * (dW/dη = w c³ (2a − p) μ^(3a − p − 1), Ŵ = W − w (y − μ) c² (a − p) μ^(2a − p − 1)) where that overflows
 */
export function gradientWeights(
  fam: GlmerFamily,
  w: number,
  y: number,
  eta: number,
  mu: number,
  canonical: boolean,
): { ww: number; dww: number; score: number; observed: number } {
  const me = fam.muEta(eta);
  const me2 = fam.muEta2(eta);
  const v = fam.variance(mu);
  const dv = fam.varianceDerivative(mu);
  const r = y - mu;
  const ww = (w * me * me) / v;
  // (the products in this order so that μ'² and μ'³ do not overflow before the division where V is large)
  const dww = w * ((2 * me * me2) / v - ((me / v) * (me / v)) * me * dv);
  const score = (w * r * me) / v;
  const observed = canonical ? ww : ww - w * r * (me2 / v - (me / v) * (me / v) * dv);
  if (inRange(me, v) && Number.isFinite(ww) && Number.isFinite(dww) && Number.isFinite(score) && Number.isFinite(observed)) {
    return { ww, dww, score, observed };
  }
  const f = powerForm(fam, mu);
  if (f === undefined) return { ww, dww, score, observed };
  const { c, a, p } = f;
  const wwPower = w * c * c * mu ** (2 * a - p);
  return {
    ww: wwPower,
    dww: w * c * c * c * (2 * a - p) * mu ** (3 * a - p - 1),
    score: w * (r * c * mu ** (a - p)),
    observed: canonical ? wwPower : wwPower - w * (r * c * c * (a - p) * mu ** (2 * a - p - 1)),
  };
}

/** The Pearson residual √w (y − μ) / √V(μ) (as ((y − μ)/h) √w / h, h = μ^(p/4), where V is out of range) */
export function pearsonResidualOf(fam: GlmerFamily, w: number, y: number, mu: number): number {
  const v = fam.variance(mu);
  const r = (Math.sqrt(w) * (y - mu)) / Math.sqrt(v);
  const f = powerForm(fam, mu);
  if ((normal(v) && Number.isFinite(r)) || f === undefined) return r;
  const h = mu ** (f.p / 4);
  return (((y - mu) / h) * Math.sqrt(w)) / h;
}

/** The working residual (y − μ) / μ' (as ((y − μ)/c)/μ^(a/2)/μ^(a/2) where μ' is out of range) */
export function workingResidualOf(fam: GlmerFamily, y: number, eta: number, mu: number): number {
  const me = fam.muEta(eta);
  const r = (y - mu) / me;
  const f = powerForm(fam, mu);
  if (normal(me) || f === undefined) return r;
  const h = mu ** (f.a / 2);
  return (y - mu) / f.c / h / h;
}
