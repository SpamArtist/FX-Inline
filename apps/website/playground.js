import { createCurrencyParser } from "@fx-inline/currency-detection";

const parser = createCurrencyParser();

const sourceInput = document.getElementById("source");
const localeInput = document.getElementById("locale");
const matchesList = document.getElementById("matches");
const summary = document.getElementById("summary");
const detectButton = document.getElementById("detect");
const resetButton = document.getElementById("reset");

if (
  !sourceInput ||
  !localeInput ||
  !matchesList ||
  !summary ||
  !detectButton ||
  !resetButton
) {
  throw new Error("Playground DOM is missing required controls.");
}

function getLocaleHint() {
  const raw = localeInput.value.trim();
  return raw.length ? raw : document.documentElement.lang || "en";
}

function resetResults() {
  matchesList.textContent = "";
  summary.innerHTML = "Matches: <strong>0</strong>";
}

function runDetection() {
  resetResults();
  const localeHint = getLocaleHint();
  const text = sourceInput.value;
  if (!parser.mayContainCurrencyToken(text)) return;

  const matches = parser.extractMatches(text, { localeHint });

  for (const match of matches) {
    const item = document.createElement("li");
    item.textContent = `${match.raw} -> ${match.currency} ${match.value}${match.rangeEndValue === undefined ? "" : ` to ${match.rangeEndValue}`}`;
    matchesList.append(item);
  }

  summary.innerHTML = `Matches: <strong>${matches.length}</strong>`;
}

detectButton.addEventListener("click", runDetection);
resetButton.addEventListener("click", resetResults);

resetResults();
