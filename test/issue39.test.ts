// Issue #39: pivotWider reads per-column valuesFill and valuesFn from own properties only (review_fix_log_issue39.md).
import { describe, expect, it } from "vitest";
import { pivotWider } from "../src/index.js";

const col = (o: object, name: string) => Object.getOwnPropertyDescriptor(o, name)!.value as unknown[];

describe("issue #39", () => {
  it("does not take inherited properties as per-column settings", () => {
    // the empty cell was Object.prototype, then the Object function
    const proto = pivotWider(JSON.parse('{"id":[1,2],"key":["a","b"],"__proto__":[5,6]}'), {
      namesFrom: "key",
      valuesFrom: "__proto__",
      idCols: ["id"],
      valuesFill: {},
    });
    expect(col(proto, "a")).toEqual([5, null]);
    expect(col(proto, "b")).toEqual([null, 6]);
    const ctor = pivotWider({ id: [1, 2], key: ["a", "b"], constructor: [5, 6] }, {
      namesFrom: "key",
      valuesFrom: "constructor",
      idCols: ["id"],
      valuesFill: {},
    });
    expect(col(ctor, "b")).toEqual([null, 6]);
    // the inherited toString summarised the duplicated cell as "[object Undefined]"
    expect(() =>
      pivotWider({ id: [1, 1, 2], key: ["a", "a", "b"], toString: [5, 6, 7] }, {
        namesFrom: "key",
        valuesFrom: "toString",
        idCols: ["id"],
        valuesFn: {},
      }),
    ).toThrow("values from 'toString' are not uniquely identified");
  });

  it("uses own settings, including an own __proto__ key", () => {
    const proto = pivotWider(JSON.parse('{"id":[1,2],"key":["a","b"],"__proto__":[5,6]}'), {
      namesFrom: "key",
      valuesFrom: "__proto__",
      idCols: ["id"],
      valuesFill: JSON.parse('{"__proto__": 0}'),
    });
    expect(col(proto, "b")).toEqual([0, 6]);
    const data = { id: [1, 1, 2], key: ["a", "a", "b"], v: [5, 6, 7] };
    const sum = (x: readonly unknown[]) => (x as number[]).reduce((s, t) => s + t, 0);
    expect(pivotWider(data, { namesFrom: "key", valuesFrom: "v", idCols: ["id"], valuesFill: { v: 0 }, valuesFn: { v: sum } })).toEqual({
      id: [1, 2],
      a: [11, 0],
      b: [0, 7],
    });
    expect(pivotWider(data, { namesFrom: "key", valuesFrom: "v", idCols: ["id"], valuesFill: -1, valuesFn: sum })).toEqual({
      id: [1, 2],
      a: [11, -1],
      b: [-1, 7],
    });
  });
});
