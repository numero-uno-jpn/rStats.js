import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  psiBisquare, psiHampel, psiHuber, rlm, rlmSummary, rlmVcov,
  type RlmOptions,
} from "../src/entries/regression.js";
import type { DataFrame } from "../src/models/modelFrame.js";
import { num } from "./helpers/fixture.js";

interface FitPublic {
  coefficients: Record<string, string | number>;
  s: number | string;
  summary: { rows: string[]; cols: string[]; values: (string | number)[][] };
  "cov.unscaled": { rows: string[]; cols: string[]; values: (string | number)[][] };
  vcov: { rows: string[]; cols: string[]; values: (string | number)[][] };
}
interface FitRecord {
  fit: Record<string, unknown>;
  fitResult: { error?: string; warnings: string[] };
  fitPublic?: FitPublic;
  fitTight?: { fit: Record<string, unknown>; fitPublic?: FitPublic; fitResult: { error?: string; warnings: string[] } };
}
interface RlmCase {
  id: string;
  fits: { main: FitRecord };
}
interface Fixture {
  cases: RlmCase[];
}
interface PsiGrid {
  u: number[];
  psiHuber: { w: number[]; d: boolean[] };
  psiHampel: { w: number[]; d: number[] };
  psiBisquare: { w: number[]; d: number[] };
}
interface Experiment {
  psi_grid: PsiGrid;
}

const path = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const fixture = JSON.parse(readFileSync(path("test/fixtures/rlm.json"), "utf8")) as Fixture;
const experiment = JSON.parse(readFileSync(path("experiments/regression-rlm.json"), "utf8")) as Experiment;

function numericData(raw: Record<string, unknown>): DataFrame {
  const out: Record<string, readonly (number | string | boolean | null)[]> = {};
  for (const [name, values] of Object.entries(raw)) {
    if (!Array.isArray(values)) throw new TypeError(`invalid column ${name}`);
    out[name] = values.map((v) => {
      if (typeof v !== "string") return v as number | string | boolean | null;
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    });
  }
  return out;
}

function optionsFrom(raw: Record<string, unknown>): RlmOptions {
  const options: RlmOptions = {};
  const psi = raw.psi;
  if (psi === "psi.hampel") options.psi = "hampel";
  else if (psi === "psi.bisquare") options.psi = "bisquare";
  else if (psi === "psi.huber") options.psi = "huber";
  if (typeof raw.init === "string") options.init = raw.init as "ls" | "lts";
  else if (Array.isArray(raw.init)) options.init = raw.init.map((v) => num(v as string | number));
  if (Array.isArray(raw.weights)) options.weights = raw.weights.map((v) => num(v as string | number));
  if (raw["wt.method"] === "inv" || raw["wt.method"] === "case") options.wtMethod = raw["wt.method"];
  if (raw["scale.est"] === "MAD" || raw["scale.est"] === "Huber" || raw["scale.est"] === "proposal 2") options.scaleEst = raw["scale.est"];
  if (raw.method === "M" || raw.method === "MM") options.method = raw.method;
  for (const key of ["k", "a", "b", "c", "k2", "maxit", "acc"] as const) {
    const value = raw[key];
    if (typeof value === "string" || typeof value === "number") options[key] = num(value);
  }
  return options;
}

function fitFrom(raw: Record<string, unknown>) {
  const formula = raw.formula;
  const data = raw.data;
  if (typeof formula !== "string" || typeof data !== "object" || data === null) throw new TypeError("invalid fit arguments");
  const columns = (data as { columns?: Record<string, unknown> }).columns;
  if (columns === undefined) throw new TypeError("fixture data has no columns");
  return rlm(formula, numericData(columns), optionsFrom(raw));
}

function numericMatrix(actual: number[][], expected: (string | number)[][], label: string, tolerance: number): void {
  expect(actual.length, label + " rows").toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]?.length, label + " columns " + i).toBe(expected[i]?.length);
    for (let j = 0; j < expected[i]!.length; j++) {
      const e = num(expected[i]![j]!);
      const a = actual[i]![j]!;
      // The covariance and summary entries are direct algebraic functions of the converged fit; 1e-9
      // allows only accumulated double rounding, not the difference between R's default and tight stops.
      const scale = Math.max(Math.abs(e), 1e-300);
      expect(Math.abs(a - e) / scale, `${label}[${i},${j}]`).toBeLessThanOrEqual(tolerance);
    }
  }
}

