import { RGB_CHANNEL_REGEX } from "./constants.js";

function parseRgbChannels(colorValue) {
  if (!colorValue) return null;

  const matchedChannels = colorValue.match(RGB_CHANNEL_REGEX);
  if (!matchedChannels) return null;

  const redChannel = Number(matchedChannels[1]);
  const greenChannel = Number(matchedChannels[2]);
  const blueChannel = Number(matchedChannels[3]);

  if (
    !Number.isFinite(redChannel) ||
    !Number.isFinite(greenChannel) ||
    !Number.isFinite(blueChannel)
  ) {
    return null;
  }

  return {
    redChannel,
    greenChannel,
    blueChannel,
  };
}

function isLightTextColorValue(colorValue) {
  const channels = parseRgbChannels(colorValue);
  if (!channels) return false;

  const { redChannel, greenChannel, blueChannel } = channels;
  const perceivedLuminance =
    0.2126 * redChannel +
    0.7152 * greenChannel +
    0.0722 * blueChannel;

  return perceivedLuminance > 170;
}

export function usesLightTextColorForElement(element, lightTextCache) {
  const cached = lightTextCache?.get(element);
  if (cached !== undefined) return cached;

  const colorValue = getComputedStyle(element).color;
  const isLight = isLightTextColorValue(colorValue);
  lightTextCache?.set(element, isLight);
  return isLight;
}

export function usesLightTextColor(textNode, lightTextCache) {
  const parent = textNode.parentElement;
  if (!parent) return false;
  return usesLightTextColorForElement(parent, lightTextCache);
}
