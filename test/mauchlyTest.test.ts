// Mauchly's test of sphericity against R's mauchly.test (oracle/mauchly.R)
import { describe, expect, it } from "vitest";
import { mauchlyTest, type MauchlyTestOptions } from "../src/index.js";
import { Comparison, dataFrameOf, loadAnovaFixture, type KnownDifference } from "./helpers/anova.js";
import { num } from "./helpers/fixture.js";

/** Values that differ from R by more than 1e-12 but are within 1e-12 of the exact reference */
const R_W = (r: string) => `R's W is ${r} from the exact value; rStats.js's (double-double) matches it`;
const NEAR_ONE = "W = 0.9927 is near 1, where the p-value amplifies R's 1.9e-13 error in W to 1.3e-12";
const KNOWN: KnownDifference[] = [
  { case: 2, table: "pValue", row: "pValue", col: "", reason: NEAR_ONE },
  { case: 7, table: "statistic", row: "W", col: "", reason: R_W("1.4e-12") },
  { case: 7, table: "pValue", row: "pValue", col: "", reason: `the p-value at R's W (${R_W("1.4e-12")})` },
  { case: 8, table: "statistic", row: "W", col: "", reason: R_W("4.0e-12") },
  { case: 8, table: "pValue", row: "pValue", col: "", reason: `the p-value at R's W (${R_W("4.0e-12")})` },
];

const fixture = loadAnovaFixture("mauchlyTest");

describe("mauchlyTest", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN);
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const y = (a.y as string[][]).map((r) => r.map(num));
      const options: MauchlyTestOptions = {
        ...(a.group === undefined ? {} : { group: a.group as string[] }),
        ...(a.idata === undefined ? {} : { idata: dataFrameOf(a.idata, a.idataTypes) }),
        ...(a.M === undefined ? {} : { M: a.M as string }),
        ...(a.X === undefined ? {} : { X: a.X as string }),
      };
      let r;
      try {
        r = mauchlyTest(y, options);
      } catch (err) {
        return cmp.fail(index, "(exception)", "result", (err as Error).message);
      }
      const e = c.expected;
      cmp.numbers(index, "statistic", e.statistic, r.statistic, c.reference?.statistic, ["W"]);
      cmp.numbers(index, "pValue", e.pValue, r.pValue, c.reference?.pValue, ["pValue"]);
      cmp.strings(index, "statisticName", e.statisticName, r.statisticName);
      cmp.strings(index, "method", e.method, r.method);
    });
    console.log(cmp.summary("mauchlyTest", fixture.cases.length, 0));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
  it("rejects an X that is not inside M", () => {
    const y = [[1, 2.5, 3.1], [2, 2.2, 4.0], [1.5, 3.1, 2.9], [2.2, 2.8, 3.7], [1.1, 2.0, 3.3]];
    const idata = { W: ["a", "b", "c"], V: [1, 4, 2] };
    expect(() => mauchlyTest(y, { idata, M: "~W", X: "~V" })).not.toThrow();
    expect(() => mauchlyTest(y, { idata, M: "~1", X: "~V" })).toThrow("X does not define a subspace of M");
  });
});
