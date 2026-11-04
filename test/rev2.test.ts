// Revision of review 2 (C-02/C-03): Welch's degrees of freedom in R's forms, se^4 / sum(se_i^4 / df_i) for tTest and
// cohensD (t.test, effectsize) and A^2 / sum(s2_i^2 / (n_i^2 (n_i - 1))) for gamesHowellTest (PMCMRplus), on values
// scaled by an even power of 2; the form (sum w)^2 / sum(w^2 / df) only where those are not finite
// (review_fix_log_20261031_2_rev.md).
import { describe, expect, it } from "vitest";
import { tTest } from "../src/index.js";
import { satterthwaiteDf, satterthwaiteDfPM, satterthwaiteDfSe } from "../src/internal/summary.js";

/** A double from R's sprintf("%a") */
function fromHex(h: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{13})p([+-]\d+)$/.exec(h)!;
  const v = Number.parseInt(`1${m[2]}`, 16) * 2 ** -52 * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

const s2 = [2.5, 0.7, 13.1];
const n = [4, 6, 9];
const pairs = [
  [0, 1],
  [0, 2],
  [1, 2],
] as const;

describe("review 2 revision: Welch's degrees of freedom in R's forms", () => {
  it("gives t.test's df for tTest (R 4.5.2, Linux, test/fixtures/tTest.json)", () => {
    // were 7.511624152319669 and 6.9401538431552545 (1 and 2 ulp off)
    expect(tTest([1.2, 3.4, 2.2, 5.1], [2, 4, 6, 9, 11, 3]).parameter).toBe(7.5116241523196683);
    const x = [0.19115092954124263, 0.01964054252650756, -0.79176365212683875, -0.78850754925631716, -0.77395724889684159];
    const y = [3.6485277813633257, 2.7532228285211362, 2.3818321408697476, 2.766997064411393, 4.180509236082564];
    expect(tTest(x, y).parameter).toBe(6.9401538431552519);
  });

  // (Windows R's se^4 is not always correctly rounded: for the first pair its 0.55006944444444459 is 1 ulp above the
  // exact rounding, so the t.test form is not compared with local R here)
  it("gives PMCMRplus's bits for gamesHowellTest's form (local R 4.5.2, its expression on these variances)", () => {
    const pm = ["0x1.08d556797cab9p+2", "0x1.5ea56b70f8bc2p+3", "0x1.27a4d48b5a785p+3"];
    pairs.forEach(([i, j], p) => expect(satterthwaiteDfPM([s2[i]!, s2[j]!], [n[i]!, n[j]!])).toBe(fromHex(pm[p]!)));
  });

  it("keeps the df at any scale and NaN for zero variances", () => {
    const w = [s2[0]! / n[0]!, s2[1]! / n[1]!];
    const d = [n[0]! - 1, n[1]! - 1];
    const r = satterthwaiteDfSe(w, d);
    for (const e of [-1000, -600, 600, 1000]) {
      expect(satterthwaiteDfSe(w.map((v) => v * 2 ** e), d)).toBe(r);
      expect(satterthwaiteDfPM([s2[0]! * 2 ** e, s2[1]! * 2 ** e], [n[0]!, n[1]!])).toBe(satterthwaiteDfPM([s2[0]!, s2[1]!], [n[0]!, n[1]!]));
    }
    expect(satterthwaiteDfSe([0, 0], [1, 2])).toBeNaN();
    expect(satterthwaiteDfPM([0, 0], [2, 3])).toBeNaN();
    expect(satterthwaiteDf([0, 0], [1, 2])).toBeNaN();
  });
});
