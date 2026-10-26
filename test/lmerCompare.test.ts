// The comparison of lmer fits by lmerAnova (src/models/lmerAnova.ts; lme4's anova() of several fits,
// oracle/lmertest-behaviour.md section 3) against the fixture lmerCompare (oracle/lmercompare.R).
//
// Exactly: the names, npar and Df (NaN in the first row), the messages, the warnings, and the errors.
//
// Against the reference (the fixture's `reference`, from the exact optima; on as soon as a case has one): logLik, AIC,
// BIC and deviance relative 1e-12 (the criterion's tolerance in the fixture lmer), Chisq within 1e-12 × the largest
// absolute deviance of the table, p-values relative 1e-9 (below 1e-300 absolute).
//
// Against lme4 (`expected`), whose optimiser stops short of the optimum: every log-likelihood at least lme4's
// (logLik ≥ logLik_lme4 − 1e-10 |logLik_lme4|, as the criterion in the fixture lmer) and within 1e-8 relative of it
// (lme4's criterion is that close to the optimum: its θ is 1e-9 to 1e-5 from the minimiser, where the criterion is
// flat to second order); AIC, BIC and deviance follow from logLik and are compared within the same absolute
// difference as their row's logLik (times 2) plus rounding; Chisq within twice the sum of the two log-likelihood
// differences of its rows (it is linear in them) plus rounding; the p-value between those of lme4's Chisq moved by that
// bound (it is monotone in Chisq). The largest differences are printed.
import { describe, expect, it } from "vitest";
import { pchisq, type DataFrame } from "../src/index.js";
import { lmer, type LmerOptions, type LmerResult } from "../src/models/lmer.js";
import { lmerAnova, type LmerCompareTable } from "../src/models/lmerAnova.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const TOL_REF_CRITERION = 1e-12;
const TOL_REF_P = 1e-9;
const TOL_NOT_WORSE = 1e-10;
const TOL_LME4 = 1e-8;
/** Rounding slack of quantities computed from logLik (relative to the largest absolute deviance) */
const ROUNDING = 1e-13;

const fixture = loadAnovaFixture("lmerCompare");
type Strings = string[];
interface ModelSpec {
  formula: string;
  REML?: boolean;
  contrasts?: LmerOptions["contrasts"];
  levels?: LmerOptions["levels"];
}

/** "NA" is NaN */
const value = (s: string): number => (s === "NA" ? NaN : num(s));
const values = (v: unknown): number[] => (v as Strings).map(value);
const same = (a: number, b: number): boolean => Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b));

/** A data frame of the fixture; with no types given (`datas`), a column is numeric when every value reads as a number */
function frameOf(raw: Record<string, (string | null)[]>, types: unknown): DataFrame {
  if (types !== undefined) return dataFrameOf(raw, types);
  const inferred: Record<string, string> = {};
  for (const [k, col] of Object.entries(raw)) {
    inferred[k] = col.every((v) => v === null || v === "NA" || !Number.isNaN(Number(v))) ? "numeric" : "character";
  }
  const out = dataFrameOf(Object.fromEntries(Object.entries(raw).map(([k, col]) => [k, inferred[k] === "numeric" ? col.map((v) => (v === "NA" ? null : v)) : col])), inferred);
  return out;
}

function optionsOf(m: ModelSpec): LmerOptions {
  const o: LmerOptions = { REML: m.REML === true };
  if (m.contrasts !== undefined) o.contrasts = m.contrasts;
  if (m.levels !== undefined) o.levels = m.levels;
  return o;
}

