// Numbers as group labels or factor levels are grouped by their 15-digit text, as R's factor() groups them
// (oracle/report-0.11.1-behaviour.md, 1.4). The fixtures cover table, tapply, split, aggregate and the formula forms
// of the k-sample tests; these check the other places: each gives the same result for labels that differ beyond 15
// digits as for the labels written the same.
import { describe, expect, it } from "vitest";
import {
  aovEz,
  coxph,
  jonckheereTest,
  kappamFleiss,
  kruskalTest,
  mcnemarTest,
  pairwiseTTest,
  polychor,
  polyserial,
  survdiff,
  survfit,
  TukeyHSD,
} from "../src/index.js";

const a = 0.1 + 0.2; // "0.3"
const b = 1e15 + 1; // "1e+15"

describe("numeric labels with the same text are one level", () => {
  const y = [3.1, 2.4, 5.6, 4.4, 6.1, 1.9, 7.3, 5.2, 4.8];
  const g = [a, 0.3, 0.3, 0.7, 0.1 * 7, 0.7, 1e15, b, 1e15];
  const same = [0.3, 0.3, 0.3, 0.7, 0.7, 0.7, 1e15, 1e15, 1e15];

  it("in the x, g form of the k-sample tests", () => {
    expect(kruskalTest(y, g)).toEqual(kruskalTest(y, same));
    expect(TukeyHSD(y, g)).toEqual(TukeyHSD(y, same));
  });

  it("in the pairwise tests", () => {
    expect(pairwiseTTest(y, g)).toEqual(pairwiseTTest(y, same));
  });

  it("in jonckheereTest", () => {
    expect(jonckheereTest(y, g)).toEqual(jonckheereTest(y, same));
  });

  it("in mcnemarTest", () => {
    const x = [1, 2, a, 0.3, 1, 2, 0.3, 1];
    const z = [1, 2, 0.3, 1, 2, 2, a, 0.3];
    const xs = x.map((v) => (v === a ? 0.3 : v));
    const zs = z.map((v) => (v === a ? 0.3 : v));
    expect(mcnemarTest(x, z)).toEqual(mcnemarTest(xs, zs));
  });

  it("in survdiff, survfit and the strata of coxph", () => {
    const time = [5, 3, 8, 1, 9, 4, 6, 2];
    const status = [1, 1, 0, 1, 0, 1, 1, 1];
    const grp = [a, 0.3, b, 1e15, a, 1e15, 0.3, b];
    const grpSame = grp.map((v) => (v === a ? 0.3 : v === b ? 1e15 : v));
    expect(survdiff(time, status, grp)).toEqual(survdiff(time, status, grpSame));
    expect(survfit(time, status, { group: grp })).toEqual(survfit(time, status, { group: grpSame }));
    const x = [[1.2], [0.3], [-0.5], [2], [0.7], [0.1], [1.1], [-0.2]];
    expect(coxph(time, status, x, { strata: grp })).toEqual(coxph(time, status, x, { strata: grpSame }));
  });

  it("in aovEz", () => {
    const data = {
      id: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
      g: [a, a, 0.3, 0.3, 0.3, 0.3, 0.7, 0.7, 0.1 * 7, 0.1 * 7, 0.7, 0.7],
      w: [1, b, 1, 1e15, 1, 1e15, 1, b, 1, 1e15, 1, 1e15],
      y: [3.1, 2.4, 5.6, 4.4, 6.1, 1.9, 7.3, 5.2, 4.8, 3.3, 6.6, 2.2],
    };
    const same = { ...data, g: data.g.map((v) => (v < 0.5 ? 0.3 : 0.7)), w: data.w.map((v) => (v === b ? 1e15 : v)) };
    const options = { id: "id", dv: "y", between: "g", within: "w" };
    expect(aovEz(data, options)).toEqual(aovEz(same, options));
  });

  it("in polychor, polyserial and kappamFleiss", () => {
    const x = [1, 1, 2, a, 0.3, 2, 1, a, 2, 0.3];
    const z = [1, 2, 2, 0.3, a, 1, 1, 0.3, 2, 2];
    const xs = x.map((v) => (v === a ? 0.3 : v));
    const zs = z.map((v) => (v === a ? 0.3 : v));
    expect(polychor(x, z)).toEqual(polychor(xs, zs));
    const c = [0.2, -1.1, 0.8, 1.5, -0.3, 0.1, -0.9, 2.0, 0.4, -0.6];
    expect(polyserial(c, z)).toEqual(polyserial(c, zs));
    const ratings = x.map((v, i) => [v, z[i]!, i % 2 === 0 ? a : 1]);
    const ratingsSame = ratings.map((r) => r.map((v) => (v === a ? 0.3 : v)));
    expect(kappamFleiss(ratings)).toEqual(kappamFleiss(ratingsSame));
  });
});
