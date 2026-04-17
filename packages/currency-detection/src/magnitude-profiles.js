const PROFILE_COMMON = {
  locale: "common",
  entries: [
    {
      multiplier: 1_000,
      aliases: ["k"],
    },
    {
      multiplier: 1_000_000,
      aliases: ["m", "mn", "mm"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["b", "bn"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["t", "tn"],
    },
  ],
};

const PROFILE_EN = {
  locale: "en",
  entries: [
    {
      multiplier: 100_000,
      aliases: ["lakh", "lac", "lakhs", "lacs"],
    },
    {
      multiplier: 1_000_000,
      aliases: ["million", "millions"],
    },
    {
      multiplier: 10_000_000,
      aliases: ["crore", "crores", "cr"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["billion", "billions"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["trillion", "trillions"],
    },
  ],
};

const PROFILE_VI = {
  locale: "vi",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["triệu", "trieu"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["tỷ", "tỉ", "ty"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["nghìn tỷ", "nghin ty", "ngàn tỷ", "ngan ty"],
    },
  ],
};

const PROFILE_ID = {
  locale: "id",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["juta"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["miliar"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["triliun"],
    },
  ],
};

const PROFILE_MS = {
  locale: "ms",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["juta"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["bilion"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["trilion"],
    },
  ],
};

const PROFILE_TR = {
  locale: "tr",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["milyon"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["milyar"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["trilyon"],
    },
  ],
};

const PROFILE_AZ = {
  locale: "az",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["milyon"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["milyard"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["trilyon"],
    },
  ],
};

const PROFILE_AR = {
  locale: "ar",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["مليون", "ملايين"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["مليار", "مليارات"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["تريليون", "تريليونات"],
    },
  ],
};

const PROFILE_FA = {
  locale: "fa",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["میلیون"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["میلیارد"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["تریلیون"],
    },
  ],
};

const PROFILE_HI = {
  locale: "hi",
  entries: [
    {
      multiplier: 100_000,
      aliases: ["लाख"],
    },
    {
      multiplier: 10_000_000,
      aliases: ["करोड़", "करोड़"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["अरब"],
    },
    {
      multiplier: 100_000_000_000,
      aliases: ["खरब"],
    },
  ],
};

const PROFILE_MR = {
  locale: "mr",
  entries: [
    {
      multiplier: 100_000,
      aliases: ["लाख"],
    },
    {
      multiplier: 10_000_000,
      aliases: ["कोटी"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["अब्ज"],
    },
    {
      multiplier: 100_000_000_000,
      aliases: ["खरब"],
    },
  ],
};

const PROFILE_BN = {
  locale: "bn",
  entries: [
    {
      multiplier: 100_000,
      aliases: ["লাখ"],
    },
    {
      multiplier: 10_000_000,
      aliases: ["কোটি"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["আরব"],
    },
  ],
};

const PROFILE_UR = {
  locale: "ur",
  entries: [
    {
      multiplier: 100_000,
      aliases: ["لاکھ"],
    },
    {
      multiplier: 10_000_000,
      aliases: ["کروڑ"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["ارب"],
    },
    {
      multiplier: 100_000_000_000,
      aliases: ["کھرب"],
    },
  ],
};

const PROFILE_ZH = {
  locale: "zh",
  entries: [
    {
      multiplier: 10_000,
      aliases: ["万", "萬"],
    },
    {
      multiplier: 100_000_000,
      aliases: ["亿", "億"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["万亿", "萬億", "兆"],
    },
  ],
};

const PROFILE_JA = {
  locale: "ja",
  entries: [
    {
      multiplier: 10_000,
      aliases: ["万"],
    },
    {
      multiplier: 100_000_000,
      aliases: ["億"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["兆"],
    },
  ],
};

const PROFILE_KO = {
  locale: "ko",
  entries: [
    {
      multiplier: 10_000,
      aliases: ["만"],
    },
    {
      multiplier: 100_000_000,
      aliases: ["억"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["조"],
    },
  ],
};

const PROFILE_TH = {
  locale: "th",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["ล้าน"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["พันล้าน"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["ล้านล้าน"],
    },
  ],
};

const PROFILE_RU = {
  locale: "ru",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["миллион", "миллиона", "миллионов"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["миллиард", "миллиарда", "миллиардов"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["триллион", "триллиона", "триллионов"],
    },
  ],
};

const PROFILE_SW = {
  locale: "sw",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["milioni"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["bilioni"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["trilioni"],
    },
  ],
};

const PROFILE_DE = {
  locale: "de",
  requiresLocaleHint: true,
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["million", "millionen"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["milliarde", "milliarden"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["billion", "billionen"],
    },
  ],
};

const PROFILE_FR = {
  locale: "fr",
  requiresLocaleHint: true,
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["million", "millions"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["milliard", "milliards"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["billion", "billions"],
    },
  ],
};

const PROFILE_IT = {
  locale: "it",
  requiresLocaleHint: true,
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["milione", "milioni"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["miliardo", "miliardi"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["bilione", "bilioni"],
    },
  ],
};

const PROFILE_ES = {
  locale: "es",
  requiresLocaleHint: true,
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["millón", "millon", "millones"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["mil millones"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["billón", "billon", "billones"],
    },
  ],
};

const PROFILE_PT_BR = {
  locale: "pt-br",
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["milhão", "milhao", "milhões", "milhoes"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["bilhão", "bilhao", "bilhões", "bilhoes"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["trilhão", "trilhao", "trilhões", "trilhoes"],
    },
  ],
};

const PROFILE_PT_PT = {
  locale: "pt-pt",
  requiresLocaleHint: true,
  entries: [
    {
      multiplier: 1_000_000,
      aliases: ["milhão", "milhao", "milhões", "milhoes"],
    },
    {
      multiplier: 1_000_000_000,
      aliases: ["mil milhões"],
    },
    {
      multiplier: 1_000_000_000_000,
      aliases: ["bilião", "biliao", "biliões", "bilioes"],
    },
  ],
};

const DEFAULT_PROFILES = [
  PROFILE_COMMON,
  PROFILE_EN,
  PROFILE_VI,
  PROFILE_ID,
  PROFILE_MS,
  PROFILE_TR,
  PROFILE_AZ,
  PROFILE_AR,
  PROFILE_FA,
  PROFILE_HI,
  PROFILE_MR,
  PROFILE_BN,
  PROFILE_UR,
  PROFILE_ZH,
  PROFILE_JA,
  PROFILE_KO,
  PROFILE_TH,
  PROFILE_RU,
  PROFILE_SW,
  PROFILE_DE,
  PROFILE_FR,
  PROFILE_IT,
  PROFILE_ES,
  PROFILE_PT_BR,
  PROFILE_PT_PT,
];

function normalizeLocale(locale) {
  return locale.trim().toLowerCase().replace(/_/g, "-");
}

function normalizeAlias(alias) {
  return alias.trim().toLowerCase().replace(/\s+/g, " ");
}

function getLocaleCandidates(localeHint) {
  const normalized = normalizeLocale(localeHint);
  if (!normalized) return [];

  const candidates = new Set();
  candidates.add(normalized);

  const firstSegment = normalized.split("-")[0];
  if (firstSegment) {
    candidates.add(firstSegment);
  }

  return Array.from(candidates);
}

function dedupeProfiles(profiles) {
  const seen = new Set();
  const deduped = [];

  for (const profile of profiles) {
    if (seen.has(profile.locale)) continue;
    seen.add(profile.locale);
    deduped.push(profile);
  }

  return deduped;
}

function buildProfileAliasMap(profile) {
  const aliasMap = new Map();

  for (const entry of profile.entries) {
    for (const alias of entry.aliases) {
      aliasMap.set(normalizeAlias(alias), entry.multiplier);
    }
  }

  return aliasMap;
}

function mergeProfileAliasMaps(profiles, profileAliasMaps) {
  const aliasMap = new Map();

  for (const profile of profiles) {
    const profileAliasMap = profileAliasMaps.get(profile.locale);
    if (!profileAliasMap) continue;

    for (const [alias, multiplier] of profileAliasMap) {
      aliasMap.set(alias, multiplier);
    }
  }

  return aliasMap;
}

function getAliasMapCacheKey(localeHint) {
  if (!localeHint?.trim()) return "__default__";
  return normalizeLocale(localeHint);
}

function getProfilesForLocaleHint(localeHint, allProfiles, defaultFallbackProfiles) {
  if (!localeHint?.trim()) {
    return defaultFallbackProfiles;
  }

  const candidates = getLocaleCandidates(localeHint);
  if (!candidates.length) {
    return defaultFallbackProfiles;
  }

  const matchedLocaleProfiles = allProfiles.filter(
    (profile) =>
      profile.locale !== "common" &&
      profile.locale !== "en" &&
      candidates.includes(profile.locale),
  );

  if (matchedLocaleProfiles.length > 0) {
    return dedupeProfiles([PROFILE_COMMON, PROFILE_EN, ...matchedLocaleProfiles]);
  }

  if (candidates.includes("en")) {
    return [PROFILE_COMMON, PROFILE_EN];
  }

  return defaultFallbackProfiles;
}

function buildAliasSet(profiles) {
  const aliases = new Set();

  for (const profile of profiles) {
    for (const entry of profile.entries) {
      for (const alias of entry.aliases) {
        aliases.add(normalizeAlias(alias));
      }
    }
  }

  return aliases;
}

function validateExtraProfiles(extraProfilesInput) {
  if (extraProfilesInput == null) return [];
  if (!Array.isArray(extraProfilesInput)) {
    throw new Error("extraMagnitudeProfiles must be an array.");
  }

  if (extraProfilesInput.length > 100) {
    throw new Error("extraMagnitudeProfiles exceeds safety limit.");
  }

  return extraProfilesInput.map((profile, profileIndex) => {
    if (!profile || typeof profile !== "object") {
      throw new Error(`extraMagnitudeProfiles[${profileIndex}] must be an object.`);
    }

    if (typeof profile.locale !== "string" || profile.locale.trim().length === 0) {
      throw new Error(`extraMagnitudeProfiles[${profileIndex}].locale must be a non-empty string.`);
    }

    const locale = normalizeLocale(profile.locale);
    if (!Array.isArray(profile.entries) || profile.entries.length === 0) {
      throw new Error(`extraMagnitudeProfiles[${profileIndex}].entries must be a non-empty array.`);
    }

    const entries = profile.entries.map((entry, entryIndex) => {
      if (!entry || typeof entry !== "object") {
        throw new Error(
          `extraMagnitudeProfiles[${profileIndex}].entries[${entryIndex}] must be an object.`,
        );
      }

      if (!Number.isFinite(entry.multiplier) || entry.multiplier <= 0) {
        throw new Error(
          `extraMagnitudeProfiles[${profileIndex}].entries[${entryIndex}].multiplier must be a finite positive number.`,
        );
      }

      if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) {
        throw new Error(
          `extraMagnitudeProfiles[${profileIndex}].entries[${entryIndex}].aliases must be a non-empty array.`,
        );
      }

      if (entry.aliases.length > 100) {
        throw new Error(
          `extraMagnitudeProfiles[${profileIndex}].entries[${entryIndex}].aliases exceeds safety limit.`,
        );
      }

      const aliases = entry.aliases.map((alias, aliasIndex) => {
        if (typeof alias !== "string" || alias.trim().length === 0) {
          throw new Error(
            `extraMagnitudeProfiles[${profileIndex}].entries[${entryIndex}].aliases[${aliasIndex}] must be a non-empty string.`,
          );
        }

        if (alias.trim().length > 64) {
          throw new Error(
            `extraMagnitudeProfiles[${profileIndex}].entries[${entryIndex}].aliases[${aliasIndex}] exceeds safety limit.`,
          );
        }

        return alias;
      });

      return {
        multiplier: entry.multiplier,
        aliases,
      };
    });

    return {
      locale,
      requiresLocaleHint: profile.requiresLocaleHint === true,
      entries,
    };
  });
}

export function createMagnitudeAliasResolver(extraProfilesInput) {
  const extraProfiles = validateExtraProfiles(extraProfilesInput);

  const defaultAliasSet = buildAliasSet(DEFAULT_PROFILES);
  const seenExtraAliases = new Set();

  for (const profile of extraProfiles) {
    for (const entry of profile.entries) {
      for (const alias of entry.aliases) {
        const normalizedAlias = normalizeAlias(alias);
        if (defaultAliasSet.has(normalizedAlias)) {
          throw new Error(
            `extraMagnitudeProfiles cannot override existing alias: ${alias}`,
          );
        }

        if (seenExtraAliases.has(normalizedAlias)) {
          throw new Error(
            `extraMagnitudeProfiles contains duplicate alias: ${alias}`,
          );
        }

        seenExtraAliases.add(normalizedAlias);
      }
    }
  }

  const allProfiles = [...DEFAULT_PROFILES, ...extraProfiles];
  const defaultFallbackProfiles = allProfiles.filter(
    (profile) => !profile.requiresLocaleHint,
  );

  const profileAliasMaps = new Map(
    allProfiles.map((profile) => [profile.locale, buildProfileAliasMap(profile)]),
  );

  const mergedAliasMapCache = new Map();

  return function getMagnitudeAliasMap(localeHint) {
    const cacheKey = getAliasMapCacheKey(localeHint);
    const cached = mergedAliasMapCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const profiles = getProfilesForLocaleHint(
      localeHint,
      allProfiles,
      defaultFallbackProfiles,
    );
    const aliasMap = mergeProfileAliasMaps(profiles, profileAliasMaps);
    mergedAliasMapCache.set(cacheKey, aliasMap);
    return aliasMap;
  };
}
