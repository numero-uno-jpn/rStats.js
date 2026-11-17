// Mixed-model confidence intervals against every supported call in mixedConfint.json.
import { beforeAll, describe, expect, it } from "vitest";
import { confintGlmer, confintLmer, type MixedConfintOptions } from "../src/models/mixedConfint.js";
import { glmer, glmerInternals, type GlmerOptions } from "../src/models/glmer.js";
import { lmer, lmerInternals } from "../src/models/lmer.js";
import type { DataFrame } from "../src/models/modelFrame.js";
import { num } from "./helpers/fixture.js";

interface ConfCall {
  args: Record<string, unknown>;
  result: {
    error?: string;
    warnings: string[];
    value?: { dim: number[]; rowNames: string[] | string | null; rows: string[][] };
  };
}
interface ConfCase {
  id: string;
  kind: "lmer" | "glmer";
  fit: Record<string, unknown>;
  fitPublic?: {
    fixef: Record<string, string>;
    stdError: Record<string, string>;
    sigma?: string;
    varCorr: { columns: Record<string, (string | null)[]> };
  };
  calls: ConfCall[];
}
const fixture = JSON.parse(
  (await import("node:fs")).readFileSync(new URL("./fixtures/mixedConfint.json", import.meta.url), "utf8"),
) as { r_version: string; cases: ConfCase[] };

function mixedData(raw: unknown, formula: string): DataFrame {
  const frame = raw as { columns: Record<string, (string | null)[]> };
  const groups = new Set([...formula.matchAll(/\|\s*([A-Za-z_][\w.]*)/g)].map((m) => m[1]!));
  const slopes = new Set([...formula.matchAll(/\(([^|]+)\|/g)]
    .flatMap((m) => (m[1]!.match(/[A-Za-z_][\w.]*/g) ?? []).filter((v) => v !== "0" && v !== "1")));
  const lhs = formula.split("~", 1)[0]!;
  const response = new Set(lhs.match(/[A-Za-z_][\w.]*/g) ?? []);
  const out: DataFrame = {};
  for (const [name, values] of Object.entries(frame.columns)) {
    const numeric = values.every((v) => v === null || (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))));
    const unique = new Set(values.filter((v): v is string => v !== null)).size;
    const asNumber = numeric && !groups.has(name) && (response.has(name) || slopes.has(name) || unique > 8);
    out[name] = asNumber ? values.map((v) => (v === null ? null : num(v))) : values;
  }
  return out;
}

function makeFit(c: ConfCase): { fit: ReturnType<typeof lmer> | ReturnType<typeof glmer>; kind: "lmer" | "glmer" } {
  let formula = c.fit.formula as string;
  const data = mixedData(c.fit.data, formula);
  // rStats.js currently accepts two cbind column names; express R's size - successes as an equivalent column.
  if (formula.includes("cbind(incidence, size - incidence)")) {
    const successes = data.incidence as Array<number | string | null>;
    const totals = data.size as Array<number | string | null>;
    data.failures = totals.map((total, i) => total === null || successes[i] === null ? null : Number(total) - Number(successes[i]));
    formula = formula.replace("cbind(incidence, size - incidence)", "cbind(incidence, failures)");
  }
  if (c.kind === "lmer") return { kind: "lmer", fit: lmer(formula, data, { REML: c.fit.REML as boolean }) };
  const options: GlmerOptions = {
    family: c.fit.family as NonNullable<GlmerOptions["family"]>,
    nAGQ: num(c.fit.nAGQ as string),
  };
  // The public cbpp data has a factor `period`; restore its levels lost by the JSON fixture. 
  if (Object.hasOwn(data, "period")) options.levels = { period: ["1", "2", "3", "4"] };
  if (c.fit.weights !== undefined) options.weights = (c.fit.weights as string[]).map((v) => num(v));
  return { kind: "glmer", fit: glmer(formula, data, options) };
}

function missingValue(value: unknown): boolean {
  return value === null || value === undefined || value === "NA";
}

