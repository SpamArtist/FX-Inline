import { createInlineRuntimeController } from "./controllerFactory.js";

export function createInlineRuntime(options = {}) {
  return createInlineRuntimeController(options);
}
