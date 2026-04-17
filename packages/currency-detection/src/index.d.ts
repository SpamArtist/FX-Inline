export type ParseOptions = {
  localeHint?: string | null;
};

export type ParseResult = {
  valid: boolean;
  value?: number;
  currency?: string | null;
};

export type CurrencyMatch = {
  raw: string;
  start: number;
  end: number;
  value: number;
  currency: string;
  rangeEndValue?: number;
};

export type MagnitudeProfile = {
  locale: string;
  requiresLocaleHint?: boolean;
  entries: Array<{
    multiplier: number;
    aliases: string[];
  }>;
};

export type ParserConfig = {
  extraSymbols?: Record<string, string>;
  extraWords?: Record<string, string>;
  extraIsoCodes?: string[];
  extraMagnitudeProfiles?: MagnitudeProfile[];
};

export type CurrencyParser = {
  parseValue(input: string, options?: string | ParseOptions | null): ParseResult;
  extractMatches(input: string, options?: string | ParseOptions | null): CurrencyMatch[];
  mayContainCurrencyToken(input: string): boolean;
  hasThousandMagnitudeHint(input: string): boolean;
};

export function createCurrencyParser(config?: ParserConfig): CurrencyParser;

export function parseCurrencyValue(
  input: string,
  options?: string | ParseOptions | null,
): ParseResult;

export function extractCurrencyTextMatches(
  input: string,
  options?: string | ParseOptions | null,
): CurrencyMatch[];

export function mayContainCurrencyToken(input: string): boolean;

export function hasThousandMagnitudeHint(input: string): boolean;
