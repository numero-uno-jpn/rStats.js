import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ca, type CaInputTable, type CaFit } from "../src/entries/multivariate.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/ca.json", import.meta.url), "utf8")) as Record<string, any>;
const names = Object.keys(fixture).filter((key) => key.startsWith("ca_") && !key.startsWith("ca_cacoord_") && fixture[key]?.value?.fit);
const smoke = fixture.ca_smoke.value.fit.N.values as number[][];
const special: Record<string, { suprow?: number | number[]; supcol?: number | number[] }> = {
  ca_smoke_suprow: { suprow: 5 },
  ca_smoke_supcol: { supcol: 1 },
  ca_smoke_sup_both: { suprow: [1, 3], supcol: 4 },
};
function unwrap(x: any): any { return x && typeof x === "object" && "values" in x ? x.values : x; }
function vector(x: any): any[] { const v = unwrap(x); return Array.isArray(v) ? v : [v]; }
function expectedMatrix(x: any): any {
  return { rows: x.rows, cols: Array.isArray(x.cols) ? x.cols : x.cols === null ? null : [x.cols], values: x.values };
}
function align(actual: CaFit, expected: any): void {
  const e = expected.rowcoord.values;
  for (let j = 0; j < (actual.rowcoord.values[0]?.length ?? 0); j++) {
    let dot = 0;
    for (let i = 0; i < Math.min(actual.rowcoord.values.length, e.length); i++) dot += actual.rowcoord.values[i]![j]! * e[i]![j]!;
    if (dot < 0) {
      for (const row of actual.rowcoord.values) row[j] = -row[j]!;
      for (const row of actual.colcoord.values) row[j] = -row[j]!;
    }
  }
}
function compare(a: any, e: any, path: string, out: string[]): void {
  if (e === "NA") { if (!(typeof a === "number" && Number.isNaN(a))) out.push(path + ": expected NA"); return; }
  if (typeof e === "number") {
    if (typeof a !== "number" || !Number.isFinite(a) || Math.abs(a - e) > 1e-12 * Math.max(1, Math.abs(e))) out.push(path + ": " + a + " vs " + e);
    return;
  }
  if (e === null || typeof e !== "object") { if (a !== e) out.push(path + ": " + a + " vs " + e); return; }
  if (Array.isArray(e)) {
    if (!Array.isArray(a) || a.length !== e.length) { out.push(path + ": length " + (a?.length ?? "not-array") + " vs " + e.length); return; }
    for (let i = 0; i < e.length; i++) compare(a[i], e[i], path + "[" + i + "]", out);
    return;
  }
  for (const key of Object.keys(e)) compare(a?.[key], e[key], path + "." + key, out);
}
function inputFor(key: string): { input: CaInputTable; options: Record<string, unknown> } {
  const expected = fixture[key].value.fit;
  return {
    input: { rows: unwrap(expected.rownames) ?? null, cols: unwrap(expected.colnames) ?? null, values: special[key] ? smoke : expected.N.values },
    options: special[key] ?? (key === "ca_smoke_nd1" ? { nd: 1 } : key === "ca_smoke_nd5" ? { nd: 5 } : {}),
  };
}
function normalizedExpected(x: any): any {
  return {
    sv: vector(x.sv), nd: unwrap(x.nd), rownames: unwrap(x.rownames), rowmass: vector(x.rowmass),
    rowdist: vector(x.rowdist), rowinertia: vector(x.rowinertia), rowcoord: expectedMatrix(x.rowcoord),
    rowsup: vector(x.rowsup), colnames: unwrap(x.colnames), colmass: vector(x.colmass),
    coldist: vector(x.coldist), colinertia: vector(x.colinertia), colcoord: expectedMatrix(x.colcoord),
    colsup: vector(x.colsup), N: expectedMatrix(x.N),
  };
}

describe("ca: all fixture fit cases", () => {
  it("compares every returned fit component, aligning row and column signs together", () => {
    const mismatches: string[] = [];
    let compared = 0;
    for (const key of names) {
      const expected = fixture[key].value.fit;
      const { input, options } = inputFor(key);
      const actual = ca(input, options as any);
      align(actual, expected);
      compare(actual, normalizedExpected(expected), key, mismatches);
      compared++;
    }
    expect(compared, "fixture fit case count").toBe(names.length);
    expect(mismatches).toEqual([]);
  });
});
