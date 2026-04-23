import {
  INLINE_CONVERSION_CSS,
  INLINE_CONVERSION_STYLE_ID,
} from "./constants.js";

export function ensureInlineConversionStyles() {
  let styleTag = document.getElementById(
    INLINE_CONVERSION_STYLE_ID,
  );

  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = INLINE_CONVERSION_STYLE_ID;
    document.head.appendChild(styleTag);
    styleTag.textContent = INLINE_CONVERSION_CSS;
    return;
  }

  if (styleTag.textContent !== INLINE_CONVERSION_CSS) {
    styleTag.textContent = INLINE_CONVERSION_CSS;
  }
}
