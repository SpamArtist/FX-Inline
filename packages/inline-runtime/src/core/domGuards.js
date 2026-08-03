import {
  SKIP_TAGS,
  TEXT_NODE_ANCESTOR_EXCLUSION_SELECTOR,
} from "./constants.js";

function evaluateTextNodeParentEligibility(parent) {
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.isContentEditable) return true;
  if (parent.closest(TEXT_NODE_ANCESTOR_EXCLUSION_SELECTOR)) return true;

  return false;
}

export function shouldSkipTextNode(node, parentEligibilityCache) {
  const parent = node.parentElement;
  if (!parent) return true;

  if (parentEligibilityCache) {
    const cached = parentEligibilityCache.get(parent);
    if (typeof cached === "boolean") return cached;

    const shouldSkip = evaluateTextNodeParentEligibility(parent);
    parentEligibilityCache.set(parent, shouldSkip);
    return shouldSkip;
  }

  return evaluateTextNodeParentEligibility(parent);
}
