import { createContentActivationController } from "./contentActivation";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "manual",
  main(ctx) {
    createContentActivationController(ctx).start();
  },
});
