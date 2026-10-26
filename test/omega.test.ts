// omega against R (oracle/omega.R, x86_64 R; rules in oracle/omega-behaviour.md, "Accuracy"): every value within a
// relative 1e-12, a loading (orthog, oblique, gloading, and the g and F* columns of sl) also passing within 1e-12
// times the largest absolute value of its column. For one factor the F1* column of sl and the group column of
// omegaGroup are 0 exactly; R reports rounding residues there (known differences, compared with the exact 0).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { omega } from "../src/index.js";
import { num, relativeError } from "./helpers/fixture.js";

interface Case {
  args: Record<string, unknown>;
  expected: Record<string, unknown>;
}
const cases = (JSON.parse(readFileSync(new URL("./fixtures/omega.json", import.meta.url), "utf8")) as { cases: Case[] }).cases;
const mat = (a: unknown): number[][] => (a as string[][]).map((r) => r.map((v) => num(v)));
const vec = (a: unknown): number[] => (a as string[]).map((v) => num(v));
const TOL = 1e-12;

/** Columns whose exact value is 0 (one factor): R's formula leaves the square root of a rounding residue */
const ONE_FACTOR_ZERO = {
  reason: "one factor: v = R_ii - (R_ii - L^2) - L^2 is 0 exactly (gloading 1); R reports the square root of its rounding residue (up to 2^-27)",
  columns: { sl: 1, omegaGroup: 2 } as Record<string, number>,
};

describe("omega against R", () => {
  const maxErr: Record<string, number> = {};
  const residue: Record<string, number> = {};
  const loadingException = new Set<string>();
  cases.forEach((c, k) => {
    const a = c.args;
    const q = num(a.nfactors as string);
    it(`${k}: ${a.r !== undefined ? "correlation matrix" : "x"} nfactors ${q}`, () => {
      const e = c.expected;
      const r = a.r !== undefined ? omega(null, { nfactors: q, covmat: mat(a.r) }) : omega(mat(a.x), { nfactors: q });
      const failures: string[] = [];
      const check = (field: string, what: string, actual: number, expected: number, scale = 0) => {
        const rel = relativeError(actual, expected);
        // a loading may also be within 1e-12 times the largest absolute value of its column
        const err = Math.min(rel, scale > 0 ? Math.abs(actual - expected) / scale : Infinity);
        if (rel > TOL && err <= TOL) loadingException.add(`${k} ${field}`);
        maxErr[field] = Math.max(maxErr[field] ?? 0, err);
        if (!(err <= TOL)) failures.push(`${what}: ${actual} vs ${expected} (${err.toExponential(2)})`);
      };
      const checkMatrix = (field: string, actual: number[][] | undefined, expected: number[][], loadingColumns: number) => {
        expect(actual?.length, field).toBe(expected.length);
        const colMax = expected[0]!.map((_, j) => Math.max(...expected.map((row) => Math.abs(row[j]!))));
        expected.forEach((row, i) => {
          expect(actual![i]!.length, `${field}[${i}]`).toBe(row.length);
          row.forEach((v, j) => {
            if (q === 1 && ONE_FACTOR_ZERO.columns[field] === j) {
              // known difference: the exact value is 0
              residue[`${k} ${field}[, ${j}]`] = Math.max(residue[`${k} ${field}[, ${j}]`] ?? 0, Math.abs(v));
              if (actual![i]![j] !== 0) failures.push(`${field}[${i}][${j}]: ${actual![i]![j]} vs exact 0`);
              return;
            }
            check(field, `${field}[${i}][${j}]`, actual![i]![j]!, v, j < loadingColumns ? colMax[j]! : 0);
          });
        });
      };
      check("omegaH", "omegaH", r.omegaH, num(e.omega_h as string));
      check("omegaLim", "omegaLim", r.omegaLim, num(e["omega.lim"] as string));
      check("alpha", "alpha", r.alpha, num(e.alpha as string));
      check("omegaTot", "omegaTot", r.omegaTot, num(e["omega.tot"] as string));
      check("G6", "G6", r.G6, num(e.G6 as string));
      check("ECV", "ECV", r.ECV, num(e.ECV as string));
      checkMatrix("sl", r.sl, mat(e.sl), q + 1);
      expect(r.slNames).toEqual(e.slNames);
      checkMatrix("orthog", r.orthog, mat(e.orthog), q);
      checkMatrix("oblique", r.oblique, mat(e.oblique), q);
      if (e.phi === undefined) expect(r.phi).toBeUndefined();
      else checkMatrix("phi", r.phi, mat(e.phi), 0);
      const gl = vec(e.gloading);
      const glMax = Math.max(...gl.map(Math.abs));
      expect(r.gloading.length).toBe(gl.length);
      gl.forEach((v, i) => check("gloading", `gloading[${i}]`, r.gloading[i]!, v, glMax));
      expect(r.key).toEqual(vec(e.key));
      checkMatrix("omegaGroup", r.omegaGroup, mat(e["omega.group"]), 0);
      expect(r.warnings).toEqual(e.warnings);
      expect(r.messages).toEqual(e.messages);
      expect(failures).toEqual([]);
    });
  });
  it("summary", () =>
    console.log(
      `omega: ${cases.length} cases, max error ${Object.entries(maxErr).map(([f, v]) => `${f} ${v.toExponential(2)}`).join(", ")}; ` +
        `loading exception: ${loadingException.size === 0 ? "none" : [...loadingException].join(", ")}; ` +
        `known differences (R's value against the exact 0): ${Object.entries(residue).map(([f, v]) => `${f} ${v.toExponential(2)}`).join(", ")} ` +
        `(${ONE_FACTOR_ZERO.reason})`,
    ));
});

describe("omega arguments", () => {
  it("errors", () => {
    expect(() => omega(null)).toThrow("neither 'x' nor 'covmat' supplied");
    expect(() => omega([[1, 2, 3], [2, 1, 3], [3, 5, 1], [4, 3, 2]], { nfactors: 0 })).toThrow("'nfactors' must be a positive integer");
  });
});
