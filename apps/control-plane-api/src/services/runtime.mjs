import { nowMs } from "../utils/time.mjs";
import { sanitizeUiSettings } from "./settings.mjs";

export function createRuntimeService({ database, signingService, env }) {
  function buildRuntimeManifest({ client, settingsVersion, prePlugin, postPlugin }) {
    const issuedAt = nowMs();
    const expiresAt = issuedAt + 5 * 60 * 1000;

    const settingsUrl = new URL(
      `/api/v1/runtime/${client.id}/settings?version=${settingsVersion.version}`,
      env.publicOrigin,
    ).toString();

    return {
      schemaVersion: 1,
      clientId: client.id,
      allowedOrigins: client.allowedOrigins,
      allowedPathRegex: client.allowedPaths,
      preferredCurrency: client.preferredCurrency,
      parserConfig: {
        extraWords: {
          credits: "USD",
        },
      },
      plugins: {
        pre: {
          url: prePlugin.artifactUrl,
          integrity: prePlugin.integrity,
        },
        post: {
          url: postPlugin.artifactUrl,
          integrity: postPlugin.integrity,
        },
      },
      settings: {
        url: settingsUrl,
      },
      uiDefaults: sanitizeUiSettings(settingsVersion.settings),
      flags: {
        killSwitch: false,
      },
      issuedAt,
      expiresAt,
      kid: signingService.getKeyMetadata().keyId,
    };
  }

  function getSignedManifestForClient(clientId) {
    const client = database.findClientById(clientId);
    if (!client) {
      return null;
    }

    const settingsVersion = database.getLatestSettingsVersion(client.id);
    if (!settingsVersion) {
      throw new Error("Missing client settings version");
    }

    const prePlugin = database.getLatestPluginArtifact({
      clientId: client.id,
      kind: "pre",
    });
    const postPlugin = database.getLatestPluginArtifact({
      clientId: client.id,
      kind: "post",
    });

    if (!prePlugin || !postPlugin) {
      throw new Error("Missing approved pre/post plugins for client");
    }

    const manifest = buildRuntimeManifest({
      client,
      settingsVersion,
      prePlugin,
      postPlugin,
    });

    const { signature, keyId } = signingService.signManifest(manifest);

    database.createManifestVersion({
      clientId: client.id,
      manifest,
      signature,
      keyId,
    });

    return {
      manifest,
      signature,
      keyId,
      publicKeyPem: signingService.getPublicKeyPem(),
      settingsVersion,
    };
  }

  function getRuntimeSettings(clientId) {
    const settingsVersion = database.getLatestSettingsVersion(clientId);
    if (!settingsVersion) {
      return null;
    }

    return {
      version: settingsVersion.version,
      settings: sanitizeUiSettings(settingsVersion.settings),
      updatedAt: settingsVersion.createdAt,
    };
  }

  function updateClientSettings({ clientId, settings, userId }) {
    const sanitized = sanitizeUiSettings(settings);

    const version = database.createSettingsVersion({
      clientId,
      settings: sanitized,
      createdByUserId: userId,
    });

    database.createAuditEvent({
      clientId,
      userId,
      eventType: "settings.update",
      payload: {
        version: version.version,
      },
    });

    return {
      version: version.version,
      settings: sanitized,
      updatedAt: version.createdAt,
    };
  }

  function publishPluginArtifact({ clientId, kind, artifactUrl, integrity, userId }) {
    if (kind !== "pre" && kind !== "post") {
      throw new Error("Plugin kind must be pre or post");
    }

    const artifact = database.createPluginArtifact({
      clientId,
      kind,
      artifactUrl,
      integrity,
      createdByUserId: userId,
      status: "approved",
    });

    database.createAuditEvent({
      clientId,
      userId,
      eventType: "plugin.publish",
      payload: {
        kind,
        version: artifact.version,
      },
    });

    return artifact;
  }

  function getInstallSnippet({ clientId }) {
    const manifestUrl = new URL(`/api/v1/runtime/${clientId}/manifest`, env.publicOrigin).toString();
    const publicKeyPem = signingService
      .getPublicKeyPem()
      .trim()
      .replace(/\n/gu, "\\n");

    return `<script\n  type=\"module\"\n  src=\"${env.runtimeLoaderUrl}\"\n  data-fxi-client-id=\"${clientId}\"\n  data-fxi-manifest-url=\"${manifestUrl}\"\n  data-fxi-manifest-public-key-pem=\"${publicKeyPem}\"\n  defer\n></script>`;
  }

  return {
    getSignedManifestForClient,
    getRuntimeSettings,
    updateClientSettings,
    publishPluginArtifact,
    getInstallSnippet,
    getSigningMetadata() {
      const metadata = signingService.getKeyMetadata();
      return {
        keyId: metadata.keyId,
        publicKeyPem: metadata.publicKeyPem,
      };
    },
  };
}
