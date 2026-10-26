// End-to-end test of the demo (demo/) in headless Chromium (Playwright).
//
// The repository is served on a fake origin (http://rstats.test/) through page.route, and the jsDelivr URL of
// the library (dist/rstats.js, dist/mixed.js and the chunks the latter imports) is intercepted and answered with the
// local dist/, so the real CDN code path is tested.
// Every form operation is driven through the UI: every distribution with d/p/q, every r* function, every test
// and every linear algebra operation. The page must not throw, and no error message may be shown (except where
// an error is the expected outcome). The "Compare with R" tab must report all examples as passing.
//
//   npm run test:browser          (builds first, then runs run.mjs and this file)
//   node test/browser/demo.mjs    (after npm run build)
//   DEMO_SCREENSHOTS=dir node test/browser/demo.mjs   also saves screenshots into dir
//
// Install Chromium beforehand with `npx playwright install chromium`.

import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const origin = "http://rstats.test";
const CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@numero-uno-jpn\/rstats@[^/]+\/dist\/(.+\.js)$/;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".R": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
};
const shotsDir = process.env.DEMO_SCREENSHOTS;
const examplesPath = join(root, "demo", "examples.json");
const exampleCount = existsSync(examplesPath) ? JSON.parse(readFileSync(examplesPath, "utf8")).examples.length : 0;

let failures = 0;
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

/** Serves files of the repository for the fake origin; directories serve index.html. */
function serveFile(route) {
  const url = new URL(route.request().url());
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = normalize(join(root, rel));
  if (!file.startsWith(root.endsWith(sep) ? root : root + sep) || !existsSync(file) || statSync(file).isDirectory()) {
    return route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
  }
  return route.fulfill({ status: 200, contentType: MIME[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
}

async function openDemo(browser, { cdn = "ok", query = "", contextOptions = {} } = {}) {
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && cdn === "ok") errors.push(`console: ${m.text()}`);
  });
  await page.route(`${origin}/**`, serveFile);
  await page.route(CDN, (route) =>
    cdn === "ok"
      ? route.fulfill({
          status: 200,
          contentType: "text/javascript; charset=utf-8",
          headers: { "access-control-allow-origin": "*" },
          body: readFileSync(join(root, "dist", ...CDN.exec(route.request().url())[1].split("/"))),
        })
      : route.fulfill({ status: 404, contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: "Couldn't find the requested file" }),
  );
  await page.goto(`${origin}/demo/${query}`);
  return { context, page, errors };
}

const settle = (page) => page.waitForTimeout(220);

/** Messages of visible error boxes inside a container. */
async function shownErrors(page, scope = "body") {
  return page.$$eval(`${scope} .error-box`, (els) => els.filter((e) => !e.hidden && e.offsetParent !== null).map((e) => e.textContent));
}

async function noErrors(page, name, scope) {
  const errs = await shownErrors(page, scope);
  check(`${name}: no error shown`, errs.length === 0, errs.join(" | "));
}

const tid = (id) => `[data-testid="${id}"]`;

async function setCheck(page, id, on) {
  const box = page.locator(`${tid(id)}`);
  if ((await box.isChecked()) !== on) await box.click();
}

// ---------- tabs ----------

