// Two-step polychoric and polyserial correlations (polycor's polychor and polyserial, ML = FALSE) and the bivariate
// normal rectangle probabilities (mvtnorm's pmvnorm in two dimensions) against R (oracle/polycor.R), by the rules of
// oracle/polycor-behaviour.md: rho within a relative 1e-12 of R, warnings exactly; pbvnorm within a relative 1e-12 or
// 1e-15 absolute.
import { describe, expect, it } from "vitest";
import { pbvnorm, polychor, polyserial } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { Comparison, loadAnovaFixture } from "./helpers/anova.js";

const vec = (v: unknown): number[] => (v as string[]).map(num);

describe("polycor", () => {
  const fixture = loadAnovaFixture("polycor");
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison([]);
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected as Record<string, unknown>;
      const r =
        a.fn === "polyserial"
          ? polyserial(vec(a.x), vec(a.y))
          : a.table !== undefined
            ? polychor((a.table as string[][]).map(vec))
            : polychor(vec(a.x), vec(a.y));
      cmp.numbers(index, "rho", e.rho, r.rho);
      cmp.strings(index, "warnings", e.warnings, r.warnings);
    });
    console.log(cmp.summary("polycor", fixture.cases.length, 0));
    expect(cmp.failures, cmp.failures.join("\n")).toEqual([]);
  });
});

describe("pbvnorm", () => {
  const fixture = loadAnovaFixture("pbvnorm");
  it(`matches R (${fixture.r_version})`, () => {
    const failures: string[] = [];
    let maxRel = 0;
    let maxAbs = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const expected = num((c.expected as Record<string, string>).value!);
      const actual = pbvnorm(vec(a.lower), vec(a.upper), num(a.rho as string));
      const abs = Math.abs(actual - expected);
      const rel = abs === 0 ? 0 : abs / Math.abs(expected);
      if (rel <= 1e-12) maxRel = Math.max(maxRel, rel);
      else maxAbs = Math.max(maxAbs, abs);
      if (!(actual >= 0) || (rel > 1e-12 && abs > 1e-15)) failures.push(`#${index}: R ${expected} / TS ${actual} (rel ${rel.toExponential(2)}, abs ${abs.toExponential(2)})`);
    });
    console.log(
      `pbvnorm: ${fixture.cases.length} cases; max relative error ${maxRel.toExponential(2)} where within 1e-12, ` +
        `max absolute error ${maxAbs.toExponential(2)} elsewhere`,
    );
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("handles the boundaries", () => {
    expect(pbvnorm([-Infinity, -Infinity], [Infinity, Infinity], 0.3)).toBe(1);
    expect(pbvnorm([-Infinity, -Infinity], [0, 0], 0)).toBe(0.25);
    expect(pbvnorm([0, -Infinity], [Infinity, Infinity], 0.7)).toBeCloseTo(0.5, 15);
    expect(pbvnorm([-Infinity, -Infinity], [0, 0], 1)).toBeCloseTo(0.5, 15);
    expect(pbvnorm([-Infinity, -Infinity], [0, 0], -1)).toBe(0);
    expect(pbvnorm([1, 0], [0, 1], 0.2)).toBe(0);
    expect(() => pbvnorm([0, 0], [1, 1], 1.5)).toThrow(RangeError);
  });
});

describe("polycor warnings", () => {
  it("returns NaN for tables with fewer than two rows or columns", () => {
    expect(polychor([[3, 4], [0, 0]])).toEqual({ rho: NaN, warnings: ["1 row with zero marginal removed", "the table has fewer than 2 rows"] });
    expect(polychor([[1, 0, 0], [2, 0, 0]]).warnings).toEqual(["2 columns with zero marginals removed", "the table has fewer than 2 columns"]);
    expect(polyserial([1, 2, 3], [1, 1, 1])).toEqual({ rho: NaN, warnings: ["y has fewer than 2 levels"] });
  });

  it("bounds an inadmissible polyserial estimate", () => {
    const r = polyserial([1, 2, 3, 4, 100], [1, 1, 1, 1, 2]);
    expect(Math.abs(r.rho)).toBe(0.9999);
    expect(r.warnings[0]).toMatch(/^initial correlation inadmissible, [0-9.]+, set to 0.9999$/);
  });
});
