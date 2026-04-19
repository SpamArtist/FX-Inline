import fs from "node:fs/promises";

for (const directory of [".output", ".release"]) {
  await fs.rm(directory, { recursive: true, force: true });
}
