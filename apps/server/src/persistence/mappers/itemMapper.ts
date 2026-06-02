import type {
  CharacterId,
  CorpseId,
  EquipmentSlot,
  ItemDefinitionId,
  ItemInstance,
  ItemInstanceId,
  ItemLocation,
  RoomId,
  ZoneId,
} from "@doomscrolls/shared";
import { ItemLocationType, type ItemInstance as PrismaItemInstance } from "@prisma/client";
import { requireString, toIsoDateTimeString } from "./dateMapper";

export function toItemLocationDto(item: PrismaItemInstance): ItemLocation {
  switch (item.locationType) {
    case ItemLocationType.ROOM_LOOT:
      return {
        type: "room_loot",
        zoneId: requireString(item.zoneId, "ItemInstance.zoneId") as ZoneId,
        roomId: requireString(item.roomId, "ItemInstance.roomId") as RoomId,
        position: {
          x: item.positionX ?? 0,
          y: item.positionY ?? 0,
        },
      };
    case ItemLocationType.INVENTORY:
      if (item.inventoryPage === null || item.inventoryX === null || item.inventoryY === null) {
        throw new Error("Cannot map inventory item without inventory coordinates");
      }

      return {
        type: "inventory",
        characterId: requireString(item.ownerCharacterId, "ItemInstance.ownerCharacterId") as CharacterId,
        pageIndex: item.inventoryPage,
        x: item.inventoryX,
        y: item.inventoryY,
      };
    case ItemLocationType.EQUIPMENT:
      return {
        type: "equipment",
        characterId: requireString(item.ownerCharacterId, "ItemInstance.ownerCharacterId") as CharacterId,
        slot: requireString(item.equipmentSlot, "ItemInstance.equipmentSlot") as EquipmentSlot,
      };
    case ItemLocationType.CORPSE_BOUND:
      return {
        type: "corpse_bound",
        characterId: requireString(item.ownerCharacterId, "ItemInstance.ownerCharacterId") as CharacterId,
        corpseId: requireString(item.corpseId, "ItemInstance.corpseId") as CorpseId,
      };
    case ItemLocationType.DELETED:
      return {
        type: "deleted",
        deletedAt: toIsoDateTimeString(item.updatedAt),
      };
  }
}

export function toItemInstanceDto(item: PrismaItemInstance): ItemInstance {
  const dto = {
    id: item.id as ItemInstanceId,
    definitionId: item.definitionId as ItemDefinitionId,
    stackQuantity: item.quantity,
    location: toItemLocationDto(item),
    createdAt: toIsoDateTimeString(item.createdAt),
    updatedAt: toIsoDateTimeString(item.updatedAt),
  };

  if (item.ownerCharacterId === null) {
    return dto;
  }

  return {
    ...dto,
    ownerCharacterId: item.ownerCharacterId as CharacterId,
  };
}