export const INLINE_PLUGIN_PHASE_PRE = "pre";
export const INLINE_PLUGIN_PHASE_POST = "post";

function getPluginExecutor(plugin) {
  if (typeof plugin === "function") {
    return plugin;
  }

  if (plugin && typeof plugin.apply === "function") {
    return plugin.apply.bind(plugin);
  }

  return null;
}

function getPluginPhase(plugin) {
  if (!plugin || typeof plugin !== "object") {
    return null;
  }

  if (
    plugin.phase === INLINE_PLUGIN_PHASE_PRE ||
    plugin.phase === INLINE_PLUGIN_PHASE_POST
  ) {
    return plugin.phase;
  }

  return null;
}

function getPluginName(plugin) {
  if (plugin && typeof plugin === "object" && typeof plugin.name === "string") {
    return plugin.name;
  }

  return "<anonymous>";
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

export function runInlineConversionPlugins(plugins, context, expectedPhase) {
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return 0;
  }

  let conversionsApplied = 0;

  for (const plugin of plugins) {
    const execute = getPluginExecutor(plugin);
    if (!execute) continue;

    const declaredPhase = getPluginPhase(plugin);
    if (declaredPhase && expectedPhase && declaredPhase !== expectedPhase) {
      const pluginName = getPluginName(plugin);
      context.onPluginError?.(
        new Error(
          `Inline conversion plugin "${pluginName}" is declared for "${declaredPhase}" phase but ran in "${expectedPhase}" phase.`,
        ),
        plugin,
      );
      continue;
    }

    try {
      const result = execute(context);
      conversionsApplied += normalizeConversionCount(result);
    } catch (error) {
      context.onPluginError?.(error, plugin);
    }
  }

  return conversionsApplied;
}
