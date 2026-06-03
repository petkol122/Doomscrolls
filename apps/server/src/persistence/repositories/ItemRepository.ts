import { ItemLocationType, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";

type ItemRepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface CreateItemInstanceData {
  readonly definitionId: string;
  readonly ownerCharacterId?: string;
  readonly locationType: ItemLocationType;
  readonly inventoryPage?: number;
  readonly inventoryX?: number;
  readonly inventoryY?: number;
  readonly equipmentSlot?: string;
  readonly roomId?: string;
  readonly zoneId?: string;
  readonly positionX?: number;
  readonly positionY?: number;
  readonly corpseId?: string;
  readonly quantity?: number;
  readonly durabilityCurrent?: number;
  readonly durabilityMax?: number;
}

export interface UpdateItemLocationData {
  readonly ownerCharacterId?: string | null;
  readonly locationType: ItemLocationType;
  readonly inventoryPage?: number | null;
  readonly inventoryX?: number | null;
  readonly inventoryY?: number | null;
  readonly equipmentSlot?: string | null;
  readonly roomId?: string | null;
  readonly zoneId?: string | null;
  readonly positionX?: number | null;
  readonly positionY?: number | null;
  readonly corpseId?: string | null;
}

export class ItemRepository {
  public constructor(private readonly db: ItemRepositoryClient = defaultPrisma) {}

  public findByIdForCharacter(itemInstanceId: string, characterId: string) {
    return this.db.itemInstance.findFirst({
      where: {
        id: itemInstanceId,
        ownerCharacterId: characterId,
      },
    });
  }

  public listInventoryItems(characterId: string) {
    return this.db.itemInstance.findMany({
      where: {
        ownerCharacterId: characterId,
        locationType: ItemLocationType.INVENTORY,
      },
      orderBy: [{ inventoryPage: "asc" }, { inventoryY: "asc" }, { inventoryX: "asc" }, { createdAt: "asc" }],
    });
  }

  public listEquippedItems(characterId: string) {
    return this.db.itemInstance.findMany({
      where: {
        ownerCharacterId: characterId,
        locationType: ItemLocationType.EQUIPMENT,
      },
      orderBy: [{ equipmentSlot: "asc" }, { createdAt: "asc" }],
    });
  }

  public createItemInstance(data: CreateItemInstanceData) {
    return this.db.itemInstance.create({ data });
  }

  public updateItemLocation(itemInstanceId: string, data: UpdateItemLocationData) {
    return this.db.itemInstance.update({ where: { id: itemInstanceId }, data });
  }
}