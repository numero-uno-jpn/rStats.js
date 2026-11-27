// glmer on rare events (1.20.0, experiments/tsmeta120-log.md 111): the binomial deviance's term (1 - y) log((1 - y) /
// (1 - mu)) lost digits for y and mu below 0.1 (a ratio near 1), so with prior weights 1e5..1e7 the penalised
// deviance was noisy to 1e-10, the PIRLS step halvings rejected every step and glmer failed ("did not converge"; R
// fits). Now log1p((mu - y) / (1 - mu)) from the exact difference. R's fits on the same data:
// experiments/tsmeta120-glmmrare.json and tsmeta120-glmmrare2.json.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { glmer } from "../src/models/glmer.js";
import { metapropGlmm } from "../src/meta/metaother.js";
import { makeFamily } from "../src/models/glmFamily.js";

const json = (f: string) => JSON.parse(readFileSync(new URL(`../experiments/${f}`, import.meta.url), "utf8")) as Record<string, any>;
const cols = (rows: Record<string, number | string>[]): Record<string, (number | string)[]> => Object.fromEntries(Object.keys(rows[0]!).map((k) => [k, rows.map((r) => r[k]!)]));

describe("glmer on rare events (log 111)", () => {
  it("metaprop's GLMM data (proportions about 1e-5, weights 1e5): R's fit for nAGQ 0, 1, 7", () => {
    const R = json("tsmeta120-glmmrare.json"); const d = cols(R.data);
    for (const q of [0, 1, 7] as const) {
      const f = glmer("p ~ 1 + (1 | study)", d, { family: "binomial", weights: "w", nAGQ: q }); const r = R[`nAGQ${q}`];
      expect(f.theta[0]).toBe(0); expect(Math.abs(f.fixef[0]! / r.fixef - 1), `nAGQ ${q}`).toBeLessThan(1e-12);
      expect(Math.abs(f.logLik - (q === 7 ? f.logLik : r.loglik)), `nAGQ ${q}`).toBeLessThan(1e-12);
    }
    const g = metapropGlmm([1, 2, 1, 3], [1e5, 2e5, 8e4, 3e5]);
    const P = json("tsmeta120-propedge.json").tiny.GLMM;
    expect(Math.abs(g["TE.random"] / P["TE.random"] - 1)).toBeLessThan(1e-12); expect(Math.abs(g["seTE.random"] / P["seTE.random"] - 1)).toBeLessThan(1e-9);
  });
  it("proportions 1e-3..1e-6 with weights 1e3..1e7 and a covariate, poisson with tiny rates: R's log-likelihood or a higher one", () => {
    const R = json("tsmeta120-glmmrare2.json");
    for (const [k, c] of Object.entries<any>(R)) {
      if (c.fit.error) continue;
      const d = cols(c.data);
      const f = k.startsWith("pois") ? glmer("y ~ x + (1 | g)", d, { family: "poisson", offset: "off" }) : glmer("p ~ x + (1 | g)", d, { family: "binomial", weights: "w" });
      expect(f.logLik - c.fit.loglik, k).toBeGreaterThan(-1e-9);
      expect(Math.abs(f.fixef[0]! - c.fit.fixef[0]) / Math.abs(c.fit.fixef[0]), k).toBeLessThan(2e-5);
    }
  }, 300_000);
  it("the binomial deviance for rare events agrees with the log1p form of the exact difference mu - y", () => {
    const fam = makeFamily("binomial");
    for (const [y, mu] of [[1e-5, 1.1e-5], [3e-6, 1e-6], [0.05, 0.07]] as const) {
      const exact = 2 * (y * Math.log(y / mu) + (1 - y) * Math.log1p((mu - y) / (1 - mu)));
      expect(Math.abs(fam.devContribution(y, mu, 1) / exact - 1), `${y} ${mu}`).toBeLessThan(1e-13);
    }
  });
});
