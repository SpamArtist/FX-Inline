import { GlobeIcon, PlusIcon, XIcon } from "./icons/NativeIcons";

export default function ScopeNav({
  activeScope,
  domainTabs,
  onSelectAllUrls,
  onSelectDomain,
  onAddDomain,
  onDeleteDomain,
}) {
  return (
    <aside className="scope-nav" aria-label="Settings scopes">
      <div className="brand">
        <GlobeIcon size={22} />
        <div>
          <strong>FX Inline Admin</strong>
          <span>Runtime settings</span>
        </div>
      </div>

      <button
        type="button"
        className={activeScope.type === "all_urls" ? "scope-tab active" : "scope-tab"}
        onClick={onSelectAllUrls}
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
            onClick={() => onSelectDomain(domain)}
          >
            {domain}
          </button>
          <button
            type="button"
            className="scope-delete"
            aria-label={`Delete ${domain}`}
            onClick={() => onDeleteDomain(domain)}
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}

      <button type="button" className="add-scope" onClick={onAddDomain}>
        <PlusIcon size={16} />
        Add domain
      </button>
    </aside>
  );
}
