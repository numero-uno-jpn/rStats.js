// Lists the keys of the options objects that the public functions take, from their types, for the check of unknown
// keys (src/internal/checkOptions.ts):
//
//   node scripts/option-keys.mjs [--table table.json] [--excluded excluded.json]
//
// Without --table the table is printed on stdout. Reads the exports of src/entries/* with the compiler API of the
// typescript package in node_modules (TypeScript 7, typescript/unstable/sync); no build.
//
// The table has one entry per exported function that takes an options object somewhere: for each signature (each
// overload), the parameters whose type is an object with fixed keys, with the keys (the members of a union, an
// intersection and the extended interfaces together) and the nested objects with fixed keys under their path
// ("control", "control.inner"), and flags for what a person should look at (a union with a primitive, an array or a
// function at the same position, several object types in one union). `kinds` gives the kind of every parameter of a
// signature (options, primitive, excluded:reason), to see where overloads put an options object and data at the same
// position. `byPosition` merges the overloads. `implementation` is the signature of the body of an overloaded
// function, flagged where it takes an options object at a position no overload has.
//
// A parameter or nested property is not an options object, and goes to the excluded list with its reason, when its
// type is (each member of a union on its own):
//   indexSignature  an object with an index signature: Record<string, ...>, DataFrame, contrasts; the keys are the
//                   user's data
//   array           an array, a tuple or ArrayLike (Sample, Counts, number[][])
//   typedArray      Float64Array and the other typed arrays, ArrayBuffer, DataView
//   function        anything callable (callbacks, SplineFunction)
//   builtin         another object type of the standard library (Map, Set, Date, RegExp, Promise)
//   result          a result of the library given back to it (a fitted model, a test result): an interface or alias
//                   whose name ends in Result, Fit, Summary or Table or is QR (qr's decomposition), or a parameter
//                   named fit, object or model
//   anyOrUnknown    any, unknown or object: no keys to check
//   typeParameter   a type parameter whose constraint has no object with fixed keys
// Parameters whose types are only primitives (number, string, boolean, literals) are counted but not listed. Of the
// nested properties, only those of the kinds indexSignature, result, builtin and anyOrUnknown are listed (arrays,
// functions and primitives inside an options object are the ordinary case).

import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { API, SignatureKind, SymbolFlags, TypeFlags } from "typescript/unstable/sync";

const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\\/g, "/");

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const tablePath = argValue("--table");
const excludedPath = argValue("--excluded");

const TYPED_ARRAY = /^(Float(16|32|64)|Int(8|16|32)|Uint(8|16|32)|Uint8Clamped|BigInt64|BigUint64)Array$|^(ArrayBuffer|SharedArrayBuffer|DataView)$/;
const RESULT_NAME = /(Result|Fit|Summary|Table)$|^QR$/;
const RESULT_PARAM = new Set(["fit", "object", "model"]);
const MAX_DEPTH = 6;

const api = new API({ cwd: root });
const snapshot = api.updateSnapshot({ openProjects: [`${root}tsconfig.json`] });
const project = snapshot.getProjects()[0];
const checker = project.checker;

const relPath = (p) => {
  const path = (p ?? "").replace(/\\/g, "/");
  return path.toLowerCase().startsWith(root.toLowerCase()) ? path.slice(root.length) : path;
};
const isLibPath = (p) => /node_modules|\/lib\.[\w.]*d\.ts$|bundled:/.test(p ?? "");
const typeText = (t) => checker.typeToString(t);

/** The name of a type for the messages and the result rule: its alias, else its symbol. */
function typeName(t) {
  const alias = t.getAliasSymbol();
  if (alias) return alias.name;
  const sym = t.getSymbol();
  return sym && !sym.name.startsWith("__") ? sym.name : undefined;
}

/** The members of a type without undefined, null and void. */
function members(t) {
  const list = t.isUnionType() ? t.getTypes() : [t];
  return list.filter((m) => !(m.flags & (TypeFlags.Undefined | TypeFlags.Null | TypeFlags.Void)));
}

