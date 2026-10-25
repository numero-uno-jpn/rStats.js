// Shared code of the tests of the analysis of variance with formulas against R (oracle/_anova.R): reading the data
// frames of the fixtures and comparing tables by the rules of oracle/anova-behaviour.md ("Accuracy required, and how
// to test"):
// - a numeric cell passes if it is within a relative 1e-12 of R's value; NaN matches NaN only;
// - in the columns of sums of squares, mean squares and F values, also if it is within 1e-12 times the largest
//   absolute value of that column of the same table;
// - when R warned "ANOVA F-tests on an essentially perfect fit are unreliable", the F value and Pr(>F) cells of that
//   table are not compared;
// - a cell that fails may be listed as a known difference (case, table, row, column, reason) only if it passes the
//   same rules against the exact reference of the fixture. Listed differences that are not needed fail the test too.
// Values outside the tables (coefficients, sigma, R^2) follow the same rules without the column scale; their known
// differences have the field as `table`, the value's name as `row` and an empty `col`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DataFrame } from "../../src/index.js";
import { num, relativeError } from "./fixture.js";

export interface AnovaCase {
  args: Record<string, unknown>;
  expected: Record<string, unknown>;
  reference?: Record<string, unknown>;
}

export function loadAnovaFixture(name: string): { r_version: string; cases: AnovaCase[] } {
  const path = fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as { r_version: string; cases: AnovaCase[] };
}

/**
 * The data frame of a fixture's arguments. The fixtures write numeric columns as strings of numbers ("NA" missing),
 * character columns as strings (null missing) and logical columns as booleans; `types` (the argument `xTypes` next
 * to a data frame argument `x`) gives the type of each column.
 */
export function dataFrameOf(raw: unknown, types: unknown): DataFrame {
  const ty = types as Record<string, "numeric" | "character" | "logical">;
  const out: DataFrame = {};
  for (const [k, col] of Object.entries(raw as Record<string, (string | boolean | null)[]>)) {
    const t = ty[k];
    if (t === undefined) throw new Error(`no type for column ${k}`);
    out[k] = t === "numeric" ? col.map((v) => (v === null ? null : num(v as string))) : col;
  }
  return out;
}

/** A table as written in the fixtures */
export interface FixtureTable {
  colNames?: string[];
  rowNames?: string[];
  table: string[][];
}

/** A table computed by rStats.js */
export interface ActualTable {
  colNames: string[];
  rowNames: string[];
  table: number[][];
}

export interface KnownDifference {
  /** 0-based index of the case in the fixture */
  case: number;
  /** The table (field of the case) */
  table: string;
  row: string;
  col: string;
  reason: string;
}

/** Columns in which a cell also passes within 1e-12 times the column's largest absolute value */
const SCALED = new Set(["Sum Sq", "Mean Sq", "RSS", "Sum of Sq", "Error SS", "MSE", "F value", "F"]);
const TOL = 1e-12;

export class Comparison {
  readonly failures: string[] = [];
  readonly used = new Set<KnownDifference>();
  /** Largest relative error against R over the cells compared, and against the reference over the cells that have one */
  maxRelR = 0;
  maxRelRef = 0;
  /** The same measured as the rules do (with the column scale where it applies) */
  maxRuleR = 0;
  maxRuleRef = 0;
  cells = 0;

  constructor(private readonly known: readonly KnownDifference[]) {}

  fail(index: number, what: string, expected: unknown, actual: unknown): void {
    this.failures.push(`#${index} ${what}: R ${JSON.stringify(expected)} / TS ${JSON.stringify(actual)}`);
  }

