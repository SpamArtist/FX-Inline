import { assertSha256Integrity } from "./crypto.js";
import {
  isLocationAllowed,
  verifyManifestEnvelope,
} from "./manifest.js";
import { createRateService } from "./rates.js";
import { createRuntimeEngine } from "./engine.js";
import { mergeUiSettings } from "./settings.js";

const GLOBAL_RUNTIME_KEY = "FXInlineRuntime";

// Demo verification key; production should rotate keys and avoid long-lived static keys.
export const DEFAULT_MANIFEST_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqHsDxkGePlzpiPrdh2mQ
pPTXi2qHLhcfZgt5TTSjoN3R8hxDAEBAwywh2nLJRT5DfpSOzZC4POkK+YHOMJ+8
B4/A5jjq8+BdDAqUjEZgNKqslohYftMtv7RTZzi1IxjeGwjw/J7QMwDrCimfs4eb
Ogd0ei+bJcJS/72oOCWbA+NnsLPhKlIu7xx2STstFzxFzav4EcN+95Q01VjKW8F7
MUiHcxqky4aeIrB44UFQL2TH3dk2FOWw6YfVK+tN02v0r0pUGHnysoWHsDN8Dpzq
buSYci/h/+iAru9wm8oJtwsatwuwc6QAo1FGkJMhGIVY1iK62gs9OtNppmnMFgyr
NQIDAQAB
-----END PUBLIC KEY-----`;

function getRuntimeRegistry() {
  if (!isBrowserRuntime()) {
    return {
      instances: new Map(),
      updateSettings: () => {
        throw new Error("Runtime manager is only available in browser context");
      },
    };
  }

  const existing = window[GLOBAL_RUNTIME_KEY];
  if (existing) {
    return existing;
  }

  const manager = {
    instances: new Map(),
    updateSettings(clientId, settings) {
      const instance = manager.instances.get(clientId);
      if (!instance) {
        throw new Error(`No runtime instance found for client ${clientId}`);
      }

      instance.updateSettings(settings);
    },
    destroy(clientId) {
      const instance = manager.instances.get(clientId);
      instance?.destroy();
      manager.instances.delete(clientId);
    },
  };

  window[GLOBAL_RUNTIME_KEY] = manager;
  return manager;
}

function isBrowserRuntime() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
}

async function fetchText(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function loadVerifiedModule({ url, integrity, fetchImpl }) {
  const sourceCode = await fetchText(url, fetchImpl);
  await assertSha256Integrity(sourceCode, integrity);

  const blob = new Blob([sourceCode], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    return await import(/* @vite-ignore */ blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function resolveScriptTag(script) {
  if (script instanceof HTMLScriptElement) {
    return script;
  }

  if (document.currentScript instanceof HTMLScriptElement) {
    return document.currentScript;
  }

  return document.querySelector("script[data-fxi-client-id]");
}

function getRequiredDataAttribute(script, name) {
  const value = script.dataset[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required data attribute data-${name}`);
  }

  return value.trim();
}

function parseDebugFlag(script) {
  return script.dataset.fxiDebug === "true";
}

function getManifestUrl(script, clientId) {
  if (script.dataset.fxiManifestUrl?.trim()) {
    return script.dataset.fxiManifestUrl.trim();
  }

  return `/b2b/manifests/${clientId}.signed.json`;
}

async function loadOptionalSettings(settingsBlock, fetchImpl) {
  if (!settingsBlock) {
    return null;
  }

  if (!settingsBlock.integrity) {
    return fetchJson(settingsBlock.url, fetchImpl);
  }

  const raw = await fetchText(settingsBlock.url, fetchImpl);
  await assertSha256Integrity(raw, settingsBlock.integrity);
  return JSON.parse(raw);
}

function assertManifestClientId(scriptClientId, manifestClientId) {
  if (scriptClientId !== manifestClientId) {
    throw new Error(
      `Manifest clientId mismatch: expected ${scriptClientId}, received ${manifestClientId}`,
    );
  }
}

function getLoaderConfig(script, overrides) {
  const clientId = getRequiredDataAttribute(script, "fxiClientId");

  return {
    clientId,
    manifestUrl: getManifestUrl(script, clientId),
    preferredCurrencyOverride: script.dataset.fxiTargetCurrency?.trim() || null,
    publicKeyPem:
      overrides.publicKeyPem ||
      script.dataset.fxiManifestPublicKeyPem ||
      DEFAULT_MANIFEST_PUBLIC_KEY_PEM,
    debug: parseDebugFlag(script),
  };
}

export async function startRuntimeFromScriptTag({
  script,
  fetchImpl,
  publicKeyPem,
} = {}) {
  if (!isBrowserRuntime()) {
    throw new Error("Runtime loader requires a browser environment");
  }

  const resolvedScript = resolveScriptTag(script);
  if (!resolvedScript) {
    throw new Error("No runtime script tag found");
  }

  const config = getLoaderConfig(resolvedScript, { publicKeyPem });
  const manifestEnvelope = await fetchJson(config.manifestUrl, fetchImpl);
  const manifest = await verifyManifestEnvelope(manifestEnvelope, {
    publicKeyPem: config.publicKeyPem,
  });

  assertManifestClientId(config.clientId, manifest.clientId);

  if (!isLocationAllowed(window.location, manifest)) {
    if (config.debug) {
      console.info(`[fxi] skipped runtime on disallowed path ${window.location.pathname}`);
    }
    return null;
  }

  if (manifest.flags?.killSwitch) {
    if (config.debug) {
      console.warn("[fxi] runtime disabled by manifest kill switch");
    }
    return null;
  }

  const [prePluginModule, postPluginModule] = await Promise.all([
    loadVerifiedModule({
      url: manifest.plugins.pre.url,
      integrity: manifest.plugins.pre.integrity,
      fetchImpl,
    }),
    loadVerifiedModule({
      url: manifest.plugins.post.url,
      integrity: manifest.plugins.post.integrity,
      fetchImpl,
    }),
  ]);

  if (!prePluginModule?.default || !postPluginModule?.default) {
    throw new Error("Plugins must expose default exports");
  }

  const remoteSettings = await loadOptionalSettings(manifest.settings, fetchImpl);
  const runtimeSettings = mergeUiSettings({
    manifestDefaults: manifest.uiDefaults,
    remoteSettings,
  });

  if (
    config.preferredCurrencyOverride &&
    !/^[A-Z]{3}$/u.test(config.preferredCurrencyOverride.toUpperCase())
  ) {
    throw new Error("data-fxi-target-currency must be a 3-letter uppercase code");
  }

  const effectiveManifest = config.preferredCurrencyOverride
    ? {
      ...manifest,
      preferredCurrency: config.preferredCurrencyOverride.toUpperCase(),
    }
    : manifest;

  const runtimeEngine = createRuntimeEngine({
    manifest: effectiveManifest,
    prePlugin: prePluginModule.default,
    postPlugin: postPluginModule.default,
    uiSettings: runtimeSettings,
    rateService: createRateService({ fetchImpl }),
  });

  await runtimeEngine.start();

  const manager = getRuntimeRegistry();
  manager.instances.set(config.clientId, runtimeEngine);

  if (config.debug) {
    console.info(`[fxi] runtime started for ${config.clientId}`);
  }

  return runtimeEngine;
}

export function getRuntimeManager() {
  return getRuntimeRegistry();
}
