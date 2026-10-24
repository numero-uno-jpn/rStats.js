import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { num, relativeError } from "./fixture.js";
import { precisionMode, summarize, writePrecision } from "./precision.js";

/** Argument of a hypothesis-test fixture (arg_json in oracle/_htest.R). Numbers are strings; vectors and matrices are arrays of strings. */
export type HTestArg = string | boolean | string[] | string[][];
type Expected = string | string[] | string[][];

export interface HTestCase {
  args: Record<string, HTestArg>;
  /** Expected fields (htest_fields). Inputs on which R raised an error have { error }. */
  expected: Record<string, Expected>;
  /** High-precision reference values (computed with Rmpfr; used where R itself is inaccurate; absent in some fixtures) */
  reference?: Record<string, Expected>;
}

interface HTestFixture {
  function: string;
  r_version: string;
  cases: HTestCase[];
}

/** Name and string fields (compared exactly). Other fields are compared numerically by relative error. */
const STRING_FIELDS = new Set([
  "method",
  "alternative",
  "statisticName",
  "parameterName",
  "estimateNames",
  "nullValueName",
  // labels (TukeyHSD comparisons, rows and columns of the pairwise tables)
  "names",
  "rowNames",
  "colNames",
  // levels of chisqTest's factors
  "rowLevels",
  "colLevels",
]);

export function loadHTestFixture(name: string): HTestFixture {
  const path = fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as HTestFixture;
}

/** Argument accessors. Return undefined when the argument is omitted. */
export const arg = {
  num(a: HTestArg | undefined): number | undefined {
    if (a === undefined) return undefined;
    if (typeof a !== "string") throw new Error(`not a number: ${JSON.stringify(a)}`);
    return num(a);
  },
  /** Numeric vector (a length-1 vector may be written by R as a single number, so that is accepted too) */
  vec(a: HTestArg | undefined): number[] | undefined {
    if (a === undefined) return undefined;
    if (typeof a === "string") return [num(a)];
    if (!Array.isArray(a)) throw new Error(`not an array: ${JSON.stringify(a)}`);
    return (a as string[]).map((v) => num(v));
  },
  mat(a: HTestArg | undefined): number[][] | undefined {
    if (a === undefined) return undefined;
    return (a as string[][]).map((row) => row.map((v) => num(v)));
  },
  str<T extends string = string>(a: HTestArg | undefined): T | undefined {
    if (a === undefined) return undefined;
    if (typeof a !== "string") throw new Error(`not a string: ${JSON.stringify(a)}`);
    return a as T;
  },
  bool(a: HTestArg | undefined): boolean | undefined {
    if (a === undefined) return undefined;
    if (typeof a !== "boolean") throw new Error(`not a logical: ${JSON.stringify(a)}`);
    return a;
  },
};

/** Options with undefined fields removed (for exactOptionalPropertyTypes) */
export function defined<T extends object>(o: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as never;
}

export interface HTestSpec {
  name: string;
  call: (args: HTestCase["args"]) => object;
  /** Relative error tolerance for numeric fields (can be overridden per field with fieldTolerance) */
  tolerance: number;
  fieldTolerance?: Record<string, number>;
  /**
   * Per-field absolute error floor. The error is measured as |diff| / max(|expected|, floor).
   * Used for fields whose near-zero values come from cancellation (e.g. interval endpoints that cancel
   * against the null value). Pass a function to choose it per case.
   */
  floor?: Record<string, number | ((c: HTestCase) => number)>;
  /** Cases that intentionally differ from R. Those for which this returns a reason are excluded, and counts and reasons are printed (also documented in docs/differences-from-r.md). */
  knownDifference?: (args: HTestCase["args"], field: string, expected: number, actual: number) => string | undefined;
  /**
   * Replaces the expected values of cases on which rStats.js deliberately does not reproduce R's result (e.g. an R
   * error caused by a bug): returns the case to compare with instead, and a reason that is printed with the count.
   */
  substitute?: (c: HTestCase, cases: HTestCase[]) => { expected: HTestCase["expected"]; reason: string } | undefined;
}

function flatten(v: unknown): unknown[] {
  return Array.isArray(v) ? v.flatMap((e) => flatten(e)) : [v];
}

interface FieldMismatch {
  index: number;
  field: string;
  expected: unknown;
  actual: unknown;
  relError?: number;
}

