import { ItemLocationType, type Prisma, type PrismaClient } from "@prisma/client";
import { buildMaterialBalances, buildMaterialBalancesJson, parseMaterialBalancesJson, type MaterialBalances, type MaterialId } from "@doomscrolls/shared";
import { getSharedPrismaClient } from "../prisma";

type CharacterRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface CreateCharacterStatsData {
  readonly power: number;
  readonly speed: number;
  readonly mind: number;
  readonly toughness: number;
  readonly maxHp: number;
  readonly damage: number;
  readonly armor: number;
  readonly moveSpeed: number;
  readonly attackCooldownMs: number;
}

export interface CreateCharacterPassiveData {
  readonly passiveId: string;
  readonly sourceType: string;
  readonly sourceId?: string | null;
}

export interface CreateCharacterInventoryData {
  readonly pageCount: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
}

export interface CreateCharacterWithInitialStateData {
  readonly userId: string;
  readonly characterName: string;
  readonly characterNameNormalized: string;
  readonly originId: string;
  readonly classId: string;
  readonly currentZoneId: string;
  readonly currentHp: number;
  readonly stats: CreateCharacterStatsData;
  readonly passives: readonly CreateCharacterPassiveData[];
  readonly inventory: CreateCharacterInventoryData;
}

const characterWithInitialStateInclude = { stats: true, passives: true, inventory: true } satisfies Prisma.CharacterInclude;

