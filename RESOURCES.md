# JavaScript for FX Inline Resources

## Knowledge

- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
  Use for: the language backbone, especially functions, objects, arrays, control flow, and promises.
- [MDN JavaScript Modules Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
  Use for: understanding `import`/`export`, file boundaries, and how code is organized across this repo.
- [MDN async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
  Use for: reading functions that return promises and use `await`, which appears throughout the extension.
- [MDN Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
  Use for: understanding concurrent flows such as `Promise.all(...)` and error handling.
- [MDN Promise.all()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
  Use for: reading parallel async work, especially in startup and hydration code.
- [MDN import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
  Use for: understanding dynamic imports and lazy module loading in hydration logic.
- [MDN try...catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch)
  Use for: reading fallback paths that recover with cached or null-safe state.
- [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
  Use for: understanding how the extension observes DOM changes before batching conversion work.
- [WXT Entrypoints Guide](https://wxt.dev/guide/essentials/entrypoints)
  Use for: understanding how `background.ts`, popup pages, options pages, and content scripts become extension runtime entrypoints.
- [WXT Content Scripts Guide](https://wxt.dev/guide/essentials/content-scripts)
  Use for: understanding the content-script model used by the extension’s page-injection logic.
- [WXT Entrypoint Loaders](https://wxt.dev/guide/essentials/config/entrypoint-loaders)
  Use for: understanding build-time vs runtime behavior for entrypoints and why runtime code placement matters.

## Wisdom (Communities)

- [WXT GitHub Discussions](https://github.com/wxt-dev/wxt/discussions)
  Use for: practical WXT questions, tradeoffs, and framework-specific edge cases.
- [MDN Community](https://developer.mozilla.org/en-US/)
  Use for: authoritative language explanations and compatibility details when JavaScript behavior is unclear.