async function testDistributions(page) {
  await page.click(tid("tab-distributions"));
  const dists = await page.$$eval(`${tid("dist-select")} option`, (os) => os.map((o) => o.value));
  check("26 distributions", dists.length === 26, String(dists.length));
  for (const d of dists) {
    await page.selectOption(tid("dist-select"), d);
    const kinds = await page.$$eval(`${tid("dist-kind")} option`, (os) => os.map((o) => o.value));
    check(`${d}: kinds`, kinds.length === (d === "tukey" ? 2 : 3), kinds.join());
    for (const k of kinds) {
      await page.selectOption(tid("dist-kind"), k);
      await settle(page);
      const name = `${k}${d}`;
      await noErrors(page, name, tid("panel-distributions"));
      const cells = await page.$$eval(`${tid("dist-table")} tbody td`, (tds) => tds.map((td) => td.textContent));
      check(`${name}: results`, cells.length >= 1 && cells.some((c) => Number.isFinite(Number(c))), cells.join());
      const plots = await page.$$eval(`${tid("dist-plots")} svg`, (s) => s.map((x) => x.querySelectorAll("path.curve, rect.bar").length));
      check(`${name}: plots`, plots.length >= 1 && plots.every((n) => n > 0), JSON.stringify(plots));
      const r = await page.textContent(`${tid("dist-code-r")} code`);
      const js = await page.textContent(`${tid("dist-code-js")} code`);
      // R lacks the arcsine distribution: its R code goes through the beta functions
      check(`${name}: code`, r.includes(d === "arcsine" ? "beta(" : `${name}(`) && js.includes(`${name}(`), `${r} / ${js}`);
      if (k === "d") {
        const summary = await page.$$eval(`${tid("dist-summary-table")} tbody tr`, (rows) => rows.length);
        check(`${d}: distSummary`, summary === (["signrank", "wilcox", "tukey"].includes(d) ? 0 : 7), String(summary));
      }
      // flags
      if (k === "d") {
        await setCheck(page, "dist-log", true);
        await settle(page);
        check(`${name} log: R code`, (await page.textContent(`${tid("dist-code-r")} code`)).includes("log = TRUE"));
        await noErrors(page, `${name} log`, tid("panel-distributions"));
        await setCheck(page, "dist-log", false);
      } else {
        await setCheck(page, "dist-lowerTail", false);
        await setCheck(page, "dist-logP", true);
        if (k === "q") await page.fill(tid("dist-values"), "-3, -0.5, -0.01");
        await settle(page);
        const rc = await page.textContent(`${tid("dist-code-r")} code`);
        check(`${name} upper/log: R code`, rc.includes("lower.tail = FALSE") && rc.includes("log.p = TRUE"), rc);
        await noErrors(page, `${name} upper/log`, tid("panel-distributions"));
        const c2 = await page.$$eval(`${tid("dist-table")} tbody td`, (tds) => tds.length);
        check(`${name} upper/log: results`, c2 >= 1);
        await setCheck(page, "dist-lowerTail", true);
        await setCheck(page, "dist-logP", false);
        if (k === "q") await page.fill(tid("dist-values"), "0.025, 0.5, 0.975");
      }
    }
  }
  // a non-central variant
  await page.selectOption(tid("dist-select"), "chisq");
  await page.selectOption(tid("dist-kind"), "p");
  await page.fill(tid("dist-param-ncp"), "2.5");
  await settle(page);
  check("pchisq ncp: R code", (await page.textContent(`${tid("dist-code-r")} code`)).includes("ncp = 2.5"));
  await noErrors(page, "pchisq ncp", tid("panel-distributions"));
  // invalid input is reported next to the form
  await page.fill(tid("dist-values"), "1, abc");
  await settle(page);
  check("invalid input shows an error", (await shownErrors(page, tid("panel-distributions"))).length === 1);
  await page.fill(tid("dist-values"), "1, 2");
  await settle(page);
}

async function testSpecial(page) {
  await page.click(tid("tab-special"));
  const fns = await page.$$eval(`${tid("special-fn")} option`, (os) => os.map((o) => o.value));
  check("21 special functions", fns.length === 21, String(fns.length));
  for (const f of fns) {
    await page.selectOption(tid("special-fn"), f);
    await settle(page);
    await noErrors(page, f, tid("panel-special"));
    const cells = await page.$$eval(`${tid("special-table")} tbody td`, (tds) => tds.map((td) => td.textContent));
    check(`${f}: results`, cells.length >= 3 && cells.some((c) => Number.isFinite(Number(c))), cells.join());
    check(`${f}: plot`, (await page.$$(`${tid("special-plot")} path.curve`)).length > 0);
  }
}

