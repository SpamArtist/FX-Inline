export type CurrencyCodeLike = string;

export type RateSnapshotLike = {
  base?: string;
  fetchedAt?: number;
  marketDayKey?: string;
  source?: string;
  rates: Record<string, number>;
};

export type InlineConversionPerfSample = {
  totalMs: number;
  clearExistingMs: number;
  scanTextNodesMs: number;
  decorateNodesMs: number;
  scannedTextNodes: number;
  conversionsApplied: number;
  maxNodesPerPass: number;
  reachedNodeLimit: boolean;
};

export type InlineConversionPluginContext = {
  root: ParentNode;
  preferredCurrency: CurrencyCodeLike;
  rateSnapshot: RateSnapshotLike;
  localeHint: string | null;
  lightTextCache: WeakMap<Element, boolean>;
  onPluginError?: (error: unknown, plugin: InlineConversionPlugin) => void;
};

export type InlineConversionPluginResult =
  | number
  | {
      conversionsApplied: number;
    }
  | void;

export type InlineConversionPluginPhase = "pre" | "post";

export type InlineConversionPlugin =
  | ((context: InlineConversionPluginContext) => InlineConversionPluginResult)
  | {
      name?: string;
      phase?: InlineConversionPluginPhase;
      apply: (context: InlineConversionPluginContext) => InlineConversionPluginResult;
    };

export type InlineConversionPrePlugin =
  | ((context: InlineConversionPluginContext) => InlineConversionPluginResult)
  | {
      name?: string;
      phase?: "pre";
      apply: (context: InlineConversionPluginContext) => InlineConversionPluginResult;
    };

export type InlineConversionPostPlugin =
  | ((context: InlineConversionPluginContext) => InlineConversionPluginResult)
  | {
      name?: string;
      phase?: "post";
      apply: (context: InlineConversionPluginContext) => InlineConversionPluginResult;
    };

export type ConvertVisiblePricesOptions = {
  clearExisting?: boolean;
  refreshExisting?: boolean;
  maxNodesPerPass?: number;
  onPerfSample?: (sample: InlineConversionPerfSample) => void;
  onNodeLimitReached?: (maxNodesPerPass: number) => void;
  prePlugins?: InlineConversionPrePlugin[];
  postPlugins?: InlineConversionPostPlugin[];
  includeDefaultPostPlugins?: boolean;
  onPluginError?: (error: unknown, plugin: InlineConversionPlugin) => void;
};

export type InlineRuntimeRefreshOptions = {
  forceRatesRefresh?: boolean;
  clearExisting?: boolean;
};

export type InlineRuntimeOptions = {
  root?: ParentNode;
  preferredCurrency?: CurrencyCodeLike | null;
  rateSnapshot?: RateSnapshotLike | null;
  enabled?: boolean;
  observeMutations?: boolean;
  autoFetchRates?: boolean;
  onPerfSample?: (sample: InlineConversionPerfSample) => void;
  onNodeLimitReached?: (maxNodesPerPass: number) => void;
  prePlugins?: InlineConversionPrePlugin[];
  postPlugins?: InlineConversionPostPlugin[];
  includeDefaultPostPlugins?: boolean;
  onPluginError?: (error: unknown, plugin: InlineConversionPlugin) => void;
  onError?: (error: unknown) => void;
  shouldExcludeMutationRoot?: (root: ParentNode) => boolean;
};

export type InlineRuntimeController = {
  start: () => void;
  stop: () => void;
  refresh: (options?: InlineRuntimeRefreshOptions) => void;
  setPreferredCurrency: (currency: CurrencyCodeLike | null) => void;
  setRateSnapshot: (snapshot: RateSnapshotLike | null) => void;
  setEnabled: (enabled: boolean) => void;
  destroy: () => void;
  enqueueMutationRoots: (roots: ParentNode[]) => void;
  shouldIgnoreMutations: () => boolean;
  setRoot: (root: ParentNode) => void;
  setObserveMutations: (observeMutations: boolean) => void;
};

export function createInlineRuntime(options?: InlineRuntimeOptions): InlineRuntimeController;

export function convertVisiblePrices(
  preferredCurrency: CurrencyCodeLike,
  rateSnapshot: RateSnapshotLike,
  root?: ParentNode,
  options?: ConvertVisiblePricesOptions,
): number;

export function suppressInlineConversions(root?: ParentNode): number;

export function clearInlineConversions(root?: ParentNode): number;

export function formatAmountInCurrency(
  amount: number,
  currency: CurrencyCodeLike,
  options?: {
    localeHint?: string | null;
    compactLargeValues?: boolean;
    compactThreshold?: number;
  },
): string;

export const AMAZON_STRUCTURED_ADDON_PLUGIN_NAME: "amazon-structured-addon";

export const amazonStructuredAddonPlugin: {
  name: "amazon-structured-addon";
  phase: "post";
  apply: (context: InlineConversionPluginContext) => number;
};