/** The ids of the object members of a type, to stop at a recursive type. */
const objectIds = (t) =>
  members(t)
    .filter((m) => m.flags & TypeFlags.Object || (m.isIntersectionType() && !m.getTypes().some((x) => x.flags & TypeFlags.Primitive)))
    .map((m) => m.id);

/**
 * The kind of one member of a union: { kind: "primitive" }, { kind: "object", type } (fixed keys) or
 * { kind: "excluded", reason, name }. `aliasName` is the alias of the enclosing union (Sample), for the messages.
 */
function classifyMember(m, paramName, aliasName) {
  const name = typeName(m) ?? aliasName;
  if (m.flags & (TypeFlags.Any | TypeFlags.Unknown)) return { kind: "excluded", reason: "anyOrUnknown", name };
  if (m.flags & TypeFlags.Never) return { kind: "primitive" };
  if (m.flags & TypeFlags.Primitive || m.flags & TypeFlags.TemplateLiteral) return { kind: "primitive" };
  // A branded primitive such as string & {} (a string with completions for the known values)
  if (m.isIntersectionType() && m.getTypes().some((x) => x.flags & TypeFlags.Primitive)) return { kind: "primitive" };
  if (m.isTypeParameter()) {
    const c = checker.getBaseConstraintOfType(m);
    if (!c || c.id === m.id) return { kind: "excluded", reason: "typeParameter", name };
    const inner = members(c).map((x) => classifyMember(x, paramName, typeName(c)));
    const objects = inner.filter((x) => x.kind === "object");
    if (objects.length === 1) return objects[0];
    if (inner.every((x) => x.kind === "primitive")) return { kind: "primitive" };
    return { kind: "excluded", reason: "typeParameter", name, inner };
  }
  if (!(m.flags & (TypeFlags.Object | TypeFlags.Intersection))) return { kind: "excluded", reason: "anyOrUnknown", name };
  if (checker.isArrayType(m) || checker.isTupleType(m)) return { kind: "excluded", reason: "array", name };
  const sym = m.getSymbol();
  if (sym?.name === "ArrayLike") return { kind: "excluded", reason: "array", name: sym.name };
  if (sym && TYPED_ARRAY.test(sym.name)) return { kind: "excluded", reason: "typedArray", name: sym.name };
  if (checker.getSignaturesOfType(m, SignatureKind.Call).length > 0) return { kind: "excluded", reason: "function", name };
  if (checker.getIndexInfosOfType(m).length > 0) {
    const fixed = checker.getPropertiesOfType(m).map((p) => p.name).filter((k) => !k.startsWith("__@"));
    return { kind: "excluded", reason: "indexSignature", name, ...(fixed.length ? { fixedKeys: fixed } : {}) };
  }
  if (sym && !sym.name.startsWith("__") && sym.declarations?.length && sym.declarations.every((d) => isLibPath(d.path))) {
    return { kind: "excluded", reason: "builtin", name: sym.name };
  }
  if ((name && RESULT_NAME.test(name)) || RESULT_PARAM.has(paramName)) return { kind: "excluded", reason: "result", name };
  const props = checker.getPropertiesOfType(m).filter((p) => !p.name.startsWith("__@"));
  if (props.length === 0) return { kind: "excluded", reason: "anyOrUnknown", name: name ?? typeText(m) };
  return { kind: "object", type: m, name };
}

/**
 * The analysis of a type at a parameter or a property: the keys (merged over the object members), the nested objects
 * and the flags; or, when no member is an object with fixed keys, the reasons of the excluded members.
 */
