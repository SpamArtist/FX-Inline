import { useMemo } from "react";
import currencies from "../../../extension/assets/currency.json";
import {
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
                      {getDisplayStylePreview(style.value, activeTargetCurrency)}
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