describe("lmerAnova: comparing models", () => {
  it(`agrees with lme4's anova of several fits (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const worst = new Map<string, number>();
    const note = (field: string, err: number): void => void worst.set(field, Math.max(worst.get(field) ?? 0, err));
    let withReference = 0;
    fixture.cases.forEach((c, ci) => {
      const a = c.args;
      const models = a.models as ModelSpec[];
      const where = `case ${ci + 1} (${models.map((m) => m.formula).join(", ")})`;
      const shared = a.data === undefined ? undefined : frameOf(a.data as Record<string, (string | null)[]>, a.dataTypes);
      const datas = (a.datas as Record<string, (string | null)[]>[] | undefined)?.map((d) => frameOf(d, undefined));
      const fits: LmerResult[] = models.map((m, i) => lmer(m.formula, shared ?? datas![i]!, optionsOf(m)));
      const options: { refit?: boolean; names?: string[] } = {};
      if (a.refit !== undefined) options.refit = a.refit as boolean;
      if (a.names !== undefined) options.names = a.names as string[];
      const e = c.expected;
      if (e.error !== undefined) {
        let message = "(no error)";
        try {
          lmerAnova(fits, options);
        } catch (err) {
          message = (err as Error).message;
        }
        if (message !== e.error) failures.push(`${where}: error ${message}, lme4 ${String(e.error)}`);
        return;
      }
      const r: LmerCompareTable = lmerAnova(fits, options);
      for (const field of ["names", "messages", "warnings"] as const) {
        if (JSON.stringify(r[field]) !== JSON.stringify(e[field])) failures.push(`${where} ${field}: ${JSON.stringify(r[field])}, lme4 ${JSON.stringify(e[field])}`);
      }
      for (const field of ["npar", "Df"] as const) {
        const want = values(e[field]);
        if (want.length !== r[field].length || want.some((v, i) => !same(v, r[field][i]!))) {
          failures.push(`${where} ${field}: ${JSON.stringify(r[field])}, lme4 ${JSON.stringify(e[field])}`);
        }
      }
      const llE = values(e.logLik);
      const scale = Math.max(...values(e.deviance).map(Math.abs));
      const dll = r.logLik.map((v, i) => Math.abs(v - llE[i]!));
      r.logLik.forEach((v, i) => {
        const err = dll[i]! / Math.abs(llE[i]!);
        note("logLik", err);
        if (!(v >= llE[i]! - TOL_NOT_WORSE * Math.abs(llE[i]!))) failures.push(`${where} logLik[${i}]: ${v}, worse than lme4's ${llE[i]}`);
        if (!(err <= TOL_LME4)) failures.push(`${where} logLik[${i}]: ${v}, lme4 ${llE[i]}`);
      });
      for (const field of ["AIC", "BIC", "deviance"] as const) {
        const want = values(e[field]);
        r[field].forEach((v, i) => {
          note(field, Math.abs(v - want[i]!) / Math.abs(want[i]!));
          if (!(Math.abs(v - want[i]!) <= 2 * dll[i]! + ROUNDING * scale)) failures.push(`${where} ${field}[${i}]: ${v}, lme4 ${want[i]}`);
        });
      }
      const chisqE = values(e.Chisq);
      const pE = values(e.pValue);
      r.Chisq.forEach((v, i) => {
        if (i === 0) {
          if (!Number.isNaN(v) || !Number.isNaN(r.pValue[0]!)) failures.push(`${where}: the first row's Chisq and p-value must be NaN`);
          return;
        }
        const bound = 2 * (dll[i]! + dll[i - 1]!) + ROUNDING * scale;
        note("Chisq", Math.abs(v - chisqE[i]!) / scale);
        if (!(Math.abs(v - chisqE[i]!) <= bound)) failures.push(`${where} Chisq[${i}]: ${v}, lme4 ${chisqE[i]}`);
        const df = r.Df[i]!;
        const p = r.pValue[i]!;
        if (df === 0) {
          if (!Number.isNaN(p) || !Number.isNaN(pE[i]!)) failures.push(`${where} pValue[${i}]: ${p} with Df 0, lme4 ${pE[i]}`);
          return;
        }
        const hi = pchisq(Math.max(0, chisqE[i]! - bound), df, { lowerTail: false });
        const lo = pchisq(chisqE[i]! + bound, df, { lowerTail: false });
        note("pValue", Math.abs(p - pE[i]!) / pE[i]!);
        if (!(p >= lo * (1 - 1e-12) && p <= hi * (1 + 1e-12))) failures.push(`${where} pValue[${i}]: ${p}, lme4 ${pE[i]} (allowed ${lo} to ${hi})`);
      });

      const ref = c.reference;
      if (ref === undefined) return;
      withReference++;
      if (JSON.stringify(r.names) !== JSON.stringify(ref.names)) failures.push(`${where} names: ${JSON.stringify(r.names)}, reference ${JSON.stringify(ref.names)}`);
      const refScale = Math.max(...values(ref.deviance).map(Math.abs));
      for (const field of ["logLik", "AIC", "BIC", "deviance", "Chisq", "pValue"] as const) {
        const want = values(ref[field]);
        r[field].forEach((v, i) => {
          const w = want[i]!;
          if (same(v, w)) return;
          const err =
            field === "Chisq" ? Math.abs(v - w) / refScale : field === "pValue" && w < 1e-300 ? Math.abs(v - w) : Math.abs(v - w) / Math.abs(w);
          const tol = field === "pValue" ? TOL_REF_P : TOL_REF_CRITERION;
          if (!(err <= tol)) failures.push(`${where} ${field}[${i}]: ${v}, reference ${w}`);
        });
      }
    });
    console.log(
      `lmerCompare: ${fixture.cases.length} cases, ${withReference} with references; largest relative difference from lme4: ${[...worst].map(([k, v]) => `${k} ${v.toExponential(1)}`).join(", ")}`,
    );
    expect(failures).toEqual([]);
  });

  const data = {
    y: [3.1, 4.0, 5.2, 6.8, 7.1, 8.3, 2.2, 3.5, 3.9, 5.9, 6.1, 7.4, 4.4, 5.0, 6.9, 3.0, 4.1, 4.9],
    x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
    g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d", "e", "e", "e", "f", "f", "f"],
  };

  it("names, the ML refit, and the errors", () => {
    const m1 = lmer("y ~ 1 + (1 | g)", data);
    const m2 = lmer("y ~ x + (1 | g)", data);
    const r = lmerAnova([m2, m1]);
    expect(r.names).toEqual(["MODEL2", "MODEL1"]);
    // the refit is the exact ML optimum: as lmer with REML false
    expect(r.logLik).toEqual([lmer("y ~ 1 + (1 | g)", data, { REML: false }).logLik, lmer("y ~ x + (1 | g)", data, { REML: false }).logLik]);
    expect(r.Chisq[1]).toBeCloseTo(2 * (r.logLik[1]! - r.logLik[0]!), 12);
    const dup = lmerAnova([m1, m2], { names: ["a", "a"] });
    expect(dup.names).toEqual(["MODEL1", "MODEL2"]);
    expect(dup.warnings).toEqual(["failed to find model names, assigning generic names"]);
    const own = lmerAnova([m1, m2], { refit: false });
    expect(own.logLik).toEqual([m1.logLik, m2.logLik]);
    expect(own.messages).toEqual([]);
    expect(() => lmerAnova([m1, lmer("y ~ x + (1 | g)", { ...data })])).toThrow("all models must be fit to the same data object");
    expect(() => lmerAnova([m1])).toThrow(TypeError);
    expect(() => lmerAnova([m1, m2], { names: ["a"] })).toThrow(TypeError);
    expect(() => lmerAnova([m1, { ...m2 }])).toThrow(TypeError);
  });

  it("the ANOVA table of one fit: types, an intercept-only model", () => {
    const fit = lmer("y ~ x + (1 | g)", data);
    expect(lmerAnova(fit, { type: 1 }).type).toBe("I");
    expect(lmerAnova(fit, { type: "II" }).terms).toEqual(["x"]);
    expect(() => lmerAnova(fit, { type: "IV" as "I" })).toThrow(RangeError);
    const t = lmerAnova(fit);
    expect(t.F[0]).toBeCloseTo(lmerAnova(fit, { type: "I" }).F[0]!, 12);
    const one = lmerAnova(lmer("y ~ 1 + (1 | g)", data));
    expect([one.terms, one.F, one.messages]).toEqual([[], [], []]);
  });
});
