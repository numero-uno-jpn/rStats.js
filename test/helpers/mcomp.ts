// Shared code of the tests of the multiple comparisons against R (oracle/mcomp.R), by the rules of
// oracle/mcomp-behaviour.md ("Accuracy"):
// - strings (methods, labels, warnings, error messages) exactly;
// - numbers within a relative 1e-12 of R; NaN (R's NA) matches NaN only;
// - the Dunnett-type p-values (the fields that have a `reference` in the fixture) within a relative 1e-10 of the
//   reference, and not compared with R (whose randomised integration is only about 1e-3 accurate);
// - the specification allows a known difference only within a relative 1e-12 of a reference, and the fixtures have
//   references only for the Dunnett-type p-values, so no value compared with R can be a known difference. Values that
//   disagree with R for a reason outside rStats.js and have no reference are listed as unverified (case, field,
//   position, reason): printed, and failing the test when not needed. They are not accepted by the specification and
//   wait for references in the fixture.

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

/** A value that disagrees with R by more than the tolerance and has no reference to be checked against */
export interface McompUnverified {
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
  readonly used = new Set<McompUnverified>();
  /** Largest relative error against R over the values within the tolerance, and over the unverified ones */
  maxRelR = 0;
  maxUnverified = 0;
  maxRelRef = 0;
  values = 0;
  refValues = 0;
  errors = 0;

  constructor(private readonly unverified: readonly McompUnverified[] = []) {}

  strings(index: number, field: string, expected: unknown, actual: unknown): void {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      this.failures.push(`#${index} ${field}: R ${JSON.stringify(expected)} / TS ${JSON.stringify(actual)}`);
    }
  }

  /** Numbers against R, or (when `reference` is given) against the reference only */
  numbers(index: number, field: string, expected: unknown, actual: unknown, reference?: unknown): void {
    const e = flat(expected).map((v) => num(v as string));
    const a = flat(actual) as number[];
    const ref = reference === undefined ? undefined : flat(reference).map((v) => num(v as string));
    if (e.length !== a.length || (ref !== undefined && ref.length !== a.length)) {
      this.failures.push(`#${index} ${field} (length): R ${JSON.stringify(expected)} / TS ${JSON.stringify(actual)}`);
      return;
    }
    a.forEach((av, k) => {
      if (ref !== undefined) {
        const err = relativeError(av, ref[k]!);
        this.refValues++;
        if (Number.isFinite(err)) this.maxRelRef = Math.max(this.maxRelRef, err);
        if (err <= TOL_REF) return;
        this.failures.push(`#${index} ${field}[${k}]: reference ${ref[k]} / TS ${av} (error ${err.toExponential(2)})`);
        return;
      }
      const err = relativeError(av, e[k]!);
      this.values++;
      if (err <= TOL_R) {
        this.maxRelR = Math.max(this.maxRelR, err);
        return;
      }
      const listed = this.unverified.find((d) => d.case === index && d.field === field && d.index === k);
      if (listed !== undefined) {
        this.used.add(listed);
        this.maxUnverified = Math.max(this.maxUnverified, err);
        return;
      }
      this.failures.push(`#${index} ${field}[${k}]: R ${e[k]} / TS ${av} (error ${err.toExponential(2)}, no reference)`);
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
    const unused = this.unverified.filter((d) => !this.used.has(d));
    console.log(
      [
        `${name}: ${nCases} cases (${this.errors} errors verified), ${this.values} values compared with R, ${this.refValues} with the reference`,
        `  max relative error vs R ${this.maxRelR.toExponential(2)}, vs the reference ${this.maxRelRef.toExponential(2)}`,
        ...(this.used.size > 0
          ? [
              `  ${this.used.size} values unverified (disagree with R, no reference in the fixture; up to ` +
                `${this.maxUnverified.toExponential(2)} from R): cases ${[...new Set([...this.used].map((d) => d.case))].join(", ")}`,
              ...[...new Set([...this.used].map((d) => d.reason))].map((r) => `    ${r}`),
            ]
          : []),
      ].join("\n"),
    );
    expect(this.failures, this.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(unused, "unverified values listed but not needed").toEqual([]);
  }
}
