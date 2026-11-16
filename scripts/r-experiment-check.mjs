// Clean-room check of the R scripts that .github/workflows/r-experiments.yml runs for an outside contributor:
//
//   node scripts/r-experiment-check.mjs experiments/a.R experiments/b.R
//
// The contributor may call the exported functions of the reference packages and read their documented return
// values, but must not see the packages' source (cmprsk is GPL, rStats.js is MIT). In R, a function's source is one
// step away (typing its name prints it), so a script is rejected when it
//   - names a function of a reference package without calling it (`cuminc`, `cmprsk::cuminc`, `print(cuminc)`),
//   - uses a function that shows or reaches code or namespaces (deparse, body, getAnywhere, :::, asNamespace, ...),
//   - calls compiled code directly (.Fortran, .C, .Call, ...), runs other programs or reads files and URLs,
//   - names a function through a string (get("cuminc"), do.call("cuminc", ...)),
//   - loads or uses (pkg::) a package outside ALLOWED_PACKAGES.
// The check is strict on purpose (a false positive is fixed by rewriting the script) and is not a proof: a person
// still reviews what the scripts do. Comments are ignored; string literals are checked separately.
// Exit status 1 with one line per violation ("file:line: message"), 0 when every script passes.
// Written for rStats.js (no ported code).

import { readFileSync } from "node:fs";

const ALLOWED_PACKAGES = new Set([
  "cmprsk", "survival", "epiR", "exact2x2", "clinfun", "powerSurvEpi", "jsonlite", "stats", "utils", "base",
]);

