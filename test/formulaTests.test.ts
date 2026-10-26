// Formula forms of the hypothesis tests, complete.cases and na.omit against R (oracle/formulatests.R)
import { describe, expect, it } from "vitest";
import {
  ansariTest, bartlettTest, completeCases, corTest, flignerTest, friedmanTest, kruskalTest, ksTest, moodTest, naOmit,
  onewayTest, quadeTest, tTest, varTest, wilcoxTest, type DataFrame,
} from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { Comparison, dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

/** The htest fields compared exactly; the others numerically */
const STRING_FIELDS = new Set(["method", "alternative", "statisticName", "parameterName", "estimateNames", "nullValueName"]);

/** R's option names and their rStats.js names */
const OPTION_NAMES: Record<string, string> = {
  "var.equal": "varEqual",
  "conf.level": "confLevel",
  "conf.int": "confInt",
  alternative: "alternative",
  mu: "mu",
  exact: "exact",
  correct: "correct",
  method: "method",
  paired: "paired",
};

/** The options of a case in rStats.js's names (numbers are written as strings, except the string options) */
function optionsOf(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // R writes an empty list() as []
  if (Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const name = OPTION_NAMES[k];
    if (name === undefined) throw new Error(`unknown option ${k}`);
    out[name] = typeof v === "string" && name !== "alternative" && name !== "method" ? num(v) : v;
  }
  return out;
}

type Call = (formula: string, data: DataFrame, options: Record<string, unknown>) => object;
const TESTS: Record<string, Call> = {
  "t.test": (f, d, o) => tTest(f, d, o),
  "wilcox.test": (f, d, o) => wilcoxTest(f, d, o),
  "var.test": (f, d, o) => varTest(f, d, o),
  "ansari.test": (f, d, o) => ansariTest(f, d, o),
  "mood.test": (f, d, o) => moodTest(f, d, o),
  "ks.test": (f, d, o) => ksTest(f, d, o),
  "kruskal.test": (f, d) => kruskalTest(f, d),
  "fligner.test": (f, d) => flignerTest(f, d),
  "bartlett.test": (f, d) => bartlettTest(f, d),
  "oneway.test": (f, d, o) => onewayTest(f, d, o),
  "friedman.test": (f, d) => friedmanTest(f, d),
  "quade.test": (f, d) => quadeTest(f, d),
  "cor.test": (f, d, o) => corTest(f, d, o),
};

const fixture = loadAnovaFixture("formulaTests");

describe("formulaTests", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison([]);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const fn = a.fn as string;
      const data = dataFrameOf(a.data, a.dataTypes);
      const e = c.expected;
      if (fn === "complete.cases") return cmp.strings(index, "complete", e.complete, completeCases(data));
      if (fn === "na.omit") {
        cmp.strings(index, "data", dataFrameOf(e.data, a.dataTypes), naOmit(data));
        const omitted = completeCases(data).flatMap((ok, i) => (ok ? [] : [i + 1]));
        return cmp.strings(index, "omitted", e.omitted, omitted);
      }
      const call = TESTS[fn];
      if (call === undefined) throw new Error(`unknown function ${fn}`);
      let r: Record<string, unknown>;
      try {
        r = call(a.formula as string, data, optionsOf(a.options)) as Record<string, unknown>;
      } catch (err) {
        const msg = (err as Error).message;
        if (e.error === undefined) return cmp.fail(index, "(exception)", "result", msg);
        errors++;
        if (msg !== e.error) cmp.fail(index, "error", e.error, msg);
        return;
      }
      if (e.error !== undefined) return cmp.fail(index, "(exception)", e.error, "no exception thrown");
      for (const [field, exp] of Object.entries(e)) {
        if (STRING_FIELDS.has(field)) cmp.strings(index, field, exp, r[field]);
        else cmp.numbers(index, field, exp, r[field]);
      }
    });
    console.log(cmp.summary("formulaTests", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
  });
});
