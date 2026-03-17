export type MagnitudeEntry = {
  multiplier: number;
  aliases: readonly string[];
};

export type MagnitudeProfile = {
  locale: string;
  entries: readonly MagnitudeEntry[];
  // Use for locales where terms collide with other language scales.
  requiresLocaleHint?: boolean;
};
