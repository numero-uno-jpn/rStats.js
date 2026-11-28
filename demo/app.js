// rStats.js demo: loads the library (jsDelivr by default, ../dist/rstats.js with ?src=local), mixed models, regression
// multivariate analysis and time series, which are separate area bundles, and builds the tabs.

import { applyI18n, getLang, initLang, setLang, t } from "./i18n.js";
import { h, setChildren, storage } from "./util.js";
import { createDistributionsTab } from "./distributions.js";
import { createSpecialTab } from "./special.js";
import { createRandomTab } from "./random.js";
import { createTestsTab } from "./tests.js";
import { createLinalgTab } from "./linalg.js";
import { createPlotsTab } from "./plots.js";
import { createDescriptiveTab } from "./descriptive.js";
import { createNumericsTab } from "./numerics.js";
import { createCompareTab } from "./examples.js";

/** The release whose build is loaded from jsDelivr. */
const VERSION = "v1.21.0";
// jsDelivr's npm route: its GitHub route (cdn.jsdelivr.net/gh/...) does not serve release tags from v0.12.0 on, since
// the repository with its test fixtures exceeds its size limit of 50 MB
const CDN_DIST = `https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@${VERSION.slice(1)}/dist/`;
const LOCAL_DIST = "../dist/";

const params = new URLSearchParams(location.search);
const source = params.get("src") === "local" ? "local" : "cdn";
const distUrl = new URL(source === "local" ? LOCAL_DIST : CDN_DIST, location.href).href;
const libUrl = `${distUrl}rstats.js`;
/** The mixed-models area (lmer): a separate file, since it is not in dist/rstats.js */
const mixedUrl = `${distUrl}mixed.js`;
/** The regression area (polr, rlm, nls): a separate file, since it is not in dist/rstats.js */
const regressionUrl = `${distUrl}regression.js`;
/** The multivariate area (manova, lda, cancor): a separate file, since it is not in dist/rstats.js */
const multivariateUrl = `${distUrl}multivariate.js`;
/** The time-series area (acf, pacf, ccf, from 1.11.0): a separate file, since it is not in dist/rstats.js */
const timeseriesUrl = `${distUrl}timeseries.js`;
/** The causal-inference area (match, balTab, from 1.12.0): a separate file, since it is not in dist/rstats.js */
const causalUrl = `${distUrl}causal.js`;
/** The plot-data area (survPlotData, forestPlotData, from 1.21.0): a separate file, since it is not in dist/rstats.js */
const plotUrl = `${distUrl}plot.js`;
/**
 * The random numbers of the per-area bundles (their shared chunks): the areas above have a generator of their own,
 * apart from dist/rstats.js's, so setSeed seeds both (mediate in causal.js draws from the area generator, from 1.16.0)
 */
const areaRandomUrl = `${distUrl}distributions.js`;

const ALL_TABS = ["distributions", "descriptive", "special", "random", "tests", "linalg", "numerics", "plots", "compare"];
/** Tabs that need functions newer than some builds: shown only when the loaded build has them */
const NEEDS = { descriptive: "quantile", numerics: "integrate", plots: "survPlotData" };
let TAB_IDS = ALL_TABS;

const statusEl = document.getElementById("status");
const main = document.getElementById("main");
const tabsNav = document.getElementById("tabs");

// ---------- theme ----------

const THEMES = ["auto", "light", "dark"];
let theme = THEMES.includes(storage.get("rstats-demo-theme")) ? storage.get("rstats-demo-theme") : "auto";
const themeButton = document.getElementById("theme-toggle");
function applyTheme() {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  themeButton.textContent = `${t("theme.label")}: ${t(`theme.${theme}`)}`;
}
themeButton.addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  storage.set("rstats-demo-theme", theme);
  applyTheme();
});

// ---------- language ----------

const langButton = document.getElementById("lang-toggle");
const onLangChange = [];
function applyLang() {
  document.documentElement.lang = getLang();
  applyI18n(document);
  langButton.textContent = getLang() === "ja" ? "English" : "日本語";
  langButton.setAttribute("lang", getLang() === "ja" ? "en" : "ja");
  langButton.setAttribute("aria-label", t("lang.switch"));
  document.title = t("app.title");
  applyTheme();
  renderStatus();
  for (const fn of onLangChange) fn();
}
langButton.addEventListener("click", () => {
  setLang(getLang() === "ja" ? "en" : "ja");
  storage.set("rstats-demo-lang", getLang());
  applyLang();
});

