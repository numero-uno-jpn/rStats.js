// simSlopes and johnsonNeyman against R's interactions::sim_slopes (test/fixtures/mediation.json from oracle/mediation.R)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { simSlopes, johnsonNeyman } from "../src/causal/moderation.js";
import { lm } from "../src/models/lm.js";
import { glm } from "../src/models/glm.js";
import type { DataFrame } from "../src/models/modelFrame.js";

const F = JSON.parse(readFileSync(new URL("./fixtures/mediation.json", import.meta.url), "utf8")) as any;
const data = F.data.s as DataFrame;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));

describe("simSlopes against R", () => {
  F.sim_slopes.forEach((c: any, k: number) => {
    it(`${k}: ${c.formula} ${c.family} ${JSON.stringify(c.modx_values)} ${c.robust}`, () => {
      const fit = c.family === "gaussian" ? lm(c.formula, data) : glm(c.formula, data, { family: "binomial", link: c.family });
      const r = simSlopes(fit, data, {
        pred: "X", modx: c.modx, modxValues: c.modx_values, johnsonNeyman: c.johnson_neyman, jnAlpha: c.jnalpha,
        ciWidth: c.ci_width, robust: c.robust,
      });
      const w = c.result;
      const tol = c.robust ? 1e-11 : 1e-12;
      for (const [g, e] of [[r.values, w.values], [r.estimate, w.est], [r.se, w.se], [r.lower, w.lo], [r.upper, w.hi], [r.statistic, w.stat], [r.p, w.p]] as const)
        (e as number[]).forEach((v, i) => expect(rel(g[i]!, v)).toBeLessThan(tol));
      expect(`${r.statisticName} val.`).toBe(w.stat_name);
      if (w.jn) {
        const j = r.jn!;
        expect(j.inside).toBe(w.jn.inside);
        expect(j.failed).toBe(w.jn.failed);
        expect(j.allSig).toBe(w.jn.all_sig);
        expect(j.modrange).toEqual(w.jn.modrange);
        if (w.jn.failed) expect(j.bounds).toEqual([-Infinity, Infinity]);
        else w.jn.bounds.forEach((v: number, i: number) => expect(rel(j.bounds[i]!, v)).toBeLessThan(1e-10));
        const alone = johnsonNeyman(fit, data, { pred: "X", modx: c.modx, alpha: c.jnalpha, robust: c.robust });
        expect(alone).toEqual(j);
      } else expect(r.jn).toBeUndefined();
    });
  });
});
