# Swedish language support

## Agreed scope

- Translate all extension screens and messages, including tooltips, accessibility labels, page titles, and the extension description.
- Keep price detection and number formats unchanged.
- The user will write the Swedish translations manually.
- Prepare a list of existing English text with context and blank Swedish fields.
- Select the Extension Language from the browser. Use Swedish for all Swedish variants, including `sv-SE` and `sv-FI`, and English for other languages.
- Use built-in currency name translations. Currency names do not need manual translation; currency codes stay unchanged.

The text list is in [the Swedish translation worksheet](swedish-translations.md). It contains 35 entries, including one entry for an unused component mode.

## Open decisions

- Confirm the proposed fallback: show English if a Swedish entry is empty or missing; require all active entries before the Swedish release.
- Confirm the proposed checks: translation coverage, placeholder preservation, language selection and fallback, and visual checks of both languages in Chrome and Firefox.
- Confirm the complete plan before implementation, as required by the requested grilling skill.

## Current behavior

The extension has no translation catalog or saved language setting. Its interface text is English. Currency names in the popup and selection popup use the browser language. Currency names in Settings use English.

The extension includes a toolbar popup, a popup for selected webpage text, Settings, and a welcome page. The website and admin app are separate from this scope.

## Decision record

No ADR is needed at this stage. The agreed scope does not require a decision that is difficult to reverse.
