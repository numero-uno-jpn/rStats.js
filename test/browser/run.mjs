// Bundles test/browser/smoke.ts with esbuild and runs it in headless Chromium (Playwright).
//   npm run test:browser   (build first)
// Install Chromium beforehand with `npx playwright install chromium`.

import { build } from "esbuild";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("./smoke.ts", import.meta.url));
const bundle = await build({
  entryPoints: [entry],
  bundle: true,
  format: "iife",
  globalName: "smoke",
  write: false,
  target: "es2022",
});
const code = bundle.outputFiles[0].text;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: code });
  const results = await page.evaluate(() => globalThis.smoke.run());
  const ua = await page.evaluate(() => navigator.userAgent);
  console.log(`browser: ${ua}`);
  for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}${r.detail ? `: ${r.detail}` : ""}`);
  const failed = results.filter((r) => !r.ok).length + errors.length;
  for (const e of errors) console.log(`page error: ${e}`);
  console.log(`${results.length - failed} / ${results.length} passed`);
  process.exitCode = failed > 0 ? 1 : 0;
} finally {
  await browser.close();
}
