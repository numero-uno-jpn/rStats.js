// Predictions of lmer and glmer fits against the fixture mixedPredict (oracle/mixedpredict.R; oracle/glmer-behaviour.md
// "Prediction: glmerPredict and lmerPredict (stage 4)"). Against the reference (the predictions at the exact fit):
// glmer (G11) fit within 1e-7 × the largest absolute value of the reference vector, seFit within 1e-6 × the largest;
// lmer fit within 1e-9 × the largest, seFit 1e-8; NaN where the reference is NaN; errors and warnings equal. Against
// lme4 (expected) the largest differences are printed, not checked (seFit not where lme4's is wrong:
// reference.lme4SeDiffers). Also: the options and their errors, the offsets, fits that are not lmer's or glmer's.
import { describe, expect, it } from "vitest";
import { glmer, type GlmerOptions } from "../src/models/glmer.js";
import type { GlmerFamilyName } from "../src/models/glmerFamily.js";
import type { GlmLinkName } from "../src/models/glmFamily.js";
import { lmer, type LmerOptions } from "../src/models/lmer.js";
import { glmerPredict, lmerPredict, type GlmerPredictOptions, type MixedPrediction } from "../src/models/mixedPredict.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("mixedPredict");

const nums = (v: unknown): number[] => (v as string[]).map((x) => num(x));
const maxAbs = (v: readonly number[]): number => Math.max(0, ...v.filter(Number.isFinite).map(Math.abs));

/** The options of a fixture case's fit */
function fitOf(a: Record<string, unknown>): { kind: "glmer" | "lmer"; fit: unknown } {
  const data = dataFrameOf(a.data, a.dataTypes);
  const levels = a.levels as Record<string, string[]> | undefined;
  if (a.kind === "lmer") {
    const options: LmerOptions = { REML: a.REML as boolean };
    if (levels !== undefined) options.levels = levels;
    return { kind: "lmer", fit: lmer(a.formula as string, data, options) };
  }
  const options: GlmerOptions = { family: a.family as GlmerFamilyName, link: a.link as GlmLinkName, nAGQ: num(a.nAGQ as string) };
  const vector = (v: unknown): number[] | string => (typeof v === "string" ? v : nums(v));
  if (a.weights !== undefined) options.weights = vector(a.weights);
  if (a.offset !== undefined) options.offset = vector(a.offset);
  if (levels !== undefined) options.levels = levels;
  return { kind: "glmer", fit: glmer(a.formula as string, data, options) };
}

/** The options of a fixture call */
function callOptions(raw: unknown): GlmerPredictOptions {
  const c = (Array.isArray(raw) ? {} : raw) as Record<string, unknown>;
  const o: GlmerPredictOptions = {};
  if (c.newdata !== undefined) o.newdata = dataFrameOf(c.newdata, c.newdataTypes);
  if (c.reForm !== undefined) o.reForm = c.reForm as string | false;
  if (c.allowNewLevels !== undefined) o.allowNewLevels = c.allowNewLevels as boolean;
  if (c.randomOnly !== undefined) o.randomOnly = c.randomOnly as boolean;
  if (c.type !== undefined) o.type = c.type as "link" | "response";
  if (c.seFit !== undefined) o.seFit = c.seFit as boolean;
  if (c.newoffset !== undefined) o.newoffset = nums(c.newoffset);
  return o;
}

