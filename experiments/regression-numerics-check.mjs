// Numerical edge cases of /regression (coordinator, 2026-11-20): extreme linear predictors, psi functions at
// extreme arguments, extreme weights and outliers, NaN and Infinity, rank deficiency, overflow during nls iterations.
// Usage: npx esbuild src/entries/regression.ts --bundle --format=esm --platform=node --outfile=<tmp>/reg.mjs
//        node experiments/regression-numerics-check.mjs <tmp>/reg.mjs   (timings removed from the .out.txt)
const R = await import(process.argv[2]);
const { polr, polrPredict, polrConfint, polrSummary, rlm, rlmSummary, nls, nlsSummary, nlsPredict, psiHuber, psiHampel, psiBisquare } = R;
const out = (label, f) => { const t = performance.now(); let r; try { r = f(); } catch (e) { r = "ERROR " + e.message.slice(0, 120); } console.log(label.padEnd(58), typeof r === "string" ? r : JSON.stringify(r), `(${(performance.now() - t).toFixed(0)}ms)`); };
const W = r => r.warnings?.length ? " W:" + [...new Set(r.warnings)].join("|").slice(0, 80) : "";
const fin = a => a.flat(9).every(Number.isFinite);
// Exact class probabilities from the cumulative link, using whichever tail avoids cancellation (independent of rStats.js).
const F = { logistic: [z => 1 / (1 + Math.exp(-z)), z => 1 / (1 + Math.exp(z))],
  probit: [z => 0.5 * erfc(-z / Math.SQRT2), z => 0.5 * erfc(z / Math.SQRT2)],
  cloglog: [z => -Math.expm1(-Math.exp(z)), z => Math.exp(-Math.exp(z))],
  loglog: [z => Math.exp(-Math.exp(-z)), z => -Math.expm1(-Math.exp(-z))],
  cauchit: [z => (z < 0 ? Math.atan(-1 / z) / Math.PI : 0.5 + Math.atan(z) / Math.PI), z => Math.atan(1 / Math.abs(z)) / Math.PI * (z > 0 ? 1 : 0) + (z <= 0 ? 0.5 - Math.atan(z) / Math.PI : 0)] };
function erfc(x) { // W. J. Cody-style rational approximation is overkill; use continued fraction for large x, series otherwise
  if (x < 0) return 2 - erfc(-x);
  if (x > 4) { let f = 0; for (let k = 60; k >= 1; k--) f = k / 2 / (x + f); return Math.exp(-x * x) / Math.sqrt(Math.PI) / (x + f); }
  let s = 0, term = x, n = 0; while (Math.abs(term) > 1e-17 * Math.abs(s) || n < 3) { s += term / (2 * n + 1); n++; term *= -x * x / n; } return 1 - 2 / Math.sqrt(Math.PI) * s;
}
function exactProbs(method, zeta, eta) {
  const [lo, up] = F[method]; const z = zeta.map(c => c - eta); const p = [];
  for (let k = 0; k <= z.length; k++) {
    if (k === 0) p.push(lo(z[0]));
    else if (k === z.length) p.push(up(z[k - 1]));
    else p.push(z[k - 1] > 0 ? up(z[k - 1]) - up(z[k]) : lo(z[k]) - lo(z[k - 1]));
  }
  return p;
}
const relErr = (a, b) => (a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(b), Number.MIN_VALUE));

