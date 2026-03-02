const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_FRAGMENT_NODE = 11;

function toConversionRoot(
  node: Node | null,
  popupRoot: Node | null,
): ParentNode | null {
  if (!node) return null;
  if (popupRoot && node === popupRoot) return null;

  if (node.nodeType === TEXT_NODE) {
    return node.parentElement;
  }

  if (node.nodeType === ELEMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE) {
    return node as ParentNode;
  }

  return null;
}

export function collectMutationConversionRoots(
  mutations: readonly MutationRecord[],
  popupRoot: Node | null,
): ParentNode[] {
  const roots = new Set<ParentNode>();

  for (const mutation of mutations) {
    if (mutation.type === "characterData") {
      const root = toConversionRoot(mutation.target, popupRoot);
      if (root) roots.add(root);
      continue;
    }

    if (!mutation.addedNodes.length) continue;

    mutation.addedNodes.forEach((node) => {
      const root = toConversionRoot(node, popupRoot);
      if (root) roots.add(root);
    });
  }

  return Array.from(roots);
}
