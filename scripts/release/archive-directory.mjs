import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    throw new Error(`Missing ${name} argument.`);
  }
  return process.argv[index + 1];
}

async function addDirectoryToZip(zip, sourceDirectory, relativeDirectory = "") {
  const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(sourceDirectory, entry.name);
    const relativePath = relativeDirectory
      ? path.posix.join(relativeDirectory, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, absolutePath, relativePath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const contents = await fs.readFile(absolutePath);
    zip.file(relativePath.replaceAll(path.sep, "/"), contents);
  }
}

const sourceDirectory = path.resolve(getArg("--source"));
const outputFile = path.resolve(getArg("--output"));

const zip = new JSZip();
await addDirectoryToZip(zip, sourceDirectory);
await fs.mkdir(path.dirname(outputFile), { recursive: true });

const archive = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
});

await fs.writeFile(outputFile, archive);
process.stdout.write(`Created ${outputFile} from ${sourceDirectory}.\n`);
