// Issue #439: pivotWider selects a repeated column once, as tidyselect (review_fix_log_issue439.md).
import { describe, expect, it } from "vitest";
import { pivotWider } from "../src/index.js";

const d = { id: ["a", "b"], name: ["x", "y"], value: [1, 2] };
const once = { id: ["a", "b"], x: [1, null], y: [null, 2] };

describe("issue #439", () => {
  it("selects a repeated name once", () => {
    // tidyr 1.3.2: id_cols = c(id, id), names_from = c(name, name), values_from = c(value, value) as selected once
    expect(pivotWider(d, { idCols: ["id", "id"] })).toEqual(once);
    expect(pivotWider(d, { namesFrom: ["name", "name"] })).toEqual(once);
    expect(pivotWider(d, { valuesFrom: ["value", "value"] })).toEqual(once);
  });

  it("keeps the first place of a repeated name", () => {
    // tidyr: names_from = c(b, a, b) gives r_p, s_q; id_cols = c(k, id, k) gives the columns k, id
    const out = pivotWider({ id: [1, 2], a: ["p", "q"], b: ["r", "s"], value: [1, 2] }, { namesFrom: ["b", "a", "b"] });
    expect(Object.keys(out)).toEqual(["id", "r_p", "s_q"]);
    const ids = pivotWider({ id: [1, 2], k: ["u", "u"], a: ["p", "q"], value: [1, 2] }, { idCols: ["k", "id", "k"], namesFrom: "a" });
    expect(ids).toEqual({ k: ["u", "u"], id: [1, 2], p: [1, null], q: [null, 2] });
  });
});
