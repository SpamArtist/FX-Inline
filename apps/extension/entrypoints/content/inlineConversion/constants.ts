export const INLINE_CONVERSION_CLASS = "ccx-inline-conversion";
export const INLINE_CONVERSION_STYLE_ID = "ccx-inline-conversion-style";
export const INLINE_COMPACT_THRESHOLD = 100_000;
export const INLINE_CONVERSION_ADDON_MODE = "addon";

export const AMAZON_HIDDEN_PRICE_ROOT_SELECTOR = 'span[aria-hidden="true"]';
export const AMAZON_PRICE_SYMBOL_SELECTOR = ".a-price-symbol";
export const AMAZON_PRICE_WHOLE_SELECTOR = ".a-price-whole";
export const AMAZON_PRICE_DECIMAL_SELECTOR = ".a-price-decimal";
export const AMAZON_PRICE_FRACTION_SELECTOR = ".a-price-fraction";
export const ARIA_HIDDEN_SELECTOR = '[aria-hidden="true"]';

export const INLINE_CONVERSION_CSS = `
  :where(.${INLINE_CONVERSION_CLASS}) {
    border-radius: 0 !important;
    background-color: transparent !important;
    color: inherit !important;
    padding: 0 !important;
    white-space: normal !important;
  }

  :where(.${INLINE_CONVERSION_CLASS}) .ccx-converted-amount {
    font-weight: 600 !important;
    color: var(--ccx-converted-color, currentColor) !important;
    background-color: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin-left: 0.1em !important;
  }
`;

export const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "BUTTON",
  "CODE",
  "PRE",
  "SVG",
]);

export const RGB_CHANNEL_REGEX =
  /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,\/]+[\d.]+)?\s*\)/i;
export const DIGIT_REGEX = /\d/u;

export const EDITABLE_CONTEXT_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
].join(",");

export const NON_VISIBLE_TEXT_CONTEXT_SELECTOR = [
  "[hidden]",
  ".a-offscreen",
  ".sr-only",
  ".sr_only",
  ".sronly",
  ".srOnly",
  ".screen-reader-text",
  ".screenreader-only",
  ".visually-hidden",
  '[class*="srOnly"]',
  '[class*="sr-only"]',
  '[class*="screen-reader"]',
  '[class*="visually-hidden"]',
].join(",");