function analyse(t, paramName, depth, seen) {
  const alias = t.getAliasSymbol()?.name;
  const parts = members(t).map((m) => classifyMember(m, paramName, alias));
  const objects = parts.filter((p) => p.kind === "object");
  const excluded = parts.filter((p) => p.kind === "excluded");
  const primitives = parts.filter((p) => p.kind === "primitive");
  if (objects.length === 0) {
    if (excluded.length === 0) return { kind: "primitive" };
    return { kind: "excluded", reasons: excluded.map(({ reason, name, fixedKeys }) => ({ reason, ...(name ? { name } : {}), ...(fixedKeys ? { fixedKeys } : {}) })) };
  }
  const keys = [];
  const nested = [];
  const nestedExcluded = [];
  const flags = [];
  if (objects.length > 1) flags.push(`union of ${objects.length} object types (${objects.map((o) => o.name ?? "anonymous").join(", ")})`);
  if (primitives.length) flags.push(`union with a primitive (${typeText(t)})`);
  for (const e of excluded) flags.push(`union with ${e.reason}${e.name ? ` (${e.name})` : ""}`);
  const propTypes = new Map();
  for (const o of objects) {
    for (const p of checker.getPropertiesOfType(o.type)) {
      if (p.name.startsWith("__@")) continue;
      if (!keys.includes(p.name)) keys.push(p.name);
      const pt = checker.getTypeOfSymbol(p);
      if (pt) (propTypes.get(p.name) ?? propTypes.set(p.name, []).get(p.name)).push(pt);
    }
  }
  if (depth < MAX_DEPTH) {
    for (const [key, types] of propTypes) {
      for (const pt of types) {
        const ids = objectIds(pt);
        if (ids.some((id) => seen.has(id))) {
          flags.push(`recursive type at ${key}`);
          continue;
        }
        const inner = analyse(pt, key, depth + 1, new Set([...seen, ...ids]));
        if (inner.kind === "options") {
          const prev = nested.find((n) => n.path === key);
          if (prev) {
            for (const k of inner.keys) if (!prev.keys.includes(k)) prev.keys.push(k);
          } else {
            nested.push({ path: key, keys: inner.keys, ...(inner.flags.length ? { flags: inner.flags } : {}), type: typeText(pt) });
          }
          for (const n of inner.nested) nested.push({ ...n, path: `${key}.${n.path}` });
          for (const n of inner.nestedExcluded) nestedExcluded.push({ ...n, path: `${key}.${n.path}` });
        } else if (inner.kind === "excluded") {
          const listed = inner.reasons.filter((r) => ["indexSignature", "result", "builtin", "anyOrUnknown"].includes(r.reason));
          if (listed.length) nestedExcluded.push({ path: key, reasons: listed, type: typeText(pt) });
        }
      }
    }
  }
  return { kind: "options", keys, nested, nestedExcluded, flags };
}

/** The kind of a parameter for the table: options, primitive, or excluded with the reasons. */
const kindOf = (a) => (a.kind === "excluded" ? `excluded:${[...new Set(a.reasons.map((r) => r.reason))].join("|")}` : a.kind);

function optionEntry(p, pt, index, rest, a) {
  const o = { index, param: p.name, ...(rest ? { rest: true } : {}), type: typeText(pt), keys: a.keys };
  if (a.nested.length) o.nested = a.nested;
  if (a.flags.length) o.flags = a.flags;
  return o;
}

/** The signature of the declaration with a body (the implementation of the overloads), if any. */
function implementationSignature(target) {
  for (const d of target.declarations ?? []) {
    const node = d.resolve(project);
    if (node?.body) return checker.getSignatureFromDeclaration(node);
  }
  return undefined;
}

const table = [];
const excludedList = [];
const counts = { functions: 0, signatures: 0, parameters: 0, primitiveParameters: 0, optionParameters: 0, excludedParameters: 0 };
const skippedExports = [];
const byTarget = new Map();