export function htestSuite(spec: HTestSpec): void {
  const fixture = loadHTestFixture(spec.name);
  describe(spec.name, () => {
    it(`matches R (${fixture.r_version})`, () => {
      const mismatches: FieldMismatch[] = [];
      const worst = new Map<string, number>();
      const worstRef = new Map<string, number>();
      const reasons = new Map<string, number>();
      const moreAccurate = new Set<number>();
      let errors = 0;
      // Per-value error of numeric fields against the closer of R and the reference value (for precision comparison)
      const allErrors: number[] = [];
      const t0 = performance.now();
      fixture.cases.forEach((c0, index) => {
        let c = c0;
        const sub = spec.substitute?.(c0, fixture.cases);
        if (sub !== undefined) {
          c = { args: c0.args, expected: sub.expected };
          reasons.set(sub.reason, (reasons.get(sub.reason) ?? 0) + 1);
        }
        let actual: Record<string, unknown>;
        try {
          actual = spec.call(c.args) as Record<string, unknown>;
        } catch (e) {
          if (c.expected.error !== undefined) errors++;
          else mismatches.push({ index, field: "(exception)", expected: "result", actual: String(e) });
          return;
        }
        if (c.expected.error !== undefined) {
          mismatches.push({ index, field: "(exception)", expected: c.expected.error, actual: "no exception thrown" });
          return;
        }
        for (const [field, exp] of Object.entries(c.expected)) {
          const act = actual[field];
          if (STRING_FIELDS.has(field)) {
            if (JSON.stringify(exp) !== JSON.stringify(act)) mismatches.push({ index, field, expected: exp, actual: act });
            continue;
          }
          const e = flatten(exp).map((v) => num(v as string));
          const a = flatten(act);
          // Values that disagree with R are compared with the high-precision reference (ref from the oracle)
          const refRaw = c.reference?.[field];
          const ref = refRaw === undefined ? undefined : flatten(refRaw).map((v) => num(v as string));
          if (e.length !== a.length) {
            // a known difference may also change the length (e.g. R's NA and NaN counted apart)
            const r = spec.knownDifference?.(c.args, field, NaN, NaN);
            if (r !== undefined) reasons.set(r, (reasons.get(r) ?? 0) + 1);
            else mismatches.push({ index, field, expected: exp, actual: act });
            continue;
          }
          const tol = spec.fieldTolerance?.[field] ?? spec.tolerance;
          const fl = spec.floor?.[field] ?? 0;
          const floor = typeof fl === "function" ? fl(c) : fl;
          const errorOf = (av: number, ev: number): number => {
            const err = relativeError(av, ev);
            if (floor > 0 && Number.isFinite(av) && Number.isFinite(ev)) {
              return Math.min(err, Math.abs(av - ev) / Math.max(Math.abs(ev), floor));
            }
            return err;
          };
          e.forEach((ev, k) => {
            const av = a[k] as number;
            const err = errorOf(av, ev);
            const rv0 = ref?.[k];
            allErrors.push(rv0 === undefined ? err : Math.min(err, errorOf(av, rv0)));
            if (err <= tol) {
              worst.set(field, Math.max(worst.get(field) ?? 0, err));
              return;
            }
            const rv = ref?.[k];
            if (rv !== undefined && errorOf(av, rv) <= tol) {
              moreAccurate.add(index);
              worstRef.set(field, Math.max(worstRef.get(field) ?? 0, errorOf(av, rv)));
              return;
            }
            const r = spec.knownDifference?.(c.args, field, ev, av);
            if (r !== undefined) {
              reasons.set(r, (reasons.get(r) ?? 0) + 1);
              return;
            }
            mismatches.push({ index, field, expected: ev, actual: av, relError: err });
          });
        }
      });
      const lines = [
        `${spec.name}: ${fixture.cases.length} cases (exception verified for ${errors} inputs on which R raised an error)`,
        `  max relative error vs R (passing values): ${[...worst].map(([f, v]) => `${f} ${v.toExponential(1)}`).join(", ")}`,
        ...(moreAccurate.size > 0
          ? [
              `  ${moreAccurate.size} disagree with R but match the reference (more accurate than R): ` +
                [...worstRef].map(([f, v]) => `${f} ${v.toExponential(1)}`).join(", "),
            ]
          : []),
        ...[...reasons].map(([r, n]) => `  ${n} known differences: ${r}`),
      ];
      console.log(lines.join("\n"));
      // Dump all mismatching cases (for investigation; not committed)
      const dump = fileURLToPath(new URL(`../fixtures/${spec.name}.mismatch.json`, import.meta.url));
      if (mismatches.length > 0) {
        writeFileSync(dump, mismatches.map((m) => JSON.stringify({ ...m, args: fixture.cases[m.index]!.args })).join("\n"));
      } else rmSync(dump, { force: true });
      const shown = mismatches
        .slice(0, 20)
        .map(
          (m) =>
            `#${m.index} ${m.field}: R ${JSON.stringify(m.expected)} / TS ${JSON.stringify(m.actual)}` +
            (m.relError === undefined ? "" : ` (rel ${m.relError.toExponential(2)})`) +
            `\n    args ${JSON.stringify(fixture.cases[m.index]!.args).slice(0, 300)}`,
        );
      if (precisionMode !== undefined) {
        writePrecision(summarize(spec.name, allErrors, mismatches.length, performance.now() - t0));
        return;
      }
      expect(mismatches.length, `${mismatches.length} mismatch(es)\n${shown.join("\n")}`).toBe(0);
    });
  });
}
