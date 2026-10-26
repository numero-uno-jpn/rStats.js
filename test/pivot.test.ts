// pivotLonger and pivotWider against tidyr (oracle/pivot.R; behaviour in oracle/pivot-behaviour.md). Values, column
// names, row order and warnings must match exactly. Every case runs twice: with the numeric columns as arrays of
// numbers and as Float64Arrays (the columns copied through must stay Float64Arrays).
import { describe, expect, it } from "vitest";
import {
  mean, pivotLonger, pivotWider, sum,
  type DataFrame, type DataValue, type PivotLongerOptions, type PivotResult, type PivotSummary, type PivotWiderOptions,
} from "../src/index.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

const fixture = loadAnovaFixture("pivot");

type ColumnType = "numeric" | "character" | "logical";

/** The fixture's values_fn as the library's functions, or plain JavaScript where it has none */
const FUNS: Record<string, PivotSummary> = {
  mean: (v) => mean(v as number[]),
  sum: (v) => sum(v as number[]),
  length: (v) => v.length,
};

/** A fixture data frame with its numeric columns as Float64Arrays */
function withFloat64(frame: DataFrame, types: Record<string, ColumnType>): DataFrame {
  const out: DataFrame = {};
  for (const [k, col] of Object.entries(frame)) {
    out[k] = types[k] === "numeric" ? Float64Array.from(col as (number | null)[], (v) => v ?? NaN) : col;
  }
  return out;
}

const names = (v: unknown): string[] => ([] as string[]).concat(v as string | string[]);

