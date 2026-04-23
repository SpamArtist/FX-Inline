export default {
  collectCandidates({ document }) {
    return Array.from(document.querySelectorAll("[data-price]"))
      .map((node) => ({
        node,
        text: node.getAttribute("data-price") || node.textContent,
      }))
      .filter((entry) => typeof entry.text === "string" && entry.text.trim().length > 0);
  },
};
