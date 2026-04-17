# @fx-inline/currency-detection

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

`extraWords`
- Map of lowercase/word-like token -> ISO-like currency code.
- Example: `{ bucks: "USD" }`

`extraIsoCodes`
- Additional 3-4 uppercase letter codes to treat as currency codes.
- Example: `["USDX", "BTC"]`

`extraMagnitudeProfiles`
- Additional locale-aware magnitude aliases (for example, custom `"mega"` => `1_000_000`).

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

`extractMatches(input, options?)`
- Finds currency/amount matches across a larger text.
- Returns ordered non-overlapping matches with offsets.

`mayContainCurrencyToken(input)`
- Fast pre-check (digit + token hint) before expensive extraction.

`hasThousandMagnitudeHint(input)`
- Detects K-style thousand magnitude patterns.

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
