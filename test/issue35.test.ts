// Issue #35: data-frame results keep an own "__proto__" column (review_fix_log_issue35.md).
import { describe, expect, it } from "vitest";
import { aggregate, naOmit, split } from "../src/index.js";

const ownProto = (o: object) => Object.hasOwn(o, "__proto__") && Object.getPrototypeOf(o) === Object.prototype;
const col = (o: object) => Object.getOwnPropertyDescriptor(o, "__proto__")!.value as unknown[];

describe("issue #35", () => {
  it("keeps a column named __proto__ in aggregate, split and naOmit", () => {
    // out[name] = ... set the prototype instead: the column was lost and the prototype changed
    const a = aggregate(JSON.parse('{"y":[1,2,5]}'), JSON.parse('{"__proto__":["a","a","b"]}'), (v: number[]) => v.length);
    expect(ownProto(a)).toBe(true);
    expect(col(a)).toEqual(["a", "b"]);
    expect(a.y).toEqual([2, 1]);
    const s = split(JSON.parse('{"__proto__":[1,2],"v":[3,4]}'), ["a", "b"]).get("b")!;
    expect(ownProto(s)).toBe(true);
    expect(col(s)).toEqual([2]);
    const n = naOmit(JSON.parse('{"__proto__":[1, null], "v":[3, 4]}'));
    expect(ownProto(n)).toBe(true);
    expect(col(n)).toEqual([1]);
    expect(n.v).toEqual([3]);
  });

  it("leaves ordinary names as before", () => {
    expect(naOmit({ a: [1, NaN, 3], s: ["u", "v", null] })).toEqual({ a: [1], s: ["u"] });
  });
});
