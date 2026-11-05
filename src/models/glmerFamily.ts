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

/** The families glmer fits. */
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
    devResid: glm.devContribution,
    glm,
  };
}
