import { Globe2, Plus, X } from "lucide-preact";

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
        <Globe2 size={22} />
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
            <X size={14} />
          </button>
        </div>
      ))}

      <button type="button" className="add-scope" onClick={onAddDomain}>
        <Plus size={16} />
        Add domain
      </button>
    </aside>
  );
}
