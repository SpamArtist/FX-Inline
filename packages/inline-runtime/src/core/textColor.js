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
    !Number.isFinite(blueChannel) ||
    redChannel < 0 ||
    redChannel > 255 ||
    greenChannel < 0 ||
    greenChannel > 255 ||
    blueChannel < 0 ||
    blueChannel > 255
  ) {
    return null;
  }

  return [redChannel, greenChannel, blueChannel];
}

function toLinearRgb(channel) {
  const normalized = channel / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }

  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance([redChannel, greenChannel, blueChannel]) {
  return (
    0.2126 * toLinearRgb(redChannel) +
    0.7152 * toLinearRgb(greenChannel) +
    0.0722 * toLinearRgb(blueChannel)
  );
}

function isLightTextColorValue(colorValue) {
  const channels = parseRgbChannels(colorValue);
  if (!channels) return false;

  return getRelativeLuminance(channels) >= 0.6;
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