async function testRandom(page) {
  await page.click(tid("tab-random"));
  await page.click(tid("random-nav-rfun"));
  const fns = await page.$$eval(`${tid("random-fn")} option`, (os) => os.map((o) => o.value));
  check("25 r* distributions", fns.length === 25, String(fns.length));
  for (const d of fns) {
    await page.selectOption(tid("random-fn"), d);
    await settle(page);
    await noErrors(page, `r${d}`, tid("panel-random"));
    const n = await page.$$eval(`${tid("random-values")} .vec-item`, (x) => x.length);
    check(`r${d}: 500 values`, n === 500, String(n));
    check(`r${d}: histogram`, (await page.$$(`${tid("random-hist")} rect.bar`)).length > 0);
    check(`r${d}: code`, (await page.textContent(`${tid("random-code-r")} code`)).startsWith("set.seed(42)"));
  }
  // the same seed gives the same numbers
  await page.selectOption(tid("random-fn"), "norm");
  await page.fill(tid("random-n"), "3");
  await settle(page);
  const first = await page.$$eval(`${tid("random-values")} .num`, (x) => x.map((e) => e.textContent));
  check("setSeed(42); rnorm(3) matches R", first.join() === "1.3709584471466685,-0.5646981713960887,0.3631284113373392", first.join());

  await page.click(tid("random-nav-sample"));
  await settle(page);
  await noErrors(page, "sample", tid("panel-random"));
  check("sample: permutation", (await page.$$eval(`${tid("sample-output")} .vec-item`, (x) => x.length)) === 5);
  await setCheck(page, "sample-replace", true);
  await page.fill(tid("sample-size"), "8");
  await page.fill(tid("sample-prob"), "1, 2, 3, 4, 5");
  await settle(page);
  await noErrors(page, "sample replace prob", tid("panel-random"));
  check("sample: size 8 with replacement", (await page.$$eval(`${tid("sample-output")} .vec-item`, (x) => x.length)) === 8);
  await page.selectOption(tid("sample-mode"), "sampleInt");
  await settle(page);
  await page.fill(tid("sample-prob"), "");
  await settle(page);
  await noErrors(page, "sampleInt", tid("panel-random"));
  const ints = await page.$$eval(`${tid("sample-output")} .num`, (x) => x.map((e) => Number(e.textContent)));
  check("sampleInt: 0-based integers", ints.length === 8 && ints.every((v) => Number.isInteger(v) && v >= 0 && v < 10), ints.join());

  await page.click(tid("random-nav-multinom"));
  await settle(page);
  await noErrors(page, "rmultinom", tid("panel-random"));
  check("rmultinom: 5 rows", (await page.$$(`${tid("multinom-output")} tbody tr`)).length === 5);

  await page.click(tid("random-nav-state"));
  await settle(page);
  await noErrors(page, "state", tid("panel-random"));
  check("getRandomSeed/setRandomSeed: identical", (await page.textContent(tid("state-identical"))) === "true");
  await page.click(tid("random-nav-rfun"));
}

async function htestOk(page, id, name, expect) {
  await settle(page);
  await noErrors(page, name, tid("panel-tests"));
  const text = (await page.textContent(tid(`${id}-print`))) ?? "";
  check(`${name}: printed`, expect.every((s) => text.includes(s)), text);
  check(`${name}: JSON`, ((await page.textContent(tid(`${id}-json`))) ?? "").includes('"method"'));
}

