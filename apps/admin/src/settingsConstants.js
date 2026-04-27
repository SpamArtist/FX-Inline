export const DEFAULT_SETTINGS = {
  enabled: true,
  domain: "",
  pageUrl: "",
  targetCurrencies: ["EUR"],
  convertedCurrencyPosition: "right",
  displayStyle: "brackets",
  highlightColor: "#fff1a8",
  fontColor: "#355aa8",
  extraSettings: {},
};

export const DEFAULT_MANIFEST = {
  schemaVersion: 1,
  generatedAt: "1970-01-01T00:00:00.000Z",
  scopes: {
    allUrls: DEFAULT_SETTINGS,
    domains: {},
    pages: {},
  },
};

export const POSITION_OPTIONS = ["top", "bottom", "left", "right", "tooltip"];

export const DISPLAY_STYLE_OPTIONS = [
  { value: "pill", label: "Pill" },
  { value: "underline", label: "Underline" },
  { value: "highlightColor", label: "Highlight" },
  { value: "brackets", label: "Brackets" },
];

export function getDisplayStylePreview(displayStyle, targetCurrency) {
  const preview = `${targetCurrency} 90`;
  return displayStyle === "brackets" ? `(${preview})` : preview;
}
