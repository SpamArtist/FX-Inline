import fs from "node:fs";
import path from "node:path";
import { assertDeterministicPrePluginSource } from "../src/index.js";

const fixturesDirectory = path.resolve(process.cwd(), "packages/b2b-plugin-sdk/fixtures");

test("deterministic pre plugin fixture passes guard", () => {
  const source = fs.readFileSync(path.join(fixturesDirectory, "deterministic-pre.js"), "utf8");

  const result = assertDeterministicPrePluginSource(source);
  expect(result.valid).toBe(true);
  expect(result.findings).toHaveLength(0);
});

test("nondeterministic pre plugin fixture is rejected", () => {
  const source = fs.readFileSync(path.join(fixturesDirectory, "nondeterministic-pre.js"), "utf8");

  const result = assertDeterministicPrePluginSource(source);
  expect(result.valid).toBe(false);
  expect(result.findings.length).toBeGreaterThan(0);
  expect(result.findings.some((finding) => finding.token === "fetch(")).toBe(true);
});
