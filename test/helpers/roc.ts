// Curves of the ROC fixtures (oracle/roc.R, oracle/roctest.R, oracle/rocboot.R): the arguments as pROC's, with NULL
// written as an empty array and NA as null or "NA".
import { roc, type RocResult } from "../../src/index.js";
import { num } from "./fixture.js";
import type { HTestArg } from "./htest.js";

/** A numeric vector of a fixture (a scalar string for length 1; null and "NA" are missing) */
export function vecNA(a: HTestArg | undefined): number[] | undefined {
  if (a === undefined) return undefined;
  if (typeof a === "string") return [num(a)];
  return (a as (string | null)[]).map((v) => (v === null ? NaN : num(v)));
}

/** A string argument, undefined for R's NULL (an empty array) */
export function strOrNull(a: HTestArg | undefined): string | undefined {
  if (a === undefined || (Array.isArray(a) && a.length === 0)) return undefined;
  if (typeof a !== "string") throw new Error(`not a string: ${JSON.stringify(a)}`);
  return a;
}

/** The curve of a fixture case: controls and cases, or a response (strings with responseIsString) and a predictor */
export function makeRoc(a: Record<string, HTestArg>, suffix = "", direction?: string): RocResult {
  const dir = direction ?? strOrNull(a.direction);
  if (a[`controls${suffix}`] !== undefined) {
    return roc({ controls: vecNA(a[`controls${suffix}`])!, cases: vecNA(a[`cases${suffix}`])! }, dir === undefined ? {} : { direction: dir as "<" });
  }
  const isString = a.responseIsString === true;
  const raw = a.response as string[] | string;
  const response = (typeof raw === "string" ? [raw] : raw).map((v) => (isString ? v : num(v)));
  const levelsRaw = a.levels;
  const levels =
    levelsRaw === undefined ? undefined : (typeof levelsRaw === "string" ? [levelsRaw] : (levelsRaw as string[])).map((v) => (isString ? v : num(v)));
  const options: Record<string, unknown> = {};
  if (levels !== undefined) options.levels = levels;
  if (dir !== undefined) options.direction = dir;
  if (a.naRm !== undefined) options.naRm = a.naRm;
  const predictor = vecNA(a[suffix === "" ? "predictor" : `predictor${suffix}`])!;
  return roc(response, predictor, options);
}
