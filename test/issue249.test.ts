// Issue #249: distSummary("kumar") integrated the central moments in x, where X lies within O(1/a) of its location:
// a = b = 1e5 gave the kurtosis 459541 (true 2.40), a = b = 1e10 skewness -Infinity, 1e100 and above sd 0 and NaN.
// For a > 100 the moments now come from T = a (X / c - 1), c = b^(-1/a), over e = b X^a (expShape, shared with #240;
// review_fix_log_issue249.md). References: Rmpfr (3000 to 12000 bits) from the raw moments b B(1 + r/a, b).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const K = (a: number, b: number) => distSummary("kumar", { a, b });
const rel = (x: number, y: number): number => Math.abs(x / y - 1);
/** Each field within 4e-15 relative of the reference: the last bits differ between Node versions and libms */
const expectClose = (got: object, want: Record<string, number>): void => {
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
  for (const [k, v] of Object.entries(want)) expect(rel((got as Record<string, number>)[k]!, v), k).toBeLessThan(4e-15);
};

// a, b, sd, skewness, excess kurtosis
const REF: [number, number, number, number, number][] = [
  [101, 101, 0.011940351806206633, -1.0919863319751202, 2.1551122864073515],
  [1000, 1000, 0.001271670535205726, -1.1346324275742834, 2.3741333470163153],
  [1e5, 1e5, 1.2823815083643004e-5, -1.1394978259871604, 2.3997400169753864],
  [1e6, 1e6, 1.2825300438388347e-6, -1.1395421719474161, 2.3999740004953325],
  [1e10, 1e10, 1.2825498270019444e-10, -1.1395470989119016, 2.3999999974000361],
  [1e100, 1e100, 1.2825498301618645e-100, -1.1395470994046486, 2.4],
  [1e5, 2, 1.1180071564367122e-5, -1.609910449642066, 4.079614098818527],
  [1e8, 1000, 1.282160012060885e-8, -1.1405859781633743, 2.4029189618705837],
  [150, 3, 0.0076402530387804592, -1.425183915328653, 3.2524456652300175],
  [200, 1, 0.0049504337821392497, -1.9703697030571991, 5.765576644450884],
  [1000, 1e5, 0.0012662098236495554, -1.1336031296624589, 2.3712632430156586],
  // b < 1: the density diverges at the upper end
  [1e5, 0.5, 8.4267870360678145e-6, -2.6323810474737117, 10.082569653997135],
  [150, 0.1, 0.0030378756442965207, -5.5052164521544515, 42.818469133105971],
  [1e10, 0.1, 4.60037950602672e-11, -5.5737049005430341, 44.230674375353551],
  [1000, 0.001, 4.8932566362782204e-5, -55.003109868959882, 4287.9039797224696],
  [100.5, 1e-20, 1.5223897888280835e-12, -17135108831.98391, 412505024681361380004],
];

describe("issue #249", () => {
  it("gives the subnormal sd and the limiting skewness and kurtosis for a = b = 1e308", () => {
    const s = K(1e308, 1e308);
    expect(s.mean).toBe(1);
    expect(s.variance).toBe(0);
    expect(rel(s.sd, 1.282549830161865e-308)).toBeLessThan(1e-14);
    expect(rel(s.skewness, -1.1395470994046486)).toBeLessThan(1e-14);
    expect(rel(s.kurtosis, 2.4)).toBeLessThan(1e-14);
  });

  it("agrees with Rmpfr for a above 100", () => {
    for (const [a, b, sd, sk, ku] of REF) {
      const s = K(a, b);
      expect(rel(s.sd, sd), `sd ${a} ${b}`).toBeLessThan(1e-14);
      expect(rel(s.skewness, sk), `skewness ${a} ${b}`).toBeLessThan(5e-14);
      expect(rel(s.kurtosis, ku), `kurtosis ${a} ${b}`).toBeLessThan(5e-14);
    }
  });

  it("takes the mean as c (1 + E[T] / a)", () => {
    // Rmpfr: 0x1.fff02777d6e7fp-1, 0x1.fffe08b07bfdep-1, 1 (b B(1 + 1/a, b) gave 0.9999999999999866 for 1e308)
    expect(K(1e5, 1e5).mean).toBe(0.9998791059292244);
    expect(K(1e5, 2).mean).toBe(0.9999850001749981);
    expect(K(1e100, 1e100).mean).toBe(1);
  });

  it("keeps the values for a up to 100", () => {
    expectClose(K(100, 3), {
      mean: 0.9819001437010861, variance: 0.0001290321287602092, sd: 0.011359230993346741, median: 0.9843396545662624,
      mode: 0.9890076253448646, skewness: -1.406422245384422, kurtosis: 3.1435878174730094,
    });
    // Linux's libm gives 9.445000209487072 (relative 1.1e-15), the Windows one 9.445000209487082
    expect(rel(K(100, 0.5).kurtosis, 9.445000209487082)).toBeLessThan(4e-15);
    expect(rel(K(50, 3).skewness, -1.3517442829455675)).toBeLessThan(4e-15);
  });
});
