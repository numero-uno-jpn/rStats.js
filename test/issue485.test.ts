// Issue #485: rgeom with prob 1 draws from the stream as R 4.5.2 (review_fix_log_issue485.md).
import { describe, expect, it } from "vitest";
import { rgeom, runif, setSeed } from "../src/index.js";

describe("issue #485", () => {
  it("prob 1 gives 0 and advances the stream as R", () => {
    // R 4.5.2: set.seed(1); rgeom(1, 1); runif(1) gives 0 and 0x1.7d0e0c2cp-2 (0.37212389963679016), not the first
    // uniform 0.2655087
    setSeed(1);
    expect(rgeom(1, 1)).toEqual([0]);
    expect(runif(1)).toEqual([0x17d0e0c2c * 2 ** -34]);
  });
});