/** Functions of the reference packages: they may only be called. */
const REFERENCE_FUNCTIONS = [
  "cuminc", "timepoints", "crr", "predict.crr", "summary.crr", "print.crr", "print.summary.crr", "print.cuminc",
  "plot.cuminc", "plot.predict.crr", "crstm", "cinc", "crrfsv", "crrf", "crrvv", "crrsr", "crrfit",
  // epiR, exact2x2, clinfun and powerSurvEpi (sample size and power, roadmap item 1): their exported functions
  "aucVardiTest", "bdrycross.prob", "binomMeld.test", "blaker.exact", "borrControl", "borrOrdering", "borrPreCalc",
  "borrPvals", "borrTest", "boschloo", "calcTall", "calogrank", "constrMLE.difference", "constrMLE.oddsratio",
  "constrMLE.ratio", "coxphCPE", "coxphERR", "coxphQuantile", "CPS.ssize", "createR", "deltaAUC", "epi.2by2",
  "epi.about", "epi.asc", "epi.betabuster", "epi.blcm.paras", "epi.bohning", "epi.ccc", "epi.conf", "epi.convgrid",
  "epi.cp", "epi.cpresids", "epi.descriptives", "epi.dgamma", "epi.directadj", "epi.dms", "epi.dsl", "epi.edr",
  "epi.empbayes", "epi.evalue", "epi.fpos", "epi.herdtest", "epi.indirectadj", "epi.insthaz", "epi.interaction",
  "epi.iref", "epi.iv", "epi.kappa", "epi.ltd", "epi.mbf", "epi.mh", "epi.nomogram", "epi.occc", "epi.offset",
  "epi.pooled", "epi.popsize", "epi.prcc", "epi.prev", "epi.psi", "epi.realrisk", "epi.RtoBUGS", "epi.smd", "epi.smr",
  "epi.sscc", "epi.ssclus1estb", "epi.ssclus1estc", "epi.ssclus2estb", "epi.ssclus2estc", "epi.sscohortc",
  "epi.sscohortt", "epi.sscompb", "epi.sscompc", "epi.sscomps", "epi.ssdetect", "epi.ssdxsesp", "epi.ssdxtest",
  "epi.ssequb", "epi.ssequc", "epi.ssninfb", "epi.ssninfc", "epi.sssimpleestb", "epi.sssimpleestc",
  "epi.ssstrataestb", "epi.ssstrataestc", "epi.sssupb", "epi.sssupc", "epi.ssxsectn", "epi.tests", "exact2x2",
  "exact2x2CI", "exact2x2Plot", "exact2x2Pvals", "fe.mdor", "fe.power", "fe.ssize", "fillsquare", "fisher.exact",
  "fisherCalcMidp", "futilbdry", "getColor", "getDeltaGrid", "getPDQD", "getPI", "getPrange", "gsdesign.binomial",
  "gsdesign.normal", "gsdesign.survival", "jonckheere.test", "mcnemar.exact", "mcnemar.exact.calc", "mcnemarExactDP",
  "mdrr", "numDEpi", "numDEpi.default", "oc.twostage.bdry", "or2pcase", "orderMat", "permlogrank", "ph2simon",
  "ph2single", "pickTstat", "plotRankMat", "plotT", "power.ladesign", "power.stratify", "power2grid",
  "power2gridDifference", "power2gridRatio", "power2x2", "Power2x2", "powerBorr", "powerConLogistic.bin",
  "powerConLogistic.con", "powerCT", "powerCT.default", "powerCT.default0", "powerEpi", "powerEpi.default",
  "powerEpiCont", "powerEpiCont.default", "powerEpiInt", "powerEpiInt.default0", "powerEpiInt.default1",
  "powerEpiInt2", "powerPaired2x2", "powerWelchT", "pselect", "roc.area.test", "roc.curve", "roc.perm.test",
  "rsu.adjrisk", "rsu.dxtest", "rsu.epinf", "rsu.pfree.equ", "rsu.pfree.rs", "rsu.pstar", "rsu.sep", "rsu.sep.cens",
  "rsu.sep.pass", "rsu.sep.rb", "rsu.sep.rb1rf", "rsu.sep.rb2rf", "rsu.sep.rb2st", "rsu.sep.rbvarse", "rsu.sep.rs",
  "rsu.sep.rs2st", "rsu.sep.rsfreecalc", "rsu.sep.rsmult", "rsu.sep.rspool", "rsu.sep.rsvarse", "rsu.spp.rs",
  "rsu.sspfree.rs", "rsu.sssep.rb2st1rf", "rsu.sssep.rb2st2rf", "rsu.sssep.rbmrg", "rsu.sssep.rbsrg", "rsu.sssep.rs",
  "rsu.sssep.rs2st", "rsu.sssep.rsfreecalc", "rsu.sssep.rspool", "ss2x2", "SS2x2", "ssize.stratify", "ssizeCT",
  "ssizeCT.default", "ssizeEpi", "ssizeEpi.default", "ssizeEpiCont", "ssizeEpiCont.default", "ssizeEpiInt",
  "ssizeEpiInt.default0", "ssizeEpiInt.default1", "ssizeEpiInt2", "ssizeWelchT", "toxbdry", "twostage.admissible",
  "twostage.inference", "ucControl", "uncondExact2x2", "uncondExact2x2Pvals", "uncondPower2x2", "unirootGrid",
];

/** Names that reach code, namespaces, compiled routines, other programs or files: not allowed at all. */
const FORBIDDEN_NAMES = [
  "deparse", "deparse1", "body", "formals", "args", "getAnywhere", "getS3method", "getFromNamespace",
  "asNamespace", "getNamespace", "loadNamespace", "requireNamespace", "attachNamespace", "getNamespaceExports",
  "getNamespaceInfo", "environment", "sys.function", "sys.call", "match.fun", "get", "get0", "mget", "exists",
  "ls", "objects", "apropos", "methods", "getMethod", "selectMethod", "showMethods", "eval", "evalq", "parse",
  "str2lang", "str2expression", "as.name", "as.symbol", "as.call", "substitute", "quote", "bquote", "trace",
  "untrace", "debug", "debugonce", "browser", "edit", "fix", "page", "View", "dump", "dput", "sink", "source",
  "sys.source", "system", "system2", "shell", "pipe", "file", "url", "gzcon", "readLines", "readRDS", "load",
  "scan", "download.file", "list.files", "file.show", "Sys.setenv", "setwd", "assignInNamespace",
  "fixInNamespace", "attach", "eapply", "as.list.environment", "lsf.str", "ls.str", "install.packages",
  "update.packages",
];

