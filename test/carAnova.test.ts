// Type II and type III tests (car::Anova) against R (oracle/caranova.R)
import { describe, expect, it } from "vitest";
import { Anova, lm, type ContrastName, type LmFormulaOptions } from "../src/index.js";
import { collectWarnings, Comparison, dataFrameOf, loadAnovaFixture, type FixtureTable, type KnownDifference } from "./helpers/anova.js";

/** Cells that differ from R by more than 1e-12 but are within 1e-12 of the exact reference */
const KNOWN: KnownDifference[] = [];

const fixture = loadAnovaFixture("carAnova");

describe("carAnova", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const options: LmFormulaOptions = {
        ...(a.contrasts === undefined ? {} : { contrasts: a.contrasts as Record<string, ContrastName> }),
        ...(a.weights === undefined ? {} : { weights: a.weights as string }),
      };
      const e = c.expected;
      let fit;
      let tab;
      try {
        fit = lm(a.formula as string, dataFrameOf(a.data), options);
        tab = Anova(fit, { type: Number(a.type) as 2 | 3 });
      } catch (err) {
        const msg = (err as Error).message;
        if (e.error === undefined) return cmp.fail(index, "(exception)", "result", msg);
        errors++;
        if (msg !== e.error) cmp.fail(index, "error", e.error, msg);
        return;
      }
      if (e.error !== undefined) return cmp.fail(index, "(exception)", e.error, "no exception thrown");
      cmp.table(index, "table", e as unknown as FixtureTable, tab, c.reference as FixtureTable | undefined, false);
      // R's lm() itself does not warn (summary() does): only the model matrix's warnings and Anova's
      const summaryWarning = "essentially perfect fit: summary may be unreliable";
      cmp.strings(index, "warnings", e.warnings, collectWarnings(fit.warnings.filter((w) => w !== summaryWarning), tab.warnings));
    });
    console.log(cmp.summary("carAnova", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
});

describe("Anova options", () => {
  it("accepts the type as a roman numeral and defaults to type II", () => {
    const data = { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4, 6.6, 7.0], A: ["a", "a", "b", "b", "a", "a", "b", "b"], B: ["p", "q", "p", "q", "p", "q", "p", "q"] };
    const fit = lm("y ~ A * B", data);
    expect(Anova(fit, { type: "II" })).toEqual(Anova(fit));
    expect(Anova(fit, { type: "III" })).toEqual(Anova(fit, { type: 3 }));
    expect(Anova(fit, { type: 3 }).rowNames).toEqual(["(Intercept)", "A", "B", "A:B", "Residuals"]);
  });
});
