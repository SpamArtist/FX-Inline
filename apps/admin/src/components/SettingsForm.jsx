import { useMemo } from "react";
import { Highlighter, Type } from "lucide-react";
import currencies from "../../../extension/assets/currency.json";
import {
  DEFAULT_SETTINGS,
  DISPLAY_STYLE_OPTIONS,
  POSITION_OPTIONS,
  getDisplayStylePreview,
} from "../settingsConstants";
import { normalizeDomain, normalizePageUrl } from "../settingsModel";
import CurrencySearchDropdown from "./CurrencySearchDropdown";

export default function SettingsForm({
  settings,
  onChange,
  title,
  lockDomainFields = false,
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
  const activeHighlightColor = settings.highlightColor ?? DEFAULT_SETTINGS.highlightColor;
  const activeFontColor = settings.fontColor ?? DEFAULT_SETTINGS.fontColor;
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
              const previewStyle = {
                "--preview-font-color": activeFontColor,
                ...(style.value === "highlightColor"
                  ? { "--preview-highlight-color": activeHighlightColor }
                  : {}),
              };
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
                      style={previewStyle}
                    >
                      {getDisplayStylePreview(style.value, activeTargetCurrency)}
                    </span>
                  </button>
                  {style.value === "highlightColor" ? (
                    <div
                      className="display-style-color-controls"
                      aria-label="Highlight style colors"
                    >
                      <label className="color-picker-control">
                        <Highlighter aria-hidden="true" size={14} strokeWidth={2.2} />
                        <input
                          className="display-color-picker highlight-color-picker"
                          type="color"
                          value={activeHighlightColor}
                          disabled={isTooltip}
                          aria-label="Highlight color"
                          onChange={(event) =>
                            update({
                              displayStyle: "highlightColor",
                              highlightColor: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="color-picker-control">
                        <Type aria-hidden="true" size={14} strokeWidth={2.2} />
                        <input
                          className="display-color-picker font-color-picker"
                          type="color"
                          value={activeFontColor}
                          disabled={isTooltip}
                          aria-label="Font color"
                          onChange={(event) =>
                            update({
                              displayStyle: "highlightColor",
                              fontColor: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
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
