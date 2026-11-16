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

const ALLOWED_PACKAGES = new Set(["cmprsk", "survival", "jsonlite", "stats", "utils", "base"]);

/** Functions of the reference packages: they may only be called. */
const REFERENCE_FUNCTIONS = [
  "cuminc", "timepoints", "crr", "predict.crr", "summary.crr", "print.crr", "print.summary.crr", "print.cuminc",
  "plot.cuminc", "plot.predict.crr", "crstm", "cinc", "crrfsv", "crrf", "crrvv", "crrsr", "crrfit",
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
    if (COMPILED.test(code)) problems.push(`${at}: calling compiled code directly is not allowed`);
    for (const name of FORBIDDEN_NAMES) {
      if (word(name).test(code)) problems.push(`${at}: '${name}' is not allowed`);
    }
    for (const name of REFERENCE_FUNCTIONS) {
      // fit$cuminc-style element names are fine; a reference package's function that is not called is not
      const re = new RegExp(`(?<![A-Za-z0-9._$@])(?:[A-Za-z][A-Za-z0-9.]*::)?${escape(name)}(?![A-Za-z0-9._])(?!\\s*\\()`);
      if (re.test(code)) problems.push(`${at}: '${name}' must be called, not referred to (that would print its source)`);
    }
    for (const s of strings) {
      const t = s.trim();
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
