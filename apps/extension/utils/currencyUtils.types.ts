import type { CurrencyCode } from "./enums";

export type ParserArtifacts = {
  magnitudeMultiplierByAlias: Map<string, number>;
  magnitudeSuffixRegex: RegExp;
  currencySnippetRegex: RegExp;
  currencyRangeRegex: RegExp;
};

export type CurrencyParseOptions = {
  localeHint?: string | null;
};

export type CurrencyValueParseResult = {
  valid: boolean;
  value?: number;
  currency?: CurrencyCode | null;
};

export type CurrencyTextMatch = {
  raw: string;
  start: number;
  end: number;
  value: number;
  currency: CurrencyCode;
  rangeEndValue?: number;
};

export type CurrencyFormatOptions = {
  localeHint?: string | null;
  compactLargeValues?: boolean;
  compactThreshold?: number;
};
