// Shared code of the tests of the power calculations against R (oracle/power.R, oracle/pwr.R): the arguments of a
// case as an options object, and the comparison of a result with R's by the rules of oracle/effectsize-behaviour.md
// ("Accuracy required, and how to test"): every field of R's result, in R's order, with R's names in camelCase;
// numbers within a relative 1e-12 of R's value (the solved quantity too, which is R's tolerance-limited root), strings
// exactly; R's warnings, without the precision warnings of R's pnt that this library does not give.

import { num } from "./fixture.js";
import type { AnovaCase, Comparison } from "./anova.js";

/** R's argument or field name in camelCase (sig.level -> sigLevel, effect.size -> effectSize) */
export const camel = (name: string): string => name.replace(/\.([a-z])/g, (_, c: string) => c.toUpperCase());

/** The options of a case: "NULL" becomes null, numbers become numbers, other strings (type, a size) stay */
export function optionsOf(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k === "fn") continue;
    if (v === "NULL") out[camel(k)] = null;
    else if (typeof v === "string" && !Number.isNaN(Number(v))) out[camel(k)] = num(v);
    else out[camel(k)] = v;
  }
  return out;
}

const PNT_WARNING = "full precision may not have been achieved in 'pnt{final}'";

/**
 * Compares a result with R's: the field names in order, numbers and strings. `call` returns the result or throws;
 * returns whether the case was an error that was verified.
 */
export function comparePowerCase(cmp: Comparison, index: number, c: AnovaCase, call: () => Record<string, unknown>): boolean {
  const e = c.expected;
  let r: Record<string, unknown>;
  try {
    r = call();
  } catch (err) {
    const msg = (err as Error).message;
    if (e.error === undefined) cmp.fail(index, "(exception)", "result", msg);
    else if (msg !== e.error) cmp.fail(index, "error", e.error, msg);
    return e.error !== undefined;
  }
  if (e.error !== undefined) {
    cmp.fail(index, "(exception)", e.error, "no exception thrown");
    return false;
  }
  // R's fields; a NULL element (written as {}) is a field R does not have
  const fields = Object.keys(e).filter((k) => k !== "warnings" && !(typeof e[k] === "object" && e[k] !== null && !Array.isArray(e[k])));
  cmp.strings(index, "fields", fields.map(camel), Object.keys(r).filter((k) => k !== "warnings"));
  for (const k of fields) {
    const ev = e[k];
    const av = r[camel(k)];
    const isNumber = typeof ev === "string" && (!Number.isNaN(Number(ev)) || ["NA", "NaN", "Inf", "-Inf"].includes(ev));
    if (isNumber && typeof av === "number") cmp.numbers(index, camel(k), ev, av, c.reference?.[k]);
    else cmp.strings(index, camel(k), ev, av);
  }
  const expectedWarnings = ((e.warnings as string[] | undefined) ?? []).filter((w) => w !== PNT_WARNING);
  cmp.strings(index, "warnings", expectedWarnings, (r.warnings as string[] | undefined) ?? []);
  return false;
}