const entries = readdirSync(`${root}src/entries`).filter((f) => f.endsWith(".ts")).sort();
for (const entryFile of entries) {
  const entry = entryFile.replace(/\.ts$/, "");
  const sf = project.program.getSourceFile(`${root}src/entries/${entryFile}`);
  const moduleSymbol = checker.getSymbolAtLocation(sf);
  for (const exp of checker.getExportsOfModule(moduleSymbol)) {
    const target = exp.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
    const type = checker.getTypeOfSymbol(target);
    const sigs = type ? checker.getSignaturesOfType(type, SignatureKind.Call) : [];
    if (sigs.length === 0) {
      if (target.valueDeclaration) skippedExports.push({ name: exp.name, entry, reason: "not callable" });
      continue;
    }
    const prev = byTarget.get(target.id);
    if (prev) {
      if (!prev.entries.includes(entry)) prev.entries.push(entry);
      continue;
    }
    const fn = { name: exp.name, entries: [entry], file: relPath(target.valueDeclaration?.path ?? target.declarations?.[0]?.path), overloads: sigs.length, signatures: [], byPosition: {} };
    byTarget.set(target.id, fn);
    counts.functions++;
    sigs.forEach((sig, overload) => {
      counts.signatures++;
      const params = sig.getParameters();
      const sigOut = { overload, params: params.map((p) => p.name), kinds: [], options: [] };
      params.forEach((p, index) => {
        counts.parameters++;
        const pt = checker.getTypeOfSymbol(p);
        const rest = sig.hasRestParameter && index === params.length - 1;
        const a = analyse(pt, p.name, 0, new Set(objectIds(pt)));
        sigOut.kinds.push(kindOf(a));
        if (a.kind === "primitive") {
          counts.primitiveParameters++;
        } else if (a.kind === "excluded") {
          counts.excludedParameters++;
          excludedList.push({ function: exp.name, entries: fn.entries, overload, index, param: p.name, ...(rest ? { rest: true } : {}), type: typeText(pt), reasons: a.reasons });
        } else {
          counts.optionParameters++;
          sigOut.options.push(optionEntry(p, pt, index, rest, a));
          const pos = (fn.byPosition[index] ??= { keys: [], nested: {} });
          for (const k of a.keys) if (!pos.keys.includes(k)) pos.keys.push(k);
          for (const n of a.nested) {
            const nk = (pos.nested[n.path] ??= []);
            for (const k of n.keys) if (!nk.includes(k)) nk.push(k);
          }
          for (const n of a.nestedExcluded) {
            excludedList.push({ function: exp.name, entries: fn.entries, overload, index, param: p.name, path: n.path, type: n.type, reasons: n.reasons });
          }
        }
      });
      fn.signatures.push(sigOut);
    });
    // The implementation of an overloaded function: the positions where it takes an options object that no overload
    // has there (an options object in place of an optional argument, read by the body before the check)
    const impl = sigs.length > 1 ? implementationSignature(target) : undefined;
    if (impl) {
      const params = impl.getParameters();
      const implOut = { params: params.map((p) => p.name), kinds: [], options: [] };
      params.forEach((p, index) => {
        const pt = checker.getTypeOfSymbol(p);
        const a = analyse(pt, p.name, 0, new Set(objectIds(pt)));
        implOut.kinds.push(kindOf(a));
        if (a.kind === "options") {
          const o = optionEntry(p, pt, index, impl.hasRestParameter && index === params.length - 1, a);
          if (!fn.byPosition[index]) o.flags = [...(o.flags ?? []), "options at a position no overload has"];
          implOut.options.push(o);
        }
      });
      fn.implementation = implOut;
    }
    table.push(fn);
  }
}

api.close();

const withOptions = table.filter((f) => Object.keys(f.byPosition).length > 0);
for (const f of withOptions) for (const pos of Object.values(f.byPosition)) if (Object.keys(pos.nested).length === 0) delete pos.nested;
const out = {
  generatedBy: "scripts/option-keys.mjs",
  counts: { ...counts, functionsWithOptions: withOptions.length },
  functions: withOptions,
  functionsWithoutOptions: table.filter((f) => Object.keys(f.byPosition).length === 0).map((f) => f.name),
  skippedExports,
};
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
if (tablePath) writeFileSync(tablePath, json(out));
else process.stdout.write(json(out));
if (excludedPath) writeFileSync(excludedPath, json(excludedList));
process.stderr.write(`${withOptions.length} functions with options of ${counts.functions}; ${counts.optionParameters} option parameters, ${counts.excludedParameters} excluded\n`);
