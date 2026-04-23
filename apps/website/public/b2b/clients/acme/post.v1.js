function setConvertedContent(wrapper, originalText, convertedText) {
  wrapper.textContent = "";

  const originalNode = document.createTextNode(`${originalText} `);
  const convertedNode = document.createElement("span");
  convertedNode.className = "fxi-converted-amount";
  convertedNode.textContent = `(${convertedText})`;

  wrapper.append(originalNode, convertedNode);
}

export default {
  id: "acme-post-v1",
  applySettings({ root, settings }) {
    root.style.setProperty("--fxi-font-scale", String(settings.fontScalePct / 100));
    root.style.setProperty("--fxi-font-weight", String(settings.fontWeight));
    root.style.setProperty("--fxi-font-family", settings.fontFamily);
    root.style.setProperty("--fxi-font-color", settings.fontColor);
    root.style.setProperty("--fxi-spacing", `${settings.spacingEm}em`);
  },
  renderConverted({ wrapper, originalText, convertedText }) {
    setConvertedContent(wrapper, originalText, convertedText);
  },
};
