import {
  DEFAULT_LOCALE,
  REQUIRED_LOCALIZATION_KEYS,
  type LocaleCode,
  type RequiredLocalizationKey,
  type TranslateOptions,
  type TranslationParams
} from "./LocaleTypes";
import { en, type LocalizationKey } from "./locales/en";

const dictionaries: Record<LocaleCode, Record<LocalizationKey, string>> = {
  en
};

function interpolate(template: string, params: TranslationParams | undefined): string {
  if (params === undefined) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, paramName: string) => {
    const value = params[paramName];
    return value === undefined ? match : String(value);
  });
}

export function translate(key: LocalizationKey, options: TranslateOptions = {}): string {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const dictionary = dictionaries[locale];
  const value = dictionary[key];

  if (value === undefined) {
    return `[missing:${key}]`;
  }

  return interpolate(value, options.params);
}

export function t(key: LocalizationKey, params?: TranslationParams): string {
  return params === undefined ? translate(key) : translate(key, { params });
}

export interface LocalizationValidationResult {
  readonly valid: boolean;
  readonly missingKeys: readonly RequiredLocalizationKey[];
}

export function validateLocalizationKeys(
  keys: readonly RequiredLocalizationKey[] = REQUIRED_LOCALIZATION_KEYS
): LocalizationValidationResult {
  const missingKeys = keys.filter((key) => en[key] === undefined);

  return {
    valid: missingKeys.length === 0,
    missingKeys
  };
}