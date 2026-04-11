import { RGB_CHANNEL_REGEX } from "./constants";

function parseRgbChannels(input: string): [number, number, number] | null {
  const matched = input.match(RGB_CHANNEL_REGEX);
  if (!matched) return null;

  const r = Number(matched[1]);
  const g = Number(matched[2]);
  const b = Number(matched[3]);

  if (
    !Number.isFinite(r) ||
    !Number.isFinite(g) ||
    !Number.isFinite(b) ||
    r < 0 ||
    r > 255 ||
    g < 0 ||
    g > 255 ||
    b < 0 ||
    b > 255
  ) {
    return null;
  }

  return [r, g, b];
}

function toLinearRgb(channel: number): number {
  const normalized = channel / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }

  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * toLinearRgb(r) + 0.7152 * toLinearRgb(g) + 0.0722 * toLinearRgb(b);
}

export function usesLightTextColor(
  node: Text,
  lightTextCache?: WeakMap<Element, boolean>,
): boolean {
  const parent = node.parentElement;
  if (!parent) return false;

  return usesLightTextColorForElement(parent, lightTextCache);
}

export function usesLightTextColorForElement(
  target: Element,
  lightTextCache?: WeakMap<Element, boolean>,
): boolean {
  if (lightTextCache?.has(target)) {
    return lightTextCache.get(target) ?? false;
  }

  const color = window.getComputedStyle(target).color;
  const rgb = parseRgbChannels(color);
  if (!rgb) {
    lightTextCache?.set(target, false);
    return false;
  }

  const isLightText = relativeLuminance(rgb) >= 0.6;
  lightTextCache?.set(target, isLightText);
  return isLightText;
}
