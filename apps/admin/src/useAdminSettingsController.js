import { useCallback, useEffect, useState } from "preact/hooks";
import { DEFAULT_MANIFEST } from "./settingsConstants";
import {
  clone,
  getDomainPages,
  getPageDomain,
  getScopeKey,
  normalizeDomain,
  normalizePageUrl,
} from "./settingsModel";

export default function useAdminSettingsController() {
  const [manifest, setManifest] = useState(DEFAULT_MANIFEST);
  const [draftManifest, setDraftManifest] = useState(DEFAULT_MANIFEST);
  const [activeScope, setActiveScope] = useState({ type: "all_urls", id: "all_urls" });
  const [toast, setToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);

  const showMessage = useCallback((message, tone = "info") => {
    setToast({
      id: `${Date.now()}-${message}`,
      message,
      tone,
    });
  }, []);

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
  }, [showMessage]);

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
  const activeDomain = activeScope.type === "domain" ? activeScope.id : "";
  const activeSettings =
    activeScope.type === "all_urls"
      ? draftManifest.scopes.allUrls
      : draftManifest.scopes.domains[activeScope.id] ?? draftManifest.scopes.allUrls;
  const domainPages = activeScope.type === "domain"
    ? getDomainPages(draftManifest, activeDomain)
    : [];

  function selectAllUrls() {
    setActiveScope({ type: "all_urls", id: "all_urls" });
  }

  function selectDomain(domain) {
    setActiveScope({ type: "domain", id: domain });
  }

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
      selectAllUrls();
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

  return {
    activeDomain,
    activeKey,
    activeScope,
    activeSettings,
    addDomain,
    addPageOverride,
    buildExtension,
    cancelActiveScope,
    deleteDomain,
    deletePageOverride,
    domainPages,
    domainTabs,
    isBuilding,
    isSaving,
    saveAllSettings,
    selectAllUrls,
    selectDomain,
    toast,
    updateDraftScope,
    updatePageDraft,
  };
}
