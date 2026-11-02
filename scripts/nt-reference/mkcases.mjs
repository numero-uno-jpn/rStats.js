// Writes the input file of ntref.R / ntrefz.R: each double as an exact mantissa and binary exponent (Windows R does
// not round decimal literals such as 1e308 correctly, so the doubles are not passed as decimals).
//
// usage: node scripts/nt-reference/mkcases.mjs cases.txt < cases.json
//   cases.json: [["p", t, df, ncp], ["d", t, df, ncp], ...]  (p: log P[T <= t], d: log f(t))
import { readFileSync, writeFileSync } from "node:fs";

function mantissaExponent(x) {
  if (x === 0) return "0 0";
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const sign = bits >> 63n ? -1n : 1n;
  const biased = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & 0xfffffffffffffn;
  const [m, e] = biased === 0 ? [frac, -1074] : [frac | (1n << 52n), biased - 1075];
  return `${(sign * m).toString()} ${e}`;
}

const cases = JSON.parse(readFileSync(0, "utf8"));
const lines = cases.map(([kind, t, df, ncp]) => `${kind} ${mantissaExponent(t)} ${mantissaExponent(df)} ${mantissaExponent(ncp)}`);
writeFileSync(process.argv[2], lines.join("\n") + "\n");
