// Precision comparison between double-double and plain double (scripts/precision.sh).
//
// When the environment variable RSTATS_PRECISION is "dd" or "double", an error summary for each fixture
// is written to reports/precision/<mode>/<name>.json and tests do not fail on mismatches.
// "double" switches the building blocks in src/special/dd.ts to plain double (loaded via setupFiles).
// Without the variable this does nothing (normal test run).

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setDoubleDouble } from "../../src/special/dd.js";

const env = process.env.RSTATS_PRECISION;
if (env !== undefined && env !== "dd" && env !== "double") {
  throw new Error(`RSTATS_PRECISION must be dd or double: ${env}`);
}
/** Mode to write summaries for (undefined = normal test run) */
export const precisionMode: "dd" | "double" | undefined = env;
setDoubleDouble(precisionMode !== "double");

export interface PrecisionRecord {
  name: string;
  /** Number of values compared (per field value for tests, per value for random numbers) */
  values: number;
  /** Number of cases (field values for tests) failing under the current pass/fail rules */
  failing: number;
  /** Relative error against the closer of R and the reference value */
  max: number;
  median: number;
  over1e14: number;
  over1e12: number;
  over1e10: number;
  over1e6: number;
  /** Values whose relative error is not finite (e.g. only one side is NaN or Inf) */
  nonFinite: number;
  ms: number;
}

/** Collects per-case relative errors into a record */
export function summarize(name: string, errors: number[], failing: number, ms: number): PrecisionRecord {
  const finite = errors.filter((e) => Number.isFinite(e)).sort((a, b) => a - b);
  const over = (t: number): number => errors.filter((e) => e > t).length;
  return {
    name,
    values: errors.length,
    failing,
    max: finite.length > 0 ? finite[finite.length - 1]! : 0,
    median: finite.length > 0 ? finite[Math.floor(finite.length / 2)]! : 0,
    over1e14: over(1e-14),
    over1e12: over(1e-12),
    over1e10: over(1e-10),
    over1e6: over(1e-6),
    nonFinite: errors.length - finite.length,
    ms,
  };
}

export function writePrecision(rec: PrecisionRecord): void {
  if (precisionMode === undefined) return;
  const dir = fileURLToPath(new URL(`../../reports/precision/${precisionMode}/`, import.meta.url));
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}${rec.name}.json`, JSON.stringify(rec));
}
