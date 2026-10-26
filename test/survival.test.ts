// survdiff and survfit (Kaplan-Meier) against R's survival package (oracle/survival.R, oracle/survival-behaviour.md):
// every value within a relative 1e-12 of R's, NaN matching NaN (R's NA included); no known differences.
import { describe, expect, it } from "vitest";
import { survdiff, survfit, type SurvfitConfType } from "../src/index.js";
import { Comparison, loadAnovaFixture } from "./helpers/anova.js";
import { num } from "./helpers/fixture.js";

const fixture = loadAnovaFixture("survival");

describe("survival", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison([]);
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected;
      const time = (a.time as string[]).map(num);
      const status = (a.status as string[]).map(num);
      const group = a.group as string[] | undefined;
      cmp.strings(index, "warnings", e.warnings, []);
      if (a.fn === "survdiff") {
        let r;
        try {
          r = survdiff(time, status, group!, { rho: num(a.rho as string) });
        } catch (err) {
          return cmp.fail(index, "(exception)", "result", (err as Error).message);
        }
        cmp.strings(index, "groups", e.groups, r.groups);
        cmp.numbers(index, "n", e.n, r.n);
        cmp.numbers(index, "obs", e.obs, r.obs);
        cmp.numbers(index, "exp", e.exp, r.exp);
        cmp.numbers(index, "var", e.var, r.var);
        cmp.numbers(index, "chisq", e.chisq, r.chisq);
        cmp.numbers(index, "pvalue", e.pvalue, r.pvalue);
      } else {
        let r;
        try {
          r = survfit(time, status, {
            ...(group === undefined ? {} : { group }),
            confType: a["conf.type"] as SurvfitConfType,
            ...(a["conf.int"] === undefined ? {} : { confInt: num(a["conf.int"] as string) }),
          });
        } catch (err) {
          return cmp.fail(index, "(exception)", "result", (err as Error).message);
        }
        cmp.strings(index, "strata", e.strata, r.strata);
        cmp.strings(index, "medianRows", e.medianRows, r.medianRows);
        cmp.numbers(index, "time", e.time, r.time);
        cmp.numbers(index, "nRisk", e["n.risk"], r.nRisk);
        cmp.numbers(index, "nEvent", e["n.event"], r.nEvent);
        cmp.numbers(index, "nCensor", e["n.censor"], r.nCensor);
        cmp.numbers(index, "surv", e.surv, r.surv);
        cmp.numbers(index, "stdErr", e["std.err"], r.stdErr);
        cmp.numbers(index, "lower", e.lower, r.lower);
        cmp.numbers(index, "upper", e.upper, r.upper);
        cmp.numbers(index, "median", e.median, r.median);
      }
    });
    console.log(cmp.summary("survival", fixture.cases.length, 0));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
  });

  it("drops rows with a missing value", () => {
    const full = survdiff([1, 2, 3, 4, 5, 6], [1, 1, 0, 1, 1, 1], ["a", "b", "a", "b", "a", "b"]);
    const withNA = survdiff([1, 2, NaN, 3, 4, 5, 6, 7], [1, 1, 1, 0, 1, 1, 1, 1], ["a", "b", "a", "a", "b", "a", "b", null]);
    expect(withNA).toEqual(full);
    expect(survfit([1, 2, NaN, 2, 3, 4], [1, 1, 1, 0, 1, NaN]).time).toEqual([1, 2, 3]);
  });

  it("takes the midpoint of a flat stretch at 0.5 as the median", () => {
    // S = 0.5 (within sqrt(eps)) from t = 3 until the next event at t = 5
    const s = survfit([1, 2, 3, 4, 5, 6], [1, 1, 1, 0, 1, 1]);
    expect(Math.abs(s.surv[2]! - 0.5)).toBeLessThan(1e-15);
    expect(s.median[0]![0]).toBe(4);
  });

  it("rejects invalid arguments", () => {
    expect(() => survfit([1, 2], [1, 2])).toThrow(RangeError);
    expect(() => survfit([1, 2], [1, 0], { confInt: 1 })).toThrow(RangeError);
    expect(() => survdiff([1, 2], [1, 0], ["a"])).toThrow(RangeError);
  });
});
