const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_FRAGMENT_NODE = 11;

function getNodeDepth(node) {
  let depth = 0;
  let cursor = node;

  while (cursor?.parentNode) {
    depth += 1;
    cursor = cursor.parentNode;
  }

  return depth;
}

function isNodeContainedBy(ancestor, node) {
  if (ancestor === node) return true;

  if (typeof ancestor.contains === "function") {
    return ancestor.contains(node);
  }

  let cursor = node.parentNode;

  while (cursor) {
    if (cursor === ancestor) return true;
    cursor = cursor.parentNode;
  }

  return false;
}

function toConversionRoot(node) {
  if (!node) return null;

  if (node.nodeType === TEXT_NODE) {
    return node.parentElement;
  }

  if (node.nodeType === ELEMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE) {
    return node;
  }

  return null;
}

export function collectMutationConversionRoots(mutations, shouldExcludeRoot) {
  const roots = new Set();

  for (const mutation of mutations) {
    if (mutation.type === "characterData") {
      const root = toConversionRoot(mutation.target);
      if (!root) continue;
      if (shouldExcludeRoot?.(root)) continue;
      roots.add(root);
      continue;
    }

    if (!mutation.addedNodes.length) continue;

    for (const node of mutation.addedNodes) {
      const root = toConversionRoot(node);
      if (!root) continue;
      if (shouldExcludeRoot?.(root)) continue;
      roots.add(root);
    }
  }

  const sortedRoots = Array.from(roots).sort(
    (a, b) => getNodeDepth(a) - getNodeDepth(b),
  );

  const collapsedRoots = [];

  for (const root of sortedRoots) {
    const alreadyCovered = collapsedRoots.some((candidate) =>
      isNodeContainedBy(candidate, root),
    );
    if (alreadyCovered) continue;

    collapsedRoots.push(root);
  }

  return collapsedRoots;
}
