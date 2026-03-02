import { collectMutationConversionRoots } from "../../test-dist/utils/mutationRoots.js";

function createElementNode(id) {
  return { nodeType: 1, id };
}

function createTextNode(parent, id) {
  return { nodeType: 3, parentElement: parent, id };
}

function createMutationRecord({ type = "childList", target, addedNodes = [] }) {
  return { type, target, addedNodes };
}

test("collectMutationConversionRoots collects element and text-parent roots", () => {
  const card = createElementNode("card");
  const text = createTextNode(card, "text");

  const roots = collectMutationConversionRoots(
    [
      createMutationRecord({ type: "characterData", target: text }),
      createMutationRecord({ addedNodes: [card] }),
    ],
    null,
  );

  expect(roots).toHaveLength(1);
  expect(roots[0]).toBe(card);
});

test("collectMutationConversionRoots ignores popup root and deduplicates roots", () => {
  const popupRoot = createElementNode("popup");
  const card = createElementNode("card");
  const text = createTextNode(card, "text");

  const roots = collectMutationConversionRoots(
    [
      createMutationRecord({ addedNodes: [popupRoot, card, text] }),
      createMutationRecord({ type: "characterData", target: text }),
    ],
    popupRoot,
  );

  expect(roots).toHaveLength(1);
  expect(roots[0]).toBe(card);
});

test("collectMutationConversionRoots returns empty for unrelated mutations", () => {
  const roots = collectMutationConversionRoots(
    [createMutationRecord({ type: "attributes", target: createElementNode("card") })],
    null,
  );

  expect(roots).toHaveLength(0);
});
