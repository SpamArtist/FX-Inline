import { nowMs } from "../utils/time.js";
import { sanitizeUiSettings } from "./settings.js";
import type {
  ClientRecord,
  DatabaseApi,
  EnvConfig,
  PluginArtifactRecord,
  PluginKind,
  RuntimeManifest,
  RuntimeService,
  SettingsVersionRecord,
  SigningService,
  UiSettingsInput,
} from "../types.js";

export function createRuntimeService({
  database,
  signingService,
  env,
}: {
  database: DatabaseApi;
  signingService: SigningService;
  env: EnvConfig;
}): RuntimeService {
  function buildRuntimeManifest({
    client,
    settingsVersion,
    prePlugin,
    postPlugin,
  }: {
    client: ClientRecord;
    settingsVersion: SettingsVersionRecord;
    prePlugin: PluginArtifactRecord;
    postPlugin: PluginArtifactRecord;
  }): RuntimeManifest {
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

  async function getSignedManifestForClient(clientId: string) {
    const client = await database.findClientById(clientId);
    if (!client) {
      return null;
    }

    const settingsVersion = await database.getLatestSettingsVersion(client.id);
    if (!settingsVersion) {
      throw new Error("Missing client settings version");
    }

    const prePlugin = await database.getLatestPluginArtifact({
      clientId: client.id,
      kind: "pre",
    });
    const postPlugin = await database.getLatestPluginArtifact({
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

    await database.createManifestVersion({
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

  async function getRuntimeSettings(clientId: string) {
    const settingsVersion = await database.getLatestSettingsVersion(clientId);
    if (!settingsVersion) {
      return null;
    }

    return {
      version: settingsVersion.version,
      settings: sanitizeUiSettings(settingsVersion.settings),
      updatedAt: settingsVersion.createdAt,
    };
  }

  async function updateClientSettings({
    clientId,
    settings,
    userId,
  }: {
    clientId: string;
    settings: UiSettingsInput;
    userId: string;
  }) {
    const sanitized = sanitizeUiSettings(settings);

    const version = await database.createSettingsVersion({
      clientId,
      settings: sanitized,
      createdByUserId: userId,
    });

    await database.createAuditEvent({
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

  async function publishPluginArtifact({
    clientId,
    kind,
    artifactUrl,
    integrity,
    userId,
  }: {
    clientId: string;
    kind: PluginKind;
    artifactUrl: string;
    integrity: string;
    userId: string;
  }) {
    if (kind !== "pre" && kind !== "post") {
      throw new Error("Plugin kind must be pre or post");
    }

    const artifact = await database.createPluginArtifact({
      clientId,
      kind,
      artifactUrl,
      integrity,
      createdByUserId: userId,
      status: "approved",
    });

    await database.createAuditEvent({
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

  function getInstallSnippet({ clientId }: { clientId: string }): string {
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