/** The result of one case, or the message of the error thrown */
function run(a: Record<string, unknown>, data: DataFrame): PivotResult | { error: string } {
  try {
    if (a.fn === "pivot_longer") {
      const options: PivotLongerOptions = {
        cols: names(a.cols),
        ...(a.names_to === undefined ? {} : { namesTo: names(a.names_to) }),
        ...(a.values_to === undefined ? {} : { valuesTo: a.values_to as string }),
        ...(a.names_prefix === undefined ? {} : { namesPrefix: a.names_prefix as string }),
        ...(a.names_sep === undefined ? {} : { namesSep: a.names_sep as string }),
        ...(a.names_pattern === undefined ? {} : { namesPattern: a.names_pattern as string }),
        ...(a.values_drop_na === undefined ? {} : { valuesDropNa: a.values_drop_na as boolean }),
        ...(a.cols_vary === undefined ? {} : { colsVary: a.cols_vary as "fastest" | "slowest" }),
        ...(a.names_transform === "integer" ? { namesTransform: { [a.names_to as string]: Number } } : {}),
      };
      return pivotLonger(data, options);
    }
    if (a.fn === "pivot_wider") {
      const options: PivotWiderOptions = {
        namesFrom: names(a.names_from),
        valuesFrom: names(a.values_from),
        ...(a.id_cols === undefined ? {} : { idCols: names(a.id_cols) }),
        ...(a.names_prefix === undefined ? {} : { namesPrefix: a.names_prefix as string }),
        ...(a.names_sep === undefined ? {} : { namesSep: a.names_sep as string }),
        ...(a.names_sort === undefined ? {} : { namesSort: a.names_sort as boolean }),
        ...(a.names_vary === undefined ? {} : { namesVary: a.names_vary as "fastest" | "slowest" }),
        // every value column of the fixture is numeric
        ...(a.values_fill === undefined ? {} : { valuesFill: Number(a.values_fill) }),
        ...(a.values_fn === undefined ? {} : { valuesFn: FUNS[a.values_fn as string]! }),
      };
      return pivotWider(data, options);
    }
    throw new Error(`unknown fn ${String(a.fn)}`);
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/** Whether a value is of a column type (null: missing in any column; NaN: missing in a numeric one) */
const ofType = (v: DataValue, type: ColumnType): boolean =>
  v === null || typeof v === (type === "numeric" ? "number" : type === "character" ? "string" : "boolean");

describe("pivotLonger, pivotWider", () => {
  it(`match tidyr (${fixture.r_version})`, () => {
    const failures: string[] = [];
    let compared = 0;
    for (const float64 of [false, true]) {
      fixture.cases.forEach((c, index) => {
        const a = c.args;
        const e = c.expected;
        const tag = `#${index}${float64 ? " (Float64Array)" : ""}`;
        const types = a.dataTypes as Record<string, ColumnType>;
        const plain = dataFrameOf(a.data, types);
        const r = run(a, float64 ? withFloat64(plain, types) : plain);
        if ("error" in r) {
          // tidyr's list column for duplicated cells (its warning in the fixture) is an error here
          const duplicated = e.error === undefined && (e.warnings as string[]).some((w) => w.includes("not uniquely identified"));
          const want = duplicated
            ? `values from '${names(a.values_from)[0]!}' are not uniquely identified; use valuesFn to summarise them`
            : e.error;
          if (r.error !== want) failures.push(`${tag} error: want ${JSON.stringify(want)} / TS ${JSON.stringify(r.error)}`);
          return;
        }
        if (e.error !== undefined) return failures.push(`${tag}: R error ${JSON.stringify(e.error)}, TS no error`);
        if (JSON.stringify(r.warnings) !== JSON.stringify(e.warnings)) {
          failures.push(`${tag} warnings: R ${JSON.stringify(e.warnings)} / TS ${JSON.stringify(r.warnings)}`);
        }
        const want = e.names as string[];
        if (JSON.stringify(Object.keys(r.data)) !== JSON.stringify(want)) {
          return failures.push(`${tag} names: R ${JSON.stringify(want)} / TS ${JSON.stringify(Object.keys(r.data))}`);
        }
        // Columns of the data keep their type; the names columns are strings (numbers with names_transform); the
        // value columns of the fixture are all numeric
        const namesTo = a.fn === "pivot_longer" ? names(a.names_to ?? "name") : [];
        const typeOf = (n: string): ColumnType =>
          types[n] ?? (namesTo.includes(n) ? (a.names_transform === undefined ? "character" : "numeric") : "numeric");
        const result = e.result as Record<string, (string | boolean | null)[]>;
        for (const n of want) {
          const exp = result[n]!;
          const col = r.data[n]!;
          const act = Array.from(col as ArrayLike<DataValue>);
          const type = typeOf(n);
          if (float64 && types[n] === "numeric" && !(col instanceof Float64Array)) failures.push(`${tag} ${n}: not a Float64Array`);
          if (act.length !== exp.length) {
            failures.push(`${tag} ${n}: R ${JSON.stringify(exp)} / TS ${JSON.stringify(act)}`);
            continue;
          }
          exp.forEach((ev, k) => {
            const av = act[k]!;
            compared++;
            let ok = ofType(av, type);
            if (type === "numeric") ok &&= ev === "NA" ? av === null || Number.isNaN(av) : av === Number(ev);
            else ok &&= av === ev;
            if (!ok) failures.push(`${tag} ${n}[${k}]: R ${JSON.stringify(ev)} / TS ${JSON.stringify(av)}`);
          });
        }
      });
    }
    expect(failures).toEqual([]);
    expect(compared).toBeGreaterThan(0);
  });

  it("duplicated cells: tidyr warns and makes a list column, here an error", () => {
    // case #20 of the fixture
    const c = fixture.cases.find(
      (x) => x.args.fn === "pivot_wider" && x.args.values_fn === undefined && (x.expected.warnings as string[]).length > 0,
    )!;
    expect((c.expected.warnings as string[])[0]).toMatch(/^Values from `y` are not uniquely identified; output will contain list-cols\./);
    expect(c.expected.result).toEqual({ id: ["1", "2"], a: ["1,2", "4"], b: ["3", ""] });
    const data = dataFrameOf(c.args.data, c.args.dataTypes);
    expect(() => pivotWider(data, { namesFrom: "time", valuesFrom: "y" })).toThrow(
      "values from 'y' are not uniquely identified; use valuesFn to summarise them",
    );
  });
});

describe("pivotLonger, pivotWider: API", () => {
  const wide = { id: ["s1", "s2"], t1: [5.1, 4.8], t2: [6.3, 7.2] };

  it("the doc examples", () => {
    expect(pivotLonger(wide, { cols: ["t1", "t2"], namesTo: "time", valuesTo: "score" })).toEqual({
      data: { id: ["s1", "s1", "s2", "s2"], time: ["t1", "t2", "t1", "t2"], score: [5.1, 6.3, 4.8, 7.2] },
      warnings: [],
    });
    const long = { id: ["s1", "s1", "s2"], time: ["t1", "t2", "t1"], score: [5.1, 6.3, 4.8] };
    expect(pivotWider(long, { namesFrom: "time", valuesFrom: "score" }).data).toEqual({
      id: ["s1", "s2"],
      t1: [5.1, 4.8],
      t2: [6.3, null],
    });
  });

  it("selects with a function in the data's order; errors", () => {
    expect(pivotLonger(wide, { cols: (n) => n.startsWith("t") }).data).toEqual(pivotLonger(wide, { cols: ["t1", "t2"] }).data);
    expect(() => pivotLonger(wide, { cols: ["t1"], namesSep: "_" })).toThrow("`names_sep` can't be used with a length 1 `names_to`.");
    expect(() => pivotLonger(wide, { cols: ["t1"], namesTo: ["a", "b"] })).toThrow(
      "If you supply multiple names in `names_to` you must also supply one of `names_sep` or `names_pattern`.",
    );
    expect(() => pivotLonger(wide, { cols: ["t1"], namesTo: ["a", "b"], namesPattern: "(t)(\\d)(x)?" })).toThrow(
      "`regex` should define 2 groups; 3 found.",
    );
  });

  it("valuesFill and valuesFn by value column", () => {
    const long = { id: [1, 1, 2], k: ["a", "a", "b"], x: [1, 2, 3], y: ["u", "v", "w"] };
    const r = pivotWider(long, {
      namesFrom: "k",
      valuesFrom: ["x", "y"],
      valuesFill: { x: 0 },
      valuesFn: { x: (v) => sum(v as number[]), y: (v) => v.join("") },
    });
    expect(r.data).toEqual({ id: [1, 2], x_a: [3, 0], x_b: [0, 3], y_a: ["uv", null], y_b: [null, "w"] });
  });
});
