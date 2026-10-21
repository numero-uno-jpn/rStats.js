// Runs test/browser/smoke.ts in headless Chromium (Playwright), twice:
//   1. bundled with esbuild from dist/index.js into a classic script (as an application bundler would)
//   2. as a native ES module that imports the single-file build dist/rstats.js over HTTP
//      (as a page loading it from a CDN would)
//   npm run test:browser   (build first)
// Install Chromium beforehand with `npx playwright install chromium`.

import { build } from "esbuild";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("./smoke.ts", import.meta.url));
const singleFile = readFileSync(new URL("../../dist/rstats.js", import.meta.url), "utf8");

async function bundleSmoke(options) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, target: "es2022", ...options });
  return result.outputFiles[0].text;
}

const bundled = await bundleSmoke({ format: "iife", globalName: "smoke" });
// Same checks, but dist/index.js is replaced by an import of /rstats.js left to the browser
const asModule = await bundleSmoke({
  format: "esm",
  plugins: [
    {
      name: "single-file",
      setup(b) {
        b.onResolve({ filter: /dist\/index\.js$/ }, () => ({ path: "/rstats.js", external: true }));
      },
    },
  ],
});

const origin = "http://rstats.test";
const files = {
  "/": ["text/html", "<!doctype html><html><body></body></html>"],
  "/rstats.js": ["text/javascript", singleFile],
  "/smoke.js": ["text/javascript", asModule],
};

let failed = 0;
const browser = await chromium.launch();
try {
  for (const mode of ["bundled (dist/index.js)", "ES module (dist/rstats.js)"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(`${origin}/**`, (route) => {
      const file = files[new URL(route.request().url()).pathname];
      return file ? route.fulfill({ contentType: file[0], body: file[1] }) : route.fulfill({ status: 404 });
    });
    await page.goto(`${origin}/`);
    let results;
    if (mode.startsWith("bundled")) {
      await page.addScriptTag({ content: bundled });
      results = await page.evaluate(() => globalThis.smoke.run());
    } else {
      results = await page.evaluate(async () => (await import("/smoke.js")).run());
    }
    if (failed === 0 && mode.startsWith("bundled")) console.log(`browser: ${await page.evaluate(() => navigator.userAgent)}`);
    console.log(`== ${mode}`);
    for (const r of results) if (!r.ok) console.log(`FAIL ${r.name}${r.detail ? `: ${r.detail}` : ""}`);
    for (const e of errors) console.log(`page error: ${e}`);
    const bad = results.filter((r) => !r.ok).length + errors.length;
    console.log(`${results.length - bad} / ${results.length} passed`);
    failed += bad;
    await page.close();
  }
} finally {
  await browser.close();
}
process.exitCode = failed > 0 ? 1 : 0;
