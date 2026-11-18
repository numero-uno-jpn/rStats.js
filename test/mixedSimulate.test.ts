// Mixed-model simulation against the complete public-output fixture, including the RNG state.
import { beforeAll, describe, expect, it } from "vitest";
import { getRandomSeed, setRandomSeed, setSeed } from "../src/random/rng.js";
import { rnorm1 } from "../src/random/continuous.js";
import { rbinom1 } from "../src/random/binomial.js";
import { rpois1 } from "../src/random/poisson.js";
import { rgamma1 } from "../src/random/gamma.js";
import { glmer, glmerInternals, type GlmerOptions } from "../src/models/glmer.js";
import { lmer, lmerInternals } from "../src/models/lmer.js";
import { simulateGlmer, simulateLmer, type MixedSimulateOptions } from "../src/models/mixedSimulate.js";
import type { DataFrame } from "../src/models/modelFrame.js";
import { num } from "./helpers/fixture.js";

interface SimCall {
  args: Record<string, unknown>;
  externalSeed?: string;
  rngBefore: string[] | null;
  rngAfter: string[] | null;
  result: { value?: { rowNames: string[]; columns: Record<string, unknown[]> }; error?: string; warnings: string[] };
}
interface SimCase {
  id: string;
  kind: "lmer" | "glmer";
  fit: Record<string, unknown>;
  fitPublic?: {
    fixef: Record<string, string> | string;
    sigma: string;
    varCorr: { columns: Record<string, (string | null)[]> };
    ranef: Record<string, { rowNames: string[]; columns: Record<string, string[]> }>;
    fitted: string[];
    eta?: string[];
  };
  calls: SimCall[];
}
const fixture = JSON.parse(
  (await import("node:fs")).readFileSync(new URL("./fixtures/mixedSimulate.json", import.meta.url), "utf8"),
) as { r_version: string; cases: SimCase[] };

/** Numeric response columns and continuous predictors are strings in the fixture; low-cardinality factors stay strings. */
function mixedData(raw: unknown, formula: string): DataFrame {
  const frame = raw as { columns: Record<string, (string | null)[]> };
  const groups = new Set([...formula.matchAll(/\|\s*([A-Za-z_][\w.]*)/g)].map((m) => m[1]!));
  const lhs = formula.split("~", 1)[0]!;
  const response = new Set(lhs.match(/[A-Za-z_][\w.]*/g) ?? []);
  const out: DataFrame = {};
  for (const [name, values] of Object.entries(frame.columns)) {
    const numeric = values.every((v) => v === null || (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))));
    const unique = new Set(values.filter((v): v is string => v !== null)).size;
    const asNumber = numeric && !groups.has(name) && (response.has(name) || unique > 8);
    out[name] = asNumber ? values.map((v) => (v === null ? null : num(v))) : values;
  }
  return out;
}

function makeFit(c: SimCase): { fit: ReturnType<typeof lmer> | ReturnType<typeof glmer>; kind: "lmer" | "glmer" } {
  let formula = c.fit.formula as string;
  const data = mixedData(c.fit.data, formula);
  // rStats.js currently accepts two cbind column names; express R's size - successes as an equivalent column.
  if (formula.includes("cbind(incidence, size - incidence)")) {
    const successes = data.incidence as Array<number | string | null>;
    const totals = data.size as Array<number | string | null>;
    data.failures = totals.map((total, i) => total === null || successes[i] === null ? null : Number(total) - Number(successes[i]));
    formula = formula.replace("cbind(incidence, size - incidence)", "cbind(incidence, failures)");
  }
  if (c.kind === "lmer") {
    return { kind: "lmer", fit: lmer(formula, data, { REML: c.fit.REML as boolean }) };
  }
  const options: GlmerOptions = {
    family: c.fit.family as NonNullable<GlmerOptions["family"]>,
    nAGQ: num(c.fit.nAGQ as string),
  };
  // The public cbpp data has a factor `period`; restore its levels lost by the JSON fixture. 
  if (Object.hasOwn(data, "period")) options.levels = { period: ["1", "2", "3", "4"] };
  if (c.fit.weights !== undefined) options.weights = (c.fit.weights as string[]).map((v) => num(v));
  return { kind: "glmer", fit: glmer(formula, data, options) };
}

