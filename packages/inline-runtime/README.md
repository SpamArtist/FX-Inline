# @fx-inline/inline-runtime

Shared inline conversion runtime used by the extension and embeddable HTML integrations.

## ESM

```js
import { createInlineRuntime } from "@fx-inline/inline-runtime";

const runtime = createInlineRuntime({
  preferredCurrency: "EUR",
  rateSnapshot: {
    base: "USD",
    fetchedAt: Date.now(),
    rates: { USD: 1, EUR: 0.9 },
  },
});

runtime.start();
```

## Script Global

```html
<script src="fx-inline-runtime.global.js"></script>
<script>
  const runtime = window.FXInlineRuntime.mount({
    preferredCurrency: "EUR",
    rateSnapshot: { base: "USD", fetchedAt: Date.now(), rates: { USD: 1, EUR: 0.9 } }
  });
</script>
```
