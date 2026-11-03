// Issue #445: pivotWider gives the valuesFn results of a value column one common type, as tidyr
// (review_fix_log_issue445.md; the fill side is #437).
import { describe, expect, it } from "vitest";
import { pivotWider, type PivotSummary } from "../src/index.js";

const plain = (df: Record<string, ArrayLike<unknown>>) =>
  Object.fromEntries(Object.entries(df).map(([k, v]) => [k, Array.from(v)]));

// tidyr 1.3.2: d2 <- data.frame(id = c("a", "b"), name = c("x", "x"), value = c(1, 2)); pivot_wider(d2, values_fn = f)
const one = (f: PivotSummary) => pivotWider({ id: ["a", "b"], name: ["x", "x"], value: Float64Array.of(1, 2) }, { valuesFn: f });

describe("issue #445", () => {
  it("makes booleans numbers when a summary is a number", () => {
    // tidyr: TRUE and 2 give x 1 2 (double); NA and 2 give NA 2
    const r = one((v) => (v[0] === 1 ? true : 2));
    expect(r.x).toBeInstanceOf(Float64Array);
    expect(plain(r)).toEqual({ id: ["a", "b"], x: [1, 2] });
    expect(plain(one((v) => (v[0] === 1 ? null : 2)))).toEqual({ id: ["a", "b"], x: [NaN, 2] });
    expect(plain(one((v) => (v[0] === 1 ? NaN : true)))).toEqual({ id: ["a", "b"], x: [NaN, 1] });
    // tidyr: all logical stays logical (TRUE FALSE)
    expect(plain(one((v) => v[0] === 1))).toEqual({ id: ["a", "b"], x: [true, false] });
  });

  it("takes one type over all new columns of a value column", () => {
    // tidyr: d <- data.frame(id = c("a", "b"), name = c("x", "y"), value = c(1, 2)), f TRUE / 2: x 1 NA, y NA 2
    const d = { id: ["a", "b"], name: ["x", "y"], value: Float64Array.of(1, 2) };
    const r = pivotWider(d, { valuesFn: (v) => (v[0] === 1 ? true : 2) });
    expect(r.x).toBeInstanceOf(Float64Array);
    expect(plain(r)).toEqual({ id: ["a", "b"], x: [1, NaN], y: [NaN, 2] });
    // tidyr: with values_fill = TRUE: x 1 1, y 1 2
    expect(plain(pivotWider(d, { valuesFn: (v) => (v[0] === 1 ? true : 2), valuesFill: true }))).toEqual({
      id: ["a", "b"],
      x: [1, 1],
      y: [1, 2],
    });
    // tidyr: values_fn = function(x) x > 1 with fill 0: x FALSE FALSE, y FALSE TRUE; fill 5 is an error
    expect(plain(pivotWider(d, { valuesFn: (v) => (v[0] as number) > 1, valuesFill: 0 }))).toEqual({
      id: ["a", "b"],
      x: [false, false],
      y: [false, true],
    });
    expect(() => pivotWider(d, { valuesFn: (v) => (v[0] as number) > 1, valuesFill: 5 })).toThrow("due to loss of precision");
  });

  it("rejects strings mixed with numbers or booleans, numbering the cells as tidyr", () => {
    expect(() => one((v) => (v[0] === 1 ? "a" : 2))).toThrow("Can't combine `x[[1]]` <character> and `x[[2]]` <double>.");
    expect(() => one((v) => (v[0] === 1 ? true : "b"))).toThrow("Can't combine `x[[1]]` <logical> and `x[[2]]` <character>.");
    // tidyr: the cells in order of first appearance; a boolean then a number keep the number's place
    // data.frame(id = c("b", "a"), name = "q", val = c(2, 1)), f 2 -> "s" else 2: `x[[1]]` <character> and `x[[2]]` <double>
    expect(() =>
      pivotWider({ id: ["b", "a"], name: ["q", "q"], val: [2, 1] }, { valuesFrom: "val", valuesFn: (v) => (v[0] === 2 ? "s" : 2) }),
    ).toThrow("Can't combine `x[[1]]` <character> and `x[[2]]` <double>.");
    // data.frame(id = c("a", "b", "a"), name = c("q", "r", "r"), val = 1:3), f TRUE / 2 / "s":
    // `x[[2]]` <double> and `x[[3]]` <character>
    expect(() =>
      pivotWider(
        { id: ["a", "b", "a"], name: ["q", "r", "r"], val: [1, 2, 3] },
        { valuesFrom: "val", valuesFn: (v) => (v[0] === 1 ? true : v[0] === 2 ? 2 : "s") },
      ),
    ).toThrow("Can't combine `x[[2]]` <double> and `x[[3]]` <character>.");
  });
});
