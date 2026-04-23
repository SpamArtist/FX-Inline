import { startRuntimeFromScriptTag } from "../b2b-runtime/loader.js";

void startRuntimeFromScriptTag().catch((error) => {
  console.error("[fxi] failed to start B2B runtime", error);
});
