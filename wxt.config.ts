import path from "path";
import type { OutputOptions } from "rollup";
import type { InlineConfig, PluginOption } from "vite";
import vitePluginSvgr from "vite-plugin-svgr";
import type { Entrypoint, EntrypointGroup } from "wxt";
import { defineConfig } from "wxt";
import { resolveReleaseTag } from "./scripts/release/versioning.mjs";

const releaseTag = process.env.RELEASE_TAG?.trim();
const releaseManifestOverrides = releaseTag
  ? (() => {
    const release = resolveReleaseTag(releaseTag);
    return {
      version: release.manifestVersion,
      version_name: release.displayVersion,
    };
  })()
  : null;

interface SourceReplacement {
  readonly label: string;
  readonly from: string;
  readonly expectedCount: number;
  readonly to: string;
}

const reactDomClientProductionModule = "/react-dom/cjs/react-dom-client.production.js";
const reactDomFirefoxReviewReplacements: readonly SourceReplacement[] = [
  {
    label: "script element template",
    from: `nextResource = ownerDocument.createElement("div");
                  nextResource.innerHTML = "<script>\\x3c/script>";
                  nextResource = nextResource.removeChild(
                    nextResource.firstChild
                  );`,
    expectedCount: 1,
    to: `nextResource = ownerDocument.createElement("script");`,
  },
  {
    label: "host dangerouslySetInnerHTML sink",
    from: "domElement.innerHTML = key;",
    expectedCount: 2,
    to: "domElement.textContent = key;",
  },
];

function isHtmlEntrypointGroup(group: EntrypointGroup): group is Entrypoint[] {
  return Array.isArray(group) && group.some((entry) => entry.inputPath.endsWith(".html"));
}

function splitHtmlEntrypointGroups(groups: EntrypointGroup[]) {
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];

    if (!isHtmlEntrypointGroup(group) || group.length <= 1) {
      continue;
    }

    const splitGroups = group.map((entry) => [entry]);
    groups.splice(index, 1, ...splitGroups);
    index += splitGroups.length - 1;
  }
}

function setIifeOutputFormat(viteConfig: InlineConfig) {
  viteConfig.build ??= {};
  viteConfig.build.rollupOptions ??= {};

  const rollupOptions = viteConfig.build.rollupOptions;
  const outputOptions = rollupOptions.output;

  if (Array.isArray(outputOptions)) {
    rollupOptions.output = outputOptions.map((output) => ({
      ...output,
      format: "iife",
    }));
    return;
  }

  rollupOptions.output = {
    ...((outputOptions ?? {}) as OutputOptions),
    format: "iife",
  };
}

function replaceReactDomSource(code: string, id: string) {
  let patchedCode = code;

  for (const replacement of reactDomFirefoxReviewReplacements) {
    const sourceParts = patchedCode.split(replacement.from);
    const replacementCount = sourceParts.length - 1;

    if (replacementCount !== replacement.expectedCount) {
      throw new Error(
        `[fx-inline] React DOM source changed before applying Firefox HTML hardening: ${replacement.label} expected ${replacement.expectedCount} matches but found ${replacementCount} in ${id}.`,
      );
    }

    patchedCode = sourceParts.join(replacement.to);
  }

  return patchedCode;
}

function hardenReactDomForFirefoxReview(): PluginOption {
  return {
    name: "harden-react-dom-firefox-review",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.split(path.sep).join("/");
      const [normalizedFilePath] = normalizedId.split("?");

      if (
        normalizedFilePath.startsWith("\0") ||
        !normalizedFilePath.endsWith(reactDomClientProductionModule)
      ) {
        return null;
      }

      return {
        code: replaceReactDomSource(code, id),
        map: null,
      };
    },
  };
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "apps/extension",
  publicDir: "apps/extension/public",
  modules: ["@wxt-dev/module-react"],
  manifest: ({ mode }) => {
    const productionConnectSrc =
      "'self' https://open.er-api.com https://api.exchangerate-api.com";
    const devOnlyConnectSrc =
      " http://127.0.0.1:3000 http://localhost:3000 ws://127.0.0.1:3000 ws://localhost:3000";
    const connectSrc =
      mode === "development"
        ? productionConnectSrc + devOnlyConnectSrc
        : productionConnectSrc;

    return {
      ...(releaseManifestOverrides ?? {}),
      icons: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "96": "icon/96.png",
        "128": "icon/128.png",
      },
      action: {
        default_icon: {
          "16": "icon/16.png",
          "32": "icon/32.png",
          "48": "icon/48.png",
        },
      },
      permissions: ["storage", "alarms", "activeTab"],
      host_permissions: [
        "https://open.er-api.com/*",
        "https://api.exchangerate-api.com/*",
      ],
      content_security_policy: {
        extension_pages: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; connect-src ${connectSrc}`,
      },
      browser_specific_settings: {
        gecko: {
          id: "fx-inline@xbotpc",
          // @ts-ignore - WXT doesn't support this field yet
          data_collection_permissions: {
            required: ["none"],
          },
        },
      },
    };
  },
  hooks: {
    "entrypoints:grouped": (wxt, groups) => {
      if (wxt.config.browser !== "firefox") {
        return;
      }

      splitHtmlEntrypointGroups(groups);
    },
    "vite:build:extendConfig": (entrypoints, viteConfig) => {
      if (
        entrypoints.length === 1 &&
        entrypoints.some((entrypoint) => entrypoint.inputPath.endsWith(".html"))
      ) {
        setIifeOutputFormat(viteConfig);
      }
    },
  },
  vite: (env) => ({
    plugins: [
      vitePluginSvgr({
        svgrOptions: {
          // svgr options
          exportType: "default",
          ref: true,
          svgo: false,
          titleProp: true,
        },
        include: "**/*.svg",
      }),
      env.browser === "firefox" ? hardenReactDomForFirefoxReview() : null,
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./apps/extension"),
      },
    },
  }),
});
