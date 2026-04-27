export const INLINE_CONVERSION_CLASS = "fx-inline-conversion";
export const INLINE_CONVERSION_STYLE_ID = "fx-inline-conversion-style";
export const INLINE_COMPACT_THRESHOLD = 100_000;
export const INLINE_CONVERSION_ADDON_MODE = "addon";
export const INLINE_CONVERSION_SKIP_SELECTOR =
  '[data-ccx-skip-inline-conversion="true"]';

export const ARIA_HIDDEN_SELECTOR = '[aria-hidden="true"]';

export const INLINE_CONVERSION_CSS = `
  :where(.${INLINE_CONVERSION_CLASS}) {
    border-radius: 0 !important;
    background-color: transparent !important;
    color: inherit !important;
    padding: 0 !important;
    white-space: normal !important;
  }

  :where(.${INLINE_CONVERSION_CLASS}) .fx-inline-converted-amount {
    font-weight: 600 !important;
    color: var(--fx-inline-converted-color, currentColor) !important;
    background-color: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin-left: 0.1em !important;
    line-height: inherit !important;
    width: fit-content !important;
    display: inline-block;
  }

  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-position="top"],
  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-position="bottom"] {
    display: inline-flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 0.05em !important;
    vertical-align: baseline !important;
    line-height: inherit !important;
  }

  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-position="left"] .fx-inline-converted-amount,
  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-position="top"] .fx-inline-converted-amount {
    margin-left: 0 !important;
    margin-right: 0.1em !important;
  }

  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-display-style="pill"] .fx-inline-converted-amount {
    border: 1px solid color-mix(in srgb, var(--fx-inline-converted-color, currentColor) 38%, transparent) !important;
    border-radius: 999px !important;
    background-color: color-mix(in srgb, var(--fx-inline-converted-color, currentColor) 12%, transparent) !important;
    padding: 0.05em 0.38em !important;
  }

  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-display-style="underline"] .fx-inline-converted-amount {
    text-decoration: underline !important;
    text-decoration-thickness: 0.12em !important;
    text-underline-offset: 0.18em !important;
  }

  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-display-style="highlightColor"] .fx-inline-converted-amount {
    border-radius: 0.18em !important;
    background-color: var(--fx-inline-highlight-color, rgba(250, 204, 21, 0.24)) !important;
    padding: 0.02em 0.22em !important;
  }

  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-position="tooltip"] {
    position: relative !important;
    border-bottom: 1px dotted var(--fx-inline-converted-color, currentColor) !important;
    cursor: help !important;
  }

  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-position="tooltip"]::after {
    position: absolute !important;
    left: 50% !important;
    bottom: calc(100% + 0.35em) !important;
    z-index: 2147483647 !important;
    max-width: 18rem !important;
    width: max-content !important;
    transform: translateX(-50%) translateY(0.2em) !important;
    border-radius: 0.35em !important;
    background: rgba(17, 24, 39, 0.96) !important;
    color: #fff !important;
    content: attr(data-fx-inline-tooltip) !important;
    font-size: 0.78em !important;
    font-weight: 700 !important;
    line-height: 1.25 !important;
    opacity: 0 !important;
    padding: 0.32em 0.48em !important;
    pointer-events: none !important;
    transition: opacity 120ms ease, transform 120ms ease !important;
    white-space: nowrap !important;
  }

  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-position="tooltip"]:hover::after,
  :where(.${INLINE_CONVERSION_CLASS})[data-fx-inline-position="tooltip"]:focus-within::after {
    opacity: 1 !important;
    transform: translateX(-50%) translateY(0) !important;
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
  /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+[\d.]+)?\s*\)/i;
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
  INLINE_CONVERSION_SKIP_SELECTOR,
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
