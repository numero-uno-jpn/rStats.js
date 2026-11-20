// NIST StRD nonlinear regression problems (public domain, https://www.itl.nist.gov/div898/strd/nls/).
// Download the 27 .dat files into <tmp>/strd first. Prints the log relative error (LRE, digits) against the certified values.
// Usage: npx esbuild src/entries/regression.ts --bundle --format=esm --platform=node --outfile=<tmp>/reg.mjs
//        node experiments/regression-nls-strd.mjs <tmp>
const R = await import(new URL("reg.mjs", new URL(`file://${process.argv[2]}/`)).href);
import { readFileSync, readdirSync } from "node:fs";
const { nls, nlsSummary } = R;
const PI = "3.141592653589793";
const F = {
  Bennett5: "y ~ b1 * (b2+x)^(-1/b3)", BoxBOD: "y ~ b1*(1-exp(-b2*x))", Chwirut1: "y ~ exp(-b1*x)/(b2+b3*x)", Chwirut2: "y ~ exp(-b1*x)/(b2+b3*x)",
  DanWood: "y ~ b1*x^b2", ENSO: `y ~ b1 + b2*cos(2*${PI}*x/12) + b3*sin(2*${PI}*x/12) + b5*cos(2*${PI}*x/b4) + b6*sin(2*${PI}*x/b4) + b8*cos(2*${PI}*x/b7) + b9*sin(2*${PI}*x/b7)`,
  Eckerle4: "y ~ (b1/b2) * exp(-0.5*((x-b3)/b2)^2)",
  Gauss1: "y ~ b1*exp(-b2*x) + b3*exp(-(x-b4)^2/b5^2) + b6*exp(-(x-b7)^2/b8^2)", Gauss2: "y ~ b1*exp(-b2*x) + b3*exp(-(x-b4)^2/b5^2) + b6*exp(-(x-b7)^2/b8^2)", Gauss3: "y ~ b1*exp(-b2*x) + b3*exp(-(x-b4)^2/b5^2) + b6*exp(-(x-b7)^2/b8^2)",
  Hahn1: "y ~ (b1+b2*x+b3*x^2+b4*x^3)/(1+b5*x+b6*x^2+b7*x^3)", Thurber: "y ~ (b1+b2*x+b3*x^2+b4*x^3)/(1+b5*x+b6*x^2+b7*x^3)", Kirby2: "y ~ (b1+b2*x+b3*x^2)/(1+b4*x+b5*x^2)",
  Lanczos1: "y ~ b1*exp(-b2*x) + b3*exp(-b4*x) + b5*exp(-b6*x)", Lanczos2: "y ~ b1*exp(-b2*x) + b3*exp(-b4*x) + b5*exp(-b6*x)", Lanczos3: "y ~ b1*exp(-b2*x) + b3*exp(-b4*x) + b5*exp(-b6*x)",
  MGH09: "y ~ b1*(x^2+x*b2)/(x^2+x*b3+b4)", MGH10: "y ~ b1*exp(b2/(x+b3))", MGH17: "y ~ b1 + b2*exp(-x*b4) + b3*exp(-x*b5)",
  Misra1a: "y ~ b1*(1-exp(-b2*x))", Misra1b: "y ~ b1*(1-(1+b2*x/2)^(-2))", Misra1c: "y ~ b1*(1-(1+2*b2*x)^(-0.5))", Misra1d: "y ~ b1*b2*x*((1+b2*x)^(-1))",
  Nelson: "logy ~ b1 - b2*x1*exp(-b3*x2)", Rat42: "y ~ b1/(1+exp(b2-b3*x))", Rat43: "y ~ b1/((1+exp(b2-b3*x))^(1/b4))",
};
const level = { Misra1a:"lower",Chwirut2:"lower",Chwirut1:"lower",Lanczos3:"lower",Gauss1:"lower",Gauss2:"lower",DanWood:"lower",Misra1b:"lower",Kirby2:"average",Hahn1:"average",Nelson:"average",MGH17:"average",Lanczos1:"average",Lanczos2:"average",Gauss3:"average",Misra1c:"average",Misra1d:"average",Roszman1:"average",ENSO:"average",MGH09:"higher",Thurber:"higher",BoxBOD:"higher",Rat42:"higher",MGH10:"higher",Eckerle4:"higher",Rat43:"higher",Bennett5:"higher" };
const LRE = (a, c) => { if (a === c) return 11; const v = -Math.log10(Math.abs(a - c) / Math.abs(c)); return Math.min(11, v); };
for (const name of Object.keys(F)) {
  const txt = readFileSync(`${process.argv[2]}/strd/${name}.dat`, "latin1").split(/\r?\n/);
  const params = [], start1 = {}, start2 = {}, cert = {}, sd = {};
  for (const line of txt) { const m = line.match(/^\s*(b\d+)\s*=\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/); if (m) { params.push(m[1]); start1[m[1]] = +m[2]; start2[m[1]] = +m[3]; cert[m[1]] = +m[4]; sd[m[1]] = +m[5]; } }
  const rssC = +txt.find(l => /Residual Sum of Squares/.test(l)).match(/(\S+)\s*$/)[1];
  const di = txt.findIndex(l => /^Data:\s+[a-z]/.test(l));
  const header = txt[di].replace(/^Data:\s*/, "").trim().split(/\s+/);
  const rows = txt.slice(di + 1).filter(l => l.trim()).map(l => l.trim().split(/\s+/).map(Number));
  const data = {}; header.forEach((h, j) => data[h] = rows.map(r => r[j])); if (name === "Nelson") data.logy = data.y.map(Math.log);
  for (const [lab, st] of [["start1", start1], ["start2", start2]]) {
    let out;
    const t0 = performance.now();
    try {
      const fit = nls(F[name], data, { start: st, control: { maxiter: 1000 } });
      const s = nlsSummary(fit).coefficients;
      const lreB = Math.min(...params.map(p => LRE(fit.coefficients[p], cert[p])));
      const lreSE = Math.min(...params.map((p, i) => LRE(s.values[s.rows.indexOf(p)][1], sd[p])));
      out = `LRE coef ${lreB.toFixed(1).padStart(4)}  SE ${lreSE.toFixed(1).padStart(4)}  RSS ${LRE(fit.deviance, rssC).toFixed(1).padStart(4)}` + (fit.converged ? "" : " NOT CONVERGED") + (fit.warnings.length ? " W:" + fit.warnings.join("|").slice(0, 60) : "");
    } catch (e) { out = "ERROR " + e.message.slice(0, 90); }
    console.log(name.padEnd(9), level[name].padEnd(8), lab, out, `${(performance.now() - t0).toFixed(0)}ms`);
  }
}
