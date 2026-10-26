// merge, subset, and rbind / cbind of data frames against R (oracle/dataframes.R; behaviour in
// oracle/dataframes-behaviour.md). Values, column names and row order must match exactly. Every case runs twice: with
// the numeric columns as arrays of numbers and as Float64Arrays (which must stay Float64Arrays).
import { describe, expect, it } from "vitest";
import { cbind, merge, rbind, subset, type DataFrame, type MergeOptions } from "../src/index.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("dataFrames");

type ColumnType = "numeric" | "character" | "logical";

/** A fixture data frame with its numeric columns as Float64Arrays */
function withFloat64(frame: DataFrame, types: Record<string, ColumnType>): DataFrame {
  const out: DataFrame = {};
  for (const [k, col] of Object.entries(frame)) {
    out[k] = types[k] === "numeric" ? Float64Array.from(col as (number | null)[], (v) => v ?? NaN) : col;
  }
  return out;
}

const names = (v: unknown): string[] | undefined => (v === undefined ? undefined : ([] as string[]).concat(v as string | string[]));

/** The result of one case, or the message of the error thrown */
function run(a: Record<string, unknown>, frame: (name: string) => DataFrame): DataFrame | { error: string } {
  try {
    switch (a.fn) {
      case "merge": {
        const options: MergeOptions = {
          ...(a.by === undefined ? {} : { by: names(a.by)! }),
          ...(a["by.x"] === undefined ? {} : { byX: names(a["by.x"])! }),
          ...(a["by.y"] === undefined ? {} : { byY: names(a["by.y"])! }),
          ...(a.all === undefined ? {} : { all: a.all as boolean }),
          ...(a["all.x"] === undefined ? {} : { allX: a["all.x"] as boolean }),
          ...(a["all.y"] === undefined ? {} : { allY: a["all.y"] as boolean }),
          ...(a.sort === undefined ? {} : { sort: a.sort as boolean }),
          ...(a.suffixes === undefined ? {} : { suffixes: a.suffixes as [string, string] }),
        };
        return merge(frame("x"), frame("y"), options);
      }
      case "subset": {
        const keep = a.keep as (boolean | null)[];
        return a.select === undefined ? subset(frame("data"), keep) : subset(frame("data"), keep, { select: names(a.select)! });
      }
      case "rbind":
        return rbind(frame("x"), frame("y"));
      case "cbind":
        return cbind(frame("x"), frame("y"));
    }
    throw new Error(`unknown fn ${String(a.fn)}`);
  } catch (err) {
    return { error: (err as Error).message };
  }
}

describe("data frames", () => {
  it(`match R (${fixture.r_version})`, () => {
    const failures: string[] = [];
    let compared = 0;
    for (const float64 of [false, true]) {
      fixture.cases.forEach((c, index) => {
        const a = c.args;
        const e = c.expected;
        const tag = `#${index}${float64 ? " (Float64Array)" : ""}`;
        const types: Record<string, ColumnType> = {};
        const frame = (name: string): DataFrame => {
          const ty = a[`${name}Types`] as Record<string, ColumnType>;
          Object.assign(types, ty);
          const f = dataFrameOf(a[name], ty);
          return float64 ? withFloat64(f, ty) : f;
        };
        const r = run(a, frame);
        if ("error" in r && typeof r.error === "string") {
          if (r.error !== e.error) failures.push(`${tag} error: R ${JSON.stringify(e.error)} / TS ${JSON.stringify(r.error)}`);
          return;
        }
        if (e.error !== undefined) return failures.push(`${tag}: R error ${JSON.stringify(e.error)}, TS no error`);
        const frameOut = r as DataFrame;
        const want = e.names as string[];
        if (JSON.stringify(Object.keys(frameOut)) !== JSON.stringify(want)) {
          return failures.push(`${tag} names: R ${JSON.stringify(want)} / TS ${JSON.stringify(Object.keys(frameOut))}`);
        }
        const suffixes = (a.suffixes as string[] | undefined) ?? [".x", ".y"];
        const typeOf = (n: string): ColumnType | undefined =>
          types[n] ?? suffixes.map((s) => (n.endsWith(s) ? types[n.slice(0, -s.length)] : undefined)).find((t) => t !== undefined);
        const result = e.result as Record<string, (string | boolean | null)[]>;
        for (const n of want) {
          const exp = result[n]!;
          const act = Array.from(frameOut[n]! as ArrayLike<number | string | boolean | null>);
          const type = typeOf(n);
          if (type === undefined) {
            failures.push(`${tag} ${n}: no column type`);
            continue;
          }
          if (float64 && type === "numeric" && !(frameOut[n] instanceof Float64Array)) failures.push(`${tag} ${n}: not a Float64Array`);
          if (act.length !== exp.length) {
            failures.push(`${tag} ${n}: R ${JSON.stringify(exp)} / TS ${JSON.stringify(act)}`);
            continue;
          }
          exp.forEach((ev, k) => {
            const av = act[k];
            compared++;
            let ok: boolean;
            if (type === "numeric") {
              ok = ev === "NA" || ev === null ? av === null || Number.isNaN(av) : av === Number(ev);
            } else ok = av === ev;
            if (!ok) failures.push(`${tag} ${n}[${k}]: R ${JSON.stringify(ev)} / TS ${JSON.stringify(av)}`);
          });
        }
      });
    }
    expect(failures).toEqual([]);
    expect(compared).toBeGreaterThan(0);
  });
});

describe("data frames: API", () => {
  const x = { id: [3, 1, 2], v: [10, 20, 30] };
  const y = { id: [1, 2, 2, 4], w: [0.5, 1.5, 2.5, 3.5] };

  it("merge: errors and the cross join", () => {
    expect(() => merge(x, y, { byX: "id", byY: ["id", "w"] })).toThrow("'by.x' and 'by.y' specify different numbers of columns");
    expect(merge({ a: [1, 2] }, { b: ["u", "v"] })).toEqual({ a: [1, 2, 1, 2], b: ["u", "u", "v", "v"] });
    expect(merge(x, y)).toEqual({ id: [1, 2, 2], v: [20, 30, 30], w: [0.5, 1.5, 2.5] });
  });

  it("subset: a function of the row, and errors", () => {
    const d = { y: [5, NaN, 7, 2], g: ["a", "b", "a", null] };
    expect(subset(d, (row) => (row.y as number) > 4)).toEqual({ y: [5, 7], g: ["a", "a"] });
    expect(subset(d, (row) => (row.g === null ? null : row.g === "a"), { select: ["g", "y"] })).toEqual({ g: ["a", "a"], y: [5, 7] });
    expect(() => subset(d, [true])).toThrow(RangeError);
    expect(() => subset(d, [true, true, true, true], { select: ["nope"] })).toThrow("undefined columns selected");
  });

  it("rbind / cbind: errors; matrices unchanged", () => {
    expect(() => cbind({ a: [1, 2] }, { b: [1, 2, 3] })).toThrow("arguments imply differing number of rows: 2, 3");
    expect(() => cbind({ a: [1, 2] }, { a: [3, 4] })).toThrow("duplicate column name 'a'");
    expect(rbind({ a: [1], b: ["u"] }, { b: ["v"], a: [2] }, { a: [3], b: ["w"] })).toEqual({ a: [1, 2, 3], b: ["u", "v", "w"] });
    expect(rbind([1, 2], [3, 4])).toEqual([[1, 2], [3, 4]]);
    expect(cbind([1, 2], [3, 4])).toEqual([[1, 3], [2, 4]]);
  });
});
