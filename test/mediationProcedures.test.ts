// sobelTest, mediationMonteCarlo, moderatedMediation and mvrnorm against R (test/fixtures/mediation.json from
// oracle/mediation.R: ReactiveStat's procedures and MASS::mvrnorm)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { sobelTest, mediationMonteCarlo, moderatedMediation } from "../src/causal/mediationProcedures.js";
import { mvrnorm } from "../src/random/mvrnorm.js";
import { lm } from "../src/models/lm.js";
import { glm } from "../src/models/glm.js";
import { setSeed } from "../src/random/rng.js";
import type { DataFrame } from "../src/models/modelFrame.js";

const F = JSON.parse(readFileSync(new URL("./fixtures/mediation.json", import.meta.url), "utf8")) as any;
const data = F.data.d as DataFrame;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));
const sd = (v: number[]) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); };

describe("mvrnorm against MASS::mvrnorm", () => {
  for (const [name, c] of Object.entries(F.mvrnorm) as [string, any][]) {
    const mu: number[] = [c.mu].flat();
    const S: number[][] = typeof c.Sigma === "number" ? [[c.Sigma]] : c.Sigma;
    const p = mu.length;
    it(`${name}: ${p <= 2 ? "R's values" : "R's distribution"}`, () => {
      setSeed(42);
      const x = mvrnorm(7, mu, S);
      setSeed(42);
      const one = mvrnorm(1, mu, S);
      const want: number[][] = p === 1 ? c.x.map((v: number) => [v]) : c.x;
      if (p <= 2) {
        x.forEach((r, i) => r.forEach((v, j) => expect(rel(v, want[i]![j]!)).toBeLessThan(1e-14)));
        [c.one].flat().forEach((v: number, j: number) => expect(rel(one[0]![j]!, v)).toBeLessThan(1e-14));
      }
      // the first moments of 5000 draws, against R's sample moments (3 or more dimensions: the signs may differ)
      setSeed(42);
      const big = mvrnorm(5000, mu, S);
      for (let j = 0; j < p; j++) {
        const m = big.reduce((a, r) => a + r[j]!, 0) / 5000;
        const s = Math.sqrt(S[j]![j]!);
        expect(Math.abs(m - [c.big_mean].flat()[j]!)).toBeLessThan(p <= 2 ? 1e-12 * Math.max(1, s) : 0.1 * s);
      }
    });
  }
  it("errors as R", () => {
    expect(() => mvrnorm(2, [0, 0], [[1, 2], [2, 1]])).toThrow(F.mvrnorm_errors.notpd);
    expect(() => mvrnorm(2, [0, 0, 0], [[1, 0], [0, 1]])).toThrow(F.mvrnorm_errors.dims);
  });
});

describe("ReactiveStat's procedures against R", () => {
  it("sobelTest", () => {
    const s = F.sobel;
    const r = sobelTest(lm(s.model_m, data), lm(s.model_y, data), { treat: s.treat, mediator: s.mediator });
    for (const k of ["a", "sa", "b", "sb", "ab", "se", "z", "p"] as const) expect(rel(r[k], s[k])).toBeLessThan(1e-12);
  });
  for (const c of F.monte_carlo as any[]) {
    it(`mediationMonteCarlo, level ${c.level}, ${c.nmc} draws`, () => {
      const s = F.sobel;
      setSeed(1234);
      const r = mediationMonteCarlo(lm(s.model_m, data), lm(s.model_y, data), { treat: s.treat, mediator: s.mediator, nmc: c.nmc, confLevel: c.level });
      c.ind_head.forEach((v: number, j: number) => expect(rel(r.indirect.sims[j]!, v)).toBeLessThan(1e-13));
      c.dir_head.forEach((v: number, j: number) => expect(rel(r.direct.sims[j]!, v)).toBeLessThan(1e-13));
      for (const [g, w] of [[r.indirect.ci, c.ci_ind], [r.direct.ci, c.ci_dir], [r.total.ci, c.ci_tot], [r.proportion.ci, c.ci_prop]] as const)
        w.forEach((v: number, i: number) => expect(rel(g[i]!, v)).toBeLessThan(1e-12));
      expect(rel(r.indirect.estimate, c.ab)).toBeLessThan(1e-13);
      expect(rel(r.direct.estimate, c.cprime)).toBeLessThan(1e-13);
      expect(rel(r.proportion.estimate, c.prop)).toBeLessThan(1e-13);
    });
  }
  it("moderatedMediation with linear models (Monte Carlo on all coefficients: R's distribution)", () => {
    const c = F.modmed_continuous;
    setSeed(1234);
    const r = moderatedMediation(lm(c.model_m, data), lm(c.model_y, data), data, { treat: c.treat, mediator: c.mediator, moderator: c.moderator });
    expect(r.method).toBe("monteCarlo");
    expect(rel(r.wLow, c.w_lo)).toBeLessThan(1e-14);
    expect(rel(r.wHigh, c.w_hi)).toBeLessThan(1e-14);
    for (const [g, w] of [[r.indirectLow.estimate, c.acme_lo], [r.indirectHigh.estimate, c.acme_hi], [r.directLow.estimate, c.ade_lo], [r.directHigh.estimate, c.ade_hi], [r.index.estimate, c.index]] as const)
      expect(rel(g, w)).toBeLessThan(1e-12);
    const pairs = [[r.indirectLow, c.ci_acme_lo], [r.indirectHigh, c.ci_acme_hi], [r.directLow, c.ci_ade_lo], [r.directHigh, c.ci_ade_hi], [r.totalLow, c.ci_tot_lo], [r.totalHigh, c.ci_tot_hi], [r.index, c.ci_index]] as const;
    for (const [e, w] of pairs) {
      const s = sd(e.sims);
      w.forEach((v: number, i: number) => expect(Math.abs(e.ci[i]! - v)).toBeLessThan(0.15 * s));
    }
    expect(Math.abs(sd(r.index.sims) - c.sd_index)).toBeLessThan(0.03 * c.sd_index);
  });
  it("moderatedMediation with a binary mediator (mediate at the two moderator values: R's values)", () => {
    const c = F.modmed_binary;
    const m = glm(c.model_m, data, { family: "binomial", link: c.family_m }), y = lm(c.model_y, data);
    setSeed(c.seed);
    const r = moderatedMediation(m, y, data, { treat: c.treat, mediator: c.mediator, moderator: c.moderator, sims: c.sims });
    expect(r.method).toBe("mediate");
    c.index_sims.forEach((v: number, j: number) => expect(Math.abs(r.index.sims[j]! - v)).toBeLessThan(1e-12));
    expect(Math.abs(r.index.estimate - c.index)).toBeLessThan(1e-12);
    c.ci_index.forEach((v: number, i: number) => expect(Math.abs(r.index.ci[i]! - v)).toBeLessThan(1e-12));
    expect(Math.abs(r.low!.d0.estimate - c.lo.d0.est)).toBeLessThan(1e-12);
    expect(Math.abs(r.high!.d1.estimate - c.hi.d1.est)).toBeLessThan(1e-12);
  });
});
