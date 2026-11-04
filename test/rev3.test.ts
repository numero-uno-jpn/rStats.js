// Revision of review 3 (R03/R11): tTest's interval is R's mu + (t ± q) stdErr, with the estimate-centred form only where
// that cancels (mu or t stdErr above 16 times abs(estimate) + q stdErr) or is not finite; Welch's standard error is R's
// sqrt(stderrx^2 + stderry^2) (review_fix_log_20261031_3_rev.md).
import { describe, expect, it } from "vitest";
import { tTest } from "../src/index.js";
import { loadFixture, num } from "./helpers/fixture.js";

const x4 = [1.2, 3.4, 2.2, 5.1];
const y6 = [2, 4, 6, 9, 11, 3];
const x5 = [0.19115092954124263, 0.01964054252650756, -0.79176365212683875, -0.78850754925631716, -0.77395724889684159];

describe("review 3 revision: tTest's interval and Welch standard error in R's form", () => {
  // R 4.5.2 (Linux) values of test/fixtures/tTest.json; the estimate-centred form was 1 to 3 ulp off them
  it("gives R's bits for the ends of one-sample, pooled, Welch and paired intervals", () => {
    expect(tTest(x5, { mu: -2 }).confInt).toEqual([-1.0387803853619273, 0.18140559407702828]);
    expect(tTest(x4, y6, { varEqual: true }).confInt).toEqual([-7.3015332224039717, 1.5848665557373058]);
    expect(tTest(x4, y6, { confLevel: 0.99 }).confInt).toEqual([-8.5790580561080976, 2.8623913894414326]);
    const p = tTest([1, 2, 2, 2, 3, 3], [5, 5, 5, 6, 6, 7], { paired: true, mu: 0.25, alternative: "less" });
    expect(p.confInt).toEqual([-Infinity, -3.0494214859276982]);
  });

  it("gives R's bits for Welch's standard error (fixture case of 200 and 150 values)", () => {
    const c = loadFixture("tTest").cases[255]!;
    const v = (s: unknown): number[] => (s as string[]).map(num);
    const r = tTest(v(c.args.x), v(c.args.y));
    const e = c.expected as unknown as Record<string, unknown>;
    expect(r.stdErr).toBe(num(e.stdErr as string));
    expect(r.stdErr).toBe(0.27572044497681003);
  });

  it("keeps the estimate-centred interval where R's form cancels", () => {
    // R [0.44573974329978228, 4.5542602567002177] (1.4e-10 off); the exact ends to 17 digits
    expect(tTest([1, 2, 3, 4], { mu: 1e6 }).confInt).toEqual([0.44573974323947896, 4.5542602567605215]);
    // R [0, 0] and NaN
    const r = tTest([1, 2, 3], { mu: -1e300 }).confInt;
    expect(r).toEqual([-0.4841377117503298, 4.48413771175033]);
    expect(tTest([1, 2, 3], { mu: Infinity }).confInt).toEqual(r);
  });
});
