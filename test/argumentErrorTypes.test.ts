// The argument errors of pivotLonger, pivotWider, merge and the formula forms of the tests are TypeError (wrong type or
// shape, including a formula of the wrong form) or RangeError (a value out of range: a column that does not exist, an
// empty selection, an unknown choice). Input whose result is not defined stays an Error (CONTRIBUTING, Style).
import { describe, expect, it } from "vitest";
import { corTest, friedmanTest, kruskalTest, merge, onewayTest, pivotLonger, pivotWider, tTest, varTest } from "../src/index.js";

const throwsType = (f: () => unknown, type: ErrorConstructor, message: string) => {
  expect(f).toThrow(message);
  try {
    f();
  } catch (e) {
    expect((e as Error).constructor).toBe(type);
  }
};

describe("pivotLonger and pivotWider: argument errors", () => {
  const wide = { id: ["s1", "s2"], t1: [1, 2], t2: [3, 4] };
  const long = { id: [1, 1, 2], name: ["a", "a", "b"], value: [1, 2, 3] };
  const dotValue = (transform: (x: string) => unknown) => ({
    cols: ["mean_x", "sd_x"],
    namesTo: [".value", "group"],
    namesSep: "_",
    namesTransform: { ".value": transform as (x: string) => string },
  });

  it("TypeError for a wrong type or shape", () => {
    throwsType(() => pivotLonger(wide, { cols: ["t1"], colsVary: 1 as never }), TypeError, "`cols_vary` must be a string");
    throwsType(() => pivotLonger(wide, { cols: ["t1"], namesSep: "_" }), TypeError, "`names_sep` can't be used");
    throwsType(() => pivotLonger(wide, { cols: ["t1"], namesTo: ["a", "b"] }), TypeError, "you must also supply");
    throwsType(
      () => pivotLonger(wide, { cols: ["t1"], namesTo: ["a", "b"], namesPattern: "(t)(\\d)(x)?" }),
      TypeError,
      "`regex` should define 2 groups; 3 found.",
    );
    throwsType(() => pivotLonger({ mean_x: [1], sd_x: [2] }, dotValue((x) => x.length)), TypeError, "must give strings");
  });

  it("RangeError for a value out of range", () => {
    throwsType(
      () => pivotLonger(wide, { cols: ["t1"], colsVary: "middle" as never }),
      RangeError,
      '`cols_vary` must be one of "fastest" or "slowest"',
    );
    throwsType(() => pivotLonger(wide, { cols: ["zz"] }), RangeError, "Column `zz` doesn't exist.");
    throwsType(() => pivotLonger(wide, { cols: [] }), RangeError, "`cols` must select at least one column.");
    throwsType(() => pivotLonger(wide, { cols: ["t1"], namesTo: [".value", ".value"], namesSep: "_" }), RangeError, "only once");
    throwsType(
      () => pivotLonger({ mean_x: [1], MEAN_x: [2] }, { ...dotValue((x) => x.toUpperCase()), cols: ["mean_x", "MEAN_x"] }),
      RangeError,
      "twice for one key",
    );
    throwsType(() => pivotWider(long, { namesFrom: [] }), RangeError, "`names_from` must select at least one column.");
    throwsType(() => pivotWider(long, { idCols: ["value"] }), RangeError, "`id_cols` can't select a column already selected");
    throwsType(() => pivotWider(long), RangeError, "values from 'value' are not uniquely identified");
  });
});

describe("merge: argument errors", () => {
  const x = { id: [3, 1, 2], v: [10, 20, 30] };
  const y = { id: [1, 2, 2, 4], w: [0.5, 1.5, 2.5, 3.5] };

  it("TypeError for by.x and by.y of different lengths, RangeError for a key that is not a column", () => {
    throwsType(() => merge(x, y, { byX: "id", byY: ["id", "w"] }), TypeError, "'by.x' and 'by.y' specify different numbers");
    throwsType(() => merge(x, y, { by: "zz" }), RangeError, "'by' must specify a uniquely valid column");
  });
});

describe("formula forms of the tests: a formula of the wrong form is a TypeError", () => {
  const d = {
    y: [1, 2, 3, 4, 5, 6],
    g: ["a", "a", "b", "b", "c", "c"],
    h: ["u", "v", "u", "v", "u", "v"],
    z: [2, 1, 4, 3, 6, 5],
  };

  it("TypeError for the form, Error for data that define no result", () => {
    throwsType(() => tTest("~ g", d), TypeError, "'formula' missing or incorrect");
    throwsType(() => tTest("y ~ g + h", d), TypeError, "'formula' missing or incorrect");
    throwsType(() => tTest("Pair(y, z) ~ g", d), TypeError, "'formula' missing or incorrect");
    throwsType(() => varTest("y ~ 1", d), TypeError, "'formula' missing or incorrect");
    throwsType(() => kruskalTest("y ~ g + h", d), TypeError, "'formula' should be of the form response ~ group");
    throwsType(() => onewayTest("~ g", d), TypeError, "'formula' missing or incorrect");
    throwsType(() => friedmanTest("y ~ g", d), TypeError, "incorrect specification for 'formula'");
    throwsType(() => friedmanTest("y ~ g + h | z", d), TypeError, "incorrect specification for 'formula'");
    throwsType(() => corTest("y ~ z", d), TypeError, "'formula' missing or invalid");
    throwsType(() => corTest("~ y", d), TypeError, "invalid formula");
    throwsType(() => tTest("y ~ g", d), Error, "grouping factor must have exactly 2 levels");
    throwsType(
      () => friedmanTest("y ~ g | h", { ...d, h: ["u", "u", "u", "u", "u", "v"] }),
      Error,
      "not an unreplicated complete block design",
    );
  });
});
