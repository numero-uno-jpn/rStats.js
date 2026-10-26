// The structure of a linear mixed model against lme4's lFormula() (oracle/lmerterms.R, oracle/lmer-behaviour.md
// stage 1a). Everything is compared exactly: numbers as R's strings parsed to doubles, labels as strings.
import { describe, expect, it } from "vitest";
import type { ContrastName } from "../src/index.js";
import { mixedModelStructure } from "../src/models/mixedStructure.js";
import { num } from "./helpers/fixture.js";
import { Comparison, dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("lmerTerms");

/** Exact comparison of numbers (no tolerance; 0 equals -0, NaN equals NaN): R's strings parsed to doubles against the values computed */
function exact(cmp: Comparison, index: number, what: string, expected: unknown, actual: unknown): void {
  const flat = (v: unknown): unknown[] => ([] as unknown[]).concat(v).flat(3);
  const e = flat(expected).map((v) => num(v as string));
  const a = flat(actual) as number[];
  cmp.cells += e.length;
  if (e.length !== a.length || e.some((v, k) => v !== a[k] && !(Number.isNaN(v) && Number.isNaN(a[k]!)))) cmp.fail(index, what, expected, actual);
}

describe("mixedModelStructure (lmerTerms)", () => {
  it(`matches lme4's lFormula (${fixture.r_version})`, () => {
    const cmp = new Comparison([]);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const options = {
        ...(a.contrasts === undefined ? {} : { contrasts: a.contrasts as Record<string, ContrastName> }),
        ...(a.levels === undefined ? {} : { levels: a.levels as Record<string, string[]> }),
      };
      let s;
      try {
        s = mixedModelStructure(a.formula as string, dataFrameOf(a.data, a.dataTypes), options);
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
      const e = c.expected;
      if (e.error !== undefined) return cmp.fail(index, "(exception)", e.error, "no exception thrown");
      exact(cmp, index, "rows", e.rows, s.rows.map((r) => r + 1));
      cmp.strings(index, "xColNames", e.xColNames, s.xColNames);
      exact(cmp, index, "x", e.x, s.x);
      const terms = e.terms as { label: string; group: string; columns: string[]; nLevels: string }[];
      cmp.strings(
        index,
        "terms",
        terms,
        s.terms.map((t) => ({ label: t.label, group: s.groups[t.group]!.name, columns: t.columns, nLevels: String(t.nLevels) })),
      );
      cmp.strings(
        index,
        "groups",
        e.groups,
        s.groups.map((g) => ({ name: g.name, levels: g.levels })),
      );
      exact(cmp, index, "termGroup", e.termGroup, s.terms.map((t) => t.group + 1));
      exact(
        cmp,
        index,
        "z",
        e.z,
        s.z.flatMap((col, j) => col.rows.map((i, k) => [i + 1, j + 1, col.values[k]!])),
      );
      cmp.strings(index, "zColLevels", e.zColLevels, s.zColLevels);
      exact(cmp, index, "theta", e.theta, s.theta);
      exact(cmp, index, "lower", e.lower, s.lower);
      exact(cmp, index, "lambda", e.lambda, s.lambda.map((l) => [l.row + 1, l.col + 1, l.theta + 1]));
      cmp.strings(index, "messages", e.messages, s.messages);
      cmp.strings(index, "warnings", e.warnings, s.warnings);
    });
    console.log(`lmerTerms: ${fixture.cases.length} cases (${errors} errors verified), ${cmp.cells} numbers compared exactly`);
    expect(cmp.failures, cmp.failures.slice(0, 20).join("\n")).toEqual([]);
  });
});
