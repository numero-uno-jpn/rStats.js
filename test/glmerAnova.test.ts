// The ANOVA of glmer fits against the fixture glmerAnova (oracle/glmeranova.R; oracle/glmer-behaviour.md "glmerAnova
// (stage 3)" and G15). One fit, against the reference (the table at the exact optimum, R_X and β̂ in 110-bit
// arithmetic): sumSq, meanSq, F relative 1e-9, terms and npar equal. Several fits, against the reference (the exact
// optima; logLik by G12 for nAGQ > 1; no test where the fit before is not nested): logLik, AIC, BIC, deviance
// relative 1e-12 (rows of lmer fits too), Chisq absolute 1e-12 max(1, |logLik|), pValue relative 1e-9, names, npar,
// Df and the NaN of Chisq and pValue equal, messages and warnings equal to R's; errors: the reference's (rStats.js's
// own checks) or else R's message. Against lme4 (expected) the largest differences are printed. Also: glm fits in a
// comparison (G15), against the fixture glmerAnovaGlm (oracle/glmeranovaglm.R: the exact glmer optimum and glm's
// converged fit, with the tolerances above) and on their own; the options and the fits accepted.
import { describe, expect, it } from "vitest";
import { dbinom } from "../src/index.js";
import { glm } from "../src/models/glm.js";
import { glmer, type GlmerOptions } from "../src/models/glmer.js";
import { glmerAnova } from "../src/models/glmerAnova.js";
import type { GlmerFamilyName } from "../src/models/glmerFamily.js";
import type { GlmLinkName } from "../src/models/glmFamily.js";
import { lmer } from "../src/models/lmer.js";
import type { LmerCompareTable } from "../src/models/lmerAnova.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("glmerAnova");
const glmFixture = loadAnovaFixture("glmerAnovaGlm");
const TOL_TABLE = 1e-9;
const TOL_LOGLIK = 1e-12;
const TOL_LOGLIK_LMER = 1e-12;
const TOL_CHISQ = 1e-12;
const TOL_P = 1e-9;

/** "NA" is NaN */
const value = (s: string): number => (s === "NA" ? NaN : num(s));
const values = (v: unknown): number[] => (v as string[]).map(value);
const scaledError = (actual: number, expected: number, scale: number): number =>
  actual === expected || (Number.isNaN(actual) && Number.isNaN(expected)) ? 0 : Math.abs(actual - expected) / scale;

interface ModelSpec {
  kind: "glmer" | "lmer";
  formula: string;
  family?: string;
  link?: string;
  nAGQ?: string;
  weights?: unknown;
  offset?: unknown;
  REML?: boolean;
}

function glmerOptionsOf(a: Record<string, unknown>): GlmerOptions {
  const options: GlmerOptions = { family: a.family as GlmerFamilyName, link: a.link as GlmLinkName, nAGQ: num(a.nAGQ as string) };
  const vector = (v: unknown): number[] | string => (typeof v === "string" ? v : values(v));
  if (a.weights !== undefined) options.weights = vector(a.weights);
  if (a.offset !== undefined) options.offset = vector(a.offset);
  return options;
}

