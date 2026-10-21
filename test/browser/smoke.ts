// Browser smoke test (npm run test:browser). The built dist is bundled with esbuild, run in headless
// Chromium and compared with values from R (computed with R 4.5.2). The regular fixture tests run on Node.

import {
  dbinom, eigen, fisherTest, pgamma, pnorm, pt, ptukey, qbeta, qnorm, rgamma, rnorm, sampleInt, setSeed, solve, svd,
  tTest, wilcoxTest,
} from "../../dist/index.js";

const x = [5.1, 4.9, 6.2, 5.8, 6.0, 5.5];
const y = [4.1, 4.5, 5.0, 4.8, 4.3];

/** [name, rStats.js value, R value, relative error tolerance (default 1e-12)] */
const checks: [string, () => number[], number[], number?][] = [
  ["pnorm(1.96)", () => [pnorm(1.96)], [0.97500210485177963]],
  ["qnorm(0.975)", () => [qnorm(0.975)], [1.9599639845400534]],
  ["pt(-40, 3)", () => [pt(-40, 3)], [1.719034039457927e-5]],
  ["qbeta(1e-10, 2, 3)", () => [qbeta(1e-10, 2, 3)], [4.0824940158083298e-6]],
  ["pgamma(100, 120, upper, log)", () => [pgamma(100, 120, { lowerTail: false, logP: true })], [-0.028636533445995725]],
  ["dbinom(3, 10, 0.2)", () => [dbinom(3, 10, 0.2)], [0.201326592]],
  // R's ptukey is accurate to only about 8 digits (docs/accuracy.md)
  ["ptukey(3.5, 4, 20)", () => [ptukey(3.5, 4, 20)], [0.90504154945144333], 1e-8],
  ["setSeed(42); rnorm(3)", () => (setSeed(42), rnorm(3)), [1.3709584471466685, -0.5646981713960888, 0.36312841133733914]],
  ["setSeed(1); rgamma(3, 2)", () => (setSeed(1), rgamma(3, 2)), [0.83086500237800842, 3.5707563471619541, 3.4631703801372664]],
  ["setSeed(7); sampleInt(10)", () => (setSeed(7), sampleInt(10)), [9, 2, 6, 3, 1, 5, 4, 8, 7, 0]],
  ["tTest(x, y).pValue", () => [tTest(x, y).pValue], [0.0035365308877675626]],
  ["fisherTest 2x2 pValue", () => [fisherTest([[3, 1], [1, 3]]).pValue], [0.4857142857142856]],
  ["wilcoxTest(x, y).pValue", () => [wilcoxTest(x, y).pValue], [0.008658008658008658]],
  ["solve([[2,1],[1,3]])", () => solve([[2, 1], [1, 3]]).flat(), [0.6, -0.2, -0.2, 0.4]],
  ["svd(1:6 as 3x2).d", () => svd([[1, 4], [2, 5], [3, 6]]).d, [9.5080320006957209, 0.77286963567348377]],
  ["eigen([[2,1],[1,3]]).values", () => eigen([[2, 1], [1, 3]]).values, [3.6180339887498949, 1.3819660112501051]],
];

export function run(): { name: string; ok: boolean; detail: string }[] {
  return checks.map(([name, f, expected, tol = 1e-12]) => {
    try {
      const actual = f();
      const ok =
        actual.length === expected.length &&
        actual.every((a, i) => Math.abs(a - expected[i]!) <= tol * Math.max(Math.abs(expected[i]!), 1e-300));
      return { name, ok, detail: ok ? "" : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
    } catch (e) {
      return { name, ok: false, detail: String(e) };
    }
  });
}
