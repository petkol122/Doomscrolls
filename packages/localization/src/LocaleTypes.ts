export type LocaleCode = "en";

export const DEFAULT_LOCALE: LocaleCode = "en";

export const SUPPORTED_LOCALES = [DEFAULT_LOCALE] as const satisfies readonly LocaleCode[];

export type LocalizationDictionary = Record<string, string>;

export type TranslationParams = Record<string, string | number>;

export interface TranslateOptions {
  locale?: LocaleCode;
  params?: TranslationParams;
}

export const REQUIRED_LOCALIZATION_KEYS = [
  "origin.sewer_dweller.name",
  "origin.sewer_dweller.description",
  "passive.nightvision.name",
  "passive.nightvision.description",
  "class.gravewalker.name",
  "class.gravewalker.description",
  "enemy.trashboar_runt.name",
  "enemy.trashboar_runt.description",
  "zone.nightmarket.name",
  "zone.nightmarket.description",
  "zone.blackwire_sewers.name",
  "zone.blackwire_sewers.description",
  "item.starter_pipe.name",
  "item.starter_pipe.description",
  "item.sewer_jacket.name",
  "item.sewer_jacket.description",
  "item.starter_blood_flask.name",
  "item.starter_blood_flask.description",
  "item.blackwire_scrap.name",
  "item.blackwire_scrap.description",
  "skill.heavy_strike.name",
  "skill.heavy_strike.description",
  "auth.username",
  "auth.password",
  "auth.login",
  "auth.register",
  "auth.logout",
  "auth.title",
  "auth.register_title",
  "auth.login_title",
  "auth.account_loaded",
  "auth.no_characters",
  "auth.api_url_missing",
  "auth.loading_session",
  "profile.display_name",
  "profile.avatar",
  "settings.master_volume",
  "settings.music_volume",
  "settings.sfx_volume",
  "settings.show_fps_counter",
  "character.create",
  "character.select",
  "character.list",
  "character.name",
  "character.origin",
  "character.class",
  "character.level",
  "character.create_success",
  "world_entry.title",
  "world_entry.enter_world",
  "world_entry.coming_next",
  "world_entry.no_character_selected",
  "world_entry.connected",
  "world_entry.join_failed",
  "world_entry.leave_world",
  "inventory.title",
  "equipment.title",
  "equipment.slot.weapon",
  "equipment.slot.head",
  "equipment.slot.chest",
  "equipment.slot.hands",
  "equipment.slot.feet",
  "equipment.slot.ring_1",
  "equipment.slot.amulet",
  "equipment.slot.belt",
  "equipment.slot.flask_1",
  "error.generic",
  "error.server_unavailable",
  "error.invalid_register_input",
  "error.duplicate_username",
  "error.invalid_credentials",
  "error.invalid_token",
  "error.invalid_character_create_input",
  "error.duplicate_character_name",
  "error.missing_localization_key"
] as const;

export type RequiredLocalizationKey = (typeof REQUIRED_LOCALIZATION_KEYS)[number];