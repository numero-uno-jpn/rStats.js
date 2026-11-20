// Stage-3 edge inputs (coordinator, 2026-11-20): scale, many levels, outliers, separation, exact lines, size.
// Usage: npx esbuild src/entries/regression.ts --bundle --format=esm --platform=node --outfile=<tmp>/reg.mjs
//        node experiments/regression-stage3-edge.mjs <tmp>
const R = await import(new URL("reg.mjs", new URL(`file://${process.argv[2]}/`)).href);
const { polr, rlm, rlmSummary, nls, nlsSummary } = R;
let seed = 12345; const runif = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rnorm = () => Math.sqrt(-2 * Math.log(runif() + 1e-300)) * Math.cos(2 * Math.PI * runif());
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const run = (label, f) => { const t = performance.now(); try { const out = f(); console.log(label.padEnd(44), out, `(${(performance.now() - t).toFixed(0)}ms)`); } catch (e) { console.log(label.padEnd(44), "ERROR", e.message.slice(0, 110), `(${(performance.now() - t).toFixed(0)}ms)`); } };
const W = r => r.warnings?.length ? " W:" + [...new Set(r.warnings)].join("|").slice(0, 90) : "";

// ---------- polr ----------
const n = 300, x = Array.from({ length: n }, rnorm), z = Array.from({ length: n }, rnorm);
const lev = ["a", "b", "c", "d"], cut = [-1, 0, 1.2];
const y = x.map((v, i) => { const l = 0.8 * v - 0.5 * z[i] + Math.log(runif() / (1 - runif() + 1e-300) + 1e-300); return lev[cut.filter(c => l > c).length]; });
const base = polr("y ~ x + z", { y, x, z }, { levels: { y: lev } });
for (const s of [1e100, 1e-100, 1e300, 1e-300]) for (const method of ["logistic", "probit", "cloglog"]) run(`polr scale x*${s} ${method}`, () => {
  const b0 = method === "logistic" ? base : polr("y ~ x + z", { y, x, z }, { levels: { y: lev }, method });
  const f = polr("y ~ x + z", { y, x: x.map(v => v * s), z }, { levels: { y: lev }, method });
  return `coef*s rel ${rel(f.coefficients.x * s, b0.coefficients.x).toExponential(1)} zeta rel ${Math.max(...Object.keys(b0.zeta).map(k => rel(f.zeta[k], b0.zeta[k]))).toExponential(1)} logLik rel ${rel(f.logLik, b0.logLik).toExponential(1)}` + W(f);
});
run("polr 2 response levels", () => { const f = polr("y ~ x", { y: x.map(v => v > 0 ? "hi" : "lo"), x: x.map(v => v + rnorm()) }); return "fit, zeta " + JSON.stringify(f.zeta) + W(f); });
run("polr 200 response levels (n=1000)", () => { const xx = Array.from({ length: 1000 }, rnorm); const yy = xx.map(v => v + rnorm()); const ranks = [...yy].sort((a, b) => a - b); const L = 200; const ys = yy.map(v => "L" + String(Math.min(L - 1, Math.floor(ranks.indexOf(v) / 5))).padStart(4, "0")); const f = polr("y ~ x", { y: ys, x: xx }); return `coef ${f.coefficients.x.toFixed(6)} logLik ${f.logLik.toFixed(4)} conv ${f.converged ?? "?"}` + W(f); });
run("polr near separation (1 overlap)", () => { const xx = [...Array(60).keys()].map(i => i / 10); const yy = xx.map(v => v < 2 ? "a" : v < 4 ? "b" : "c"); yy[25] = "a"; const f = polr("y ~ x", { y: yy, x: xx }, { levels: { y: ["a", "b", "c"] } }); return `coef ${f.coefficients.x.toPrecision(6)} logLik ${f.logLik.toPrecision(6)}` + W(f); });
run("polr complete separation", () => { const xx = [...Array(60).keys()].map(i => i / 10); const yy = xx.map(v => v < 2 ? "a" : v < 4 ? "b" : "c"); const f = polr("y ~ x", { y: yy, x: xx }, { levels: { y: ["a", "b", "c"] } }); return `coef ${f.coefficients.x.toPrecision(6)} zeta ${JSON.stringify(f.zeta)} logLik ${f.logLik.toPrecision(6)}` + W(f); });
run("polr factor 2 levels", () => { const g = x.map(v => v > 0.3 ? "u" : "v"); const f = polr("y ~ g", { y, g }, { levels: { y: lev } }); return JSON.stringify(f.coefficients) + W(f); });
run("polr factor 150 levels (n=300)", () => { const g = x.map((_, i) => "g" + (i % 150)); const f = polr("y ~ x + g", { y, x, g }, { levels: { y: lev } }); return `coef x ${f.coefficients.x.toFixed(6)} ncoef ${Object.keys(f.coefficients).length} logLik ${f.logLik.toFixed(4)}` + W(f); });

