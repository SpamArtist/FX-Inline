import { ChevronDownIcon, TrashIcon } from "./icons/NativeIcons";
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
        <ChevronDownIcon className="page-accordion-icon" size={18} aria-hidden="true" />
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
            <TrashIcon size={15} />
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
