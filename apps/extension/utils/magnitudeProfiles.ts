import type { MagnitudeProfile } from "./magnitudeProfiles.types";

const PROFILE_COMMON: MagnitudeProfile = {
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

const PROFILE_EN: MagnitudeProfile = {
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

const PROFILE_VI: MagnitudeProfile = {
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

const PROFILE_ID: MagnitudeProfile = {
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

const PROFILE_MS: MagnitudeProfile = {
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

const PROFILE_TR: MagnitudeProfile = {
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

const PROFILE_AZ: MagnitudeProfile = {
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

const PROFILE_AR: MagnitudeProfile = {
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

const PROFILE_FA: MagnitudeProfile = {
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

const PROFILE_HI: MagnitudeProfile = {
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

const PROFILE_MR: MagnitudeProfile = {
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

const PROFILE_BN: MagnitudeProfile = {
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

const PROFILE_UR: MagnitudeProfile = {
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

const PROFILE_ZH: MagnitudeProfile = {
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

const PROFILE_JA: MagnitudeProfile = {
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

const PROFILE_KO: MagnitudeProfile = {
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

const PROFILE_TH: MagnitudeProfile = {
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

const PROFILE_RU: MagnitudeProfile = {
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

const PROFILE_SW: MagnitudeProfile = {
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

// Long-scale locales that can conflict with English forms.
const PROFILE_DE: MagnitudeProfile = {
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

const PROFILE_FR: MagnitudeProfile = {
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

const PROFILE_IT: MagnitudeProfile = {
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

const PROFILE_ES: MagnitudeProfile = {
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

const PROFILE_PT_BR: MagnitudeProfile = {
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

const PROFILE_PT_PT: MagnitudeProfile = {
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

const ALL_PROFILES: readonly MagnitudeProfile[] = [
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

const DEFAULT_FALLBACK_PROFILES = ALL_PROFILES.filter(
  (profile) => !profile.requiresLocaleHint,
);

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase().replace(/_/g, "-");
}

function getLocaleCandidates(localeHint: string): string[] {
  const normalized = normalizeLocale(localeHint);
  if (!normalized) return [];

  const candidates = new Set<string>();
  candidates.add(normalized);

  const firstSegment = normalized.split("-")[0];
  if (firstSegment) {
    candidates.add(firstSegment);
  }

  return Array.from(candidates);
}

function dedupeProfiles(profiles: readonly MagnitudeProfile[]): MagnitudeProfile[] {
  const seen = new Set<string>();
  const deduped: MagnitudeProfile[] = [];

  for (const profile of profiles) {
    if (seen.has(profile.locale)) continue;
    seen.add(profile.locale);
    deduped.push(profile);
  }

  return deduped;
}

function getProfilesForLocaleHint(localeHint?: string | null): readonly MagnitudeProfile[] {
  if (!localeHint?.trim()) {
    return DEFAULT_FALLBACK_PROFILES;
  }

  const candidates = getLocaleCandidates(localeHint);
  if (!candidates.length) {
    return DEFAULT_FALLBACK_PROFILES;
  }

  const matchedLocaleProfiles = ALL_PROFILES.filter((profile) =>
    profile.locale !== "common" &&
    profile.locale !== "en" &&
    candidates.includes(profile.locale),
  );

  if (matchedLocaleProfiles.length > 0) {
    return dedupeProfiles([
      PROFILE_COMMON,
      PROFILE_EN,
      ...matchedLocaleProfiles,
    ]);
  }

  if (candidates.includes("en")) {
    return [PROFILE_COMMON, PROFILE_EN];
  }

  return DEFAULT_FALLBACK_PROFILES;
}

function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildProfileAliasMap(profile: MagnitudeProfile): Map<string, number> {
  const aliasMap = new Map<string, number>();

  for (const entry of profile.entries) {
    for (const alias of entry.aliases) {
      aliasMap.set(normalizeAlias(alias), entry.multiplier);
    }
  }

  return aliasMap;
}

const PROFILE_ALIAS_MAPS = new Map<string, Map<string, number>>(
  ALL_PROFILES.map((profile) => [profile.locale, buildProfileAliasMap(profile)]),
);

const MERGED_ALIAS_MAP_CACHE = new Map<string, Map<string, number>>();

function mergeProfileAliasMaps(profiles: readonly MagnitudeProfile[]): Map<string, number> {
  const aliasMap = new Map<string, number>();

  for (const profile of profiles) {
    const profileAliasMap = PROFILE_ALIAS_MAPS.get(profile.locale);
    if (!profileAliasMap) continue;

    for (const [alias, multiplier] of profileAliasMap) {
      aliasMap.set(alias, multiplier);
    }
  }

  return aliasMap;
}

function getAliasMapCacheKey(localeHint?: string | null): string {
  if (!localeHint?.trim()) return "__default__";
  return normalizeLocale(localeHint);
}

export function getMagnitudeAliasMap(localeHint?: string | null): Map<string, number> {
  const cacheKey = getAliasMapCacheKey(localeHint);
  const cached = MERGED_ALIAS_MAP_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const profiles = getProfilesForLocaleHint(localeHint);
  const aliasMap = mergeProfileAliasMaps(profiles);
  MERGED_ALIAS_MAP_CACHE.set(cacheKey, aliasMap);
  return aliasMap;
}
