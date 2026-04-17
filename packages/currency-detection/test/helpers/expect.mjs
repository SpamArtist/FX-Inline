import assert from "node:assert/strict";

function createNegated(actual) {
  return {
    toBe(expected) {
      assert.notStrictEqual(actual, expected);
    },
    toEqual(expected) {
      assert.notDeepStrictEqual(actual, expected);
    },
    toContain(expected) {
      assert.ok(!String(actual).includes(expected));
    },
    toMatch(expected) {
      assert.doesNotMatch(String(actual), expected);
    },
  };
}

export function expect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected);
    },
    toHaveLength(expectedLength) {
      assert.strictEqual(actual.length, expectedLength);
    },
    toContain(expected) {
      assert.ok(String(actual).includes(expected));
    },
    toMatch(expected) {
      assert.match(String(actual), expected);
    },
    toBeGreaterThan(expected) {
      assert.ok(actual > expected);
    },
    toBeNull() {
      assert.strictEqual(actual, null);
    },
    toBeTruthy() {
      assert.ok(actual);
    },
    toBeFalsy() {
      assert.ok(!actual);
    },
    get not() {
      return createNegated(actual);
    },
  };
}