// ---------- polr: extreme linear predictors in prediction ----------
const xs = [-3,-2.5,-2,-1.5,-1,-0.5,0,0.5,1,1.5,2,2.5,3,-2.8,-1.2,0.2,1.8,2.9,-0.3,0.7,1.1,-1.7,2.2,-2.2];
const ys = xs.map((v, i) => ["a","b","c","d"][Math.min(3, Math.max(0, Math.round(v * 0.6 + 1.5 + Math.sin(i * 7) * 1.1)))]);
for (const method of ["logistic", "probit", "cloglog", "loglog", "cauchit"]) {
  let fit; try { fit = polr("y ~ x", { y: ys, x: xs }, { method, levels: { y: ["a","b","c","d"] } }); } catch (e) { console.log("polr fit", method, "ERROR", e.message); continue; }
  const b = fit.coefficients.x, zeta = Object.values(fit.zeta);
  for (const eta of [10, 40, 200, 800, -10, -40, -200, -800]) out(`polr ${method} predict eta=${eta}`, () => {
    const p = polrPredict(fit, { type: "probs", newdata: { x: [eta / b] } }).values[0];
    const ex = exactProbs(method, zeta, eta);
    const sum = p.reduce((s, v) => s + v, 0);
    const worst = Math.max(...p.map((v, k) => ex[k] < 1e-300 ? (v < 1e-290 ? 0 : 1) : relErr(v, ex[k])));
    return `sum-1 ${(sum - 1).toExponential(1)} min ${Math.min(...p).toExponential(2)} maxRelErrVsExact ${worst.toExponential(1)} nonfinite ${!fin(p)}`;
  });
}
// polr fit with observations at extreme linear predictors (strong effect, no complete separation)
for (const method of ["logistic", "probit", "cloglog", "loglog", "cauchit"]) out(`polr ${method} fit, eta range ±60`, () => {
  const x = [...Array(40).keys()].map(i => (i - 20) / 2); const lev = ["a","b","c"];
  const y = x.map((v, i) => lev[v < -3 ? 0 : v < 3 ? 1 : 2]); y[3] = "b"; y[36] = "b"; y[19] = "a"; y[22] = "c";
  const f = polr("y ~ x", { y, x }, { method, levels: { y: lev } }); const s = polrSummary(f);
  return `coef ${f.coefficients.x.toPrecision(6)} logLik ${f.logLik.toPrecision(8)} finite ${fin([f.logLik, ...s.values])}` + W(f);
});
// polr weights scaled
out("polr weights *1e-300 vs *1 (coef rel)", () => { const w = xs.map(() => 1); const a = polr("y ~ x", { y: ys, x: xs }, { weights: w, levels: { y: ["a","b","c","d"] } }), b2 = polr("y ~ x", { y: ys, x: xs }, { weights: w.map(v => v * 1e-300), levels: { y: ["a","b","c","d"] } }); return relErr(b2.coefficients.x, a.coefficients.x).toExponential(1); });
out("polr weights *1e300", () => { const w = xs.map(() => 1e300); const f = polr("y ~ x", { y: ys, x: xs }, { weights: w, levels: { y: ["a","b","c","d"] } }); return `coef ${f.coefficients.x} logLik ${f.logLik}`; });
out("polr weights mixed 1e-200 and 1", () => { const w = xs.map((_, i) => i % 2 ? 1 : 1e-200); const f = polr("y ~ x", { y: ys, x: xs }, { weights: w, levels: { y: ["a","b","c","d"] } }); return `coef ${f.coefficients.x.toPrecision(6)} finite ${Number.isFinite(f.logLik)}`; });
out("polr constant predictor", () => { const f = polr("y ~ x + k", { y: ys, x: xs, k: xs.map(() => 3) }, { levels: { y: ["a","b","c","d"] } }); return JSON.stringify(f.coefficients) + W(f); });
out("polr collinear predictors", () => { const f = polr("y ~ x + z", { y: ys, x: xs, z: xs.map(v => 2 * v) }, { levels: { y: ["a","b","c","d"] } }); return JSON.stringify(f.coefficients) + W(f); });
out("polr NaN in x", () => { const x = [...xs]; x[2] = NaN; const f = polr("y ~ x", { y: ys, x }, { levels: { y: ["a","b","c","d"] } }); return `nobs ${f.nobs} coef ${f.coefficients.x.toPrecision(6)}` + W(f); });
out("polr Infinity in x", () => { const x = [...xs]; x[2] = Infinity; const f = polr("y ~ x", { y: ys, x }, { levels: { y: ["a","b","c","d"] } }); return `nobs ${f.nobs} coef ${f.coefficients.x}`; });
out("polr null/undefined response", () => { const y = [...ys]; y[1] = null; const f = polr("y ~ x", { y, x: xs }, { levels: { y: ["a","b","c","d"] } }); return `nobs ${f.nobs}`; });
out("polr predict newdata x=Infinity", () => { const f = polr("y ~ x", { y: ys, x: xs }, { levels: { y: ["a","b","c","d"] } }); return polrPredict(f, { type: "probs", newdata: { x: [Infinity, -Infinity, NaN] } }).values; });
out("polr confint near-separation", () => { const x = [...Array(30).keys()].map(i => i / 3); const y = x.map(v => v < 3 ? "a" : v < 6 ? "b" : "c"); y[9] = "a"; y[18] = "b"; const f = polr("y ~ x", { y, x }, { levels: { y: ["a","b","c"] } }); const c = polrConfint(f); return c.values.flat().map(v => v.toPrecision(5)).join(" ") + W(c); });

