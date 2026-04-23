export const CORE_METADATA_NAMESPACE = "core";
export const CORE_METADATA_CONVERSION_EVENTS_KEY = "conversion-events";
export const CORE_METADATA_SUMMARY_KEY = "summary";

function withPassId(passId, payload) {
  return {
    passId,
    ...payload,
  };
}

export function pushCoreConversionEvent(passContext, passId, payload) {
  passContext?.push(
    CORE_METADATA_NAMESPACE,
    CORE_METADATA_CONVERSION_EVENTS_KEY,
    withPassId(passId, payload),
  );
}

export function setCoreConversionSummary(passContext, passId, payload) {
  passContext?.set(
    CORE_METADATA_NAMESPACE,
    CORE_METADATA_SUMMARY_KEY,
    withPassId(passId, payload),
  );
}
