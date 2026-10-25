// modelMatrix against R's model.matrix and terms() (oracle/modelmatrix.R)
import { describe, expect, it } from "vitest";
import { modelMatrix, type ContrastName } from "../src/index.js";
import { Comparison, dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("modelMatrix");

describe("modelMatrix", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison([]);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const options = {
        ...(a.contrasts === undefined ? {} : { contrasts: a.contrasts as Record<string, ContrastName> }),
        ...(a.levels === undefined ? {} : { levels: a.levels as Record<string, string[]> }),
      };
      let m;
      try {
        m = modelMatrix(a.formula as string, dataFrameOf(a.data, a.dataTypes), options);
      } catch (e) {
        const msg = (e as Error).message;
        const want = c.expected.error as string | undefined;
        if (want === undefined) return cmp.fail(index, "(exception)", "result", msg);
        errors++;
        // R reports a parse error; the specification asks for a message starting with "invalid formula"
        if (want.startsWith("<text>")) {
          if (!msg.startsWith("invalid formula")) cmp.fail(index, "error", "invalid formula ...", msg);
        } else if (msg !== want) cmp.fail(index, "error", want, msg);
        return;
      }
      if (c.expected.error !== undefined) return cmp.fail(index, "(exception)", c.expected.error, "no exception thrown");
      const e = c.expected;
      cmp.strings(index, "termLabels", e.termLabels, m.termLabels);
      cmp.numbers(index, "order", e.order, m.order);
      cmp.strings(index, "intercept", e.intercept, m.intercept);
      cmp.strings(index, "variables", e.variables, m.variables);
      cmp.strings(index, "factors", (e.factors as string[][]).map((r) => r.map(Number)), m.factors);
      cmp.strings(index, "colNames", e.colNames, m.colNames);
      cmp.numbers(index, "assign", e.assign, m.assign);
      cmp.numbers(index, "rows", e.rows, m.rows.map((r) => r + 1));
      cmp.numbers(index, "x", e.x, m.x);
      cmp.strings(index, "warnings", e.warnings, m.warnings);
    });
    console.log(cmp.summary("modelMatrix", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 20).join("\n")).toEqual([]);
  });
});
