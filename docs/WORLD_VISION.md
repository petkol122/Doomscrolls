# docs/WORLD_VISION.md — World & Geography Vision

---

## What this document is

A living reference for the eventual world/geography shape of Doomscrolls, captured so it survives across future Core Builds instead of living only in conversation history. **This is not a build plan.** It has no waves, no checklist, no implementation steps, and no owner-assigned dates. Individual Core Builds (see `docs/CORE_BUILD_*_PLAN.md`) decide what actually gets built and when; this document is the thing they should be checked against for direction, not a substitute for their own scoping.

**Read this against how little exists today, not how much it describes.** As of Core 0.32, the real game has: one origin (`sewer_dweller`), two classes (`nightvision`, `gravewalker`), one town hub (Nightmarket) plus 4 combat zones, and a freshly-built `world → continent → area` content hierarchy with exactly one real area (`pilsen`, at real-world coordinates) and nothing else. Everything below this point is direction, not inventory — most of it is aspirational, several sections are explicitly marked undecided, and none of it should be read as implying more content exists than actually does.

---

## 1. Core structure: instanced zones, not a continuous open world

The world is built from discrete, individually-loaded zones connected by loading-screen transitions — the Diablo model, not the WoW/GTA continuous-traversal model. A player never walks seamlessly from one zone into the next; they transition.

Real Czech geography is the *source* for zone identity and placement (real place names, real relative positions on the world map, real coordinates on `AreaContentDefinition`), but it is mapped onto this discrete-zone structure — it is not traversed 1:1. A zone represents a place; it does not attempt to simulate the full physical extent of that place.

This matches the content model Core 0.32 already built: `ZoneContentDefinition` belongs to an `AreaContentDefinition` (real lat/long), which belongs to a `ContinentContentDefinition`, which belongs to a `WorldContentDefinition`. Adding zones, areas, or continents is content-only work against that existing hierarchy — proven scalable by Core 0.32's own synthetic-second-area test — not an architecture change.

---

## 2. Scale philosophy: internally consistent and fun, not real-world 1:1

Distances between and within zones are not meant to reflect real-world scale. The reasoning is the same one WoW and GTA both use: a game world that were actually built at 1:1 real-world distance would be mostly empty travel time, not content — internal consistency and fun win over strict realism every time the two conflict.

Concretely:
- **Walking** should feel good for short distances *within* a zone. It's the default, ordinary way to move around a district or a zone's interior.
- **Faster transport** (a mount, a car, a subway/metro — the concrete form is undecided, see Section 6) matters for longer distances, once "longer distances" is actually a thing that exists in the game — i.e., once there are enough zones/areas that a trip between them would otherwise feel like dead time. This isn't needed yet with one area on the map; it becomes relevant as the world grows.

This is a standing design principle to check new zone/area work against, not a mechanic that exists today.

### Committed: faster transport is a real future direction, not a speculative maybe

This is worth stating as an explicit commitment, not just an implication: **some form of faster transport (a mount, a car, a tram) will eventually exist.** Which exact form wins is still undecided (see Section 6) — but *that* something eventually replaces walking for long real-world-grounded distances is a settled direction, not a hypothetical.

This matters right now, before any of it is built, for a specific reason: **the game has no live players yet.** That absence is itself a real, current-state fact this project can lean on deliberately — a distance-heavy layout decision made today (a service placed a real ~350 m from the rest of a town hub, say) is exactly the kind of thing that would be a real problem once live players are walking it every session, but is genuinely fine to accept *now*, on the understanding that faster transport is a committed direction that will eventually make that distance a non-issue. This is the same shape of reasoning as a per-character "temporary until you unlock fast travel" design, just applied at the whole-project timeline level instead of the per-character progression level — the project itself is "pre-fast-travel," the same way a level-1 character is.

**A concrete example already in practice**: Core 0.33's Nightmarket redo placed the town's Waypoint prop at the real Great Synagogue, genuinely ~350 m from the rest of the service cluster (Trainer/Notice Board/Stash Keeper, which sit within ~125 m of each other near the real cathedral/City-Hall/bank cluster) — accepted deliberately rather than forced closer, exactly per this principle. See `docs/CORE_BUILD_0_33_PLAN.md`'s Question 3 Addendum for the full reasoning.

---

## 3. Eventual capital cities

Three real Czech cities are the intended "major city" tier — the WoW Stormwind/Orgrimmar-equivalent scale: substantial hub cities with real weight in the world, as opposed to a single small town or a wilderness zone.

- **Pilsen (Plzeň)** — already in progress. Nightmarket is Pilsen's town hub today; Core 0.32 gave Pilsen a real `AreaContentDefinition` (49.7384°N, 13.3736°E) on the world map; Core 0.33 (see below) is expected to expand Pilsen's real city-center content. Of the three, this is the only one with any real work behind it.
- **Prague (Praha)** — eventual capital-tier city. No content, no area entry, no scoping yet.
- **České Budějovice** — eventual capital-tier city. No content, no area entry, no scoping yet.

No relative sequencing beyond "Pilsen first" is decided — whether Prague or České Budějovice comes second, or what either actually contains, is open.

---

## 4. District-per-zone pattern within a capital

