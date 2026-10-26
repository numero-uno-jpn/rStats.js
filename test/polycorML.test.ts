// Maximum-likelihood polychoric and polyserial correlations and their standard errors (polycor's polychor and
// polyserial with ML and/or std.err) against the fixture polycorML (oracle/polycorml.R), by the rules of
// oracle/polycor-behaviour.md: every value within a relative 1e-12 of the fixture's reference (the exact maximum of the
// likelihood), df, n and the warnings exactly as R. R's values themselves are known differences: R's optimisers
// (Nelder-Mead, BFGS) stop about 1e-4 short of the maximum, and its Hessian is by finite differences.
import { describe, expect, it } from "vitest";
import { polychor, polyserial, type PolycorOptions } from "../src/index.js";
import { num, relativeError } from "./helpers/fixture.js";
import { loadAnovaFixture } from "./helpers/anova.js";

const vec = (v: unknown): number[] => (v as string[]).map(num);
const flat = (v: unknown): number[] => ([] as unknown[]).concat(v).flat(2).map((s) => num(s as string));

/** R's warning that the two cases of strong association (two-step with std.err) give, where R's BFGS runs past 1 */
const R_INADMISSIBLE = "inadmissible correlation set to 0.9999";

describe("polycor ML and standard errors", () => {
  const fixture = loadAnovaFixture("polycorML");
  it(`matches the exact maximum (R ${fixture.r_version})`, () => {
    const failures: string[] = [];
    const maxRel: Record<string, number> = {};
    const maxRelR: Record<string, number> = {};
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected;
      const ref = c.reference!;
      const options: PolycorOptions = { ML: a.ML as boolean, stdErr: a["std.err"] as boolean };
      const res = (
        a.fn === "polyserial"
          ? polyserial(vec(a.x), vec(a.y), options)
          : a.table !== undefined
            ? polychor((a.table as string[][]).map(vec), options)
            : polychor(vec(a.x), vec(a.y), options)
      ) as unknown as Record<string, unknown>;
      const fields: [string, string][] = [["rho", "rho"]];
      if (options.stdErr) {
        fields.push(["var", "var"], ["chisq", "chisq"]);
        if (a.fn === "polyserial") fields.push(["cuts", "cuts"]);
        else fields.push(["row.cuts", "rowCuts"], ["col.cuts", "colCuts"]);
      }
      for (const [fixtureName, name] of fields) {
        const expected = flat(ref[fixtureName]);
        const actual = ([] as unknown[]).concat(res[name]).flat(2) as number[];
        const rFlat = flat(e[fixtureName]);
        if (expected.length !== actual.length) {
          failures.push(`#${index} ${name}: shape, reference ${JSON.stringify(ref[fixtureName])} / TS ${JSON.stringify(res[name])}`);
          continue;
        }
        expected.forEach((v, k) => {
          const err = relativeError(actual[k]!, v);
          maxRel[name] = Math.max(maxRel[name] ?? 0, err);
          const errR = relativeError(actual[k]!, rFlat[k]!);
          if (Number.isFinite(errR)) maxRelR[name] = Math.max(maxRelR[name] ?? 0, errR);
          if (!(err <= 1e-12)) failures.push(`#${index} ${name}[${k}]: reference ${v} / TS ${actual[k]} (error ${err.toExponential(2)})`);
        });
      }
      if (options.stdErr) {
        if (res.df !== e.df) failures.push(`#${index} df: R ${String(e.df)} / TS ${String(res.df)}`);
        if (res.n !== e.n) failures.push(`#${index} n: R ${String(e.n)} / TS ${String(res.n)}`);
      }
      const warningsR = (e.warnings as string[]).filter((w) => w !== R_INADMISSIBLE);
      if (JSON.stringify(warningsR) !== JSON.stringify(res.warnings)) {
        failures.push(`#${index} warnings: R ${JSON.stringify(e.warnings)} / TS ${JSON.stringify(res.warnings)}`);
      }
    });
    const report = (m: Record<string, number>): string =>
      Object.entries(m)
        .map(([k, v]) => `${k} ${v.toExponential(2)}`)
        .join(", ");
    console.log(
      `polycorML: ${fixture.cases.length} cases\n  max relative error vs the reference: ${report(maxRel)}\n` +
        `  vs R (known differences: R's optimisers stop early): ${report(maxRelR)}`,
    );
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("keeps the two-step results without options", () => {
    const tab = [[20, 8, 1], [5, 30, 9], [2, 6, 25]];
    expect(polychor(tab, {})).toEqual(polychor(tab));
    expect(polychor(tab, { ML: false, stdErr: false })).toEqual({ rho: polychor(tab).rho, warnings: [] });
    const x = [0.2, -1.1, 0.8, 1.5, -0.3, 0.1, -0.9, 2.0];
    const y = [1, 1, 2, 3, 2, 2, 1, 2];
    expect(polyserial(x, y, {})).toEqual(polyserial(x, y));
  });

  it("stops at the bound when the likelihood increases up to |rho| = 0.9999", () => {
    expect(polychor([[50, 0], [0, 50]], { ML: true })).toEqual({ rho: 0.9999, warnings: ["inadmissible correlation set to 0.9999"] });
    expect(polychor([[0, 50], [50, 0]], { stdErr: true })).toMatchObject({ rho: -0.9999, warnings: ["inadmissible correlation set to -0.9999"] });
  });

  it("returns NaN alone for tables with fewer than two rows", () => {
    expect(polychor([[3, 4], [0, 0]], { ML: true, stdErr: true })).toEqual({
      rho: NaN,
      warnings: ["1 row with zero marginal removed", "the table has fewer than 2 rows"],
    });
    expect(polyserial([1, 2, 3], [1, 1, 1], { stdErr: true })).toEqual({ rho: NaN, warnings: ["y has fewer than 2 levels"] });
  });
});