// ---------- rlm psi functions ----------
const us = [0, -0, 1e-300, -1e-300, 1, 1.345, 1.3450000001, 4.685, 1e300, -1e300, Infinity, -Infinity, NaN];
for (const [name, fn] of [["psiHuber", psiHuber], ["psiHampel", psiHampel], ["psiBisquare", psiBisquare]]) {
  out(`${name} weights`, () => fn(us).map(v => typeof v === "number" ? +v.toPrecision(6) : v));
  out(`${name} deriv`, () => fn(us, { deriv: 1 }).map(v => typeof v === "number" ? +v.toPrecision(6) : v));
}
// ---------- rlm data extremes ----------
const rx = [...Array(30).keys()].map(i => i / 3), ry = rx.map((v, i) => 1 + 2 * v + Math.sin(i * 3) * 0.3);
for (const method of ["M", "MM"]) {
  out(`rlm ${method} one outlier 1e300`, () => { const y = [...ry]; y[5] = 1e300; const f = rlm("y ~ x", { y, x: rx }, { method }); return `coef ${JSON.stringify(f.coefficients)} scale ${f.scale.toPrecision(4)} w5 ${f.robustWeights[5]}` + W(f); });
  out(`rlm ${method} one outlier 1e308 and one -1e308`, () => { const y = [...ry]; y[5] = 1e308; y[6] = -1e308; const f = rlm("y ~ x", { y, x: rx }, { method }); return `coef ${JSON.stringify(f.coefficients)} scale ${f.scale.toPrecision(4)}` + W(f); });
  out(`rlm ${method} Infinity in y`, () => { const y = [...ry]; y[5] = Infinity; const f = rlm("y ~ x", { y, x: rx }, { method }); return `nobs ${f.fittedValues.length} coef ${JSON.stringify(f.coefficients)}`; });
  out(`rlm ${method} NaN in y`, () => { const y = [...ry]; y[5] = NaN; const f = rlm("y ~ x", { y, x: rx }, { method }); return `n ${f.fittedValues.length} coef ${JSON.stringify(f.coefficients)}` + W(f); });
  out(`rlm ${method} constant predictor`, () => { const f = rlm("y ~ x + k", { y: ry, x: rx, k: rx.map(() => 2) }, { method }); return JSON.stringify(f.coefficients) + W(f); });
  out(`rlm ${method} collinear predictors`, () => { const f = rlm("y ~ x + z", { y: ry, x: rx, z: rx.map(v => 3 * v + 1) }, { method }); return JSON.stringify(f.coefficients) + W(f); });
  out(`rlm ${method} y constant`, () => { const f = rlm("y ~ x", { y: rx.map(() => 5), x: rx }, { method }); return `coef ${JSON.stringify(f.coefficients)} scale ${f.scale} conv ${f.converged}` + W(f); });
}
out("rlm weights *1e-300 vs *1 (coef rel)", () => { const w = rx.map((_, i) => 1 + (i % 3)); const a = rlm("y ~ x", { y: ry, x: rx }, { weights: w }), b = rlm("y ~ x", { y: ry, x: rx }, { weights: w.map(v => v * 1e-300) }); return `${relErr(b.coefficients.x, a.coefficients.x).toExponential(1)} scale rel ${relErr(b.scale, a.scale).toExponential(1)}`; });
out("rlm weights *1e300 vs *1 (coef rel)", () => { const w = rx.map((_, i) => 1 + (i % 3)); const a = rlm("y ~ x", { y: ry, x: rx }, { weights: w }), b = rlm("y ~ x", { y: ry, x: rx }, { weights: w.map(v => v * 1e300) }); return `${relErr(b.coefficients.x, a.coefficients.x).toExponential(1)} scale rel ${relErr(b.scale, a.scale).toExponential(1)}`; });
out("rlm n = p (exact)", () => { const f = rlm("y ~ x", { y: [1, 3], x: [0, 1] }); return JSON.stringify(f.coefficients) + W(f); });

