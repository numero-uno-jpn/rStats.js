// mediation116-eigensign.mjs: sign rules for the eigenvectors in experiments/mediation116-eigensign.json (1.16.0).
// 2 x 2: LAPACK's dlaev2 closed form (LAPACK is modified BSD). 3 and more: LAPACK's dsytd2 with uplo = "L", then the
// rule "the largest component in the tridiagonal basis is positive". Written for rStats.js.
// Run: node experiments/mediation116-eigensign.mjs experiments/mediation116-eigensign.json
import { readFileSync } from "node:fs";
const o = JSON.parse(readFileSync(process.argv[2], "utf8"));

function laev2(a, b, c) {
  const sm = a + c, df = a - c, adf = Math.abs(df), tb = b + b, ab = Math.abs(tb);
  let acmx, acmn; if (Math.abs(a) > Math.abs(c)) { acmx = a; acmn = c; } else { acmx = c; acmn = a; }
  const rt = adf > ab ? adf * Math.sqrt(1 + (ab / adf) ** 2) : adf < ab ? ab * Math.sqrt(1 + (adf / ab) ** 2) : ab * Math.SQRT2;
  let rt1, rt2, sgn1;
  if (sm < 0) { rt1 = 0.5 * (sm - rt); sgn1 = -1; rt2 = (acmx / rt1) * acmn - (b / rt1) * b; }
  else if (sm > 0) { rt1 = 0.5 * (sm + rt); sgn1 = 1; rt2 = (acmx / rt1) * acmn - (b / rt1) * b; }
  else { rt1 = 0.5 * rt; rt2 = -0.5 * rt; sgn1 = 1; }
  let cs, sgn2; if (df >= 0) { cs = df + rt; sgn2 = 1; } else { cs = df - rt; sgn2 = -1; }
  let cs1, sn1;
  if (Math.abs(cs) > ab) { const ct = -tb / cs; sn1 = 1 / Math.sqrt(1 + ct * ct); cs1 = ct * sn1; }
  else if (ab === 0) { cs1 = 1; sn1 = 0; }
  else { const tn = -cs / tb; cs1 = 1 / Math.sqrt(1 + tn * tn); sn1 = tn * cs1; }
  if (sgn1 === sgn2) { const tn = cs1; cs1 = -sn1; sn1 = tn; }
  return { rt1, rt2, cs1, sn1 };
}
let n = 0, signOk = 0, maxd = 0;
for (const c of o.cases) {
  if (c.S.length !== 2) continue; n++;
  const { rt1, rt2, cs1, sn1 } = laev2(c.S[0][0], c.S[1][0], c.S[1][1]);
  // R: decreasing order; column 1 = the larger eigenvalue
  let v1, v2;
  if (rt1 >= rt2) { v1 = [cs1, sn1]; v2 = [-sn1, cs1]; } else { v1 = [-sn1, cs1]; v2 = [cs1, sn1]; }
  const V = c.vectors; const d = Math.max(Math.abs(V[0][0] - v1[0]), Math.abs(V[1][0] - v1[1]), Math.abs(V[0][1] - v2[0]), Math.abs(V[1][1] - v2[1]));
  const sameSign = Math.sign(V[0][0]) === Math.sign(v1[0]) && Math.sign(V[1][0]) === Math.sign(v1[1]) && Math.sign(V[0][1]) === Math.sign(v2[0]) && Math.sign(V[1][1]) === Math.sign(v2[1]);
  if (sameSign) signOk++; else if (n - signOk < 4) console.log("miss", c.S, V, v1, v2);
  if (sameSign) maxd = Math.max(maxd, d);
}
console.log({ n, signOk, maxd });

// LAPACK dsytd2 with uplo = "L" (unblocked, n < 32): returns d, e and the reflectors (tau, v)
function sytd2L(S) {
  const n = S.length; const A = S.map(r => r.slice()); const taus = [], vs = [];
  for (let i = 0; i < n - 1; i++) {
    // dlarfg on alpha = A[i+1][i], x = A[i+2..n-1][i]
    let alpha = A[i + 1][i]; let xn = 0; for (let k = i + 2; k < n; k++) xn = Math.hypot(xn, A[k][i]);
    let tau = 0; const v = Array(n).fill(0); v[i + 1] = 1;
    if (xn !== 0) {
      const beta = -Math.sign(alpha || 1) * Math.hypot(alpha, xn); // sign(x, alpha): +|x| if alpha >= 0
      tau = (beta - alpha) / beta; const sc = 1 / (alpha - beta);
      for (let k = i + 2; k < n; k++) { A[k][i] *= sc; v[k] = A[k][i]; }
      alpha = beta;
      // x = tau * A22 * v ; w = x - (tau/2)(x.v) v ; A22 -= v w' + w v'
      const x = Array(n).fill(0);
      for (let r = i + 1; r < n; r++) { let s = 0; for (let c = i + 1; c < n; c++) s += A[r][c] * v[c]; x[r] = tau * s; }
      let xv = 0; for (let r = i + 1; r < n; r++) xv += x[r] * v[r];
      const w = x.map((xr, r) => xr - 0.5 * tau * xv * v[r]);
      for (let r = i + 1; r < n; r++) for (let c = i + 1; c < n; c++) A[r][c] -= v[r] * w[c] + w[r] * v[c];
    }
    A[i + 1][i] = alpha; taus.push(tau); vs.push(v);
  }
  return { taus, vs };
}
// Q' y = H(n-1) ... H(1) y  (Q = H(1) ... H(n-1), each H symmetric)
function qt(taus, vs, y) { let z = y.slice(); for (let i = 0; i < taus.length; i++) { const v = vs[i]; let s = 0; for (let k = 0; k < z.length; k++) s += v[k] * z[k]; for (let k = 0; k < z.length; k++) z[k] -= taus[i] * s * v[k]; } return z; }
const res = {};
for (const c of o.cases) {
  const p = c.S.length; if (p < 3) continue;
  const { taus, vs } = sytd2L(c.S);
  res[p] ??= { cols: 0, maxPos: 0, close: 0, missClose: 0 };
  for (let j = 0; j < p; j++) {
    const z = qt(taus, vs, c.vectors.map(r => r[j]));
    const a = z.map(Math.abs); let m = 0; for (let k = 1; k < p; k++) if (a[k] > a[m]) m = k;
    const sorted = [...a].sort((x, y) => y - x); const near = sorted[1] / sorted[0] > 0.9;
    res[p].cols++; if (z[m] > 0) res[p].maxPos++; else { if (near) res[p].missClose++; const ord=[...a.keys()].sort((x,y)=>a[y]-a[x]); res[p].rankPos ??= {}; const firstPos = ord.findIndex(k => z[k] > 0); res[p].rankPos[firstPos]=(res[p].rankPos[firstPos]??0)+1; if ((res[p].shown=(res[p].shown??0)+1)<=3) console.log(p,'col',j,'of',p,'vals',c.values.map(x=>x.toPrecision(3)).join(' '),'z',z.map(x=>x.toFixed(4)).join(' ')); }
    if (near) res[p].close++;
  }
}
console.log(res);
