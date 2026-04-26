import {
  littleHotelierPricingDetectorPrePlugin,
  littleHotelierPricingRendererPostPlugin,
} from "@fx-inline/inline-runtime";
import type { InlineRuntimeOptions } from "@fx-inline/inline-runtime";

type ContentRuntimeSitePluginOptions = Pick<
  InlineRuntimeOptions,
  "prePlugins" | "postPlugins"
>;

type SitePluginRegistration = {
  id: string;
  matches: (url: URL) => boolean;
} & ContentRuntimeSitePluginOptions;

const LITTLE_HOTELIER_PRICING_HOSTNAME = "www.littlehotelier.com";
const LITTLE_HOTELIER_PRICING_PATHS = new Set([
  "/pricing",
  "/de/preise",
  "/es/precios",
  "/it/prezzi",
  "/th/pricing",
  "/id/pricing",
]);

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

const SITE_PLUGIN_REGISTRY: SitePluginRegistration[] = [
  {
    id: "littlehotelier-pricing",
    matches: isLittleHotelierPricingPage,
    prePlugins: [littleHotelierPricingDetectorPrePlugin],
    postPlugins: [littleHotelierPricingRendererPostPlugin],
  },
];

export function getContentRuntimeSitePluginOptions(
  pageUrl: string,
): ContentRuntimeSitePluginOptions {
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

  return {
    prePlugins: matchedRegistrations.flatMap(
      (registration) => registration.prePlugins ?? [],
    ),
    postPlugins: matchedRegistrations.flatMap(
      (registration) => registration.postPlugins ?? [],
    ),
  };
}
