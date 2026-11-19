// Profile the two expensive polr edge cases without running R.
 // Usage:
 //   npx esbuild src/entries/regression.ts --bundle --format=esm --platform=node --outfile=<tmp>/reg.mjs
 //   npx esbuild src/models/polr.ts --bundle --format=esm --platform=node --outfile=<tmp>/polr-internal.mjs
 //   node experiments/regression-polr-profile.mjs <tmp>
const dir = new URL(`file://${process.argv[2]}/`);
const { polr } = await import(new URL("reg.mjs", dir).href);
const { __polrDerivativesForTest } = await import(new URL("polr-internal.mjs", dir).href);

let seed = 12345;
const runif = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rnorm = () => Math.sqrt(-2 * Math.log(runif() + 1e-300)) * Math.cos(2 * Math.PI * runif());
const timed = (label, f, repetitions = 1) => {
  const values = [];
  let result;
  for (let i = 0; i < repetitions; i++) {
    const start = performance.now();
    result = f();
    values.push(performance.now() - start);
  }
  values.sort((a, b) => a - b);
  console.log(label, "median_ms", values[Math.floor(values.length / 2)].toFixed(1), "runs", values.map(v => v.toFixed(1)).join(","));
  return result;
};

// Same 200-level, n=1000 shape as regression-stage3-edge.mjs.
const n = 1000, levels = 200;
const x = Array.from({ length: n }, rnorm);
const raw = x.map(v => v + rnorm());
const sorted = [...raw].sort((a, b) => a - b);
const y = raw.map(v => Math.min(levels - 1, Math.floor(sorted.indexOf(v) / 5)));
const weights = new Array(n).fill(1), offset = new Array(n).fill(0);
const cuts = Array.from({ length: levels - 1 }, (_, j) => Math.log((j + 1) / (levels - 1 - j)));
const theta = [0, cuts[0]];
for (let j = 1; j < cuts.length; j++) theta.push(Math.log(cuts[j] - cuts[j - 1]));

timed("polrDerivatives only (200 response levels, n=1000)", () =>
  __polrDerivativesForTest(x.map(v => [v]), y, weights, offset, levels, "logistic", theta), 5);
timed("full polr (200 response levels, n=1000)", () => {
  const labels = y.map(value => "L" + String(value).padStart(4, "0"));
  return polr("y ~ x", { y: labels, x });
}, 3);

// Same 150-level predictor factor shape as regression-stage3-edge.mjs.
const n2 = 300, xx = Array.from({ length: n2 }, rnorm), zz = Array.from({ length: n2 }, rnorm);
const response = xx.map((v, i) => {
  const latent = 0.8 * v - 0.5 * zz[i]! + Math.log(runif() / (1 - runif() + 1e-300) + 1e-300);
  return latent < -1 ? "a" : latent < 0 ? "b" : latent < 1.2 ? "c" : "d";
});
const group = xx.map((_, i) => "g" + (i % 150));
timed("full polr (150 predictor levels, n=300)", () =>
  polr("y ~ x + g", { y: response, x: xx, g: group }, { levels: { y: ["a", "b", "c", "d"] } }), 3);