const characterAccountStateInclude = {
  stats: true,
  inventory: true,
  items: {
    where: { locationType: ItemLocationType.INVENTORY },
    orderBy: [{ inventoryPage: "asc" }, { inventoryY: "asc" }, { inventoryX: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.CharacterInclude;

export type CharacterWithInitialState = Prisma.CharacterGetPayload<{
  include: typeof characterWithInitialStateInclude;
}>;

export type CharacterForAccountState = Prisma.CharacterGetPayload<{
  include: typeof characterAccountStateInclude;
}>;

export interface CharacterProgressionContext {
  readonly id: string;
  readonly level: number;
  readonly currentHp: number;
  readonly originId: string;
  readonly classId: string;
}

export class CharacterRepository {
  public constructor(private readonly db: CharacterRepositoryClient = getSharedPrismaClient()) {}

  public findByIdForUser(characterId: string, userId: string) {
    return this.db.character.findFirst({
      where: { id: characterId, userId },
      include: {
        stats: true,
        passives: true,
        inventory: true,
        items: {
          where: { locationType: ItemLocationType.INVENTORY },
          orderBy: [{ inventoryPage: "asc" }, { inventoryY: "asc" }, { inventoryX: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  }

  public findFlaskChargesJsonForUser(characterId: string, userId: string) {
    return this.db.character.findFirst({
      where: { id: characterId, userId },
      select: { flaskChargesJson: true },
    });
  }

  /**
   * Milestone 0.2 — Account Stash Foundation: resolves the owning
   * account's userId from a characterId so account-wide (not
   * character-scoped) state can be looked up.
   */
  public async findOwnerUserId(characterId: string): Promise<string | null> {
    const character = await this.db.character.findUnique({
      where: { id: characterId },
      select: { userId: true },
    });
    return character?.userId ?? null;
  }

  public listByUserId(userId: string) {
    return this.db.character.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  public listByUserIdForAccountState(userId: string): Promise<readonly CharacterForAccountState[]> {
    return this.db.character.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: characterAccountStateInclude,
    });
  }

  public findByUserIdAndNormalizedName(userId: string, characterNameNormalized: string) {
    return this.db.character.findUnique({
      where: { userId_characterNameNormalized: { userId, characterNameNormalized } },
    });
  }

  /**
   * Delete a character, scoped to its owning user so one account can never
   * delete another account's character. Returns whether a row was deleted.
   */
  public async deleteForUser(characterId: string, userId: string): Promise<boolean> {
    const result = await this.db.character.deleteMany({ where: { id: characterId, userId } });
    return result.count > 0;
  }

  public createCharacterWithInitialState(data: CreateCharacterWithInitialStateData): Promise<CharacterWithInitialState> {
    const createCharacter = (tx: Prisma.TransactionClient) =>
      tx.character.create({
        data: {
          userId: data.userId,
          characterName: data.characterName,
          characterNameNormalized: data.characterNameNormalized,
          originId: data.originId,
          classId: data.classId,
          currentZoneId: data.currentZoneId,
          currentHp: data.currentHp,
          stats: { create: data.stats },
          passives: {
            create: data.passives.map((passive) => ({
              passiveId: passive.passiveId,
              sourceType: passive.sourceType,
              sourceId: passive.sourceId ?? null,
            })),
          },
          inventory: { create: data.inventory },
        },
        include: characterWithInitialStateInclude,
      });

    if ("$transaction" in this.db) {
      return this.db.$transaction(createCharacter);
    }

    return createCharacter(this.db);
  }

  public updateCurrentZone(characterId: string, zoneId: string) {
    return this.db.character.update({ where: { id: characterId }, data: { currentZoneId: zoneId } });
  }

  public updateCurrentHp(characterId: string, currentHp: number) {
    return this.db.character.update({ where: { id: characterId }, data: { currentHp } });
  }

  public updateStats(
    characterId: string,
    stats: CreateCharacterStatsData,
  ) {
    return this.db.characterStats.update({
      where: { characterId },
      data: {
        power: stats.power,
        speed: stats.speed,
        mind: stats.mind,
        toughness: stats.toughness,
        maxHp: stats.maxHp,
        damage: stats.damage,
        armor: stats.armor,
        moveSpeed: stats.moveSpeed,
        attackCooldownMs: stats.attackCooldownMs,
      },
    });
  }

  public updateXpAndLevel(characterId: string, xp: number, level: number) {
    return this.db.character.update({ where: { id: characterId }, data: { xp, level } });
  }

  /**
   * Milestone 0.3 -- Profession Training System. Persists the full
   * professions JSON blob after an unlock/rank-up.
   */
  public updateProfessionsJson(characterId: string, professionsJson: string) {
    return this.db.character.update({ where: { id: characterId }, data: { professionsJson } });
  }

  /**
   * Core 0.1 Foundation -- Skill Point Allocation.
   *
   * Persists the result of spending one unallocated skill point on a
   * single skill slot: the decremented `skillPoints` total and the
   * raised rank for that slot only (the other two ranks are left
   * untouched by omitting them from `data`).
   */
  public updateSkillAllocation(
    characterId: string,
    input: {
      readonly skillPoints: number;
      readonly slot: "primary" | "secondary" | "tertiary";
      readonly newRank: number;
    },
  ) {
    const rankField = input.slot === "primary"
      ? "primarySkillRank"
      : input.slot === "secondary"
        ? "secondarySkillRank"
        : "tertiarySkillRank";

    return this.db.character.update({
      where: { id: characterId },
      data: {
        skillPoints: input.skillPoints,
        [rankField]: input.newRank,
      },
    });
  }

  public findProgressionContext(characterId: string): Promise<CharacterProgressionContext | null> {
    return this.db.character.findUnique({
      where: { id: characterId },
      select: {
        id: true,
        level: true,
        currentHp: true,
        originId: true,
        classId: true,
      },
    });
  }

  public updateProgressionState(
    characterId: string,
    input: {
      readonly xp: number;
      readonly level: number;
      readonly currentHp: number;
      readonly stats: CreateCharacterStatsData;
      /**
       * Core 0.1 Foundation -- how many levels this update actually
       * gained (0 when no level-up occurred), so `skillPoints` can be
       * incremented by 1 per level atomically alongside the rest of
       * the progression write.
       */
      readonly levelsGained?: number;
    },
  ) {
    const levelsGained = Number.isFinite(input.levelsGained) ? Math.max(0, input.levelsGained ?? 0) : 0;
    return this.db.character.update({
      where: { id: characterId },
      data: {
        xp: input.xp,
        level: input.level,
        currentHp: input.currentHp,
        ...(levelsGained > 0 ? { skillPoints: { increment: levelsGained } } : {}),
        stats: {
          update: {
            power: input.stats.power,
            speed: input.stats.speed,
            mind: input.stats.mind,
            toughness: input.stats.toughness,
            maxHp: input.stats.maxHp,
            damage: input.stats.damage,
            armor: input.stats.armor,
            moveSpeed: input.stats.moveSpeed,
            attackCooldownMs: input.stats.attackCooldownMs,
          },
        },
      },
    });
  }

  public updateCharacterLocation(
    characterId: string,
    lastLocationZoneId: string,
    lastLocationX: number,
    lastLocationY: number,
    currentHp?: number,
    flaskChargesJson?: string,
  ) {
    return this.db.character.update({
      where: { id: characterId },
      data: {
        lastLocationZoneId,
        lastLocationX,
        lastLocationY,
        ...(currentHp !== undefined ? { currentHp } : {}),
        ...(flaskChargesJson !== undefined ? { flaskChargesJson } : {}),
      },
    });
  }

  public listWaypointActivations(characterId: string) {
    return this.db.characterWaypointActivation.findMany({
      where: { characterId },
      orderBy: [{ activatedAt: "asc" }, { waypointId: "asc" }],
    });
  }

  public activateWaypoint(characterId: string, waypointId: string, zoneId: string) {
    return this.db.characterWaypointActivation.upsert({
      where: { characterId_waypointId: { characterId, waypointId } },
      update: {},
      create: { characterId, waypointId, zoneId },
    });
  }

  /**
   * Atomically read the character's current `moneyCopper` total.
   *
   * Returns the `moneyCopper` value on success, or `null` when the
   * character could not be found.
   */
  public async getMoneyCopper(characterId: string): Promise<number | null> {
    const current = await this.db.character.findUnique({
      where: { id: characterId },
      select: { moneyCopper: true },
    });
    if (current === null) {
      return null;
    }
    return Number.isFinite(current.moneyCopper) ? Math.max(0, current.moneyCopper) : 0;
  }

  /**
   * Atomically subtract `amount` copper from a character's `moneyCopper` total.
   *
   * Returns the new `moneyCopper` total on success, or `null` when the
   * character could not be found or has insufficient funds. The
   * transaction makes the read-then-set safe against concurrent attempts.
   */
  public async decrementMoneyCopper(characterId: string, amount: number): Promise<number | null> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }
    const safeAmount = Math.floor(amount);

    if ("$transaction" in this.db) {
      return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
        const current = await tx.character.findUnique({
          where: { id: characterId },
          select: { moneyCopper: true },
        });
        if (current === null) {
          return null;
        }
        const safeCurrent = Number.isFinite(current.moneyCopper)
          ? Math.max(0, current.moneyCopper)
          : 0;
        if (safeCurrent < safeAmount) {
          return null;
        }
        const next = safeCurrent - safeAmount;
        const updated = await tx.character.update({
          where: { id: characterId },
          data: { moneyCopper: next },
          select: { moneyCopper: true },
        });
        return updated.moneyCopper;
      });
    }

    const current = await this.db.character.findUnique({
      where: { id: characterId },
      select: { moneyCopper: true },
    });
    if (current === null) {
      return null;
    }
    const safeCurrent = Number.isFinite(current.moneyCopper) ? Math.max(0, current.moneyCopper) : 0;
    if (safeCurrent < safeAmount) {
      return null;
    }
    const next = safeCurrent - safeAmount;
    const updated = await this.db.character.update({
      where: { id: characterId },
      data: { moneyCopper: next },
      select: { moneyCopper: true },
    });
    return updated.moneyCopper;
  }

  /**
   * Atomically add `delta` copper to a character's `moneyCopper` total.
   *
   * Returns the new `moneyCopper` total on success, or `null` when the
   * character could not be found. The transaction makes the read-then-
   * increment safe against concurrent pickup attempts.
   */
  public async incrementMoneyCopper(characterId: string, delta: number): Promise<number | null> {
    if (!Number.isFinite(delta) || delta <= 0) {
      return 0;
    }
    const safeDelta = Math.max(0, Math.floor(delta));

    if ("$transaction" in this.db) {
      return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
        const current = await tx.character.findUnique({
          where: { id: characterId },
          select: { moneyCopper: true },
        });
        if (current === null) {
          return null;
        }
        const safeCurrent = Number.isFinite(current.moneyCopper)
          ? Math.max(0, current.moneyCopper)
          : 0;
        const next = safeCurrent + safeDelta;
        const updated = await tx.character.update({
          where: { id: characterId },
          data: { moneyCopper: next },
          select: { moneyCopper: true },
        });
        return updated.moneyCopper;
      });
    }

    const current = await this.db.character.findUnique({
      where: { id: characterId },
      select: { moneyCopper: true },
    });
    if (current === null) {
      return null;
    }
    const safeCurrent = Number.isFinite(current.moneyCopper) ? Math.max(0, current.moneyCopper) : 0;
    const next = safeCurrent + safeDelta;
    const updated = await this.db.character.update({
      where: { id: characterId },
      data: { moneyCopper: next },
      select: { moneyCopper: true },
    });
    return updated.moneyCopper;
  }

  /** Reads a character's current material balances (Iron Scrap / Arcane Dust, see `MaterialTypes.ts`). */
  private async readMaterialBalances(
    db: Prisma.TransactionClient | PrismaClient,
    characterId: string,
  ): Promise<MaterialBalances | null> {
    const current = await db.character.findUnique({
      where: { id: characterId },
      select: { materialBalancesJson: true } as unknown as Prisma.CharacterSelect,
    });
    if (current === null) {
      return null;
    }
    return buildMaterialBalances(
      parseMaterialBalancesJson((current as unknown as { materialBalancesJson?: string }).materialBalancesJson),
    );
  }

  private writeMaterialBalances(
    db: Prisma.TransactionClient | PrismaClient,
    characterId: string,
    balances: MaterialBalances,
  ) {
    return db.character.update({
      where: { id: characterId },
      data: { materialBalancesJson: buildMaterialBalancesJson(balances) } as unknown as Prisma.CharacterUpdateInput,
    });
  }

  /**
   * Atomically add `delta` units of a salvage-material currency to a
   * character's balance (see `salvageItem.ts`). Returns the new balances
   * map on success, or `null` when the character could not be found.
   */
  public async incrementMaterialBalance(
    characterId: string,
    materialId: MaterialId,
    delta: number,
  ): Promise<MaterialBalances | null> {
    if (!Number.isFinite(delta) || delta <= 0) {
      return null;
    }
    const safeDelta = Math.max(0, Math.floor(delta));

    const run = async (db: Prisma.TransactionClient | PrismaClient): Promise<MaterialBalances | null> => {
      const current = await this.readMaterialBalances(db, characterId);
      if (current === null) {
        return null;
      }
      const next = { ...current, [materialId]: current[materialId] + safeDelta };
      await this.writeMaterialBalances(db, characterId, next);
      return next;
    };

    if ("$transaction" in this.db) {
      return this.db.$transaction((tx: Prisma.TransactionClient) => run(tx));
    }
    return run(this.db);
  }

  /**
   * Atomically subtract `delta` units of a salvage-material currency from
   * a character's balance (see `withdrawMaterialItem.ts`). Returns the
   * new balances map on success, or `null` when the character could not
   * be found or its current balance is lower than `delta`.
   */
  public async decrementMaterialBalance(
    characterId: string,
    materialId: MaterialId,
    delta: number,
  ): Promise<MaterialBalances | null> {
    if (!Number.isFinite(delta) || delta <= 0) {
      return null;
    }
    const safeDelta = Math.max(0, Math.floor(delta));

    const run = async (db: Prisma.TransactionClient | PrismaClient): Promise<MaterialBalances | null> => {
      const current = await this.readMaterialBalances(db, characterId);
      if (current === null || current[materialId] < safeDelta) {
        return null;
      }
      const next = { ...current, [materialId]: current[materialId] - safeDelta };
      await this.writeMaterialBalances(db, characterId, next);
      return next;
    };

    if ("$transaction" in this.db) {
      return this.db.$transaction((tx: Prisma.TransactionClient) => run(tx));
    }
    return run(this.db);
  }
}
