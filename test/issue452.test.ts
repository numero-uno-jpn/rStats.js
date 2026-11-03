// Issue #452: the model frame reads `levels` from own properties only (review_fix_log_issue452.md).
import { describe, expect, it } from "vitest";
import { modelMatrix } from "../src/index.js";
import { modelFrame } from "../src/models/modelFrame.js";

describe("issue #452", () => {
  it("does not take inherited properties as given levels", () => {
    // R: model.matrix(~ toString + constructor, data.frame(toString = c("b", "a", "b"), constructor = c("x", "y", "y")))
    const d = { toString: ["b", "a", "b"], constructor: ["x", "y", "y"] };
    const m = modelMatrix("~ toString + constructor", d, { levels: {} });
    expect(m.colNames).toEqual(["(Intercept)", "toStringb", "constructory"]);
    expect(m.x).toEqual([
      [1, 1, 0],
      [1, 0, 1],
      [1, 1, 1],
    ]);
    // __proto__ is not a name in a formula; the frame itself
    const frame = modelFrame(JSON.parse('{"__proto__":["b","a"]}'), ["__proto__"], { levels: {} });
    expect(frame.rows).toEqual([0, 1]);
    expect(frame.variables[0]).toEqual({ kind: "factor", levels: ["a", "b"], codes: [1, 0] });
  });

  it("uses own levels as before", () => {
    const m = modelMatrix("~ toString", { toString: ["b", "a", "b"] }, { levels: { toString: ["b", "a"] } });
    expect(m.colNames).toEqual(["(Intercept)", "toStringa"]);
    expect(m.x.map((r) => r[1])).toEqual([0, 1, 0]);
  });
});
