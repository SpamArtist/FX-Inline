export const INLINE_WRAPPER_CLASS = "fxi-inline-conversion";
export const INLINE_STYLE_ID = "fxi-inline-runtime-style";

export const INLINE_RUNTIME_CSS = `
  :where(.${INLINE_WRAPPER_CLASS}) {
    --fxi-font-scale: 0.9;
    --fxi-font-weight: 600;
    --fxi-font-family: inherit;
    --fxi-font-color: currentColor;
    --fxi-spacing: 0.1em;
    white-space: normal;
  }

  :where(.${INLINE_WRAPPER_CLASS}) .fxi-converted-amount {
    color: var(--fxi-font-color);
    font-size: calc(1em * var(--fxi-font-scale));
    font-weight: var(--fxi-font-weight);
    font-family: var(--fxi-font-family);
    margin-left: var(--fxi-spacing);
  }
`;

export const DEFAULT_RATE_PROVIDERS = [
  "https://open.er-api.com/v6/latest/USD",
  "https://api.exchangerate-api.com/v4/latest/USD",
];

export const DEFAULT_UI_SETTINGS = {
  fontScalePct: 90,
  fontWeight: 600,
  fontFamily: "inherit",
  fontColor: "currentColor",
  spacingEm: 0.1,
};

export const FONT_SCALE_LIMITS = {
  min: 60,
  max: 200,
};

export const FONT_WEIGHT_LIMITS = {
  min: 300,
  max: 800,
};

export const SPACING_LIMITS = {
  min: 0,
  max: 0.5,
};

export const KNOWN_FONT_FAMILIES = new Set([
  "inherit",
  "Inter, sans-serif",
  "ui-sans-serif, system-ui, sans-serif",
  "Arial, sans-serif",
  "Georgia, serif",
  "'IBM Plex Sans', sans-serif",
]);
