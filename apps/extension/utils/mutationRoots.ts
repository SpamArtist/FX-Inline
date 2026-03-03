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
  if (ancestor === node) return true;

  const contains = (ancestor as Node).contains;
  if (typeof contains === "function") {
    return contains.call(ancestor as Node, node as Node);
  }

  let cursor: Node | null =
    ((node as unknown as { parentNode?: Node | null }).parentNode ??
      (node as unknown as { parentElement?: Element | null }).parentElement ??
      null);

  while (cursor) {
    if (cursor === (ancestor as Node)) return true;
    cursor =
      (cursor as { parentNode?: Node | null }).parentNode ??
      (cursor as { parentElement?: Element | null }).parentElement ??
      null;
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

    mutation.addedNodes.forEach((node) => {
      const root = toConversionRoot(node, popupRoot);
      if (root) roots.add(root);
    });
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
