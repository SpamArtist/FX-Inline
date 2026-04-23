const SETTINGS_STORAGE_KEY = "fxi:demo:acme:settings";

function readNumber(id, fallback) {
  const element = document.getElementById(id);
  const parsed = Number(element?.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readText(id, fallback) {
  const element = document.getElementById(id);
  const value = element?.value?.trim();
  return value?.length ? value : fallback;
}

function readSettingsFromForm() {
  return {
    fontScalePct: readNumber("font-scale", 90),
    fontWeight: readNumber("font-weight", 600),
    fontFamily: readText("font-family", "inherit"),
    fontColor: readText("font-color", "#355aa8"),
    spacingEm: readNumber("spacing-em", 0.1),
  };
}

function applySettingsToForm(settings) {
  const pairs = [
    ["font-scale", settings.fontScalePct],
    ["font-weight", settings.fontWeight],
    ["font-family", settings.fontFamily],
    ["font-color", settings.fontColor],
    ["spacing-em", settings.spacingEm],
  ];

  for (const [id, value] of pairs) {
    const element = document.getElementById(id);
    if (!element) continue;
    element.value = String(value);
  }
}

function getRuntimeManager() {
  return window.FXInlineRuntime || null;
}

function pushSettings(settings) {
  const manager = getRuntimeManager();
  if (!manager) return;

  try {
    manager.updateSettings("acme", settings);
  } catch {
    // Runtime might not be ready yet.
  }
}

function persistSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

const initial = loadPersistedSettings();
if (initial) {
  applySettingsToForm(initial);
}

const controlIds = [
  "font-scale",
  "font-weight",
  "font-family",
  "font-color",
  "spacing-em",
];

for (const id of controlIds) {
  document.getElementById(id)?.addEventListener("input", () => {
    const nextSettings = readSettingsFromForm();
    persistSettings(nextSettings);
    pushSettings(nextSettings);
  });
}

window.setInterval(() => {
  const manager = getRuntimeManager();
  if (!manager?.instances?.has("acme")) return;
  pushSettings(readSettingsFromForm());
}, 500);
