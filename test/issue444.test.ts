// Issue #444: pivotLonger applies namesTransform to the ".value" part (review_fix_log_issue444.md).
import { describe, expect, it } from "vitest";
import { pivotLonger } from "../src/index.js";

const plain = (df: Record<string, ArrayLike<unknown>>) =>
  Object.fromEntries(Object.entries(df).map(([k, v]) => [k, Array.from(v)]));

const options = (transform: (x: string) => unknown) => ({
  cols: ["mean_x", "sd_x"],
  namesTo: [".value", "group"],
  namesSep: "_",
  namesTransform: { ".value": transform as (x: string) => string },
});

describe("issue #444", () => {
  it("names the value columns by the transformed parts", () => {
    // tidyr::pivot_longer(data.frame(mean_x = 1, sd_x = 2), names_to = c(".value", "group"), names_sep = "_",
    // names_transform = list(.value = toupper)): group x, MEAN 1, SD 2
    const out = pivotLonger({ mean_x: [1], sd_x: [2] }, options((x) => x.toUpperCase()));
    expect(plain(out)).toEqual({ group: ["x"], MEAN: [1], SD: [2] });
  });

  it("keeps the error for a value column given twice for one key after the transform", () => {
    // tidyr makes two rows of group x for mean_x and MEAN_x; rStats.js throws, as without a transform
    expect(() =>
      pivotLonger({ mean_x: [1], MEAN_x: [2] }, { ...options((x) => x.toUpperCase()), cols: ["mean_x", "MEAN_x"] }),
    ).toThrow("the names give the value column 'MEAN' twice for one key");
  });

  it("needs strings from the transform", () => {
    // tidyr with names_transform = list(.value = nchar): "`spec$.value` must be a character vector"
    expect(() => pivotLonger({ mean_x: [1], sd_x: [2] }, options((x) => x.length))).toThrow(
      "the transform of `.value` must give strings, not number",
    );
  });
});