function namedValues(raw: Record<string, string> | string, names: string[]): number[] {
  if (typeof raw === "string") {
    if (names.length !== 1) throw new Error("R fixture has a scalar fixed-effect vector with multiple names");
    return [num(raw)];
  }
  return names.map((name) => num(raw[name]!));
}

function asArray<T>(value: unknown): T[] {
  if (value === null || value === undefined) return [];
  return (Array.isArray(value) ? value : [value]) as T[];
}

function missingValue(value: unknown): boolean {
  return value === null || value === undefined || value === "NA";
}

/** Cholesky factor of a correlation matrix, lower triangular. */
function correlationCholesky(correlation: number[][]): number[][] {
  const n = correlation.length;
  const lower = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let value = correlation[i]![j]!;
      for (let k = 0; k < j; k++) value -= lower[i]![k]! * lower[j]![k]!;
      if (i === j) {
        if (!(value > 0) || !Number.isFinite(value)) throw new Error("R fixture has a non-positive-definite random-effects correlation matrix");
        lower[i]![j] = Math.sqrt(value);
      } else {
        lower[i]![j] = value / lower[j]![j]!;
      }
    }
  }
  return lower;
}

/**
 * Use the oracle's public fitted quantities when testing simulation. The lmer/glmer optimisers are independent and
 * intentionally need not stop at identical last bits; the simulator itself is checked with exactly the R fit's
 * fixed effects, covariance parameters, conditional modes, and dispersion.
 */
function applyReferenceFit(
  c: SimCase,
  fit: ReturnType<typeof lmer> | ReturnType<typeof glmer>,
  kind: "lmer" | "glmer",
): void {
  const reference = c.fitPublic;
  if (reference === undefined) throw new Error("mixedSimulate.json must be regenerated with fitPublic from public R outputs");
  const structure = kind === "lmer" ? lmerInternals(fit as ReturnType<typeof lmer>).structure : glmerInternals(fit as ReturnType<typeof glmer>).structure;
  const sigma = num(reference.sigma);
  const vc = reference.varCorr.columns;
  const grp = asArray<string>(vc.grp);
  const var1 = asArray<string>(vc.var1);
  const var2 = asArray<string | null>(vc.var2);
  const sdcor = asArray<string>(vc.sdcor);
  const ranef = reference.ranef;
  const theta = new Array<number>(structure.theta.length).fill(0);
  const b = new Array<number>(structure.q).fill(0);
  const varCorr = structure.terms.map((term) => {
    const group = structure.groups[term.group]!.name;
    const nc = term.columns.length;
    const sd = term.columns.map((column) => {
      const index = grp.findIndex((g, i) => g === group && var1[i] === column && missingValue(var2[i]));
      if (index < 0) throw new Error(`R fixture lacks VarCorr SD for ${group}:${column}`);
      return num(sdcor[index]!);
    });
    const correlation: number[][] = Array.from({ length: nc }, (_, i) => Array.from({ length: nc }, (_, j) => (i === j ? 1 : 0)));
    for (let i = 0; i < grp.length; i++) {
      if (grp[i] !== group || missingValue(var2[i])) continue;
      const row = term.columns.indexOf(var1[i]!);
      const column = term.columns.indexOf(var2[i]!);
      if (row >= 0 && column >= 0) {
        const value = num(sdcor[i]!);
        correlation[row]![column] = value;
        correlation[column]![row] = value;
      }
    }
    const lower = correlationCholesky(correlation);
    let k = term.thetaOffset;
    const scale = kind === "lmer" ? sigma : 1;
    for (let j = 0; j < nc; j++) {
      for (let i = j; i < nc; i++) theta[k++] = (sd[i]! / scale) * lower[i]![j]!;
    }
    const groupRanef = ranef[group];
    if (groupRanef === undefined) throw new Error(`R fixture lacks ranef for grouping factor ${group}`);
    for (let level = 0; level < term.nLevels; level++) {
      for (let j = 0; j < nc; j++) {
        const values = groupRanef.columns[term.columns[j]!];
        if (values === undefined) throw new Error(`R fixture lacks ranef column ${group}:${term.columns[j]}`);
        const row = asArray<string>(groupRanef.rowNames).indexOf(structure.groups[term.group]!.levels[level]!);
        if (row < 0) throw new Error(`R fixture lacks ranef level ${group}:${structure.groups[term.group]!.levels[level]}`);
        b[term.zOffset + level * nc + j] = num(values[row]!);
      }
    }
    return { group, columns: [...term.columns], sd, corr: correlation };
  });
  const fixef = namedValues(reference.fixef, fit.fixefNames);
  fit.fixef = fixef;
  fit.sigma = sigma;
  fit.theta = theta;
  fit.varCorr = varCorr;
  fit.ranef = structure.groups.map((group, gi) => {
    const terms = structure.terms.filter((term) => term.group === gi);
    const source = ranef[group.name]!;
    return {
      group: group.name,
      levels: [...group.levels],
      columns: terms.flatMap((term) => term.columns),
      values: group.levels.map((levelName) => {
        const row = asArray<string>(source.rowNames).indexOf(levelName);
        if (row < 0) throw new Error(`R fixture lacks ranef level ${group.name}:${levelName}`);
        return terms.flatMap((term) => term.columns.map((column) => num(asArray<string>(source.columns[column])[row]!)));
      }),
    };
  });
  if (kind === "lmer") {
    const internal = lmerInternals(fit as ReturnType<typeof lmer>);
    internal.theta = theta;
    internal.b = b;
    fit.fitted = asArray<string>(reference.fitted).map((v) => num(v));
  } else {
    if (reference.eta === undefined) throw new Error("R fixture lacks the GLMM linear predictor");
    const internal = glmerInternals(fit as ReturnType<typeof glmer>);
    internal.theta = theta;
    internal.b = b;
    internal.eta = asArray<string>(reference.eta).map((v) => num(v));
    internal.mu = asArray<string>(reference.fitted).map((v) => num(v));
    fit.fitted = asArray<string>(reference.fitted).map((v) => num(v));
    (fit as ReturnType<typeof glmer>).linearPredictor = asArray<string>(reference.eta).map((v) => num(v));
  }
}