// ---------- rlm ----------
const m = 100, rx = Array.from({ length: m }, rnorm), ry = rx.map(v => 1 + 2 * v + 0.5 * rnorm());
for (const method of ["M", "MM"]) {
  const b0 = rlm("y ~ x", { y: ry, x: rx }, { method });
  for (const [sx, sy] of [[1, 1e-6], [1, 1e-8], [1, 1e-12], [1, 1e-20], [1e100, 1], [1, 1e100], [1e-100, 1e-100], [1e150, 1e-150], [1e-200, 1]]) run(`rlm ${method} x*${sx} y*${sy}`, () => {
    const f = rlm("y ~ x", { y: ry.map(v => v * sy), x: rx.map(v => v * sx) }, { method });
    return `slope rel ${rel(f.coefficients.x * sx / sy, b0.coefficients.x).toExponential(1)} int rel ${rel(f.coefficients["(Intercept)"] / sy, b0.coefficients["(Intercept)"]).toExponential(1)} scale rel ${rel(f.scale / sy, b0.scale).toExponential(1)} SE rel ${rel(rlmSummary(f).values[1][1] * sx / sy, rlmSummary(b0).values[1][1]).toExponential(1)}` + W(f);
  });
}
for (const frac of [0.3, 0.45, 0.49]) for (const method of ["M", "MM"]) run(`rlm ${method} outliers ${frac}`, () => {
  const k = Math.round(frac * m); const yy = ry.map((v, i) => i < k ? 30 + 0.2 * rnorm() + 5 * rx[i] : v); seed += 0;
  const f = rlm("y ~ x", { y: yy, x: rx }, { method });
  return `int ${f.coefficients["(Intercept)"].toFixed(3)} slope ${f.coefficients.x.toFixed(3)} (truth 1, 2) scale ${f.scale.toFixed(3)}` + W(f);
});
run("rlm MM 60% exactly on a line", () => { const yy = ry.map((v, i) => i < 60 ? 1 + 2 * rx[i] : v); const f = rlm("y ~ x", { y: yy, x: rx }, { method: "MM" }); return `coef ${JSON.stringify(f.coefficients)} scale ${f.scale}` + W(f); });
run("rlm M 60% exactly on a line", () => { const yy = ry.map((v, i) => i < 60 ? 1 + 2 * rx[i] : v); const f = rlm("y ~ x", { y: yy, x: rx }); return `coef ${JSON.stringify(f.coefficients)} scale ${f.scale}` + W(f); });
run("rlm all exactly on a line", () => { const f = rlm("y ~ x", { y: rx.map(v => 1 + 2 * v), x: rx }); return `coef ${JSON.stringify(f.coefficients)} scale ${f.scale}` + W(f); });
run("rlm factor 2 levels MM", () => { const g = rx.map(v => v > 0 ? "u" : "v"); const f = rlm("y ~ x + g", { y: ry, x: rx, g }, { method: "MM" }); return JSON.stringify(f.coefficients) + W(f); });
run("rlm factor 40 levels MM (n=100, p=41)", () => { const g = rx.map((_, i) => "g" + (i % 40)); const f = rlm("y ~ x + g", { y: ry, x: rx, g }, { method: "MM" }); return `slope ${f.coefficients.x.toFixed(4)} scale ${f.scale.toFixed(4)}` + W(f); });
run("rlm factor 1000 levels M (n=3000)", () => { const N = 3000, xx = Array.from({ length: N }, rnorm), g = xx.map((_, i) => "g" + (i % 1000)); const yy = xx.map(v => 2 * v + rnorm()); const f = rlm("y ~ x + g", { y: yy, x: xx, g }); return `slope ${f.coefficients.x.toFixed(4)} scale ${f.scale.toFixed(4)} conv ${f.converged}` + W(f); });
run("rlm M n=100000", () => { const N = 100000, xx = Array.from({ length: N }, rnorm); const yy = xx.map(v => 2 * v + rnorm()); const f = rlm("y ~ x", { y: yy, x: xx }); return `slope ${f.coefficients.x.toFixed(4)} conv ${f.converged}` + W(f); });
run("rlm MM n=2000", () => { const N = 2000, xx = Array.from({ length: N }, rnorm); const yy = xx.map(v => 2 * v + rnorm()); const f = rlm("y ~ x", { y: yy, x: xx }, { method: "MM" }); return `slope ${f.coefficients.x.toFixed(4)} conv ${f.converged}` + W(f); });

