export default {
  collectCandidates({ document }) {
    setTimeout(() => console.log("not deterministic"), 1);
    return fetch("https://example.com").then(() => []);
  },
};
