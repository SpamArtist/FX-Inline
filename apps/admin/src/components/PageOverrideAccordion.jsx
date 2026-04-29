import { ChevronDown, Trash2 } from "lucide-preact";
import SettingsForm from "./SettingsForm";

export default function PageOverrideAccordion({
  pageUrl,
  settings,
  onChange,
  onDelete,
}) {
  return (
    <details className="page-accordion">
      <summary className="page-accordion-summary">
        <ChevronDown className="page-accordion-icon" size={18} aria-hidden="true" />
        <span className="page-accordion-title">{pageUrl}</span>
        <span className="page-accordion-meta">
          <span className={settings.enabled ? "page-accordion-state on" : "page-accordion-state"}>
            {settings.enabled ? "On" : "Off"}
          </span>
          <button
            type="button"
            className="danger-icon-button"
            aria-label={`Delete page override ${pageUrl}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={15} />
          </button>
        </span>
      </summary>
      <SettingsForm
        title="Page settings"
        settings={settings}
        onChange={onChange}
        lockDomainFields
      />
    </details>
  );
}
