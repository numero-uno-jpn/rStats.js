import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** One fixture case. Numbers are strings (num2str in oracle/_common.R); logicals are kept as booleans. */
export interface FixtureCase {
  args: Record<string, string | boolean>;
  expected: string;
  /** High-precision reference value computed with Rmpfr (only in some fixtures) */
  reference?: string;
}

export interface Fixture {
  function: string;
  r_version: string;
  generated: string;
  cases: FixtureCase[];
}

function fixturePath(file: string): string {
  return fileURLToPath(new URL(`../fixtures/${file}`, import.meta.url));
}

/**
 * Loads a fixture. If <name>.ref.json (Rmpfr reference values for cases that disagree with R)
 * exists, its values are stored in each case's `reference`.
 */
export function loadFixture(name: string): Fixture {
  const fixture = JSON.parse(readFileSync(fixturePath(`${name}.json`), "utf8")) as Fixture;
  const refPath = fixturePath(`${name}.ref.json`);
  if (existsSync(refPath)) {
    const refs = JSON.parse(readFileSync(refPath, "utf8")) as { args: FixtureCase["args"]; reference: string }[];
    const map = new Map(refs.map((r) => [JSON.stringify(r.args), r.reference]));
    for (const c of fixture.cases) {
      const r = map.get(JSON.stringify(c.args));
      if (r !== undefined) c.reference = r;
    }
  }
  return fixture;
}

/** Writes the args of mismatching cases to <name>.mismatch.json (for computing reference values) */
export function writeMismatches(name: string, args: FixtureCase["args"][]): void {
  writeFileSync(fixturePath(`${name}.mismatch.json`), JSON.stringify(args));
}

/** Converts a fixture number string back to a number. R's NA and NaN both become NaN. */
export function num(s: string | boolean | undefined): number {
  if (typeof s !== "string") throw new Error(`not a numeric string: ${String(s)}`);
  if (s === "NA" || s === "NaN") return NaN;
  if (s === "Inf") return Infinity;
  if (s === "-Inf") return -Infinity;
  return Number(s);
}

export function bool(s: string | boolean | undefined): boolean {
  if (typeof s !== "boolean") throw new Error(`not a logical: ${String(s)}`);
  return s;
}

/** Relative error. 0 for two NaNs, the same infinity or equal values; Infinity if only one is a special value. */
export function relativeError(actual: number, expected: number): number {
  if (Number.isNaN(expected) || Number.isNaN(actual)) {
    return Number.isNaN(expected) && Number.isNaN(actual) ? 0 : Infinity;
  }
  if (actual === expected) return 0;
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return Infinity;
  if (expected === 0) return Infinity;
  return Math.abs(actual - expected) / Math.abs(expected);
}

export interface Mismatch {
  args: FixtureCase["args"];
  expected: number;
  actual: number;
  relError: number;
}

export interface CheckResult {
  total: number;
  mismatches: Mismatch[];
  /** Per-case relative error against the closer of R and the reference value (for precision comparison; test/helpers/precision.ts) */
  errors: number[];
  /** Number of cases that disagree with R but match the high-precision reference (more accurate than R) */
  betterThanR: number;
  /** Maximum relative error over finite cases (used to choose tolerances) */
  maxRelError: number;
}

/**
 * Calls compute on every fixture case and returns those whose relative error exceeds tolerance.
 * When the expected value is subnormal (< 2^-1022), precision is reduced accordingly, so an
 * absolute error up to tolerance * 2^-1022 is allowed.
 */
export function checkFixture(
  fixture: Fixture,
  compute: (args: FixtureCase["args"]) => number,
  tolerance: number,
  /** Lower bound on the relative-error denominator (for values where being near 0 has no special meaning, such as log densities) */
  floor: (args: FixtureCase["args"]) => number = () => 0,
): CheckResult {
  const mismatches: Mismatch[] = [];
  const errors: number[] = [];
  let maxRelError = 0;
  let betterThanR = 0;
  let fl = 0;
  const rel = (actual: number, expected: number): number => {
    const r = relativeError(actual, expected);
    if (fl === 0 || !Number.isFinite(actual) || !Number.isFinite(expected)) return r;
    return Math.abs(actual - expected) / Math.max(Math.abs(expected), fl);
  };
  const within = (actual: number, expected: number): boolean => {
    const subnormal = expected !== 0 && Math.abs(expected) < 2 ** -1022;
    return subnormal
      ? Math.abs(actual - expected) <= tolerance * 2 ** -1022
      : rel(actual, expected) <= tolerance;
  };
  for (const c of fixture.cases) {
    fl = floor(c.args);
    const expected = num(c.expected);
    const actual = compute(c.args);
    const relError = rel(actual, expected);
    errors.push(c.reference === undefined ? relError : Math.min(relError, rel(actual, num(c.reference))));
    const subnormal = expected !== 0 && Math.abs(expected) < 2 ** -1022;
    if (!within(actual, expected) && c.reference !== undefined && within(actual, num(c.reference))) {
      betterThanR++;
      continue;
    }
    if (Number.isFinite(relError) && !subnormal) maxRelError = Math.max(maxRelError, relError);
    if (within(actual, expected)) continue;
    mismatches.push({ args: c.args, expected, actual, relError });
  }
  mismatches.sort((a, b) => b.relError - a.relError);
  return { total: fixture.cases.length, mismatches, errors, maxRelError, betterThanR };
}

export function formatMismatches(m: Mismatch[], limit = 30): string {
  const lines = m
    .slice(0, limit)
    .map(
      (x) =>
        `  ${JSON.stringify(x.args)}\n    expected ${x.expected}  actual ${x.actual}  rel ${x.relError.toExponential(2)}`,
    );
  const more = m.length > limit ? `\n  ... and ${m.length - limit} more` : "";
  return `${m.length} case(s) exceeded the tolerance:\n${lines.join("\n")}${more}`;
}
