# Swedish translation worksheet

This list contains 35 distinct English text entries from the extension source. Of these, 34 are used by the current interface or extension metadata. One is in an unused component mode and is marked below. The Swedish fields are empty for manual translation.

## Instructions

- Write each Swedish translation in the last column.
- Keep the IDs unchanged. They identify worksheet rows, not existing message keys.
- Keep `{currencyName}` and `{currencyCode}` unchanged. These placeholders receive a currency name or code at runtime. You can move them within a sentence.
- Keep the product name `FX Inline` unchanged. Keep the arrow in `Feedback ↗`.
- Translate full messages. The on and off states have separate rows to allow natural Swedish grammar.
- Repeated text appears once. The context column identifies shared uses.
- The English column preserves the current text, including case and punctuation.

## Toolbar popup and selected-text popup

| ID | English | Context | Swedish |
| --- | --- | --- | --- |
| P01 | Local auto conversion on | Local switch: screen reader label, on state. Source A. | |
| P02 | Local auto conversion off | Local switch: screen reader label, off state. Source A. | |
| P03 | Local auto conversion on this page: On | Local switch: tooltip, on state. Source A. | |
| P04 | Local auto conversion on this page: Off | Local switch: tooltip, off state. Source A. | |
| P05 | Local auto conversion is unavailable on this page | Local switch: tooltip on a page that does not support this control. Source A. | |
| P06 | Global auto conversion on | Global switch: screen reader label, on state. Source A. | |
| P07 | Global auto conversion off | Global switch: screen reader label, off state. Source A. | |
| P08 | Global auto conversion: On | Global switch: tooltip, on state. Source A. | |
| P09 | Global auto conversion: Off | Global switch: tooltip, off state. Source A. | |
| P10 | Open extension options | Settings button: tooltip and screen reader label. Source A. | |
| P11 | Swap currencies | Swap button: tooltip and screen reader label. Source A. | |
| P12 | Share feedback (opens in a new tab) | Feedback button: tooltip and screen reader label. Source A. | |
| P13 | Feedback ↗ | Feedback button: visible text. Source A. | |
| P14 | Currency | Currency selector: screen reader label. Source B. | |
| P15 | {currencyName} amount | Amount input: screen reader label in both popups. Sources C and D. | |
| P16 | Edit {currencyName} amount | Amount button: screen reader label in both popups. Sources C and D. | |
| P17 | Click amount to edit | Instruction under each amount in both popups. Sources C and D. | |
| P18 | Amount updates instantly | Instruction for direct input mode. No current extension caller uses this mode. Source C. | |

## Settings

| ID | English | Context | Swedish |
| --- | --- | --- | --- |
| S01 | FX Inline Settings | Browser tab title. Source E. | |
| S02 | Preferred Currency | Currency selector label. Source F. | |
| S03 | Unable to load preferred currency. | Error when loading the saved setting. Source F. | |
| S04 | Preferred currency updated to {currencyCode}. | Confirmation after saving. Example placeholder value: SEK. Source F. | |
| S05 | Unable to update preferred currency. | Error when saving the setting. Source F. | |

## Welcome page

| ID | English | Context | Swedish |
| --- | --- | --- | --- |
| W01 | Welcome to FX Inline | Page heading and browser tab title. Sources G and H. | |
| W02 | Thank you for installing FX Inline. We convert prices directly on the pages you visit so you can evaluate costs quickly and confidently in your preferred currency. | Introduction. Source G. | |
| W03 | Get started in under a minute | Setup guide heading. Source G. | |
| W04 | Choose your preferred currency in Settings. | First setup instruction. Source G. | |
| W05 | Open any shopping, travel, or marketplace page with prices. | Second setup instruction. Source G. | |
| W06 | Use the FX Inline icon anytime to open the converter popup. | Third setup instruction. Source G. | |
| W07 | Open Settings | Button text before and after opening Settings. Source G. | |
| W08 | You can revisit this page anytime from the extension files. | Note below the button. Source G. | |
| W09 | Opening Settings... | Button text while Settings opens. Source G. | |
| W10 | Settings opened in a new tab. | Success message. Source G. | |
| W11 | Could not open settings automatically. Open FX Inline Settings from the extension menu. | Error message. Source G. | |

## Extension metadata

| ID | English | Context | Swedish |
| --- | --- | --- | --- |
| M01 | FX Inline converts prices directly on webpages into your preferred currency, so you can compare costs without leaving the page. | Extension description from package metadata. Source I. | |

## Currency names

Currency names are generated from browser language data. Settings currently requests English names. The agreed approach is to use built-in Swedish currency names for Swedish support, so they do not need manual translation. Currency codes stay unchanged.

## Other text and values

These items were checked but do not need manual translation:

- `FX Inline` and `FX INLINE`: product name in headings, the popup title, and extension metadata.
- `© {currentYear} FX Inline`: copyright line with a generated year.
- Currency codes, such as `SEK`, flags, and currency symbols.
- Amounts and conversion tooltips: generated number and currency data. Number formats are outside this change.
- HTML language tags: set by the future language selection logic; no translation entry is needed.
- Console messages and internal errors: developer diagnostics, not displayed interface messages.

The website, admin app, repository documents, and store listing text are outside this extension text list. New controls from a later design decision will need new translation rows.

## Source files

- A: [Toolbar popup](../apps/extension/entrypoints/popup/App.tsx)
- B: [Currency selector](../apps/extension/components/Dropdown/Dropdown.tsx)
- C: [Currency amount component](../apps/extension/components/CurrencyBox/CurrencyBox.tsx)
- D: [Selected-text popup](../apps/extension/entrypoints/content/selectionPopup.ts)
- E: [Settings HTML](../apps/extension/entrypoints/options/index.html)
- F: [Settings page](../apps/extension/entrypoints/options/optionsPage.ts)
- G: [Welcome page](../apps/extension/entrypoints/welcome/main.ts)
- H: [Welcome HTML](../apps/extension/entrypoints/welcome/index.html)
- I: [Package metadata](../package.json)

The inventory also includes checks of the background entrypoint, shared controls, currency display helpers, extension build settings, CSS, and inline conversion rendering. No additional displayed English messages were found in those areas.
