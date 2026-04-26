import {
  LITTLE_HOTELIER_PLUGIN_NAMESPACE,
  LITTLE_HOTELIER_PRICING_CANDIDATES_KEY,
  collectLittleHotelierPricingCandidates,
} from "./shared.js";

export const LITTLE_HOTELIER_PRICING_DETECTOR_PRE_PLUGIN_NAME =
  "littlehotelier-pricing-detector";

export const littleHotelierPricingDetectorPrePlugin = {
  name: LITTLE_HOTELIER_PRICING_DETECTOR_PRE_PLUGIN_NAME,
  phase: "pre",
  apply({ root, passContext }) {
    const candidates = collectLittleHotelierPricingCandidates(root);
    passContext.set(
      LITTLE_HOTELIER_PLUGIN_NAMESPACE,
      LITTLE_HOTELIER_PRICING_CANDIDATES_KEY,
      candidates,
    );
    return 0;
  },
};
