# docs/GAME_DESIGN.md — Doomscrolls Game Design

## Game Identity

Doomscrolls is a modern dark-fantasy online ARPG with Diablo 2-like pacing, click-to-move identity, persistent characters, loot-driven progression and scalable room-based online world architecture.

Its visual target is a fixed Diablo-like isometric / 2.5D presentation. The current top-down debug world view is temporary and exists only to support early foundation and verification work.

The game starts in the Czech Republic, but the long-term world is planetary.

---

## Tone

```text
dark fantasy with dry black humor
```

Think cyberpunk, but 2026 rather than distant sci-fi.

The world should feel serious, bleak, urban, strange and occasionally funny.

---

## Visual Presentation Direction

```text
fixed isometric / 2.5D ARPG presentation
Phaser 2D runtime
no free 3D camera
no engine switch
later asset direction may use pre-rendered / 2D sprite art
later scene depth comes from depth sorting, layered objects and shadows
```

The intended feel is Diablo-like readability, atmosphere and spatial clarity from a locked viewpoint rather than from camera freedom. Early placeholder/debug views may remain top-down while networking, rooms, movement, combat and interaction foundations are being built, but that debug presentation is not the intended final player-facing camera language.

---

## World

Long-term hierarchy:

```text
Earth
  Country
    Region / Kraj
      City / Zone
        Room / Instance
```

Starting country:

```text
Czech Republic
```

Czech Republic can later be divided into kraje as playable regions.

Core 0.1 uses only a tiny first playable area:

```text
The Nightmarket
Blackwire Sewers
```

---

## Main Antagonistic Force

```text
Moloch
```

Moloch is an entity/system/archetype representing the modern world, cursed internet, digital occultism, evil corporations, demonic systems, consumption, bureaucracy and hell leaking through normal life.

Do not over-explain Moloch early.

---

## Magic and Powers

Avoid Harry Potter-style clean spell fantasy.

Preferred sources:

```text
religion
occult practice
urban folklore
cursed technology
digital infection
corporate experiments
signal corruption
ritual damage
unexplained phenomena
```

---

## Core 0.1 Content

- First Origin: Sewer Dweller
- Passive: Nightvision
- First Class: Gravewalker
- First Enemy: Trashboar Runt
- First Hub: The Nightmarket
- First Combat Zone: Blackwire Sewers

These locked Core 0.1 definitions are represented as data in `packages/content` and resolved through the content registry. Systems must consume registry data instead of embedding origin, class, enemy, item, zone, loot table or level values directly in gameplay code.

The initial content registry includes definitions for `sewer_dweller`, `nightvision`, `gravewalker`, `heavy_strike`, `trashboar_runt`, `nightmarket`, `blackwire_sewers`, `starter_pipe`, `sewer_jacket`, `starter_blood_flask`, `blackwire_scrap`, Core 0.1 equipment slots, `sewer_starter_loot` and `level_1_to_10`.

The current registry does not roll loot, execute skills, run combat, spawn enemies or manage rooms. Those systems remain separate server-authoritative tasks.

---

## Combat

Combat is Diablo 2-like:

```text
slow-medium
readable
dangerous
position-based
loot-driven
click-to-move
click-to-attack
```

Core 0.1 damage formula:

```text
finalDamage = max(1, incomingDamage - armor)
```

Long-term combat should support debuffs, DoTs, damage types, resistances and status effects.

---

## Stats

Core primary stats:

```text
Power
Speed
Mind
Toughness
```

Core 0.1 derived stats:

```text
Max HP
Current HP
Damage
Armor
Move Speed
Attack Cooldown
```

No mana/resource system in Core 0.1.

Long-term, classes may have class-specific resources.

Starting character stats are calculated server-side during character creation. Core 0.1 uses a simple deterministic foundation:

```text
primary stats = origin base stats + class base stats
maxHp = 20 + toughness * 5
damage = 1 + power
armor = 0
moveSpeed = 1 + speed * 0.02
attackCooldownMs = max(500, 1100 - speed * 25)
currentHp = maxHp
```

Starting passives and starting zone come from the selected origin content definition. The current character service does not create starting items, run gameplay rooms, move characters, execute combat or place inventory items.

---

## Inventory and Equipment

Core 0.1 uses real grid inventory.

```text
1 inventory page
10 x 6 grid
variable item sizes
server-side placement validation
equipment slots
equip/unequip
item stat modifiers
```

Core 0.1 active equipment slots:

```text
weapon
head
chest
hands
feet
ring_1
amulet
belt
flask_1
```

---

## Flask System

Long-term direction: Diablo-style belt identity + Path of Exile-like flask relevance.

Core 0.1:

```text
one belt slot
one starter healing flask
server-validated use
real HP restoration
real charges/cooldown behavior
```

---

## Death

Core 0.1 includes a real scalable death/corpse/respawn foundation:

```text
player death
corpse creation
respawn at safe point
corpse retrieval
forced recovery
durability penalty foundation
no XP loss
```

---

## Account and Profile

No guest accounts.

Core 0.1 uses:

```text
username/password registration
username/password login
public username
public displayName
avatarKey
profile/settings
character select/create
```

Username is unique, public and used for login.

Display name is public, flexible and non-unique.

Character name is required and unique only within the owning account.

---

## Localization

English is the source/default language.

Core 0.1 is English-only but localization-ready.

Do not add a language selector until at least one additional locale exists.

Initial Core 0.1 content names, descriptions and basic UI/system labels live in the localization package as English keys. Future languages are deferred until real translated locale files exist and pass validation.