async function testTests(page) {
  await page.click(tid("tab-tests"));
  // tTest
  await page.click(tid("tests-nav-ttest"));
  for (const type of ["two", "one", "paired"]) {
    await page.selectOption(tid("ttest-type"), type);
    await htestOk(page, "ttest", `tTest ${type}`, ["t = ", "p-value", "confidence interval"]);
  }
  await page.selectOption(tid("ttest-type"), "two");
  await setCheck(page, "ttest-varEqual", true);
  await page.selectOption(tid("ttest-alternative"), "less");
  await page.fill(tid("ttest-mu"), "0.5");
  await page.fill(tid("ttest-conf"), "0.9");
  await htestOk(page, "ttest", "tTest varEqual", ["Two Sample t-test", "less than 0.5", "90 percent"]);
  // chisqTest
  await page.click(tid("tests-nav-chisq"));
  await htestOk(page, "chisq", "chisqTest matrix", ["X-squared", "df = 2"]);
  await page.fill(tid("chisq-matrix"), "12 5\n7 9");
  await htestOk(page, "chisq", "chisqTest 2x2", ["Yates"]);
  await setCheck(page, "chisq-correct", false);
  await htestOk(page, "chisq", "chisqTest 2x2 uncorrected", ["X-squared"]);
  await page.selectOption(tid("chisq-mode"), "vector");
  await htestOk(page, "chisq", "chisqTest p", ["given probabilities"]);
  await setCheck(page, "chisq-rescale", true);
  await page.fill(tid("chisq-p"), "4, 2, 2, 1.9, 0.1");
  await htestOk(page, "chisq", "chisqTest rescale.p", ["X-squared"]);
  await page.fill(tid("chisq-p"), "");
  await htestOk(page, "chisq", "chisqTest uniform", ["X-squared"]);
  // fisherTest
  await page.click(tid("tests-nav-fisher"));
  await htestOk(page, "fisher", "fisherTest 2x2", ["odds ratio", "confidence interval"]);
  for (const alt of ["less", "greater"]) {
    await page.selectOption(tid("fisher-alternative"), alt);
    await htestOk(page, "fisher", `fisherTest ${alt}`, [`${alt} than 1`]);
  }
  await page.fill(tid("fisher-conf"), "0.99");
  await htestOk(page, "fisher", "fisherTest conf 0.99", ["99 percent"]);
  await page.click(tid("fisher-preset-rxc"));
  await htestOk(page, "fisher", "fisherTest r x c", ["p-value", "alternative hypothesis: greater"]);
  // wilcoxTest
  await page.click(tid("tests-nav-wilcox"));
  for (const exact of ["auto", "true", "false"]) {
    await page.selectOption(tid("wilcox-exact"), exact);
    await htestOk(page, "wilcox", `wilcoxTest paired exact=${exact}`, ["V = ", "p-value"]);
  }
  await setCheck(page, "wilcox-correct", false);
  await htestOk(page, "wilcox", "wilcoxTest no correction", ["V = "]);
  await page.selectOption(tid("wilcox-type"), "two");
  await htestOk(page, "wilcox", "wilcoxTest two-sample", ["W = ", "difference in location"]);
  await page.selectOption(tid("wilcox-type"), "one");
  await page.fill(tid("wilcox-mu"), "1");
  await setCheck(page, "wilcox-confInt", false);
  await htestOk(page, "wilcox", "wilcoxTest one-sample", ["V = ", "location is not equal to 1"]);
  // cor / corTest
  await page.click(tid("tests-nav-cor"));
  for (const m of ["pearson", "kendall", "spearman"]) {
    await page.selectOption(tid("cor-method"), m);
    await htestOk(page, "cor", `corTest ${m}`, ["p-value", "sample estimates"]);
    check(`cor ${m}: value`, Number.isFinite(Number((await page.textContent(`${tid("cor-value")} strong`)) ?? "x")));
  }
  await page.selectOption(tid("cor-exact"), "false");
  await setCheck(page, "cor-continuity", true);
  await page.selectOption(tid("cor-alternative"), "greater");
  await htestOk(page, "cor", "corTest spearman approx", ["greater than 0"]);
  // pAdjust
  await page.click(tid("tests-nav-padjust"));
  await settle(page);
  await noErrors(page, "pAdjust", tid("panel-tests"));
  check("pAdjust: table", (await page.$$(`${tid("padjust-table")} tbody tr`)).length === 7);
  check("pAdjust: 8 methods", (await page.$$(`${tid("padjust-table")} thead th`)).length === 9);
  await page.fill(tid("padjust-n"), "10");
  await settle(page);
  await noErrors(page, "pAdjust n", tid("panel-tests"));
  // the other tests and models, chosen from a list
  await page.click(tid("tests-nav-more"));
  const more = await page.$$eval(`${tid("more-test")} option`, (os) => os.map((o) => o.value));
  check("23 other tests and models", more.length === 23, String(more.length));
  for (const m of more) {
    await page.selectOption(tid("more-test"), m);
    await settle(page);
    await noErrors(page, m, tid("panel-tests"));
    const printed = (await page.textContent(tid("more-print"))) ?? "";
    const tables = await page.$$(`${tid("panel-tests")} [data-testid^="more-"] tbody tr`);
    check(`${m}: result`, printed.includes("data:") || tables.length > 0, printed.slice(0, 60));
    check(`${m}: code`, ((await page.textContent(`${tid("more-code-js")} code`)) ?? "").includes(`${m}(`));
  }
}

