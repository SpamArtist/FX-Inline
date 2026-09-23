# Swedish language support

## Agreed scope

- Translate all extension screens and messages, including tooltips, accessibility labels, page titles, and the extension description.
- Keep price detection and number formats unchanged.
- The user will write the Swedish translations manually.
- Prepare a list of existing English text with context and blank Swedish fields.
- Select the Extension Language from the browser. Use Swedish for all Swedish variants, including `sv-SE` and `sv-FI`, and English for other languages.
- Use built-in currency name translations. Currency names do not need manual translation; currency codes stay unchanged.

The text list is in [the Swedish translation worksheet](swedish-translations.md). It contains 35 entries, including one entry for an unused component mode.

## Confirmed completion rules

- Show English if a Swedish entry is empty or missing. Require all active entries before the Swedish release.
- Check translation coverage, placeholder preservation, language selection and fallback, and both languages visually in Chrome and Firefox.
- The user confirmed the complete plan before implementation.

## Behavior before this change

The extension has no translation catalog or saved language setting. Its interface text is English. Currency names in the popup and selection popup use the browser language. Currency names in Settings use English.

The extension includes a toolbar popup, a popup for selected webpage text, Settings, and a welcome page. The website and admin app are separate from this scope.

## Implementation

The extension uses the native browser message API with English as `default_locale`. The English catalog contains all 35 worksheet entries and the unchanged product name. The Swedish catalog contains all 35 translations supplied by the user and the unchanged product name. Missing Swedish entries use English.

The language helper reads the browser UI language. Extension page titles and language tags use this language. The selected-text popup sets its own language without changing the webpage language. Currency names use built-in translations for the Extension Language. Amount input, amount formats, and webpage price detection keep their previous behavior.

## Translation handoff

1. Fill the Swedish column in [the worksheet](swedish-translations.md).
2. Transfer each completed row into `apps/extension/public/_locales/sv/messages.json`. The English catalog descriptions identify worksheet IDs. Copy placeholder definitions from the matching English entry. Use `$CURRENCY_NAME$` for `{currencyName}` and `$CURRENCY_CODE$` for `{currencyCode}`.
3. Omit unfinished catalog entries. Do not copy English text into the Swedish catalog as a substitute for a translation. Empty worksheet fields are allowed; empty catalog messages fail validation.
4. Run `npm run check:locales` to check current entries and placeholders. Run `npm run check:locales:sv` before the Swedish release. The release check requires all 34 active translations; the unused `amountUpdatesInstantly` entry is optional.
5. Run the frontend and content tests, type checks, lint, and production builds for Chrome and Firefox.
6. Check the completed Swedish text and English fallback visually in Chrome and Firefox before release. Check the toolbar popup, selected-text popup, Settings, welcome page, long text, tooltips, and screen reader labels.

All 35 translations supplied by the user are now in the catalog. The user approved the S02 correction from `Önskad valut` to `Önskad valuta`. Duplicate empty worksheet rows and surrounding quotation marks were removed. All other supplied wording was preserved.

## Verification

- The Swedish release check passes: 34 of 34 active translations are present. The optional translation is also present.
- Frontend tests: 157 passed. Content tests: 94 passed.
- Type checks, lint, and Chrome and Firefox production builds passed.
- A native Chrome extension check passed in isolated English and Swedish browser profiles. The toolbar popup, Settings, welcome page, and selected-text popup showed the expected language with no text overflow found. Currency swapping, amount editing, and the Settings save message were checked. The selected-text popup did not change the webpage language.
- Firefox rendering checks passed in English and Swedish for the toolbar popup, Settings, welcome page, and selected-text popup. The built files ran with a browser API test replacement because the automation tool could not control native extension pages. Native Firefox language selection remains unverified.
- A narrow-window Firefox check found that long currency names made the Settings selector overflow. The selector now uses `width: 100%` and `min-width: 0`. English and Swedish checks passed at 375 pixels in both Chrome and Firefox after the fix.
- The worksheet, Swedish catalog, and both browser build catalogs contain matching text for all 35 entries.

Before publication, perform a final check in an installed Firefox extension with the browser interface set to Swedish.

## References

The [Chrome message API](https://developer.chrome.com/docs/extensions/reference/api/i18n) defines locale matching and default language fallback. The [Firefox message reference](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/i18n/Locale-Specific_Message_reference) defines the shared catalog and placeholder format.

## Decision record

No ADR is needed at this stage. The agreed scope does not require a decision that is difficult to reverse.