// ---------- nls scale ----------
const conc = [0.02, 0.02, 0.06, 0.06, 0.11, 0.11, 0.22, 0.22, 0.56, 0.56, 1.1, 1.1], rate = [76, 47, 97, 107, 123, 139, 159, 152, 191, 201, 207, 200];
const nb = nls("rate ~ Vm * conc / (K + conc)", { rate, conc }, { start: { Vm: 200, K: 0.05 } });
for (const [sx, sy] of [[1, 1e10], [1, 1e20], [1e10, 1], [1e20, 1], [1e-10, 1], [1e-20, 1], [1, 1e100], [1e100, 1e-100]]) run(`nls x*${sx} y*${sy} (start scaled)`, () => {
  const f = nls("rate ~ Vm * conc / (K + conc)", { rate: rate.map(v => v * sy), conc: conc.map(v => v * sx) }, { start: { Vm: 200 * sy, K: 0.05 * sx } });
  const se = nlsSummary(f).coefficients.values, se0 = nlsSummary(nb).coefficients.values;
  return `Vm rel ${rel(f.coefficients.Vm / sy, nb.coefficients.Vm).toExponential(1)} K rel ${rel(f.coefficients.K / sx, nb.coefficients.K).toExponential(1)} SE rel ${Math.max(rel(se[0][1] / sy, se0[0][1]), rel(se[1][1] / sx, se0[1][1])).toExponential(1)}` + W(f);
});
run("nls SSmicmen y*1e100", () => { const f = nls("rate ~ SSmicmen(conc, Vm, K)", { rate: rate.map(v => v * 1e100), conc }); return `Vm rel ${rel(f.coefficients.Vm / 1e100, nb.coefficients.Vm).toExponential(1)}` + W(f); });
run("nls SSlogis x*1e-100", () => { const xx = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], yy = xx.map((v, i) => 10 / (1 + Math.exp((5 - v) / 1.5)) + [0.1, -0.2, 0.15, 0, -0.1, 0.2, -0.15, 0.05, 0.1, -0.05][i]); const a = nls("y ~ SSlogis(x, Asym, xmid, scal)", { y: yy, x: xx }), b = nls("y ~ SSlogis(x, Asym, xmid, scal)", { y: yy, x: xx.map(v => v * 1e-100) }); return `xmid rel ${rel(b.coefficients.xmid / 1e-100, a.coefficients.xmid).toExponential(1)} Asym rel ${rel(b.coefficients.Asym, a.coefficients.Asym).toExponential(1)}` + W(b); });