async function testDescriptive(page) {
  await page.click(tid("tab-descriptive"));
  await settle(page);
  await noErrors(page, "descriptive", tid("panel-descriptive"));
  const rows = await page.$$eval(`${tid("desc-table")} tbody tr`, (r) => r.map((x) => x.textContent));
  check("descriptive: summaries", rows.length === 26 && rows.every((r) => /\d/.test(r)), String(rows.length));
  check("descriptive: 9 quantile types", (await page.$$(`${tid("desc-quantiles")} tbody tr`)).length === 9);
  check("descriptive: histogram", (await page.$$(`${tid("desc-hist")} rect.bar`)).length > 0);
  check("descriptive: ecdf", (await page.$$(`${tid("desc-ecdf")} path.curve`)).length > 0);
  await page.fill(tid("desc-y"), "");
  await settle(page);
  await noErrors(page, "descriptive without y", tid("panel-descriptive"));
  check("descriptive without y: no pair rows", (await page.$$(`${tid("desc-table")} tbody tr`)).length === 21);
}

async function testNumerics(page) {
  await page.click(tid("tab-numerics"));
  const presets = await page.$$eval(`${tid("num-preset")} option`, (os) => os.map((o) => o.value));
  for (const v of presets) {
    await page.selectOption(tid("num-preset"), v);
    await settle(page);
    await noErrors(page, `numerics preset ${v}`, tid("panel-numerics"));
    check(`numerics preset ${v}: 6 results`, (await page.$$(`${tid("num-table")} tbody tr`)).length === 6);
    check(`numerics preset ${v}: plot`, (await page.$$(`${tid("num-plot")} path.curve`)).length > 0);
  }
  await page.click(tid("num-nav-interp"));
  await settle(page);
  await noErrors(page, "interpolation", tid("panel-numerics"));
  check("interpolation: 6 methods", (await page.$$(`${tid("interp-table")} tbody tr`)).length === 6);
  await page.click(tid("num-nav-functions"));
}

const LINALG_SQUARE_OPS = [
  "t", "diag", "matMul", "add", "subtract", "multiply", "divide", "kronecker", "cbind", "rbind",
  "crossprod", "tcrossprod", "norm", "backsolve", "forwardsolve", "chol", "chol2inv", "qr", "qrQ", "qrR", "qrX", "qrCoef", "qrQy", "qrQty",
  "qrResid", "qrFitted", "qrSolve", "rank", "pivot", "solve", "det", "determinant", "rcond", "kappa", "svd", "eigen", "ginv", "lu", "prcomp",
];
const LINALG_TALL_OPS = ["crossprod", "norm", "qr", "qrQ", "qrR", "qrX", "qrCoef", "qrQy", "qrQty", "qrResid", "qrFitted", "qrSolve", "rank", "pivot", "kappa", "svd", "ginv"];

async function linalgOk(page, name) {
  await settle(page);
  await noErrors(page, name, tid("panel-linalg"));
  const html = await page.innerHTML(tid("linalg-output"));
  check(`${name}: output`, html.length > 20, html.slice(0, 80));
  const js = (await page.textContent(`${tid("linalg-code-js")} code`)) ?? "";
  check(`${name}: code`, js.includes("const A = ["), js);
}

