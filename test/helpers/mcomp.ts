// Shared code of the tests of the multiple comparisons against R (oracle/mcomp.R), by the rules of
// oracle/mcomp-behaviour.md ("Accuracy"):
// - strings (methods, labels, warnings, error messages) exactly;
// - numbers within a relative 1e-12 of R; NaN (R's NA) matches NaN only;
// - the Dunnett-type p-values within a relative 1e-10 of the fixture's `reference`, and not compared with R (whose
//   randomised integration is only about 1e-3 accurate);
// - a value that fails against R may be listed as a known difference (case, field, position, reason) only if it is
//   within a relative 1e-12 of the fixture's reference. Listed differences that are not needed fail the test too.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { num, relativeError } from "./fixture.js";

export interface McompCase {
  args: Record<string, unknown>;
  expected: Record<string, unknown>;
  reference?: Record<string, unknown>;
}

export function loadMcompFixture(name: string): { r_version: string; cases: McompCase[] } {
  const path = fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as { r_version: string; cases: McompCase[] };
}

export interface McompKnownDifference {
  case: number;
  field: string;
  /** Position in the flattened field */
  index: number;
  reason: string;
}

const TOL_R = 1e-12;
const TOL_REF = 1e-10;

const flat = (v: unknown): unknown[] => (Array.isArray(v) ? v.flatMap((e) => flat(e)) : [v]);

export class McompComparison {
  readonly failures: string[] = [];
  readonly used = new Set<McompKnownDifference>();
  /** Largest relative error against R (values within the tolerance), against the reference (Dunnett-type p-values),
   *  and of the known differences against their reference */
  maxRelR = 0;
  maxRelRef = 0;
  maxKnownRef = 0;
  values = 0;
  refValues = 0;
  errors = 0;

  constructor(private readonly known: readonly McompKnownDifference[] = []) {}

  strings(index: number, field: string, expected: unknown, actual: unknown): void {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      this.failures.push(`#${index} ${field}: R ${JSON.stringify(expected)} / TS ${JSON.stringify(actual)}`);
    }
  }

  /**
   * Numbers against R; values that fail may be known differences within 1e-12 of `reference`. With `dunnett`, the
   * values are compared with `reference` only, within 1e-10.
   */
  numbers(index: number, field: string, expected: unknown, actual: unknown, reference?: unknown, dunnett = false): void {
    const e = flat(expected).map((v) => num(v as string));
    const a = flat(actual) as number[];
    const ref = reference === undefined ? undefined : flat(reference).map((v) => num(v as string));
    if (e.length !== a.length || (ref !== undefined && ref.length !== a.length) || (dunnett && ref === undefined)) {
      this.failures.push(`#${index} ${field} (length or reference): R ${JSON.stringify(expected)} / TS ${JSON.stringify(actual)}`);
      return;
    }
    a.forEach((av, k) => {
      if (dunnett) {
        const err = relativeError(av, ref![k]!);
        this.refValues++;
        if (Number.isFinite(err)) this.maxRelRef = Math.max(this.maxRelRef, err);
        if (err <= TOL_REF) return;
        this.failures.push(`#${index} ${field}[${k}]: reference ${ref![k]} / TS ${av} (error ${err.toExponential(2)})`);
        return;
      }
      const err = relativeError(av, e[k]!);
      this.values++;
      if (err <= TOL_R) {
        this.maxRelR = Math.max(this.maxRelR, err);
        return;
      }
      const listed = this.known.find((d) => d.case === index && d.field === field && d.index === k);
      const errRef = ref === undefined ? Infinity : relativeError(av, ref[k]!);
      if (listed !== undefined && errRef <= TOL_R) {
        this.used.add(listed);
        this.maxKnownRef = Math.max(this.maxKnownRef, errRef);
        return;
      }
      const refNote = ref === undefined ? "no reference" : `reference ${ref[k]} (error ${errRef.toExponential(2)})`;
      this.failures.push(
        `#${index} ${field}[${k}]: R ${e[k]} / TS ${av} (error ${err.toExponential(2)}, ${refNote})` +
          (listed !== undefined ? " [listed as a known difference, but not within 1e-12 of the reference]" : ""),
      );
    });
  }

  /** A case on which R raised an error: the same message */
  error(index: number, expected: string, run: () => unknown): void {
    try {
      run();
      this.failures.push(`#${index}: R raised "${expected}", TS returned a result`);
    } catch (e) {
      this.errors++;
      this.strings(index, "error", expected, (e as Error).message);
    }
  }

  check(name: string, nCases: number): void {
    const unused = this.known.filter((d) => !this.used.has(d));
    const reasons = new Map<string, number>();
    for (const d of this.used) reasons.set(d.reason, (reasons.get(d.reason) ?? 0) + 1);
    console.log(
      [
        `${name}: ${nCases} cases (${this.errors} errors verified), ${this.values} values compared with R, ${this.refValues} Dunnett-type with the reference`,
        `  max relative error vs R ${this.maxRelR.toExponential(2)}, vs the reference ${this.maxRelRef.toExponential(2)}`,
        `  ${this.used.size} known differences (max relative error vs the reference ${this.maxKnownRef.toExponential(2)})`,
        ...[...reasons].map(([r, n]) => `    ${n}: ${r}`),
      ].join("\n"),
    );
    expect(this.failures, this.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(unused, "known differences not needed").toEqual([]);
  }
}
