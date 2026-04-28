function getNamespaceMap(store, namespace, shouldCreate = false) {
  const normalizedNamespace = String(namespace);
  const existing = store.get(normalizedNamespace);
  if (existing) return existing;
  if (!shouldCreate) return null;

  const created = new Map();
  store.set(normalizedNamespace, created);
  return created;
}

function createRandomPassToken() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createInlinePassIdFactory() {
  let passSequence = 0;

  return () => {
    passSequence += 1;
    return `inline-pass-${passSequence}`;
  };
}

export function createInlinePassId() {
  return `inline-pass-${createRandomPassToken()}`;
}

export function createInlinePassContext(passId = createInlinePassId()) {
  const store = new Map();

  return {
    passId,
    set(namespace, key, value) {
      const namespaceMap = getNamespaceMap(store, namespace, true);
      namespaceMap.set(String(key), value);
      return value;
    },
    get(namespace, key) {
      const namespaceMap = getNamespaceMap(store, namespace);
      if (!namespaceMap) return undefined;
      return namespaceMap.get(String(key));
    },
    consume(namespace, key) {
      const namespaceMap = getNamespaceMap(store, namespace);
      if (!namespaceMap) return undefined;

      const normalizedKey = String(key);
      const value = namespaceMap.get(normalizedKey);
      namespaceMap.delete(normalizedKey);
      if (namespaceMap.size === 0) {
        store.delete(String(namespace));
      }
      return value;
    },
    push(namespace, key, item) {
      const namespaceMap = getNamespaceMap(store, namespace, true);
      const normalizedKey = String(key);
      const existing = namespaceMap.get(normalizedKey);
      if (Array.isArray(existing)) {
        existing.push(item);
        return existing.length;
      }

      namespaceMap.set(normalizedKey, [item]);
      return 1;
    },
    list(namespace, key) {
      const namespaceMap = getNamespaceMap(store, namespace);
      if (!namespaceMap) return [];

      const value = namespaceMap.get(String(key));
      if (!Array.isArray(value)) return [];
      return [...value];
    },
    clear() {
      store.clear();
    },
  };
}