describe("glmerPredict and lmerPredict", () => {
  it(`match the predictions at the exact fit (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const worstRef = new Map<string, number>();
    const worstLme4 = new Map<string, number>();
    const note = (map: Map<string, number>, field: string, err: number): void => {
      map.set(field, Math.max(map.get(field) ?? 0, Number.isNaN(err) ? Infinity : err));
    };
    let calls = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const { kind, fit } = fitOf(a);
      (a.calls as unknown[]).forEach((raw, k) => {
        calls++;
        const where = `case ${index} (${kind} ${String(a.formula)}) call ${k}`;
        const ref = (c.reference as unknown as Record<string, unknown>[])[k]!;
        const e = (c.expected as unknown as Record<string, unknown>[])[k]!;
        const options = callOptions(raw);
        let got: MixedPrediction | undefined;
        let error: string | undefined;
        try {
          got = kind === "glmer" ? glmerPredict(fit as never, options) : lmerPredict(fit as never, options);
        } catch (err) {
          error = (err as Error).message;
        }
        if (ref.error !== undefined) {
          if (error !== ref.error) failures.push(`${where}: expected the error ${String(ref.error)}, got ${error ?? "a result"}`);
          return;
        }
        if (got === undefined) {
          failures.push(`${where}: unexpected error ${error}`);
          return;
        }
        const refWarnings = (ref.warnings as string[] | null) ?? [];
        expect(got.warnings ?? [], `${where} warnings`).toEqual(refWarnings);
        const fields: ["fit" | "seFit", number][] = [["fit", kind === "glmer" ? 1e-7 : 1e-9]];
        if (ref.seFit !== undefined) fields.push(["seFit", kind === "glmer" ? 1e-6 : 1e-8]);
        else if (got.seFit !== undefined) failures.push(`${where}: seFit given but not asked for`);
        for (const [field, tol] of fields) {
          const x = nums(ref[field]);
          const v = got[field];
          if (v === undefined || v.length !== x.length) {
            failures.push(`${where} ${field}: length ${v?.length}, expected ${x.length}`);
            continue;
          }
          const scale = maxAbs(x) || 1;
          v.forEach((value, i) => {
            const err = Number.isNaN(x[i]!) ? (Number.isNaN(value) ? 0 : Infinity) : Math.abs(value - x[i]!) / scale;
            note(worstRef, `${kind} ${field}`, err);
            if (!(err <= tol)) failures.push(`${where} ${field}[${i}]: reference ${x[i]}, got ${value} (error ${err.toExponential(1)})`);
          });
          if (e.error === undefined && !(field === "seFit" && ref.lme4SeDiffers === true)) {
            const l = nums(e[field]);
            v.forEach((value, i) => {
              if (Number.isFinite(l[i]!)) note(worstLme4, `${kind} ${field}`, Math.abs(value - l[i]!) / (maxAbs(l) || 1));
            });
          }
        }
      });
    });
    const show = (map: Map<string, number>): string => [...map].map(([f, v]) => `${f} ${v.toExponential(1)}`).join(", ");
    console.log(`mixedPredict: ${calls} predictions; largest errors against the reference: ${show(worstRef)}; against lme4: ${show(worstLme4)}`);
    expect(failures).toEqual([]);
  });
});

describe("prediction options and errors", () => {
  const data = {
    y: [9.8, 10.4, 10.1, 12.3, 12.9, 12.0, 8.1, 7.6, 8.4, 11.0, 10.2, 9.9],
    x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
    g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
  };
  const fit = lmer("y ~ x + (1 | g)", data);
  const counts = { y: [2, 3, 6, 7, 8, 1, 0, 3, 2, 5, 4, 6, 9, 8, 13, 0, 2, 1, 4, 3], x: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5] };
  const g = ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "c", "c", "c", "c", "c", "d", "d", "d", "d", "d"];
  const lt = counts.x.map((v) => Math.log(v + 1));

  it("checks the options in order", () => {
    expect(() => lmerPredict(fit, { "re.form": null } as never)).toThrow(new Error("lmerPredict: argument 're.form' is not supported"));
    expect(() => lmerPredict(fit, { se: true } as never)).toThrow(RangeError);
    expect(() => lmerPredict(fit, { newoffset: [1] } as never)).toThrow(RangeError);
    expect(() => lmerPredict(fit, { reForm: true } as never)).toThrow(TypeError);
    expect(() => lmerPredict(fit, { allowNewLevels: null } as never)).toThrow(TypeError);
    expect(() => lmerPredict(fit, { type: "terms" } as never)).toThrow(new RangeError("invalid 'type': terms"));
    expect(() => lmerPredict(fit, { newdata: [1, 2] } as never)).toThrow(TypeError);
    expect(() => lmerPredict({ ...fit })).toThrow(TypeError);
    expect(() => glmerPredict(fit as never)).toThrow(TypeError);
  });

  it("gives R's values for the simple cases", () => {
    // lmer: the fitted values without newdata, the population level with reForm false
    expect(lmerPredict(fit).fit).toEqual(fit.fitted.map((v) => expect.closeTo(v, 12)));
    const pop = lmerPredict(fit, { reForm: "~0" }).fit;
    pop.forEach((v, i) => expect(v).toBeCloseTo(fit.fixef[0]! + fit.fixef[1]! * data.x[i]!, 12));
    // a new level allowed: the population level; missing x: NaN
    const p = lmerPredict(fit, { newdata: { x: [2, null], g: ["zz", "a"] }, allowNewLevels: true });
    expect(p.fit[0]).toBeCloseTo(fit.fixef[0]! + 2 * fit.fixef[1]!, 12);
    expect(p.fit[1]).toBeNaN();
    expect(p.warnings).toBeUndefined();
    expect(() => lmerPredict(fit, { newdata: { g: ["a"] } })).toThrow(new RangeError("object 'x' not found"));
    expect(() => lmerPredict(fit, { newdata: { x: [1] } })).toThrow(new RangeError("object 'g' not found"));
    expect(() => lmerPredict(fit, { newdata: { x: ["1"], g: ["a"] } })).toThrow(TypeError);
  });

  it("reads the offset as glmer was given it (G16)", () => {
    const byColumn = glmer("y ~ x + (1 | g)", { ...counts, g, lt }, { family: "poisson", offset: "lt" });
    const byArray = glmer("y ~ x + (1 | g)", { ...counts, g }, { family: "poisson", offset: lt });
    const nd = { x: [2, 6], g: ["a", "c"], lt: [0.5, 1] };
    const a = glmerPredict(byColumn, { newdata: nd }).fit;
    const b = glmerPredict(byArray, { newdata: nd }).fit;
    const c = glmerPredict(byArray, { newdata: nd, newoffset: [0.5, 1] }).fit;
    a.forEach((v, i) => {
      expect(v - b[i]!).toBeCloseTo(nd.lt[i]!, 12);
      expect(c[i]).toBeCloseTo(v, 12);
    });
    expect(() => glmerPredict(byColumn, { newdata: nd, newoffset: [0, 0] })).toThrow(RangeError);
    expect(() => glmerPredict(byArray, { newoffset: [0, 0] })).toThrow(RangeError);
    expect(() => glmerPredict(byArray, { newdata: nd, newoffset: [0] })).toThrow(new RangeError("newoffset must have one value per row of newdata"));
    expect(() => glmerPredict(byColumn, { newdata: { x: [1], g: ["a"] } })).toThrow(new RangeError("object 'lt' not found"));
    // without newdata, the fit's offset; random.only leaves it out
    expect(glmerPredict(byArray, { reForm: false }).fit[0]).toBeCloseTo(byArray.fixef[0]! + byArray.fixef[1]! * 1 + lt[0]!, 12);
    expect(glmerPredict(byArray, { randomOnly: true }).fit[0]).toBeCloseTo(byArray.ranef[0]!.values[0]![0]!, 12);
    // the warning of the standard errors
    expect(glmerPredict(byArray, { seFit: true }).warnings).toEqual([
      "se.fit computation uses an approximation to estimate the sampling distribution of the parameters",
    ]);
  });
});
