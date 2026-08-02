---
status: accepted
---

# Keep the Activation Scan independent from the parser runtime

The Activation Scan must stay small because it runs before FX Inline decides to load the conversion worker. It can import a token-only submodule from the currency-detection package, but it must not import the parser runtime or magnitude data. This boundary keeps one source for activation tokens without adding the full parser to the startup path.
