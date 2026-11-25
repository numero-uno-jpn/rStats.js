// mediate against R's mediation::mediate (test/fixtures/mediation.json from oracle/mediation.R)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mediate, type MediationModel } from "../src/causal/mediate.js";
import { lm } from "../src/models/lm.js";
import { glm } from "../src/models/glm.js";
import { setSeed } from "../src/random/rng.js";
import type { DataFrame } from "../src/models/modelFrame.js";

const F = JSON.parse(readFileSync(new URL("./fixtures/mediation.json", import.meta.url), "utf8")) as any;
const data = F.data.d as DataFrame;
const fit = (f: string, fam: string): MediationModel =>
  fam === "gaussian" ? lm(f, data) : glm(f, data, { family: "binomial", link: fam as "logit" | "probit" });
const KEYS = [["d0", "d0"], ["d1", "d1"], ["z0", "z0"], ["z1", "z1"], ["tau", "tau"], ["n0", "n0"], ["n1", "n1"], ["d.avg", "dAvg"], ["z.avg", "zAvg"], ["n.avg", "nAvg"]] as const;
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
// R's draws that are rounding residues of an exact 0 (a binary mediator equal in both conditions in as many rows as
// it differs): rStats.js gives exactly 0 for a linear outcome (src/causal/mediate.ts), R +-1e-17, whose sign counts in
// R's p-value
const RESIDUE = 1e-14;
// Bootstrap replicates whose probit refit has an intercept of exactly 0 in theory (15 vs 15 at Xb = 0): R gives
// +2.7e-16 and rStats.js -3.8e-16 (experiments/mediation116-probit-separation.R), and rbinom turns its computation
// around at p = 0.5, so the mediator draws differ (oracle/mediation-behaviour.md)
const KNIFE_EDGE: Record<string, number[]> = { "probit_lm boot_perc ": [36, 45], "probit_lm boot_bca ": [36, 45] };

describe("mediate against R", () => {
  for (const c of F.mediate as any[]) {
    it(c.name, () => {
      const m = fit(c.model_m, c.family_m), y = fit(c.model_y, c.family_y);
      setSeed(c.seed);
      const r = mediate(m, y, data, {
        treat: c.treat, mediator: c.mediator, treatValue: c.treat_value, controlValue: c.control_value, sims: c.sims,
        boot: c.boot, bootCiType: c.ci_type, confLevel: c.conf_level, robustSE: c.robust,
        ...(c.covariates ? { covariates: c.covariates } : {}),
      });
      let worst = 0;
      const skip = new Set(KNIFE_EDGE[c.name] ?? []);
      for (const [rk, tk] of KEYS) {
        const want = c.result[rk], got = (r as any)[tk];
        const tol = 1e-9;
        want.sims.forEach((v: number, j: number) => {
          if (skip.has(j) || (Math.abs(v) < RESIDUE && got.sims[j] === 0)) return;
          worst = Math.max(worst, Math.abs(v - got.sims[j]) / Math.max(1, Math.abs(v)));
        });
        if (skip.size > 0) continue; // the estimates and intervals of these cases move with the two replicates
        expect(close(got.estimate, want.est, tol), `${rk} est ${got.estimate} vs ${want.est}`).toBe(true);
        expect(close(got.ci[0], want.ci[0], tol) && close(got.ci[1], want.ci[1], tol), `${rk} ci`).toBe(true);
        const residues = want.sims.filter((v: number) => v !== 0 && Math.abs(v) < RESIDUE).length;
        expect(Math.abs(got.p - want.p)).toBeLessThanOrEqual((2 * residues) / want.sims.length + 1e-12);
      }
      expect(worst).toBeLessThan(1e-9);
    });
  }
});
