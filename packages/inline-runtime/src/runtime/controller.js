import { getRates } from "../rates/index.js";
import { createInlineRuntimeController } from "./controllerFactory.js";

export function createInlineRuntime(options = {}) {
  return createInlineRuntimeController(options, getRates);
}
