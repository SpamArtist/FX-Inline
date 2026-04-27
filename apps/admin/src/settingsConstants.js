export const DEFAULT_SETTINGS = {
  enabled: true,
  domain: "",
  pageUrl: "",
  targetCurrencies: ["EUR"],
  convertedCurrencyPosition: "right",
  displayStyle: "brackets",
  highlightColor: "#fff1a8",
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
  { value: "pill", label: "Pill", preview: "EUR 90" },
  { value: "underline", label: "Underline", preview: "EUR 90" },
  { value: "highlightColor", label: "Highlight", preview: "EUR 90" },
  { value: "brackets", label: "Brackets", preview: "(EUR 90)" },
];
