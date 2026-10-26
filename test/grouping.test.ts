// tapply, split and aggregate against R (oracle/grouping.R; behaviour in oracle/grouping-behaviour.md)
import { describe, expect, it } from "vitest";
import { aggregate, mean, median, range, sd, split, sum, tapply, type AggregateValue, type DataFrame, type GroupingLabels } from "../src/index.js";
import { Comparison, dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("grouping");

/** The fixture's functions (fun) as the library's own, or plain JavaScript where it has none */
const FUNS: Record<string, (v: number[]) => AggregateValue> = {
  mean: (v) => mean(v),
  length: (v) => v.length,
  sum: (v) => sum(v),
  median: (v) => median(v),
  sd: (v) => sd(v),
  max: (v) => Math.max(...v),
  range: (v) => range(v),
  meansd: (v) => ({ m: mean(v), s: sd(v) }),
};

type Types = Record<string, "numeric" | "character" | "logical">;

describe("tapply, split, aggregate", () => {
  it(`match R (${fixture.r_version})`, () => {
    const cmp = new Comparison([]);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected;
      const data = dataFrameOf(a.data, a.dataTypes);
      const types = a.dataTypes as Types;
      const by = (a.by ?? []) as string[];
      // one column of labels, or a list of them, as oracle/grouping.R passes them
      const labels: GroupingLabels | GroupingLabels[] = by.length === 1 ? data[by[0]!]! : by.map((b) => data[b]!);
      const fun = a.fun === undefined ? undefined : FUNS[a.fun as string]!;
      /** A data frame of the fixture against one computed: column names exactly, character columns as strings */
      const frame = (what: string, expected: Record<string, string[]>, actual: DataFrame) => {
        cmp.strings(index, `${what}.names`, Object.keys(expected), Object.keys(actual));
        for (const [name, col] of Object.entries(expected)) {
          const got = Array.from(actual[name] ?? []);
          if (types[name] === "character") cmp.strings(index, `${what}.${name}`, col, got);
          else cmp.numbers(index, `${what}.${name}`, col, got);
        }
      };
      try {
        switch (a.fn) {
          case "tapply": {
            const r = tapply(data[a.x as string] as number[], labels, fun!);
            cmp.numbers(index, "dim", (e.dim as number[]).map(String), r.dim);
            cmp.strings(index, "dimnames", e.dimnames, r.dimnames.map((l) => l.map(String)));
            if (e.cells !== undefined) {
              const cells = e.cells as (string[] | null)[];
              const got = r.values as (AggregateValue | null)[];
              cmp.strings(index, "cells (empty)", cells.map((x) => x === null), got.map((x) => x === null));
              cells.forEach((x, k) => {
                if (x !== null && got[k] != null) cmp.numbers(index, `cells[${k}]`, x, got[k]);
              });
            } else cmp.numbers(index, "values", e.values, r.values);
            break;
          }
          case "split": {
            const options = { drop: a.drop === true };
            const groups = e.groups as (string[] | Record<string, string[]>)[];
            if (a.x === undefined) {
              const r = split(data, labels, options);
              cmp.strings(index, "names", e.names, [...r.keys()]);
              [...r.values()].forEach((d, k) => groups[k] !== undefined && frame(`groups[${k}]`, groups[k] as Record<string, string[]>, d));
            } else {
              const r = split(data[a.x as string] as number[], labels, options);
              cmp.strings(index, "names", e.names, [...r.keys()]);
              cmp.strings(index, "group sizes", groups.map((g) => (g as string[]).length), [...r.values()].map((g) => g.length));
              cmp.numbers(index, "groups", groups, [...r.values()]);
            }
            break;
          }
          case "aggregate":
            frame("result", e.result as Record<string, string[]>, aggregate(a.formula as string, data, fun!));
            break;
          case "aggregate.by": {
            const x: DataFrame = Object.fromEntries((a.cols as string[]).map((n) => [n, data[n]!]));
            frame("result", e.result as Record<string, string[]>, aggregate(x, Object.fromEntries(by.map((b) => [b, data[b]!])), fun!));
            break;
          }
          default:
            throw new Error(`unknown fn ${String(a.fn)}`);
        }
      } catch (err) {
        const msg = (err as Error).message;
        if (e.error === undefined) return cmp.fail(index, "(exception)", "result", msg);
        errors++;
        if (msg !== e.error) cmp.fail(index, "error", e.error, msg);
        return;
      }
      if (e.error !== undefined) cmp.fail(index, "(exception)", e.error, "no exception thrown");
    });
    console.log(cmp.summary("grouping", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 20).join("\n")).toEqual([]);
  });

  it("errors when fun returns values of different lengths", () => {
    expect(() => aggregate("y ~ g", { y: [1, 2, 3], g: ["a", "b", "b"] }, (v) => v)).toThrow(
      "fun must return values of the same length for every group",
    );
  });
});
