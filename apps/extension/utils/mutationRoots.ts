const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_FRAGMENT_NODE = 11;

function getNodeDepth(node: ParentNode): number {
  let depth = 0;
  let cursor: Node | null = node as Node;

  while (cursor?.parentNode) {
    depth += 1;
    cursor = cursor.parentNode;
  }

  return depth;
}

function isNodeContainedBy(ancestor: ParentNode, node: ParentNode): boolean {
  const ancestorNode = ancestor as Node;
  const nodeAsNode = node as Node;
  if (ancestorNode === nodeAsNode) return true;

  if (typeof ancestorNode.contains === "function") {
    return ancestorNode.contains(nodeAsNode);
  }

  let cursor: Node | null = nodeAsNode.parentNode;

  while (cursor) {
    if (cursor === ancestorNode) return true;
    cursor = cursor.parentNode;
  }

  return false;
}

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

    for (const node of mutation.addedNodes) {
      const root = toConversionRoot(node, popupRoot);
      if (root) roots.add(root);
    }
  }

  const sortedRoots = Array.from(roots).sort(
    (a, b) => getNodeDepth(a) - getNodeDepth(b),
  );

  const collapsedRoots: ParentNode[] = [];

  for (const root of sortedRoots) {
    const alreadyCovered = collapsedRoots.some((candidate) =>
      isNodeContainedBy(candidate, root),
    );
    if (alreadyCovered) continue;

    collapsedRoots.push(root);
  }

  return collapsedRoots;
}
