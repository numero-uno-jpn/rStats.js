import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // With RSTATS_PRECISION (dd / double) set, write accuracy summaries; does nothing when unset
    setupFiles: ["test/helpers/precision.ts"],
    // A single fixture runs thousands to 20,000 cases, so allow plenty of time for slow CI machines
    // (qbeta takes about 6 s on GitHub Actions; qnchisq, qnt and pnt about 10 s locally)
    testTimeout: 120_000,
  },
});
