# FX Inline

[![CI](https://github.com/SpamArtist/FX-Inline/actions/workflows/ci.yml/badge.svg)](https://github.com/SpamArtist/FX-Inline/actions/workflows/ci.yml)
[![Benchmarks](https://github.com/SpamArtist/FX-Inline/actions/workflows/currency-detection-benchmarks.yml/badge.svg)](https://github.com/SpamArtist/FX-Inline/actions/workflows/currency-detection-benchmarks.yml)

FX Inline is a browser extension that converts prices on webpages into your preferred currency. It keeps the original price visible.

## Features

- Convert prices on the current page.
- Convert selected price text.
- Use the popup as a currency converter.
- Detect prices added after page load.
- Support currency symbols, ISO codes, ranges, and magnitude suffixes.
- Build for Chromium and Firefox.

## Setup

Use Node.js 22 and npm.

```sh
git clone https://github.com/SpamArtist/FX-Inline.git
cd FX-Inline
npm ci
```

Start a Chromium development build:

```sh
npm run dev
```

Start a Firefox development build:

```sh
npm run dev:firefox
```

## Project Layout

| Path | Purpose |
| --- | --- |
| `apps/extension` | Browser extension |
| `apps/website` | Website and parser playground |
| `apps/admin` | Local settings workbench |
| `apps/backend` | Admin API |
| `packages/currency-detection` | Currency parser |
| `packages/inline-runtime` | Page conversion runtime |
| `docs` | Architecture and performance notes |

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | Check code style |
| `npm run compile` | Check TypeScript |
| `npm run test:all` | Run all tests |
| `npm run build` | Build Chromium extension |
| `npm run build:firefox` | Build Firefox extension |
| `npm run zip` | Create Chromium archives |
| `npm run zip:firefox` | Create Firefox archives |
| `npm run build:website` | Build website |

## Admin Settings

Start the API:

```sh
npm run admin:api
```

Start the admin workbench in a second terminal:

```sh
npm run dev:admin
```

The workbench runs on port `3306`. The API runs on port `3307`.

Export settings manually with:

```sh
npm run admin:export-settings
```

## Tests and Benchmarks

Run all tests:

```sh
npm run test:all
```

Run currency detection benchmarks:

```sh
npm run currency-detection:baseline
npm run currency-detection:bench
npm run currency-detection:bench:compare
```

## Permissions

FX Inline uses `storage`, `alarms`, and `activeTab`.

It gets rates from:

- `https://open.er-api.com/v6/latest/USD`
- `https://api.exchangerate-api.com/v4/latest/USD`

## Documentation

- [Project terms](CONTEXT.md)
- [Currency detection](packages/currency-detection/README.md)
- [Inline runtime](packages/inline-runtime/README.md)
- [Architecture decisions](docs/adr)
- [Performance notes](docs/performance)
