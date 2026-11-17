// Mixed-model simulation against the complete public-output fixture, including the RNG state.
import { beforeAll, describe, expect, it } from "vitest";
import { getRandomSeed, setRandomSeed } from "../src/random/rng.js";
import { glmer, type GlmerOptions } from "../src/models/glmer.js";
import { lmer } from "../src/models/lmer.js";
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
  const response = new Set(lhs.match(/[A-Za-z_][\${ch}.]*/g) ?? []);
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
  const cbind = formula.match(/cbind\\(\\s*([A-Za-z_][\\w.]*)\\s*,\\s*([A-Za-z_][\\w.]*)\\s*-\\s*\\1\\s*\\)/);
  if (cbind !== null) {
    const successes = data[cbind[1]!] as Array<number | string | null>;
    const totals = data[cbind[2]!] as Array<number | string | null>;
    data.failures = totals.map((total, i) => total === null || successes[i] === null ? null : Number(total) - Number(successes[i]));
    formula = formula.replace(cbind[0], `cbind(${cbind[1]}, failures)`);
  }
  if (c.kind === "lmer") {
    return { kind: "lmer", fit: lmer(formula, data, { REML: c.fit.REML as boolean }) };
  }
  const options: GlmerOptions = {
    family: c.fit.family as NonNullable<GlmerOptions["family"]>,
    nAGQ: num(c.fit.nAGQ as string),
  };
  if (c.fit.weights !== undefined) options.weights = (c.fit.weights as string[]).map((v) => num(v));
  return { kind: "glmer", fit: glmer(formula, data, options) };
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

function stateOf(raw: string[] | null): Int32Array | null {
  return raw === null ? null : Int32Array.from(raw, (v) => Number(v));
}
function expectState(expected: string[] | null): void {
  if (expected === null) return;
  expect(Array.from(getRandomSeed()), "post-call .Random.seed").toEqual(expected.map(Number));
}
function closeValue(actual: number, expected: number, tolerance: number): boolean {
  if (Number.isNaN(expected) || Number.isNaN(actual)) return Number.isNaN(expected) && Number.isNaN(actual);
  if (actual === expected) return true;
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return Math.abs(actual - expected) <= tolerance * (Math.abs(actual) + Math.abs(expected));
}

describe("simulateLmer and simulateGlmer", () => {
  const prepared: Array<{ fit: ReturnType<typeof lmer> | ReturnType<typeof glmer>; kind: "lmer" | "glmer" }> = [];
  beforeAll(() => {
    for (const c of fixture.cases) prepared.push(makeFit(c));
  }, 120_000);

  for (let ci = 0; ci < fixture.cases.length; ci++) {
    const c = fixture.cases[ci]!;
    it(`case ${ci + 1}: ${c.id} (${c.calls.length} calls)`, () => {
      const { fit, kind } = prepared[ci]!;
      const mismatches: string[] = [];
      for (let k = 0; k < c.calls.length; k++) {
        const call = c.calls[k]!;
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
              if (actual.length !== expected.length) {
                mismatches.push(`${where} ${names[j]}: length ${actual.length}, expected ${expected.length}`);
                continue;
              }
              for (let i = 0; i < expected.length; i++) {
                const e = expected[i];
                const a = actual[i];
                if (Array.isArray(e)) {
                  const pair = a as [number, number];
                  if (!Array.isArray(pair) || pair.length !== 2 || pair[0] !== num(e[0] as string) || pair[1] !== num(e[1] as string)) {
                    mismatches.push(`${where} ${names[j]}[${i}]: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
                  }
                } else {
                  const ev = num(e as string);
                  const av = a as number;
                  const discrete = c.id.includes("poisson") || (c.id.includes("binomial") && !c.id.includes("proportion"));
                  // RNG draws are exact; only the fitted mean/scale round-off is allowed here.
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
      }
      expect(mismatches).toEqual([]);
    });
  }
});
