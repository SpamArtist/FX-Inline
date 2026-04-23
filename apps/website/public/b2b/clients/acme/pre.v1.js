const CANDIDATE_SELECTORS = [
  "[data-acme-price]",
  ".acme-price",
  ".acme-plan-price",
  ".acme-price-split",
];

function isSupportedPath(pathname) {
  return /^\/(b2b-demo|pricing|store)(\/|$)/u.test(pathname);
}

function buildRawFromSplitNode(element) {
  const symbol = element.querySelector("[data-acme-currency-symbol]")?.textContent?.trim();
  const whole = element.querySelector("[data-acme-price-whole]")?.textContent?.trim();
  const fraction = element.querySelector("[data-acme-price-fraction]")?.textContent?.trim();

  if (!symbol || !whole) return null;
  if (!fraction) return `${symbol}${whole}`;
  return `${symbol}${whole}${fraction}`;
}

export default {
  id: "acme-pre-v1",
  collectCandidates({ document, location }) {
    if (!isSupportedPath(location.pathname)) {
      return [];
    }

    const candidates = [];
    const seenNodes = new Set();

    for (const selector of CANDIDATE_SELECTORS) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        if (!(element instanceof HTMLElement)) continue;
        if (seenNodes.has(element)) continue;

        let raw =
          element.getAttribute("data-acme-price") ||
          element.getAttribute("data-fxi-raw-price") ||
          null;

        if (!raw && element.classList.contains("acme-price-split")) {
          raw = buildRawFromSplitNode(element);
        }

        if (!raw) {
          raw = element.textContent?.trim() || null;
        }

        if (!raw) continue;

        candidates.push({
          node: element,
          text: raw,
        });
        seenNodes.add(element);
      }
    }

    return candidates;
  },
};
