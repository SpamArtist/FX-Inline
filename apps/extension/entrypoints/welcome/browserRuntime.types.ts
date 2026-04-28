export type ExtensionRuntimeApi = {
  runtime: {
    id?: string;
    getURL(path: string): string;
    openOptionsPage?: () => Promise<void> | void;
  };
  tabs: {
    create(createProperties: { url: string }): Promise<void> | void;
  };
};

export type ExtensionRuntimeGlobal = typeof globalThis & {
  browser?: ExtensionRuntimeApi;
  chrome?: ExtensionRuntimeApi;
};