const COMPILED = /\.(Fortran|C|Call|External|External2|Internal|Primitive)\b/;

/** Splits a line into code (string contents blanked) and its string literals; drops the comment. */
function scan(line) {
  let code = "", quote = null, current = "";
  const strings = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === "\\") { current += line.slice(i, i + 2); i++; code += "  "; continue; }
      if (c === quote) { strings.push(current); current = ""; quote = null; code += c; continue; }
      current += c; code += " ";
      continue;
    }
    if (c === "#") break;
    if (c === '"' || c === "'" || c === "`") { quote = c; code += c; continue; }
    code += c;
  }
  if (quote) strings.push(current); // an unterminated string: R would refuse the script anyway
  return { code, strings };
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (name) => new RegExp(`(?<![A-Za-z0-9._$@])${escape(name)}(?![A-Za-z0-9._])`);

function check(file) {
  const problems = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const at = `${file}:${index + 1}`;
    const { code, strings } = scan(line);
    if (code.includes(":::")) problems.push(`${at}: ':::' reaches unexported objects`);
    for (const m of code.matchAll(/([A-Za-z][A-Za-z0-9.]*)\s*::(?!:)/g)) {
      if (!ALLOWED_PACKAGES.has(m[1])) problems.push(`${at}: package '${m[1]}' is not allowed`);
    }
    for (const m of line.matchAll(/\b(library|require)\s*\(\s*([^),\s]*)/g)) {
      const pkg = m[2].replace(/^["'`]|["'`]$/g, "");
      if (!ALLOWED_PACKAGES.has(pkg)) problems.push(`${at}: ${m[1]}(${m[2]}) is not allowed`);
    }
    // A package named like one of its functions (exact2x2): its name in library(), require() and pkg:: is not a
    // reference to the function
    const refCode = code
      .replace(/\b(library|require)\s*\(\s*[A-Za-z][A-Za-z0-9.]*\s*\)/g, (m) => m.replace(/\(.*\)/, "()"))
      .replace(/([A-Za-z][A-Za-z0-9.]*)\s*::(?!:)/g, (m, pkg) => (ALLOWED_PACKAGES.has(pkg) ? "" : m));
    if (COMPILED.test(code)) problems.push(`${at}: calling compiled code directly is not allowed`);
    for (const name of FORBIDDEN_NAMES) {
      if (word(name).test(code)) problems.push(`${at}: '${name}' is not allowed`);
    }
    for (const name of REFERENCE_FUNCTIONS) {
      // fit$cuminc-style element names are fine; a reference package's function that is not called is not
      const re = new RegExp(`(?<![A-Za-z0-9._$@])(?:[A-Za-z][A-Za-z0-9.]*::)?${escape(name)}(?![A-Za-z0-9._])(?!\\s*\\()`);
      if (re.test(refCode)) problems.push(`${at}: '${name}' must be called, not referred to (that would print its source)`);
    }
    for (const s of strings) {
      const t = s.trim();
      // An allowed package's name (library("epiR"), packageVersion("exact2x2")): reaching a function from a string
      // needs get, match.fun or eval, which are not allowed
      if (ALLOWED_PACKAGES.has(t)) continue;
      if (REFERENCE_FUNCTIONS.includes(t) || FORBIDDEN_NAMES.includes(t) || t.includes("::")) {
        problems.push(`${at}: the string "${t}" names a function; call functions directly`);
      }
    }
  });
  return problems;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/r-experiment-check.mjs <file.R> ...");
  process.exit(2);
}
const problems = files.flatMap(check);
for (const p of problems) console.log(p);
process.exit(problems.length === 0 ? 0 : 1);