// ---------- status line ----------

let state = { phase: "loading" };
function renderStatus() {
  statusEl.dataset.state = state.phase;
  statusEl.dataset.source = source;
  const where = t(source === "local" ? "status.local" : "status.cdn");
  const switchLink =
    source === "local"
      ? h("a", { href: "?", i18n: "status.useCdn" })
      : h("a", { href: "?src=local", i18n: "status.useLocal" });
  if (state.phase === "loading") setChildren(statusEl, t("status.loading", VERSION, where));
  else if (state.phase === "error") setChildren(statusEl, h("span", { class: "status-bad", text: t("status.failed", where) }));
  else
    setChildren(
      statusEl,
      h("span", { class: "status-dot", "aria-hidden": "true" }),
      h("span", {}, t("status.loaded", VERSION, where, state.count)),
      " ",
      h("code", { class: "status-url", text: libUrl }),
      " · ",
      switchLink,
    );
}

function showLoadError(err) {
  state = { phase: "error" };
  renderStatus();
  setChildren(
    main,
    h(
      "section",
      { class: "card load-error", role: "alert", "data-testid": "load-error" },
      h("h2", { class: "card-title", i18n: "load.title" }),
      h("p", {}, h("span", { i18n: "load.url" }), " ", h("code", { text: libUrl })),
      h("p", { class: "mono error-text", text: String(err?.message ?? err) }),
      source === "cdn" ? h("p", { i18n: "load.cdnHint" }) : h("p", { i18n: "load.localHint" }),
      h("ol", { class: "steps" }, h("li", {}, h("code", { text: "npm run build" })), h("li", {}, h("code", { text: "npx serve ." }), " ", h("span", { i18n: "load.serveHint" })), h("li", {}, h("span", { i18n: "load.open" }), " ", h("code", { text: "/demo/?src=local" }))),
    ),
  );
}

// ---------- data files ----------

