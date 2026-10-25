// Mauchly's test of sphericity against R's mauchly.test (oracle/mauchly.R)
import { describe, expect, it } from "vitest";
import { mauchlyTest, type MauchlyTestOptions } from "../src/index.js";
import { Comparison, dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";
import { num } from "./helpers/fixture.js";

const fixture = loadAnovaFixture("mauchlyTest");

describe("mauchlyTest", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison([]);
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
      cmp.numbers(index, "statistic", e.statistic, r.statistic);
      cmp.numbers(index, "pValue", e.pValue, r.pValue);
      cmp.strings(index, "statisticName", e.statisticName, r.statisticName);
      cmp.strings(index, "method", e.method, r.method);
    });
    console.log(cmp.summary("mauchlyTest", fixture.cases.length, 0));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
  });
  it("rejects an X that is not inside M", () => {
    const y = [[1, 2.5, 3.1], [2, 2.2, 4.0], [1.5, 3.1, 2.9], [2.2, 2.8, 3.7], [1.1, 2.0, 3.3]];
    const idata = { W: ["a", "b", "c"], V: [1, 4, 2] };
    expect(() => mauchlyTest(y, { idata, M: "~W", X: "~V" })).not.toThrow();
    expect(() => mauchlyTest(y, { idata, M: "~1", X: "~V" })).toThrow("X does not define a subspace of M");
  });
});
