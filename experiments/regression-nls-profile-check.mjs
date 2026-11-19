// Independent profile: finite-difference Levenberg-Marquardt for the nuisance fit, bisection for the root.
// Usage: npx esbuild src/entries/regression.ts --bundle --format=esm --platform=node --outfile=<tmp>/reg.mjs
//        npx esbuild src/entries/distributions.ts --bundle --format=esm --platform=node --outfile=<tmp>/dist.mjs
//        node experiments/regression-nls-profile-check.mjs <tmp>
const dir = new URL(`file://${process.argv[2]}/`);
const { nls, nlsConfint } = await import(new URL("reg.mjs", dir).href);
const { qt } = await import(new URL("dist.mjs", dir).href);
import { readFileSync } from "node:fs";
const f = JSON.parse(readFileSync(new URL("../test/fixtures/nls.json", import.meta.url), "utf8"));
const models = {
  "bod-exp": [["A","lrc"], (p, d, i) => p.A * (1 - Math.exp(-Math.exp(p.lrc) * d.Time[i])), "demand"],
  "loblolly-SSasymp": [["Asym","R0","lrc"], (p, d, i) => p.Asym + (p.R0 - p.Asym) * Math.exp(-Math.exp(p.lrc) * d.age[i]), "height"],
  "dnase-plinear-logistic": [["xmid","scal",".lin"], (p, d, i) => p[".lin"] / (1 + Math.exp((p.xmid - Math.log(d.conc[i])) / p.scal)), "density"],
  "puromycin-plinear": [["K",".lin"], (p, d, i) => p[".lin"] * d.conc[i] / (p.K + d.conc[i]), "rate"],
  "puromycin-default": [["Vm","K"], (p, d, i) => p.Vm * d.conc[i] / (p.K + d.conc[i]), "rate"],
};
function rss(p, m, d) { const y = d[m[2]]; let s = 0; for (let i = 0; i < y.length; i++) { const r = y[i] - m[1](p, d, i); s += r * r; } return s; }
function fitFree(p0, free, m, d) {
  let p = { ...p0 }, lam = 1e-3, S = rss(p, m, d); const y = d[m[2]], n = y.length, k = free.length;
  for (let it = 0; it < 500; it++) {
    const r = y.map((yi, i) => yi - m[1](p, d, i));
    const J = free.map(nm => { const h = 1e-7 * Math.max(1, Math.abs(p[nm])); const q = { ...p, [nm]: p[nm] + h }, q2 = { ...p, [nm]: p[nm] - h }; return y.map((_, i) => (m[1](q, d, i) - m[1](q2, d, i)) / (2 * h)); });
    const A = free.map((_, a) => free.map((_, b) => J[a].reduce((s, v, i) => s + v * J[b][i], 0))), g = free.map((_, a) => J[a].reduce((s, v, i) => s + v * r[i], 0));
    let improved = false;
    for (let t = 0; t < 30; t++) {
      const M = A.map((row, a) => row.map((v, b) => v + (a === b ? lam * v : 0)));
      const step = solve(M, g); const q = { ...p }; free.forEach((nm, a) => q[nm] += step[a]);
      const Sq = rss(q, m, d);
      if (Sq < S) { const rel = (S - Sq) / S; p = q; S = Sq; lam = Math.max(lam / 10, 1e-12); improved = true; if (rel < 1e-15) return [p, S]; break; }
      lam *= 10;
    }
    if (!improved) return [p, S];
  }
  return [p, S];
}
function solve(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let c = 0; c < n; c++) { let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r; [M[c], M[piv]] = [M[piv], M[c]]; for (let r = 0; r < n; r++) if (r !== c) { const fct = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= fct * M[c][k]; } } return M.map((r, i) => r[n] / r[i]); }
for (const [id, m] of Object.entries(models)) {
  const c = f.cases.find(x => x.id === id), d = c.data;
  const [phat, Shat] = fitFree(c.fitTight.value.coefficients, m[0], m, d);
  const n = d[m[2]].length, df = n - m[0].length, s2 = Shat / df;
  const fit = nls(c.formula, c.data, c.args);
  for (const level of [0.95, 0.9]) {
    const target = s2 * qt((1 + level) / 2, df) ** 2;
    const ci = nlsConfint(fit, { level });
    const Rv = c.confint[level === 0.95 ? "profile95" : "profile90"].value;
    for (const nm of ci.rows) {
      const free = m[0].filter(x => x !== nm);
      const prof = v => { const [, S] = fitFree({ ...phat, [nm]: v }, free, m, d); return S - Shat - target; };
      const j = ci.rows.indexOf(nm);
      const Rrow = Rv.cols === null ? Rv.values.map(v => v[0]) : Rv.values[Rv.rows.indexOf(nm)];
      for (const s of [0, 1]) {
        const mine = ci.values[j][s];
        // bisection between estimate and a point beyond max(rStats, R)
        let a = phat[nm], b = s ? Math.max(mine, Rrow[s]) : Math.min(mine, Rrow[s]); b = a + 1.5 * (b - a);
        if (prof(b) < 0) { console.log(id, nm, "not bracketed"); continue; }
        for (let it = 0; it < 100; it++) { const mid = (a + b) / 2; if (prof(mid) < 0) a = mid; else b = mid; }
        const root = (a + b) / 2, rel = v => (Math.abs(v - root) / Math.abs(root)).toExponential(1);
        console.log(id.padEnd(24), String(level).padEnd(4), nm.padEnd(5), s ? "upper" : "lower", "indep", root.toPrecision(10), " rStats err", rel(mine), " R err", rel(Rrow[s]));
      }
    }
  }
}
