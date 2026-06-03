export type {
  LocaleCode,
  LocalizationDictionary,
  RequiredLocalizationKey,
  TranslateOptions,
  TranslationParams
} from "./LocaleTypes";
export { DEFAULT_LOCALE, REQUIRED_LOCALIZATION_KEYS, SUPPORTED_LOCALES } from "./LocaleTypes";

export { translate, t, validateLocalizationKeys } from "./LocalizationService";
export type { LocalizationValidationResult } from "./LocalizationService";

export { en } from "./locales/en";
export type { LocalizationKey } from "./locales/en";