describe("glmerAnova", () => {
  it(`matches the tables at the exact optima (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const worstRef = new Map<string, number>();
    const worstLme4 = new Map<string, number>();
    const note = (map: Map<string, number>, field: string, err: number): void => {
      map.set(field, Math.max(map.get(field) ?? 0, Number.isNaN(err) ? Infinity : err));
    };
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const data = dataFrameOf(a.data, a.dataTypes);
      const e = c.expected;
      const ref = c.reference;
      if (a.models === undefined) {
        // one fit
        const where = `case ${index} (${String(a.formula)}, ${String(a.family)} ${String(a.link)}, nAGQ = ${String(a.nAGQ)})`;
        const t = glmerAnova(glmer(a.formula as string, data, glmerOptionsOf(a)));
        if (JSON.stringify(t.terms) !== JSON.stringify(ref!.terms)) failures.push(`${where} terms: ${JSON.stringify(t.terms)}`);
        if (JSON.stringify(t.npar) !== JSON.stringify(values(ref!.npar))) failures.push(`${where} npar: ${JSON.stringify(t.npar)}`);
        for (const f of ["sumSq", "meanSq", "F"] as const) {
          const x = values(ref![f]);
          const l = values(e[f]);
          t[f].forEach((v, i) => {
            const err = scaledError(v, x[i]!, Math.abs(x[i]!));
            note(worstRef, f, err);
            if (!(err <= TOL_TABLE)) failures.push(`${where} ${f}[${i}]: reference ${x[i]}, got ${v} (error ${err.toExponential(1)})`);
            note(worstLme4, f, scaledError(v, l[i]!, Math.abs(l[i]!)));
          });
        }
        if (t.messages.length > 0 || t.warnings.length > 0) failures.push(`${where}: messages or warnings`);
        return;
      }
      // several fits
      const models = a.models as ModelSpec[];
      const where = `case ${index} (${models.map((m) => `${m.kind} ${m.formula}`).join(", ")})`;
      const fits = models.map((m) =>
        m.kind === "lmer" ? lmer(m.formula, data, { REML: m.REML === true }) : glmer(m.formula, data, glmerOptionsOf(m as unknown as Record<string, unknown>)),
      );
      const options: { refit?: boolean; names?: string[] } = {};
      if (a.refit !== undefined) options.refit = a.refit as boolean;
      if (a.names !== undefined) options.names = a.names as string[];
      const error = (ref?.error ?? e.error) as string | undefined;
      if (error !== undefined) {
        let message: string | undefined;
        try {
          glmerAnova(fits, options);
        } catch (err) {
          message = (err as Error).message;
        }
        if (message !== error) failures.push(`${where}: error ${String(message)}, expected ${error}`);
        return;
      }
      const t: LmerCompareTable = glmerAnova(fits, options);
      const exact: [string, unknown, unknown][] = [
        ["names", t.names, ref!.names],
        ["npar", t.npar, values(ref!.npar)],
        ["Df", t.Df.map(String), values(ref!.Df).map(String)],
        ["messages", t.messages, e.messages],
        ["warnings", t.warnings, e.warnings],
      ];
      for (const [field, v, x] of exact) {
        if (JSON.stringify(v) !== JSON.stringify(x)) failures.push(`${where} ${field}: ${JSON.stringify(v)}, expected ${JSON.stringify(x)}`);
      }
      // the kind of the model of each row
      const givenNames = options.names !== undefined && new Set(options.names).size === options.names.length ? options.names : models.map((_, i) => `MODEL${i + 1}`);
      const kinds = t.names.map((n) => models[givenNames.indexOf(n)]!.kind);
      for (const f of ["logLik", "AIC", "BIC", "deviance"] as const) {
        const x = values(ref![f]);
        const l = values(e[f]);
        t[f].forEach((v, i) => {
          const err = scaledError(v, x[i]!, Math.abs(x[i]!));
          note(worstRef, f, err);
          if (!(err <= (kinds[i] === "lmer" ? TOL_LOGLIK_LMER : TOL_LOGLIK))) failures.push(`${where} ${f}[${i}]: reference ${x[i]}, got ${v} (error ${err.toExponential(1)})`);
          note(worstLme4, f, scaledError(v, l[i]!, Math.abs(l[i]!)));
        });
      }
      const chisqRef = values(ref!.Chisq);
      const pRef = values(ref!.pValue);
      const llRef = values(ref!.logLik);
      t.Chisq.forEach((v, i) => {
        const err = scaledError(v, chisqRef[i]!, Math.max(1, Math.abs(llRef[i]!)));
        note(worstRef, "Chisq (/ max(1, |logLik|))", err);
        if (!(err <= TOL_CHISQ)) failures.push(`${where} Chisq[${i}]: reference ${chisqRef[i]}, got ${v}`);
        const p = t.pValue[i]!;
        const errP = scaledError(p, pRef[i]!, Math.abs(pRef[i]!));
        note(worstRef, "pValue", errP);
        if (!(errP <= TOL_P)) failures.push(`${where} pValue[${i}]: reference ${pRef[i]}, got ${p}`);
      });
    });
    const show = (m: Map<string, number>): string => [...m].map(([f, w]) => `${f} ${w.toExponential(1)}`).join(", ");
    console.log(`glmerAnova: ${fixture.cases.length} cases; largest error against the reference: ${show(worstRef)}`);
    console.log(`glmerAnova: largest relative difference from lme4: ${show(worstLme4)}`);
    expect(failures, failures.slice(0, 30).join("\n")).toEqual([]);
  });

  // G15 against R: anova(glmer fit, glm fit) with the same fixed effects (fixture glmerAnovaGlm, oracle/glmeranovaglm.R)
  it(`compares glm and glmer fits as R does (${glmFixture.r_version})`, () => {
    const failures: string[] = [];
    const worst = new Map<string, number>();
    const note = (field: string, err: number): void => {
      worst.set(field, Math.max(worst.get(field) ?? 0, Number.isNaN(err) ? Infinity : err));
    };
    glmFixture.cases.forEach((c, index) => {
      const a = c.args;
      const where = `case ${index} (${String(a.formula)} and glm ${String(a.glmFormula)}, ${String(a.glmLink)})`;
      const data = dataFrameOf(a.data, a.dataTypes);
      const m = glmer(a.formula as string, data, glmerOptionsOf(a));
      const x = (a.glmX as string[][]).map(values);
      const y = Array.isArray((a.glmY as unknown[])[0]) ? (a.glmY as string[][]).map(values) : values(a.glmY);
      const g = glm(x, y, {
        family: a.family as GlmerFamilyName,
        link: a.glmLink as GlmLinkName,
        ...(a.weights === undefined ? {} : { weights: values(a.weights) }),
      });
      const names = a.names as string[];
      const t = glmerAnova([g, m], { names: [names[1]!, names[0]!] });
      const ref = c.reference!;
      const e = c.expected;
      for (const [field, v, x] of [
        ["names", t.names, ref.names],
        ["npar", t.npar, values(ref.npar)],
        ["Df", t.Df.map(String), values(ref.Df).map(String)],
        ["messages", t.messages, e.messages],
        ["warnings", t.warnings, e.warnings],
      ] as [string, unknown, unknown][]) {
        if (JSON.stringify(v) !== JSON.stringify(x)) failures.push(`${where} ${field}: ${JSON.stringify(v)}, expected ${JSON.stringify(x)}`);
      }
      for (const f of ["logLik", "AIC", "BIC", "deviance"] as const) {
        const x = values(ref[f]);
        t[f].forEach((v, i) => {
          const err = scaledError(v, x[i]!, Math.abs(x[i]!));
          note(f, err);
          if (!(err <= TOL_LOGLIK)) failures.push(`${where} ${f}[${i}]: reference ${x[i]}, got ${v} (error ${err.toExponential(1)})`);
        });
      }
      const chisqRef = values(ref.Chisq);
      const pRef = values(ref.pValue);
      const llRef = values(ref.logLik);
      t.Chisq.forEach((v, i) => {
        const err = scaledError(v, chisqRef[i]!, Math.max(1, Math.abs(llRef[i]!)));
        note("Chisq (/ max(1, |logLik|))", err);
        if (!(err <= TOL_CHISQ)) failures.push(`${where} Chisq[${i}]: reference ${chisqRef[i]}, got ${v}`);
        const errP = scaledError(t.pValue[i]!, pRef[i]!, Math.abs(pRef[i]!));
        note("pValue", errP);
        if (!(errP <= TOL_P)) failures.push(`${where} pValue[${i}]: reference ${pRef[i]}, got ${t.pValue[i]}`);
      });
    });
    const show = [...worst].map(([f, w]) => `${f} ${w.toExponential(1)}`).join(", ");
    console.log(`glmerAnova with glm fits: ${glmFixture.cases.length} cases; largest error against the reference: ${show}`);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  // cbpp from the fixture: incidence of a disease by herd and period
  const cbppCase = fixture.cases[0]!.args;
  const cbpp = dataFrameOf(cbppCase.data, cbppCase.dataTypes);
  const inc = cbpp.inc as number[];
  const notinc = cbpp.notinc as number[];
  const period = cbpp.period as string[];
  const periodColumns = period.map((p) => ["2", "3", "4"].map((l) => (p === l ? 1 : 0)));
  const full = glmer("cbind(inc, notinc) ~ period + (1 | herd)", cbpp, { family: "binomial" });

  describe("glm fits in a comparison (G15)", () => {
    it("R's log-likelihood of glm (rank minus aic / 2), nested in a glmer fit of the same family and link", () => {
      const g = glm(periodColumns, inc.map((s, i) => [s, notinc[i]!]), { family: "binomial" });
      const t = glmerAnova([full, g], { names: ["glmm", "glm"] });
      // the binomial log-likelihood of the glm fit
      const ll = inc.reduce((sum, s, i) => sum + dbinom(s, s + notinc[i]!, g.fittedValues[i]!, { log: true }), 0);
      expect(t.names).toEqual(["glm", "glmm"]);
      expect(t.npar).toEqual([4, 5]);
      expect(Math.abs(t.logLik[0]! - ll)).toBeLessThan(1e-10 * Math.abs(ll));
      expect(t.logLik[1]).toBe(full.logLik);
      expect(t.Chisq[1]).toBeCloseTo(2 * (full.logLik - ll), 9);
      expect(t.Df[1]).toBe(1);
      expect(t.pValue[1]).toBeGreaterThan(0);
    });

    it("another link or an offset: no test; another response or prior weights: an error", () => {
      const probit = glm(periodColumns, inc.map((s, i) => [s, notinc[i]!]), { family: "binomial", link: "probit" });
      expect(glmerAnova([full, probit]).Chisq).toEqual([NaN, NaN]);
      const offset = glm(periodColumns, inc.map((s, i) => [s, notinc[i]!]), { family: "binomial", offset: inc.map(() => 0.1) });
      expect(glmerAnova([full, offset]).Chisq).toEqual([NaN, NaN]);
      const other = glm(periodColumns, inc.map((s, i) => [s, notinc[i]! + 1]), { family: "binomial" });
      expect(() => glmerAnova([full, other])).toThrow(new Error("models were not all fitted to the same response"));
      const proportion = inc.map((s, i) => s / (s + notinc[i]!));
      const unweighted = glm(periodColumns, proportion, { family: "binomial" });
      expect(() => glmerAnova([full, unweighted])).toThrow(new Error("models were not all fitted with the same prior weights"));
      const fewer = glm(periodColumns.slice(1), inc.slice(1).map((s, i) => [s, notinc[i + 1]!]), { family: "binomial" });
      expect(() => glmerAnova([full, fewer])).toThrow(new Error("models were not all fitted to the same size of dataset"));
    });

    it("a gaussian glm with the identity link is nested in an lmer fit", () => {
      const data = {
        y: [3.1, 4.0, 5.2, 6.8, 7.1, 8.3, 2.2, 3.5, 3.9, 5.9, 6.1, 7.4],
        x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
        g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
      };
      const m = lmer("y ~ x + (1 | g)", data, { REML: false });
      const g = glm(data.x, data.y);
      const t = glmerAnova([g, m]);
      expect(t.npar).toEqual([3, 4]);
      expect(t.Chisq[1]).toBeCloseTo(2 * (m.logLik - t.logLik[0]!), 10);
      expect(t.Df[1]).toBe(1);
      // the glm's log-likelihood: n/2 (log(2π RSS/n) + 1) with the sign changed
      const n = data.y.length;
      expect(t.logLik[0]).toBeCloseTo(-(n / 2) * (Math.log((2 * Math.PI * g.deviance) / n) + 1), 10);
    });
  });

  describe("options and fits", () => {
    const small = glmer("cbind(inc, notinc) ~ 1 + (1 | herd)", cbpp, { family: "binomial" });

    it("one fit: no option; several: refit and names, R's model names not supported", () => {
      expect(() => glmerAnova(full, { type: "I" } as never)).toThrow(RangeError);
      expect(() => glmerAnova(full, null as never)).toThrow(TypeError);
      expect(glmerAnova(full, {}).terms).toEqual(["period"]);
      expect(() => glmerAnova([full, small], { modelNames: ["a", "b"] } as never)).toThrow(new Error("glmerAnova: argument 'modelNames' is not supported"));
      expect(() => glmerAnova([full, small], { "model.names": ["a", "b"] } as never)).toThrow(new Error("glmerAnova: argument 'model.names' is not supported"));
      expect(() => glmerAnova([full, small], { test: "Chisq" } as never)).toThrow(RangeError);
      expect(() => glmerAnova([full, small], { refit: null } as never)).toThrow(TypeError);
      expect(glmerAnova([full, small], { names: ["full", "small"], refit: false }).names).toEqual(["small", "full"]);
    });

    it("the fits: glmer's own result for one; for several at least two of glmer, lmer and glm, not glm alone", () => {
      expect(() => glmerAnova({ ...full })).toThrow(TypeError);
      expect(() => glmerAnova([full])).toThrow(new TypeError("glmerAnova needs one fit, or an array of at least two fits to compare"));
      expect(() => glmerAnova([full, { ...small }])).toThrow(TypeError);
      const g1 = glm(periodColumns, inc.map((s, i) => [s, notinc[i]!]), { family: "binomial" });
      const g0 = glm(period.map(() => []), inc.map((s, i) => [s, notinc[i]!]), { family: "binomial" });
      expect(() => glmerAnova([g0, g1])).toThrow(TypeError);
      // glmer fits with another data object
      const copy = glmer("cbind(inc, notinc) ~ 1 + (1 | herd)", { ...cbpp }, { family: "binomial" });
      expect(() => glmerAnova([full, copy])).toThrow(new Error("all models must be fit to the same data object"));
    });
  });
});
