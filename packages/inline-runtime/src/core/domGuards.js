import {
  EDITABLE_CONTEXT_SELECTOR,
  INLINE_CONVERSION_CLASS,
  NON_VISIBLE_TEXT_CONTEXT_SELECTOR,
  SKIP_TAGS,
} from "./constants.js";

export function shouldSkipTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.isContentEditable) return true;
  if (parent.closest(EDITABLE_CONTEXT_SELECTOR)) return true;
  if (parent.closest(NON_VISIBLE_TEXT_CONTEXT_SELECTOR)) return true;
  if (parent.closest(`.${INLINE_CONVERSION_CLASS}`)) return true;

  return false;
}
