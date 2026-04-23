#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { assertDeterministicPrePluginSource } from "../src/index.js";

const targetPath = process.argv[2];

if (!targetPath) {
  console.error("Usage: node scripts/check-deterministic.mjs <plugin-file>");
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), targetPath);
if (!fs.existsSync(absolutePath)) {
  console.error(`File not found: ${absolutePath}`);
  process.exit(1);
}

const source = fs.readFileSync(absolutePath, "utf8");
const result = assertDeterministicPrePluginSource(source);

if (!result.valid) {
  console.error("Determinism check failed:");
  for (const finding of result.findings) {
    console.error(`- token=${finding.token} reason=${finding.reason}`);
  }
  process.exit(2);
}

console.log(`Determinism check passed: ${absolutePath}`);
