# FX Inline

FX Inline identifies prices on webpages and presents conversions in a preferred currency without requiring the user to leave the page.

## Language

**Activation Scan**:
The lightweight pre-worker search for evidence that a webpage contains a currency token paired with an amount. It determines whether FX Inline should load its full conversion worker.
_Avoid_: Currency scan, initial scan, price scan

**Activation Signal**:
Evidence that page text can contain a supported currency token near a numeric amount. It is sufficient to start the conversion worker, but it does not confirm a valid price.
_Avoid_: Price match, parsed price

**Currency Token**:
A supported ISO currency code or currency symbol that can identify a currency when it is near a numeric amount.
_Avoid_: Currency marker, currency label

**Ambiguous ISO Code**:
An ISO currency code that is also a common word or name. It remains valid for conversion, but it cannot create an Activation Signal by itself.
_Avoid_: Blocked currency, unsupported code
