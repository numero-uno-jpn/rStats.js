// fromRows and toRows: the conversion between arrays of row objects and data frames (objects of columns). Not R
// functions, so there is no fixture: the expected values are written out.
import { describe, expect, it } from "vitest";
import { fromRows, toRows, tTest } from "../src/index.js";

describe("fromRows", () => {
  it("collects the keys of all rows in order of first appearance; a missing key or undefined is null", () => {
    expect(fromRows([{ id: "a", score: 5 }, { id: "b", age: 30 }, { score: undefined, id: "c" }])).toEqual({
      id: ["a", "b", "c"],
      score: [5, null, null],
      age: [null, 30, null],
    });
  });

  it("keeps NaN, booleans and null; takes the given columns in the given order", () => {
    const rows = [{ x: NaN, ok: true, s: null }, { x: 2, ok: false, s: "u" }];
    expect(fromRows(rows)).toEqual({ x: [NaN, 2], ok: [true, false], s: [null, "u"] });
    expect(fromRows(rows, { columns: ["s", "x"] })).toEqual({ s: [null, "u"], x: [NaN, 2] });
    expect(fromRows(rows, { columns: ["none"] })).toEqual({ none: [null, null] });
  });

  it("gives an empty data frame for no rows, and empty columns when they are named", () => {
    expect(fromRows([])).toEqual({});
    expect(fromRows([], { columns: ["a"] })).toEqual({ a: [] });
  });

  it("rejects values that are not numbers, strings, booleans or null, and columns of mixed types", () => {
    expect(() => fromRows([{ d: new Date(0) }])).toThrow(TypeError);
    expect(() => fromRows([{ v: { nested: 1 } }])).toThrow("row 0, column 'v'");
    expect(() => fromRows([{ v: 1 }, { v: "1" }])).toThrow("column 'v' mixes number and string values");
  });

  it("feeds the data frame functions", () => {
    const rows = [
      { arm: "drug", score: 7.1 }, { arm: "drug", score: 6.4 }, { arm: "drug", score: 8.0 },
      { arm: "placebo", score: 5.2 }, { arm: "placebo", score: 6.0 }, { arm: "placebo", score: 4.9 },
    ];
    const byForm = tTest("score ~ arm", fromRows(rows));
    const byVectors = tTest([7.1, 6.4, 8.0], [5.2, 6.0, 4.9]);
    expect(byForm.statistic).toBe(byVectors.statistic);
    expect(byForm.pValue).toBe(byVectors.pValue);
  });
});

describe("toRows", () => {
  it("is the inverse of fromRows", () => {
    const rows = [{ id: "a", score: 5, ok: true }, { id: "b", score: null, ok: false }];
    expect(toRows(fromRows(rows))).toEqual(rows);
  });

  it("reads Float64Array columns and keeps NaN", () => {
    expect(toRows({ x: Float64Array.from([1, NaN]), g: ["p", "q"] })).toEqual([{ x: 1, g: "p" }, { x: NaN, g: "q" }]);
  });

  it("gives no rows for a data frame without columns, and rejects columns of different lengths", () => {
    expect(toRows({})).toEqual([]);
    expect(() => toRows({ a: [1, 2], b: [1] })).toThrow(RangeError);
  });
});
