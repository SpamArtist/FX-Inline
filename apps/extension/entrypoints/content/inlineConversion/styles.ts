import {
  INLINE_CONVERSION_CSS,
  INLINE_CONVERSION_STYLE_ID,
} from "./constants";

export function ensureInlineConversionStyles() {
  let styleTag = document.getElementById(
    INLINE_CONVERSION_STYLE_ID,
  ) as HTMLStyleElement | null;

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
