import { collectMutationConversionRoots } from "../../test-dist/utils/mutationRoots.js";

function createElementNode(id) {
  return {
    nodeType: 1,
    id,
    parentNode: null,
    parentElement: null,
  };
}

function createTextNode(parent, id) {
  return { nodeType: 3, parentElement: parent, parentNode: parent, id };
}

function linkParent(child, parent) {
  child.parentNode = parent;
  child.parentElement = parent?.nodeType === 1 ? parent : null;
  return child;
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

test("collectMutationConversionRoots collapses descendant roots under ancestor", () => {
  const section = createElementNode("section");
  const card = linkParent(createElementNode("card"), section);
  const price = linkParent(createElementNode("price"), card);

  const roots = collectMutationConversionRoots(
    [createMutationRecord({ addedNodes: [card, price] })],
    null,
  );

  expect(roots).toHaveLength(1);
  expect(roots[0]).toBe(card);
});