Within a capital city, real neighborhoods/districts become individual zones — not one monolithic "city" zone, and not the whole city's real districts added simultaneously. The pattern is additive: one district at a time, each a real, separately-loadable zone under the city's `AreaContentDefinition`, expanding the city gradually the way new areas expand the world map gradually.

For Pilsen specifically, four real Plzeň neighborhoods have already been named as future district-zones: **Bory, Slovany, Lochotín, Vinice**. None of these exist as zones yet — they are named intent for Pilsen's district-by-district expansion, to be added incrementally, not a committed batch.

---

## 5. Origin-specific starting experience (WoW model)

The intended model is WoW's: multiple distinct origins, each with its own starting zone and its own early content, rather than everyone funneling through one universal starting experience. Today there is exactly one origin, `sewer_dweller`, with Blackwire Sewers as its starting zone (`OriginContentDefinition.startingZoneId`) — the "multiple origins" part of this vision has zero realized examples beyond the one that already exists.

**Level-gated visibility/phasing** is the other half of the WoW reference: early on, a player should only see other players around their own level/origin-appropriate content, not the entire population of every origin and every zone at once. Visibility/phasing opens up once a character reaches capital-city-relevant content, at which point origin-based separation stops mattering and everyone converges on the same shared capital-city zones. A level around **20** was mentioned as a reference point for that threshold — explicitly not a final number (see Section 6).

None of this phasing/visibility mechanism exists in the codebase today. `ZoneContentDefinition` and `AreaContentDefinition` (as of Core 0.32) carry no level-gating field of any kind — this was an explicit non-goal of that build, deferred until a second area made "which areas can I reach" a real question.

---

## 6. Explicitly undecided

Named plainly so this document doesn't read as more settled than it is:

- **How many origins will eventually exist**, beyond "more than the current one."
- **What actually distinguishes one origin from another** — narrative framing, starting stats, starting zone only, or something deeper.
- **The exact level threshold** for capital-city convergence — "~20" is a reference point pulled from the WoW comparison, not a chosen number for this game.
- **How phasing/visibility works technically** — instance-per-level-band, a visibility filter on top of a shared instance, separate zone copies, or some other mechanism entirely. No technical approach has been chosen.
- **The concrete form of "faster transport"** referenced in Section 2 — mount, car, subway/metro, or something else; and at what point in the game's growth it actually needs to exist. (That it will exist at all is now a committed direction, not undecided — see Section 2's "Committed" subsection.)
- **Sequencing** of Prague vs. České Budějovice, and of district additions within any capital beyond "one at a time."

---

## 7. Related but deferred ideas — cross-referenced, not merged in

These came up in other conversations and are worth pointing back to from here, but they are separate open threads, not part of this document's core commitment. Do not treat their presence here as adoption.

- **Real/fictional two-layer naming.** The idea that the world map shows real place names, and entering a zone reveals its "cursed"/fictional identity underneath — a naming/presentation layer distinct from the geography-and-scale structure this document commits to.
- **Evil/normal-realm mirror concept.** A paired-realm idea (a normal version and a corrupted/evil mirrored version of the same geography) — distinct from, and not required by, the instanced-zone structure above.
- **Whether continuous-world traversal is ever revisited.** Section 1 commits to the instanced-zone model for the foreseeable future; whether a continuous-traversal mode is ever added later (for some subset of the world, or some specific travel mechanic) is an open question, not a planned reversal.

---

## 8. Professions — a real future direction, not built anywhere yet

**No profession, crafting, or gathering system exists anywhere in this codebase today.** There is no fishing, cooking, hunting, or crafting content of any kind, and none is implied to exist by anything below — this section names a real future direction and, where Core 0.33 already did the real-world research to support it, cross-references specific reserved locations, not an implementation.

The intended shape (loosely, WoW-adjacent, not yet designed in any depth): secondary, non-combat activities tied to real-world-grounded locations within a zone — a fishing spot by a river, a cooking station near a bakery, a hunting/gathering activity near a farm or market — giving zones a reason to hold points of interest beyond combat gates and core services. What actually gates progress in a profession, whether professions interact with the existing loot/currency systems, and how many professions eventually exist are all undecided.

**Reserved locations, named by Core 0.33's real geography research** (see `docs/CORE_BUILD_0_33_PLAN.md`'s Question 3 Addendum for the sourcing) — real, specific, but not built:

- **Fishing** — near Nightmarket's Saltmere Docks gate, at the real riverside embankment (Anglické nábřeží / Radbuzská náplavka) already anchoring that gate.
- **Cooking** — near a real bakery in the historic core ("PEKAŘSTVÍ CZ"), ~201 m north of Náměstí Republiky.
- **Hunting/gathering** — near a real farm shop in the historic core ("Farmářský obchod"), ~252 m east-southeast of the square.

These are place-holders for *where* a profession could live once one is designed, not a commitment to build fishing/cooking/hunting specifically, or in that order, or at all.

---

## Relationship to Core Builds

This document describes direction; it does not schedule anything. When a Core Build touches world/zone/area content, check its plan against this document for consistency (e.g., "does this new zone fit the district-per-zone pattern," "does this origin decision line up with the WoW-model direction") — but this document should be *updated* when a build makes a real decision that changes or narrows something listed here as undecided, not treated as unchangeable. It is intended to evolve slower than build-by-build, but it should not go stale either.