async function fetchJSON(name) {
  try {
    const res = await fetch(name, { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------- tabs ----------

function buildTabs(ctx) {
  TAB_IDS = ALL_TABS.filter((id) => !NEEDS[id] || ctx.lib[NEEDS[id]]);
  const factories = {
    distributions: createDistributionsTab,
    descriptive: createDescriptiveTab,
    numerics: createNumericsTab,
    special: createSpecialTab,
    random: createRandomTab,
    tests: createTestsTab,
    linalg: createLinalgTab,
    plots: createPlotsTab,
    compare: createCompareTab,
  };
  const tabs = {};
  const buttons = {};
  const panels = {};
  for (const id of TAB_IDS) {
    buttons[id] = h("button", {
      type: "button",
      role: "tab",
      id: `tab-${id}`,
      class: "tab",
      "aria-controls": `panel-${id}`,
      "data-testid": `tab-${id}`,
      i18n: `tab.${id}`,
      on: { click: () => select(id, true), keydown: (e) => onKey(e, id) },
    });
    panels[id] = h("section", { role: "tabpanel", id: `panel-${id}`, class: "panel", "aria-labelledby": `tab-${id}`, "data-testid": `panel-${id}`, tabindex: "-1" });
  }
  setChildren(tabsNav, Object.values(buttons));
  setChildren(main, Object.values(panels));
  for (const id of TAB_IDS) {
    try {
      tabs[id] = factories[id](ctx);
      panels[id].append(tabs[id].el);
    } catch (e) {
      console.error(e);
      panels[id].append(h("p", { class: "error-box", role: "alert", text: `${t("error")}: ${e.message}` }));
    }
  }
  function select(id, focus = false) {
    for (const k of TAB_IDS) {
      const on = k === id;
      buttons[k].setAttribute("aria-selected", String(on));
      buttons[k].tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    }
    if (focus) buttons[id].focus();
    if (location.hash !== `#${id}`) history.replaceState(null, "", `${location.search}#${id}`);
  }
  function onKey(e, id) {
    const i = TAB_IDS.indexOf(id);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TAB_IDS.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    select(TAB_IDS[(next + TAB_IDS.length) % TAB_IDS.length], true);
  }
  const fromHash = () => (TAB_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "distributions");
  window.addEventListener("hashchange", () => select(fromHash()));
  select(fromHash());
  onLangChange.push(() => {
    for (const tab of Object.values(tabs)) tab.update?.();
    for (const fn of ctx.refreshers) fn();
  });
}

async function start() {
  initLang(storage.get("rstats-demo-lang"), navigator.language);
  applyLang();
  let lib;
  let mixed;
  let regression;
  let multivariate;
  let timeseries;
  let causal;
  let plot;
  let areaRandom;
  try {
    [lib, mixed, regression, multivariate, timeseries, causal, plot, areaRandom] = await Promise.all([
      import(libUrl), import(mixedUrl), import(regressionUrl), import(multivariateUrl),
      // a release before 1.11.0 has no timeseries.js: the demo then runs without it
      import(timeseriesUrl).catch(() => ({})),
      // and a release before 1.12.0 no causal.js
      import(causalUrl).catch(() => ({})),
      // and a release before 1.21.0 no plot.js
      import(plotUrl).catch(() => ({})),
      import(areaRandomUrl).catch(() => ({})),
    ]);
  } catch (err) {
    showLoadError(err);
    return;
  }
  const mixedNames = new Set(Object.keys(mixed));
  const regressionNames = new Set(Object.keys(regression));
  const multivariateNames = new Set(Object.keys(multivariate));
  const timeseriesNames = new Set(Object.keys(timeseries));
  const causalNames = new Set(Object.keys(causal));
  const plotNames = new Set(Object.keys(plot));
  const [examplesFile, rResults] = await Promise.all([fetchJSON("examples.json"), fetchJSON("r-results.json")]);
  const ctx = {
    lib: {
      ...lib, ...mixed, ...regression, ...multivariate, ...timeseries, ...causal, ...plot,
      ...(typeof areaRandom.setSeed === "function" ? { setSeed: (seed) => { areaRandom.setSeed(seed); return lib.setSeed(seed); } } : {}),
    },
    examples: Array.isArray(examplesFile?.examples) ? examplesFile.examples : null,
    rResults: rResults?.results ? rResults : null,
    refreshers: [],
    importLine: (names) => {
      const unique = [...new Set(names)];
      const fromMixed = unique.filter((n) => mixedNames.has(n));
      const fromRegression = unique.filter((n) => regressionNames.has(n));
      const fromMultivariate = unique.filter((n) => multivariateNames.has(n));
      const fromTimeseries = unique.filter((n) => timeseriesNames.has(n));
      const fromCausal = unique.filter((n) => causalNames.has(n));
      const fromPlot = unique.filter((n) => plotNames.has(n));
      const fromMain = unique.filter((n) => !mixedNames.has(n) && !regressionNames.has(n) && !multivariateNames.has(n) &&
        !timeseriesNames.has(n) && !causalNames.has(n) && !plotNames.has(n));
      return [
        ...(fromMain.length ? [`const { ${fromMain.join(", ")} } = await import("${libUrl}");`] : []),
        ...(fromMixed.length ? [`const { ${fromMixed.join(", ")} } = await import("${mixedUrl}");`] : []),
        ...(fromRegression.length ? [`const { ${fromRegression.join(", ")} } = await import("${regressionUrl}");`] : []),
        ...(fromMultivariate.length ? [`const { ${fromMultivariate.join(", ")} } = await import("${multivariateUrl}");`] : []),
        ...(fromTimeseries.length ? [`const { ${fromTimeseries.join(", ")} } = await import("${timeseriesUrl}");`] : []),
        ...(fromCausal.length ? [`const { ${fromCausal.join(", ")} } = await import("${causalUrl}");`] : []),
        ...(fromPlot.length ? [`const { ${fromPlot.join(", ")} } = await import("${plotUrl}");`] : []),
      ].join("\n");
    },
  };
  buildTabs(ctx);
  state = { phase: "ready", count: Object.keys(ctx.lib).length };
  renderStatus();
}

start();
