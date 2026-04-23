function getPluginExecutor(plugin) {
  if (typeof plugin === "function") {
    return plugin;
  }

  if (plugin && typeof plugin.apply === "function") {
    return plugin.apply.bind(plugin);
  }

  return null;
}

function normalizeConversionCount(result) {
  if (typeof result === "number" && Number.isFinite(result)) {
    return result;
  }

  if (
    result &&
    typeof result === "object" &&
    typeof result.conversionsApplied === "number" &&
    Number.isFinite(result.conversionsApplied)
  ) {
    return result.conversionsApplied;
  }

  return 0;
}

export function runInlineConversionPlugins(plugins, context) {
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return 0;
  }

  let conversionsApplied = 0;

  for (const plugin of plugins) {
    const execute = getPluginExecutor(plugin);
    if (!execute) continue;

    try {
      const result = execute(context);
      conversionsApplied += normalizeConversionCount(result);
    } catch (error) {
      context.onPluginError?.(error, plugin);
    }
  }

  return conversionsApplied;
}
