// Issue #457: aov takes an Error() term in parentheses (review_fix_log_issue457.md).
import { describe, expect, it } from "vitest";
import { aov, aovSummary, type AovStrataFit } from "../src/index.js";

const d = {
  y: [1, 2, 3, 5, 4, 7],
  treatment: ["A", "A", "A", "B", "B", "B"],
  subject: ["s1", "s2", "s3", "s1", "s2", "s3"],
};
const summary = (f: string) => aovSummary(aov(f, d) as AovStrataFit);

describe("issue #457", () => {
  it("gives the strata of the term without parentheses", () => {
    // R: summary(aov(y ~ treatment + (Error(subject)), d)) and the other forms print the same tables as
    // y ~ treatment + Error(subject): subject Residuals Df 2, SS 5.333; Within treatment F 25, p 0.0377
    const plain = summary("y ~ treatment + Error(subject)");
    expect(plain.strata[1]!.table[0]![3]).toBeCloseTo(25, 12);
    for (const f of [
      "y ~ treatment + (Error(subject))",
      "y ~ treatment + ((Error(subject)))",
      "y ~ (treatment + Error(subject))",
      "y ~ (treatment) + (Error(subject))",
    ]) {
      expect(summary(f)).toEqual(plain);
    }
  });

  it("removes the intercept after a parenthesised Error() term", () => {
    // R: y ~ (Error(subject)) + treatment - 1: subject stratum treatment SS 80.67, F 30.25, p 0.0315
    const s = summary("y ~ (Error(subject)) + treatment - 1");
    expect(s).toEqual(summary("y ~ Error(subject) + treatment - 1"));
    expect(s.strata[0]!.table[0]![3]).toBeCloseTo(30.25, 12);
  });
});
