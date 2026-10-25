// aov with an Error() term and summary() of it against R (oracle/aovstrata.R)
import { describe, expect, it } from "vitest";
import { aov, aovSummary, type AovStrataFit, type ContrastName, type LmFormulaOptions } from "../src/index.js";
import { collectWarnings, Comparison, dataFrameOf, loadAnovaFixture, type FixtureTable, type KnownDifference } from "./helpers/anova.js";

/** Cells that differ from R by more than 1e-12 but are within 1e-12 of the exact reference */
const KNOWN: KnownDifference[] = [];

const fixture = loadAnovaFixture("aovStrata");

interface FixtureStratum extends FixtureTable {
  stratum: string;
}

describe("aovStrata", () => {
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
      let s;
      try {
        fit = aov(a.formula as string, dataFrameOf(a.data, a.dataTypes), options) as AovStrataFit;
        s = aovSummary(fit);
      } catch (err) {
        const msg = (err as Error).message;
        if (e.error === undefined) return cmp.fail(index, "(exception)", "result", msg);
        errors++;
        if (msg !== e.error) cmp.fail(index, "error", e.error, msg);
        return;
      }
      if (e.error !== undefined) return cmp.fail(index, "(exception)", e.error, "no exception thrown");
      const exp = e.strata as FixtureStratum[];
      const ref = (c.reference?.strata as FixtureStratum[] | undefined) ?? [];
      cmp.strings(index, "strata", exp.map((x) => x.stratum), s.strata.map((x) => x.stratum));
      exp.forEach((st, k) => {
        const act = s.strata[k];
        if (act === undefined) return;
        const r = ref.find((x) => x.stratum === st.stratum);
        cmp.table(index, st.stratum, st, act, r, false);
      });
      cmp.strings(index, "warnings", e.warnings, collectWarnings(fit.warnings, s.warnings));
    });
    console.log(cmp.summary("aovStrata", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
});
