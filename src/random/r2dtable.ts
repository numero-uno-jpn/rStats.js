// Random two-way tables with given margins: r2dtable, and the generator behind the simulated p-values of chisqTest
// and fisherTest.
//
// Written for rStats.js from Patefield, W. M. (1981), "Algorithm AS 159: An efficient method of generating random
// R x C tables with given row and column totals", Applied Statistics 30, 91-97 (no ported code). The table is filled
// row by row, left to right. Given what is left of the row total (ia), of the column total (id) and of the grand total
// over this and the later columns of the remaining rows (ie), the cell follows a hypergeometric distribution. One
// uniform u is drawn per cell; the search starts at the mode floor(ia id / ie + 1/2) and moves alternately one step up
// and one step down, adding the probabilities (updated by their ratios), until the sum reaches u. If both ends of the
// support are reached first (the sum fell short of u by rounding), u is replaced by sum * (a new uniform) and the
// search starts again at the mode. The last column of each row and the last row follow from the margins. A cell
// whose remaining total ie is 0 (all later rows and columns empty) is 0 without a draw. This consumes uniforms as R's
// r2dtable does (checked against R's output).

import { unifRand } from "./rng.js";

/** log k! for k = 0..n, accumulated as sums of logs (the table AS 159 uses) */
export function logFactorialTable(n: number): Float64Array {
  const f = new Float64Array(n + 1);
  for (let i = 2; i <= n; i++) f[i] = f[i - 1]! + Math.log(i);
  return f;
}

/**
 * One random table with row totals `r` and column totals `c` (equal sums, non-negative integers), filled into `out`
 * column by column (out[i + j * nr]). `fact` is {@link logFactorialTable} of at least the grand total.
 */
export function rcont2(r: readonly number[], c: readonly number[], fact: Float64Array, out: Int32Array): void {
  const nr = r.length;
  const nc = c.length;
  const colLeft = Array.from(c);
  let rest = 0; // grand total of the rows not yet filled
  for (const v of r) rest += v;
  for (let l = 0; l < nr - 1; l++) {
    let ia = r[l]!;
    let ic = rest; // total of the cells to the right of (and including) the current column, in rows l..nr-1
    rest -= ia;
    let m = 0;
    for (; m < nc - 1; m++) {
      const id = colLeft[m]!;
      const ie = ic;
      ic -= id;
      const ib = ie - ia;
      const ii = ib - id;
      if (ie === 0) {
        // nothing left in this block: the rest of the row is 0
        for (let j = m; j < nc - 1; j++) out[l + j * nr] = 0;
        ia = 0;
        break;
      }
      let u = unifRand();
      let nlm: number;
      search: for (;;) {
        // mode of the conditional distribution and its probability
        nlm = Math.floor(ia * (id / ie) + 0.5);
        let x = Math.exp(
          fact[ia]! + fact[ib]! + fact[ic]! + fact[id]! - fact[ie]! - fact[nlm]! - fact[id - nlm]! - fact[ia - nlm]! - fact[ii + nlm]!,
        );
        if (x >= u) break;
        if (x === 0) throw new Error(`r2dtable: probability underflow at cell [${l}, ${m}]`);
        let sum = x;
        let y = x;
        let low = nlm;
        let upDone = false;
        let downDone = false;
        while (!(upDone && downDone)) {
          if (!upDone) {
            const j = (id - nlm) * (ia - nlm);
            if (j === 0) upDone = true;
            else {
              nlm++;
              x = (x * j) / (nlm * (ii + nlm));
              sum += x;
              if (sum >= u) break search;
            }
          }
          // a step down after each step up; only down once the top is reached
          do {
            const j = low * (ii + low);
            if (j === 0) {
              downDone = true;
              break;
            }
            low--;
            y = (y * j) / ((id - low) * (ia - low));
            sum += y;
            if (sum >= u) {
              nlm = low;
              break search;
            }
          } while (upDone);
        }
        u = sum * unifRand();
      }
      out[l + m * nr] = nlm;
      ia -= nlm;
      colLeft[m] = colLeft[m]! - nlm;
    }
    out[l + (nc - 1) * nr] = ia;
  }
  // the last row is what is left of the column totals
  let last = c[nc - 1]!;
  for (let l = 0; l < nr - 1; l++) last -= out[l + (nc - 1) * nr]!;
  for (let m = 0; m < nc - 1; m++) out[nr - 1 + m * nr] = colLeft[m]!;
  out[nr - 1 + (nc - 1) * nr] = last;
}

/** Margins as integers (R's as.integer truncates), checked as R's r2dtable does */
function margins(v: readonly number[], name: string): number[] {
  const out = Array.from(v, (e) => Math.trunc(e));
  if (out.length <= 1 || out.some((e) => !(e >= 0) || e > 2147483647)) throw new RangeError(`invalid argument '${name}'`);
  return out;
}

/**
 * Random two-way tables with given row and column totals. Equivalent to R's `r2dtable()`.
 *
 * Uses Patefield's (1981) algorithm and consumes the same uniforms as R, so after `setSeed` the tables are R's.
 * Each table is returned as an array of rows (R returns a list of matrices).
 *
 * @param n Number of tables (fractions are truncated, as in R).
 * @param r Row totals (non-negative integers, at least two).
 * @param c Column totals (non-negative integers, at least two), with the same sum as `r`.
 * @returns An array of `n` tables, each `r.length` rows of `c.length` counts.
 * @throws RangeError for invalid arguments or totals that differ.
 *
 * @example
 * ```ts
 * setSeed(1);
 * r2dtable(1, [3, 2], [2, 3]); // [[[1, 2], [1, 1]]]  (R: set.seed(1); r2dtable(1, c(3, 2), c(2, 3)))
 * ```
 *
 * @category Random numbers
 */
export function r2dtable(n: number, r: readonly number[], c: readonly number[]): number[][][] {
  const count = Math.trunc(n);
  if (!(count >= 0)) throw new RangeError("invalid argument 'n'");
  const rows = margins(r, "r");
  const cols = margins(c, "c");
  const total = rows.reduce((a, b) => a + b, 0);
  if (total !== cols.reduce((a, b) => a + b, 0)) throw new RangeError("arguments 'r' and 'c' must have the same sums");
  const fact = logFactorialTable(total);
  const out = new Int32Array(rows.length * cols.length);
  const tables: number[][][] = [];
  for (let k = 0; k < count; k++) {
    rcont2(rows, cols, fact, out);
    tables.push(rows.map((_, i) => cols.map((_, j) => out[i + j * rows.length]!)));
  }
  return tables;
}