// ---------- nls: overflow and domain during iterations ----------
const ex = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ey = ex.map((v, i) => 2 * Math.exp(0.3 * v) + Math.sin(i) * 0.05);
out("nls exp overflow at start (b=100)", () => nls("y ~ a*exp(b*x)", { y: ey, x: ex }, { start: { a: 1, b: 100 } }).coefficients);
out("nls start that overshoots (b=1.5)", () => { const f = nls("y ~ a*exp(b*x)", { y: ey, x: ex }, { start: { a: 1, b: 1.5 } }); return JSON.stringify(f.coefficients); });
out("nls start a=1e-300", () => JSON.stringify(nls("y ~ a*exp(b*x)", { y: ey, x: ex }, { start: { a: 1e-300, b: 0.3 } }).coefficients));
out("nls log domain: y ~ a*log(b*x), start b tiny", () => { const x = [1, 2, 3, 4, 5, 6, 7, 8], y = x.map(v => 3 * Math.log(2 * v) + Math.cos(v) * 0.02); return JSON.stringify(nls("y ~ a*log(b*x)", { y, x }, { start: { a: 1, b: 0.01 } }).coefficients); });
out("nls pole: y ~ a/(x - b), start b inside data", () => { const x = [1, 2, 3, 4, 5, 6, 7, 8], y = x.map(v => 5 / (v + 0.5) + Math.cos(v) * 0.01); return JSON.stringify(nls("y ~ a/(x - b)", { y, x }, { start: { a: 1, b: 3.5 } }).coefficients); });
out("nls pole: start b = -0.6 (near truth -0.5)", () => { const x = [1, 2, 3, 4, 5, 6, 7, 8], y = x.map(v => 5 / (v + 0.5) + Math.cos(v) * 0.01); return JSON.stringify(nls("y ~ a/(x - b)", { y, x }, { start: { a: 1, b: -0.6 } }).coefficients); });
out("nls sqrt of negative at start", () => { const x = [1, 2, 3, 4, 5], y = x.map(v => Math.sqrt(v + 2) + 0.01 * Math.sin(v)); return JSON.stringify(nls("y ~ sqrt(x + c)", { y, x }, { start: { c: -3 } }).coefficients); });
out("nls Infinity in y", () => { const y = [...ey]; y[3] = Infinity; return JSON.stringify(nls("y ~ a*exp(b*x)", { y, x: ex }, { start: { a: 1, b: 0.3 } }).coefficients); });
out("nls NaN in y", () => { const y = [...ey]; y[3] = NaN; const f = nls("y ~ a*exp(b*x)", { y, x: ex }, { start: { a: 1, b: 0.3 } }); return `nobs ${f.nobs} ${JSON.stringify(f.coefficients)}`; });
out("nls weights *1e-300 vs *1", () => { const w = ex.map((_, i) => 1 + (i % 3)); const a = nls("y ~ a*exp(b*x)", { y: ey, x: ex }, { start: { a: 1, b: 0.3 }, weights: w }), b = nls("y ~ a*exp(b*x)", { y: ey, x: ex }, { start: { a: 1, b: 0.3 }, weights: w.map(v => v * 1e-300) }); return `coef rel ${relErr(b.coefficients.b, a.coefficients.b).toExponential(1)} SE rel ${relErr(nlsSummary(b).coefficients.values[1][1], nlsSummary(a).coefficients.values[1][1]).toExponential(1)}`; });
out("nls weights *1e300 vs *1", () => { const w = ex.map((_, i) => 1 + (i % 3)); const a = nls("y ~ a*exp(b*x)", { y: ey, x: ex }, { start: { a: 1, b: 0.3 }, weights: w }), b = nls("y ~ a*exp(b*x)", { y: ey, x: ex }, { start: { a: 1, b: 0.3 }, weights: w.map(v => v * 1e300) }); return `coef rel ${relErr(b.coefficients.b, a.coefficients.b).toExponential(1)} SE rel ${relErr(nlsSummary(b).coefficients.values[1][1], nlsSummary(a).coefficients.values[1][1]).toExponential(1)}`; });
out("nls predict newdata overflow (x=1e4)", () => { const f = nls("y ~ a*exp(b*x)", { y: ey, x: ex }, { start: { a: 1, b: 0.3 } }); return nlsPredict(f, { newdata: { x: [1e4, -1e4, NaN] } }); });
out("nls non-identifiable a*b*x", () => JSON.stringify(nls("y ~ a*b*x", { y: ex.map(v => 2 * v + 0.01 * Math.sin(v)), x: ex }, { start: { a: 1, b: 1 } }).coefficients));
out("nls constant x for SSlogis", () => JSON.stringify(nls("y ~ SSlogis(x, A, m, s)", { y: [1, 2, 3, 4, 5, 6], x: [2, 2, 2, 2, 2, 2] }).coefficients));