/** Replace only public fit summaries with lme4's public outputs; the model structure and deviance remain rStats.js's. */
function applyReferenceFit(
  c: ConfCase,
  fit: ReturnType<typeof lmer> | ReturnType<typeof glmer>,
  kind: "lmer" | "glmer",
): void {
  const reference = c.fitPublic;
  if (reference === undefined) throw new Error("mixedConfint.json must be regenerated with fitPublic from public R outputs");
  const structure = kind === "lmer"
    ? lmerInternals(fit as ReturnType<typeof lmer>).structure
    : glmerInternals(fit as ReturnType<typeof glmer>).structure;
  const vc = reference.varCorr.columns;
  fit.fixef = fit.fixefNames.map((name) => num(reference.fixef[name]!));
  fit.coefTable.stdError = fit.fixefNames.map((name) => num(reference.stdError[name]!));
  if (kind === "lmer") fit.sigma = num(reference.sigma!);
  fit.varCorr = structure.terms.map((term) => {
    const group = structure.groups[term.group]!.name;
    const sd = term.columns.map((column) => {
      const i = vc.grp!.findIndex((g, j) =>
        g === group && vc.var1![j] === column && missingValue(vc.var2![j]));
      if (i < 0) throw new Error(`R fixture lacks VarCorr SD for ${group}:${column}`);
      return num(vc.sdcor![i] as string);
    });
    const corr = Array.from({ length: term.columns.length }, (_, i) =>
      Array.from({ length: term.columns.length }, (_, j) => (i === j ? 1 : 0)));
    for (let i = 0; i < (vc.grp?.length ?? 0); i++) {
      if (vc.grp![i] !== group || missingValue(vc.var2![i])) continue;
      const row = term.columns.indexOf(vc.var1![i] as string);
      const column = term.columns.indexOf(vc.var2![i] as string);
      if (row >= 0 && column >= 0) {
        const value = num(vc.sdcor![i] as string);
        corr[row]![column] = value;
        corr[column]![row] = value;
      }
    }
    return { group, columns: [...term.columns], sd, corr };
  });
}

function optionsOf(raw: Record<string, unknown>): MixedConfintOptions {
  const options: MixedConfintOptions = {};
  if (raw.level !== undefined) options.level = num(raw.level as string);
  if (raw.method !== undefined) options.method = raw.method as "profile" | "Wald";
  if (raw.parm !== undefined) options.parm = raw.parm as string;
  if (raw.signames !== undefined) options.signames = raw.signames as boolean;
  return options;
}
function sameNumber(actual: number, expected: number, tolerance: number): boolean {
  if (Number.isNaN(expected) || Number.isNaN(actual)) return Number.isNaN(expected) && Number.isNaN(actual);
  if (actual === expected) return true;
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return Math.abs(actual - expected) <= tolerance * (Math.abs(actual) + Math.abs(expected));
}

