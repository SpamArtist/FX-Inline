import { jest } from "@jest/globals";

const getMock = jest.fn();
const setMock = jest.fn();
const addListenerMock = jest.fn();
const removeListenerMock = jest.fn();

async function importLocalStorageModule() {
  jest.resetModules();

  await jest.unstable_mockModule("wxt/browser", () => ({
    browser: {
      storage: {
        local: {
          get: getMock,
          set: setMock,
        },
        onChanged: {
          addListener: addListenerMock,
          removeListener: removeListenerMock,
        },
      },
    },
  }));

  return import("../../test-dist/utils/localStorage.js");
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("readLocalStorageValue returns the stored raw local value", async () => {
  getMock.mockResolvedValue({
    "user-settings": { enabled: false },
  });
  const { readLocalStorageValue } = await importLocalStorageModule();

  await expect(
    readLocalStorageValue("user-settings", { enabled: true }),
  ).resolves.toEqual({ enabled: false });

  expect(getMock).toHaveBeenCalledWith("user-settings");
});

test("readLocalStorageValue falls back when local storage has no value", async () => {
  getMock.mockResolvedValue({});
  const { readLocalStorageValue } = await importLocalStorageModule();

  await expect(
    readLocalStorageValue("rate-cache", null),
  ).resolves.toBeNull();
});

test("writeLocalStorageValue writes the raw local key", async () => {
  const { writeLocalStorageValue } = await importLocalStorageModule();

  await writeLocalStorageValue("rate-cache", { base: "USD" });

  expect(setMock).toHaveBeenCalledWith({
    "rate-cache": { base: "USD" },
  });
});

test("watchLocalStorageValue only forwards matching local changes", async () => {
  const { watchLocalStorageValue } = await importLocalStorageModule();
  const callback = jest.fn();

  const unwatch = watchLocalStorageValue("user-settings", callback);
  const listener = addListenerMock.mock.calls[0][0];

  listener(
    {
      "other-key": {
        newValue: { enabled: false },
      },
    },
    "local",
  );
  listener(
    {
      "user-settings": {
        newValue: { enabled: false },
        oldValue: { enabled: true },
      },
    },
    "sync",
  );
  listener(
    {
      "user-settings": {
        newValue: { enabled: false },
        oldValue: { enabled: true },
      },
    },
    "local",
  );

  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(
    { enabled: false },
    { enabled: true },
  );

  unwatch();

  expect(removeListenerMock).toHaveBeenCalledWith(listener);
});