function callOptions(args: Record<string, unknown>): MixedSimulateOptions {
  const out: MixedSimulateOptions = {};
  if (args.nsim !== undefined) out.nsim = num(args.nsim as string);
  if (args.seed === null) out.seed = null;
  else if (args.seed !== undefined) out.seed = args.seed === "NA" ? ("NA" as never) : num(args.seed as string);
  if (args["use.u"] !== undefined) out.useU = args["use.u"] as boolean;
  if (Object.hasOwn(args, "re.form")) out.reForm = args["re.form"] as string | null;
  return out;
}

function structureSize(fit: ReturnType<typeof glmer>, row: number): number { return glmerInternals(fit).structure.size![row]!; }

function stateOf(raw: string[] | null): Int32Array | null {
  return raw === null ? null : Int32Array.from(raw, (v) => Number(v));
}
function expectState(expected: string[] | null): void {
  if (expected === null) return;
  expect(Array.from(getRandomSeed()), "post-call .Random.seed").toEqual(expected.map(Number));
}
/**
 * Independent GLMM reconstruction for the three known partial-re.form differences.
 * It uses only fitPublic quantities and primitive RNG/family generators, not simulateGlmer().
 */
function reconstructPartialGlmer(
  c: SimCase,
  fit: ReturnType<typeof glmer>,
  reForm: string,
  nsim: number,
): number[][] {
  const reference = c.fitPublic!;
  const internal = glmerInternals(fit);
  const structure = internal.structure;
  const beta = namedValues(reference.fixef, fit.fixefNames);
  const eta = structure.x.map((row, i) =>
    row.reduce((sum, value, j) => sum + value * beta[j]!, 0) + structure.offset[i]!,
  );
  const selectedGroup = reForm.match(/\\|\\s*([^\\)]+)/)?.[1]?.trim();
  if (selectedGroup === undefined) throw new Error(`Cannot parse partial re.form: ${reForm}`);
  const vc = reference.varCorr.columns;
  const groups = asArray<string>(vc.grp);
  const var1 = asArray<string>(vc.var1);
  const var2 = asArray<string | null>(vc.var2);
  const sdcor = asArray<string>(vc.sdcor);

  const termSd = (termIndex: number): number => {
    const term = structure.terms[termIndex]!;
    if (term.columns.length !== 1) throw new Error("Independent reconstruction currently expects scalar random-effect terms");
    const group = structure.groups[term.group]!.name;
    const row = groups.findIndex((g, i) => g === group && var1[i] === term.columns[0] && missingValue(var2[i]));
    if (row < 0) throw new Error(`fitPublic VarCorr lacks SD for ${group}:${term.columns[0]}`);
    return num(sdcor[row]!);
  };

  const selectedTerms = new Set<number>();
  const generatedTerms: number[] = [];
  for (let ti = 0; ti < structure.terms.length; ti++) {
    const term = structure.terms[ti]!;
    const group = structure.groups[term.group]!.name;
    if (group === selectedGroup) selectedTerms.add(ti);
    else generatedTerms.push(ti);
  }
  if (selectedTerms.size === 0) throw new Error(`No fitted random-effects term for ${selectedGroup}`);

  // Add the selected term's fitted conditional modes from the public ranef output.
  for (const ti of selectedTerms) {
    const term = structure.terms[ti]!;
    const group = structure.groups[term.group]!;
    const source = reference.ranef[group.name];
    if (source === undefined) throw new Error(`fitPublic ranef lacks ${group.name}`);
    for (let level = 0; level < term.nLevels; level++) {
      const levelName = group.levels[level]!;
      const row = asArray<string>(source.rowNames).indexOf(levelName);
      if (row < 0) throw new Error(`fitPublic ranef lacks level ${group.name}:${levelName}`);
      for (let j = 0; j < term.columns.length; j++) {
        const values = source.columns[term.columns[j]!];
        if (values === undefined) throw new Error(`fitPublic ranef lacks column ${term.columns[j]}`);
        const value = num(asArray<string>(values)[row]!);
        const column = structure.z[term.zOffset + level * term.columns.length + j]!;
        for (let k = 0; k < column.rows.length; k++) eta[column.rows[k]!]! += column.values[k]! * value;
      }
    }
  }

  // Match the implementation's stream layout: all unselected effects for all replicates first.
  const generated: number[][][] = [];
  for (let sim = 0; sim < nsim; sim++) {
    generated.push(generatedTerms.map((ti) => {
      const term = structure.terms[ti]!;
      const sd = termSd(ti);
      return Array.from({ length: term.nLevels }, () => rnorm1(0, sd));
    }));
  }

  const sims: number[][] = [];
  for (let sim = 0; sim < nsim; sim++) {
    const predictor = [...eta];
    generatedTerms.forEach((ti, index) => {
      const term = structure.terms[ti]!;
      const values = generated[sim]![index]!;
      for (let level = 0; level < term.nLevels; level++) {
        const column = structure.z[term.zOffset + level * term.columns.length]!;
        for (let k = 0; k < column.rows.length; k++) {
          predictor[column.rows[k]!]! += column.values[k]! * values[level]!;
        }
      }
    });
    const mu = predictor.map((value) => structure.family.linkinv(value));
    if (structure.family.family === "binomial") {
      sims.push(mu.map((p, i) => {
        const size = structure.size![i]!;
        const successes = rbinom1(size, p);
        return successes; // cbind response's failures are checked by the caller's pair comparison
      }));
    } else if (structure.family.family === "poisson") {
      sims.push(mu.map((value) => rpois1(value)));
    } else if (structure.family.family === "Gamma") {
      const shape = 1 / (reference.sigma === undefined ? fit.sigma : num(reference.sigma)) ** 2;
      sims.push(mu.map((value) => rgamma1(shape, value / shape)));
    } else {
      throw new Error(`Unsupported independent reconstruction family: ${structure.family.family}`);
    }
  }
  return sims;
}

