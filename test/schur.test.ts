// The real Schur decomposition (Matrix::Schur) against R (oracle/matfn.R), by the rules of oracle/matfn-behaviour.md.
// The decomposition is not unique, so each case checks
// - ‖Q'Q − I‖_max ≤ 1e-13 n and ‖Q T Q' − x‖_max ≤ 1e-13 n ‖x‖_max;
// - T quasi-triangular with standardised 2 × 2 blocks [[a, b], [c, a]], b c < 0 (entries below the block diagonal
//   exactly 0), and the eigenvalues as they are read off T's blocks;
// - the eigenvalues, as a multiset, against R's EValues by the rule of the eigen tests (test/eigen.test.ts): real and
//   imaginary parts within 1e-13 of max(|R's value|, the largest absolute real or imaginary part);
// - where T's diagonal blocks come out in R's order and Q's columns have R's signs, T and Q against R's within 1e-12
//   relative to the largest absolute entry of each (the normwise rule of the linear algebra tests); otherwise not
//   compared.
import { describe, expect, it } from "vitest";
import { schur } from "../src/index.js";
import { arg, loadHTestFixture } from "./helpers/htest.js";

const fixture = loadHTestFixture("schur");
const mat = (v: unknown): number[][] => arg.mat(v as string[][])!;
const vec = (v: unknown): number[] => arg.vec(v as string[])!;
const maxAbs = (m: number[][]) => Math.max(0, ...m.flat().map(Math.abs));

function mul(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0]!.map((_, j) => row.reduce((s, v, k) => s + v * b[k]![j]!, 0)));
}
const transpose = (a: number[][]) => a[0]!.map((_, j) => a.map((r) => r[j]!));

describe("schur", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const failures: string[] = [];
    let orth = 0;
    let recon = 0;
    let values = 0;
    let tq = 0;
    let comparedTQ = 0;
    const notCompared: string[] = [];
    fixture.cases.forEach((c, index) => {
      const x = mat(c.args.x);
      const n = x.length;
      const fail = (msg: string) => failures.push(`#${index}: ${msg}`);
      const { T, Q, valuesRe, valuesIm } = schur(x);
      // Q orthogonal, x = Q T Q'
      const qtq = mul(transpose(Q), Q);
      const eOrth = maxAbs(qtq.map((r, i) => r.map((v, j) => v - (i === j ? 1 : 0)))) / n;
      const eRecon = maxAbs(mul(mul(Q, T), transpose(Q)).map((r, i) => r.map((v, j) => v - x[i]![j]!))) / (n * maxAbs(x));
      orth = Math.max(orth, eOrth);
      recon = Math.max(recon, eRecon);
      if (eOrth > 1e-13) fail(`‖Q'Q − I‖ / n = ${eOrth.toExponential(2)}`);
      if (eRecon > 1e-13) fail(`‖QTQ' − x‖ / (n ‖x‖) = ${eRecon.toExponential(2)}`);
      // Structure of T and its eigenvalues
      for (let j = 0; j < n; j++) {
        for (let i = j + 2; i < n; i++) if (T[i]![j] !== 0) fail(`T[${i + 1}, ${j + 1}] = ${T[i]![j]} (below the block diagonal)`);
        const sub = j + 1 < n ? T[j + 1]![j]! : 0;
        if (sub === 0) {
          if (valuesRe[j] !== T[j]![j] || valuesIm[j] !== 0) fail(`eigenvalue ${j + 1} is not T's diagonal entry`);
          continue;
        }
        if (j + 2 < n && T[j + 2]![j + 1] !== 0) fail(`overlapping 2 × 2 blocks at ${j + 1}`);
        const [a, b, cc, d] = [T[j]![j]!, T[j]![j + 1]!, sub, T[j + 1]![j + 1]!];
        if (a !== d || !(b * cc < 0)) fail(`2 × 2 block at ${j + 1} is not standardised: [[${a}, ${b}], [${cc}, ${d}]]`);
        const im = Math.sqrt(Math.abs(b)) * Math.sqrt(Math.abs(cc));
        if (valuesRe[j] !== a || valuesRe[j + 1] !== a || valuesIm[j] !== im || valuesIm[j + 1] !== -im) {
          fail(`eigenvalues ${j + 1}, ${j + 2} are not read off T's block`);
        }
        j++;
      }
      // The eigenvalues as a multiset (each of R's matched with the nearest unused one)
      const rRe = vec(c.expected.EValuesRe);
      const rIm = vec(c.expected.EValuesIm);
      const floor = Math.max(...rRe.map(Math.abs), ...rIm.map(Math.abs));
      const err = (a: number, e: number) => (a === e ? 0 : Math.abs(a - e) / Math.max(Math.abs(e), floor));
      const used = new Set<number>();
      rRe.forEach((re, k) => {
        let best = -1;
        let bestDist = Infinity;
        for (let m = 0; m < n; m++) {
          if (used.has(m)) continue;
          const dist = Math.hypot(valuesRe[m]! - re, valuesIm[m]! - rIm[k]!);
          if (dist < bestDist) [best, bestDist] = [m, dist];
        }
        used.add(best);
        const e = Math.max(err(valuesRe[best]!, re), err(valuesIm[best]!, rIm[k]!));
        values = Math.max(values, e);
        if (e > 1e-13) fail(`eigenvalue ${re} + ${rIm[k]}i: closest ${valuesRe[best]} + ${valuesIm[best]}i (${e.toExponential(2)})`);
      });
      // T and Q, where the blocks are in R's order and Q's columns have R's signs
      const rT = mat(c.expected.T);
      const rQ = mat(c.expected.Q);
      const sameOrder = rRe.every((re, k) => Math.max(err(valuesRe[k]!, re), err(valuesIm[k]!, rIm[k]!)) <= 1e-13);
      const sameSigns = rQ[0]!.every((_, j) => rQ.reduce((s, r, i) => s + r[j]! * Q[i]![j]!, 0) > 0);
      if (!sameOrder || !sameSigns) notCompared.push(`#${index} (${sameOrder ? "signs" : "order"})`);
      else {
        comparedTQ++;
        for (const [name, ours, theirs] of [["T", T, rT], ["Q", Q, rQ]] as const) {
          const top = maxAbs(theirs);
          const e = maxAbs(ours.map((r, i) => r.map((v, j) => v - theirs[i]![j]!))) / top;
          tq = Math.max(tq, e);
          if (e > 1e-12) fail(`${name} differs from R's by ${e.toExponential(2)} (normwise)`);
        }
      }
    });
    console.log(
      [
        `schur: ${fixture.cases.length} cases`,
        `  max ‖Q'Q − I‖ / n ${orth.toExponential(1)}, max ‖QTQ' − x‖ / (n ‖x‖) ${recon.toExponential(1)}, eigenvalues ${values.toExponential(1)}`,
        `  T and Q compared with R's on ${comparedTQ} cases (blocks in R's order, Q's columns with R's signs): max normwise error ${tq.toExponential(1)}; not compared: ${notCompared.join(", ")}`,
      ].join("\n"),
    );
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
