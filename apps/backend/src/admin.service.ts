import { Injectable } from "@nestjs/common";
import {
  readInlineRuntimeSettingsManifestFromDb,
  resolveAdminDbPath,
  writeInlineRuntimeSettingsManifestToDb,
} from "./settings-store.js";

@Injectable()
export class AdminService {
  private readonly dbPath = resolveAdminDbPath();

  getSettings() {
    return readInlineRuntimeSettingsManifestFromDb(this.dbPath);
  }

  saveSettings(manifestInput: unknown) {
    return {
      manifest: writeInlineRuntimeSettingsManifestToDb(manifestInput, this.dbPath),
    };
  }
}
