# @fx-inline/currency-detection

[![CI](https://github.com/SpamArtist/currency-conversion-extension-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/SpamArtist/currency-conversion-extension-tool/actions/workflows/ci.yml)
[![Currency Detection Benchmarks](https://github.com/SpamArtist/currency-conversion-extension-tool/actions/workflows/currency-detection-benchmarks.yml/badge.svg)](https://github.com/SpamArtist/currency-conversion-extension-tool/actions/workflows/currency-detection-benchmarks.yml)

Portable, dependency-free currency and amount detection/parsing core.

## Usage

```js
import {
  createCurrencyParser,
  parseCurrencyValue,
  extractCurrencyTextMatches,
} from "@fx-inline/currency-detection";

const parser = createCurrencyParser();

const single = parser.parseValue("USD 1.2M", { localeHint: "en-US" });
const matches = extractCurrencyTextMatches("Deal: $100 and €220");
```

## API

### `createCurrencyParser(config?)`

Creates a dedicated parser instance.

```ts
function createCurrencyParser(config?: ParserConfig): CurrencyParser;
```

`config` is optional.

Allowed values for `config`:
- `undefined` / omitted
- object matching `ParserConfig`
- any other type throws `Error`

#### `ParserConfig` shape

```ts
type ParserConfig = {
  extraSymbols?: Record<string, string>;
  extraWords?: Record<string, string>;
  extraIsoCodes?: string[];
  extraMagnitudeProfiles?: MagnitudeProfile[];
};
```

`extraSymbols`
- Map of symbol token -> ISO-like currency code.
- Example: `{ "₿": "BTC" }`
- Allowed keys: non-empty symbol strings.
- Allowed values: uppercase ISO-like codes matching `^[A-Z]{3,4}$`.
- Additive-only: cannot override built-in symbol tokens (including canonical collisions).

`extraWords`
- Map of lowercase/word-like token -> ISO-like currency code.
- Example: `{ bucks: "USD" }`
- Allowed keys: non-empty word-like strings (normalized to lowercase internally).
- Allowed values: uppercase ISO-like codes matching `^[A-Z]{3,4}$`.
- Additive-only: cannot override built-in word tokens.

`extraIsoCodes`
- Additional 3-4 uppercase letter codes to treat as currency codes.
- Example: `["USDX", "BTC"]`
- Allowed values: array length `<= 500`.
- Each item must match `^[A-Z]{3,4}$`.
- Built-in validation tracks active country currency codes; for example `BOB`, `COP`, and `VES` are accepted while non-circulating unit codes `BOV`, `COU`, and `VED` are rejected.

`extraMagnitudeProfiles`
- Additional locale-aware magnitude aliases (for example, custom `"mega"` => `1_000_000`).
- Allowed values: array length `<= 100`.
- Additive-only: aliases cannot override built-in aliases and cannot duplicate each other.

```ts
type MagnitudeProfile = {
  locale: string;
  requiresLocaleHint?: boolean;
  entries: Array<{
    multiplier: number;
    aliases: string[];
  }>;
};
```

`MagnitudeProfile` allowed values:
- `locale`: non-empty string (normalized to lowercase/hyphen internally).
- `requiresLocaleHint`: `true`, `false`, or omitted.
- `entries`: non-empty array.
- `entries[].multiplier`: finite positive number (`> 0`).
- `entries[].aliases`: non-empty array, max `100` aliases.
- `entries[].aliases[]`: non-empty string, max length `64`.

#### Validation / constraints

- Config is additive-only; built-in tokens/aliases cannot be overridden.
- ISO code values must be uppercase 3-4 letters.
- `extraIsoCodes` max length: `500`.
- `extraMagnitudeProfiles` max length: `100`.
- Each magnitude entry must have positive finite `multiplier`.
- Each magnitude entry `aliases` max length: `100`.
- Each alias max length: `64`.
- Invalid config throws an `Error`.

### `CurrencyParser` methods

```ts
type CurrencyParser = {
  parseValue(input: string, options?: string | ParseOptions | null): ParseResult;
  extractMatches(input: string, options?: string | ParseOptions | null): CurrencyMatch[];
  mayContainCurrencyToken(input: string): boolean;
  hasThousandMagnitudeHint(input: string): boolean;
};
```

`parseValue(input, options?)`
- Parses a single candidate string.
- Returns `{ valid: false }` when not parseable.
- Allowed `input`: any string.
- Allowed `options`: locale string, `ParseOptions`, `null`, or omitted.

`extractMatches(input, options?)`
- Finds currency/amount matches across a larger text.
- Returns ordered non-overlapping matches with offsets.
- Allowed `input`: any string.
- Allowed `options`: locale string, `ParseOptions`, `null`, or omitted.

`mayContainCurrencyToken(input)`
- Fast pre-check (digit + token hint) before expensive extraction.
- Allowed `input`: any string.

`hasThousandMagnitudeHint(input)`
- Detects K-style thousand magnitude patterns.
- Allowed `input`: any string.

### Top-level convenience exports

These use an internal default parser instance:

- `parseCurrencyValue(input, options?)`
- `extractCurrencyTextMatches(input, options?)`
- `mayContainCurrencyToken(input)`
- `hasThousandMagnitudeHint(input)`

### Parse options and return shapes

```ts
type ParseOptions = {
  localeHint?: string | null;
};

type ParseResult = {
  valid: boolean;
  value?: number;
  currency?: string | null;
};

type CurrencyMatch = {
  raw: string;
  start: number;
  end: number;
  value: number;
  currency: string;
  rangeEndValue?: number;
};
```

`ParseOptions.localeHint` allowed values:
- omitted / `undefined`
- `null`
- locale hint string (examples: `"en"`, `"en-US"`, `"pt-BR"`, `"vi"`).

Known built-in locale families for magnitude profiles:
- `en`, `vi`, `id`, `ms`, `tr`, `az`, `ar`, `fa`, `hi`, `mr`, `bn`, `ur`
- `zh`, `ja`, `ko`, `th`, `ru`, `sw`
- `de`, `fr`, `it`, `es`, `pt-br`, `pt-pt`

`ParseResult` allowed values:
- `valid`: `true` or `false`
- when `valid === true`: `value` is finite number and `currency` is recognized uppercase ISO-like code
- when `valid === false`: no `value` / `currency` guarantee

`CurrencyMatch` allowed values:
- `start`/`end`: 0-based indexes (`end` is exclusive)
- `currency`: recognized uppercase ISO-like code
- `rangeEndValue`: present only for range matches

### Example: custom extensions

```js
import { createCurrencyParser } from "@fx-inline/currency-detection";

const parser = createCurrencyParser({
  extraSymbols: { "₿": "BTC" },
  extraWords: { bucks: "USD" },
  extraIsoCodes: ["USDX"],
  extraMagnitudeProfiles: [
    {
      locale: "en-us",
      requiresLocaleHint: true,
      entries: [{ multiplier: 1_000_000, aliases: ["mega"] }],
    },
  ],
});

parser.parseValue("₿ 0.2");
parser.parseValue("USDX 2 mega", { localeHint: "en-US" });
```

## Local Commands

- `npm run currency-detection:fixtures`
- `npm run currency-detection:baseline`
- `npm run currency-detection:test`
- `npm run currency-detection:bench`
- `npm run currency-detection:bench:compare`

The benchmark workflow is report-only for comparisons; main CI still runs lint, TypeScript compile, and the full test suite.
