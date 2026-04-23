import { decorateStructuredAmazonPrices } from "./amazon/structuredDecorator.js";

export const AMAZON_STRUCTURED_ADDON_PLUGIN_NAME = "amazon-structured-addon";

export const amazonStructuredAddonPlugin = {
  name: AMAZON_STRUCTURED_ADDON_PLUGIN_NAME,
  apply({
    root,
    preferredCurrency,
    rateSnapshot,
    localeHint,
    lightTextCache,
  }) {
    return decorateStructuredAmazonPrices(
      root,
      preferredCurrency,
      rateSnapshot,
      localeHint,
      lightTextCache,
    );
  },
};
