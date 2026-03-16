# Currency Conversion Extension Roadmap

## Delivered

1. Selection popup trigger
- Detects selected values when numeric-only, symbol-prefixed/suffixed, or ISO-prefixed/suffixed.
- Supports examples: `100`, `USD 100`, `100 USD`, `$100`, `100$`, `USD100`, `100USD`.

2. Preferred currency persistence
- Preferred currency is stored in extension storage and reused across popup + content conversions.

3. Client-side rate behavior
- Rates are fetched directly by the extension from public FX providers.
- Market-day cache policy is applied for stable refresh behavior.

4. Background refresh
- Background worker runs alarm-based refresh and keeps rates warm.

5. Auto webpage conversion
- Content script scans text nodes, decorates detected currency prices, and responds to DOM mutations.

6. Popup and options UI
- Popup converter with currency swap and live conversion updates.
- Options page with preferred currency management.

## QA tasks

1. Unit tests (automated)
- Parser coverage for roadmap formats and extraction behavior.
- Rate conversion math and rate-cache policy helpers.
- Run with: `npm run test:unit`.

2. E2E extension checks (runbook)
- Added manual checklist in [QA_E2E_CHECKLIST.md](/Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool/docs/QA_E2E_CHECKLIST.md).

3. Security checks (runbook)
- Added CSP/permissions checklist in [SECURITY_CHECKLIST.md](/Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool/docs/SECURITY_CHECKLIST.md).

## External production steps remaining

These require external environment setup, not local code changes:
- Verify public FX provider reliability and fallback behavior in your deployment regions.
- Add operational monitoring for extension runtime failures if needed.