describe("confintLmer and confintGlmer", () => {
  const prepared: Array<{ fit: ReturnType<typeof lmer> | ReturnType<typeof glmer>; kind: "lmer" | "glmer" }> = [];
  let sleepstudyProfileError: string | undefined;
  let cbppProfile: ReturnType<typeof confintGlmer> | undefined;
  let cbppProfileError: string | undefined;
  beforeAll(() => {
    for (const c of fixture.cases) prepared.push(makeFit(c));
    const index = fixture.cases.findIndex((c) => c.id === "sleepstudy-profile-default");
    if (index >= 0) {
      try {
        confintLmer(prepared[index]!.fit as ReturnType<typeof lmer>, { method: "profile" });
      } catch (e) {
        sleepstudyProfileError = (e as Error).message;
      }
    }
    const cbppIndex = fixture.cases.findIndex((c) => c.id === "cbpp-laplace");
    if (cbppIndex >= 0) {
      try {
        cbppProfile = confintGlmer(prepared[cbppIndex]!.fit as ReturnType<typeof glmer>, { method: "profile", parm: ".sig01" });
      } catch (e) {
        cbppProfileError = (e as Error).message;
      }
    }
  }, 120_000);

  for (let ci = 0; ci < fixture.cases.length; ci++) {
    const c = fixture.cases[ci]!;
    it(`case ${ci + 1}: ${c.id} (${c.calls.length} calls)`, () => {
      const { fit, kind } = prepared[ci]!;
      applyReferenceFit(c, fit, kind);
      const mismatches: string[] = [];
      if (c.id === "sleepstudy-profile-default" && sleepstudyProfileError !== undefined) {
        mismatches.push(`profile precomputation: ${sleepstudyProfileError}`);
      }
      if (c.id === "cbpp-laplace") {
        if (cbppProfileError !== undefined) mismatches.push(`glmer profile: ${cbppProfileError}`);
        if (cbppProfile === undefined || cbppProfile.names[0] !== ".sig01" || !Number.isFinite(cbppProfile.lower[0]) || !Number.isFinite(cbppProfile.upper[0])) {
          mismatches.push("glmer profile: expected a finite .sig01 interval for nAGQ=1");
        }
      }
      for (let k = 0; k < c.calls.length; k++) {
        const call = c.calls[k]!;
        const where = `case ${ci + 1} (${c.id}) call ${k + 1}`;
        const raw = call.args;
        const nAGQ = kind === "glmer" ? (fit as ReturnType<typeof glmer>).nAGQ : 1;
        const unsupported = Object.hasOwn(raw, "maxpts") || Object.hasOwn(raw, "zeta");
        if (unsupported && !(kind === "glmer" && raw.method === "profile" && nAGQ !== 1)) {
          let error: string | undefined;
          try {
            const bad = { ...optionsOf(raw), ...(raw.maxpts !== undefined ? { maxpts: num(raw.maxpts as string) } : {}), ...(raw.zeta !== undefined ? { zeta: num(raw.zeta as string) } : {}) };
            if (kind === "lmer") confintLmer(fit as ReturnType<typeof lmer>, bad as never);
            else confintGlmer(fit as ReturnType<typeof glmer>, bad as never);
          } catch (e) { error = (e as Error).message; }
          if (error === undefined || !/maxpts|zeta/i.test(error)) {
            mismatches.push(`${where}: expected an explicit unsupported-option error, got ${error ?? "a result"}`);
          }
          continue;
        }
        const options = optionsOf(raw);
        let got: ReturnType<typeof confintLmer> | ReturnType<typeof confintGlmer> | undefined;
        let error: string | undefined;
        try {
          got = kind === "lmer"
            ? confintLmer(fit as ReturnType<typeof lmer>, options)
            : confintGlmer(fit as ReturnType<typeof glmer>, options);
        } catch (e) { error = (e as Error).message; }
        if (kind === "glmer" && raw.method === "profile" && nAGQ !== 1) {
          if (!/nAGQ = 1/.test(error ?? "")) mismatches.push(`${where}: expected the nAGQ restriction, got ${error ?? "a result"}`);
          continue;
        }
        if (call.result.error !== undefined) {
          if (error !== call.result.error) mismatches.push(`${where}: expected error ${call.result.error}, got ${error ?? "a result"}`);
          continue;
        }
        if (error !== undefined || got === undefined) {
          mismatches.push(`${where}: unexpected error ${error}`);
          continue;
        }
        const expected = call.result.value!;
        const expectedNames = expected.rowNames === null ? [] : Array.isArray(expected.rowNames) ? expected.rowNames : [expected.rowNames];
        if (JSON.stringify(got.names) !== JSON.stringify(expectedNames)) {
          mismatches.push(`${where}: names ${JSON.stringify(got.names)} / R ${JSON.stringify(expectedNames)}`);
        }
        if (got.lower.length !== expected.rows.length || got.upper.length !== expected.rows.length) {
          mismatches.push(`${where}: interval dimensions differ`);
          continue;
        }
        // REML profile intervals are centred on the ML fit. Their equality to the ML call is checked
        // directly below; the ML case is compared with the public R interval using its public fit values.
        if (kind === "lmer" && (fit as ReturnType<typeof lmer>).REML && raw.method !== "Wald") {
          const mlCase = { ...c, id: "sleepstudy-ml", fit: { ...c.fit, REML: false } };
          const mlFit = makeFit(mlCase).fit as ReturnType<typeof lmer>;
          const mlResult = confintLmer(mlFit, options);
          if (JSON.stringify(got.names) !== JSON.stringify(mlResult.names) ||
              JSON.stringify(got.lower) !== JSON.stringify(mlResult.lower) ||
              JSON.stringify(got.upper) !== JSON.stringify(mlResult.upper)) {
            mismatches.push(`${where}: REML profile is not identical to the ML profile`);
          }
          continue;
        }
        // Our bracket is refined to 2e-10 in parameter space; R returns an interpolated profile-grid endpoint.
        const tolerance = raw.method === "Wald" || raw.level === "1.1000000000000001" ? 2e-12 : 2e-10;
        for (let i = 0; i < expected.rows.length; i++) {
          const lo = num(expected.rows[i]![0]!);
          const hi = num(expected.rows[i]![1]!);
          if (!sameNumber(got.lower[i]!, lo, tolerance)) mismatches.push(`${where} ${expectedNames[i]} lower: R ${lo}, got ${got.lower[i]}`);
          if (!sameNumber(got.upper[i]!, hi, tolerance)) mismatches.push(`${where} ${expectedNames[i]} upper: R ${hi}, got ${got.upper[i]}`);
        }
        const comparableWarnings = call.result.warnings.filter((w) => w === "NaNs produced" || w === "NAs detected in profiling" || w.startsWith("Nothing selected by"));
        if (JSON.stringify(got.warnings) !== JSON.stringify(comparableWarnings)) {
          mismatches.push(`${where}: warnings ${JSON.stringify(got.warnings)} / comparable R warnings ${JSON.stringify(comparableWarnings)}`);
        }
      }
      if (c.id === "sleepstudy-profile-default") {
        const unknown = confintLmer(fit as ReturnType<typeof lmer>, { method: "profile", parm: "not-a-parameter" });
        if (unknown.names.length !== 0 || unknown.warnings[0] !== `Nothing selected by 'which="not-a-parameter"'`) {
          mismatches.push("unknown parm: expected an empty result and R's warning");
        }
      }
      expect(c.calls.length).toBeGreaterThan(0);
      expect(mismatches, mismatches.join("\n")).toEqual([]);
    });
  }
});
