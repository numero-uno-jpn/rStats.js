// Counting-process Kaplan-Meier estimates against oracle/survfitcounting.R and oracle/coxph2-behaviour.md, part C.
import { describe, expect, it } from "vitest";
import { survdiff, survfit, type SurvfitConfType, type SurvdiffOptions } from "../src/index.js";
import { Comparison, loadAnovaFixture } from "./helpers/anova.js";
import { num } from "./helpers/fixture.js";

const fixture = loadAnovaFixture("survfitCounting");

describe("survfit counting-process", () => {
  it("matches all counting-process fixture cases", () => {
    const cmp = new Comparison([]);
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected;
      const start = (a.start as string[]).map(num);
      const stop = (a.stop as string[]).map(num);
      const status = (a.status as string[]).map(num);
      const group = a.group as string[] | undefined;
      const id = a.id as string[] | undefined;
      if (a.fn === "survdiff") {
        expect(() => survdiff(stop, status, group!, { start } as unknown as SurvdiffOptions))
          .toThrow(RangeError);
        return;
      }
      let result;
      try {
        result = survfit(stop, status, {
          start,
          ...(group === undefined ? {} : { group }),
          ...(id === undefined ? {} : { id }),
          confType: (a["conf.type"] as SurvfitConfType | undefined) ?? "log",
          ...(a["conf.int"] === undefined ? {} : { confInt: num(a["conf.int"] as string) }),
        });
      } catch (error) {
        return cmp.fail(index, "(exception)", "survfit result", (error as Error).message);
      }
      cmp.strings(index, "warnings", e.warnings, result.warnings);
      cmp.strings(index, "strata", e.strata, result.strata);
      cmp.strings(index, "medianRows", e.medianRows, result.medianRows);
      cmp.numbers(index, "time", e.time, result.time);
      cmp.numbers(index, "nRisk", e["n.risk"], result.nRisk);
      cmp.numbers(index, "nEvent", e["n.event"], result.nEvent);
      cmp.numbers(index, "nCensor", e["n.censor"], result.nCensor);
      cmp.numbers(index, "surv", e.surv, result.surv);
      cmp.numbers(index, "stdErr", e["std.err"], result.stdErr);
      cmp.numbers(index, "lower", e.lower, result.lower);
      cmp.numbers(index, "upper", e.upper, result.upper);
      cmp.numbers(index, "cumhaz", e.cumhaz, result.cumhaz);
      cmp.numbers(index, "median", e.median, result.median);
    });
    console.log(cmp.summary("survfitCounting", fixture.cases.length, 1));
    expect(cmp.failures, cmp.failures.slice(0, 40).join("\n")).toEqual([]);
  });

  it("is invariant to power-of-two scaling of counting-process times", () => {
    const start = [0, 0, 1, 2, 0, 3, 4, 5];
    const stop = [1, 2, 3, 4, 5, 6, 7, 8];
    const status = [1, 0, 1, 0, 1, 0, 1, 0];
    const base = survfit(stop, status, { start, rmean: "common" });
    const factor = 2 ** 500;
    const scaled = survfit(stop.map((v) => v * factor), status, {
      start: start.map((v) => v * factor),
      rmean: "common",
    });
    const largerFactor = 2 ** 1000;
    const larger = survfit(stop.map((v) => v * largerFactor), status, {
      start: start.map((v) => v * largerFactor),
      rmean: "common",
    });
    expect(scaled.nRisk).toEqual(base.nRisk);
    expect(scaled.nEvent).toEqual(base.nEvent);
    expect(scaled.nCensor).toEqual(base.nCensor);
    expect(scaled.surv).toEqual(base.surv);
    expect(scaled.cumhaz).toEqual(base.cumhaz);
    expect(scaled.stdErr).toEqual(base.stdErr);
    expect(scaled.time.map((v) => v / factor)).toEqual(base.time);
    expect(scaled.median[0]!.map((v) => v / factor)).toEqual(base.median[0]);
    expect(scaled.rmean[0]! / factor).toBeCloseTo(base.rmean[0]!, 12);
    expect(scaled.seRmean[0]! / factor).toBeCloseTo(base.seRmean[0]!, 12);
    expect(larger.nRisk).toEqual(base.nRisk);
    expect(larger.surv).toEqual(base.surv);
    expect(larger.time.map((v) => v / largerFactor)).toEqual(base.time);
    expect(larger.rmean[0]! / largerFactor).toBeCloseTo(base.rmean[0]!, 12);
    // The existing absolute sqrt(eps) tie tolerance intentionally merges intervals at this scale.
    const tiny = 2 ** -500;
    expect(() => survfit([tiny], [1], { start: [0] })).toThrow("aeqSurv exception, an interval has effective length 0");
  });

  it("removes split-point censorings only when id is supplied", () => {
    const start = [0, 0, 2, 0, 2, 0];
    const stop = [2, 4, 5, 2, 5, 6];
    const status = [0, 1, 0, 0, 1, 0];
    const id = ["a", "a", "a", "b", "b", "c"];
    const withoutId = survfit(stop, status, { start });
    const withId = survfit(stop, status, { start, id });
    expect(withoutId.time).toContain(2);
    expect(withId.time).not.toContain(2);
    expect(withId.nEvent).toEqual(withoutId.nEvent.filter((_, i) => withoutId.time[i] !== 2));
    expect(withId.surv).toEqual(withoutId.surv.filter((_, i) => withoutId.time[i] !== 2));
  });

  it("keeps distinct large numeric IDs distinct", () => {
    const fit = survfit([1, 2, 1, 2], [0, 1, 0, 1], {
      start: [0, 1, 0, 1],
      id: [1e15, 1e15, 1e15 + 1, 1e15 + 1],
    });
    expect(fit.time).toEqual([2]);
    expect(fit.nRisk).toEqual([2]);
    expect(fit.nEvent).toEqual([2]);
    expect(fit.surv).toEqual([0]);
  });

  it("recognizes a subject split across strata", () => {
    const fit = survfit([1, 2], [0, 1], {
      start: [0, 1],
      id: ["same", "same"],
      group: ["a", "b"],
    });
    expect(fit.strata).toEqual(["group=b"]);
    expect(fit.time).toEqual([2]);
    expect(fit.nCensor).toEqual([0]);
  });

  it("keeps genuine zero-weight censoring rows while omitting id split points", () => {
    const fit = survfit([1, 2, 3], [0, 0, 1], {
      start: [0, 0, 0],
      id: ["a", "b", "c"],
      weights: [0, 1, 1],
    });
    expect(fit.time).toContain(1);
    expect(fit.nCensor[fit.time.indexOf(1)]).toBe(0);
    expect(fit.time).toContain(2);
  });

  it("validates start and id lengths and intervals", () => {
    expect(() => survfit([2], [1], { start: [0, 1] })).toThrow(RangeError);
    expect(() => survfit([2], [1], { id: ["a", "b"] })).toThrow(RangeError);
    expect(() => survfit([2], [1], { id: ["a"] })).toThrow(RangeError);
    expect(() => survfit([2], [1], { start: [2] })).toThrow(RangeError);
    expect(() => survfit([2], [1], { start: [2 + 1e-9] })).toThrow(Error);
  });
});
