import { createCurrencyParser } from "@fx-inline/currency-detection";
import {
  INLINE_RUNTIME_CSS,
  INLINE_STYLE_ID,
  INLINE_WRAPPER_CLASS,
} from "./constants.js";
import { convertAmount, formatCurrencyValue } from "./conversion.js";
import { sanitizeUiSettings } from "./settings.js";

function ensureRuntimeStyles() {
  let styleNode = document.getElementById(INLINE_STYLE_ID);
  if (styleNode instanceof HTMLStyleElement) {
    if (styleNode.textContent !== INLINE_RUNTIME_CSS) {
      styleNode.textContent = INLINE_RUNTIME_CSS;
    }
    return;
  }

  styleNode = document.createElement("style");
  styleNode.id = INLINE_STYLE_ID;
  styleNode.textContent = INLINE_RUNTIME_CSS;
  document.head.appendChild(styleNode);
}

function isNodeConnected(node) {
  return node instanceof Node && node.isConnected;
}

function getLocaleHint() {
  return document.documentElement?.lang || undefined;
}

function getAddonNode(targetElement) {
  for (const child of targetElement.children) {
    if (
      child instanceof HTMLSpanElement &&
      child.classList.contains(INLINE_WRAPPER_CLASS) &&
      child.getAttribute("data-fxi-mode") === "addon"
    ) {
      return child;
    }
  }

  return null;
}

function setDefaultConvertedContent(wrapper, originalText, convertedText) {
  wrapper.textContent = "";

  const originalNode = document.createTextNode(`${originalText} `);
  const convertedNode = document.createElement("span");
  convertedNode.className = "fxi-converted-amount";
  convertedNode.textContent = `(${convertedText})`;

  wrapper.append(originalNode, convertedNode);
}

function isValidCandidate(candidate) {
  return (
    candidate &&
    candidate.node instanceof Node &&
    (typeof candidate.text === "string" || candidate.text === undefined)
  );
}

export function createRuntimeEngine({
  manifest,
  prePlugin,
  postPlugin,
  uiSettings,
  rateService,
}) {
  const parser = createCurrencyParser(manifest.parserConfig);

  let rateSnapshot = null;
  let mutationObserver = null;
  let mutationTimer = null;
  let destroyed = false;
  let activeUiSettings = uiSettings;

  function setCssVars(settings) {
    const root = document.documentElement;
    root.style.setProperty("--fxi-font-scale", String(settings.fontScalePct / 100));
    root.style.setProperty("--fxi-font-weight", String(settings.fontWeight));
    root.style.setProperty("--fxi-font-family", settings.fontFamily);
    root.style.setProperty("--fxi-font-color", settings.fontColor);
    root.style.setProperty("--fxi-spacing", `${settings.spacingEm}em`);
  }

  function applySettings() {
    setCssVars(activeUiSettings);
    if (typeof postPlugin.applySettings === "function") {
      postPlugin.applySettings({
        root: document.documentElement,
        settings: activeUiSettings,
      });
    }
  }

  function toRawText(candidate) {
    if (typeof candidate.text === "string") {
      return candidate.text.trim();
    }

    if (candidate.node instanceof Text) {
      return candidate.node.nodeValue?.trim() || "";
    }

    if (candidate.node instanceof Element) {
      const explicit = candidate.node.getAttribute("data-fxi-raw-price");
      if (typeof explicit === "string" && explicit.trim()) {
        return explicit.trim();
      }
      return candidate.node.textContent?.trim() || "";
    }

    return "";
  }

  function getBestMatch(rawText) {
    const matches = parser.extractMatches(rawText, {
      localeHint: getLocaleHint(),
    });

    if (!matches.length) return null;
    return matches.find((candidate) => candidate.raw === rawText) ?? matches[0];
  }

  function renderCandidate(candidate) {
    if (!isNodeConnected(candidate.node)) {
      return false;
    }

    if (
      candidate.node instanceof Element &&
      candidate.node.closest(`.${INLINE_WRAPPER_CLASS}`)
    ) {
      return false;
    }

    if (
      candidate.node instanceof Text &&
      candidate.node.parentElement?.closest(`.${INLINE_WRAPPER_CLASS}`)
    ) {
      return false;
    }

    const rawText = toRawText(candidate);
    if (!rawText) return false;

    const match = getBestMatch(rawText);
    if (!match) return false;

    const convertedValue = convertAmount(
      match.value,
      match.currency,
      manifest.preferredCurrency,
      rateSnapshot,
    );

    if (convertedValue === null) return false;

    const convertedText = formatCurrencyValue(
      convertedValue,
      manifest.preferredCurrency,
      getLocaleHint(),
    );

    let wrapper;
    const mode = candidate.node instanceof Element ? "addon" : "inline";

    if (candidate.node instanceof Text) {
      wrapper = document.createElement("span");
      wrapper.className = INLINE_WRAPPER_CLASS;
      wrapper.setAttribute("data-original", rawText);
      wrapper.setAttribute("data-fxi-mode", mode);
      setDefaultConvertedContent(wrapper, rawText, convertedText);
      candidate.node.replaceWith(wrapper);
    } else {
      wrapper = getAddonNode(candidate.node) ?? document.createElement("span");
      wrapper.className = INLINE_WRAPPER_CLASS;
      wrapper.setAttribute("data-original", rawText);
      wrapper.setAttribute("data-fxi-mode", mode);
      setDefaultConvertedContent(wrapper, rawText, convertedText);
      if (!wrapper.isConnected) {
        candidate.node.appendChild(wrapper);
      }
    }

    if (typeof postPlugin.renderConverted === "function") {
      postPlugin.renderConverted({
        wrapper,
        originalText: rawText,
        convertedText,
        settings: activeUiSettings,
      });
    }

    return true;
  }

  function runPass() {
    if (destroyed) return 0;
    if (!rateSnapshot) return 0;

    const candidates = prePlugin.collectCandidates({
      document,
      location: window.location,
      parser,
    });

    if (!Array.isArray(candidates)) {
      return 0;
    }

    let conversions = 0;

    for (const candidate of candidates) {
      if (!isValidCandidate(candidate)) continue;
      if (renderCandidate(candidate)) {
        conversions += 1;
      }
    }

    return conversions;
  }

  function schedulePass() {
    if (destroyed) return;
    if (mutationTimer !== null) {
      window.clearTimeout(mutationTimer);
    }

    mutationTimer = window.setTimeout(() => {
      mutationTimer = null;
      runPass();
    }, 120);
  }

  function watchMutations() {
    mutationObserver = new MutationObserver(() => {
      schedulePass();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  return {
    async start() {
      if (destroyed) return;
      ensureRuntimeStyles();
      applySettings();
      rateSnapshot = await rateService.getRates();
      runPass();
      watchMutations();
    },
    updateSettings(nextSettings) {
      activeUiSettings = sanitizeUiSettings(
        {
          ...activeUiSettings,
          ...nextSettings,
        },
        activeUiSettings,
      );
      applySettings();
      runPass();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;

      if (mutationTimer !== null) {
        window.clearTimeout(mutationTimer);
        mutationTimer = null;
      }

      mutationObserver?.disconnect();
      mutationObserver = null;
    },
  };
}