  strings(index: number, what: string, expected: unknown, actual: unknown): void {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) this.fail(index, what, expected, actual);
  }

  /**
   * Numbers compared by relative error 1e-12. A value that fails may be a known difference (table = `what`, row = its
   * name in `names` or its index, col "") if it is within a relative 1e-12 of `reference`.
   */
  numbers(index: number, what: string, expected: unknown, actual: unknown, reference?: unknown, names?: readonly string[]): void {
    const flat = (v: unknown): unknown[] => ([] as unknown[]).concat(v).flat(2);
    const e = flat(expected).map((v) => num(v as string));
    const a = flat(actual) as number[];
    const ref = reference === undefined ? undefined : flat(reference).map((v) => num(v as string));
    if (e.length !== a.length) return this.fail(index, what, expected, actual);
    const refOk = ref !== undefined && ref.length === e.length;
    e.forEach((ev, k) => {
      const err = relativeError(a[k]!, ev);
      this.cells++;
      if (Number.isFinite(err)) this.maxRelR = Math.max(this.maxRelR, err);
      let errRef = Infinity;
      if (refOk) {
        errRef = relativeError(a[k]!, ref[k]!);
        if (Number.isFinite(errRef)) {
          this.maxRelRef = Math.max(this.maxRelRef, errRef);
          this.maxRuleRef = Math.max(this.maxRuleRef, errRef);
        }
      }
      if (Number.isFinite(err)) this.maxRuleR = Math.max(this.maxRuleR, err);
      if (err <= TOL) return;
      const row = names?.[k] ?? String(k);
      const listed = this.known.find((x) => x.case === index && x.table === what && x.row === row && x.col === "");
      if (listed !== undefined && errRef <= TOL) {
        this.used.add(listed);
        return;
      }
      const refNote = refOk ? `, reference ${ref[k]} (error ${errRef.toExponential(2)})` : ", no reference";
      this.failures.push(
        `#${index} ${what}[${row}]: R ${ev} / TS ${a[k]} (error ${err.toExponential(2)}${refNote})` +
          (listed !== undefined ? " [listed as a known difference, but not within 1e-12 of the reference]" : ""),
      );
    });
  }

  /** A table: names exactly, cells by the rules above */
  table(index: number, name: string, expected: FixtureTable, actual: ActualTable, reference: FixtureTable | undefined, perfect: boolean): void {
    this.strings(index, `${name}.colNames`, expected.colNames, actual.colNames);
    this.strings(index, `${name}.rowNames`, expected.rowNames, actual.rowNames);
    const cols = expected.colNames ?? [];
    const exp = expected.table.map((r) => r.map(num));
    const ref = reference?.table.map((r) => r.map(num));
    if (exp.length !== actual.table.length || exp.some((r, i) => r.length !== actual.table[i]!.length)) {
      return this.fail(index, `${name}.table (shape)`, expected.table, actual.table);
    }
    const refOk = ref !== undefined && ref.length === exp.length && ref.every((r, i) => r.length === exp[i]!.length);
    const colMax = (t: number[][], j: number): number => t.reduce((m, r) => (Number.isFinite(r[j]!) ? Math.max(m, Math.abs(r[j]!)) : m), 0);
    // the error by the rules: relative, or relative to the column's largest value in the scaled columns
    const ruleError = (t: number[][], i: number, j: number, av: number): number => {
      const ev = t[i]![j]!;
      const rel = relativeError(av, ev);
      if (!SCALED.has(cols[j]!) || !Number.isFinite(av) || !Number.isFinite(ev)) return rel;
      const m = colMax(t, j);
      return m === 0 ? rel : Math.min(rel, Math.abs(av - ev) / m);
    };
    exp.forEach((row, i) => {
      row.forEach((ev, j) => {
        const col = cols[j]!;
        if (perfect && (col === "F value" || col === "Pr(>F)")) return;
        const av = actual.table[i]![j]!;
        this.cells++;
        const rel = relativeError(av, ev);
        if (Number.isFinite(rel)) this.maxRelR = Math.max(this.maxRelR, rel);
        const errR = ruleError(exp, i, j, av);
        if (Number.isFinite(errR)) this.maxRuleR = Math.max(this.maxRuleR, errR);
        let errRef = Infinity;
        if (refOk) {
          const rv = ref[i]![j]!;
          const relRef = relativeError(av, rv);
          if (Number.isFinite(relRef)) this.maxRelRef = Math.max(this.maxRelRef, relRef);
          errRef = ruleError(ref, i, j, av);
          if (Number.isFinite(errRef)) this.maxRuleRef = Math.max(this.maxRuleRef, errRef);
        }
        const rowName = expected.rowNames?.[i] ?? String(i + 1);
        const listed = this.known.find((k) => k.case === index && k.table === name && k.row === rowName && k.col === col);
        if (errR <= TOL) return;
        if (listed !== undefined && errRef <= TOL) {
          this.used.add(listed);
          return;
        }
        const refNote = refOk ? `, reference ${ref[i]![j]} (error ${errRef.toExponential(2)})` : ", no reference";
        this.failures.push(
          `#${index} ${name}[${rowName}, ${col}]: R ${ev} / TS ${av} (error ${errR.toExponential(2)}${refNote})` +
            (listed !== undefined ? " [listed as a known difference, but not within 1e-12 of the reference]" : ""),
        );
      });
    });
  }

  /** Known differences that were not needed */
  unused(): KnownDifference[] {
    return this.known.filter((k) => !this.used.has(k));
  }

  summary(name: string, nCases: number, nErrors: number): string {
    return [
      `${name}: ${nCases} cases (${nErrors} errors verified), ${this.cells} numeric cells`,
      `  max relative error vs R ${this.maxRelR.toExponential(2)} (by the rules ${this.maxRuleR.toExponential(2)}), ` +
        `vs the reference ${this.maxRelRef.toExponential(2)} (by the rules ${this.maxRuleRef.toExponential(2)})`,
      `  ${this.used.size} known differences`,
      ...[...this.used].map((k) => `    #${k.case} ${k.table}[${k.row}${k.col === "" ? "" : `, ${k.col}`}]: ${k.reason}`),
    ].join("\n");
  }
}

/** Warnings collected from several results, each once, in order of first appearance */
export function collectWarnings(...lists: (readonly string[] | undefined)[]): string[] {
  const out: string[] = [];
  for (const l of lists) for (const w of l ?? []) if (!out.includes(w)) out.push(w);
  return out;
}
