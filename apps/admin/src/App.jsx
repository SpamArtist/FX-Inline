import { Plus } from "lucide-react";
import PageOverrideAccordion from "./components/PageOverrideAccordion";
import ScopeNav from "./components/ScopeNav";
import SettingsForm from "./components/SettingsForm";
import ToastMessage from "./components/ToastMessage";
import WorkspaceHeader from "./components/WorkspaceHeader";
import useAdminSettingsController from "./useAdminSettingsController";

export default function App() {
  const admin = useAdminSettingsController();

  return (
    <main className="admin-shell">
      <ScopeNav
        activeScope={admin.activeScope}
        domainTabs={admin.domainTabs}
        onSelectAllUrls={admin.selectAllUrls}
        onSelectDomain={admin.selectDomain}
        onAddDomain={admin.addDomain}
        onDeleteDomain={admin.deleteDomain}
      />

      <section className="workspace">
        <WorkspaceHeader
          activeKey={admin.activeKey}
          isSaving={admin.isSaving}
          onCancel={admin.cancelActiveScope}
          onSave={admin.saveAllSettings}
        />

        <ToastMessage toast={admin.toast} />

        <SettingsForm
          title={admin.activeScope.type === "all_urls" ? "Shared settings" : "Domain settings"}
          settings={admin.activeSettings}
          onChange={admin.updateDraftScope}
          lockDomainFields
        />

        {admin.activeScope.type === "domain" ? (
          <section className="page-overrides">
            <div className="section-bar">
              <div>
                <h2>Page overrides</h2>
                <p>Exact normalized page URLs on {admin.activeDomain} override the domain tab.</p>
              </div>
              <button type="button" onClick={admin.addPageOverride}>
                <Plus size={16} />
                Add page URL
              </button>
            </div>

            {admin.domainPages.length ? (
              admin.domainPages.map(([pageUrl, settings]) => (
                <PageOverrideAccordion
                  key={pageUrl}
                  pageUrl={pageUrl}
                  settings={settings}
                  onChange={(nextSettings) => admin.updatePageDraft(pageUrl, nextSettings)}
                  onDelete={() => admin.deletePageOverride(pageUrl)}
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
