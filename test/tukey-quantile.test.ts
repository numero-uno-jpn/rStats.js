import { ptukey, qtukey } from "../src/distributions/tukey.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

// qtukey calls ptukey many times, so it lives in a separate file from ptukey (test/tukey.test.ts) to run in parallel

const opts = (a: Record<string, string | boolean>) => ({
  nranges: num(a.nranges),
  lowerTail: bool(a.lowerTail),
  logP: bool(a.logP),
});

fixtureSuite({
  name: "qtukey",
  tolerance: 1e-14,
  call: (a) => qtukey(num(a.p), num(a.nmeans), num(a.df), opts(a)),
  backward: (a, x) => ptukey(x, num(a.nmeans), num(a.df), opts(a)),
});
