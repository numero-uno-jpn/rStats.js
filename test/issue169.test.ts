// Issue #169: glmCooksDistance formed (r/(1 - h))^2 first, which overflowed although the distance is finite, and the
// finite-value guard turned it into NaN. The issue's Poisson example does not fit (the working weights overflow, #168),
// so the reproduction is a binomial fit with large prior weights, where Pearson residuals are of the order of
// sqrt(weight): for the high-leverage row (h = 0.977) of xs, y below with weights 1.5e306, r/(1 - h) is 1.6e154
// (review_fix_log_issue169.md). References: the same formula with r and the dispersion scaled by 2^-600, and the
// distance being proportional to the weights (dispersion 1) and inversely proportional to the dispersion.
import { describe, expect, it } from "vitest";
import { glm, glmCooksDistance, glmHatvalues, glmResiduals } from "../src/index.js";

const xs = [1, 2, 3, 4, 5, 38].map((v) => [v]);
const y = [1, 1, 1, 0, 0, 1];
const fitWith = (w: number) => glm(xs, y, { family: "binomial", weights: y.map(() => w) });
const rel = (x: number, y: number): number => Math.abs(x / y - 1);

/** (r/(1 - h))^2 h/(d p) with r and d in units of 2^600 (p = 2) */
function reference(fit: ReturnType<typeof fitWith>, d: number): number[] {
  const r = glmResiduals(fit, "pearson");
  const h = glmHatvalues(fit);
  return r.map((v, i) => ((v * 2 ** -600) / (1 - h[i]!)) ** 2 * (h[i]! / (d * 2 ** -600 * 2)) * 2 ** 300 * 2 ** 300);
}

describe("issue #169", () => {
  it("is finite where the square of r/(1 - h) overflows", () => {
    const fit = fitWith(1.5e306);
    expect(fit.converged).toBe(true);
    const c = glmCooksDistance(fit);
    expect(Number.isFinite(c[5]!)).toBe(true);
    const ref = reference(fit, 1);
    for (let i = 0; i < 6; i++) expect(rel(c[i]!, ref[i]!), `row ${i}`).toBeLessThan(1e-15);
    // proportional to the weights: the fit with weights 1e300 (the same up to its convergence)
    const small = glmCooksDistance(fitWith(1e300));
    expect(rel(c[5]!, small[5]! * 1.5e6)).toBeLessThan(1e-13);

    const fit4 = fitWith(4e306);
    const c100 = glmCooksDistance(fit4, { dispersion: 100 });
    expect(rel(c100[5]!, 3.608553313378049e306)).toBeLessThan(1e-15);
    const ref4 = reference(fit4, 100);
    for (let i = 0; i < 6; i++) expect(rel(c100[i]!, ref4[i]!), `row ${i}`).toBeLessThan(1e-15);
  });

  it("keeps the digits for a large dispersion", () => {
    // h/(dispersion p) was subnormal (5e-309 and below) and the distances 0
    const fit = fitWith(1);
    const c1 = glmCooksDistance(fit);
    const c = glmCooksDistance(fit, { dispersion: 1e308 });
    expect(rel(c[5]!, c1[5]! / 1e308)).toBeLessThan(1e-15);
    for (let i = 0; i < 5; i++) expect(Math.abs(c[i]! - c1[i]! / 1e308), `row ${i}`).toBeLessThanOrEqual(2 ** -1074);
  });

  it("keeps the bits in range", () => {
    // values of the implementation before the fix
    expect(glmCooksDistance(fitWith(1))).toEqual([
      0.13955075758485475, 0.11419100729889721, 0.09631680999691285, 0.24423696482640397, 0.24517245117507003,
      90.28561204180879,
    ]);
    expect(glmCooksDistance(fitWith(1), { dispersion: 1e-300 })).toEqual([
      1.3955075758485473e299, 1.141910072988972e299, 9.631680999691285e298, 2.44236964826404e299, 2.4517245117507005e299,
      9.02856120418088e301,
    ]);
    expect(glmCooksDistance(fitWith(4e306)).slice(0, 5)).toEqual([
      5.582208459897025e305, 4.567687663685779e305, 3.852673994162493e305, 9.769511186881235e305, 9.807089553803267e305,
    ]);
  });
});
