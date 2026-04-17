/**
 * Parse options for `parseValue` / `extractMatches`.
 */
export type ParseOptions = {
  /**
   * Allowed values:
   * - `undefined` / omitted
   * - `null`
   * - locale hint string (examples: `"en"`, `"en-US"`, `"pt-BR"`, `"vi"`).
   */
  localeHint?: string | null;
};

export type ParseResult = {
  /**
   * Always present.
   * - `true`: parsing succeeded and `value` / `currency` are populated.
   * - `false`: parsing failed and no value/currency is guaranteed.
   */
  valid: boolean;
  /**
   * Present when `valid === true`.
   * Allowed values: finite JavaScript number.
   */
  value?: number;
  /**
   * Present when `valid === true`.
   * Allowed values: recognized uppercase ISO-like currency code.
   */
  currency?: string | null;
};

export type CurrencyMatch = {
  /**
   * Raw matched substring.
   */
  raw: string;
  /**
   * Start index in input (0-based).
   */
  start: number;
  /**
   * End index in input (0-based, exclusive).
   */
  end: number;
  /**
   * Parsed start value for this match.
   */
  value: number;
  /**
   * Allowed values: recognized uppercase ISO-like currency code.
   */
  currency: string;
  /**
   * Present for range matches (e.g. `"USD 5-10"`).
   */
  rangeEndValue?: number;
};

export type MagnitudeProfile = {
  /**
   * Allowed values: non-empty locale string.
   * Examples: `"en-us"`, `"pt-br"`, `"x-test"`.
   */
  locale: string;
  /**
   * Allowed values:
   * - `true`: profile only applies when localeHint matches.
   * - `false` / omitted: profile can be part of default fallback set.
   */
  requiresLocaleHint?: boolean;
  /**
   * Allowed values: non-empty array.
   */
  entries: Array<{
    /**
     * Allowed values: finite positive number (`> 0`).
     */
    multiplier: number;
    /**
     * Allowed values:
     * - non-empty string aliases
     * - max 100 aliases per entry
     * - each alias length <= 64.
     */
    aliases: string[];
  }>;
};

export type ParserConfig = {
  /**
   * Allowed values:
   * - object map where each key is a non-empty symbol token
   * - each value must be uppercase ISO-like code (`^[A-Z]{3,4}$`)
   * - additive only (cannot override built-in symbol tokens).
   */
  extraSymbols?: Record<string, string>;
  /**
   * Allowed values:
   * - object map where each key is a non-empty word token
   * - each value must be uppercase ISO-like code (`^[A-Z]{3,4}$`)
   * - additive only (cannot override built-in word tokens).
   */
  extraWords?: Record<string, string>;
  /**
   * Allowed values:
   * - array length <= 500
   * - each item must match `^[A-Z]{3,4}$`.
   */
  extraIsoCodes?: string[];
  /**
   * Allowed values:
   * - array length <= 100
   * - additive only (cannot override built-in magnitude aliases).
   */
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
