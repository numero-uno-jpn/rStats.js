// The analytic gradient of glmer's deviances (src/models/glmerGradient.ts and glmerAgqDeviance; oracle/glmer-behaviour.md,
// "The gradient (rStats.js)") against 5-point central differences of the deviance (step 1e-4, accurate to about
// 1e-10): every family and link, nAGQ 0, 1 and > 1, scalar, vector and crossed terms, prior weights, binomial sizes,
// an offset, θ with zeros, at several random points each (25 quadrature points for binomial and poisson only). Tolerance: 1e-7 × max(1, |difference quotient|).
import { describe, expect, it } from "vitest";
import { glmerAgqDeviance, glmerDeviance } from "../src/models/glmerDeviance.js";
import { glmerStructure } from "../src/models/glmerStructure.js";
import type { GlmFamilyName, GlmLinkName } from "../src/models/glmFamily.js";

const TOL = 1e-7;
const STEP = 1e-4;

/** A seeded uniform generator (LCG) */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s + 0.5) / 4294967296;
  };
}

const u = lcg(7);
const n = 40;
const x = Array.from({ length: n }, () => u() * 2 - 1);
const z = Array.from({ length: n }, () => u() * 2 - 1);
const data = {
  x,
  z,
  g: Array.from({ length: n }, (_, i) => `g${i % 5}`),
  h: Array.from({ length: n }, (_, i) => `h${i % 4}`),
  pos: Array.from({ length: n }, (_, i) => Math.exp(0.3 * x[i]! + 0.4 * (u() - 0.5)) * (1 + 0.5 * u())),
  cnt: Array.from({ length: n }, () => Math.floor(u() * 6)),
  cnt1: Array.from({ length: n }, () => 4 + Math.floor(u() * 6)),
  bin: Array.from({ length: n }, () => (u() < 0.5 ? 1 : 0)),
  wt: Array.from({ length: n }, () => 1 + Math.floor(u() * 3)),
  prop: Array.from({ length: n }, () => Math.floor(u() * 4) / 3),
  s: Array.from({ length: n }, () => Math.floor(u() * 4)),
  f: Array.from({ length: n }, () => Math.floor(u() * 4)),
  off: Array.from({ length: n }, () => 0.5 * (u() - 0.5)),
};

interface Case {
  formula: string;
  family: GlmFamilyName;
  link: GlmLinkName;
  weights?: string;
  offset?: string;
}
const cases: Case[] = [
  { formula: "bin ~ x + (1 | g)", family: "binomial", link: "logit" },
  { formula: "bin ~ x + (1 | g)", family: "binomial", link: "probit" },
  { formula: "bin ~ x + (1 | g)", family: "binomial", link: "cloglog" },
  { formula: "bin ~ x + (1 | g)", family: "binomial", link: "cauchit" },
  { formula: "prop ~ x + (1 | g)", family: "binomial", link: "logit", weights: "wt" },
  { formula: "cbind(s, f) ~ x + (x | g)", family: "binomial", link: "logit" },
  { formula: "cnt ~ x + (x | g)", family: "poisson", link: "log", offset: "off" },
  { formula: "cnt ~ x + (1 | g) + (1 | h)", family: "poisson", link: "sqrt" },
  { formula: "cnt ~ x + (1 | g) + (0 + z | h)", family: "poisson", link: "log" },
  { formula: "cnt1 ~ x + (1 | g)", family: "poisson", link: "identity", offset: "off" },
  { formula: "pos ~ x + (1 | g)", family: "Gamma", link: "log", weights: "wt" },
  { formula: "pos ~ x + (1 | g)", family: "Gamma", link: "inverse" },
  { formula: "pos ~ x + (x | g)", family: "Gamma", link: "identity" },
  { formula: "pos ~ x + (1 | g) + (1 | h)", family: "inverse.gaussian", link: "1/mu^2" },
  { formula: "pos ~ x + (1 | g)", family: "inverse.gaussian", link: "log" },
  { formula: "pos ~ x + (1 | g)", family: "gaussian", link: "log" },
  { formula: "pos ~ x + (z | g) + (1 | h)", family: "gaussian", link: "inverse" },
];

describe("the analytic gradient of glmer's deviances", () => {
  it("agrees with central differences of the deviance (all families and links, nAGQ 0, 1, 3 and 25)", () => {
    const failures: string[] = [];
    let worst = 0;
    let points = 0;
    for (const c of cases) {
      const s = glmerStructure(c.formula, data, {
        family: c.family,
        link: c.link,
        ...(c.weights === undefined ? {} : { weights: c.weights }),
        ...(c.offset === undefined ? {} : { offset: c.offset }),
      });
      const nTheta = s.theta.length;
      const scalar = s.terms.length === 1 && s.terms[0]!.columns.length === 1;
      for (const nAGQ of [0, 1, 3, 25]) {
        if (nAGQ > 1 && !scalar) continue;
        // (the far nodes of 25 points leave the domain of the inverse link for Gamma's data here: NaN deviance)
        if (nAGQ > 3 && c.family !== "binomial" && c.family !== "poisson") continue;
        for (let rep = 0; rep < 3; rep++) {
          // θ: diagonal elements in (0.3, 1.3), the others in (−0.5, 0.5); the last point with the first element 0
          const theta = s.theta.map((_, j) => (rep === 2 && j === 0 ? 0 : s.lower[j] === 0 ? 0.3 + u() : u() - 0.5));
          const beta = glmerDeviance(s, theta, undefined, 0).beta.map((b) => b + 0.1 * (u() - 0.5));
          const at = (p: readonly number[]): { deviance: number; gradient?: number[] } => {
            const th = p.slice(0, nTheta);
            if (nAGQ === 0) return glmerDeviance(s, th, undefined, 0, { gradient: true });
            return nAGQ === 1 ? glmerDeviance(s, th, p.slice(nTheta), 1, { gradient: true }) : glmerAgqDeviance(s, th, p.slice(nTheta), nAGQ, { gradient: true });
          };
          const p0 = nAGQ === 0 ? theta : [...theta, ...beta];
          const g = at(p0).gradient!;
          p0.forEach((_, j) => {
            // (θ_j = 0 is a point where the deviance is even in it: the central difference is right there too)
            const f = (d: number): number => {
              const p = p0.slice();
              p[j] = p[j]! + d;
              return at(p).deviance;
            };
            const numeric = (8 * (f(STEP) - f(-STEP)) - (f(2 * STEP) - f(-2 * STEP))) / (12 * STEP);
            const err = Math.abs(g[j]! - numeric) / Math.max(1, Math.abs(numeric));
            worst = Math.max(worst, err);
            if (!(err <= TOL)) failures.push(`${c.formula} ${c.family} ${c.link} nAGQ ${nAGQ} point ${rep} [${j}]: analytic ${g[j]}, differences ${numeric}`);
          });
          points++;
        }
      }
    }
    console.log(`glmer gradient: ${points} points; largest error against central differences ${worst.toExponential(1)}`);
    expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
  });
});
