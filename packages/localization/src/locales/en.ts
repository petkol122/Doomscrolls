import type { LocalizationDictionary } from "../LocaleTypes";

export const en = {
  "origin.sewer_dweller.name": "Sewer Dweller",
  "origin.sewer_dweller.description":
    "Raised below the city where leaking pipes, old magic and bad decisions all drain to the same place.",

  "passive.nightvision.name": "Nightvision",
  "passive.nightvision.description":
    "Your eyes adjusted to places where daylight is only a rumor.",

  "class.gravewalker.name": "Gravewalker",
  "class.gravewalker.description":
    "A grim close-range survivor who treats grave dirt as a professional networking tool.",

  "enemy.trashboar_runt.name": "Trashboar Runt",
  "enemy.trashboar_runt.description":
    "A sewer-fed mutant with a bad temper, worse hygiene and enough tusk to ruin your evening.",

  "zone.nightmarket.name": "The Nightmarket",
  "zone.nightmarket.description":
    "A hidden market under dead neon where people buy protection, rumors and things that should not have barcodes.",

  "zone.blackwire_sewers.name": "Blackwire Sewers",
  "zone.blackwire_sewers.description":
    "Maintenance tunnels tangled with illegal cabling, occult runoff and hungry things in the dark.",

  "item.starter_pipe.name": "Starter Pipe",
  "item.starter_pipe.description":
    "A heavy length of pipe. Not elegant, but neither is dying.",

  "item.sewer_jacket.name": "Sewer Jacket",
  "item.sewer_jacket.description":
    "A stained jacket that has already survived worse nights than this one.",

  "item.starter_blood_flask.name": "Starter Blood Flask",
  "item.starter_blood_flask.description":
    "A reusable healing flask filled with something red enough to be useful.",

  "item.blackwire_scrap.name": "Blackwire Scrap",
  "item.blackwire_scrap.description":
    "A twisted piece of conductive junk that still hums when nobody is touching it.",

  "skill.heavy_strike.name": "Heavy Strike",
  "skill.heavy_strike.description":
    "A deliberate attack that solves immediate problems through blunt force.",

  "auth.username": "Username",
  "auth.password": "Password",
  "auth.login": "Log in",
  "auth.register": "Register",
  "auth.logout": "Log out",

  "profile.display_name": "Display name",
  "profile.avatar": "Avatar",

  "settings.master_volume": "Master volume",
  "settings.music_volume": "Music volume",
  "settings.sfx_volume": "SFX volume",
  "settings.show_fps_counter": "Show FPS counter",

  "character.create": "Create character",
  "character.select": "Select character",
  "character.name": "Character name",
  "character.origin": "Origin",
  "character.class": "Class",

  "inventory.title": "Inventory",
  "equipment.title": "Equipment",
  "equipment.slot.weapon": "Weapon",
  "equipment.slot.head": "Head",
  "equipment.slot.chest": "Chest",
  "equipment.slot.hands": "Hands",
  "equipment.slot.feet": "Feet",
  "equipment.slot.ring_1": "Ring",
  "equipment.slot.amulet": "Amulet",
  "equipment.slot.belt": "Belt",
  "equipment.slot.flask_1": "Flask",

  "error.generic": "Something went wrong.",
  "error.missing_localization_key": "Missing localization key: {key}"
} as const satisfies LocalizationDictionary;

export type LocalizationKey = keyof typeof en;