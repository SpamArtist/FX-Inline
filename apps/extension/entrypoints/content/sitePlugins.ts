import {
  littleHotelierPricingDetectorPrePlugin,
  littleHotelierPricingRendererPostPlugin,
} from "@fx-inline/inline-runtime/extension";
import type {
  ContentRuntimeSiteOptions,
  ContentRuntimeSiteRegistration,
  ContentRuntimeSiteRenderPreferences,
} from "./content.types";

const LITTLE_HOTELIER_PRICING_HOSTNAME = "www.littlehotelier.com";
const LITTLE_HOTELIER_PRICING_PATHS = new Set([
  "/pricing",
  "/de/preise",
  "/es/precios",
  "/it/prezzi",
  "/th/pricing",
  "/id/pricing",
]);
const AMAZON_HOSTNAME_PATTERN =
  /^(?:www\.|smile\.)?amazon\.(?:com|co\.uk|de|fr|it|es|ca|com\.au|co\.jp|in|nl|se|pl|sg|ae|sa|com\.mx|com\.br|com\.tr|eg|be)$/u;
const AMAZON_SITE_RENDER_KEY = "amazon";

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/u, "") || "/";
}

export function isLittleHotelierPricingPage(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    url.hostname === LITTLE_HOTELIER_PRICING_HOSTNAME &&
    LITTLE_HOTELIER_PRICING_PATHS.has(normalizePath(url.pathname))
  );
}

export function isAmazonShoppingPage(url: URL): boolean {
  return url.protocol === "https:" && AMAZON_HOSTNAME_PATTERN.test(url.hostname);
}

const SITE_PLUGIN_REGISTRY: ContentRuntimeSiteRegistration[] = [
  {
    id: "amazon-structured-prices",
    matches: isAmazonShoppingPage,
    clientRenderPreferences: {
      sites: {
        [AMAZON_SITE_RENDER_KEY]: {
          convertedPrefix: "\u2248 ",
          wrapperClassName: "fx-inline-site-amazon-addon",
          convertedAmountClassName: "fx-inline-site-amazon-amount",
          colorStrategy: "inherit",
        },
      },
    },
  },
  {
    id: "littlehotelier-pricing",
    matches: isLittleHotelierPricingPage,
    prePlugins: [littleHotelierPricingDetectorPrePlugin],
    postPlugins: [littleHotelierPricingRendererPostPlugin],
  },
];

function mergeSiteRenderPreferences(
  sitePreferences: ContentRuntimeSiteRenderPreferences | undefined,
  userPreferences: ContentRuntimeSiteRenderPreferences | undefined,
): ContentRuntimeSiteRenderPreferences | undefined {
  if (!sitePreferences) return userPreferences;
  if (!userPreferences) return sitePreferences;

  const mergedPreferences: ContentRuntimeSiteRenderPreferences = {
    ...sitePreferences,
  };

  for (const [siteKey, preferences] of Object.entries(userPreferences)) {
    mergedPreferences[siteKey] = {
      ...(mergedPreferences[siteKey] ?? {}),
      ...preferences,
    };
  }

  return mergedPreferences;
}

export function mergeContentRuntimeClientRenderPreferences(
  userPreferences: ContentRuntimeSiteOptions["clientRenderPreferences"],
  sitePreferences: ContentRuntimeSiteOptions["clientRenderPreferences"],
): ContentRuntimeSiteOptions["clientRenderPreferences"] {
  if (!sitePreferences) return userPreferences;
  if (!userPreferences) return sitePreferences;

  return {
    default: {
      ...(sitePreferences.default ?? {}),
      ...(userPreferences.default ?? {}),
    },
    sites: mergeSiteRenderPreferences(
      sitePreferences.sites,
      userPreferences.sites,
    ),
  };
}

export function getContentRuntimeSitePluginOptions(
  pageUrl: string,
): ContentRuntimeSiteOptions {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(pageUrl);
  } catch {
    return {};
  }

  const matchedRegistrations = SITE_PLUGIN_REGISTRY.filter((registration) =>
    registration.matches(parsedUrl),
  );
  if (!matchedRegistrations.length) return {};

  const prePlugins = matchedRegistrations.flatMap(
    (registration) => registration.prePlugins ?? [],
  );
  const postPlugins = matchedRegistrations.flatMap(
    (registration) => registration.postPlugins ?? [],
  );
  const clientRenderPreferences = matchedRegistrations.reduce<
    ContentRuntimeSiteOptions["clientRenderPreferences"]
  >(
    (preferences, registration) =>
      mergeContentRuntimeClientRenderPreferences(
        preferences,
        registration.clientRenderPreferences,
      ),
    undefined,
  );
  const options: ContentRuntimeSiteOptions = {};

  if (prePlugins.length) options.prePlugins = prePlugins;
  if (postPlugins.length) options.postPlugins = postPlugins;
  if (clientRenderPreferences) {
    options.clientRenderPreferences = clientRenderPreferences;
  }

  return options;
}
