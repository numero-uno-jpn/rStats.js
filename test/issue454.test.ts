// Issue #454: modelMatrix reads `contrasts` from own properties only (review_fix_log_issue454.md).
import { describe, expect, it } from "vitest";
import { modelMatrix } from "../src/index.js";

const d = { toString: ["a", "b", "a"], constructor: ["x", "y", "y"] };

describe("issue #454", () => {
  it("does not take inherited properties as contrasts", () => {
    // R: model.matrix(~ toString + constructor, data.frame(toString = c("a", "b", "a"), constructor = c("x", "y", "y")))
    const m = modelMatrix("~ toString + constructor", d, { contrasts: {} });
    expect(m.colNames).toEqual(["(Intercept)", "toStringb", "constructory"]);
    expect(m.x).toEqual([
      [1, 0, 0],
      [1, 1, 1],
      [1, 0, 1],
    ]);
  });

  it("uses own contrasts as before", () => {
    // R: contrasts.arg = list(toString = "contr.sum") gives toString1 = (1, -1, 1)
    const m = modelMatrix("~ toString", d, { contrasts: { toString: "contr.sum" as const } });
    expect(m.colNames).toEqual(["(Intercept)", "toString1"]);
    expect(m.x.map((r) => r[1])).toEqual([1, -1, 1]);
  });
});
