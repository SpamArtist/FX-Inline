import {
  AMAZON_PLUGIN_NAMESPACE,
  AMAZON_STRUCTURED_CANDIDATES_KEY,
  collectAmazonStructuredCandidates,
} from "./shared.js";

export const AMAZON_STRUCTURED_DETECTOR_PRE_PLUGIN_NAME =
  "amazon-structured-detector";

export const amazonStructuredDetectorPrePlugin = {
  name: AMAZON_STRUCTURED_DETECTOR_PRE_PLUGIN_NAME,
  phase: "pre",
  apply({ root, passContext }) {
    const candidates = collectAmazonStructuredCandidates(root);
    passContext.set(
      AMAZON_PLUGIN_NAMESPACE,
      AMAZON_STRUCTURED_CANDIDATES_KEY,
      candidates,
    );
    return 0;
  },
};
