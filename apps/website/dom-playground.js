import { createCurrencyParser } from "../../packages/currency-detection/src/index.js";

const parser = createCurrencyParser();

const sourceInput = document.getElementById("source");
const localeInput = document.getElementById("locale");
const preview = document.getElementById("preview");
const matchesList = document.getElementById("matches");
const summary = document.getElementById("summary");
const renderButton = document.getElementById("render");
const detectButton = document.getElementById("detect");
const resetButton = document.getElementById("reset");

if (
  !sourceInput ||
  !localeInput ||
  !preview ||
  !matchesList ||
  !summary ||
  !renderButton ||
  !detectButton ||
  !resetButton
) {
  throw new Error("Playground DOM is missing required controls.");
}

function getLocaleHint() {
  const raw = localeInput.value.trim();
  return raw.length ? raw : document.documentElement.lang || "en";
}

function renderPreview() {
  preview.textContent = sourceInput.value;
  matchesList.textContent = "";
  summary.innerHTML = "Matches: <strong>0</strong>";
}

function collectTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let next;

  while ((next = walker.nextNode())) {
    textNodes.push(next);
  }

  return textNodes;
}

function shouldSkipTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest(".ccx-match")) return true;

  return ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName);
}

function highlightNodeMatches(textNode, matches) {
  const text = textNode.nodeValue || "";
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const match of matches) {
    fragment.append(text.slice(cursor, match.start));

    const mark = document.createElement("mark");
    mark.className = "ccx-match";
    mark.textContent = match.raw;

    const tag = document.createElement("span");
    tag.className = "ccx-tag";
    tag.textContent = `[${match.currency} ${match.value}${match.rangeEndValue === undefined ? "" : `-${match.rangeEndValue}`}]`;

    mark.append(tag);
    fragment.append(mark);
    cursor = match.end;
  }

  fragment.append(text.slice(cursor));
  textNode.replaceWith(fragment);
}

function runDetection() {
  renderPreview();
  const localeHint = getLocaleHint();
  const matches = [];

  for (const textNode of collectTextNodes(preview)) {
    const text = textNode.nodeValue;
    if (!text?.trim()) continue;
    if (shouldSkipTextNode(textNode)) continue;
    if (!parser.mayContainCurrencyToken(text)) continue;

    const detected = parser.extractMatches(text, { localeHint });
    if (!detected.length) continue;

    highlightNodeMatches(textNode, detected);
    matches.push(...detected);
  }

  matchesList.textContent = "";
  for (const match of matches) {
    const item = document.createElement("li");
    item.textContent = `${match.raw} -> ${match.currency} ${match.value}${match.rangeEndValue === undefined ? "" : ` to ${match.rangeEndValue}`}`;
    matchesList.append(item);
  }

  summary.innerHTML = `Matches: <strong>${matches.length}</strong>`;
}

renderButton.addEventListener("click", renderPreview);
detectButton.addEventListener("click", runDetection);
resetButton.addEventListener("click", renderPreview);

renderPreview();
