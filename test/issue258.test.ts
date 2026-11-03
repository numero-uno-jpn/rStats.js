// Issue #258: hist's counting fuzz where the range of finite data overflows (review_fix_log_issue258.md).
import { describe, expect, it } from "vitest";
import { hist } from "../src/index.js";

describe("issue #258", () => {
  it("counts each value in its cell where the data range overflows", () => {
    // R 4.5.2: hist(c(-1e308, 1e308), breaks = c(-1e308, 0, 1e308))$counts is (2, 0) (the fuzz 1e-7 Inf moves the
    // middle break to Inf); was (2, 0) here. R with the data and breaks times 2^-1024 gives the counts below
    expect(hist([-1e308, 1e308], { breaks: [-1e308, 0, 1e308] }).counts).toEqual([1, 1]);
    expect(hist([-1e308, 0, 1e308], { breaks: [-1e308, 0, 1e308] }).counts).toEqual([2, 1]);
    expect(hist([-1e308, 0, 1e308], { breaks: [-1e308, 0, 1e308], right: false }).counts).toEqual([1, 2]);
    // the breaks chosen by Scott's (#230) and FD's (#231) rules
    expect(hist([-1e308, 1e308], { breaks: "Scott" }).counts).toEqual([1, 1]);
    expect(hist([-1.7e308, -1e308, 0, 1e308, 1.7e308], { breaks: "FD" }).counts).toEqual([3, 2]);
  });

  it("keeps the counts where the data range is finite", () => {
    // values before the fix
    expect(hist([-1.7e308, -1e308, 0, 1e308, 1.7e308], { breaks: [-1.7e308, 1.7e308] }).counts).toEqual([5]);
    expect(hist([0, 1, 1, 2], { breaks: [0, 1, 2] }).counts).toEqual([3, 1]);
    expect(hist([0, 1, 1, 2], { breaks: [0, 1, 2], right: false }).counts).toEqual([1, 3]);
    expect(hist([-1e300, 0, 1e300, 1e300], { breaks: [-1e300, 0, 1e300] }).counts).toEqual([2, 2]);
  });
});
