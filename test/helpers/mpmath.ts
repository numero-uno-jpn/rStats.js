import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatMismatches, num, relativeError, type FixtureCase, type Mismatch } from "./fixture.js";

/**
 * A case of an mpmath reference fixture (test/fixtures/<name>.mpmath.json, written by scripts/mpmath/*.py).
 * `scale` is the magnitude of terms that cancel in the result: the error is then measured relative to
 * max(|expected|, scale).
 */
interface ReferenceCase extends FixtureCase {
  scale?: string;
}

interface ReferenceFixture {
  function: string;
  generator: string;
  cases: ReferenceCase[];
}

export interface ReferenceSpec {
  /** Fixture name (test/fixtures/<name>.mpmath.json) */
  name: string;
  call: (args: FixtureCase["args"]) => number;
  tolerance: number;
}

export function loadReference(name: string): ReferenceFixture {
  const path = fileURLToPath(new URL(`../fixtures/${name}.mpmath.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as ReferenceFixture;
}

/**
 * Compares a function with high-precision mpmath values. Used for functions whose R fixtures have not been
 * generated yet, alongside the R comparison once they have. Subnormal expected values allow an absolute error
 * of tolerance × 2^-1022, as in checkFixture.
 */
export function referenceSuite(spec: ReferenceSpec): void {
  const fixture = loadReference(spec.name);
  describe(spec.name, () => {
    it(`matches the high-precision values (${fixture.generator})`, () => {
      const mismatches: Mismatch[] = [];
      let maxRel = 0;
      for (const c of fixture.cases) {
        const expected = num(c.expected);
        const actual = spec.call(c.args);
        let rel = relativeError(actual, expected);
        if (Number.isFinite(rel) && Number.isFinite(expected) && Number.isFinite(actual)) {
          const den = Math.max(Math.abs(expected), c.scale === undefined ? 0 : num(c.scale));
          rel = expected === actual ? 0 : Math.abs(actual - expected) / den;
          if (expected !== 0 && Math.abs(expected) < 2 ** -1022 && c.scale === undefined)
            rel = Math.abs(actual - expected) / 2 ** -1022;
        }
        if (Number.isFinite(rel)) maxRel = Math.max(maxRel, rel);
        if (!(rel <= spec.tolerance)) mismatches.push({ args: c.args, expected, actual, relError: rel });
      }
      mismatches.sort((a, b) => b.relError - a.relError);
      console.log(`${spec.name}: ${fixture.cases.length} cases, max relative error ${maxRel.toExponential(2)} (${fixture.generator})`);
      expect(mismatches, formatMismatches(mismatches)).toHaveLength(0);
    });
  });
}
