import { describe, it, expect } from "vitest";
import { installPackage } from "./install.js";

describe("installPackage — whitelist validation", () => {
  // These tests only exercise the whitelist gate (the synchronous path).
  // Actual pip invocations are not tested here (that's integration territory).

  const BLOCKED_PACKAGES = [
    "requests",
    "flask",
    "django",
    "boto3",
    "subprocess32",
    "os-sys",
    "",
    "random-unknown-pkg",
  ];

  for (const pkg of BLOCKED_PACKAGES) {
    it(`rejects non-whitelisted package: "${pkg}"`, async () => {
      const raw = await installPackage(pkg);
      const result = JSON.parse(raw);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not whitelisted/);
    });
  }

  it("normalizes underscores to hyphens (scikit_learn → scikit-learn)", async () => {
    // scikit_learn should normalize to scikit-learn which IS whitelisted,
    // so this will attempt an actual pip install. We can't easily mock execFile
    // here, so we just verify the whitelist check passes by checking the result
    // does NOT contain "not whitelisted".
    const raw = await installPackage("scikit_learn");
    const result = JSON.parse(raw);
    // Either success (pip works) or a pip error — but NOT a whitelist rejection
    expect(result.error ?? "").not.toMatch(/not whitelisted/);
  });

  it("is case-insensitive (PANDAS → pandas)", async () => {
    const raw = await installPackage("PANDAS");
    const result = JSON.parse(raw);
    expect(result.error ?? "").not.toMatch(/not whitelisted/);
  });

  it("trims whitespace", async () => {
    const raw = await installPackage("  numpy  ");
    const result = JSON.parse(raw);
    expect(result.error ?? "").not.toMatch(/not whitelisted/);
  });

  it("lists allowed packages in error message", async () => {
    const raw = await installPackage("badpkg");
    const result = JSON.parse(raw);
    expect(result.error).toContain("pandas");
    expect(result.error).toContain("numpy");
    expect(result.error).toContain("scikit-learn");
  });
});