async function testLinalg(page) {
  await page.click(tid("tab-linalg"));
  const ops = await page.$$eval(`${tid("linalg-op")} option`, (os) => os.map((o) => o.value));
  check("linalg: every operation listed", LINALG_SQUARE_OPS.every((o) => ops.includes(o)) && ops.length === LINALG_SQUARE_OPS.length, ops.join());
  await page.click(tid("linalg-preset-spd"));
  for (const op of LINALG_SQUARE_OPS) {
    await page.selectOption(tid("linalg-op"), op);
    await linalgOk(page, `${op} (SPD)`);
  }
  // options
  for (const type of ["O", "I", "F", "M", "2"]) {
    await page.selectOption(tid("linalg-op"), "norm");
    await page.selectOption(tid("linalg-normType"), type);
    await linalgOk(page, `norm type ${type}`);
  }
  const toggles = [
    ["chol", "linalg-pivot"],
    ["qrQ", "linalg-complete"],
    ["qrR", "linalg-complete"],
    ["qrX", "linalg-complete"],
    ["determinant", "linalg-logarithm"],
    ["kappa", "linalg-exact"],
    ["eigen", "linalg-onlyValues"],
    ["backsolve", "linalg-transpose"],
    ["forwardsolve", "linalg-transpose"],
  ];
  for (const [op, box] of toggles) {
    await page.selectOption(tid("linalg-op"), op);
    const before = await page.isChecked(tid(box));
    await setCheck(page, box, !before);
    await linalgOk(page, `${op} ${box}=${!before}`);
    await setCheck(page, box, before);
  }
  await page.selectOption(tid("linalg-op"), "rcond");
  await page.selectOption(tid("linalg-rcondNorm"), "I");
  await linalgOk(page, "rcond norm I");
  await page.selectOption(tid("linalg-op"), "eigen");
  for (const s of ["true", "false", "auto"]) {
    await page.selectOption(tid("linalg-symmetric"), s);
    await linalgOk(page, `eigen symmetric=${s}`);
  }
  // general matrix with complex eigenvalues
  await page.click(tid("linalg-preset-nonsym"));
  await linalgOk(page, "eigen non-symmetric");
  const text = await page.textContent(tid("linalg-output"));
  check("eigen: complex values shown as a ± bi", /\d i|\di/.test(text) && /[+−] 2i/.test(text), text);
  // tall matrix: least squares
  await page.click(tid("linalg-preset-tall"));
  for (const op of LINALG_TALL_OPS) {
    await page.selectOption(tid("linalg-op"), op);
    await linalgOk(page, `${op} (tall)`);
  }
  // triangular solves
  await page.click(tid("linalg-preset-upper"));
  for (const op of ["backsolve", "forwardsolve", "det", "rcond"]) {
    await page.selectOption(tid("linalg-op"), op);
    await linalgOk(page, `${op} (upper)`);
  }
  // a singular matrix: the library's error is shown next to the form
  await page.click(tid("linalg-preset-singular"));
  await page.selectOption(tid("linalg-op"), "solve");
  await settle(page);
  const errs = await shownErrors(page, tid("panel-linalg"));
  check("solve(singular): error shown", errs.length === 1 && errs[0].length > 10, errs.join());
  await page.click(tid("linalg-preset-spd"));
  await settle(page);
}

async function testCompare(page) {
  await page.click(tid("tab-compare"));
  await settle(page);
  if (!exampleCount) {
    check("compare: notice without examples.json", (await page.$$(tid("compare-missing"))).length === 1);
    return;
  }
  const d = await page.$eval(tid("compare-summary"), (e) => ({ ...e.dataset }));
  check(`compare: all ${exampleCount} examples pass`, Number(d.total) === exampleCount && Number(d.pass) === exampleCount && Number(d.fail) === 0, JSON.stringify(d));
  if (Number(d.fail) > 0) {
    const failed = await page.$$eval(`${tid("compare-table")} tr.status-fail`, (rows) => rows.map((r) => r.dataset.id));
    console.log(`  failing examples: ${failed.join(", ")}`);
  }
  const rows = await page.$$(`${tid("compare-table")} tbody tr`);
  check("compare: table rows", rows.length === exampleCount, String(rows.length));
  await page.selectOption(tid("compare-filter"), "linalg");
  const lin = await page.$$(`${tid("compare-table")} tbody tr`);
  check("compare: filter by tab", lin.length > 0 && lin.length < exampleCount);
  await page.selectOption(tid("compare-filter"), "all");
  // example cards on the other tabs
  const cards = await page.$$eval('[data-testid="example-card"]', (cs) => cs.length);
  check("example cards on the other tabs", cards === exampleCount, String(cards));
}

async function testLanguage(page) {
  const lang0 = await page.getAttribute("html", "lang");
  check("default language from navigator (en-US)", lang0 === "en");
  await page.click(tid("lang-toggle"));
  await settle(page);
  check("Japanese: html lang", (await page.getAttribute("html", "lang")) === "ja");
  check("Japanese: tab label", (await page.textContent(tid("tab-distributions"))) === "確率分布");
  check("Japanese: page text", /[ぁ-んァ-ヶ一-龠]/.test(await page.textContent("main")));
  await noErrors(page, "after switching to Japanese");
  await page.click(tid("lang-toggle"));
  await settle(page);
  check("English again: tab label", (await page.textContent(tid("tab-distributions"))) === "Distributions");
}

