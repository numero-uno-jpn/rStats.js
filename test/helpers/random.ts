import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runif, setSeed } from "../../src/index.js";
import { num, relativeError } from "./fixture.js";
import { precisionMode, summarize, writePrecision } from "./precision.js";

/** One random-number fixture case (rcase in oracle/_random.R) */
export interface RandomCase {
  seed: string;
  args: Record<string, string | string[] | boolean>;
  /** Random numbers generated right after set.seed(seed) (long sequences are summarized) */
  expected: string[];
  /** The following runif(1); checks that the same number of random draws was consumed */
  next: string;
}

interface RandomFixture {
  function: string;
  r_version: string;
  platform: string;
  cases: RandomCase[];
}

function loadRandomFixture(name: string): RandomFixture {
  const path = fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as RandomFixture;
}

/** Summary of a long sequence (same as summ in oracle/random.R: sum, index-weighted sum, last 5 values) */
export function summary(v: number[]): number[] {
  let s = 0;
  let w = 0;
  for (let i = 0; i < v.length; i++) {
    s += v[i]!;
    w += v[i]! * (i + 1);
  }
  return [s, w, ...v.slice(-5)];
}

/** Numeric values of a fixture argument (array of numbers) */
export function nums(v: string | string[] | boolean | undefined): number[] {
  if (!Array.isArray(v)) throw new Error(`not an array: ${String(v)}`);
  return v.map((s) => num(s));
}

export interface RandomSpec {
  /** Fixture name */
  name: string;
  /** Generates the same random numbers as R from the case arguments (setSeed is called by the caller) */
  call: (args: RandomCase["args"]) => number[];
  /**
   * Allowed relative error (default 0 = exact match). Summation order may differ from R, so for summarized
   * cases 1e-13 is allowed for the two sums only
   */
  tolerance?: number;
  /** Whether the case compares a summary */
  isSummary?: (args: RandomCase["args"]) => boolean;
}

export function randomSuite(specs: RandomSpec[]): void {
  for (const spec of specs) {
    const fixture = loadRandomFixture(spec.name);
    describe(spec.name, () => {
      it(`produces the same random sequence as R (${fixture.r_version}, ${fixture.platform})`, () => {
        const failures: string[] = [];
        let values = 0;
        let maxRel = 0;
        const errors: number[] = [];
        const t0 = performance.now();
        for (const c of fixture.cases) {
          setSeed(num(c.seed));
          const actual = spec.call(c.args);
          const next = runif(1)[0]!;
          const expected = c.expected.map(num);
          const summarized = spec.isSummary?.(c.args) ?? false;
          let ok = actual.length === expected.length;
          // Keep comparing after a mismatch (to collect errors for all values in precision comparison)
          for (let i = 0; actual.length === expected.length && i < expected.length; i++) {
            const rel = relativeError(actual[i]!, expected[i]!);
            errors.push(rel);
            const tol = summarized && i < 2 ? 1e-13 : (spec.tolerance ?? 0);
            if (Number.isFinite(rel)) maxRel = Math.max(maxRel, rel);
            if (rel > tol) ok = false;
          }
          values += expected.length;
          if (num(c.next) !== next) ok = false;
          if (!ok) {
            failures.push(
              `seed ${c.seed} ${JSON.stringify(c.args)}\n    expected ${c.expected.slice(0, 8).join(" ")} next ${c.next}\n    actual   ${actual
                .slice(0, 8)
                .map((v) => String(v))
                .join(" ")} next ${next}`,
            );
          }
        }
        console.log(`${spec.name}: ${fixture.cases.length} cases, ${values} values, max relative error ${maxRel.toExponential(2)}`);
        if (precisionMode !== undefined) {
          writePrecision(summarize(spec.name, errors, failures.length, performance.now() - t0));
          return;
        }
        expect(failures, `${failures.length} case(s) differ from R:\n${failures.slice(0, 15).join("\n")}`).toHaveLength(0);
      });
    });
  }
}
