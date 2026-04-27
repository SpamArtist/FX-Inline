import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Injectable } from "@nestjs/common";
import {
  readInlineRuntimeSettingsManifestFromDb,
  resolveAdminDbPath,
  saveAndExportInlineRuntimeSettingsManifest,
} from "./settings-store.js";

interface CommandResult {
  stdout: string;
  stderr: string;
}

type CommandError = Error & {
  stdout?: string;
  stderr?: string;
};

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDirectory, "../..");

@Injectable()
export class AdminService {
  private readonly dbPath = resolveAdminDbPath();

  getSettings() {
    return readInlineRuntimeSettingsManifestFromDb(this.dbPath);
  }

  saveSettings(manifestInput: unknown) {
    return saveAndExportInlineRuntimeSettingsManifest(manifestInput, {
      dbPath: this.dbPath,
    });
  }

  buildWebExtension() {
    return this.runCommand("npm", ["run", "build"], { cwd: repoRoot });
  }

  private runCommand(
    command: string,
    args: string[],
    options: { cwd: string },
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        ...options,
        shell: process.platform === "win32",
        env: {
          ...process.env,
          FORCE_COLOR: "0",
        },
      });
      let stdout = "";
      let stderr = "";

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (exitCode) => {
        if (exitCode === 0) {
          resolve({ stdout, stderr });
          return;
        }

        const error: CommandError = new Error(`Command failed with exit code ${exitCode}.`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      });
    });
  }
}