describe("robust regression psi functions", () => {
  it("matches every point of the recorded signed psi grid", () => {
    const { u, psiHuber: h, psiHampel: a, psiBisquare: b } = experiment.psi_grid;
    const compare = (actual: number[], expected: number[], label: string) => {
      expect(actual.length, label + " length").toBe(expected.length);
      actual.forEach((v, i) => expect(Math.abs(v - expected[i]!), `${label}[${i}]`).toBeLessThanOrEqual(3e-15));
    };
    compare(psiHuber(u) as number[], h.w, "Huber weights");
    compare(Array.from(psiHuber(u, { deriv: 1 }) as boolean[], Number), h.d.map(Number), "Huber derivative");
    compare(psiHampel(u), a.w, "Hampel weights");
    compare(psiHampel(u, { deriv: 1 }), a.d, "Hampel derivative");
    compare(psiBisquare(u), b.w, "bisquare weights");
    compare(psiBisquare(u, { deriv: 1 }), b.d, "bisquare derivative");
  });
});

const M_CASES = fixture.cases.filter((c) => {
  const args = c.fits.main.fit;
  return args.method !== "MM" && args.init !== "lts" && c.fits.main.fitPublic !== undefined;
});

describe("robust M regression against the R fixture", () => {
  for (const c of M_CASES) {
    it(c.id, () => {
      const args = c.fits.main.fit;
      const fit = fitFrom(args);
      const expected = c.fits.main.fitPublic!;
      const expectedNames = Object.keys(expected.coefficients);
      expect(Object.keys(fit.coefficients)).toEqual(expectedNames);
      for (const name of expectedNames) {
        const r = num(expected.coefficients[name]!);
        const actual = fit.coefficients[name]!;
        // R's default acc=1e-4 intentionally stops earlier; compare its coefficients at that iteration scale.
        expect(Math.abs(actual - r) / Math.max(1, Math.abs(r)), name).toBeLessThanOrEqual(3e-3);
      }
      expect(Math.abs(fit.scale - num(expected.s)) / Math.max(1, Math.abs(num(expected.s)))).toBeLessThanOrEqual(3e-3);
      expect(fit.model.columnNames).toEqual(expected.summary.rows);
      const summary = rlmSummary(fit);
      expect(summary.rows).toEqual(expected.summary.rows);
      expect(summary.columns).toEqual(expected.summary.cols);
      numericMatrix(summary.values, expected.summary.values, c.id + " summary", 3e-3);
      const vcov = rlmVcov(fit);
      expect(vcov.rows).toEqual(expected.vcov.rows);
      expect(vcov.columns).toEqual(expected.vcov.cols);
      numericMatrix(vcov.values, expected.vcov.values, c.id + " vcov", 3e-3);

      const tight = c.fits.main.fitTight?.fitPublic;
      if (tight !== undefined) {
        for (const name of Object.keys(tight.coefficients)) {
          const r = num(tight.coefficients[name]!);
          expect(Math.abs(fit.coefficients[name]! - r) / Math.max(1, Math.abs(r)), c.id + " tight " + name)
            .toBeLessThanOrEqual(3e-3);
        }
        expect(Math.abs(fit.scale - num(tight.s)) / Math.max(1, Math.abs(num(tight.s))), c.id + " tight scale")
          .toBeLessThanOrEqual(3e-3);
      }
    });
  }

  it("retains the iteration-limit status for maxit=2", () => {
    const c = fixture.cases.find((v) => v.id === "phones-maxit-2");
    expect(c).toBeDefined();
    const fit = fitFrom(c!.fits.main.fit);
    expect(fit.converged).toBe(false);
    expect(fit.warnings).toContain("'rlm' failed to converge in 2 steps");
  });
});
