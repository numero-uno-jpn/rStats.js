// Add R's warnings to the cases of existing hypothesis-test fixtures, leaving every other byte as it is.
//
//   node scripts/fixture-warnings.mjs ttest wilcox ...   (names of oracle/*.R scripts that call write_htest_fixture)
//   node scripts/fixture-warnings.mjs --check ...        only report, do not write
//   node scripts/fixture-warnings.mjs --run htestwarnings   run an oracle of warnings only as it is (no numbers to keep)
//
// For each fixture the oracle writes with write_htest_fixture(..., warnings = TRUE), the expected object of every case
// on which R gave a result gets a last field "warnings": R's warnings (each distinct one once, in R's order; [] for
// none; without those of oracle/_htest.R's DROPPED_HTEST_WARNINGS). Cases on which R raised an error are left as they
// are. This is what the oracle writes when it is run again (scripts/oracle.sh); this script records the warnings with
// the local R instead, so that the numbers of the fixtures stay as the oracle's image made them (the warnings are
// texts; the R function and its version are the same).
//
// R runs scripts/fixture-warnings.R, which builds the oracle's cases for the R types of the arguments and takes their
// values from the fixture. The numbers are passed to R as hexadecimal floats (exact; R on Windows may read a decimal
// string into a neighbouring double). The script reports the cases whose results differ from the fixture's beyond
// 1e-13 (the platform's last digits) as a check of the rebuilt arguments.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const check = args.includes("--check");
const run = args.includes("--run");
const oracles = args.filter((a) => a !== "--check" && a !== "--run");
if (oracles.length === 0) {
  console.error("usage: node scripts/fixture-warnings.mjs [--check | --run] <oracle name> ...");
  process.exit(1);
}
const rscript = (rArgs) =>
  execFileSync("Rscript", ["--vanilla", "scripts/fixture-warnings.R", ...rArgs], {
    encoding: "utf8",
    env: { ...process.env, LANGUAGE: "en" },
    maxBuffer: 1 << 28,
  });

// --run: the oracle as it is, with its fixtures written to test/fixtures (with LF line ends; R on Windows writes CRLF)
if (run) {
  for (const oracle of oracles) {
    let log;
    try {
      log = rscript(["--run", oracle]);
    } catch (e) {
      // R 4.5.2 on Windows can crash on exit after loading psych and effectsize (status 0xC00000FF): the fixtures
      // written before count when R reported each of them
      if (typeof e.stdout !== "string" || e.stderr !== "") throw e;
      log = e.stdout;
      console.log(`(R exited with status ${e.status} after writing)`);
    }
    process.stdout.write(log);
    const src = readFileSync(`oracle/${oracle}.R`, "utf8");
    for (const [, name] of src.matchAll(/write_htest_fixture\("([A-Za-z]+)"/g)) {
      if (!log.includes(`${name}: `) || !log.includes(`test/fixtures/${name}.json`)) throw new Error(`${name} was not written`);
      const path = `test/fixtures/${name}.json`;
      writeFileSync(path, readFileSync(path, "utf8").replaceAll("\r\n", "\n"));
    }
  }
  process.exit(0);
}

/** Hexadecimal float of a double, normalised ("0x1.<13 digits>p<e>", also for subnormal numbers): exact for R */
function hex(x) {
  if (x === 0) return Object.is(x, -0) ? "-0x0p+0" : "0x0p+0";
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const sign = hi >>> 31 ? "-" : "";
  let e = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  if (e === 0) {
    // subnormal: shift the leading 1 up to bit 52
    e = 1;
    while (!(m & (1n << 52n))) {
      m <<= 1n;
      e--;
    }
    m &= (1n << 52n) - 1n;
  }
  return `${sign}0x1.${m.toString(16).padStart(13, "0")}p${e - 1023 >= 0 ? "+" : ""}${e - 1023}`;
}

const SPECIAL = new Set(["NA", "NaN", "Inf", "-Inf"]);
const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

function strings(v, out) {
  if (typeof v === "string") out.add(v);
  else if (Array.isArray(v)) for (const e of v) strings(e, out);
  else if (v !== null && typeof v === "object") for (const e of Object.values(v)) strings(e, out);
}

/** Index just after the object that starts at text[start] ("{"), skipping strings */
function objectEnd(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error("unterminated object");
}

/** The line with ,"warnings":[...] as the last field of the expected object (replacing one written before) */
function withWarnings(line, warnings) {
  const key = '"expected":{';
  const at = line.indexOf(key);
  if (at < 0) throw new Error(`no expected object: ${line.slice(0, 100)}`);
  const start = at + key.length - 1;
  const end = objectEnd(line, start);
  const expected = JSON.parse(line.slice(start, end));
  if ("error" in expected) throw new Error("warnings for a case with an error");
  // the fields before stay as written
  let body = line.slice(start, end - 1);
  if (expected.warnings !== undefined) {
    const k = body.lastIndexOf(',"warnings":');
    if (k < 0 || JSON.stringify(JSON.parse(`{${body.slice(k + 1)}}`).warnings) !== JSON.stringify(expected.warnings)) {
      throw new Error("warnings is not the last field");
    }
    body = body.slice(0, k);
  }
  return `${line.slice(0, start)}${body},"warnings":${JSON.stringify(warnings)}}${line.slice(end)}`;
}

const work = mkdtempSync(join(tmpdir(), "fixture-warnings-"));
try {
  for (const oracle of oracles) {
    const src = readFileSync(`oracle/${oracle}.R`, "utf8");
    const names = [...src.matchAll(/write_htest_fixture\("([A-Za-z]+)"/g)].map((m) => m[1]);
    for (const name of names) {
      const fixture = JSON.parse(readFileSync(`test/fixtures/${name}.json`, "utf8"));
      const all = new Set();
      for (const c of fixture.cases) strings(c.args, all);
      const nums = [...all].filter((s) => NUMBER.test(s) && !SPECIAL.has(s));
      writeFileSync(join(work, `${name}.map.json`), JSON.stringify({ str: nums, hex: nums.map((s) => hex(Number(s))) }));
    }
    process.stdout.write(rscript([oracle, work.replaceAll("\\", "/")]));
    for (const name of names) {
      const path = `test/fixtures/${name}.json`;
      const recorded = join(work, `${name}.warnings.json`);
      // (fixtures that are not tests: written without warnings = TRUE)
      if (!existsSync(recorded)) continue;
      const text = readFileSync(path, "utf8");
      const warnings = JSON.parse(readFileSync(recorded, "utf8"));
      const lines = text.split("\n");
      const first = lines.findIndex((l) => l.trim() === '"cases": [') + 1;
      let k = 0;
      const counts = new Map();
      for (let i = first; i < lines.length && lines[i].startsWith("    {"); i++, k++) {
        const w = warnings[k];
        if (w === null) continue;
        for (const m of w) counts.set(m, [...(counts.get(m) ?? []), k]);
        const next = withWarnings(lines[i], w);
        // (a line without warnings before: every other byte is unchanged)
        if (!lines[i].includes('"warnings":') && next.replace(`,"warnings":${JSON.stringify(w)}`, "") !== lines[i]) {
          throw new Error(`${name} case ${k}: line changed`);
        }
        lines[i] = next;
      }
      if (k !== warnings.length) throw new Error(`${name}: ${k} case lines, ${warnings.length} results`);
      for (const [m, ks] of counts) console.log(`  ${ks.length}x ${JSON.stringify(m)} (cases ${ks.slice(0, 8).join(" ")})`);
      if (!check) writeFileSync(path, lines.join("\n"));
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
