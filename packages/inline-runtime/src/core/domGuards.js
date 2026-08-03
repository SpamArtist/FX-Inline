import {
  SKIP_TAGS,
  TEXT_NODE_ANCESTOR_EXCLUSION_SELECTOR,
} from "./constants.js";

export function shouldSkipTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.isContentEditable) return true;
  if (parent.closest(TEXT_NODE_ANCESTOR_EXCLUSION_SELECTOR)) return true;

  return false;
}
