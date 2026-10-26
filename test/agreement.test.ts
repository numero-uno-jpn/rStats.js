// Agreement and reliability (irr's kappa2, kappam.fleiss and icc, psych's alpha and partial.r) against R
// (oracle/agreement.R), by the rules of oracle/agreement-behaviour.md: every value within a relative 1e-12 of R's.
// The kappa p-values are computed as 2 Φ(−|z|), irr's as 2 (1 − Φ(|z|)); where the two differ by more than 1e-12 the
// value is a known difference and must be within 1e-12 of the fixture's reference (2 pnorm(−|z|) in R).
import { describe, expect, it } from "vitest";
import { cronbachAlpha, icc, kappa2, kappamFleiss, partialR, type IccOptions } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { Comparison, loadAnovaFixture, type KnownDifference } from "./helpers/anova.js";

const CANCELLATION = "irr computes the p-value as 2 (1 − Φ(|z|)), which loses digits to cancellation; rStats.js computes 2 Φ(−|z|)";
/** Values that differ from R by more than 1e-12 but are within 1e-12 of the reference */
const KNOWN: KnownDifference[] = [
  { case: 1, table: "p.value", row: "0", col: "", reason: `kappa2 weight = "equal": ${CANCELLATION}` },
  { case: 2, table: "p.value", row: "0", col: "", reason: `kappa2 weight = "squared": ${CANCELLATION}` },
  { case: 3, table: "p.value", row: "0", col: "", reason: `kappam.fleiss: ${CANCELLATION} (R gives 2.2e-16, the true value is 1.7e-16)` },
];

const IN_SCOPE = ["kappa2", "kappam.fleiss", "icc", "alpha", "partial.r"];
const fixture = loadAnovaFixture("agreement");
const matrix = (v: unknown): number[][] => (v as string[][]).map((r) => r.map(num));

describe("agreement", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN);
    let compared = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected as Record<string, unknown>;
      const ref = c.reference;
      // Skipped: the polychor and polyserial cases (the two-step estimates are tested on their own fixture,
      // test/polycor.test.ts, and the ML ones and the standard errors on test/polycorML.test.ts)
      if (!IN_SCOPE.includes(a.fn as string)) return;
      cmp.strings(index, "warnings", e.warnings, []);
      const check = (field: string, actual: unknown): void => cmp.numbers(index, field, e[field], actual, ref?.[field]);
      switch (a.fn) {
        case "kappa2": {
          const r = kappa2(matrix(a.ratings), { weight: a.weight as string });
          check("value", r.value);
          check("statistic", r.statistic);
          check("p.value", r.pValue);
          break;
        }
        case "kappam.fleiss": {
          const r = kappamFleiss(matrix(a.ratings), { exact: a.exact === true });
          check("value", r.value);
          // the exact kappa has no test: R's fields are empty
          check("statistic", r.statistic ?? []);
          check("p.value", r.pValue ?? []);
          break;
        }
        case "icc": {
          const options: IccOptions = {
            model: a.model as string,
            type: a.type as string,
            unit: a.unit as string,
            ...(a["conf.level"] === undefined ? {} : { confLevel: num(a["conf.level"] as string) }),
          };
          const r = icc(matrix(a.ratings), options);
          for (const [field, v] of Object.entries({ value: r.value, Fvalue: r.Fvalue, df1: r.df1, df2: r.df2, "p.value": r.pValue, lbound: r.lbound, ubound: r.ubound })) {
            check(field, v);
          }
          break;
        }
        case "alpha": {
          const r = cronbachAlpha(matrix(a.x));
          check("raw_alpha", r.rawAlpha);
          check("std.alpha", r.stdAlpha);
          check("G6", r.G6);
          check("average_r", r.averageR);
          check("alpha.drop", r.alphaDrop);
          break;
        }
        case "partial.r":
          check("r", partialR(matrix(a.x), num(a.i as string) - 1, num(a.j as string) - 1));
          break;
      }
      compared++;
    });
    console.log(cmp.summary("agreement", compared, 0));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
});

describe("agreement inputs", () => {
  it("kappa2 drops rows with a missing value and sorts numeric levels as strings", () => {
    const x = [[1, 1], [2, 2], [10, 2], [2, 10], [10, 10], [1, 2], [NaN, 1]];
    expect(kappa2(x)).toEqual(kappa2(x.slice(0, 6)));
    // levels 1, 10, 2: 1 and 2 are two levels apart, 10 and 2 one
    const equal = kappa2(x.slice(0, 6), { weight: "equal" });
    const relabelled = kappa2(x.slice(0, 6).map((r) => r.map((v) => ({ 1: 1, 10: 2, 2: 3 })[v]!)), { weight: "equal" });
    expect(equal).toEqual(relabelled);
  });

  it("rejects bad arguments", () => {
    expect(() => kappa2([[1, 2, 3]])).toThrow(TypeError);
    expect(() => kappa2([[1, 2]], { weight: "x" })).toThrow(RangeError);
    expect(() => icc([[1, 2], [3, NaN]])).toThrow(RangeError);
    expect(() => icc([[1, 2], [3, 4]], { confLevel: 1 })).toThrow(RangeError);
    expect(() => partialR([[1, 2], [3, 4]], 0, 0)).toThrow(RangeError);
    expect(() => partialR([[1, 2], [3, 4]], 0, 2)).toThrow(RangeError);
  });
});
