/** Stable FNV-1a hash of English text, using UTF-16 code units in every runtime. */
export function messageKey(english: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < english.length; index++) {
    hash = Math.imul(hash ^ english.charCodeAt(index), 0x01000193);
  }
  return `text_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function placeholderNames(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(/\{([a-z][a-z0-9_]*)\}/gi),
    (match) => match[1]))].sort();
}
