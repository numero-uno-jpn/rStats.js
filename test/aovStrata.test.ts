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

// summary.aov's warning of R 4.6 on a stratum fitted essentially perfectly. In R 4.6.2, with
//   d <- expand.grid(t = c("a", "b", "c"), b = c("1", "2", "3", "4")); d$y <- c(0, 2, 5)[d$t] + c(1, 4, 2, 7)[d$b]
// summary(aov(y ~ t + Error(b), d)) warns once ("Error: Within" is exact; "Error: b" has no terms), and with noise
// added to y not at all
describe("summary of a stratum fitted essentially perfectly (R 4.6)", () => {
  const PERFECT = "essentially perfect fit for ‘1’: summary may be unreliable";
  const t: string[] = [];
  const b: string[] = [];
  const y: number[] = [];
  [1, 4, 2, 7].forEach((be, j) =>
    (["a", "b", "c"] as const).forEach((k) => {
      t.push(k);
      b.push(String(j + 1));
      y.push({ a: 0, b: 2, c: 5 }[k] + be);
    }),
  );
  it("warns where the Within stratum is exact", () => {
    const s = aovSummary(aov("y ~ t + Error(b)", { y, t, b }) as AovStrataFit);
    expect(s.warnings).toEqual([PERFECT]);
  });
  it("does not warn otherwise", () => {
    const noisy = y.map((v, i) => v + [0.3, -0.2, 0.5, -0.1, 0.4, -0.6, 0.2, 0.1, -0.3, 0.6, -0.4, 0][i]!);
    const s = aovSummary(aov("y ~ t + Error(b)", { y: noisy, t, b }) as AovStrataFit);
    expect(s.warnings).toEqual([]);
  });
});
