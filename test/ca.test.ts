import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ca, caSummary, caCoord, type CaInputTable, type CaFit } from "../src/entries/multivariate.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/ca.json", import.meta.url), "utf8")) as Record<string, any>;
let maxNumericError = 0;
const componentMismatchCounts:Record<string,number>={};
const componentMaxAbsError:Record<string,number>={};
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
  if (e === "NA") { if (a !== "NA" && !(typeof a === "number" && Number.isNaN(a))) out.push(path + ": expected NA"); return; }
  if (e === undefined && a === null) return;
  if (typeof e === "number") {
    if (typeof a !== "number" || !Number.isFinite(a)) out.push(path + ": " + a + " vs " + e);
    else {
      const error = Math.abs(a - e);
      maxNumericError = Math.max(maxNumericError, error);
      if (error > 1e-12 * Math.max(1, Math.abs(e))) {
        out.push(path + ": " + a + " vs " + e);
      }
    }
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
function recordComponentMismatches(errors:string[]):void {
  for(const error of errors){
    const path=error.split(":")[0]??"";
    const parts=path.split(".").slice(1);
    const component=parts[0]==="summary"?"summary."+(parts[1]??"unknown"):(parts[0]??"unknown");
    componentMismatchCounts[component]=(componentMismatchCounts[component]??0)+1;
    const values=error.match(/:\s*(-?[0-9.eE+-]+) vs (-?[0-9.eE+-]+)/);
    if(values){const delta=Math.abs(Number(values[1])-Number(values[2]));componentMaxAbsError[component]=Math.max(componentMaxAbsError[component]??0,delta);}
  }
}
function inputFor(key: string): { input: CaInputTable; options: Record<string, unknown> } {
  const expected = fixture[key].value.fit;
  return {
    input: { rows: unwrap(expected.rownames) ?? null, cols: unwrap(expected.colnames) ?? null, values: special[key] ? smoke : expected.N.values },
    options: special[key] ?? (key === "ca_smoke_nd1" ? { nd: 1 } : key === "ca_smoke_nd5" ? { nd: 5 } : key === "ca_author_nd3" ? { nd: 3 } : {}),
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
      try {
        const actual = ca(input, options as any);
        align(actual, expected);
        const normalized = normalizedExpected(expected);
        if (key === "ca_independent" || key === "ca_identity") { delete normalized.rowcoord; delete normalized.colcoord; }
        const caseErrors:string[]=[];
        compare(actual, normalized, key, caseErrors);
        recordComponentMismatches(caseErrors);
        mismatches.push(...caseErrors);
      } catch (error) {
        mismatches.push(key + ": threw " + (error instanceof Error ? error.stack : String(error)));
      }
      compared++;
    }
    expect(compared, "fixture fit case count").toBe(names.length);
    console.info("ca fit: " + compared + "/" + names.length + "; component mismatch counts=" + JSON.stringify(componentMismatchCounts) + "; component max |error|=" + JSON.stringify(componentMaxAbsError) + "; max |numeric error|=" + maxNumericError.toExponential(3));
    expect(mismatches).toEqual([]);
  });
  it("compares every available summary table in the fixture", () => {
    const mismatches: string[] = [];
    let compared = 0;
    for (const key of names) {
      const summary = fixture[key].value.summary?.value;
      if (!summary) continue;
      const { input, options } = inputFor(key);
      let actual: ReturnType<typeof caSummary>;
      try {
        const fit = ca(input, options as any);
        align(fit, fixture[key].value.fit);
        actual = caSummary(fit);
      } catch (error) { mismatches.push(key + ".summary: threw " + String(error)); compared++; continue; }
      const caseErrors:string[]=[];
      compare(actual, {
        scree: expectedMatrix(summary.scree),
        rows: expectedMatrix(summary.rows),
        columns: expectedMatrix(summary.columns),
      }, key + ".summary", caseErrors);
      recordComponentMismatches(caseErrors);
      mismatches.push(...caseErrors);
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });

  it("checks every R error fixture", () => {
    const bad: Record<string, { input: CaInputTable; options?: Record<string, unknown> }> = {
      ca_zero_row: { input: { rows: null, cols: null, values: [...smoke, [0, 0, 0, 0]] } },
      ca_zero_col: { input: { rows: null, cols: null, values: smoke.map(row => [...row, 0]) } },
      ca_negative: { input: { rows: null, cols: null, values: [[1, 3, 5], [-2, 4, 6]] } },
      ca_na: { input: { rows: null, cols: null, values: [[1, 3, 5], [Number.NaN, 4, 6]] } },
      ca_suprow_only_one_left: { input: { rows: null, cols: null, values: [[10, 30], [20, 5]] }, options: { suprow: 1 } },
      ca_suprow_names: { input: { rows: null, cols: null, values: smoke }, options: { suprow: "SE" } },
    };
    const mismatches: string[] = [];
    for (const [key, spec] of Object.entries(bad)) {
      let thrown = false;
      try { ca(spec.input, spec.options as any); } catch { thrown = true; }
      if (!thrown) mismatches.push(key + ": expected error " + fixture[key].error);
    }
    expect(Object.keys(bad).length).toBe(6);
    expect(mismatches).toEqual([]);
  });
  it("compares every cacoord fixture", () => {
    const author = fixture.ca_author.value.fit.N.values as number[][];
    const authorRows = unwrap(fixture.ca_author.value.fit.rownames) ?? null;
    const authorCols = unwrap(fixture.ca_author.value.fit.colnames) ?? null;
    const base = ca({ rows: unwrap(fixture.ca_smoke.value.fit.rownames), cols: unwrap(fixture.ca_smoke.value.fit.colnames), values: smoke });
    const large = ca({ rows: authorRows, cols: authorCols, values: author });
    align(base, fixture.ca_smoke.value.fit);
    align(large, fixture.ca_author.value.fit);
    const cases: Record<string, { fit: CaFit; options: any }> = {
      ca_cacoord_standard: { fit: base, options: { type: "standard", rows: true } },
      ca_cacoord_principal: { fit: base, options: { type: "principal", cols: true } },
      ca_cacoord_symmetric: { fit: base, options: { type: "symmetric" } },
      ca_cacoord_rowprincipal: { fit: large, options: { type: "rowprincipal", dim: [1, 2, 3] } },
      ca_cacoord_colgreen: { fit: large, options: { type: "colgreen" } },
      ca_cacoord_rowgab: { fit: base, options: { type: "rowgab" } },
    };
    const mismatches: string[] = [];
    for (const [key, spec] of Object.entries(cases)) {
      const actual = caCoord(spec.fit, spec.options);
      const caseErrors:string[]=[];
      compare(actual, fixture[key].value, key, caseErrors);
      recordComponentMismatches(caseErrors);
      mismatches.push(...caseErrors);
    }
    expect(Object.keys(cases).length).toBe(6);
    console.info("ca fixture totals: fit " + names.length + "/20; cacoord 6/6 (standard/principal transformations); error cases 6/6; shared row/column axis-sign alignment; component mismatch counts=" + JSON.stringify(componentMismatchCounts) + "; component max |error|=" + JSON.stringify(componentMaxAbsError) + "; max |numeric error|=" + maxNumericError.toExponential(3));
    expect(mismatches).toEqual([]);
  });

});
