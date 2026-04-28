import { consumeContentWorkerStartupOptions } from "./content/contentWorkerStartup";
import { startContentWorker } from "./content/contentWorker";
import { createStandaloneContentScriptContext } from "./content/standaloneContentScriptContext";
import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";

export default defineUnlistedScript(() => {
  const ctx = createStandaloneContentScriptContext();

  void startContentWorker(ctx, consumeContentWorkerStartupOptions()).catch((error) => {
    console.warn("[fx-inline] Content worker failed to start", error);
  });
});