async function testNoHorizontalScroll(browser) {
  const { context, page, errors } = await openDemo(browser, { contextOptions: { viewport: { width: 360, height: 780 } } });
  await page.waitForSelector(`${tid("status")}[data-state="ready"]`);
  for (const tab of ["distributions", "descriptive", "special", "random", "tests", "linalg", "numerics", "compare"]) {
    await page.click(tid(`tab-${tab}`));
    await settle(page);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`360px: no horizontal scroll on ${tab}`, w <= 360, String(w));
  }
  check("360px: no page errors", errors.length === 0, errors.join(" | "));
  await context.close();
}

async function screenshots(browser) {
  mkdirSync(shotsDir, { recursive: true });
  const configs = [
    { name: "en-light", contextOptions: { colorScheme: "light", viewport: { width: 1280, height: 900 } } },
    { name: "ja-dark", contextOptions: { colorScheme: "dark", locale: "ja-JP", viewport: { width: 1280, height: 900 } } },
    { name: "mobile-390", contextOptions: { colorScheme: "light", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } },
  ];
  for (const { name, contextOptions } of configs) {
    const { context, page } = await openDemo(browser, { contextOptions });
    await page.waitForSelector(`${tid("status")}[data-state="ready"]`);
    for (const tab of ["distributions", "descriptive", "special", "random", "tests", "linalg", "numerics", "compare"]) {
      await page.click(tid(`tab-${tab}`));
      await settle(page);
      await page.screenshot({ path: join(shotsDir, `${name}-${tab}.png`), fullPage: true });
      await page.screenshot({ path: join(shotsDir, `${name}-${tab}-top.png`) });
    }
    await context.close();
  }
  console.log(`screenshots saved in ${shotsDir}`);
}

const browser = await chromium.launch();
try {
  // Main run: CDN URL intercepted and served from dist/rstats.js
  {
    const { context, page, errors } = await openDemo(browser);
    await page.waitForSelector(`${tid("status")}[data-state="ready"]`, { timeout: 20000 });
    check("status shows the CDN source", (await page.getAttribute(tid("status"), "data-source")) === "cdn");
    // the demo loads dist/rstats.js and the mixed-models area dist/mixed.js
    const exportCount = (
      await Promise.all(["rstats.js", "mixed.js"].map((f) => import(new URL(`../../dist/${f}`, import.meta.url).href)))
    ).reduce((n, m) => n + Object.keys(m).length, 0);
    check(`status mentions ${exportCount} functions`, (await page.textContent(tid("status"))).includes(String(exportCount)));
    for (const [name, fn] of [
      ["distributions", testDistributions],
      ["special functions", testSpecial],
      ["random numbers", testRandom],
      ["descriptive statistics", testDescriptive],
      ["hypothesis tests", testTests],
      ["linear algebra", testLinalg],
      ["numerical methods", testNumerics],
      ["compare with R", testCompare],
      ["language", testLanguage],
    ]) {
      const before = failures;
      const t0 = Date.now();
      await fn(page);
      console.log(`${failures === before ? "ok  " : "FAIL"} ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    }
    check("no page errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }
  // Japanese browser: Japanese by default
  {
    const { context, page, errors } = await openDemo(browser, { contextOptions: { locale: "ja-JP" } });
    await page.waitForSelector(`${tid("status")}[data-state="ready"]`);
    check("ja-JP browser: Japanese by default", (await page.getAttribute("html", "lang")) === "ja");
    check("ja-JP browser: no page errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }
  // ?src=local loads ../dist/rstats.js
  {
    const { context, page, errors } = await openDemo(browser, { query: "?src=local" });
    await page.waitForSelector(`${tid("status")}[data-state="ready"]`);
    check("?src=local: local source", (await page.getAttribute(tid("status"), "data-source")) === "local");
    check("?src=local: no page errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }
  // jsDelivr answering 404 (e.g. while the repository is private): a clear message, no uncaught error
  {
    const { context, page, errors } = await openDemo(browser, { cdn: "404" });
    await page.waitForSelector(tid("load-error"), { timeout: 20000 });
    const text = await page.textContent(tid("load-error"));
    check("CDN 404: message suggests ?src=local", text.includes("?src=local") && text.includes("npm run build"), text);
    check("CDN 404: no page errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }
  await testNoHorizontalScroll(browser);
  if (shotsDir) await screenshots(browser);
} finally {
  await browser.close();
}

console.log(`demo: ${checks - failures} / ${checks} checks passed`);
process.exitCode = failures > 0 ? 1 : 0;
