import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  ChevronDown,
  Globe2,
  Hammer,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import currencies from "../../extension/assets/currency.json";

const DEFAULT_SETTINGS = {
  enabled: true,
  domain: "",
  pageUrl: "",
  targetCurrencies: ["EUR"],
  convertedCurrencyPosition: "right",
  displayStyle: "brackets",
  highlightColor: "#fff1a8",
  extraSettings: {},
};

const DEFAULT_MANIFEST = {
  schemaVersion: 1,
  generatedAt: "1970-01-01T00:00:00.000Z",
  scopes: {
    allUrls: DEFAULT_SETTINGS,
    domains: {},
    pages: {},
  },
};

const POSITION_OPTIONS = ["top", "bottom", "left", "right", "tooltip"];
const DISPLAY_STYLE_OPTIONS = [
  { value: "pill", label: "Pill", preview: "EUR 90" },
  { value: "underline", label: "Underline", preview: "EUR 90" },
  { value: "highlightColor", label: "Highlight", preview: "EUR 90" },
  { value: "brackets", label: "Brackets", preview: "(EUR 90)" },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeDomain(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalizePageUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function getPageDomain(pageUrl) {
  try {
    return new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getScopeKey(scope) {
  return scope.type === "all_urls" ? "all_urls" : scope.id;
}

function getDomainPages(manifest, domain) {
  return Object.entries(manifest.scopes.pages)
    .filter(([, settings]) => settings.domain === domain)
    .sort(([left], [right]) => left.localeCompare(right));
}

function CurrencySearchDropdown({ value, options, onChange }) {
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery) return options;

    return options.filter((currency) =>
      currency.code.includes(normalizedQuery),
    );
  }, [options, query]);
  const selected = options.find((currency) => currency.code === value);

  return (
    <DropdownMenu.Root onOpenChange={(open) => {
      if (open) setQuery("");
    }}>
      <DropdownMenu.Trigger className="currency-select-trigger">
        <span>{selected?.logo}</span>
        <strong>{value}</strong>
        <ChevronDown size={15} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="currency-select-menu"
          align="start"
          sideOffset={6}
        >
          <div className="currency-search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search currency code"
            />
          </div>
          <div className="currency-options" aria-label="Currency options">
            {filteredOptions.length ? (
              filteredOptions.map((currency) => (
                <DropdownMenu.Item
                  key={currency.code}
                  className="currency-option"
                  onSelect={() => onChange(currency.code)}
                >
                  <span>{currency.logo}</span>
                  <strong>{currency.code}</strong>
                  {currency.code === value ? <Check size={14} /> : null}
                </DropdownMenu.Item>
              ))
            ) : (
              <div className="currency-option empty">No matching currency</div>
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SettingsForm({
  settings,
  onChange,
  title,
  lockDomainFields = false,
  actions = null,
}) {
  const currencyOptions = useMemo(
    () => currencies
      .map((currency) => ({
        code: currency.code,
        logo: currency.logo,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    [],
  );
  const activeTargetCurrency = settings.targetCurrencies[0] ?? "EUR";
  const isTooltip = settings.convertedCurrencyPosition === "tooltip";

  function update(patch) {
    onChange({
      ...settings,
      ...patch,
      displayStyle: patch.convertedCurrencyPosition === "tooltip"
        ? settings.displayStyle
        : patch.displayStyle ?? settings.displayStyle,
    });
  }

  function chooseTarget(currency) {
    update({ targetCurrencies: [currency] });
  }

  return (
    <section className="settings-panel" aria-label={title}>
      <div className="panel-heading">
        <h2>{title}</h2>
        <div className="panel-actions">
          {actions}
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
            />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
            <span>{settings.enabled ? "On" : "Off"}</span>
          </label>
        </div>
      </div>

      <div className="form-grid">
        <label>
          <span>Domain</span>
          <input
            value={settings.domain}
            disabled={lockDomainFields}
            onChange={(event) => update({ domain: normalizeDomain(event.target.value) })}
            placeholder="example.com"
          />
        </label>

        <label>
          <span>Page URL</span>
          <input
            value={settings.pageUrl}
            disabled={lockDomainFields}
            onChange={(event) => update({ pageUrl: normalizePageUrl(event.target.value) })}
            placeholder="https://example.com/pricing"
          />
        </label>

        <label className="position-field">
          <span>Converted currency position</span>
          <select
            value={settings.convertedCurrencyPosition}
            onChange={(event) =>
              update({ convertedCurrencyPosition: event.target.value })
            }
          >
            {POSITION_OPTIONS.map((position) => (
              <option key={position} value={position}>{position}</option>
            ))}
          </select>
        </label>

        <div className="target-currency-field" aria-label="Target currency">
          <div className="subheading">
            <span>Target currency</span>
            <strong>{activeTargetCurrency} active</strong>
          </div>
          <CurrencySearchDropdown
            value={activeTargetCurrency}
            options={currencyOptions}
            onChange={chooseTarget}
          />
        </div>

        <div className="display-style-field">
          <span className="field-label">Display style</span>
          <div className="display-style-tabs" role="tablist" aria-label="Display style">
            {DISPLAY_STYLE_OPTIONS.map((style) => {
              const isSelected = settings.displayStyle === style.value;
              return (
                <div
                  key={style.value}
                  className={isSelected ? "display-style-tab selected" : "display-style-tab"}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className="display-style-tab-button"
                    disabled={isTooltip}
                    onClick={() => update({ displayStyle: style.value })}
                  >
                    <span>{style.label}</span>
                    <span
                      className={`style-preview ${style.value}`}
                      style={style.value === "highlightColor"
                        ? { "--preview-highlight-color": settings.highlightColor }
                        : undefined}
                    >
                      {style.preview}
                    </span>
                  </button>
                  {style.value === "highlightColor" ? (
                    <input
                      className="highlight-color-picker"
                      type="color"
                      value={settings.highlightColor}
                      disabled={isTooltip}
                      aria-label="Highlight color"
                      onChange={(event) =>
                        update({
                          displayStyle: "highlightColor",
                          highlightColor: event.target.value,
                        })
                      }
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [manifest, setManifest] = useState(DEFAULT_MANIFEST);
  const [draftManifest, setDraftManifest] = useState(DEFAULT_MANIFEST);
  const [activeScope, setActiveScope] = useState({ type: "all_urls", id: "all_urls" });
  const [toast, setToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);

  function showMessage(message, tone = "info") {
    setToast({
      id: `${Date.now()}-${message}`,
      message,
      tone,
    });
  }

  useEffect(() => {
    let canceled = false;

    fetch("/api/settings")
      .then((response) => {
        if (!response.ok) throw new Error("Admin API unavailable");
        return response.json();
      })
      .then((settings) => {
        if (canceled) return;
        setManifest(settings);
        setDraftManifest(clone(settings));
        showMessage("Settings loaded.");
      })
      .catch((error) => {
        if (canceled) return;
        showMessage(`${error.message}. Using local defaults.`, "error");
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 15000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  const domainTabs = Object.keys(draftManifest.scopes.domains).sort((left, right) =>
    left.localeCompare(right),
  );
  const activeKey = getScopeKey(activeScope);
  const activeDomain =
    activeScope.type === "domain" ? activeScope.id : "";
  const activeSettings =
    activeScope.type === "all_urls"
      ? draftManifest.scopes.allUrls
      : draftManifest.scopes.domains[activeScope.id] ?? draftManifest.scopes.allUrls;

  function updateDraftScope(nextSettings) {
    setDraftManifest((current) => {
      const next = clone(current);
      if (activeScope.type === "all_urls") {
        next.scopes.allUrls = {
          ...nextSettings,
          domain: "",
          pageUrl: "",
        };
      } else {
        const domain = activeScope.id;
        next.scopes.domains[domain] = {
          ...nextSettings,
          domain,
          pageUrl: "",
        };
      }
      return next;
    });
  }

  function updatePageDraft(pageUrl, nextSettings) {
    setDraftManifest((current) => {
      const next = clone(current);
      next.scopes.pages[pageUrl] = {
        ...nextSettings,
        domain: getPageDomain(pageUrl),
        pageUrl,
      };
      return next;
    });
  }

  function addDomain() {
    const raw = window.prompt("Domain", "example.com");
    if (!raw) return;
    const domain = normalizeDomain(raw);
    if (!domain) {
      showMessage("Enter a valid domain.", "error");
      return;
    }

    setDraftManifest((current) => {
      const next = clone(current);
      next.scopes.domains[domain] = {
        ...clone(next.scopes.allUrls),
        domain,
        pageUrl: "",
      };
      return next;
    });
    setActiveScope({ type: "domain", id: domain });
    showMessage(`Domain draft created for ${domain}.`);
  }

  function addPageOverride() {
    if (activeScope.type !== "domain") return;
    const raw = window.prompt("Page URL", `https://${activeScope.id}/pricing`);
    if (!raw) return;
    const pageUrl = normalizePageUrl(raw);
    if (!pageUrl || getPageDomain(pageUrl) !== activeScope.id) {
      showMessage(`Enter a valid page URL on ${activeScope.id}.`, "error");
      return;
    }

    setDraftManifest((current) => {
      const next = clone(current);
      next.scopes.pages[pageUrl] = {
        ...clone(next.scopes.domains[activeScope.id]),
        domain: activeScope.id,
        pageUrl,
      };
      return next;
    });
    showMessage(`Page override draft created for ${pageUrl}.`);
  }

  function deleteDomain(domain) {
    setDraftManifest((current) => {
      const next = clone(current);
      delete next.scopes.domains[domain];

      for (const pageUrl of Object.keys(next.scopes.pages)) {
        if (getPageDomain(pageUrl) === domain) {
          delete next.scopes.pages[pageUrl];
        }
      }

      return next;
    });

    if (activeScope.type === "domain" && activeScope.id === domain) {
      setActiveScope({ type: "all_urls", id: "all_urls" });
    }

    showMessage(`Deleted ${domain} from draft settings.`);
  }

  function deletePageOverride(pageUrl) {
    setDraftManifest((current) => {
      const next = clone(current);
      delete next.scopes.pages[pageUrl];
      return next;
    });
    showMessage(`Deleted page override for ${pageUrl}.`);
  }

  function cancelActiveScope() {
    setDraftManifest((current) => {
      const next = clone(current);
      if (activeScope.type === "all_urls") {
        next.scopes.allUrls = clone(manifest.scopes.allUrls);
        return next;
      }

      const domain = activeScope.id;
      if (manifest.scopes.domains[domain]) {
        next.scopes.domains[domain] = clone(manifest.scopes.domains[domain]);
      } else {
        delete next.scopes.domains[domain];
      }

      for (const pageUrl of Object.keys(next.scopes.pages)) {
        if (getPageDomain(pageUrl) !== domain) continue;
        if (manifest.scopes.pages[pageUrl]) {
          next.scopes.pages[pageUrl] = clone(manifest.scopes.pages[pageUrl]);
        } else {
          delete next.scopes.pages[pageUrl];
        }
      }

      return next;
    });
    showMessage(`Reverted ${activeKey}.`);
  }

  async function saveAllSettings() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draftManifest),
      });

      if (!response.ok) throw new Error("Save failed");
      const payload = await response.json();
      const saved = payload.manifest;
      setManifest(saved);
      setDraftManifest(clone(saved));
      showMessage("Saved all settings and exported settings.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Save failed.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function buildExtension() {
    setIsBuilding(true);
    try {
      const response = await fetch("/api/build-extension", { method: "POST" });
      if (!response.ok) throw new Error("Build failed");
      showMessage("Built web extension.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Build failed.", "error");
    } finally {
      setIsBuilding(false);
    }
  }

  return (
    <main className="admin-shell">
      <aside className="scope-nav" aria-label="Settings scopes">
        <div className="brand">
          <Globe2 size={22} />
          <div>
            <strong>FX Inline Admin</strong>
            <span>Runtime settings</span>
          </div>
        </div>

        <button
          type="button"
          className={activeScope.type === "all_urls" ? "scope-tab active" : "scope-tab"}
          onClick={() => setActiveScope({ type: "all_urls", id: "all_urls" })}
        >
          all_urls
        </button>

        {domainTabs.map((domain) => (
          <div
            key={domain}
            className={activeScope.type === "domain" && activeScope.id === domain
              ? "scope-tab-row active"
              : "scope-tab-row"}
          >
            <button
              type="button"
              className="scope-tab"
              onClick={() => setActiveScope({ type: "domain", id: domain })}
            >
              {domain}
            </button>
            <button
              type="button"
              className="scope-delete"
              aria-label={`Delete ${domain}`}
              onClick={() => deleteDomain(domain)}
            >
              <X size={14} />
            </button>
          </div>
        ))}

        <button type="button" className="add-scope" onClick={addDomain}>
          <Plus size={16} />
          Add domain
        </button>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p>Scope</p>
            <h1>{activeKey}</h1>
          </div>
          <div className="header-actions">
            <button type="button" onClick={cancelActiveScope} disabled={isSaving || isBuilding}>
              <RotateCcw size={16} />
              Cancel
            </button>
            <button type="button" onClick={saveAllSettings} disabled={isSaving || isBuilding}>
              <Save size={16} />
              Save
            </button>
            <button
              type="button"
              className="primary"
              onClick={buildExtension}
              disabled={isSaving || isBuilding}
            >
              <Hammer size={16} />
              {isBuilding ? "Building" : "Build extension"}
            </button>
          </div>
        </header>

        {toast ? (
          <div
            key={toast.id}
            className={toast.tone === "error" ? "toast error" : "toast"}
            role="status"
          >
            <span>{toast.message}</span>
            <span className="toast-countdown" />
          </div>
        ) : null}

        <SettingsForm
          title={activeScope.type === "all_urls" ? "Shared settings" : "Domain settings"}
          settings={activeSettings}
          onChange={updateDraftScope}
          lockDomainFields
        />

        {activeScope.type === "domain" ? (
          <section className="page-overrides">
            <div className="section-bar">
              <div>
                <h2>Page overrides</h2>
                <p>Exact normalized page URLs on {activeDomain} override the domain tab.</p>
              </div>
              <button type="button" onClick={addPageOverride}>
                <Plus size={16} />
                Add page URL
              </button>
            </div>

            {getDomainPages(draftManifest, activeDomain).length ? (
              getDomainPages(draftManifest, activeDomain).map(([pageUrl, settings]) => (
                <SettingsForm
                  key={pageUrl}
                  title={pageUrl}
                  settings={settings}
                  onChange={(nextSettings) => updatePageDraft(pageUrl, nextSettings)}
                  lockDomainFields
                  actions={(
                    <button
                      type="button"
                      className="danger-icon-button"
                      aria-label={`Delete page override ${pageUrl}`}
                      onClick={() => deletePageOverride(pageUrl)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                />
              ))
            ) : (
              <p className="empty-state">No page overrides for this domain.</p>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