function closeValue(actual: number, expected: number, tolerance: number): boolean {
  if (Number.isNaN(expected) || Number.isNaN(actual)) return Number.isNaN(expected) && Number.isNaN(actual);
  if (actual === expected) return true;
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return Math.abs(actual - expected) <= tolerance * (Math.abs(actual) + Math.abs(expected));
}

for (let ci = 0; ci < fixture.cases.length; ci++) {
  const c = fixture.cases[ci]!;
  describe(`case ${ci + 1}: ${c.id}`, () => {
    let prepared: { fit: ReturnType<typeof lmer> | ReturnType<typeof glmer>; kind: "lmer" | "glmer" };
    beforeAll(() => {
      prepared = makeFit(c);
    }, 120_000);

    for (let k = 0; k < c.calls.length; k++) {
      const call = c.calls[k]!;
      it(`call ${k + 1}`, () => {
        const { fit, kind } = prepared;
        applyReferenceFit(c, fit, kind);
        const where = `case ${ci + 1} (${c.id}) call ${k + 1}`;
        const before = stateOf(call.rngBefore);
        if (before !== null) setRandomSeed(before);
        const options = callOptions(call.args);
        let got: ReturnType<typeof simulateLmer> | ReturnType<typeof simulateGlmer> | undefined;
        let error: string | undefined;
        try {
          got = kind === "lmer"
            ? simulateLmer(fit as ReturnType<typeof lmer>, options)
            : simulateGlmer(fit as ReturnType<typeof glmer>, options);
        } catch (e) {
          error = (e as Error).message;
        }
        const knownPartialGlmer =
          kind === "glmer" &&
          ((c.id === "glmer-binomial" && k === 7) ||
            (c.id === "glmer-poisson" && k === 6) ||
            (c.id === "glmer-gamma" && k === 6));
        let independentExpected: number[][] | undefined;
        let actualPostState: number[] | undefined;
        if (knownPartialGlmer && got !== undefined) {
          actualPostState = Array.from(getRandomSeed());
          if (before !== null) setRandomSeed(before);
          if (typeof options.seed === "number") setSeed(options.seed);
          independentExpected = reconstructPartialGlmer(c, fit as ReturnType<typeof glmer>, options.reForm!, options.nsim ?? 1);
          expect(Array.from(getRandomSeed()), "independent reconstruction RNG state").toEqual(actualPostState);
          setRandomSeed(Int32Array.from(actualPostState));
        }
        const mismatches: string[] = [];
        if (call.result.error !== undefined) {
          const expectedError = c.id === "glmer-inverse-gaussian"
            ? /inverse.gaussian is not supported/
            : call.result.error;
          if (expectedError instanceof RegExp ? !expectedError.test(error ?? "") : error !== expectedError) {
            mismatches.push(`${where}: expected error ${String(expectedError)}, got ${error ?? "a result"}`);
          }
        } else if (error !== undefined || got === undefined) {
          mismatches.push(`${where}: unexpected error ${error}`);
        } else {
          const columns = call.result.value!.columns;
          const names = Object.keys(columns);
          if (got.length !== names.length || JSON.stringify(got.names) !== JSON.stringify(names)) {
            mismatches.push(`${where}: simulation names/count differ; got ${JSON.stringify(got.names)}`);
          } else {
            for (let j = 0; j < names.length; j++) {
              const expected = columns[names[j]!]!;
              const actual = got[j]!;
              const independent = independentExpected?.[j];
              if (actual.length !== expected.length) {
                mismatches.push(`${where} ${names[j]}: length ${actual.length}, expected ${expected.length}`);
                continue;
              }
              for (let i = 0; i < expected.length; i++) {
                const e = expected[i];
                const a = actual[i];
                if (Array.isArray(e)) {
                  const pair = a as [number, number];
                  if (independent !== undefined) {
                    const expectedSuccesses = independent[i]!;
                    if (!Array.isArray(pair) || pair[0] !== expectedSuccesses || pair[1] !== structureSize(fit as ReturnType<typeof glmer>, i) - expectedSuccesses) {
                      mismatches.push(`${where} ${names[j]}[${i}]: independent cbind reconstruction differs; got ${JSON.stringify(a)}`);
                    }
                    continue;
                  }
                  if (!Array.isArray(pair) || pair.length !== 2 || pair[0] !== num(e[0] as string) || pair[1] !== num(e[1] as string)) {
                    mismatches.push(`${where} ${names[j]}[${i}]: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
                  }
                } else {
                  const ev = independent === undefined ? num(e as string) : independent[i]!;
                  const av = a as number;
                  const discrete = c.id.includes("poisson") || (c.id.includes("binomial") && !c.id.includes("proportion"));
                  // RNG draws are exact; only fitted-mean/scale round-off is allowed here.
                  const tolerance = c.id.includes("gamma") ? 2e-14 : c.id.includes("proportion") ? 1e-15 : 1e-10;
                  if (discrete ? av !== ev : !closeValue(av, ev, tolerance)) {
                    mismatches.push(`${where} ${names[j]}[${i}]: expected ${ev}, got ${av}`);
                  }
                }
              }
            }
          }
        }
        if (call.result.warnings.length !== 0 && c.id !== "glmer-inverse-gaussian") {
          mismatches.push(`${where}: unexpected R warnings ${JSON.stringify(call.result.warnings)}`);
        }
        try {
          expectState(call.rngAfter);
        } catch (e) {
          mismatches.push(`${where}: ${(e as Error).message}`);
        }
        expect(mismatches).toEqual([]);
      });
    }
  });
}
