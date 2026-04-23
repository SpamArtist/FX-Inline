import { createInlineRuntime } from "./runtime/controller.js";

const globalObject = typeof window !== "undefined" ? window : globalThis;

const api = {
  mount(options) {
    const runtime = createInlineRuntime(options);
    runtime.start();
    return runtime;
  },
  createInlineRuntime,
};

globalObject.FXInlineRuntime = api;

export { api as FXInlineRuntime };
