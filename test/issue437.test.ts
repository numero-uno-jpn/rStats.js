// Issue #437: pivotWider casts valuesFill to the type of the value column, as tidyr (review_fix_log_issue437.md).
import { describe, expect, it } from "vitest";
import { pivotWider } from "../src/index.js";

const plain = (df: Record<string, ArrayLike<unknown>>) =>
  Object.fromEntries(Object.entries(df).map(([k, v]) => [k, Array.from(v)]));

// tidyr 1.3.2: d <- data.frame(id = c("a", "b"), name = c("x", "y"), value = ...); pivot_wider(d, values_fill = ...)
const wide = (value: ArrayLike<unknown>, fill: unknown) =>
  pivotWider({ id: ["a", "b"], name: ["x", "y"], value } as never, { valuesFill: fill as never });

describe("issue #437", () => {
  it("casts the fill of a numeric column", () => {
    const dbl = Float64Array.of(1, 2);
    // tidyr: "Can't convert `fill` <character> to <double>."
    expect(() => wide(dbl, "missing")).toThrow("Can't convert `fill` <character> to <double>.");
    expect(() => wide([1, 2], "missing")).toThrow("Can't convert `fill` <character> to <double>.");
    // tidyr: values_fill = TRUE gives x 1 1, y 1 2 (double)
    const t = wide(dbl, true);
    expect(t.x).toBeInstanceOf(Float64Array);
    expect(plain(t)).toEqual({ id: ["a", "b"], x: [1, 1], y: [1, 2] });
    expect(plain(wide([1, 2], true))).toEqual({ id: ["a", "b"], x: [1, 1], y: [1, 2] });
    // unchanged: 0 and missing
    expect(plain(wide(dbl, 0))).toEqual({ id: ["a", "b"], x: [1, 0], y: [0, 2] });
    expect(plain(wide(dbl, null))).toEqual({ id: ["a", "b"], x: [1, NaN], y: [NaN, 2] });
  });

  it("casts the fill of a boolean column", () => {
    const lgl = [true, false];
    // tidyr: fill 0 gives x TRUE FALSE, y FALSE FALSE; fill 1 gives x TRUE TRUE, y TRUE FALSE; NaN gives NA
    expect(plain(wide(lgl, 0))).toEqual({ id: ["a", "b"], x: [true, false], y: [false, false] });
    expect(plain(wide(lgl, 1))).toEqual({ id: ["a", "b"], x: [true, true], y: [true, false] });
    expect(plain(wide(lgl, NaN))).toEqual({ id: ["a", "b"], x: [true, null], y: [null, false] });
    // tidyr: fill 2 and 0.5 "Can't convert from `fill` <double> to <logical> due to loss of precision."
    expect(() => wide(lgl, 2)).toThrow("Can't convert from `fill` <double> to <logical> due to loss of precision.");
    expect(() => wide(lgl, 0.5)).toThrow("due to loss of precision");
    expect(() => wide(lgl, "z")).toThrow("Can't convert `fill` <character> to <logical>.");
  });

  it("does not mix a string column with other fills", () => {
    const chr = ["u", "v"];
    expect(() => wide(chr, 0)).toThrow("Can't convert `fill` <double> to <character>.");
    expect(() => wide(chr, true)).toThrow("Can't convert `fill` <logical> to <character>.");
    expect(plain(wide(chr, null))).toEqual({ id: ["a", "b"], x: ["u", null], y: [null, "v"] });
  });

  it("casts the fill of each value column", () => {
    // tidyr: dm <- data.frame(id, name, v1 = c(1, 2), v2 = c("p", "q")), values_from = c(v1, v2)
    const dm = { id: ["a", "b"], name: ["x", "y"], v1: Float64Array.of(1, 2), v2: ["p", "q"] };
    expect(plain(pivotWider(dm, { valuesFrom: ["v1", "v2"], valuesFill: { v1: 0, v2: "-" } }))).toEqual({
      id: ["a", "b"],
      v1_x: [1, 0],
      v1_y: [0, 2],
      v2_x: ["p", "-"],
      v2_y: ["-", "q"],
    });
    expect(() => pivotWider(dm, { valuesFrom: ["v1", "v2"], valuesFill: { v1: "-", v2: "-" } })).toThrow(
      "Can't convert `fill` <character> to <double>.",
    );
    expect(() => pivotWider(dm, { valuesFrom: ["v1", "v2"], valuesFill: 0 })).toThrow(
      "Can't convert `fill` <double> to <character>.",
    );
  });

  it("casts the fill to the type of the summaries", () => {
    // tidyr: values_fn = length on a character column with fill "z": "Can't convert `fill` <character> to <integer>."
    const dc = { id: ["a", "b"], name: ["x", "y"], value: ["u", "v"] };
    expect(() => pivotWider(dc, { valuesFn: (v) => v.length, valuesFill: "z" })).toThrow("Can't convert `fill` <character>");
    expect(plain(pivotWider(dc, { valuesFn: (v) => v.length, valuesFill: 0 }))).toEqual({ id: ["a", "b"], x: [1, 0], y: [0, 1] });
  });

  it("rejects a value column that mixes types (no valuesFn)", () => {
    expect(() => wide([1, true], 0)).toThrow("column 'value' mixes double and logical values");
  });
});
